class ChatManager {
    constructor() {
        this.messages = [];
        this.currentUserPersona = null;
        this.currentAIPersona = null;
        this.currentModel = 'openai';
        this.temperature = 1.0;
        this.maxTokens = 2000;
        this.streaming = true;
        this.totalTokens = 0;
        this.isGenerating = false;
        
        this.loadChatHistory();
    }
    
    async loadChatHistory() {
        try {
            const saved = localStorage.getItem(`chat_history_${this.getChatId()}`);
            if (saved) {
                const data = JSON.parse(saved);
                this.messages = data.messages || [];
                this.totalTokens = data.totalTokens || 0;
                this.renderChatHistory();
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }
    
    saveChatHistory() {
        try {
            const data = {
                messages: this.messages,
                totalTokens: this.totalTokens,
                timestamp: Date.now()
            };
            localStorage.setItem(`chat_history_${this.getChatId()}`, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving chat history:', error);
        }
    }
    
    getChatId() {
        if (!this.currentUserPersona || !this.currentAIPersona) {
            return 'default';
        }
        return `${this.currentUserPersona.id}_${this.currentAIPersona.id}`;
    }
    
    async sendMessage(content) {
        if (!window.auth.isAuthenticated()) {
            throw new Error('Not authenticated');
        }
        
        if (!this.currentUserPersona || !this.currentAIPersona) {
            throw new Error('Please select personas first');
        }
        
        if (this.isGenerating) {
            throw new Error('Already generating a response');
        }
        
        this.isGenerating = true;
        
        try {
            // Add user message
            const userMessage = {
                id: Date.now().toString(),
                role: 'user',
                content: content,
                timestamp: new Date().toISOString(),
                personaId: this.currentUserPersona.id
            };
            
            this.addMessage(userMessage);
            
            // Update memory with new message
            await window.memory.processMessage(userMessage);
            
            // Show typing indicator
            this.showTypingIndicator();
            
            // Get relevant memories for context
            const relevantMemories = await window.memory.getRelevantMemories(content);
            
            // Prepare messages for API
            const messages = this.buildMessages(content, relevantMemories);
            
            // Prepare request body
            const requestBody = {
                model: this.currentModel,
                messages: messages,
                temperature: this.temperature,
                max_tokens: this.maxTokens,
                stream: this.streaming
            };
            
            // Send request
            if (this.streaming) {
                await this.sendStreamingRequest(requestBody);
            } else {
                await this.sendRegularRequest(requestBody);
            }
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.addErrorMessage('Failed to send message. Please try again.');
            throw error;
        } finally {
            this.hideTypingIndicator();
            this.isGenerating = false;
        }
    }
    
    buildMessages(content, relevantMemories) {
        const messages = [];
        
        // Build system prompt from personas and memories
        const systemPrompt = this.buildSystemPrompt(relevantMemories);
        messages.push({
            role: 'system',
            content: systemPrompt
        });
        
        // Add conversation history (last 10 messages)
        const recentMessages = this.messages.slice(-10);
        recentMessages.forEach(msg => {
            messages.push({
                role: msg.role,
                content: msg.content
            });
        });
        
        // Add current message
        messages.push({
            role: 'user',
            content: content
        });
        
        return messages;
    }
    
    buildSystemPrompt(relevantMemories) {
        const user = this.currentUserPersona;
        const ai = this.currentAIPersona;
        
        let prompt = `You are ${ai.name}, ${ai.age ? `a ${ai.age}-year-old` : 'an'} ${ai.gender || 'AI'}.\n`;
        
        if (ai.backstory) {
            prompt += `Background: ${ai.backstory}\n`;
        }
        
        if (ai.physical) {
            prompt += `Physical description: ${ai.physical}\n`;
        }
        
        if (ai.directive) {
            prompt += `Response directive: ${ai.directive}\n`;
        }
        
        prompt += `\nYou are talking to ${user.name}, ${user.age ? `a ${user.age}-year-old` : 'a person'} ${user.gender || ''}.\n`;
        
        if (user.backstory) {
            prompt += `User's background: ${user.backstory}\n`;
        }
        
        if (user.physical) {
            prompt += `User's appearance: ${user.physical}\n`;
        }
        
        // Add relevant memories
        if (relevantMemories && relevantMemories.length > 0) {
            prompt += '\nRelevant context from previous conversations:\n';
            relevantMemories.forEach(memory => {
                prompt += `- ${memory.content}\n`;
            });
        }
        
        // Add conversation guidelines
        prompt += '\nGuidelines:\n';
        prompt += '1. Stay in character at all times.\n';
        prompt += '2. Respond naturally and conversationally.\n';
        prompt += '3. Reference past conversations when relevant.\n';
        prompt += '4. Be engaging and responsive.\n';
        
        return prompt;
    }
    
    async sendStreamingRequest(requestBody) {
        const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
            method: 'POST',
            headers: window.auth.getHeaders(),
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';
        let messageId = Date.now().toString();
        
        // Create message placeholder
        const aiMessage = {
            id: messageId,
            role: 'assistant',
            content: '',
            timestamp: new Date().toISOString(),
            personaId: this.currentAIPersona.id,
            isStreaming: true
        };
        
        this.addMessage(aiMessage, true);
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim() !== '');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            break;
                        }
                        
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices[0]?.delta?.content || '';
                            if (content) {
                                accumulatedContent += content;
                                this.updateStreamingMessage(messageId, accumulatedContent);
                            }
                        } catch (e) {
                            console.error('Error parsing streaming data:', e);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
            
            // Finalize the message
            aiMessage.content = accumulatedContent;
            aiMessage.isStreaming = false;
            this.updateMessage(messageId, aiMessage);
            
            // Update memory with AI response
            await window.memory.processMessage(aiMessage);
            
            // Estimate tokens (rough approximation)
            this.totalTokens += Math.ceil(accumulatedContent.length / 4);
            this.saveChatHistory();
            window.app.updateUI();
        }
    }
    
