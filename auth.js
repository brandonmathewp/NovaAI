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
        if (this.apiKey) {
            this.checkAuthStatus();
        }
    }
    
    isAuthenticated() {
        return !!this.apiKey;
    }
    
    connectAccount() {
        // BYOP: Redirect to Pollinations.ai authorization page
        const currentUrl = encodeURIComponent(window.location.href);
        const authUrl = `https://enter.pollinations.ai/authorize?redirect_url=${currentUrl}&permissions=profile,balance,usage`;
        window.location.href = authUrl;
    }
    
    handleBYOPRedirect(apiKey) {
        // Save the API key
        this.apiKey = apiKey;
        localStorage.setItem('pollinations_api_key', apiKey);
        
        // Update auth status
        this.checkAuthStatus();
        
        // Call auth change callback
        if (this.onAuthChange) {
            this.onAuthChange(true, apiKey, this.balance);
        }
    }
    
    async checkAuthStatus() {
        if (!this.apiKey) {
            if (this.onAuthChange) {
                this.onAuthChange(false, null, null);
            }
            return false;
        }
        
        try {
            // Try to get balance as a test
            await this.getBalance();
            
            // Get user profile
            await this.getProfile();
            
            return true;
        } catch (error) {
            console.error('Auth check failed:', error);
            this.logout();
            return false;
        }
    }
    
    async getBalance() {
        try {
            const response = await fetch('https://enter.pollinations.ai/api/account/balance', {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            this.balance = data.balance;
            
            if (this.onAuthChange) {
                this.onAuthChange(true, this.apiKey, this.balance);
            }
            
            return this.balance;
        } catch (error) {
            console.error('Failed to get balance:', error);
            throw error;
        }
    }
    
    async getProfile() {
        try {
            const response = await fetch('https://enter.pollinations.ai/api/account/profile', {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            this.userProfile = await response.json();
            return this.userProfile;
        } catch (error) {
            console.error('Failed to get profile:', error);
            throw error;
        }
    }
    
    async getUsage(limit = 100, format = 'json') {
        try {
            const response = await fetch(`https://enter.pollinations.ai/api/account/usage?format=${format}&limit=${limit}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
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
        this.apiKey = null;
        this.balance = null;
        this.userProfile = null;
        localStorage.removeItem('pollinations_api_key');
        
        if (this.onAuthChange) {
            this.onAuthChange(false, null, null);
        }
    }
    
    getApiKey() {
        return this.apiKey;
    }
    
    getHeaders() {
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
        };
    }
}
