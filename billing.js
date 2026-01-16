class BillingManager {
    constructor() {
        this.balance = null;
        this.usageHistory = [];
        this.dailyCost = 0;
        this.monthlyCost = 0;
        
        this.init();
    }
    
    async init() {
        if (window.auth && window.auth.isAuthenticated()) {
            await this.updateBalance();
            await this.loadUsageHistory();
        }
    }
    
    async updateBalance() {
        try {
            this.balance = await window.auth.getBalance();
            this.updateBalanceDisplay();
        } catch (error) {
            console.error('Failed to update balance:', error);
        }
    }
    
    async loadUsageHistory(limit = 50) {
        try {
            const usage = await window.auth.getUsage(limit);
            if (usage && usage.usage) {
                this.usageHistory = usage.usage;
                this.calculateCosts();
                this.renderUsageTable();
            }
        } catch (error) {
            console.error('Failed to load usage history:', error);
        }
    }
    
    calculateCosts() {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const thisMonth = now.toISOString().substring(0, 7); // YYYY-MM
        
        this.dailyCost = 0;
        this.monthlyCost = 0;
        
        this.usageHistory.forEach(record => {
            const recordDate = record.timestamp.split(' ')[0]; // YYYY-MM-DD
            const recordMonth = recordDate.substring(0, 7);
            
            if (record.cost_usd) {
                if (recordDate === today) {
                    this.dailyCost += record.cost_usd;
                }
                if (recordMonth === thisMonth) {
                    this.monthlyCost += record.cost_usd;
                }
            }
        });
        
        this.updateCostDisplay();
    }
    
    updateBalanceDisplay() {
        const balanceElement = document.getElementById('current-balance');
        if (balanceElement && this.balance !== null) {
            balanceElement.textContent = this.balance.toFixed(2);
        }
        
        // Also update main balance display
        const mainBalance = document.getElementById('balance');
        if (mainBalance && this.balance !== null) {
            mainBalance.textContent = `Balance: ${this.balance.toFixed(2)} Pollen`;
        }
    }
    
    updateCostDisplay() {
        const todayCost = document.getElementById('today-cost');
        const monthlyCost = document.getElementById('monthly-cost');
        
        if (todayCost) {
            todayCost.textContent = `$${this.dailyCost.toFixed(4)}`;
        }
        
        if (monthlyCost) {
            monthlyCost.textContent = `$${this.monthlyCost.toFixed(2)}`;
        }
    }
    
    renderUsageTable() {
        const container = document.getElementById('usage-table-body');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (this.usageHistory.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">No usage data available</td>
                </tr>
            `;
            return;
        }
        
        this.usageHistory.forEach(record => {
            const row = this.createUsageRow(record);
            container.appendChild(row);
        });
    }
    
    createUsageRow(record) {
        const row = document.createElement('tr');
        
        // Format timestamp
        const timestamp = record.timestamp;
        const time = timestamp.split(' ')[1]?.substring(0, 5) || '';
        
        // Get token counts
        const inputTokens = (record.input_text_tokens || 0) + 
                          (record.input_audio_tokens || 0) + 
                          (record.input_image_tokens || 0);
        const outputTokens = (record.output_text_tokens || 0) + 
                           (record.output_audio_tokens || 0) + 
                           (record.output_image_tokens || 0);
        const totalTokens = inputTokens + outputTokens;
        
        // Format cost
        const cost = record.cost_usd ? `$${record.cost_usd.toFixed(6)}` : '-';
        
        row.innerHTML = `
            <td>${time}</td>
            <td>${record.model || '-'}</td>
            <td>${record.type || '-'}</td>
            <td>${totalTokens.toLocaleString()}</td>
            <td>${cost}</td>
        `;
        
        return row;
    }
    
    async updateBillingInfo() {
        await this.updateBalance();
        await this.loadUsageHistory();
    }
                                  }
