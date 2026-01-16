// Main application initialization and event handling
class AICompanionApp {
    constructor() {
        this.currentChat = null;
        this.selectedUserPersona = null;
        this.selectedAIPersona = null;
        this.isImageMode = false;
        this.editingMessageId = null;
        this.messageMenu = null;
        
        this.init();
    }
    
    // 在 app.js 的 init 方法中，修改这部分：
    async init() {
        // Initialize all modules
        this.initEventListeners();
    
        // Load data from localStorage
        await this.loadData();
    
        // Initialize auth - this will automatically check URL for BYOP key
        window.auth = new AuthManager();
        window.auth.onAuthChange = this.handleAuthChange.bind(this);
    
        // Initialize personas
        window.personas = new PersonaManager();
    
        // Initialize memory
        window.memory = new MemoryManager();
    
        // Initialize chat
        window.chat = new ChatManager();
    
        // Initialize models
        window.models = new ModelManager();
    
        // Initialize billing
        window.billing = new BillingManager();
    
        // Initialize image generation
        window.imageGen = new ImageGenerator();
    
        // Update UI
        this.updateUI();
    }

    async loadData() {
        try {
            // Load personas
            if (window.personas) {
                await window.personas.loadPersonas();
            }
            
            // Load memory
            if (window.memory) {
                await window.memory.loadMemory();
            }
            
            // Load chat history
            if (window.chat) {
                await window.chat.loadChatHistory();
            }
        } catch (error) {
            console.error('Error loading data:', error);
            owToast('Error loading saved data', 'error');
        }
    }
    
