// Eyecare AI Assistant - Background Service Worker

class BackgroundService {
  constructor() {
    this.apiBaseUrl = 'http://localhost:3000';
    this.init();
  }

  init() {
    console.log('🤖 Eyecare AI Assistant background service starting...');
    
    // Listen for extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstallation(details);
    });

    // Listen for tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });

    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Set up context menus
    this.setupContextMenus();
  }

  handleInstallation(details) {
    if (details.reason === 'install') {
      console.log('🎉 Eyecare AI Assistant installed');
      
      // Open welcome page
      chrome.tabs.create({
        url: `${this.apiBaseUrl}?welcome=extension`
      });
      
      // Set default settings
      chrome.storage.sync.set({
        enabled: true,
        autoAnalyze: true,
        showNotifications: true,
        apiUrl: this.apiBaseUrl
      });
    }
  }

  handleTabUpdate(tabId, changeInfo, tab) {
    // Only process when page is completely loaded
    if (changeInfo.status !== 'complete' || !tab.url) return;

    // Check if this is an Encompass or Eyefinity page
    if (this.isEyecareSystem(tab.url)) {
      console.log('🏥 Eyecare system detected:', tab.url);
      
      // Inject content script if not already present
      this.injectContentScript(tabId);
      
      // Analyze page context
      this.analyzePageContext(tabId, tab);
    }
  }

  isEyecareSystem(url) {
    const eyecareDomains = [
      'encompass.com',
      'eyefinity.com',
      'vsp.com'
    ];
    
    return eyecareDomains.some(domain => url.includes(domain));
  }

  async injectContentScript(tabId) {
    try {
      // Check if tab exists and is accessible
      const tab = await chrome.tabs.get(tabId);
      if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
        console.log('⚠️ Skipping injection for system page:', tab?.url);
        return;
      }

      // Check if content script is already injected
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => typeof window.EyecareAIAssistant !== 'undefined'
      });

      if (results[0]?.result) {
        console.log('⚠️ Content script already injected');
        return;
      }

      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      
      await chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ['overlay.css']
      });
      
      console.log('✅ Content script injected successfully');
    } catch (error) {
      if (error.message.includes('Frame with ID 0 is showing error page') || 
          error.message.includes('Cannot access') ||
          error.message.includes('The tab was closed')) {
        console.log('⚠️ Skipping injection - tab not accessible:', error.message);
      } else {
        console.error('❌ Failed to inject content script:', error);
      }
    }
  }

  async analyzePageContext(tabId, tab) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        function: () => {
          return {
            forms: document.forms.length,
            inputs: document.querySelectorAll('input, select, textarea').length,
            patientData: this.extractPatientData?.() || null,
            pageType: this.detectPageType?.() || 'Unknown'
          };
        }
      });

      if (results[0]?.result) {
        const context = results[0].result;
        console.log('📊 Page context:', context);
        
        // Store context for later use
        chrome.storage.local.set({
          [`context_${tabId}`]: {
            ...context,
            url: tab.url,
            title: tab.title,
            timestamp: Date.now()
          }
        });
      }
    } catch (error) {
      console.error('❌ Failed to analyze page context:', error);
    }
  }

  handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'GET_CONTEXT':
        this.getStoredContext(sender.tab.id, sendResponse);
        break;
        
      case 'CHAT_MESSAGE':
        this.handleChatMessage(message.data, sender, sendResponse);
        break;
        
      case 'ANALYZE_PAGE':
        this.analyzePageForAssistant(sender.tab.id, sendResponse);
        break;
        
      case 'FIND_TRAINING':
        this.findRelevantTraining(message.data, sendResponse);
        break;
        
      case 'CONTACT_LENS_DETECTED':
        this.handleContactLensDetection(message.data, sender, sendResponse);
        break;
        
      case 'PRICE_MATCH_REQUEST':
        this.handlePriceMatchRequest(message.data, sender, sendResponse);
        break;
        
      default:
        console.log('Unknown message type:', message.type);
        sendResponse({ error: 'Unknown message type' });
    }
  }

  async getStoredContext(tabId, sendResponse) {
    try {
      const result = await chrome.storage.local.get(`context_${tabId}`);
      sendResponse({ success: true, context: result[`context_${tabId}`] || null });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleChatMessage(data, sender, sendResponse) {
    try {
      // Get page context including contact lens data
      const contextResult = await chrome.storage.local.get(`context_${sender.tab.id}`);
      const context = contextResult[`context_${sender.tab.id}`] || {};

      // Build context message if contact lens data is present
      let contextMessage = data.message;
      if (context.contactLensData) {
        const lensData = context.contactLensData;
        contextMessage = `[Context: User is viewing a contact lens order page with ${lensData.manufacturer || 'Unknown'} ${lensData.style || 'lenses'}, Price: $${lensData.price || 'N/A'}] ${data.message}`;
      }

      // Send to AI assistant API
      const response = await fetch(`${this.apiBaseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: contextMessage,
          context: {
            ...context,
            browserExtension: true,
            tabId: sender.tab.id,
            contactLensDetected: !!context.contactLensData
          },
          user: {
            id: 'browser-extension-user',
            role: 'practitioner'
          }
        })
      });

      const result = await response.json();
      sendResponse({ success: true, response: result.response });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async analyzePageForAssistant(tabId, sendResponse) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        function: () => {
          return {
            url: window.location.href,
            title: document.title,
            forms: document.forms.length,
            inputs: document.querySelectorAll('input, select, textarea').length,
            buttons: document.querySelectorAll('button').length,
            pageType: window.aiAssistant?.detectPageType() || 'Unknown',
            patientData: window.aiAssistant?.extractPatientData() || null,
            formData: window.aiAssistant?.extractFormData() || {}
          };
        }
      });

      if (results[0]?.result) {
        sendResponse({ success: true, analysis: results[0].result });
      } else {
        sendResponse({ success: false, error: 'Failed to analyze page' });
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async findRelevantTraining(data, sendResponse) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/training/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pageType: data.pageType,
          context: data.context,
          userRole: 'practitioner'
        })
      });

      const result = await response.json();
      sendResponse({ success: true, training: result.suggestions || [] });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleContactLensDetection(data, sender, sendResponse) {
    try {
      console.log('Contact lens detected from tab:', sender.tab.id, data);
      
      // Store contact lens data in context
      const contextKey = `context_${sender.tab.id}`;
      const existingContext = await chrome.storage.local.get(contextKey);
      
      const updatedContext = {
        ...(existingContext[contextKey] || {}),
        contactLensData: data,
        hasContactLens: true,
        pageType: 'Contact Lens Order',
        url: sender.tab.url,
        title: sender.tab.title,
        timestamp: Date.now()
      };
      
      await chrome.storage.local.set({ [contextKey]: updatedContext });
      
      // Notify the AI assistant overlay if it's open
      chrome.tabs.sendMessage(sender.tab.id, {
        type: 'CONTEXT_UPDATED',
        context: updatedContext
      });
      
      sendResponse({ success: true, message: 'Contact lens data stored' });
    } catch (error) {
      console.error('Error handling contact lens detection:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handlePriceMatchRequest(data, sender, sendResponse) {
    try {
      console.log('Price match request from tab:', sender.tab.id, data);
      
      // Forward to price match API
      const response = await fetch('http://localhost:3000/api/price-match/contact-lens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'chrome-extension://' + chrome.runtime.id
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        const result = await response.json();
        sendResponse({ success: true, data: result });
      } else {
        sendResponse({ success: false, error: `API error: ${response.status}` });
      }
    } catch (error) {
      console.error('Error handling price match request:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  setupContextMenus() {
    // Check if contextMenus API is available
    if (chrome.contextMenus) {
      try {
        // Remove existing context menu items first
        chrome.contextMenus.removeAll(() => {
          // Create context menu items
          chrome.contextMenus.create({
            id: 'eyecare-ai-help',
            title: '🤖 Get AI Help',
            contexts: ['selection', 'page']
          });

          chrome.contextMenus.create({
            id: 'eyecare-ai-training',
            title: '📚 Find Training',
            contexts: ['page']
          });

          chrome.contextMenus.create({
            id: 'eyecare-ai-analyze',
            title: '🔍 Analyze Page',
            contexts: ['page']
          });
        });

        // Handle context menu clicks
        chrome.contextMenus.onClicked.addListener((info, tab) => {
          this.handleContextMenuClick(info, tab);
        });
      } catch (error) {
        console.log('Context menus not available:', error);
      }
    }
  }

  async handleContextMenuClick(info, tab) {
    switch (info.menuItemId) {
      case 'eyecare-ai-help':
        await this.showAIHelp(info, tab);
        break;
        
      case 'eyecare-ai-training':
        await this.showTrainingSuggestions(tab);
        break;
        
      case 'eyecare-ai-analyze':
        await this.showPageAnalysis(tab);
        break;
    }
  }

  async showAIHelp(info, tab) {
    const selectedText = info.selectionText || '';
    
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: (text) => {
          if (window.aiAssistant) {
            window.aiAssistant.toggleOverlay();
            if (text) {
              // Pre-fill chat with selected text
              const chatInput = document.getElementById('chat-input');
              if (chatInput) {
                chatInput.value = `Help me understand: "${text}"`;
              }
            }
          }
        },
        args: [selectedText]
      });
    } catch (error) {
      console.error('Failed to show AI help:', error);
    }
  }

  async showTrainingSuggestions(tab) {
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
    } catch (error) {
      console.error('Failed to show training suggestions:', error);
    }
  }

  async showPageAnalysis(tab) {
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
    } catch (error) {
      console.error('Failed to show page analysis:', error);
    }
  }
}

// Initialize background service
const backgroundService = new BackgroundService();
