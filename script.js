class NutriWiseChatbot {
    constructor() {
        // Configuration
        this.config = {
            apiUrl: 'http://127.0.0.1:5000/ask',
            maxRetries: 3,
            retryDelay: 1000,
            typingDelay: 1500,
            maxMessageLength: 500
        };

        // State
        this.isConnected = true;
        this.isTyping = false;
        this.messageHistory = [];
        this.retryCount = 0;

        // DOM Elements
        this.elements = {
            chatMessages: document.getElementById('chatMessages'),
            messageInput: document.getElementById('messageInput'),
            sendBtn: document.getElementById('sendBtn'),
            typingIndicator: document.getElementById('typingIndicator'),
            connectionStatus: document.getElementById('connectionStatus'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            minimizeBtn: document.getElementById('minimizeBtn'),
            closeBtn: document.getElementById('closeBtn'),
            charCount: document.getElementById('charCount'),
            suggestedQuestions: document.getElementById('suggestedQuestions')
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupSuggestionPills();
        this.autoResizeTextarea();
        this.showLoadingOverlay();
        
        // Hide loading overlay after 1 second (simulating initialization)
        setTimeout(() => {
            this.hideLoadingOverlay();
            this.elements.messageInput.focus();
        }, 1000);
    }

    setupEventListeners() {
        // Send button click
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());

        // Enter key to send message
        this.elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Input change for character count and auto-resize
        this.elements.messageInput.addEventListener('input', () => {
            this.updateCharacterCount();
            this.autoResizeTextarea();
            this.updateSendButtonState();
        });

        // Minimize and close buttons
        this.elements.minimizeBtn.addEventListener('click', () => this.minimizeChat());
        this.elements.closeBtn.addEventListener('click', () => this.closeChat());

        // Handle paste events
        this.elements.messageInput.addEventListener('paste', (e) => {
            setTimeout(() => {
                this.updateCharacterCount();
                this.autoResizeTextarea();
            }, 0);
        });
    }

    setupSuggestionPills() {
        const suggestionPills = document.querySelectorAll('.suggestion-pill');
        suggestionPills.forEach(pill => {
            pill.addEventListener('click', () => {
                const question = pill.getAttribute('data-question');
                this.elements.messageInput.value = question;
                this.updateCharacterCount();
                this.updateSendButtonState();
                this.sendMessage();
            });
        });
    }

    autoResizeTextarea() {
        const textarea = this.elements.messageInput;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    updateCharacterCount() {
        const length = this.elements.messageInput.value.length;
        this.elements.charCount.textContent = length;
        
        // Change color based on character count
        if (length > 450) {
            this.elements.charCount.style.color = '#ef4444';
        } else if (length > 350) {
            this.elements.charCount.style.color = '#f59e0b';
        } else {
            this.elements.charCount.style.color = '#94a3b8';
        }
    }

    updateSendButtonState() {
        const hasText = this.elements.messageInput.value.trim().length > 0;
        const isNotTooLong = this.elements.messageInput.value.length <= this.config.maxMessageLength;
        
        this.elements.sendBtn.disabled = !hasText || !isNotTooLong || this.isTyping;
        this.elements.sendBtn.style.opacity = (hasText && isNotTooLong && !this.isTyping) ? '1' : '0.4';
    }

    async sendMessage() {
        const message = this.elements.messageInput.value.trim();
        
        if (!message || this.isTyping) return;
        if (message.length > this.config.maxMessageLength) {
            this.showError('Message is too long. Please keep it under 500 characters.');
            return;
        }

        // Clear input and hide suggestions
        this.elements.messageInput.value = '';
        this.updateCharacterCount();
        this.autoResizeTextarea();
        this.updateSendButtonState();
        this.hideSuggestions();

        // Add user message to chat
        this.addMessage(message, 'user');
        
        // Store message in history
        this.messageHistory.push({ role: 'user', content: message });

        // Show typing indicator
        this.showTyping();

        try {
            const response = await this.callAPI(message);
            this.hideTyping();
            
            if (response && response.answer) {
                this.addMessage(response.answer, 'bot');
                this.messageHistory.push({ role: 'bot', content: response.answer });
                this.retryCount = 0; // Reset retry count on success
                this.setConnectionStatus(true);
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error) {
            this.hideTyping();
            this.handleError(error, message);
        }
    }

    async callAPI(message) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        try {
            const response = await fetch(this.config.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question: message }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    handleError(error, originalMessage) {
        console.error('API Error:', error);
        
        let errorMessage = 'Sorry, I encountered an error. Please try again.';
        
        if (error.name === 'AbortError') {
            errorMessage = 'Request timed out. Please try again with a shorter message.';
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Unable to connect to NutriWise AI. Please check your connection.';
            this.setConnectionStatus(false);
        } else if (error.message.includes('500')) {
            errorMessage = 'The nutrition service is temporarily unavailable. Please try again in a moment.';
        }

        // Show retry option if within retry limit
        if (this.retryCount < this.config.maxRetries) {
            this.addMessage(errorMessage, 'bot', {
                showRetry: true,
                originalMessage: originalMessage
            });
        } else {
            this.addMessage(errorMessage + ' If the problem persists, please refresh the page.', 'bot');
            this.retryCount = 0; // Reset retry count
        }
    }

    addMessage(content, sender, options = {}) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const currentTime = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        let avatarContent = sender === 'user' ? '👤' : '🤖';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">${avatarContent}</div>
            <div class="message-content">
                <div class="message-bubble">
                    ${this.formatMessage(content)}
                    ${options.showRetry ? this.createRetryButton(options.originalMessage) : ''}
                </div>
                <div class="message-time">${currentTime}</div>
            </div>
        `;

        this.elements.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();

        // Setup retry button if present
        if (options.showRetry) {
            const retryBtn = messageDiv.querySelector('.retry-btn');
            retryBtn.addEventListener('click', () => {
                this.retryMessage(options.originalMessage);
                retryBtn.remove();
            });
        }
    }

    formatMessage(content) {
        // Convert line breaks to HTML
        content = content.replace(/\n/g, '<br>');
        
        // Convert **bold** to <strong>
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Convert *italic* to <em>
        content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Convert numbered lists
        content = content.replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>');
        if (content.includes('<li>')) {
            content = content.replace(/(<li>.*<\/li>)/gs, '<ol>$1</ol>');
        }
        
        // Convert bullet points
        content = content.replace(/^[-•]\s(.+)$/gm, '<li>$1</li>');
        if (content.includes('<li>') && !content.includes('<ol>')) {
            content = content.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
        }

        return content;
    }

    createRetryButton(originalMessage) {
        return `
            <div class="retry-container" style="margin-top: 12px;">
                <button class="retry-btn" data-message="${originalMessage}" style="
                    background: #f1f5f9;
                    border: 1px solid #e2e8f0;
                    padding: 6px 12px;
                    border-radius: 16px;
                    font-size: 12px;
                    color: #2d9658;
                    cursor: pointer;
                    transition: all 0.2s;
                ">
                    🔄 Try again
                </button>
            </div>
        `;
    }

    async retryMessage(message) {
        this.retryCount++;
        this.showTyping();
        
        try {
            await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
            const response = await this.callAPI(message);
            this.hideTyping();
            
            if (response && response.answer) {
                this.addMessage(response.answer, 'bot');
                this.messageHistory.push({ role: 'bot', content: response.answer });
                this.retryCount = 0;
                this.setConnectionStatus(true);
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error) {
            this.hideTyping();
            this.handleError(error, message);
        }
    }

    showTyping() {
        this.isTyping = true;
        this.elements.typingIndicator.classList.add('active');
        this.updateSendButtonState();
        this.scrollToBottom();
    }

    hideTyping() {
        this.isTyping = false;
        this.elements.typingIndicator.classList.remove('active');
        this.updateSendButtonState();
    }

    hideSuggestions() {
        if (this.elements.suggestedQuestions) {
            this.elements.suggestedQuestions.style.display = 'none';
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }, 100);
    }

    setConnectionStatus(isConnected) {
        this.isConnected = isConnected;
        const statusElement = this.elements.connectionStatus;
        
        if (isConnected) {
            statusElement.classList.remove('active', 'error');
            setTimeout(() => {
                statusElement.classList.add('success');
                statusElement.innerHTML = `
                    <div class="status-icon">✅</div>
                    <div class="status-text">Connected to NutriWise AI</div>
                `;
                statusElement.classList.add('active');
                
                setTimeout(() => {
                    statusElement.classList.remove('active');
                }, 3000);
            }, 500);
        } else {
            statusElement.classList.remove('success');
            statusElement.classList.add('error', 'active');
            statusElement.innerHTML = `
                <div class="status-icon">⚠️</div>
                <div class="status-text">Connection lost. Trying to reconnect...</div>
            `;
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            background: #fee2e2;
            border: 1px solid #fecaca;
            color: #dc2626;
            padding: 12px;
            border-radius: 12px;
            margin-bottom: 16px;
            font-size: 14px;
            text-align: center;
        `;
        errorDiv.textContent = message;
        
        this.elements.chatMessages.appendChild(errorDiv);
        this.scrollToBottom();
        
        // Remove error message after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    showLoadingOverlay() {
        this.elements.loadingOverlay.classList.add('active');
    }

    hideLoadingOverlay() {
        this.elements.loadingOverlay.classList.remove('active');
    }

    minimizeChat() {
        // Add minimize animation
        document.querySelector('.chat-container').style.transform = 'scale(0.8)';
        document.querySelector('.chat-container').style.opacity = '0.8';
        
        // Simulate minimize (in a real app, you might hide the window)
        setTimeout(() => {
            alert('Chat minimized! (In a real app, this would minimize to taskbar)');
            document.querySelector('.chat-container').style.transform = 'scale(1)';
            document.querySelector('.chat-container').style.opacity = '1';
        }, 300);
    }

    closeChat() {
        if (confirm('Are you sure you want to close the chat? Your conversation will be lost.')) {
            document.querySelector('.chat-container').style.transform = 'scale(0.9)';
            document.querySelector('.chat-container').style.opacity = '0';
            
            setTimeout(() => {
                window.close(); // In a real app, you might redirect or hide the component
            }, 300);
        }
    }

    // Public methods for external integration
    sendCustomMessage(message) {
        this.elements.messageInput.value = message;
        this.sendMessage();
    }

    clearChat() {
        const messages = this.elements.chatMessages.querySelectorAll('.message:not(.welcome-message)');
        messages.forEach(msg => msg.remove());
        this.messageHistory = [];
        this.elements.suggestedQuestions.style.display = 'block';
    }

    setAPIUrl(url) {
        this.config.apiUrl = url;
    }

    getMessageHistory() {
        return this.messageHistory;
    }
}

// Initialize the chatbot when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.nutriWiseBot = new NutriWiseChatbot();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NutriWiseChatbot;
}