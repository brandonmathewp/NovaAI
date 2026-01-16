class ModelManager {
    constructor() {
        this.models = [];
        this.imageModels = [];
        this.textModels = [];
        this.pricingInfo = {};
        
        this.init();
    }
    
    async init() {
        // Load cached models
        this.loadCachedModels();
        
        // Fetch models if authenticated
        if (window.auth && window.auth.isAuthenticated()) {
            await this.loadModels();
        }
    }
    
    loadCachedModels() {
        try {
            const cached = localStorage.getItem('cached_models');
            const cachedImage = localStorage.getItem('cached_image_models');
            const cachedText = localStorage.getItem('cached_text_models');
            
            if (cached) this.models = JSON.parse(cached);
            if (cachedImage) this.imageModels = JSON.parse(cachedImage);
            if (cachedText) this.textModels = JSON.parse(cachedText);
        } catch (error) {
            console.error('Error loading cached models:', error);
        }
    }
    
    async loadModels() {
        if (!window.auth.isAuthenticated()) {
            return;
        }
        
        try {
            // Load text models
            await this.loadTextModels();
            
            // Load image models
            await this.loadImageModels();
            
            // Update model select dropdown
            this.updateModelSelect();
            
            // Update image model select
            this.updateImageModelSelect();
            
        } catch (error) {
            console.error('Error loading models:', error);
            window.app.showToast('Failed to load models', 'error');
        }
    }
    
    async loadTextModels() {
        try {
            const response = await fetch('https://gen.pollinations.ai/v1/models', {
                headers: window.auth.getHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            this.models = data.data || [];
            
            // Also fetch detailed text models
            const detailedResponse = await fetch('https://gen.pollinations.ai/text/models', {
                headers: window.auth.getHeaders()
            });
            
            if (detailedResponse.ok) {
                const detailedData = await detailedResponse.json();
                this.textModels = detailedData || [];
            }
            
            // Cache the models
            localStorage.setItem('cached_models', JSON.stringify(this.models));
            localStorage.setItem('cached_text_models', JSON.stringify(this.textModels));
            
            // Render models in modal
            this.renderTextModels();
            
        } catch (error) {
            console.error('Error loading text models:', error);
            throw error;
        }
    }
    
    async loadImageModels() {
        try {
            const response = await fetch('https://gen.pollinations.ai/image/models', {
                headers: window.auth.getHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            this.imageModels = await response.json();
            
            // Cache the models
            localStorage.setItem('cached_image_models', JSON.stringify(this.imageModels));
            
            // Render models in modal
            this.renderImageModels();
            
        } catch (error) {
            console.error('Error loading image models:', error);
            throw error;
        }
    }
    
    updateModelSelect() {
        const select = document.getElementById('model-select');
        if (!select) return;
        
        select.innerHTML = '';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a model...';
        select.appendChild(defaultOption);
        
        // Add available text models
        this.textModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = `${model.name} ${model.pricing ? `(${model.pricing.input || 0} pollen)` : ''}`;
            select.appendChild(option);
        });
        
        // Add generic models from /v1/models
        this.models.forEach(model => {
            if (!this.textModels.some(m => m.name === model.id)) {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.id;
                select.appendChild(option);
            }
        });
        
        // Set default model
        if (window.chat && window.chat.currentModel) {
            select.value = window.chat.currentModel;
        } else {
            select.value = 'openai';
        }
    }
    
    updateImageModelSelect() {
        const select = document.getElementById('image-model');
        if (!select) return;
        
        select.innerHTML = '';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select an image model...';
        select.appendChild(defaultOption);
        
        // Add available image models
        this.imageModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = `${model.name} ${model.pricing ? `(${model.pricing.input || 0} pollen)` : ''}`;
            select.appendChild(option);
        });
        
        // Set default model
        select.value = 'flux';
    }
    
    renderTextModels() {
        const container = document.getElementById('text-models-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (this.textModels.length === 0) {
            container.innerHTML = '<div class="empty-state">No text models available</div>';
            return;
        }
        
        this.textModels.forEach(model => {
            const element = this.createModelElement(model, 'text');
            container.appendChild(element);
        });
    }
    
    renderImageModels() {
        const container = document.getElementById('image-models-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (this.imageModels.length === 0) {
            container.innerHTML = '<div class="empty-state">No image models available</div>';
            return;
        }
        
        this.imageModels.forEach(model => {
            const element = this.createModelElement(model, 'image');
            container.appendChild(element);
        });
    }
    
    renderPricingInfo() {
        const container = document.getElementById('pricing-info');
        if (!container) return;
        
        container.innerHTML = `
            <div class="pricing-card">
                <h4>Pollen Pricing</h4>
                <p>All models consume Pollen from your balance. Different models have different pricing:</p>
                
                <div class="pricing-examples">
                    <h5>Text Models (per 1K tokens):</h5>
                    <ul>
                        <li>openai: ~1 pollen</li>
                        <li>gemini: ~1 pollen</li>
                        <li>claude: ~2 pollen</li>
                    </ul>
                    
                    <h5>Image Models (per image):</h5>
                    <ul>
                        <li>flux: 1 pollen</li>
                        <li>turbo: 0.5 pollen</li>
                        <li>gptimage: 2 pollen</li>
                        <li>veo (video): 10 pollen</li>
                    </ul>
                </div>
                
                <div class="pricing-note">
                    <p><strong>Note:</strong> Actual costs may vary. Check the models list for exact pricing.</p>
                    <p>1 Pollen ≈ $0.01 USD</p>
                </div>
            </div>
        `;
    }
    
    createModelElement(model, type) {
        const element = document.createElement('div');
        element.className = 'model-item';
        
        // Get pricing info
        let pricingText = 'Pricing not available';
        if (model.pricing) {
            if (typeof model.pricing === 'object') {
                pricingText = Object.entries(model.pricing)
                    .filter(([key, value]) => key !== 'currency')
                    .map(([key, value]) => `${key}: ${value} pollen`)
                    .join(', ');
            } else {
                pricingText = `${model.pricing} pollen`;
            }
        }
        
        // Get capabilities
        const capabilities = [];
        if (model.input_modalities) capabilities.push(...model.input_modalities);
        if (model.output_modalities) capabilities.push(...model.output_modalities);
        if (model.tools) capabilities.push('tools');
        if (model.reasoning) capabilities.push('reasoning');
        
        element.innerHTML = `
            <div class="model-header">
                <div class="model-name">
                    <i class="fas ${type === 'text' ? 'fa-comment' : 'fa-image'}"></i>
                    ${model.name}
                </div>
                <div class="model-price">${pricingText}</div>
            </div>
            <div class="model-details">
                ${model.description || 'No description available'}
            </div>
            ${capabilities.length > 0 ? `
                <div class="model-capabilities">
                    ${capabilities.map(cap => `<span class="capability-tag">${cap}</span>`).join('')}
                </div>
            ` : ''}
            <div class="model-actions">
                <button class="btn btn-small" onclick="window.models.selectModel('${model.name}', '${type}')">
                    <i class="fas fa-check"></i> Select
                </button>
            </div>
        `;
        
        return element;
    }
    
    selectModel(modelName, type) {
        if (type === 'text') {
            // Update chat model
            if (window.chat) {
                window.chat.currentModel = modelName;
                document.getElementById('model-select').value = modelName;
            }
            window.app.showToast(`Selected text model: ${modelName}`, 'success');
        } else {
            // Update image model
            document.getElementById('image-model').value = modelName;
            window.app.showToast(`Selected image model: ${modelName}`, 'success');
        }
        
        // Close modal
        window.app.hideAllModals();
    }
    
    getModelInfo(modelName) {
        // Try text models first
        let model = this.textModels.find(m => m.name === modelName);
        if (model) return model;
        
        // Try image models
        model = this.imageModels.find(m => m.name === modelName);
        if (model) return model;
        
        // Try generic models
        model = this.models.find(m => m.id === modelName);
        if (model) return model;
        
        return null;
    }
          }
