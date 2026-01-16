class AuthManager {
    constructor() {
        this.apiKey = null;
        this.balance = null;
        this.userProfile = null;
        this.onAuthChange = null;
        
        this.init();
    }
    
    init() {
        // Try to load API key from localStorage
        this.apiKey = localStorage.getItem('pollinations_api_key');
        
        // Also check URL fragment for BYOP redirect
        this.checkUrlForApiKey();
        
        if (this.apiKey) {
            // Schedule auth check after a brief delay to ensure app is initialized
            setTimeout(() => this.checkAuthStatus(), 100);
        }
    }
    
    checkUrlForApiKey() {
        // Check URL fragment for BYOP redirect
        const hash = window.location.hash.substring(1); // Remove the #
        if (!hash) return;
        
        const params = new URLSearchParams(hash);
        const apiKey = params.get('api_key');
        
        if (apiKey) {
            console.log('Found API key in URL fragment (BYOP redirect)');
            this.handleBYOPRedirect(apiKey);
            
            // Clean up the URL - remove the fragment
            window.history.replaceState(null, '', 
                window.location.pathname + window.location.search);
        }
    }
    
    isAuthenticated() {
        return !!this.apiKey;
    }
    
    connectAccount() {
        // BYOP: Redirect to Pollinations.ai authorization page
        const currentUrl = encodeURIComponent(window.location.href.split('#')[0]); // Remove existing fragment
        const authUrl = `https://enter.pollinations.ai/authorize?redirect_url=${currentUrl}&permissions=profile,balance,usage&models=openai,flux&expiry=30`;
        
        console.log('Redirecting to BYOP auth:', authUrl);
        window.location.href = authUrl;
    }
    
    handleBYOPRedirect(apiKey) {
        console.log('Processing BYOP redirect with API key:', apiKey.substring(0, 10) + '...');
        
        // Validate API key format
        if (!apiKey || (!apiKey.startsWith('sk_') && !apiKey.startsWith('pk_'))) {
            console.error('Invalid API key format:', apiKey);
            this.showError('Invalid API key format. API keys should start with "sk_" or "pk_"');
            return;
        }
        
        // Save the API key
        this.apiKey = apiKey;
        localStorage.setItem('pollinations_api_key', apiKey);
        
        // Store the key type for reference
        const keyType = apiKey.startsWith('sk_') ? 'secret' : 'publishable';
        localStorage.setItem('api_key_type', keyType);
        localStorage.setItem('api_key_last_set', new Date().toISOString());
        
        console.log(`API key saved (type: ${keyType})`);
        
        // Update auth status
        this.checkAuthStatus();
        
        // Show success message
        this.showSuccess('Account connected successfully!');
    }
    
    async checkAuthStatus() {
        if (!this.apiKey) {
            console.log('No API key found, not authenticated');
            if (this.onAuthChange) {
                this.onAuthChange(false, null, null);
            }
            return false;
        }
        
        console.log('Checking authentication status...');
        
        try {
            // Test the API key by trying to get balance
            await this.getBalance();
            
            // Also get user profile
            await this.getProfile();
            
            console.log('Authentication successful');
            
            if (this.onAuthChange) {
                this.onAuthChange(true, this.apiKey, this.balance);
            }
            
            return true;
        } catch (error) {
            console.error('Auth check failed:', error);
            
            // Check if it's an authentication error
            if (error.message && error.message.includes('401') || error.message.includes('403')) {
                console.log('API key is invalid or expired');
                this.showError('Your API key is invalid or has expired. Please reconnect your account.');
                this.logout();
            }
            
            return false;
        }
    }
    
    async getBalance() {
        if (!this.apiKey) {
            throw new Error('No API key available');
        }
        
        try {
            console.log('Fetching balance...');
            const response = await fetch('https://enter.pollinations.ai/api/account/balance', {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Accept': 'application/json'
                }
            });
            
            console.log('Balance response status:', response.status);
            
            if (response.status === 401 || response.status === 403) {
                throw new Error(`Authentication failed: HTTP ${response.status}`);
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Balance data:', data);
            
            if (data && typeof data.balance === 'number') {
                this.balance = data.balance;
            } else {
                console.warn('Unexpected balance response format:', data);
                this.balance = 0;
            }
            
            return this.balance;
        } catch (error) {
            console.error('Failed to get balance:', error);
            
            // For debugging, show more details
            if (error.message.includes('Failed to fetch')) {
                console.error('Network error. Check CORS or internet connection.');
            }
            
            throw error;
        }
    }
    
    async getProfile() {
        if (!this.apiKey) {
            throw new Error('No API key available');
        }
        
        try {
            const response = await fetch('https://enter.pollinations.ai/api/account/profile', {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Accept': 'application/json'
                }
            });
            
            if (response.status === 401 || response.status === 403) {
                throw new Error(`Authentication failed: HTTP ${response.status}`);
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            this.userProfile = await response.json();
            console.log('User profile loaded:', this.userProfile);
            return this.userProfile;
        } catch (error) {
            console.error('Failed to get profile:', error);
            
            // If we can't get profile but can get balance, that's OK
            // Some API keys might not have profile permission
            if (error.message.includes('403')) {
                console.log('API key does not have profile permission');
                this.userProfile = { tier: 'unknown' };
                return this.userProfile;
            }
            
            throw error;
        }
    }
    
    async getUsage(limit = 100, format = 'json') {
        if (!this.apiKey) {
            throw new Error('No API key available');
        }
        
        try {
            const response = await fetch(`https://enter.pollinations.ai/api/account/usage?format=${format}&limit=${limit}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Accept': format === 'csv' ? 'text/csv' : 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            if (format === 'csv') {
                return await response.text();
            } else {
                return await response.json();
            }
        } catch (error) {
            console.error('Failed to get usage:', error);
            throw error;
        }
    }
    
    logout() {
        console.log('Logging out...');
        this.apiKey = null;
        this.balance = null;
        this.userProfile = null;
        
        localStorage.removeItem('pollinations_api_key');
        localStorage.removeItem('api_key_type');
        localStorage.removeItem('api_key_last_set');
        
        if (this.onAuthChange) {
            this.onAuthChange(false, null, null);
        }
        
        this.showInfo('Disconnected from Pollinations.ai');
    }
    
    getApiKey() {
        return this.apiKey;
    }
    
    getHeaders() {
        if (!this.apiKey) {
            throw new Error('No API key available');
        }
        
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }
    
    getKeyInfo() {
        if (!this.apiKey) return null;
        
        return {
            type: this.apiKey.startsWith('sk_') ? 'Secret Key' : 'Publishable Key',
            prefix: this.apiKey.substring(0, 10) + '...',
            lastSet: localStorage.getItem('api_key_last_set')
        };
    }
    
    // Helper methods for user feedback
    showError(message) {
        if (typeof Toastify !== 'undefined') {
            Toastify({
                text: message,
                duration: 5000,
                gravity: "top",
                position: "right",
                backgroundColor: "#ef4444",
                stopOnFocus: true
            }).showToast();
        } else {
            alert(message);
        }
    }
    
    showSuccess(message) {
        if (typeof Toastify !== 'undefined') {
            Toastify({
                text: message,
                duration: 3000,
                gravity: "top",
                position: "right",
                backgroundColor: "#10b981",
                stopOnFocus: true
            }).showToast();
        }
    }
    
    showInfo(message) {
        if (typeof Toastify !== 'undefined') {
            Toastify({
                text: message,
                duration: 3000,
                gravity: "top",
                position: "right",
                backgroundColor: "#3b82f6",
                stopOnFocus: true
            }).showToast();
        }
    }
}
