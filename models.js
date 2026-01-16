class ModelManager {
    constructor() {
        this.models = [];
        this.imageModels = [];
        this.textModels = [];
        this.pricingInfo = {};
        this.isLoading = false;
        
        this.init();
    }
    
    async init() {
        // Load cached models if available
        this.loadCachedModels();
        
        // Update dropdowns with cached data
        this.updateModelSelect();
        this.updateImageModelSelect();
        
        // We'll load fresh models when auth is confirmed
        console.log('ModelManager initialized (models will load when authenticated)');
    }
    
    loadCachedModels() {
        try {
            const cached = localStorage.getItem('cached_models');
            const cachedImage = localStorage.getItem('cached_image_models');
            const cachedText = localStorage.getItem('cached_text_models');
            
            if (cached) {
                this.models = JSON.parse(cached);
                console.log('Loaded cached models:', this.models.length);
            }
            if (cachedImage) {
                this.imageModels = JSON.parse(cachedImage);
                console.log('Loaded cached image models:', this.imageModels.length);
            }
            if (cachedText) {
                this.textModels = JSON.parse(cachedText);
                console.log('Loaded cached text models:', this.textModels.length);
            }
        } catch (error) {
            console.error('Error loading cached models:', error);
        }
    }
    
    saveCachedModels() {
        try {
            localStorage.setItem('cached_models', JSON.stringify(this.models));
            localStorage.setItem('cached_image_models', JSON.stringify(this.imageModels));
            localStorage.setItem('cached_text_models', JSON.stringify(this.textModels));
            console.log('Models cached to localStorage');
        } catch (error) {
            console.error('Error caching models:', error);
        }
    }
    
    async loadModels() {
        if (this.isLoading) {
            console.log('Models are already loading');
            return;
        }
        
        if (!window.auth || !window.auth.isAuthenticated()) {
            console.log('Cannot load models: User not authenticated');
            window.app?.showToast('Please connect your account to load models', 'warning');
            return;
        }
        
        this.isLoading = true;
        
        try {
            console.log('Loading models from API...');
            
            // Load text models
            await this.loadTextModels();
            
            // Load image models
            await this.loadImageModels();
            
            // Cache the models
            this.saveCachedModels();
            
            // Update dropdowns
            this.updateModelSelect();
            this.updateImageModelSelect();
            
            // Render in modal if open
            this.renderTextModels();
            this.renderImageModels();
            
            console.log('Models loaded successfully');
            window.app?.showToast('Models loaded successfully', 'success');
            
        } catch (error) {
            console.error('Error loading models:', error);
            
            let errorMsg = 'Failed to load models. ';
            if (error.message && error.message.includes('401') || error.message.includes('403')) {
                errorMsg += 'Authentication error. Please reconnect your account.';
            } else if (error.message && error.message.includes('Failed to fetch')) {
                errorMsg += 'Network error. Please check your connection.';
            } else {
                errorMsg += 'Please try again.';
            }
            
            window.app?.showToast(errorMsg, 'error');
            
            // Use cached models as fallback
            if (this.models.length === 0 && this.textModels.length === 0 && this.imageModels.length === 0) {
                console.log('No cached models available. Please authenticate to load models.');
            }
            
        } finally {
            this.isLoading = false;
        }
    }
    
    async loadTextModels() {
        if (!window.auth || !window.auth.isAuthenticated()) {
            throw new Error('Not authenticated');
        }
        
        console.log('Loading text models...');
        
        try {
            // First try to get detailed text models from /text/models
            const detailedResponse = await fetch('https://gen.pollinations.ai/text/models', {
                headers: window.auth.getHeaders()
            });
            
            if (detailedResponse.ok) {
                const detailedData = await detailedResponse.json();
                this.textModels = detailedData || [];
                console.log('Loaded detailed text models:', this.textModels.length);
                
                // Also get OpenAI-compatible model list from /v1/models
                const response = await fetch('https://gen.pollinations.ai/v1/models', {
                    headers: window.auth.getHeaders()
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.models = data.data || [];
                    console.log('Loaded OpenAI-compatible models:', this.models.length);
                }
                
                return;
            }
            
            // Fallback: Try /v1/models only
            const response = await fetch('https://gen.pollinations.ai/v1/models', {
                headers: window.auth.getHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.models = data.data || [];
            
            // Convert to textModels format
            this.textModels = this.models.map(model => ({
                name: model.id,
                aliases: [model.id],
                pricing: {
                    input: 1, // Default pricing
                    output: 1,
                    currency: 'pollen'
                },
                description: `Model ID: ${model.id}`,
                input_modalities: ['text'],
                output_modalities: ['text'],
                tools: false,
                reasoning: false,
                context_window: 4096,
                voices: [],
                is_specialized: false
            }));
            
            console.log('Loaded fallback text models:', this.textModels.length);
            
        } catch (error) {
            console.error('Error loading text models:', error);
            
            // If we have cached data, use it
            if (this.textModels.length > 0) {
                console.log('Using cached text models due to error');
            } else {
                throw error;
            }
        }
    }
    
    async loadImageModels() {
        if (!window.auth || !window.auth.isAuthenticated()) {
            throw new Error('Not authenticated');
        }
        
        console.log('Loading image models...');
        
        try {
            const response = await fetch('https://gen.pollinations.ai/image/models', {
                headers: window.auth.getHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            this.imageModels = await response.json();
            console.log('Loaded image models:', this.imageModels.length);
            
        } catch (error) {
            console.error('Error loading image models:', error);
            
            // If we have cached data, use it
            if (this.imageModels.length > 0) {
                console.log('Using cached image models due to error');
            } else {
                // Create a basic fallback list
                this.imageModels = [
                    {
                        name: 'flux',
                        aliases: ['flux'],
                        pricing: { input: 1, currency: 'pollen' },
                        description: 'High-quality image generation model'
                    },
                    {
                        name: 'turbo',
                        aliases: ['turbo'],
                        pricing: { input: 0.5, currency: 'pollen' },
                        description: 'Fast image generation model'
                    },
                    {
                        name: 'gptimage',
                        aliases: ['gptimage'],
                        pricing: { input: 2, currency: 'pollen' },
                        description: 'GPT-powered image generation'
                    },
                    {
                        name: 'veo',
                        aliases: ['veo'],
                        pricing: { input: 10, currency: 'pollen' },
                        description: 'Video generation model'
                    }
                ];
                console.log('Using fallback image models');
            }
        }
    }
    
    updateModelSelect() {
        const select = document.getElementById('model-select');
        if (!select) return;
        
        // Clear current options
        select.innerHTML = '';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a model...';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        select.appendChild(defaultOption);
        
        // Check if we have any models
        if (this.textModels.length === 0 && this.models.length === 0) {
            const noModelsOption = document.createElement('option');
            noModelsOption.value = '';
            noModelsOption.textContent = 'No models available - Connect account';
            noModelsOption.disabled = true;
            select.appendChild(noModelsOption);
            return;
        }
        
        // Add text models first
        this.textModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            
            // Show pricing if available
            let priceText = '';
            if (model.pricing) {
                if (typeof model.pricing === 'object') {
                    const inputPrice = model.pricing.input || model.pricing.prompt || 0;
                    priceText = ` (${inputPrice} pollen)`;
                } else {
                    priceText = ` (${model.pricing} pollen)`;
                }
            }
            
            option.textContent = `${model.name}${priceText}`;
            select.appendChild(option);
        });
        
        // Add generic models from /v1/models that aren't already in textModels
        this.models.forEach(model => {
            if (!this.textModels.some(m => m.name === model.id)) {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.id;
                select.appendChild(option);
            }
        });
        
        // Set default model if none selected
        if (window.chat && window.chat.currentModel && select.value !== window.chat.currentModel) {
            select.value = window.chat.currentModel;
        } else if (select.value === '') {
            // Set to openai if available
            const openaiOption = Array.from(select.options).find(opt => 
                opt.value.includes('openai') || opt.value === 'openai'
            );
            if (openaiOption) {
                select.value = openaiOption.value;
                if (window.chat) {
                    window.chat.currentModel = openaiOption.value;
                }
            } else if (select.options.length > 1) {
                // Select first available model
                select.selectedIndex = 1;
                if (window.chat) {
                    window.chat.currentModel = select.options[1].value;
                }
            }
        }
        
        // Add change event listener if not already present
        if (!select.hasListener) {
            select.addEventListener('change', (e) => {
                if (window.chat) {
                    window.chat.currentModel = e.target.value;
                    window.app?.showToast(`Model set to: ${e.target.value}`, 'info');
                }
            });
            select.hasListener = true;
        }
    }
    
    updateImageModelSelect() {
        const select = document.getElementById('image-model');
        if (!select) return;
        
        // Clear current options
        select.innerHTML = '';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select an image model...';
        defaultOption.disabled = true;
        select.appendChild(defaultOption);
        
        // Check if we have any models
        if (this.imageModels.length === 0) {
            const noModelsOption = document.createElement('option');
            noModelsOption.value = '';
            noModelsOption.textContent = 'No image models available';
            noModelsOption.disabled = true;
            select.appendChild(noModelsOption);
            return;
        }
        
        // Add available image models
        this.imageModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            
            // Show pricing if available
            let priceText = '';
            if (model.pricing) {
                if (typeof model.pricing === 'object') {
                    const inputPrice = model.pricing.input || model.pricing.prompt || 0;
                    priceText = ` (${inputPrice} pollen)`;
                } else {
                    priceText = ` (${model.pricing} pollen)`;
                }
            }
            
            option.textContent = `${model.name}${priceText}`;
            select.appendChild(option);
        });
        
        // Set default to flux if available
        const fluxOption = Array.from(select.options).find(opt => opt.value === 'flux');
        if (fluxOption) {
            select.value = 'flux';
        } else if (select.options.length > 1) {
            select.selectedIndex = 1;
        }
        
        // Add change event listener if not already present
        if (!select.hasListener) {
            select.addEventListener('change', (e) => {
                if (window.imageGen) {
                    window.imageGen.currentModel = e.target.value;
                }
            });
            select.hasListener = true;
        }
    }
    
    renderTextModels() {
        const container = document.getElementById('text-models-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (this.textModels.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>No text models available</p>
                    <p class="small">Connect your account to load models</p>
                </div>
            `;
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
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>No image models available</p>
                    <p class="small">Connect your account to load models</p>
                </div>
            `;
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
        
        // Collect pricing information from all models
        const pricingExamples = {
            text: {},
            image: {}
        };
        
        // Get text model pricing examples
        this.textModels.slice(0, 5).forEach(model => {
            if (model.pricing) {
                let price = 0;
                if (typeof model.pricing === 'object') {
                    price = model.pricing.input || model.pricing.prompt || 0;
                } else {
                    price = model.pricing;
                }
                pricingExamples.text[model.name] = price;
            }
        });
        
        // Get image model pricing examples
        this.imageModels.slice(0, 5).forEach(model => {
            if (model.pricing) {
                let price = 0;
                if (typeof model.pricing === 'object') {
                    price = model.pricing.input || model.pricing.prompt || 0;
                } else {
                    price = model.pricing;
                }
                pricingExamples.image[model.name] = price;
            }
        });
        
        container.innerHTML = `
            <div class="pricing-card">
                <h4><i class="fas fa-money-bill-wave"></i> Pollen Pricing</h4>
                <p>All models consume Pollen from your balance. Pricing varies by model:</p>
                
                <div class="pricing-examples">
                    <h5><i class="fas fa-comment"></i> Text Models (per 1K tokens):</h5>
                    ${Object.keys(pricingExamples.text).length > 0 ? `
                        <ul>
                            ${Object.entries(pricingExamples.text).map(([name, price]) => `
                                <li><strong>${name}:</strong> ${price} pollen per 1K tokens</li>
                            `).join('')}
                        </ul>
                    ` : '<p>Connect account to see pricing</p>'}
                    
                    <h5><i class="fas fa-image"></i> Image Models (per image):</h5>
                    ${Object.keys(pricingExamples.image).length > 0 ? `
                        <ul>
                            ${Object.entries(pricingExamples.image).map(([name, price]) => `
                                <li><strong>${name}:</strong> ${price} pollen per image</li>
                            `).join('')}
                        </ul>
                    ` : '<p>Connect account to see pricing</p>'}
                </div>
                
                <div class="pricing-note">
                    <p><strong>Note:</strong> Actual costs may vary based on usage and model parameters.</p>
                    <p><i class="fas fa-info-circle"></i> 1 Pollen ≈ $0.01 USD</p>
                    <p><i class="fas fa-sync"></i> Check the models tab for real-time pricing</p>
                </div>
            </div>
        `;
    }
    
    createModelElement(model, type) {
        const element = document.createElement('div');
        element.className = 'model-item';
        
        // Get pricing info
        let pricingText = 'Pricing not available';
        let pricingDetails = '';
        
        if (model.pricing) {
            if (typeof model.pricing === 'object') {
                pricingText = Object.entries(model.pricing)
                    .filter(([key, value]) => key !== 'currency')
                    .map(([key, value]) => `${key}: ${value} pollen`)
                    .join(', ');
                    
                pricingDetails = `
                    <div class="model-pricing-details">
                        ${Object.entries(model.pricing)
                            .filter(([key, value]) => key !== 'currency')
                            .map(([key, value]) => `<span class="price-tag">${key}: ${value}p</span>`)
                            .join('')}
                    </div>
                `;
            } else {
                pricingText = `${model.pricing} pollen`;
                pricingDetails = `<div class="model-pricing-details"><span class="price-tag">${model.pricing} pollen</span></div>`;
            }
        }
        
        // Get capabilities
        const capabilities = [];
        if (model.input_modalities) capabilities.push(...model.input_modalities);
        if (model.output_modalities) capabilities.push(...model.output_modalities);
        if (model.tools) capabilities.push('tools');
        if (model.reasoning) capabilities.push('reasoning');
        if (model.context_window) capabilities.push(`${model.context_window} context`);
        
        // Get description or create a default one
        let description = model.description || 'No description available';
        if (description.length > 150) {
            description = description.substring(0, 150) + '...';
        }
        
        element.innerHTML = `
            <div class="model-header">
                <div class="model-name">
                    <i class="fas ${type === 'text' ? 'fa-comment' : 'fa-image'}"></i>
                    ${model.name}
                </div>
                <div class="model-price">${pricingText}</div>
            </div>
            <div class="model-details">
                ${description}
            </div>
            ${pricingDetails}
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
                
                // Update the select dropdown
                const modelSelect = document.getElementById('model-select');
                if (modelSelect) {
                    modelSelect.value = modelName;
                }
                
                window.app?.showToast(`Text model set to: ${modelName}`, 'success');
            }
        } else {
            // Update image model
            if (window.imageGen) {
                window.imageGen.currentModel = modelName;
                
                // Update the select dropdown
                const imageModelSelect = document.getElementById('image-model');
                if (imageModelSelect) {
                    imageModelSelect.value = modelName;
                }
                
                window.app?.showToast(`Image model set to: ${modelName}`, 'success');
            }
        }
        
        // Close modal
        window.app?.hideAllModals();
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
    
    getModelPricing(modelName) {
        const model = this.getModelInfo(modelName);
        if (!model) return null;
        
        return model.pricing;
    }
    
    async refreshModels() {
        if (!window.auth || !window.auth.isAuthenticated()) {
            window.app?.showToast('Please connect your account to refresh models', 'warning');
            return;
        }
        
        window.app?.showToast('Refreshing models...', 'info');
        await this.loadModels();
    }
    
    // Method to check if a model is available
    isModelAvailable(modelName, type = 'text') {
        if (type === 'text') {
            return this.textModels.some(m => m.name === modelName) || 
                   this.models.some(m => m.id === modelName);
        } else if (type === 'image') {
            return this.imageModels.some(m => m.name === modelName);
        }
        return false;
    }
    
    // Method to get all available model names
    getAvailableModels(type = 'text') {
        if (type === 'text') {
            const textModelNames = this.textModels.map(m => m.name);
            const openAIModelNames = this.models.map(m => m.id);
            return [...new Set([...textModelNames, ...openAIModelNames])];
        } else if (type === 'image') {
            return this.imageModels.map(m => m.name);
        }
        return [];
    }
}
