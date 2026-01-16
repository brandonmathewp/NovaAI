class MarkdownRenderer {
    constructor() {
        // Configure marked
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,
                gfm: true,
                smartypants: true,
                highlight: function(code, lang) {
                    if (typeof hljs !== 'undefined') {
                        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                        return hljs.highlight(code, { language }).value;
                    }
                    return code;
                }
            });
        }
    }
    
    renderMarkdown(text) {
        if (!text) return '';
        
        // If marked is available, use it
        if (typeof marked !== 'undefined') {
            try {
                return marked.parse(text);
            } catch (error) {
                console.error('Error parsing markdown:', error);
                return this.escapeHtml(text);
            }
        }
        
        // Fallback: simple markdown-like rendering
        return this.simpleMarkdown(text);
    }
    
    simpleMarkdown(text) {
        // Escape HTML first
        let html = this.escapeHtml(text);
        
        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        
        // Bold and italic
        html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
        html = html.replace(/_(.*?)_/g, '<em>$1</em>');
        
        // Code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        
        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        
        // Images
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
        
        // Lists
        html = html.replace(/^\s*\*\s+(.*$)/gim, '<li>$1</li>');
        html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
        
        // Blockquotes
        html = html.replace(/^\s*> (.*$)/gim, '<blockquote>$1</blockquote>');
        
        // Line breaks
        html = html.replace(/\n/g, '<br>');
        
        // Paragraphs (simple version)
        html = html.replace(/<br><br>/g, '</p><p>');
        html = '<p>' + html + '</p>';
        
        return html;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    sanitizeHtml(html) {
        // Remove dangerous tags and attributes
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        // Remove script tags
        const scripts = temp.getElementsByTagName('script');
        while (scripts.length > 0) {
            scripts[0].parentNode.removeChild(scripts[0]);
        }
        
        // Remove other dangerous tags
        const dangerousTags = ['iframe', 'object', 'embed', 'link', 'meta', 'style'];
        dangerousTags.forEach(tag => {
            const elements = temp.getElementsByTagName(tag);
            while (elements.length > 0) {
                elements[0].parentNode.removeChild(elements[0]);
            }
        });
        
        // Remove dangerous attributes
        const allElements = temp.getElementsByTagName('*');
        for (let i = 0; i < allElements.length; i++) {
            const element = allElements[i];
            const attrs = element.attributes;
            
            for (let j = attrs.length - 1; j >= 0; j--) {
                const attr = attrs[j];
                if (attr.name.startsWith('on') || // event handlers
                    attr.name === 'href' && attr.value.startsWith('javascript:') ||
                    attr.name === 'src' && attr.value.startsWith('javascript:')) {
                    element.removeAttribute(attr.name);
                }
            }
        }
        
        return temp.innerHTML;
    }
    
    renderWithSanitization(text) {
        const html = this.renderMarkdown(text);
        return this.sanitizeHtml(html);
    }
    
    stripMarkdown(text) {
        // Remove markdown formatting
        return text
            .replace(/[#*_~`\[\]()]/g, '')
            .replace(/!\[.*\]\(.*\)/g, '')
            .replace(/\[.*\]\(.*\)/g, '')
            .replace(/\n{2,}/g, '\n')
            .trim();
    }
    
    extractLinks(text) {
        const links = [];
        const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            links.push({
                text: match[1],
                url: match[2]
            });
        }
        
        return links;
    }
    
    extractImages(text) {
        const images = [];
        const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            images.push({
                alt: match[1],
                src: match[2]
            });
        }
        
        return images;
    }
    
    countWords(text) {
        return text.trim().split(/\s+/).length;
    }
    
    countCharacters(text) {
        return text.length;
    }
    
    estimateReadingTime(text, wordsPerMinute = 200) {
        const words = this.countWords(text);
        return Math.ceil(words / wordsPerMinute);
    }
}

// Initialize global instance
window.markdownRenderer = new MarkdownRenderer();