    initEventListeners() {
        // Auth button
        document.getElementById('auth-btn').addEventListener('click', () => {
            window.auth.connectAccount();
        });
        
        // Personas button
        document.getElementById('personas-btn').addEventListener('click', () => {
            this.showPersonaModal();
        });
        
        // Memory button
        document.getElementById('memory-btn').addEventListener('click', () => {
            this.showMemoryModal();
        });
        
        // Models button
        document.getElementById('models-btn').addEventListener('click', () => {
            this.showModelsModal();
        });
        
        // Billing button
        document.getElementById('billing-btn').addEventListener('click', () => {
            this.showBillingModal();
        });
        
        // Clear chat
        document.getElementById('clear-chat').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear the chat history?')) {
                window.chat.clearChat();
            }
        });
        
        // Export chat
        document.getElementById('export-chat').addEventListener('click', () => {
            window.chat.exportChat();
        });
        
        // Image mode toggle
        document.getElementById('image-mode-btn').addEventListener('click', () => {
            this.toggleImageMode();
        });
        
        // Enhance prompt
        document.getElementById('enhance-prompt-btn').addEventListener('click', () => {
            this.enhanceImagePrompt();
        });
        
        // Send message
        document.getElementById('send-btn').addEventListener('click', () => {
            this.sendMessage();
        });
        
        // Generate image
        document.getElementById('generate-image-btn').addEventListener('click', () => {
            window.imageGen.generateImage();
        });
        
        // Add user persona
        document.getElementById('add-user-persona').addEventListener('click', () => {
            this.showPersonaModal('user');
        });
        
        // Add AI persona
        document.getElementById('add-ai-persona').addEventListener('click', () => {
            this.showPersonaModal('ai');
        });
        
        // Message input handling
        const messageInput = document.getElementById('message-input');
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Auto-resize textarea
        messageInput.addEventListener('input', () => {
            this.autoResizeTextarea(messageInput);
        });
        
        // Model select change
        document.getElementById('model-select').addEventListener('change', (e) => {
            window.chat.currentModel = e.target.value;
        });
        
        // Temperature slider
        const tempSlider = document.getElementById('temperature');
        const tempValue = document.getElementById('temp-value');
        tempSlider.addEventListener('input', () => {
            tempValue.textContent = tempSlider.value;
            window.chat.temperature = parseFloat(tempSlider.value);
        });
        
        // Max tokens
        document.getElementById('max-tokens').addEventListener('change', (e) => {
            window.chat.maxTokens = parseInt(e.target.value);
        });
        
        // Streaming toggle
        document.getElementById('streaming').addEventListener('change', (e) => {
            window.chat.streaming = e.target.checked;
        });
        
        // Close modals when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideAllModals();
                }
            });
        });
        
        // Close modals with close button
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.hideAllModals();
            });
        });
        
        // Cancel persona button
        document.getElementById('cancel-persona').addEventListener('click', () => {
            this.hideAllModals();
        });
        
        // Save persona button
        document.getElementById('save-persona').addEventListener('click', () => {
            this.savePersona();
        });
        
        // Delete persona button
        document.getElementById('delete-persona').addEventListener('click', () => {
            this.deletePersona();
        });
        
        // Persona type change
        document.getElementById('persona-type').addEventListener('change', (e) => {
            this.toggleAIFields(e.target.value === 'ai');
        });
        
        // Memory tabs
        document.querySelectorAll('.memory-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchMemoryTab(tab);
            });
        });
        
        // Model tabs
        document.querySelectorAll('.model-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchModelTab(tab);
            });
        });
        
        // Add STM button
        document.getElementById('add-stm').addEventListener('click', () => {
            this.addMemory('stm');
        });
        
        // Add LTM button
        document.getElementById('add-ltm').addEventListener('click', () => {
            this.addMemory('ltm');
        });
        
        // Add keyword button
        document.getElementById('add-keyword').addEventListener('click', () => {
            this.addKeyword();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K to focus chat input
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('message-input').focus();
            }
            
            // Escape to close modals
            if (e.key === 'Escape') {
                this.hideAllModals();
                this.hideMessageMenu();
            }
        });
    }
    
    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    checkForApiKeyInUrl() {
        // This is now handled by auth.js, but we keep it as backup
        const hash = window.location.hash.slice(1);
        const params = new URLSearchParams(hash);
        const apiKey = params.get('api_key');
    
        if (apiKey && !window.auth.isAuthenticated()) {
            console.log('Backup: Found API key in URL, passing to auth');
            window.auth.handleBYOPRedirect(apiKey);
            // Clear the hash from URL
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }
    
    handleAuthChange(isAuthenticated, apiKey, balance) {
        const authStatus = document.getElementById('auth-status');
        const balanceElement = document.getElementById('balance');
        
        if (isAuthenticated) {
            authStatus.textContent = 'Connected';
            authStatus.className = 'auth-badge online';
            balanceElement.textContent = `Balance: ${balance !== null ? balance.toFixed(2) : '--'} Pollen`;
            
            // Load models after authentication
            window.models.loadModels();
            window.billing.updateBalance();
        } else {
            authStatus.textContent = 'Not Connected';
            authStatus.className = 'auth-badge offline';
            balanceElement.textContent = 'Balance: --';
        }
        
        this.updateUI();
    }
    
    toggleImageMode() {
        this.isImageMode = !this.isImageMode;
        const imageContainer = document.getElementById('image-input-container');
        const imageBtn = document.getElementById('image-mode-btn');
        const messageInput = document.getElementById('message-input');
        
        if (this.isImageMode) {
            imageContainer.style.display = 'block';
            imageBtn.classList.add('active');
            messageInput.placeholder = 'Or type a text message...';
        } else {
            imageContainer.style.display = 'none';
            imageBtn.classList.remove('active');
            messageInput.placeholder = 'Type your message here... (Shift+Enter for new line, Enter to send)';
        }
    }
    
    async enhanceImagePrompt() {
        const prompt = document.getElementById('image-prompt').value;
        if (!prompt.trim()) {
            this.showToast('Please enter a prompt to enhance', 'warning');
            return;
        }
        
        try {
            const enhancedPrompt = await window.imageGen.enhancePrompt(prompt);
            document.getElementById('image-prompt').value = enhancedPrompt;
            this.showToast('Prompt enhanced successfully!', 'success');
        } catch (error) {
            console.error('Error enhancing prompt:', error);
            this.showToast('Failed to enhance prompt', 'error');
        }
    }
    
    async sendMessage() {
        if (this.isImageMode) {
            await window.imageGen.generateImage();
            return;
        }
        
        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();
        
        if (!message) {
            this.showToast('Please enter a message', 'warning');
            return;
        }
        
        if (!window.auth.isAuthenticated()) {
            this.showToast('Please connect your account first', 'error');
            return;
        }
        
        if (!this.selectedUserPersona || !this.selectedAIPersona) {
            this.showToast('Please select both user and AI personas', 'error');
            return;
        }
        
        // Send the message
        await window.chat.sendMessage(message);
        
        // Clear input
        messageInput.value = '';
        this.autoResizeTextarea(messageInput);
    }
    
    showPersonaModal(type = null) {
        const modal = document.getElementById('persona-modal');
        modal.classList.add('active');
        
        if (type) {
            document.getElementById('persona-type').value = type;
            this.toggleAIFields(type === 'ai');
        }
        
        // Clear form
        this.clearPersonaForm();
    }
    
    toggleAIFields(show) {
        const aiFields = document.querySelectorAll('.ai-only');
        aiFields.forEach(field => {
            field.style.display = show ? 'block' : 'none';
        });
    }
    
    clearPersonaForm() {
        document.getElementById('persona-name').value = '';
        document.getElementById('persona-age').value = '';
        document.getElementById('persona-gender').value = '';
        document.getElementById('persona-backstory').value = '';
        document.getElementById('persona-physical').value = '';
        document.getElementById('persona-directive').value = '';
        document.getElementById('delete-persona').style.display = 'none';
    }
    
    async savePersona() {
        const type = document.getElementById('persona-type').value;
        const name = document.getElementById('persona-name').value.trim();
        
        if (!name) {
            this.showToast('Persona name is required', 'error');
            return;
        }
        
        const persona = {
            id: Date.now().toString(),
            type: type,
            name: name,
            age: document.getElementById('persona-age').value || null,
            gender: document.getElementById('persona-gender').value.trim() || null,
            backstory: document.getElementById('persona-backstory').value.trim() || null,
            physical: document.getElementById('persona-physical').value.trim() || null,
            directive: type === 'ai' ? document.getElementById('persona-directive').value.trim() : null,
            createdAt: new Date().toISOString()
        };
        
        await window.personas.savePersona(persona);
        
        // Update selected persona if this is the first one
        if (type === 'user' && !this.selectedUserPersona) {
            this.selectUserPersona(persona.id);
        } else if (type === 'ai' && !this.selectedAIPersona) {
            this.selectAIPersona(persona.id);
        }
        
        this.hideAllModals();
        this.updateUI();
        this.showToast('Persona saved successfully', 'success');
    }
    
    async deletePersona() {
        const name = document.getElementById('persona-name').value.trim();
        const type = document.getElementById('persona-type').value;
        
        if (!confirm(`Are you sure you want to delete "${name}"?`)) {
            return;
        }
        
        // Find and delete the persona
        const personas = type === 'user' ? window.personas.userPersonas : window.personas.aiPersonas;
        const persona = personas.find(p => p.name === name);
        
        if (persona) {
            await window.personas.deletePersona(persona.id, type);
            
            // Clear selection if deleted persona was selected
            if (type === 'user' && this.selectedUserPersona?.id === persona.id) {
                this.selectedUserPersona = null;
            } else if (type === 'ai' && this.selectedAIPersona?.id === persona.id) {
                this.selectedAIPersona = null;
            }
            
            this.hideAllModals();
            this.updateUI();
            this.showToast('Persona deleted', 'success');
        }
    }
    
    showMemoryModal() {
        const modal = document.getElementById('memory-modal');
        modal.classList.add('active');
        
        // Load memory data
        window.memory.renderMemory();
    }
    
    showModelsModal() {
        const modal = document.getElementById('models-modal');
        modal.classList.add('active');
        
        // Load models if not already loaded
        if (window.models.models.length === 0) {
            window.models.loadModels();
        }
    }
    
    showBillingModal() {
        const modal = document.getElementById('billing-modal');
        modal.classList.add('active');
        
        // Update billing info
        window.billing.updateBillingInfo();
    }
    
    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }
    
    switchMemoryTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.memory-tabs .tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tab) {
                btn.classList.add('active');
            }
        });
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
            if (content.id === `${tab}-tab`) {
                content.classList.add('active');
            }
        });
        
        // Load data for the tab
        if (tab === 'stm') {
            window.memory.renderSTM();
        } else if (tab === 'ltm') {
            window.memory.renderLTM();
        } else if (tab === 'keywords') {
            window.memory.renderKeywords();
        }
    }
    
    switchModelTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.model-tabs .tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tab) {
                btn.classList.add('active');
            }
        });
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
            if (content.id === `${tab}-tab`) {
                content.classList.add('active');
            }
        });
        
        // Load data for the tab
        if (tab === 'text-models') {
            window.models.renderTextModels();
        } else if (tab === 'image-models') {
            window.models.renderImageModels();
        } else if (tab === 'pricing') {
            window.models.renderPricingInfo();
        }
    }
    
    async addMemory(type) {
        const content = prompt(`Enter ${type === 'stm' ? 'short-term' : 'long-term'} memory:`);
        if (!content) return;
        
        const keywords = prompt('Enter keywords (comma-separated):');
        
        await window.memory.addMemory(type, content, keywords ? keywords.split(',').map(k => k.trim()) : []);
        this.showToast('Memory added', 'success');
        
        // Refresh the current tab
        if (type === 'stm') {
            window.memory.renderSTM();
        } else {
            window.memory.renderLTM();
        }
    }
    
    async addKeyword() {
        const keywordInput = document.getElementById('new-keyword');
        const keyword = keywordInput.value.trim();
        
        if (!keyword) {
            this.showToast('Please enter a keyword', 'warning');
            return;
        }
        
        await window.memory.addKeyword(keyword);
        keywordInput.value = '';
        this.showToast('Keyword added', 'success');
        window.memory.renderKeywords();
    }
    
    selectUserPersona(personaId) {
        const persona = window.personas.getPersona(personaId, 'user');
        if (persona) {
            this.selectedUserPersona = persona;
            window.chat.currentUserPersona = persona;
            this.updateUI();
        }
    }
    
    selectAIPersona(personaId) {
        const persona = window.personas.getPersona(personaId, 'ai');
        if (persona) {
            this.selectedAIPersona = persona;
            window.chat.currentAIPersona = persona;
            this.updateUI();
        }
    }
    
    updateUI() {
        // Update persona display
        const currentUserPersona = document.getElementById('current-user-persona');
        const currentAIPersona = document.getElementById('current-ai-persona');
        
        currentUserPersona.textContent = this.selectedUserPersona ? this.selectedUserPersona.name : 'No User Persona Selected';
        currentAIPersona.textContent = this.selectedAIPersona ? this.selectedAIPersona.name : 'No AI Persona Selected';
        
        // Update persona lists
        window.personas.renderPersonaLists();
        
        // Update token and message counts
        const tokenCount = document.getElementById('token-count');
        const messageCount = document.getElementById('message-count');
        
        tokenCount.textContent = `Tokens: ${window.chat.totalTokens || 0}`;
        messageCount.textContent = `Messages: ${window.chat.messages.length || 0}`;
    }
    
    showMessageMenu(x, y, messageId, isUserMessage) {
        this.hideMessageMenu();
        this.editingMessageId = messageId;
        
        const menu = document.getElementById('message-menu');
        menu.style.display = 'block';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        
        // Update menu options based on message type
        const regenerateOption = menu.querySelector('[data-action="regenerate"]');
        regenerateOption.style.display = !isUserMessage ? 'none' : 'block';
        
        this.messageMenu = menu;
        
        // Add event listeners
        menu.querySelectorAll('li').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleMessageAction(item.dataset.action);
            });
        });
        
        // Close menu when clicking elsewhere
        setTimeout(() => {
            document.addEventListener('click', this.hideMessageMenu.bind(this), { once: true });
        }, 0);
    }
    
    hideMessageMenu() {
        if (this.messageMenu) {
            this.messageMenu.style.display = 'none';
        }
        this.editingMessageId = null;
    }
    
    async handleMessageAction(action) {
        if (!this.editingMessageId) return;
        
        const message = window.chat.getMessage(this.editingMessageId);
        if (!message) return;
        
        switch (action) {
            case 'edit':
                await window.chat.editMessage(this.editingMessageId);
                break;
            case 'regenerate':
                await window.chat.regenerateMessage(this.editingMessageId);
                break;
            case 'delete':
                if (confirm('Delete this message?')) {
                    await window.chat.deleteMessage(this.editingMessageId);
                }
                break;
            case 'copy':
                navigator.clipboard.writeText(message.content).then(() => {
                    this.showToast('Message copied to clipboard', 'success');
                });
                break;
        }
        
        this.hideMessageMenu();
    }
    
    showToast(message, type = 'info') {
        const bgColor = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        }[type];
        
        Toastify({
            text: message,
            duration: 3000,
            gravity: "top",
            position: "right",
            backgroundColor: bgColor,
            stopOnFocus: true
        }).showToast();
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AICompanionApp();
});
