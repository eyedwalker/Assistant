// Eyecare AI Assistant - Popup Script

class PopupController {
  constructor() {
    this.apiBaseUrl = 'http://localhost:3001';
    this.auth = new ExtensionAuth();
    this.init();
  }

  async init() {
    // Check authentication first
    const isAuthenticated = await this.auth.checkAuth();
    
    if (!isAuthenticated) {
      // Show login required message
      document.body.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <h3 style="color: #667eea;">🔒 Login Required</h3>
          <p style="color: #666; margin: 15px 0;">Please log in to use the extension</p>
          <button id="login-btn" style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
          ">Open Login Page</button>
        </div>
      `;
      
      document.getElementById('login-btn').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('login.html') });
        window.close();
      });
      return;
    }
    
    // Show user info
    const userInfo = this.auth.getUser();
    if (userInfo && document.querySelector('.header')) {
      const userDisplay = document.createElement('div');
      userDisplay.style.cssText = 'padding: 10px; background: #f0f4ff; border-radius: 6px; margin-bottom: 15px;';
      userDisplay.innerHTML = `
        <div style="font-size: 12px; color: #667eea; font-weight: bold;">Logged in as:</div>
        <div style="font-size: 14px; color: #333;">${userInfo.email}</div>
        <button id="logout-btn" style="
          margin-top: 8px;
          background: #fff;
          color: #667eea;
          border: 1px solid #667eea;
          padding: 5px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        ">Logout</button>
      `;
      document.querySelector('.header').appendChild(userDisplay);
      
      document.getElementById('logout-btn').addEventListener('click', async () => {
        await this.auth.logout();
        chrome.runtime.sendMessage({ type: 'LOGOUT' });
        window.close();
      });
    }
    
    // Load saved settings and initialize
    chrome.storage.sync.get(['enabled', 'autoAnalyze', 'showNotifications'], (data) => {
      console.log('🤖 Popup initializing...');
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Check AI assistant status
      this.checkAIStatus();
      
      // Analyze current page
      this.analyzeCurrentPage();
    });
  }

  setupEventListeners() {
    // Toggle overlay button
    document.getElementById('toggle-overlay').addEventListener('click', () => {
      this.toggleOverlay();
    });

    // Analyze page button
    document.getElementById('analyze-page').addEventListener('click', () => {
      this.analyzePage();
    });

    // Find training button
    document.getElementById('find-training').addEventListener('click', () => {
      this.findTraining();
    });

    // Open dashboard button
    document.getElementById('open-dashboard').addEventListener('click', () => {
      this.openDashboard();
    });

    // Footer links
    document.getElementById('settings-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.openSettings();
    });

    document.getElementById('help-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.openHelp();
    });

    document.getElementById('feedback-link').addEventListener('click', (e) => {
      e.preventDefault();
      this.openFeedback();
    });
  }

  async checkAIStatus() {
    const statusElement = document.getElementById('ai-status');
    const indicatorElement = document.getElementById('ai-indicator');

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/health`);
      
      if (response.ok) {
        statusElement.textContent = 'Connected';
        indicatorElement.className = 'status-indicator status-connected';
      } else {
        throw new Error('API not responding');
      }
    } catch (error) {
      statusElement.textContent = 'Disconnected';
      indicatorElement.className = 'status-indicator status-disconnected';
    }
  }

  async analyzeCurrentPage() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) return;

    const pageTypeElement = document.getElementById('page-type');
    const contextElement = document.getElementById('context-info');

    // Detect page type based on URL
    const pageType = this.detectPageType(tab.url, tab.title);
    pageTypeElement.textContent = pageType;

    // Get context info
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: this.getPageContext
      });

      if (results && results[0] && results[0].result) {
        const context = results[0].result;
        contextElement.textContent = `${context.forms} forms, ${context.inputs} inputs`;
      } else {
        contextElement.textContent = 'No context available';
      }
    } catch (error) {
      contextElement.textContent = 'Analysis failed';
    }
  }

  detectPageType(url, title) {
    const urlLower = url.toLowerCase();
    const titleLower = title.toLowerCase();
    
    if (urlLower.includes('encompass') || urlLower.includes('eyefinity')) {
      if (urlLower.includes('patient') || titleLower.includes('patient')) {
        return '👤 Patient Management';
      } else if (urlLower.includes('appointment') || urlLower.includes('schedule')) {
        return '📅 Scheduling';
      } else if (urlLower.includes('billing') || urlLower.includes('claim')) {
        return '💰 Billing & Claims';
      } else if (urlLower.includes('inventory') || urlLower.includes('frame')) {
        return '📦 Inventory';
      } else if (urlLower.includes('report') || urlLower.includes('analytics')) {
        return '📊 Reports';
      } else {
        return '🏥 Eyecare System';
      }
    } else {
      return '🌐 Web Page';
    }
  }

  // This function will be injected into the page
  getPageContext() {
    return {
      forms: document.forms.length,
      inputs: document.querySelectorAll('input, select, textarea').length,
      buttons: document.querySelectorAll('button').length,
      url: window.location.href,
      title: document.title
    };
  }

  async toggleOverlay() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) return;

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          // Check if overlay exists
          const overlay = document.getElementById('eyecare-ai-overlay');
          if (overlay) {
            // Toggle existing overlay
            const isVisible = overlay.style.display !== 'none';
            overlay.style.display = isVisible ? 'none' : 'block';
          } else {
            // Create new overlay if it doesn't exist
            if (window.aiAssistant) {
              window.aiAssistant.toggleOverlay();
            }
          }
        }
      });

      // Close popup after action
      window.close();
    } catch (error) {
      console.error('Failed to toggle overlay:', error);
    }
  }

  async analyzePage() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) return;

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          if (window.aiAssistant) {
            window.aiAssistant.analyzeCurrentPage();
            window.aiAssistant.toggleOverlay();
          }
        }
      });

      window.close();
    } catch (error) {
      console.error('Failed to analyze page:', error);
    }
  }

  async findTraining() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) return;

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          if (window.aiAssistant) {
            window.aiAssistant.suggestTraining();
            window.aiAssistant.toggleOverlay();
          }
        }
      });

      window.close();
    } catch (error) {
      console.error('Failed to find training:', error);
    }
  }

  openDashboard() {
    chrome.tabs.create({ url: `${this.apiBaseUrl}` });
    window.close();
  }

  openSettings() {
    // In a full implementation, this would open a settings page
    alert('Settings functionality would be implemented here');
  }

  openHelp() {
    // In a full implementation, this would open help documentation
    chrome.tabs.create({ url: `${this.apiBaseUrl}/help` });
    window.close();
  }

  openFeedback() {
    // In a full implementation, this would open a feedback form
    alert('Feedback functionality would be implemented here');
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
