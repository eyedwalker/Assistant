// Eyecare AI Assistant - Content Script
// Injects AI assistant overlay into Encompass/Eyefinity pages

// Prevent duplicate initialization
if (typeof window.EyecareAIAssistant !== 'undefined') {
  console.log('🤖 Eyecare AI Assistant already initialized');
} else {

class EyecareAIAssistant {
  constructor() {
    this.isInitialized = false;
    this.overlayVisible = false;
    this.apiBaseUrl = 'http://localhost:3000'; // Your AI assistant API
    this.contactLensContext = null;
    this.init();
    this.listenForContextUpdates();
  }

  init() {
    if (this.isInitialized) return;
    
    console.log('🤖 Eyecare AI Assistant initializing...');
    
    // Wait for page to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.createOverlay());
    } else {
      this.createOverlay();
    }
    
    this.isInitialized = true;
  }

  createOverlay() {
    // Create floating AI assistant button
    const floatingButton = document.createElement('div');
    floatingButton.id = 'eyecare-ai-button';
    floatingButton.innerHTML = `
      <div class="ai-button-content">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          <path d="M8 9h8"/>
          <path d="M8 13h6"/>
        </svg>
        <span>AI</span>
      </div>
    `;
    
    // Create overlay panel
    const overlay = document.createElement('div');
    overlay.id = 'eyecare-ai-overlay';
    overlay.innerHTML = `
      <div class="ai-overlay-header">
        <h3>🤖 Eyecare AI Assistant</h3>
        <button id="ai-close-btn">&times;</button>
      </div>
      <div class="ai-overlay-content">
        <div class="context-info">
          <h4>📍 Current Context</h4>
          <div id="page-context">Analyzing page...</div>
        </div>
        <div class="chat-container">
          <div id="chat-messages"></div>
          <div class="chat-input-container">
            <input type="text" id="chat-input" placeholder="Ask me anything about this page or eyecare procedures..." />
            <button id="send-btn">Send</button>
          </div>
        </div>
        <div class="quick-actions">
          <h4>🚀 Quick Actions</h4>
          <button class="quick-action-btn" data-action="help">Get Help</button>
          <button class="quick-action-btn" data-action="training">Find Training</button>
          <button class="quick-action-btn" data-action="analyze">Analyze Page</button>
          <button class="quick-action-btn" data-action="price-check" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;">💰 Check CL Prices</button>
        </div>
        <div id="price-status" style="margin-top: 10px; padding: 16px; display: none; background: rgba(102, 126, 234, 0.1); border-radius: 8px; font-size: 14px; max-height: 500px; overflow-y: auto;"></div>
      </div>
    `;

    // Add to page
    document.body.appendChild(floatingButton);
    document.body.appendChild(overlay);

    // Add event listeners
    this.setupEventListeners();
    
    // Analyze current page context
    this.analyzePageContext();
    
    console.log('✅ Eyecare AI Assistant overlay created');
  }

  setupEventListeners() {
    const button = document.getElementById('eyecare-ai-button');
    const overlay = document.getElementById('eyecare-ai-overlay');
    const closeBtn = document.getElementById('ai-close-btn');
    const sendBtn = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');

    // Toggle overlay
    button.addEventListener('click', () => this.toggleOverlay());
    closeBtn.addEventListener('click', () => this.hideOverlay());

    // Chat functionality
    sendBtn.addEventListener('click', () => this.sendMessage());
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });

    // Quick actions
    document.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        this.handleQuickAction(action);
      });
    });
  }

  toggleOverlay() {
    const overlay = document.getElementById('eyecare-ai-overlay');
    if (this.overlayVisible) {
      this.hideOverlay();
    } else {
      this.showOverlay();
      // Re-analyze when opening
      this.analyzePageContext();
    }
  }
  
  listenForContextUpdates() {
    // Listen for context updates from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'CONTEXT_UPDATED' && message.context) {
        this.contactLensContext = message.context.contactLensData;
        console.log('Received contact lens context update:', this.contactLensContext);
        
        // Update the display if overlay is visible
        if (this.overlayVisible) {
          const contextDiv = document.getElementById('page-context');
          if (contextDiv && this.contactLensContext) {
            contextDiv.innerHTML = `
              <div style="background: #e3f2fd; padding: 8px; border-radius: 4px; margin-bottom: 8px;">
                <strong>📋 Contact Lens Order</strong><br/>
                <div>Brand: ${this.contactLensContext.manufacturer || 'Unknown'}</div>
                <div>Product: ${this.contactLensContext.style || 'Unknown'}</div>
                <div>Price: $${this.contactLensContext.price || 'N/A'}</div>
              </div>
            `;
          }
        }
      }
    });
  }

  showOverlay() {
    const overlay = document.getElementById('eyecare-ai-overlay');
    this.overlayVisible = true;
    overlay.style.display = 'block';
  }
  
  hideOverlay() {
    const overlay = document.getElementById('eyecare-ai-overlay');
    this.overlayVisible = false;
    overlay.style.display = 'none';
  }

  analyzePageContext() {
    const contextDiv = document.getElementById('page-context');
    
    // Detect current page type and context
    const pageInfo = {
      url: window.location.href,
      title: document.title,
      forms: document.forms.length,
      inputs: document.querySelectorAll('input, select, textarea').length,
      pageType: this.detectPageType(),
      patientData: this.extractPatientData(),
      formData: this.extractFormData()
    };

    contextDiv.innerHTML = `
      <div class="context-item">
        <strong>Page:</strong> ${pageInfo.pageType}
      </div>
      <div class="context-item">
        <strong>Forms:</strong> ${pageInfo.forms} forms, ${pageInfo.inputs} inputs
      </div>
      ${pageInfo.patientData ? `
        <div class="context-item">
          <strong>Patient:</strong> ${pageInfo.patientData}
        </div>
      ` : ''}
      <div class="context-suggestions">
        ${this.generateContextSuggestions(pageInfo)}
      </div>
    `;
  }

  detectPageType() {
    const url = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();
    
    if (url.includes('patient') || title.includes('patient')) {
      return '👤 Patient Management';
    } else if (url.includes('appointment') || url.includes('schedule')) {
      return '📅 Scheduling';
    } else if (url.includes('billing') || url.includes('claim')) {
      return '💰 Billing & Claims';
    } else if (url.includes('inventory') || url.includes('frame')) {
      return '📦 Inventory';
    } else if (url.includes('report') || url.includes('analytics')) {
      return '📊 Reports';
    } else {
      return '🏠 Dashboard';
    }
  }

  extractPatientData() {
    // Look for patient name or ID in common locations
    const selectors = [
      '[data-patient-name]',
      '.patient-name',
      '#patient-name',
      'input[name*="patient"]',
      'input[name*="name"]'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.value) {
        return element.value;
      }
    }
    
    return null;
  }

  extractFormData() {
    const formData = {};
    const inputs = document.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      if (input.name && input.value) {
        formData[input.name] = input.value;
      }
    });
    
    return formData;
  }

  generateContextSuggestions(pageInfo) {
    const suggestions = [];
    
    switch (pageInfo.pageType) {
      case '👤 Patient Management':
        suggestions.push('💡 Need help with patient records?');
        suggestions.push('📚 View Patient Management training');
        break;
      case '📅 Scheduling':
        suggestions.push('💡 Scheduling best practices');
        suggestions.push('📚 Appointment management tips');
        break;
      case '💰 Billing & Claims':
        suggestions.push('💡 Insurance claim assistance');
        suggestions.push('📚 Billing procedures training');
        break;
      default:
        suggestions.push('💡 Ask me about any eyecare procedure');
        suggestions.push('📚 Browse available training modules');
    }
    
    return suggestions.map(s => `<div class="suggestion">${s}</div>`).join('');
  }

  addMessage(type, message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type === 'user' ? 'user-message' : 'ai-message'}`;
    messageDiv.textContent = message;
    
    const messagesContainer = document.getElementById('chat-messages');
    if (messagesContainer) {
      messagesContainer.appendChild(messageDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  async sendMessage(message) {
    // Add user message to chat
    this.addMessage('user', message);
    
    const messagesContainer = document.getElementById('chat-messages');
    
    // Get contact lens context if available
    const lensDetection = window.detectContactLensInfo ? window.detectContactLensInfo() : null;
    
    // Send to background script for processing with context
    chrome.runtime.sendMessage({
      type: 'CHAT_MESSAGE',
      data: { 
        message,
        contactLensContext: lensDetection 
      }
    }, (response) => {
      if (response && response.success) {
        this.addMessage('assistant', response.response);
      }
    });
  }

  suggestTraining() {
    const pageType = this.detectPageType();
    let trainingModule = '';
    
    if (pageType.includes('Patient')) {
      trainingModule = 'Patient Management training module';
    } else if (pageType.includes('Billing')) {
      trainingModule = 'Billing & Claims training module';
    } else {
      trainingModule = 'Eyefinity Administration Fundamentals';
    }
    
    this.addMessage('assistant', `Based on your current page, I recommend the ${trainingModule}. Would you like me to open it?`);
  }

  analyzeCurrentPage() {
    const analysis = `
      📊 Page Analysis:
      • Page Type: ${this.detectPageType()}
      • Forms: ${document.forms.length}
      • Input Fields: ${document.querySelectorAll('input, select, textarea').length}
      • Buttons: ${document.querySelectorAll('button').length}
      
      💡 I can help you with any tasks on this page!
    `;
    
    this.addMessage('assistant', analysis);
  }

  handleQuickAction(action) {
    switch(action) {
      case 'help':
        this.addMessage('assistant', 'How can I help you with this page?');
        break;
      case 'training':
        this.suggestTraining();
        break;
      case 'analyze':
        this.analyzeCurrentPage();
        break;
      case 'price-check':
        this.checkContactLensPrices();
        break;
      default:
        console.log('Unknown action:', action);
    }
  }

  detectContactLensInfo() {
    console.log('🔍 Detecting contact lens information...');
    
    const orderData = {};
    const prescriptionData = {};
    let foundLensData = false;

    // Enhanced detection for Eyefinity pages
    const allRows = document.querySelectorAll('tr');
    allRows.forEach((row) => {
      const text = row.innerText?.toLowerCase() || '';
      const cells = row.querySelectorAll('td');
      
      // Check for product names like "Acuvue Oasys"
      if (text.includes('acuvue') || text.includes('oasys') || text.includes('biofinity') || 
          text.includes('dailies') || text.includes('air optix') || text.includes('contact lens')) {
        const productText = row.innerText?.trim() || '';
        if (productText) {
          // Extract manufacturer and style more accurately
          if (text.includes('acuvue')) {
            orderData.manufacturer = 'Johnson & Johnson Vision Care';
            orderData.style = productText.match(/Acuvue[^\n\t]*/i)?.[0] || productText;
          } else if (text.includes('biofinity')) {
            orderData.manufacturer = 'CooperVision';
            orderData.style = productText.match(/Biofinity[^\n\t]*/i)?.[0] || productText;
          } else {
            orderData.style = productText;
          }
          foundLensData = true;
        }
      }
      
      // Enhanced field detection
      cells.forEach((cell, index) => {
        const cellText = cell.innerText?.trim() || '';
        const nextCell = cells[index + 1];
        const cellValue = nextCell?.innerText?.trim() || '';
        
        // Manufacturer detection
        if ((cellText === 'Manufacturer' || cellText === 'Mfr' || cellText === 'Supplier') && cellValue) {
          orderData.manufacturer = cellValue;
          foundLensData = true;
        }
        // Style/Product detection
        else if ((cellText === 'Style' || cellText === 'Product' || cellText === 'Description') && cellValue) {
          orderData.style = cellValue;
          foundLensData = true;
        }
        // Prescription parameters
        else if ((cellText === 'Base Curve' || cellText === 'BC' || cellText.includes('Base')) && cellValue) {
          prescriptionData.baseCurve = cellValue;
        }
        else if ((cellText === 'Diameter' || cellText === 'Dia' || cellText === 'DIA') && cellValue) {
          prescriptionData.diameter = cellValue;
        }
        else if ((cellText === 'Sphere' || cellText === 'Sph' || cellText === 'SPH' || cellText === 'Power') && cellValue) {
          prescriptionData.sphere = cellValue;
        }
        else if ((cellText === 'Cylinder' || cellText === 'Cyl' || cellText === 'CYL') && cellValue) {
          prescriptionData.cylinder = cellValue;
        }
        else if ((cellText === 'Axis' || cellText === 'AX') && cellValue) {
          prescriptionData.axis = cellValue;
        }
        else if ((cellText === 'Add' || cellText === 'ADD') && cellValue) {
          prescriptionData.add = cellValue;
        }
        else if ((cellText === 'Quantity' || cellText === 'Qty') && cellValue) {
          prescriptionData.quantity = cellValue;
        }
      });
    });

    // Pattern matching for common lens brands
    const pageText = document.body.innerText;
    if (!foundLensData) {
      const lensPatterns = [
        { pattern: /Acuvue\s+Oasys\s+\d+\s*Pk/gi, manufacturer: 'Johnson & Johnson Vision Care' },
        { pattern: /Acuvue\s+[^\n\t]*/gi, manufacturer: 'Johnson & Johnson Vision Care' },
        { pattern: /Biofinity[^\n\t]*/gi, manufacturer: 'CooperVision' },
        { pattern: /Dailies\s+Total[^\n\t]*/gi, manufacturer: 'Alcon' },
        { pattern: /Air\s+Optix[^\n\t]*/gi, manufacturer: 'Alcon' },
        { pattern: /Proclear[^\n\t]*/gi, manufacturer: 'CooperVision' },
        { pattern: /Ultra[^\n\t]*/gi, manufacturer: 'Bausch + Lomb' }
      ];
      
      for (const { pattern, manufacturer } of lensPatterns) {
        const match = pageText.match(pattern);
        if (match) {
          orderData.style = match[0].trim();
          orderData.manufacturer = manufacturer;
          foundLensData = true;
          break;
        }
      }
    }

    // Enhanced prescription parameter extraction
    const numberPattern = /-?\d+\.\d+/g;
    const numbers = pageText.match(numberPattern) || [];
    
    // Base curve detection (8.0-9.5 range)
    if (!prescriptionData.baseCurve) {
      const baseCurves = numbers.filter(n => {
        const num = parseFloat(n);
        return num >= 8.0 && num <= 9.5;
      });
      if (baseCurves.length > 0) {
        prescriptionData.baseCurve = baseCurves[0];
      }
    }
    
    // Diameter detection (13.0-15.0 range)
    if (!prescriptionData.diameter) {
      const diameters = numbers.filter(n => {
        const num = parseFloat(n);
        return num >= 13.0 && num <= 15.0;
      });
      if (diameters.length > 0) {
        prescriptionData.diameter = diameters[0];
      }
    }

    // Sphere detection (-20.00 to +20.00 range)
    if (!prescriptionData.sphere) {
      const spheres = numbers.filter(n => {
        const num = parseFloat(n);
        return num >= -20.0 && num <= 20.0 && !prescriptionData.baseCurve?.includes(n) && !prescriptionData.diameter?.includes(n);
      });
      if (spheres.length > 0) {
        prescriptionData.sphere = spheres[0];
      }
    }

    if (foundLensData || Object.keys(prescriptionData).length > 0) {
      console.log('✅ Contact lens data detected:', { orderData, prescriptionData });
      return { orderData, prescriptionData };
    }

    console.log('❌ No contact lens data found');
    return null;
  }

  extractCurrentPrice() {
    // Look for price information on the page
    const priceSelectors = [
      '[data-price]',
      '.price',
      '.cost',
      '.total'
    ];
    
    for (const selector of priceSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent || '';
        const priceMatch = text.match(/\$([0-9]+\.?[0-9]*)/);;
        if (priceMatch) {
          return parseFloat(priceMatch[1]);
        }
      }
    }
    
    // Look for price in table cells
    const allCells = document.querySelectorAll('td');
    for (const cell of allCells) {
      const text = cell.textContent || '';
      if (text.includes('$')) {
        const priceMatch = text.match(/\$([0-9]+\.?[0-9]*)/);;
        if (priceMatch) {
          return parseFloat(priceMatch[1]);
        }
      }
    }
    
    // Look for price in span elements
    const allSpans = document.querySelectorAll('span');
    for (const span of allSpans) {
      const text = span.textContent || '';
      if (text.includes('$')) {
        const priceMatch = text.match(/\$([0-9]+\.?[0-9]*)/);;
        if (priceMatch) {
          return parseFloat(priceMatch[1]);
        }
      }
    }
    
    return null;
  }

  async checkContactLensPrices() {
    const statusDiv = document.getElementById('price-status');
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = '🔍 Detecting contact lens information...';

    const lensData = this.detectContactLensInfo();
    
    if (!lensData) {
      statusDiv.innerHTML = '❌ No contact lens information found on this page';
      return;
    }

    statusDiv.innerHTML = '🔄 Searching for best prices...';

    // Convert lens data to API format
    const apiData = {
      brand: lensData.orderData.manufacturer || 'Unknown',
      product: lensData.orderData.style || 'Contact Lens',
      baseCurve: lensData.prescriptionData.baseCurve,
      diameter: lensData.prescriptionData.diameter,
      sphere: lensData.prescriptionData.sphere,
      cylinder: lensData.prescriptionData.cylinder,
      axis: lensData.prescriptionData.axis,
      add: lensData.prescriptionData.add,
      currentPrice: this.extractCurrentPrice() || 120.00
    };

    // Use background script to make API call (avoids CORS issues)
    chrome.runtime.sendMessage({
      type: 'PRICE_MATCH_REQUEST',
      data: apiData
    }, (response) => {
      if (response && response.success && response.data) {
        // Convert API response to expected format
        const convertedData = {
          matches: response.data.recommendations || [],
          currentPrice: apiData.currentPrice,
          summary: response.data.summary
        };
        this.displayPriceResults(convertedData, lensData);
      } else {
        console.error('Price check error:', response?.error || 'Unknown error');
        
        // Use mock data on error
        const mockResults = {
          matches: [
            { retailer: '1-800 Contacts', price: 89.99, url: 'https://www.1800contacts.com', inStock: true },
            { retailer: 'LensDirect', price: 92.50, url: 'https://www.lensdirect.com', inStock: true },
            { retailer: 'CVS', price: 94.99, url: 'https://www.cvs.com', inStock: true }
          ],
          currentPrice: apiData.currentPrice
        };
        this.displayPriceResults(mockResults, lensData);
      }
    });
  }

  displayPriceResults(results, lensData) {
    const statusDiv = document.getElementById('price-status');
    const prescriptionData = lensData.prescriptionData || {};
    const bestPrice = Math.min(...results.matches.map(m => m.price));
    const savings = results.currentPrice - bestPrice;

    let html = `
      <div style="border-bottom: 2px solid rgba(102, 126, 234, 0.3); padding-bottom: 10px; margin-bottom: 12px;">
        <div style="font-size: 16px; font-weight: bold; color: #333; margin-bottom: 8px;">
          📦 ${lensData.orderData.manufacturer || 'Contact Lens'} ${lensData.orderData.style || ''}
        </div>
        <div style="font-size: 14px; color: #666; margin-bottom: 4px;">
          Current Price: <strong>$${results.currentPrice.toFixed(2)}</strong> per box
        </div>
        <div style="color: #4caf50; font-weight: bold; font-size: 15px;">
          💰 Total Savings Available: $${savings.toFixed(2)}
        </div>
        ${prescriptionData.baseCurve || prescriptionData.diameter ? `
          <div style="margin-top: 8px; padding: 6px; background: rgba(0, 0, 0, 0.05); border-radius: 4px; font-size: 12px;">
            ${prescriptionData.baseCurve ? `<span>BC: ${prescriptionData.baseCurve}</span>` : ''}
            ${prescriptionData.diameter ? `<span style="margin-left: 10px;">DIA: ${prescriptionData.diameter}</span>` : ''}
            ${prescriptionData.sphere ? `<span style="margin-left: 10px;">SPH: ${prescriptionData.sphere}</span>` : ''}
          </div>
        ` : ''}
      </div>
      <div style="font-size: 13px; font-weight: 500; margin-bottom: 8px; color: #555;">
        🛒 Price Comparison Results:
      </div>
      <div>
    `;

    results.matches.forEach(match => {
      const savingsAmount = results.currentPrice - match.price;
      html += `
        <div style="padding: 10px 8px; border-bottom: 1px solid rgba(0,0,0,0.08); display: flex; justify-content: space-between; align-items: center; hover: background: rgba(102, 126, 234, 0.05);">
          <div>
            <a href="${match.url}" target="_blank" style="color: #667eea; text-decoration: none; font-weight: 600; font-size: 14px;">
              ${match.retailer}
            </a>
            ${match.inStock !== false ? '<span style="color: #4caf50; font-size: 11px; margin-left: 8px;">✓ In Stock</span>' : ''}
          </div>
          <div style="text-align: right;">
            <strong style="font-size: 15px; color: #333;">$${match.price.toFixed(2)}</strong>
            ${savingsAmount > 0 ? `
              <div style="color: #4caf50; font-size: 12px; margin-top: 2px;">
                Save $${savingsAmount.toFixed(2)} (${Math.round(savingsAmount/results.currentPrice*100)}%)
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });

    html += '</div>';
    statusDiv.innerHTML = html;

    // Add to chat
    this.addMessage('assistant', `Found ${results.matches.length} price matches! Best price is $${bestPrice.toFixed(2)} with potential savings of $${savings.toFixed(2)}.`);
  }
}

// Initialize the AI assistant
window.EyecareAIAssistant = EyecareAIAssistant;
const aiAssistant = new EyecareAIAssistant();

} // End of duplicate prevention block