    async sendRegularRequest(requestBody) {
        const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
            method: 'POST',
            headers: window.auth.getHeaders(),
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';
        
        // Add AI message
        const aiMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: content,
            timestamp: new Date().toISOString(),
            personaId: this.currentAIPersona.id
        };
        
        this.addMessage(aiMessage);
        
        // Update memory with AI response
        await window.memory.processMessage(aiMessage);
        
        // Update token count
        if (data.usage) {
            this.totalTokens += data.usage.total_tokens || 0;
        }
        
        this.saveChatHistory();
        window.app.updateUI();
        
        return content;
    }
    
    addMessage(message, isStreaming = false) {
        this.messages.push(message);
        this.renderMessage(message, isStreaming);
        this.saveChatHistory();
        window.app.updateUI();
    }
    
    updateStreamingMessage(messageId, content) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"] .message-content`);
        if (messageElement) {
            messageElement.innerHTML = window.markdownRenderer.renderMarkdown(content);
        }
    }
    
    updateMessage(messageId, updatedMessage) {
        const index = this.messages.findIndex(m => m.id === messageId);
        if (index !== -1) {
            this.messages[index] = updatedMessage;
            this.renderMessage(updatedMessage, false, true);
            this.saveChatHistory();
        }
    }
    
    renderMessage(message, isStreaming = false, isUpdate = false) {
        const chatMessages = document.getElementById('chat-messages');
        
        if (isUpdate) {
            // Remove existing message
            const existing = document.querySelector(`[data-message-id="${message.id}"]`);
            if (existing) {
                existing.remove();
            }
        }
        
        // Remove welcome message if it exists
        const welcomeMessage = document.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = `message message-${message.role}`;
        messageElement.dataset.messageId = message.id;
        messageElement.dataset.isUser = message.role === 'user';
        
        // Get persona name
        let personaName = message.role === 'user' 
            ? (this.currentUserPersona?.name || 'User')
            : (this.currentAIPersona?.name || 'AI');
        
        const timestamp = new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${personaName}</span>
                <span class="message-time">${timestamp}</span>
            </div>
            <div class="message-content">
                ${isStreaming ? '<div class="typing-indicator"><span></span><span></span><span></span></div>' : window.markdownRenderer.renderMarkdown(message.content)}
            </div>
            <div class="message-actions">
                <button class="message-action-btn" onclick="event.stopPropagation(); window.app.showMessageMenu(event.pageX, event.pageY, '${message.id}', ${message.role === 'user'})">
                    <i class="fas fa-ellipsis-h"></i>
                </button>
            </div>
        `;
        
        chatMessages.appendChild(messageElement);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Add click handler for context menu
        messageElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            window.app.showMessageMenu(e.pageX, e.pageY, message.id, message.role === 'user');
        });
    }
    
    renderChatHistory() {
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.innerHTML = '';
        
        if (this.messages.length === 0) {
            chatMessages.innerHTML = `
                <div class="welcome-message">
                    <i class="fas fa-comments"></i>
                    <h3>Welcome to AI Companion</h3>
                    <p>Select personas and start chatting</p>
                </div>
            `;
            return;
        }
        
        this.messages.forEach(message => {
            this.renderMessage(message);
        });
        
        // Scroll to bottom
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);
    }
    
    showTypingIndicator() {
        const chatMessages = document.getElementById('chat-messages');
        
        // Remove existing typing indicator
        this.hideTypingIndicator();
        
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'message message-ai typing-indicator';
        typingIndicator.id = 'typing-indicator';
        typingIndicator.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${this.currentAIPersona?.name || 'AI'}</span>
                <span class="message-time">typing...</span>
            </div>
            <div class="typing-indicator">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        `;
        
        chatMessages.appendChild(typingIndicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    
    addErrorMessage(content) {
        const errorMessage = {
            id: Date.now().toString(),
            role: 'system',
            content: content,
            timestamp: new Date().toISOString(),
            isError: true
        };
        
        this.messages.push(errorMessage);
        
        const chatMessages = document.getElementById('chat-messages');
        const messageElement = document.createElement('div');
        messageElement.className = 'message message-system error';
        messageElement.innerHTML = `
            <div class="message-content">
                <i class="fas fa-exclamation-triangle"></i> ${content}
            </div>
        `;
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    async editMessage(messageId) {
        const message = this.getMessage(messageId);
        if (!message) return;
        
        const newContent = prompt('Edit message:', message.content);
        if (newContent === null || newContent === message.content) return;
        
        // Update message
        message.content = newContent;
        message.edited = true;
        message.editTimestamp = new Date().toISOString();
        
        this.updateMessage(messageId, message);
        
        // If this is a user message, regenerate AI response
        if (message.role === 'user') {
            // Find the next AI message
            const messageIndex = this.messages.findIndex(m => m.id === messageId);
            const nextAIMessage = this.messages.slice(messageIndex + 1).find(m => m.role === 'assistant');
            
            if (nextAIMessage) {
                // Delete the AI response and regenerate
                await this.deleteMessage(nextAIMessage.id);
                await this.sendMessage(newContent);
            }
        }
    }
    
    async regenerateMessage(messageId) {
        const message = this.getMessage(messageId);
        if (!message || message.role !== 'user') return;
        
        // Find and delete the AI response
        const messageIndex = this.messages.findIndex(m => m.id === messageId);
        const nextAIMessage = this.messages.slice(messageIndex + 1).find(m => m.role === 'assistant');
        
        if (nextAIMessage) {
            await this.deleteMessage(nextAIMessage.id);
        }
        
        // Regenerate response
        await this.sendMessage(message.content);
    }
    
    async deleteMessage(messageId) {
        const index = this.messages.findIndex(m => m.id === messageId);
        if (index === -1) return;
        
        // Remove from memory
        const message = this.messages[index];
        await window.memory.removeMessageFromMemory(message);
        
        // Remove from array
        this.messages.splice(index, 1);
        
        // Remove from UI
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.remove();
        }
        
        // Update token count (rough estimate)
        this.totalTokens = Math.max(0, this.totalTokens - Math.ceil(message.content.length / 4));
        
        this.saveChatHistory();
        window.app.updateUI();
    }
    
    getMessage(messageId) {
        return this.messages.find(m => m.id === messageId);
    }
    
    clearChat() {
        if (confirm('Are you sure you want to clear all chat history?')) {
            this.messages = [];
            this.totalTokens = 0;
            
            const chatMessages = document.getElementById('chat-messages');
            chatMessages.innerHTML = `
                <div class="welcome-message">
                    <i class="fas fa-comments"></i>
                    <h3>Welcome to AI Companion</h3>
                    <p>Select personas and start chatting</p>
                </div>
            `;
            
            localStorage.removeItem(`chat_history_${this.getChatId()}`);
            window.app.updateUI();
        }
    }
    
    exportChat() {
        const chatData = {
            userPersona: this.currentUserPersona,
            aiPersona: this.currentAIPersona,
            messages: this.messages,
            exportDate: new Date().toISOString(),
            totalTokens: this.totalTokens
        };
        
        const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-companion-chat-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        window.app.showToast('Chat exported successfully', 'success');
    }
                  }
