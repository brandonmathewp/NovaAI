class PersonaManager {
    constructor() {
        this.userPersonas = [];
        this.aiPersonas = [];
        
        this.loadPersonas();
    }
    
    async loadPersonas() {
        try {
            const userPersonas = localStorage.getItem('personas_user');
            const aiPersonas = localStorage.getItem('personas_ai');
            
            if (userPersonas) this.userPersonas = JSON.parse(userPersonas);
            if (aiPersonas) this.aiPersonas = JSON.parse(aiPersonas);
            
            // If no personas exist, create default ones
            if (this.userPersonas.length === 0) {
                this.createDefaultPersonas();
            }
        } catch (error) {
            console.error('Error loading personas:', error);
            this.userPersonas = [];
            this.aiPersonas = [];
            this.createDefaultPersonas();
        }
    }
    
    createDefaultPersonas() {
        // Create default user persona
        const defaultUser = {
            id: 'user_default',
            type: 'user',
            name: 'You',
            age: null,
            gender: null,
            backstory: 'A curious person interested in AI conversations',
            physical: null,
            createdAt: new Date().toISOString()
        };
        
        // Create default AI persona
        const defaultAI = {
            id: 'ai_default',
            type: 'ai',
            name: 'AI Companion',
            age: null,
            gender: 'AI',
            backstory: 'A helpful and knowledgeable AI assistant',
            physical: 'A digital entity represented by text',
            directive: 'Be helpful, informative, and engaging. Provide thoughtful responses.',
            createdAt: new Date().toISOString()
        };
        
        this.userPersonas.push(defaultUser);
        this.aiPersonas.push(defaultAI);
        
        this.savePersonas();
    }
    
    savePersonas() {
        try {
            localStorage.setItem('personas_user', JSON.stringify(this.userPersonas));
            localStorage.setItem('personas_ai', JSON.stringify(this.aiPersonas));
        } catch (error) {
            console.error('Error saving personas:', error);
        }
    }
    
    async savePersona(persona) {
        if (persona.type === 'user') {
            // Check if persona with same name exists
            const existingIndex = this.userPersonas.findIndex(p => p.name === persona.name && p.id !== persona.id);
            if (existingIndex !== -1) {
                // Update existing
                this.userPersonas[existingIndex] = persona;
            } else {
                // Add new
                this.userPersonas.push(persona);
            }
        } else {
            // Check if persona with same name exists
            const existingIndex = this.aiPersonas.findIndex(p => p.name === persona.name && p.id !== persona.id);
            if (existingIndex !== -1) {
                // Update existing
                this.aiPersonas[existingIndex] = persona;
            } else {
                // Add new
                this.aiPersonas.push(persona);
            }
        }
        
        this.savePersonas();
        
        // Update UI
        this.renderPersonaLists();
        
        return persona;
    }
    
    async deletePersona(personaId, type) {
        if (type === 'user') {
            this.userPersonas = this.userPersonas.filter(p => p.id !== personaId);
        } else {
            this.aiPersonas = this.aiPersonas.filter(p => p.id !== personaId);
        }
        
        this.savePersonas();
        this.renderPersonaLists();
    }
    
    getPersona(personaId, type) {
        if (type === 'user') {
            return this.userPersonas.find(p => p.id === personaId);
        } else {
            return this.aiPersonas.find(p => p.id === personaId);
        }
    }
    
    renderPersonaLists() {
        this.renderUserPersonas();
        this.renderAIPersonas();
    }
    
    renderUserPersonas() {
        const container = document.getElementById('user-personas-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.userPersonas.forEach(persona => {
            const element = this.createPersonaElement(persona);
            container.appendChild(element);
        });
    }
    
    renderAIPersonas() {
        const container = document.getElementById('ai-personas-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.aiPersonas.forEach(persona => {
            const element = this.createPersonaElement(persona);
            container.appendChild(element);
        });
    }
    
    createPersonaElement(persona) {
        const element = document.createElement('div');
        element.className = `persona-item ${persona.type === 'user' ? 'user-persona' : 'ai-persona'}`;
        if (persona.id === window.app.selectedUserPersona?.id || persona.id === window.app.selectedAIPersona?.id) {
            element.classList.add('active');
        }
        
        element.dataset.personaId = persona.id;
        element.dataset.personaType = persona.type;
        
        let details = [];
        if (persona.age) details.push(`${persona.age} years`);
        if (persona.gender) details.push(persona.gender);
        
        element.innerHTML = `
            <div class="persona-name">${persona.name}</div>
            <div class="persona-details">${details.join(' • ')}</div>
        `;
        
        element.addEventListener('click', () => {
            if (persona.type === 'user') {
                window.app.selectUserPersona(persona.id);
            } else {
                window.app.selectAIPersona(persona.id);
            }
        });
        
        return element;
    }
                  }
