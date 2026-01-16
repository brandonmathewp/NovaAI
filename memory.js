class MemoryManager {
    constructor() {
        this.shortTermMemory = [];
        this.longTermMemory = [];
        this.keywords = [];
        this.maxSTM = 20; // Maximum short-term memories
        this.maxLTM = 100; // Maximum long-term memories
        
        this.loadMemory();
    }
    
    async loadMemory() {
        try {
            const stm = localStorage.getItem('memory_stm');
            const ltm = localStorage.getItem('memory_ltm');
            const keywords = localStorage.getItem('memory_keywords');
            
            if (stm) this.shortTermMemory = JSON.parse(stm);
            if (ltm) this.longTermMemory = JSON.parse(ltm);
            if (keywords) this.keywords = JSON.parse(keywords);
        } catch (error) {
            console.error('Error loading memory:', error);
            this.shortTermMemory = [];
            this.longTermMemory = [];
            this.keywords = [];
        }
    }
    
    saveMemory() {
        try {
            localStorage.setItem('memory_stm', JSON.stringify(this.shortTermMemory));
            localStorage.setItem('memory_ltm', JSON.stringify(this.longTermMemory));
            localStorage.setItem('memory_keywords', JSON.stringify(this.keywords));
        } catch (error) {
            console.error('Error saving memory:', error);
        }
    }
    
    async processMessage(message) {
        // Extract keywords from message
        const extractedKeywords = this.extractKeywords(message.content);
        
        // Add to short-term memory
        await this.addToSTM(message.content, extractedKeywords);
        
        // Check if this should be promoted to long-term memory
        await this.checkForLtmPromotion(message.content, extractedKeywords);
        
        // Update keywords
        await this.updateKeywords(extractedKeywords);
    }
    
    async addToSTM(content, keywords = []) {
        const memory = {
            id: Date.now().toString(),
            content: content,
            keywords: keywords,
            timestamp: new Date().toISOString(),
            source: 'chat'
        };
        
        this.shortTermMemory.unshift(memory);
        
        // Limit STM size
        if (this.shortTermMemory.length > this.maxSTM) {
            this.shortTermMemory = this.shortTermMemory.slice(0, this.maxSTM);
        }
        
        this.saveMemory();
        return memory;
    }
    
    async addToLTM(content, keywords = [], source = 'manual') {
        const memory = {
            id: Date.now().toString(),
            content: content,
            keywords: keywords,
            timestamp: new Date().toISOString(),
            source: source,
            accessCount: 0
        };
        
        this.longTermMemory.unshift(memory);
        
        // Limit LTM size
        if (this.longTermMemory.length > this.maxLTM) {
            this.longTermMemory = this.longTermMemory.slice(0, this.maxLTM);
        }
        
        this.saveMemory();
        return memory;
    }
    
    async checkForLtmPromotion(content, keywords) {
        // Check if content contains important keywords
        const importantKeywords = this.keywords.filter(k => k.importance > 0.7);
        const hasImportantKeyword = keywords.some(kw => 
            importantKeywords.some(ik => ik.text.toLowerCase().includes(kw.toLowerCase()))
        );
        
        // Check content length (longer messages might be more important)
        const isLong = content.length > 100;
        
        // Check for questions or important statements
        const hasQuestion = /[?]/.test(content);
        const hasImportantWord = /\b(important|remember|never|always|love|hate)\b/i.test(content);
        
        // If any condition is met, promote to LTM
        if (hasImportantKeyword || isLong || hasQuestion || hasImportantWord) {
            await this.addToLTM(content, keywords, 'auto_promoted');
            return true;
        }
        
        return false;
    }
    
    extractKeywords(text) {
        // Simple keyword extraction
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3);
        
        // Remove common stop words
        const stopWords = new Set([
            'the', 'and', 'that', 'for', 'with', 'this', 'have', 'from',
            'they', 'what', 'when', 'where', 'which', 'your', 'about',
            'would', 'there', 'their', 'were', 'will', 'just', 'like'
        ]);
        
        const filtered = words.filter(word => !stopWords.has(word));
        
        // Count frequency
        const frequency = {};
        filtered.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });
        
        // Get top keywords
        const sorted = Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(entry => entry[0]);
        
        return sorted;
    }
    
    async updateKeywords(newKeywords) {
        newKeywords.forEach(keyword => {
            const existing = this.keywords.find(k => k.text === keyword);
            if (existing) {
                existing.count++;
                existing.lastUsed = new Date().toISOString();
                // Increase importance based on usage
                existing.importance = Math.min(1, existing.importance + 0.1);
            } else {
                this.keywords.push({
                    text: keyword,
                    count: 1,
                    importance: 0.5,
                    createdAt: new Date().toISOString(),
                    lastUsed: new Date().toISOString()
                });
            }
        });
        
        // Sort by importance
        this.keywords.sort((a, b) => b.importance - a.importance);
        
        // Limit keywords
        if (this.keywords.length > 50) {
            this.keywords = this.keywords.slice(0, 50);
        }
        
        this.saveMemory();
    }
    
    async addKeyword(keyword) {
        const existing = this.keywords.find(k => k.text === keyword);
        if (existing) {
            existing.importance = Math.min(1, existing.importance + 0.2);
            existing.lastUsed = new Date().toISOString();
        } else {
            this.keywords.push({
                text: keyword,
                count: 1,
                importance: 0.8, // Higher importance for manually added keywords
                createdAt: new Date().toISOString(),
                lastUsed: new Date().toISOString()
            });
        }
        
        this.keywords.sort((a, b) => b.importance - a.importance);
        this.saveMemory();
    }
    
    async getRelevantMemories(query, limit = 5) {
        const queryKeywords = this.extractKeywords(query);
        
        // Combine STM and LTM for search
        const allMemories = [
            ...this.shortTermMemory.map(m => ({ ...m, type: 'stm' })),
            ...this.longTermMemory.map(m => ({ ...m, type: 'ltm' }))
        ];
        
        // Score each memory based on keyword overlap
        const scoredMemories = allMemories.map(memory => {
            let score = 0;
            
            // Check keyword overlap
            queryKeywords.forEach(keyword => {
                if (memory.keywords.includes(keyword)) {
                    score += 2;
                } else if (memory.content.toLowerCase().includes(keyword.toLowerCase())) {
                    score += 1;
                }
            });
            
            // Boost recent memories
            const age = Date.now() - new Date(memory.timestamp).getTime();
            const ageBoost = age < 24 * 60 * 60 * 1000 ? 1 : 0; // Boost if less than 1 day old
            
            // Boost LTM memories with high access count
            const accessBoost = memory.accessCount ? Math.min(3, memory.accessCount * 0.5) : 0;
            
            return {
                ...memory,
                relevanceScore: score + ageBoost + accessBoost
            };
        });
        
        // Sort by score and return top memories
        return scoredMemories
            .filter(m => m.relevanceScore > 0)
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, limit);
    }
    
    async removeMessageFromMemory(message) {
        // Remove from STM
        this.shortTermMemory = this.shortTermMemory.filter(m => 
            !m.content.includes(message.content.substring(0, 50))
        );
        
        // Remove from LTM
        this.longTermMemory = this.longTermMemory.filter(m => 
            !m.content.includes(message.content.substring(0, 50))
        );
        
        this.saveMemory();
    }
    
    renderMemory() {
        this.renderSTM();
        this.renderLTM();
        this.renderKeywords();
    }
    
    renderSTM() {
        const container = document.getElementById('stm-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (this.shortTermMemory.length === 0) {
            container.innerHTML = '<div class="empty-state">No short-term memories yet</div>';
            return;
        }
        
        this.shortTermMemory.forEach(memory => {
            const element = this.createMemoryElement(memory, 'stm');
            container.appendChild(element);
        });
    }
    
    renderLTM() {
        const container = document.getElementById('ltm-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (this.longTermMemory.length === 0) {
            container.innerHTML = '<div class="empty-state">No long-term memories yet</div>';
            return;
        }
        
        this.longTermMemory.forEach(memory => {
            const element = this.createMemoryElement(memory, 'ltm');
            container.appendChild(element);
        });
    }
    
    renderKeywords() {
        const container = document.getElementById('keywords-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (this.keywords.length === 0) {
            container.innerHTML = '<div class="empty-state">No keywords yet</div>';
            return;
        }
        
        this.keywords.forEach(keyword => {
            const element = this.createKeywordElement(keyword);
            container.appendChild(element);
        });
    }
    
    createMemoryElement(memory, type) {
        const element = document.createElement('div');
        element.className = 'memory-item';
        element.dataset.memoryId = memory.id;
        element.dataset.memoryType = type;
        
        const time = new Date(memory.timestamp).toLocaleString();
        const keywords = memory.keywords.map(k => 
            `<span class="keyword-tag">${k}</span>`
        ).join('');
        
        element.innerHTML = `
            <div class="memory-header">
                <span class="memory-time">${time}</span>
                <span class="memory-source">${memory.source}</span>
            </div>
            <div class="memory-content">${memory.content}</div>
            <div class="memory-keywords">${keywords}</div>
            <div class="memory-actions">
                <button class="btn btn-small" onclick="window.memory.editMemory('${memory.id}', '${type}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-small btn-danger" onclick="window.memory.deleteMemory('${memory.id}', '${type}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        
        return element;
    }
    
    createKeywordElement(keyword) {
        const element = document.createElement('div');
        element.className = 'keyword-item';
        
        const importanceWidth = Math.round(keyword.importance * 100);
        const importanceColor = keyword.importance > 0.7 ? 'var(--success-color)' : 
                              keyword.importance > 0.4 ? 'var(--warning-color)' : 
                              'var(--danger-color)';
        
        element.innerHTML = `
            <div class="keyword-text">${keyword.text}</div>
            <div class="keyword-stats">
                <div class="importance-bar">
                    <div class="importance-fill" style="width: ${importanceWidth}%; background: ${importanceColor}"></div>
                </div>
                <span class="keyword-count">${keyword.count}×</span>
                <button class="btn btn-small btn-danger" onclick="window.memory.deleteKeyword('${keyword.text}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        return element;
    }
    
    async editMemory(memoryId, type) {
        const memory = type === 'stm' 
            ? this.shortTermMemory.find(m => m.id === memoryId)
            : this.longTermMemory.find(m => m.id === memoryId);
        
        if (!memory) return;
        
        const newContent = prompt('Edit memory:', memory.content);
        if (newContent === null || newContent === memory.content) return;
        
        memory.content = newContent;
        memory.keywords = this.extractKeywords(newContent);
        memory.edited = true;
        memory.editTimestamp = new Date().toISOString();
        
        this.saveMemory();
        
        // Re-render the appropriate list
        if (type === 'stm') {
            this.renderSTM();
        } else {
            this.renderLTM();
        }
        
        window.app.showToast('Memory updated', 'success');
    }
    
    async deleteMemory(memoryId, type) {
        if (!confirm('Delete this memory?')) return;
        
        if (type === 'stm') {
            this.shortTermMemory = this.shortTermMemory.filter(m => m.id !== memoryId);
        } else {
            this.longTermMemory = this.longTermMemory.filter(m => m.id !== memoryId);
        }
        
        this.saveMemory();
        
        // Re-render the appropriate list
        if (type === 'stm') {
            this.renderSTM();
        } else {
            this.renderLTM();
        }
        
        window.app.showToast('Memory deleted', 'success');
    }
    
    async deleteKeyword(keywordText) {
        if (!confirm(`Delete keyword "${keywordText}"?`)) return;
        
        this.keywords = this.keywords.filter(k => k.text !== keywordText);
        this.saveMemory();
        this.renderKeywords();
        
        window.app.showToast('Keyword deleted', 'success');
    }
    
    async addMemory(type, content, keywords = []) {
        if (type === 'stm') {
            await this.addToSTM(content, keywords);
            this.renderSTM();
        } else {
            await this.addToLTM(content, keywords, 'manual');
            this.renderLTM();
        }
    }
                      }
