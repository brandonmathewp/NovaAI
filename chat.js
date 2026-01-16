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
        this.currentStreamingMessageId = null;
        this.streamingController = null;
        
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
                timestamp: Date.now(),
                currentUserPersona: this.currentUserPersona?.id,
                currentAIPersona: this.currentAIPersona?.id,
                currentModel: this.currentModel
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
        if (!window.auth || !window.auth.isAuthenticated()) {
            window.app.showToast('Please connect your account first', 'error');
            throw new Error('Not authenticated');
        }
        
        if (!this.currentUserPersona || !this.currentAIPersona) {
            window.app.showToast('Please select both user and AI personas', 'error');
            throw new Error('Please select personas first');
        }
        
        if (this.isGenerating) {
            window.app.showToast('Please wait for the current response to finish', 'warning');
            throw new Error('Already generating a response');
        }
        
        if (!content || content.trim() === '') {
            window.app.showToast('Please enter a message', 'warning');
            throw new Error('Empty message');
        }
        
        this.isGenerating = true;
        
        try {
            console.log('Sending message:', {
                model: this.currentModel,
                hasAuth: !!window.auth.getApiKey(),
                authKeyPrefix: window.auth.getApiKey()?.substring(0, 10) + '...',
                streaming: this.streaming
            });
            
            // Add user message
            const userMessage = {
                id: Date.now().toString(),
                role: 'user',
                content: content,
                timestamp: new Date().toISOString(),
                personaId: this.currentUserPersona.id,
                model: this.currentModel
            };
            
            this.addMessage(userMessage);
            
            // Update memory with new message
            if (window.memory) {
                await window.memory.processMessage(userMessage);
            }
            
            // Show typing indicator
            this.showTypingIndicator();
            
            // Get relevant memories for context
            const relevantMemories = window.memory ? await window.memory.getRelevantMemories(content) : [];
            
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
            
            console.log('Sending request to API:', {
                model: requestBody.model,
                messageCount: messages.length,
                temperature: requestBody.temperature,
                streaming: requestBody.stream
            });
            
            // Send request
            if (this.streaming) {
                await this.sendStreamingRequest(requestBody);
            } else {
                await this.sendRegularRequest(requestBody);
            }
            
        } catch (error) {
            console.error('Error sending message:', error);
            
            // Provide detailed error information
            let errorMsg = 'Failed to send message. ';
            if (error.message.includes('401') || error.message.includes('403')) {
                errorMsg += 'Authentication error. Please check your API key.';
            } else if (error.message.includes('Failed to fetch')) {
                errorMsg += 'Network error. Please check your connection.';
            } else if (error.message.includes('429')) {
                errorMsg += 'Rate limit exceeded. Please try again later.';
            } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
                errorMsg += 'Server error. Please try again.';
            } else {
                errorMsg += 'Please try again.';
            }
            
            this.addErrorMessage(errorMsg);
            window.app.showToast(errorMsg, 'error');
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
        
        // Add conversation history (last 10 messages to avoid token limits)
        const recentMessages = this.messages.slice(-10);
        recentMessages.forEach(msg => {
            // Skip system messages and the current message
            if (msg.role === 'system') return;
            
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
        
        if (!user || !ai) {
            return 'You are a helpful AI assistant.';
        }
        
        let prompt = `You are ${ai.name}, ${ai.age ? `a ${ai.age}-year-old` : 'an'} ${ai.gender || 'AI'} assistant.\n\n`;
        
        if (ai.backstory) {
            prompt += `Background: ${ai.backstory}\n\n`;
        }
        
        if (ai.physical) {
            prompt += `Physical description: ${ai.physical}\n\n`;
        }
        
        if (ai.directive) {
            prompt += `Response directive: ${ai.directive}\n\n`;
        }
        
        prompt += `You are talking to ${user.name}, ${user.age ? `a ${user.age}-year-old` : 'a person'} ${user.gender || ''}.\n\n`;
        
        if (user.backstory) {
            prompt += `User's background: ${user.backstory}\n\n`;
        }
        
        if (user.physical) {
            prompt += `User's appearance: ${user.physical}\n\n`;
        }
        
        // Add relevant memories if available
        if (relevantMemories && relevantMemories.length > 0) {
            prompt += 'Relevant context from previous conversations:\n';
            relevantMemories.forEach(memory => {
                prompt += `- ${memory.content}\n`;
            });
            prompt += '\n';
        }
        
        // Add conversation guidelines
        prompt += 'Guidelines:\n';
        prompt += '1. Stay in character at all times.\n';
        prompt += '2. Respond naturally and conversationally.\n';
        prompt += '3. Reference past conversations when relevant.\n';
        prompt += '4. Be engaging, helpful, and responsive.\n';
        prompt += '5. If appropriate, ask follow-up questions to continue the conversation.\n';
        
        return prompt;
    }
    
    async sendStreamingRequest(requestBody) {
        const controller = new AbortController();
        this.streamingController = controller;
        
        try {
            const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
                method: 'POST',
                headers: window.auth.getHeaders(),
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', response.status, errorText);
                throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = '';
            let messageId = Date.now().toString();
            this.currentStreamingMessageId = messageId;
            
            // Create message placeholder
            const aiMessage = {
                id: messageId,
                role: 'assistant',
                content: '',
                timestamp: new Date().toISOString(),
                personaId: this.currentAIPersona.id,
                model: this.currentModel,
                isStreaming: true
            };
            
            this.addMessage(aiMessage, true);
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
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
                            
                            // Check for finish reason
                            if (parsed.choices[0]?.finish_reason) {
                                console.log('Stream finished with reason:', parsed.choices[0].finish_reason);
                            }
                        } catch (e) {
                            console.error('Error parsing streaming data:', e, 'Data:', data);
                        }
                    }
                }
            }
            
            // Finalize the message
            aiMessage.content = accumulatedContent;
            aiMessage.isStreaming = false;
            this.updateMessage(messageId, aiMessage);
            
            // Update memory with AI response
            if (window.memory) {
                await window.memory.processMessage(aiMessage);
            }
            
            // Estimate tokens (rough approximation: 4 characters ≈ 1 token)
            this.totalTokens += Math.ceil(accumulatedContent.length / 4);
            this.saveChatHistory();
            window.app.updateUI();
            
            console.log('Streaming response complete:', {
                contentLength: accumulatedContent.length,
                estimatedTokens: Math.ceil(accumulatedContent.length / 4)
            });
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Request aborted by user');
                this.addErrorMessage('Request cancelled by user.');
            } else {
                throw error;
            }
        } finally {
            this.currentStreamingMessageId = null;
            this.streamingController = null;
        }
    }
    
    async sendRegularRequest(requestBody) {
        try {
            const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
                method: 'POST',
                headers: window.auth.getHeaders(),
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', response.status, errorText);
                throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
            }
            
            const data = await response.json();
            const content = data.choices[0]?.message?.content || '';
            
            console.log('Regular response received:', {
                contentLength: content.length,
                finishReason: data.choices[0]?.finish_reason,
                model: data.model
            });
            
            // Add AI message
            const aiMessage = {
                id: Date.now().toString(),
                role: 'assistant',
                content: content,
                timestamp: new Date().toISOString(),
                personaId: this.currentAIPersona.id,
                model: this.currentModel
            };
            
            this.addMessage(aiMessage);
            
            // Update memory with AI response
            if (window.memory) {
                await window.memory.processMessage(aiMessage);
            }
            
            // Update token count
            if (data.usage) {
                this.totalTokens += data.usage.total_tokens || 0;
                console.log('Token usage:', data.usage);
            } else {
                // Fallback estimation
                this.totalTokens += Math.ceil(content.length / 4);
            }
            
            this.saveChatHistory();
            window.app.updateUI();
            
            return content;
            
        } catch (error) {
            throw error;
        }
    }
    
    stopGenerating() {
        if (this.streamingController) {
            this.streamingController.abort();
            this.streamingController = null;
            
            // Mark the current streaming message as incomplete
            if (this.currentStreamingMessageId) {
                const message = this.getMessage(this.currentStreamingMessageId);
                if (message) {
                    message.content += '\n\n[Response interrupted]';
                    message.isStreaming = false;
                    this.updateMessage(this.currentStreamingMessageId, message);
                }
                this.currentStreamingMessageId = null;
            }
            
            this.isGenerating = false;
            window.app.showToast('Response stopped', 'info');
        }
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
            messageElement.innerHTML = window.markdownRenderer ? 
                window.markdownRenderer.renderMarkdown(content) : 
                this.escapeHtml(content);
            
            // Scroll to bottom
            const chatMessages = document.getElementById('chat-messages');
            chatMessages.scrollTop = chatMessages.scrollHeight;
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
        
        if (!chatMessages) return;
        
        if (isUpdate) {
            // Remove existing message
            const existing = document.querySelector(`[data-message-id="${message.id}"]`);
            if (existing) {
                existing.remove();
            }
        }
        
        // Remove welcome message if it exists
        const welcomeMessage = document.querySelector('.welcome-message');
        if (welcomeMessage && this.messages.length > 0) {
            welcomeMessage.remove();
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = `message message-${message.role}${message.isError ? ' error' : ''}`;
        messageElement.dataset.messageId = message.id;
        messageElement.dataset.isUser = message.role === 'user';
        
        // Get persona name
        let personaName = 'Unknown';
        if (message.role === 'user') {
            personaName = this.currentUserPersona?.name || 'User';
        } else if (message.role === 'assistant') {
            personaName = this.currentAIPersona?.name || 'AI';
        } else if (message.role === 'system') {
            personaName = 'System';
        }
        
        const timestamp = new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        let contentHtml = '';
        if (message.isError) {
            contentHtml = `<div class="error-content"><i class="fas fa-exclamation-triangle"></i> ${this.escapeHtml(message.content)}</div>`;
        } else if (isStreaming) {
            contentHtml = '<div class="typing-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>';
        } else if (message.imageUrl) {
            contentHtml = `
                <div class="image-message">
                    <p><strong>Image Prompt:</strong> ${this.escapeHtml(message.content.replace('[Image: ', '').replace(']', ''))}</p>
                    <img src="${message.imageUrl}" alt="Generated image" style="max-width: 100%; border-radius: 8px; margin-top: 10px;">
                    ${message.imageModel ? `<p class="image-model">Model: ${message.imageModel}</p>` : ''}
                </div>
            `;
        } else {
            contentHtml = window.markdownRenderer ? 
                window.markdownRenderer.renderMarkdown(message.content) : 
                this.escapeHtml(message.content);
        }
        
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${personaName}</span>
                <span class="message-time">${timestamp}</span>
            </div>
            <div class="message-content">
                ${contentHtml}
            </div>
            ${!message.isError && message.role !== 'system' ? `
                <div class="message-actions">
                    <button class="message-action-btn" onclick="event.stopPropagation(); window.app.showMessageMenu(event.pageX, event.pageY, '${message.id}', ${message.role === 'user'})">
                        <i class="fas fa-ellipsis-h"></i>
                    </button>
                </div>
            ` : ''}
        `;
        
        chatMessages.appendChild(messageElement);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Add click handler for context menu (right-click)
        if (!message.isError && message.role !== 'system') {
            messageElement.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                window.app.showMessageMenu(e.pageX, e.pageY, message.id, message.role === 'user');
            });
        }
        
        // Add double-click to edit for user messages
        if (message.role === 'user') {
            messageElement.addEventListener('dblclick', () => {
                this.editMessage(message.id);
            });
        }
    }
    
    renderChatHistory() {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;
        
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
        if (!chatMessages) return;
        
        // Remove existing typing indicator
        this.hideTypingIndicator();
        
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'message message-ai typing-indicator';
        typingIndicator.id = 'typing-indicator';
        
        const aiName = this.currentAIPersona?.name || 'AI';
        
        typingIndicator.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${aiName}</span>
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
        if (chatMessages) {
            const messageElement = document.createElement('div');
            messageElement.className = 'message message-system error';
            messageElement.innerHTML = `
                <div class="message-content">
                    <i class="fas fa-exclamation-triangle"></i> ${this.escapeHtml(content)}
                </div>
            `;
            
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
    
    async editMessage(messageId) {
        const message = this.getMessage(messageId);
        if (!message) {
            window.app.showToast('Message not found', 'error');
            return;
        }
        
        if (message.role !== 'user') {
            window.app.showToast('Only user messages can be edited', 'warning');
            return;
        }
        
        const newContent = prompt('Edit your message:', message.content);
        if (newContent === null || newContent === message.content) return;
        
        // Update message
        message.content = newContent;
        message.edited = true;
        message.editTimestamp = new Date().toISOString();
        
        this.updateMessage(messageId, message);
        window.app.showToast('Message edited', 'success');
        
        // Update memory
        if (window.memory) {
            await window.memory.removeMessageFromMemory(message);
            await window.memory.processMessage(message);
        }
        
        // If this is a user message, find and delete the following AI response
        if (message.role === 'user') {
            const messageIndex = this.messages.findIndex(m => m.id === messageId);
            if (messageIndex !== -1) {
                // Find the next AI message
                for (let i = messageIndex + 1; i < this.messages.length; i++) {
                    if (this.messages[i].role === 'assistant') {
                        // Ask if user wants to regenerate
                        if (confirm('Do you want to regenerate the AI response to match your edited message?')) {
                            await this.deleteMessage(this.messages[i].id);
                            await this.sendMessage(newContent);
                        }
                        break;
                    }
                }
            }
        }
    }
    
    async regenerateMessage(messageId) {
        const message = this.getMessage(messageId);
        if (!message) {
            window.app.showToast('Message not found', 'error');
            return;
        }
        
        if (message.role !== 'user') {
            window.app.showToast('Can only regenerate responses to user messages', 'warning');
            return;
        }
        
        // Find and delete the AI response
        const messageIndex = this.messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) return;
        
        let aiMessageDeleted = false;
        for (let i = messageIndex + 1; i < this.messages.length; i++) {
            if (this.messages[i].role === 'assistant') {
                await this.deleteMessage(this.messages[i].id);
                aiMessageDeleted = true;
                break;
            }
        }
        
        if (!aiMessageDeleted) {
            window.app.showToast('No AI response found to regenerate', 'warning');
            return;
        }
        
        // Regenerate response
        await this.sendMessage(message.content);
        window.app.showToast('Regenerating response...', 'info');
    }
    
    async deleteMessage(messageId) {
        const message = this.getMessage(messageId);
        if (!message) return;
        
        if (!confirm('Are you sure you want to delete this message?')) {
            return;
        }
        
        // Remove from memory
        if (window.memory) {
            await window.memory.removeMessageFromMemory(message);
        }
        
        // Remove from array
        const index = this.messages.findIndex(m => m.id === messageId);
        if (index !== -1) {
            this.messages.splice(index, 1);
            
            // Update token count (rough estimate)
            this.totalTokens = Math.max(0, this.totalTokens - Math.ceil(message.content.length / 4));
        }
        
        // Remove from UI
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.remove();
        }
        
        this.saveChatHistory();
        window.app.updateUI();
        window.app.showToast('Message deleted', 'success');
    }
    
    getMessage(messageId) {
        return this.messages.find(m => m.id === messageId);
    }
    
    clearChat() {
        if (this.messages.length === 0) {
            window.app.showToast('Chat is already empty', 'info');
            return;
        }
        
        if (confirm('Are you sure you want to clear all chat history? This cannot be undone.')) {
            this.messages = [];
            this.totalTokens = 0;
            
            const chatMessages = document.getElementById('chat-messages');
            if (chatMessages) {
                chatMessages.innerHTML = `
                    <div class="welcome-message">
                        <i class="fas fa-comments"></i>
                        <h3>Welcome to AI Companion</h3>
                        <p>Select personas and start chatting</p>
                    </div>
                `;
            }
            
            localStorage.removeItem(`chat_history_${this.getChatId()}`);
            window.app.updateUI();
            window.app.showToast('Chat cleared', 'success');
        }
    }
    
    exportChat() {
        if (this.messages.length === 0) {
            window.app.showToast('No chat history to export', 'warning');
            return;
        }
        
        const chatData = {
            userPersona: this.currentUserPersona,
            aiPersona: this.currentAIPersona,
            messages: this.messages,
            exportDate: new Date().toISOString(),
            totalTokens: this.totalTokens,
            settings: {
                model: this.currentModel,
                temperature: this.temperature,
                maxTokens: this.maxTokens
            }
        };
        
        const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        const personasStr = this.currentUserPersona && this.currentAIPersona ? 
            `${this.currentUserPersona.name}-${this.currentAIPersona.name}` : 'chat';
        a.download = `ai-companion-${personasStr}-${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        window.app.showToast('Chat exported successfully', 'success');
    }
    
    exportChatAsText() {
        if (this.messages.length === 0) {
            window.app.showToast('No chat history to export', 'warning');
            return;
        }
        
        let text = `AI Companion Chat Export\n`;
        text += `Date: ${new Date().toISOString()}\n`;
        text += `User Persona: ${this.currentUserPersona?.name || 'Not set'}\n`;
        text += `AI Persona: ${this.currentAIPersona?.name || 'Not set'}\n`;
        text += `Model: ${this.currentModel}\n`;
        text += `Total Messages: ${this.messages.length}\n`;
        text += `Total Tokens: ${this.totalTokens}\n\n`;
        text += `=== Chat History ===\n\n`;
        
        this.messages.forEach((message, index) => {
            const timestamp = new Date(message.timestamp).toLocaleString();
            const sender = message.role === 'user' ? 
                (this.currentUserPersona?.name || 'User') : 
                (this.currentAIPersona?.name || 'AI');
            
            text += `${timestamp} - ${sender}:\n`;
            text += `${message.content}\n\n`;
        });
        
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        const personasStr = this.currentUserPersona && this.currentAIPersona ? 
            `${this.currentUserPersona.name}-${this.currentAIPersona.name}` : 'chat';
        a.download = `ai-companion-${personasStr}-${dateStr}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        window.app.showToast('Chat exported as text', 'success');
    }
    
    importChat(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            
            if (!data.messages || !Array.isArray(data.messages)) {
                throw new Error('Invalid chat data format');
            }
            
            // Ask for confirmation
            if (!confirm(`Import chat with ${data.messages.length} messages? This will replace your current chat.`)) {
                return false;
            }
            
            this.messages = data.messages;
            this.totalTokens = data.totalTokens || 0;
            
            // Try to match personas
            if (data.userPersona && window.personas) {
                const matchingUserPersona = window.personas.userPersonas.find(p => p.id === data.userPersona.id);
                if (matchingUserPersona) {
                    this.currentUserPersona = matchingUserPersona;
                }
            }
            
            if (data.aiPersona && window.personas) {
                const matchingAIPersona = window.personas.aiPersonas.find(p => p.id === data.aiPersona.id);
                if (matchingAIPersona) {
                    this.currentAIPersona = matchingAIPersona;
                }
            }
            
            if (data.settings) {
                if (data.settings.model) this.currentModel = data.settings.model;
                if (data.settings.temperature) this.temperature = data.settings.temperature;
                if (data.settings.maxTokens) this.maxTokens = data.settings.maxTokens;
            }
            
            this.renderChatHistory();
            this.saveChatHistory();
            window.app.updateUI();
            
            window.app.showToast(`Chat imported successfully (${this.messages.length} messages)`, 'success');
            return true;
            
        } catch (error) {
            console.error('Error importing chat:', error);
            window.app.showToast('Failed to import chat: ' + error.message, 'error');
            return false;
        }
    }
    
    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            this.importChat(e.target.result);
        };
        reader.onerror = (error) => {
            console.error('File read error:', error);
            window.app.showToast('Failed to read file', 'error');
        };
        reader.readAsText(file);
        
        // Reset the file input
        event.target.value = '';
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Utility method to add stop button during generation
    addStopButton() {
        const chatInputContainer = document.querySelector('.chat-input-container');
        if (!chatInputContainer) return;
        
        // Remove existing stop button
        this.removeStopButton();
        
        const stopButton = document.createElement('button');
        stopButton.id = 'stop-generating-btn';
        stopButton.className = 'btn btn-danger btn-small';
        stopButton.innerHTML = '<i class="fas fa-stop"></i> Stop Generating';
        stopButton.style.marginLeft = '10px';
        stopButton.onclick = () => this.stopGenerating();
        
        const inputWrapper = document.querySelector('.message-input-wrapper');
        if (inputWrapper) {
            inputWrapper.appendChild(stopButton);
        }
    }
    
    removeStopButton() {
        const stopButton = document.getElementById('stop-generating-btn');
        if (stopButton) {
            stopButton.remove();
        }
    }
    
    // Method to update model settings dynamically
    updateModelSettings(settings) {
        if (settings.model) this.currentModel = settings.model;
        if (settings.temperature !== undefined) this.temperature = settings.temperature;
        if (settings.maxTokens !== undefined) this.maxTokens = settings.maxTokens;
        if (settings.streaming !== undefined) this.streaming = settings.streaming;
        
        console.log('Model settings updated:', {
            model: this.currentModel,
            temperature: this.temperature,
            maxTokens: this.maxTokens,
            streaming: this.streaming
        });
        
        // Update UI elements if they exist
        const modelSelect = document.getElementById('model-select');
        if (modelSelect) modelSelect.value = this.currentModel;
        
        const tempSlider = document.getElementById('temperature');
        const tempValue = document.getElementById('temp-value');
        if (tempSlider && tempValue) {
            tempSlider.value = this.temperature;
            tempValue.textContent = this.temperature.toFixed(1);
        }
        
        const maxTokensInput = document.getElementById('max-tokens');
        if (maxTokensInput) maxTokensInput.value = this.maxTokens;
        
        const streamingCheckbox = document.getElementById('streaming');
        if (streamingCheckbox) streamingCheckbox.checked = this.streaming;
        
        window.app.showToast('Model settings updated', 'success');
    }
                }
