class ImageGenerator {
    constructor() {
        this.currentModel = 'flux';
        this.enhanceSystemPrompt = `You are an expert Image Prompt Engineer specializing in Human Portraits and Character Design. Your task is to convert user requests into highly optimized, comma-separated keyword lists for AI image generation.

## OBJECTIVE
Expand the user's character concept into a dense prompt that guarantees high-fidelity human features. Always prioritize facial structure, skin texture, and lighting.

## STRUCTURAL FORMULA
[Subject/Action] + [Physical Appearance/Clothing] + [Shot Type/Camera Angle] + [Art Style] + [Lighting] + [Anatomy & Skin Tags] + [Technical Quality]

## RULES
1. **Format:** Output ONLY a comma-separated list. No full sentences.
2. **Anatomy Mandate:** You MUST include these keywords in every prompt unless the subject is non-human: "anatomically correct, defined face, perfect eyes, five fingers, perfect hands, detailed skin texture, subsurface scattering."
3. **Portrait Lighting:** If no lighting is specified, use flattering portrait lighting tags: "cinematic lighting, rim lighting, volumetric fog, studio lighting, soft shadows."
4. **Shot Logic:** If the user implies a close-up, add "macro photography, sharp focus on eyes, visible pores." If a full body, add "full body shot, dynamic pose."
5. **Style:** Default to "cinematic, realistic painting, concept art" unless a specific style (e.g., anime, oil painting) is requested.

## EXAMPLE INPUT vs. OUTPUT

Input: "A sad warrior sitting in the rain"
Output: Sad warrior sitting in the rain, intricate armor, wet hair, weathered face, sorrowful expression, medium shot, cinematic, realistic painting, concept art, moody lighting, rain streaks, cold color palette, high definition, path tracing, anatomically correct, defined face, perfect eyes, five fingers, detailed skin texture, hyperrealistic, 8K, masterpiece

Input: "Cyberpunk girl, close up"
Output: Cyberpunk girl, close up portrait, neon glowing implants, futuristic visor, pink and blue hair, reflective jacket, intense gaze, cinematic, photorealistic, octane render, ray tracing, neon lighting, bokeh background, sharp focus on eyes, visible pores, detailed iris, anatomically correct, perfect face, five fingers, high quality, 8K, highly detailed

## YOUR INSTRUCTIONS
Receive the user's character concept and output the optimized keyword list.`;
    }
    
    async generateImage() {
        const promptInput = document.getElementById('image-prompt');
        const prompt = promptInput.value.trim();
        const modelSelect = document.getElementById('image-model');
        const model = modelSelect.value || this.currentModel;
        
        if (!prompt) {
            window.app.showToast('Please enter an image prompt', 'warning');
            return;
        }
        
        if (!window.auth.isAuthenticated()) {
            window.app.showToast('Please connect your account first', 'error');
            return;
        }
        
        try {
            // Show loading state
            const generateBtn = document.getElementById('generate-image-btn');
            const originalText = generateBtn.innerHTML;
            generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
            generateBtn.disabled = true;
            
            // Build URL with parameters
            const encodedPrompt = encodeURIComponent(prompt);
            const url = `https://gen.pollinations.ai/image/${encodedPrompt}?model=${model}&width=1024&height=1024`;
            
            // Make request
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${window.auth.getApiKey()}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            // Get image blob
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            
            // Add image to chat
            await this.addImageToChat(prompt, imageUrl, model);
            
            // Clear prompt
            promptInput.value = '';
            
            // Update balance
            await window.billing.updateBalance();
            
        } catch (error) {
            console.error('Error generating image:', error);
            window.app.showToast('Failed to generate image', 'error');
        } finally {
            // Reset button
            const generateBtn = document.getElementById('generate-image-btn');
            generateBtn.innerHTML = '<i class="fas fa-bolt"></i> Generate';
            generateBtn.disabled = false;
        }
    }
    
    async addImageToChat(prompt, imageUrl, model) {
        // Create message for the image
        const message = {
            id: Date.now().toString(),
            role: 'user',
            content: `[Image: ${prompt}]`,
            imageUrl: imageUrl,
            imageModel: model,
            timestamp: new Date().toISOString(),
            isImage: true
        };
        
        // Add to chat
        window.chat.addMessage(message);
        
        // Create AI response
        setTimeout(() => {
            const aiMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `I've generated an image based on your prompt: "${prompt}" using ${model}.`,
                timestamp: new Date().toISOString(),
                personaId: window.chat.currentAIPersona?.id
            };
            
            window.chat.addMessage(aiMessage);
        }, 500);
    }
    
    async enhancePrompt(prompt) {
        if (!prompt.trim()) {
            return prompt;
        }
        
        if (!window.auth.isAuthenticated()) {
            window.app.showToast('Please connect your account to enhance prompts', 'error');
            return prompt;
        }
        
        try {
            // Show loading
            const enhanceBtn = document.getElementById('enhance-prompt-btn');
            const originalHTML = enhanceBtn.innerHTML;
            enhanceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            enhanceBtn.disabled = true;
            
            // Prepare enhancement request
            const messages = [
                {
                    role: 'system',
                    content: this.enhanceSystemPrompt
                },
                {
                    role: 'user',
                    content: prompt
                }
            ];
            
            const requestBody = {
                model: 'openai',
                messages: messages,
                temperature: 0.7,
                max_tokens: 200
            };
            
            // Send request
            const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
                method: 'POST',
                headers: window.auth.getHeaders(),
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            const enhancedPrompt = data.choices[0]?.message?.content || prompt;
            
            return enhancedPrompt;
            
        } catch (error) {
            console.error('Error enhancing prompt:', error);
            window.app.showToast('Failed to enhance prompt', 'error');
            return prompt;
        } finally {
            // Reset button
            const enhanceBtn = document.getElementById('enhance-prompt-btn');
            enhanceBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>';
            enhanceBtn.disabled = false;
        }
    }
    }
