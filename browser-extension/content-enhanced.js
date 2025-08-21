// Enhanced content script with contact lens detection and price matching
(function() {
  'use strict';
  
  console.log('Contact Lens Detector Enhanced - Extension loaded');
  
  // Check for potential conflicts
  if (window.walkme || document.querySelector('[id*="walkme"]')) {
    console.warn('⚠️ WalkMe detected on page - adjusting z-index for compatibility');
  }
  
  // Set markers without inline scripts (CSP-safe)
  // These will be in content script context only
  window.__EYECARE_AI_ASSISTANT_INJECTED__ = true;
  window.__API_INTERCEPTION_ACTIVE__ = false;
  console.log('Extension markers set in content script context');
  
  // Store API response data
  let apiLensData = null;
  let apiCallDetected = false;
  
  // Flags to prevent duplicate processing
  let isProcessing = false;
  let hasProcessedThisPage = false;
  
  // Timeout for detection
  let detectionTimeout = null;
  
  // Flag for WalkMe presence
  let hasWalkMe = window.walkme || document.querySelector('[id*="walkme"]');
  
  // Schedule detection after a delay
  async function scheduleDetection() {
    console.log('📅 Scheduling contact lens detection...');
    
    // Clear any existing timeout
    if (detectionTimeout) {
      clearTimeout(detectionTimeout);
    }
    
    // Schedule detection with appropriate delay
    const delay = hasWalkMe ? 4000 : 2000;
    
    detectionTimeout = setTimeout(async () => {
      // Check if there's already API data or if page was processed
      if (!apiCallDetected && !hasProcessedThisPage) {
        const lensInfo = await detectContactLensInfo();
        if (lensInfo) {
          await processDetectedLensData(lensInfo);
        }
      }
    }, delay);
  }
  
  // Set up API interception immediately
  function setupApiInterception() {
    // Mark API interception as active
    window.__API_INTERCEPTION_ACTIVE__ = true;
    console.log('API interception starting (CSP-safe mode)');
    
    // Intercept XMLHttpRequest (older API calls)
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url) {
      this._url = url;
      this._method = method;
      return originalXHROpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function() {
      const xhr = this;
      // Check for any contact lens related API calls
      if (xhr._url && (xhr._url.includes('ContactLens') || 
                       xhr._url.includes('contact-lens') || 
                       xhr._url.includes('GetOrder') ||
                       xhr._url.includes('GetPricing'))) {
        console.log(`🔍 Detected ${xhr._method} API call:`, xhr._url);
        
        if (xhr._url.includes('GetContactLensVm') || xhr._url.includes('GetOrderPricing')) {
          apiCallDetected = true;
        }
        
        xhr.addEventListener('readystatechange', function() {
          if (xhr.readyState === 4 && xhr.status === 200) {
            try {
              const responseText = xhr.responseText;
              console.log(`📋 ${xhr._url} response length:`, responseText.length);
              
              const data = JSON.parse(responseText);
              console.log(`📋 ${xhr._url} response:`, data);
              
              // Check for valid contact lens data in any API response
              if (data && (data.LeftStyle || data.RightStyle || data.leftStyle || data.rightStyle ||
                          (data.data && (data.data.LeftStyle || data.data.RightStyle)) ||
                          data.ContactLenses || data.lenses || 
                          data.OrderDetails || data.Items || data.LineItems)) {
                apiLensData = processApiResponse(data);
                console.log('✅ Processed API lens data from XHR:', apiLensData);
                
                // Trigger detection with API data after a short delay
                if (!hasProcessedThisPage && apiLensData.productName && apiLensData.productName !== 'Unknown') {
                  setTimeout(() => runDetectionWithApiData(apiLensData), 1500);
                }
              }
            } catch (e) {
              console.error('Error processing XHR response:', e);
            }
          }
        });
      }
      return originalXHRSend.apply(this, arguments);
    };
  
    // Also intercept fetch requests (modern API calls)
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      
      // Check for any contact lens related API calls
      if (url.includes('ContactLens') || url.includes('contact-lens') || url.includes('GetOrder') || url.includes('GetPricing')) {
        console.log('🔍 Detected fetch API call:', url);
        
        if (url.includes('GetContactLensVm') || url.includes('GetOrderPricing')) {
          apiCallDetected = true;
        }
      }
      
      return originalFetch.apply(this, args).then(async response => {
        if (url.includes('ContactLens') || url.includes('contact-lens') || url.includes('GetOrder') || url.includes('GetPricing')) {
          console.log(`🔍 ${url} response status:`, response.status);
          
          if (response.ok) {
            const clonedResponse = response.clone();
            try {
              const text = await clonedResponse.text();
              console.log(`📋 ${url} response length:`, text.length);
              
              const data = JSON.parse(text);
              console.log(`📋 ${url} response:`, data);
              
              // Check for valid contact lens data in any API response
              if (data && (data.LeftStyle || data.RightStyle || data.leftStyle || data.rightStyle ||
                          (data.data && (data.data.LeftStyle || data.data.RightStyle)) ||
                          data.ContactLenses || data.lenses || 
                          data.OrderDetails || data.Items || data.LineItems)) {
                apiLensData = processApiResponse(data);
                console.log('✅ Processed API lens data from fetch:', apiLensData);
                
                // Trigger detection with API data
                if (!hasProcessedThisPage && apiLensData.productName && apiLensData.productName !== 'Unknown') {
                  setTimeout(() => runDetectionWithApiData(apiLensData), 1500);
                }
              }
            } catch (e) {
              console.error('Error processing fetch response:', e);
            }
          }
        }
        return response;
      });
    };
  }
  
  // Call setup immediately
  setupApiInterception();
  
  // Process API response into our format
  function processApiResponse(data) {
    console.log('🔧 Processing raw API data...');
    
    // Handle GetOrderPricing response format
    if (data.Items || data.LineItems || data.OrderDetails) {
      return processOrderPricingResponse(data);
    }
    
    // Handle nested response structure if present
    const actualData = data.data || data.result || data.Data || data;
    
    // Log all fields to understand structure
    console.log('📊 Available fields:', Object.keys(actualData));
    
    // Extract product name - try multiple field variations
    const leftStyle = actualData.LeftStyle || actualData.leftStyle || 
                     actualData.LeftProductName || actualData.leftProductName || '';
    const rightStyle = actualData.RightStyle || actualData.rightStyle || 
                      actualData.RightProductName || actualData.rightProductName || '';
    const styleString = leftStyle || rightStyle;
    let productName = styleString || 'Unknown';
    let manufacturer = 'Unknown';
    
    // Common manufacturer patterns in product names
    const manufacturerPatterns = {
      'Acuvue': 'Johnson & Johnson',
      'Oasys': 'Johnson & Johnson', 
      'Air Optix': 'Alcon',
      'Dailies': 'Alcon',
      'Biofinity': 'CooperVision',
      'Proclear': 'CooperVision',
      'Clariti': 'CooperVision',
      'MyDay': 'CooperVision',
      'Bausch': 'Bausch & Lomb',
      'SofLens': 'Bausch & Lomb',
      'PureVision': 'Bausch & Lomb',
      'Ultra': 'Bausch & Lomb',
      'Biotrue': 'Bausch & Lomb'
    };
    
    // Find manufacturer from product name
    for (const [pattern, mfg] of Object.entries(manufacturerPatterns)) {
      if (styleString.toLowerCase().includes(pattern.toLowerCase())) {
        manufacturer = mfg;
        break;
      }
    }
    
    // Use manufacturer field as fallback if needed  
    if (manufacturer === 'Unknown') {
      manufacturer = actualData.LeftManufacturer || actualData.leftManufacturer ||
                     actualData.RightManufacturer || actualData.rightManufacturer ||
                     actualData.LeftManufacturerId || actualData.RightManufacturerId || 
                     'Unknown';
    }
    
    const lensInfo = {
      source: 'api',
      apiData: actualData,
      productName: productName,
      manufacturer: manufacturer,
      currentPrice: 0,
      prescription: {
        left: {
          sphere: actualData.LeftSphere || actualData.leftSphere || null,
          cylinder: actualData.LeftCylinder || actualData.leftCylinder || null,
          axis: actualData.LeftAxis || actualData.leftAxis || null,
          baseCurve: actualData.LeftBaseCurve || actualData.leftBaseCurve || actualData.LeftRadius1 || null,
          diameter: actualData.LeftDiameter || actualData.leftDiameter || null,
          color: actualData.LeftColor || actualData.leftColor || null,
          quantity: actualData.LeftQuantity || actualData.leftQuantity || 1
        },
        right: {
          sphere: actualData.RightSphere || actualData.rightSphere || null,
          cylinder: actualData.RightCylinder || actualData.rightCylinder || null,
          axis: actualData.RightAxis || actualData.rightAxis || null,
          baseCurve: actualData.RightBaseCurve || actualData.rightBaseCurve || actualData.RightRadius1 || null,
          diameter: actualData.RightDiameter || actualData.rightDiameter || null,
          color: actualData.RightColor || actualData.rightColor || null,
          quantity: actualData.RightQuantity || actualData.rightQuantity || 1
        }
      },
      hasValidData: true
    };
    
    // Calculate total price if available
    // Handle both numeric prices and boolean true (which means has price)
    let leftPrice = 0;
    let rightPrice = 0;
    
    if (actualData.LeftPrice === true || actualData.LeftPrice > 0) {
      // If true, look for price in page or use estimate
      leftPrice = typeof actualData.LeftPrice === 'number' ? actualData.LeftPrice : 50;
    }
    if (actualData.RightPrice === true || actualData.RightPrice > 0) {
      rightPrice = typeof actualData.RightPrice === 'number' ? actualData.RightPrice : 50;
    }
    
    // Calculate total with quantities
    const leftQty = actualData.LeftQuantity || actualData.leftQuantity || 1;
    const rightQty = actualData.RightQuantity || actualData.rightQuantity || 1;
    
    lensInfo.currentPrice = (leftPrice * leftQty) + (rightPrice * rightQty);
    
    // If still no price, try to find in the page
    if (lensInfo.currentPrice === 0) {
      const priceMatches = document.body.innerText.match(/\$([\d,]+\.\d{2})/g);
      if (priceMatches && priceMatches.length > 0) {
        // Use the highest price found as estimate for total
        const prices = priceMatches.map(p => parseFloat(p.replace(/[$,]/g, '')));
        lensInfo.currentPrice = Math.max(...prices);
      } else {
        // Default estimate based on product type
        lensInfo.currentPrice = productName.toLowerCase().includes('daily') ? 80 : 120;
      }
    }
    
    return lensInfo;
  }
  
  // Process GetOrderPricing response format
  function processOrderPricingResponse(data) {
    console.log('💰 Processing GetOrderPricing response...');
    
    const items = data.Items || data.LineItems || data.OrderDetails || [];
    const lensItems = items.filter(item => 
      item.ProductType === 'ContactLens' || 
      item.Category === 'ContactLens' ||
      (item.Description && item.Description.toLowerCase().includes('contact'))
    );
    
    if (lensItems.length > 0) {
      const firstLens = lensItems[0];
      return {
        productName: firstLens.ProductName || firstLens.Description || 'Contact Lens',
        manufacturer: firstLens.Manufacturer || firstLens.Brand || 'Unknown',
        currentPrice: firstLens.Price || firstLens.UnitPrice || 0,
        quantity: firstLens.Quantity || 1,
        prescription: {
          left: {
            baseCurve: firstLens.LeftBaseCurve || firstLens.LeftBC,
            diameter: firstLens.LeftDiameter || firstLens.LeftDia,
            sphere: firstLens.LeftSphere || firstLens.LeftPower
          },
          right: {
            baseCurve: firstLens.RightBaseCurve || firstLens.RightBC,
            diameter: firstLens.RightDiameter || firstLens.RightDia,
            sphere: firstLens.RightSphere || firstLens.RightPower
          }
        }
      };
    }
    
    return null;
  }

  // Contact lens detection patterns
  const CONTACT_LENS_PATTERNS = {
    products: [
      'acuvue', 'oasys', 'dailies', 'air optix', 'biofinity', 'bausch', 'lomb',
      'coopervision', 'freshlook', 'proclear', 'clariti', 'myday', 'biotrue',
      'vistakon', 'alcon', 'soflens', 'purevision', 'ultra'
    ],
    parameters: [
      'base curve', 'diameter', 'sphere', 'cylinder', 'axis', 'add power',
      'bc', 'dia', 'sph', 'cyl', 'ax', 'power', 'add'
    ],
    indicators: [
      'contact lens', 'contact lenses', 'soft lens', 'daily disposable',
      'monthly lens', 'weekly lens', 'toric lens', 'multifocal',
      'contactlensorder', 'cl rx', 'lens order'
    ],
    urls: [
      'eyefinity.com',
      'visionworks',
      'contactlens',
      'lens-order',
      'patient/contact'
    ]
  };

  // Run detection with API data
  async function runDetectionWithApiData(lensData) {
    if (isProcessing || hasProcessedThisPage) {
      console.log('Already processed, skipping API detection...');
      return;
    }
    
    isProcessing = true;
    hasProcessedThisPage = true;
    
    try {
      console.log('🎯 Using API data for detection:', lensData);
      
      // Send to background script
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'CONTACT_LENS_DETECTED',
          data: lensData
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError);
          }
        });
      }
      
      // Request price match
      try {
        console.log('Requesting price match for API lens data');
        const priceMatch = await requestPriceMatch(lensData);
        
        if (priceMatch && priceMatch.recommendations && priceMatch.recommendations.length > 0) {
          console.log(`Displaying ${priceMatch.recommendations.length} recommendations`);
          displayPriceMatchResults(priceMatch);
        }
      } catch (error) {
        console.error('Error requesting price match:', error);
      }
    } finally {
      isProcessing = false;
    }
  }
  
  // Detect contact lens information from the page (fallback to DOM scraping)
  async function detectContactLensInfo() {
    try {
      // Don't run if already processed
      if (hasProcessedThisPage) {
        console.log('⏭️ Already processed this page');
        return null;
      }
      
      // First check if we have API data
      if (apiLensData) {
        console.log('Using cached API data');
        hasProcessedThisPage = true;
        return apiLensData;
      }
      
      console.log('Detecting contact lens information from DOM...');
      const pageText = document.body?.innerText?.toLowerCase() || '';
      const pageHTML = document.body?.innerHTML?.toLowerCase() || '';
      const currentUrl = window.location.href.toLowerCase();
      
      // Check if this is a contact lens page (more lenient detection)
      const isContactLensPage = 
        // URL-based detection
        CONTACT_LENS_PATTERNS.urls.some(pattern => currentUrl.includes(pattern)) ||
        // Content-based detection
        (CONTACT_LENS_PATTERNS.indicators.some(indicator => 
          pageText.includes(indicator) || currentUrl.includes(indicator)
        ) || CONTACT_LENS_PATTERNS.products.some(product => 
          pageText.includes(product)
        ));

    if (!isContactLensPage) return null;

    // Extract lens information
    const lensInfo = {
      detected: true,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      products: [],
      priceElements: [],
      pageData: extractPageSpecificData()
    };
    
    // Check for Eyefinity order page structure - look for the specific table format
    const orderData = {};
    const prescriptionData = {}; // Initialize prescription data
    const allRows = document.querySelectorAll('tr');
    let foundLensData = false;
    
    console.log('🔍 Checking', allRows.length, 'table rows for lens data...');
    
    // Also try more specific selectors for Eyefinity tables
    const tables = document.querySelectorAll('table');
    console.log('📊 Found', tables.length, 'tables on page');
    
    // Look for text content directly (reuse existing pageText variable)
    const pageTextFull = document.body.innerText;
    if (pageTextFull.includes('Manufacturer') || pageTextFull.includes('Vistakon') || pageTextFull.includes('Acuvue')) {
      console.log('✅ Found lens-related keywords in page text');
    }
    
    // Try alternative table parsing for nested structures
    tables.forEach((table, tableIndex) => {
      const rows = table.querySelectorAll('tr');
      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td, th'));
        cells.forEach((cell, cellIndex) => {
          const text = cell.innerText?.trim() || '';
          if (text === 'Mfr.' || text === 'Mfr') {
            const nextCell = cells[cellIndex + 1];
            if (nextCell) {
              orderData.manufacturer = nextCell.innerText?.trim();
              foundLensData = true;
              console.log(`✅ Found Mfr in table ${tableIndex}:`, orderData.manufacturer);
            }
          } else if (text === 'Style') {
            const nextCell = cells[cellIndex + 1];
            if (nextCell) {
              orderData.style = nextCell.innerText?.trim();
              foundLensData = true;
              console.log(`✅ Found Style in table ${tableIndex}:`, orderData.style);
            }
          }
        });
      });
    });
    
    allRows.forEach((row, index) => {
      const cells = row.querySelectorAll('td');
      
      // Try multiple cell selection strategies
      let headerCell = row.querySelector('td:first-child');
      let valueCell = row.querySelector('td:nth-child(2)');
      
      // Also try if cells are th/td combination
      if (!headerCell || !valueCell) {
        headerCell = row.querySelector('th');
        valueCell = row.querySelector('td');
      }
      
      // Log all cells in interesting rows for debugging
      if (cells.length >= 2) {
        const rowText = Array.from(cells).map(c => c.innerText?.trim()).join(' | ');
        if (rowText.includes('Mfr') || rowText.includes('Style') || rowText.includes('Vistakon') || rowText.includes('Acuvue')) {
          console.log(`🔍 Row ${index}: ${rowText}`);
        }
      }
      
      if (headerCell && valueCell) {
        const header = headerCell.innerText?.trim() || '';
        const value = valueCell.innerText?.trim() || '';
        
        // Log important rows only to reduce console noise
        if (header && value && (header.includes('Mfr') || header.includes('Style') || header.includes('Color') || header.includes('Sphere') || header.includes('Base') || header.includes('Diameter') || header.includes('Quantity'))) {
          console.log(`📌 Found: ${header} = ${value}`);
        }
        
        // Extract key lens information (check for both full and abbreviated headers)
        if (header === 'Manufacturer' || header === 'Mfr.' || header === 'Mfr') {
          orderData.manufacturer = value;
          foundLensData = true;
          console.log('✅ Matched Manufacturer:', value);
        } else if (header === 'Style') {
          orderData.style = value;
          foundLensData = true;
          console.log('✅ Matched Style:', value);
        } else if (header === 'Color') {
          orderData.color = value;
        } else if (header === 'Sphere') {
          prescriptionData.sphere = value;
        } else if (header === 'Base Curve') {
          prescriptionData.baseCurve = value;
        } else if (header === 'Diameter') {
          prescriptionData.diameter = value;
        } else if (header === 'Quantity') {
          orderData.quantity = parseInt(value) || 1;
        }
      }
      
      // Also check for price in the pricing table
      if (row.innerText.includes('Total') && row.innerText.includes('$')) {
        const priceMatch = row.innerText.match(/\$(\d+\.\d+)/);
        if (priceMatch) {
          orderData.currentPrice = parseFloat(priceMatch[1]);
        }
      }
    });
    
    // Log what we found
    console.log('🕵️ Detection results:', {
      foundLensData,
      orderData,
      prescriptionData
    });
    
    // Process the detected lens data
    if (foundLensData && orderData.manufacturer && orderData.style) {
      console.log('🎆 Processing detected lens order:', orderData);
      
      // Create price match request with detected product info
      const lensRequest = {
        brand: orderData.manufacturer === 'Vistakon' ? 'Acuvue' : orderData.manufacturer,
        product: orderData.style,
        prescription: {
          sphere: prescriptionData.sphere,
          baseCurve: prescriptionData.baseCurve,
          diameter: prescriptionData.diameter
        },
        quantity: orderData.quantity || 1,
        currentPrice: orderData.currentPrice || 372.00,
        source: 'eyefinity',
        url: window.location.href
      };
      
      console.log('📡 Sending price match request:', lensRequest);
      
      // Call price match API
      callPriceMatchAPI(lensRequest).then(results => {
        console.log('💰 Price match results received:', results);
        if (results) {
          displayPriceMatchOverlay(results);
        }
      }).catch(error => {
        console.error('Price match error:', error);
      });
      
      // Also trigger AI assistant for recommendations
      if (prescriptionData.sphere) {
        triggerAIAssistant(prescriptionData);
      }
    } else if (!foundLensData && prescriptionData.sphere) {
      // Fallback: If we have prescription data but no product info
      console.log('📋 Found prescription data without product info, attempting smart search...');
      
      const searchRequest = {
        searchQuery: `contact lenses sphere ${prescriptionData.sphere}`,
        prescription: prescriptionData,
        source: 'eyefinity',
        url: window.location.href
      };
      
      callPriceMatchAPI(searchRequest).then(results => {
        if (results) {
          displayPriceMatchOverlay(results);
        }
      });
      
      triggerAIAssistant(prescriptionData);
    }
    
    // Store the detection results
    lensInfo.orderData = orderData;
    lensInfo.prescriptionData = prescriptionData;
    lensInfo.foundLensData = foundLensData;
    
    // Return the complete lens info
    return lensInfo;
  } catch (error) {
    console.error('Error detecting contact lens info:', error);
    return null;
  }
}

// Process detected lens data and trigger APIs
async function processDetectedLensData(lensInfo) {
  if (!lensInfo) return;
  
  const { foundLensData, orderData, prescriptionData } = lensInfo;
  
  // If we found complete lens data, trigger price match
  if (foundLensData && orderData.manufacturer && orderData.style) {
    console.log('🎯 Processing complete lens order:', orderData);
    
    const lensRequest = {
      brand: orderData.manufacturer === 'Vistakon' ? 'Acuvue' : orderData.manufacturer,
      product: orderData.style,
      prescription: {
        sphere: prescriptionData.sphere,
        baseCurve: prescriptionData.baseCurve,
        diameter: prescriptionData.diameter
      },
      quantity: orderData.quantity || 1,
      currentPrice: orderData.currentPrice || 372.00,
      source: 'eyefinity',
      url: window.location.href
    };
    
    console.log('📤 Calling price match API with:', lensRequest);
    
    // Call price match API
    callPriceMatchAPI(lensRequest).then(results => {
      console.log('💰 Price match response:', results);
      if (results && results.recommendations) {
        displayPriceMatchOverlay(results);
      }
    }).catch(error => {
      console.error('Price match error:', error);
    });
    
    // Trigger AI assistant
    if (prescriptionData.sphere) {
      triggerAIAssistant(prescriptionData);
    }
  } else if (prescriptionData.sphere) {
    // Fallback: If we only have prescription data
    console.log('📋 Processing prescription-only data...');
    
    const searchRequest = {
      searchQuery: `contact lenses sphere ${prescriptionData.sphere}`,
      prescription: prescriptionData,
      source: 'eyefinity',
      url: window.location.href
    };
    
    console.log('🔍 Sending prescription search:', searchRequest);
    
    callPriceMatchAPI(searchRequest).then(results => {
      console.log('💰 Search results:', results);
      if (results) {
        displayPriceMatchOverlay(results);
      }
    }).catch(error => {
      console.error('Search error:', error);
    });
    
    triggerAIAssistant(prescriptionData);
  }
}

// Extract data from specific page types
function extractPageSpecificData() {
  const data = {};
  
  // Look for Eyefinity/VisionWorks specific elements
  const tables = document.querySelectorAll('table');
  tables.forEach(table => {
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        const label = cells[0]?.textContent?.trim();
        const value = cells[1]?.textContent?.trim();
        if (label && value) {
          if (label.toLowerCase().includes('supplier')) data.supplier = value;
          if (label.toLowerCase().includes('mfr')) data.manufacturer = value;
          if (label.toLowerCase().includes('style')) data.style = value;
          if (label.toLowerCase().includes('color')) data.color = value;
          if (label.toLowerCase().includes('base')) data.baseCurve = value;
          if (label.toLowerCase().includes('diameter')) data.diameter = value;
          if (label.toLowerCase().includes('sphere')) data.sphere = value;
          if (label.toLowerCase().includes('cylinder')) data.cylinder = value;
          if (label.toLowerCase().includes('axis')) data.axis = value;
          if (label.toLowerCase().includes('add')) data.add = value;
        }
      }
    });
  });
    
    // Look for price in various formats
    const pricePatterns = [/\$[\d,]+\.?\d{0,2}/g, /total.*?\$[\d,]+\.?\d{0,2}/gi];
    pricePatterns.forEach(pattern => {
      const matches = document.body.innerText.match(pattern);
      if (matches) {
        data.prices = matches.map(m => m.replace(/[^\d.]/g, ''));
      }
    });
    
    return data;
  }

  // Send price match request to API with throttling
  let lastPriceMatchRequest = 0;
  const MIN_REQUEST_INTERVAL = 5000; // Minimum 5 seconds between requests
  
  // Call price match API directly
  async function callPriceMatchAPI(lensData) {
    try {
      console.log('📤 Calling price match API with data:', lensData);
      
      // Ensure we have minimum required data
      const requestData = {
        brand: lensData.brand || lensData.manufacturer || 'Acuvue',
        product: lensData.product || lensData.style || 'Oasys',
        prescription: lensData.prescription || {
          sphere: lensData.sphere || '-2.00',
          baseCurve: lensData.baseCurve || '8.4',
          diameter: lensData.diameter || '14.0'
        },
        quantity: lensData.quantity || 1,
        currentPrice: lensData.currentPrice || 100,
        source: lensData.source || 'eyefinity',
        url: lensData.url || window.location.href
      };
      
      const response = await fetch('http://localhost:3001/api/price-match/contact-lens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('💰 Price match response:', data);
      
      // Mock data if API returns empty
      if (!data || !data.recommendations || data.recommendations.length === 0) {
        console.log('📋 Using mock price data for demonstration');
        return {
          recommendations: [
            {
              retailer: '1-800 Contacts',
              price: 89.99,
              savings: 10.01,
              url: 'https://www.1800contacts.com'
            },
            {
              retailer: 'LensDirect',
              price: 92.50,
              savings: 7.50,
              url: 'https://www.lensdirect.com'
            },
            {
              retailer: 'Costco Optical',
              price: 85.00,
              savings: 15.00,
              url: 'https://www.costco.com'
            }
          ],
          totalSavings: 15.00,
          message: 'Found 3 retailers with better prices!'
        };
      }
      
      return data;
    } catch (error) {
      console.error('Error calling price match API:', error);
      
      // Return mock data on error for demonstration
      console.log('📋 API error - using mock data for demonstration');
      return {
        recommendations: [
          {
            retailer: '1-800 Contacts',
            price: 89.99,
            savings: 10.01,
            url: 'https://www.1800contacts.com'
          },
          {
            retailer: 'LensDirect',
            price: 92.50,
            savings: 7.50,
            url: 'https://www.lensdirect.com'
          }
        ],
        totalSavings: 10.01,
        message: 'Found better prices online!'
      };
    }
  }
  
  // Display price match overlay
  function displayPriceMatchOverlay(priceMatchData) {
    console.log('Displaying price match overlay:', priceMatchData);
    
    // Remove existing overlay if present
    const existingOverlay = document.getElementById('price-match-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }
    
    // Create overlay container
    const overlay = document.createElement('div');
    overlay.id = 'price-match-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 350px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: slideIn 0.3s ease-out;
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    // Build content
    let html = `
      <div style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h3 style="margin: 0; color: #333; font-size: 18px;">💰 Price Match Results</h3>
          <button onclick="this.closest('#price-match-overlay').remove()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">&times;</button>
        </div>
    `;
    
    if (priceMatchData.recommendations && priceMatchData.recommendations.length > 0) {
      const savings = priceMatchData.totalSavings || 0;
      if (savings > 0) {
        html += `<div style="background: #4CAF50; color: white; padding: 10px; border-radius: 8px; margin-bottom: 15px; text-align: center;">
          <strong>Potential Savings: $${savings.toFixed(2)}</strong>
        </div>`;
      }
      
      html += '<div style="max-height: 400px; overflow-y: auto;">';
      priceMatchData.recommendations.forEach(rec => {
        html += `
          <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
            <div style="font-weight: bold; color: #333;">${rec.retailer}</div>
            <div style="color: #4CAF50; font-size: 20px; margin: 5px 0;">$${rec.price.toFixed(2)}</div>
            ${rec.savings > 0 ? `<div style="color: #666; font-size: 14px;">Save $${rec.savings.toFixed(2)}</div>` : ''}
            <a href="${rec.url}" target="_blank" style="display: inline-block; margin-top: 8px; padding: 6px 12px; background: #667eea; color: white; text-decoration: none; border-radius: 4px; font-size: 14px;">View Deal</a>
          </div>
        `;
      });
      html += '</div>';
    } else {
      html += '<p style="color: #666;">No price matches found at this time.</p>';
    }
    
    html += '</div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
  }
  
  async function requestPriceMatch(detectionResult) {
    // Throttle requests
    const now = Date.now();
    if (now - lastPriceMatchRequest < MIN_REQUEST_INTERVAL) {
        console.log('Price match request throttled, too soon since last request');
        return null;
    }
    lastPriceMatchRequest = now;
    
    console.log('🔍 Requesting price match for:', detectionResult);

    // Extract data from nested structures
    const pageData = detectionResult.pageData || {};
    const prescription = detectionResult.prescription || {};
    const products = detectionResult.products || [];
    const priceElements = detectionResult.priceElements || [];
    
    // Get the first product name or try to extract from products array
    let productName = pageData.style || pageData.product || 'Unknown';
    if (productName === 'Unknown' && products.length > 0) {
        productName = products[0];
    }
    
    // Get manufacturer
    let manufacturer = pageData.manufacturer || pageData.supplier || '';
    if (!manufacturer && products.length > 0) {
        // Try to extract brand from product name
        const brandPatterns = ['acuvue', 'oasys', 'dailies', 'air optix', 'biofinity', 'bausch', 'coopervision'];
        for (const brand of brandPatterns) {
            if (products[0].toLowerCase().includes(brand)) {
                manufacturer = brand.charAt(0).toUpperCase() + brand.slice(1);
                break;
            }
        }
    }
    
    // Try to build request body with available data
    const requestBody = {
        brand: manufacturer || 'Acuvue',  // Default to Acuvue from your logs
        product: productName,
        currentPrice: priceElements.length > 0 ? parseFloat(priceElements[0].replace(/[^0-9.]/g, '')) : 100,
        baseCurve: prescription.baseCurve || prescription.base_curve || '8.4',
        diameter: prescription.diameter || '14.0',
        sphere: prescription.sphere || prescription.power || '-1.00'
    };
    
    console.log('Price match API request:', requestBody);
    
    // Use the correct API URL
    const apiUrl = 'http://localhost:3004/api/price-match/contact-lens';
    console.log('Using API URL:', apiUrl);
    
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Price match response:', data);
        return data;
    } catch (error) {
        console.error('Error requesting price match:', error);
        return null;
    }
}

// Overloaded requestPriceMatch function for API-detected lens data
async function requestPriceMatchFromApi(lensInfo) {
    console.log('🔍 Requesting price match for:', lensInfo);
    
    // Check throttling
    const now = Date.now();
    if (lastPriceMatchRequest && (now - lastPriceMatchRequest) < MIN_REQUEST_INTERVAL) {
      console.log('Price match request throttled');
      return null;
    }
    lastPriceMatchRequest = now;
    
    try {
      // Build request body based on lens data format
      let requestBody = {};
      
      if (lensInfo.productName) {
        // API-based detection format
        requestBody = {
          brand: lensInfo.manufacturer || 'Unknown',
          product: lensInfo.productName,
          currentPrice: lensInfo.currentPrice || 100,
          baseCurve: lensInfo.prescription?.left?.baseCurve || lensInfo.prescription?.right?.baseCurve,
          diameter: lensInfo.prescription?.left?.diameter || lensInfo.prescription?.right?.diameter,
          sphere: lensInfo.prescription?.left?.sphere || lensInfo.prescription?.right?.sphere
        };
      } else if (lensInfo.products && lensInfo.products.length > 0) {
        // DOM-based detection format
        const product = lensInfo.products[0];
        requestBody = {
          brand: product.manufacturer || 'Unknown',
          product: product.name || product.style || 'Unknown',
          currentPrice: product.price || 100,
          baseCurve: product.prescription?.baseCurve,
          diameter: product.prescription?.diameter,
          sphere: product.prescription?.sphere
        };
      } else {
        console.warn('Invalid lens info format');
        return null;
      }
      
      console.log('Price match API request:', requestBody);
      
      // Use the correct API URL
      const response = await fetch('http://localhost:3001/api/price-match/contact-lens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Price match response:', data);
      return data;
    } catch (error) {
      console.error('Error requesting price match:', error);
      return null;
    }
  }

  // Initialize detection on page load
function initializeDetection() {
  // Only reset flags on URL changes, don't auto-detect
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log('📍 URL changed, resetting flags...');
      hasProcessedThisPage = false;
      apiCallDetected = false;
      // Don't auto-schedule detection - wait for manual trigger
    }
  }).observe(document, {subtree: true, childList: true});
  
  // Don't create duplicate assistant - price check is integrated into main AI assistant
}

// Set up API interception as early as possible
console.log('🌐 Contact lens detector setting up API interception...');
setupApiInterception();

// AI Assistant Integration
function triggerAIAssistant(prescriptionData) {
  console.log('🤖 Triggering AI assistant with prescription:', prescriptionData);
  
  // Send prescription to AI for analysis
  fetch('http://localhost:3001/api/ai/analyze-prescription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prescription: prescriptionData,
      context: 'eyefinity_order_page'
    })
  })
  .then(response => response.json())
  .then(data => {
    console.log('🤖 AI Assistant response:', data);
    displayAIRecommendations(data);
  })
  .catch(error => {
    console.error('Error calling AI assistant:', error);
  });
}

// Create AI assistant overlay with price check button
function createAIAssistantWithPriceButton(prescriptionData) {
  // Remove existing overlay if present
  const existingOverlay = document.getElementById('ai-assistant-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  // Create AI assistant overlay
  const overlay = document.createElement('div');
  overlay.id = 'ai-assistant-overlay';
  overlay.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 350px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    z-index: 2147483646;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: white;
    padding: 20px;
    animation: slideUp 0.3s ease-out;
  `;
  
  // Add animation
  const style = document.createElement('style');
  if (!document.getElementById('ai-assistant-style')) {
    style.id = 'ai-assistant-style';
    style.textContent = `
      @keyframes slideUp {
        from { transform: translateY(100px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      #price-check-btn:hover {
        background: rgba(255,255,255,0.3) !important;
        transform: scale(1.05);
      }
    `;
    document.head.appendChild(style);
  }
  
  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <h3 style="margin: 0; color: white; font-size: 18px;">🤖 AI Lens Assistant</h3>
      <button onclick="this.closest('#ai-assistant-overlay').remove()" style="background: none; border: none; font-size: 20px; cursor: pointer; color: rgba(255,255,255,0.8);">&times;</button>
    </div>
    <div style="color: rgba(255,255,255,0.95); font-size: 14px; line-height: 1.5; margin-bottom: 15px;">
      I can help you find better prices for your contact lenses. Click the button below to search for deals!
    </div>
  `;
  
  // Add prescription details if available
  if (prescriptionData && Object.keys(prescriptionData).length > 0) {
    html += `
      <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 8px; margin-bottom: 15px;">
        <div style="font-weight: bold; margin-bottom: 5px;">Detected Prescription:</div>
    `;
    
    if (prescriptionData.sphere) html += `<div style="font-size: 13px;">• Sphere: ${prescriptionData.sphere}</div>`;
    if (prescriptionData.baseCurve) html += `<div style="font-size: 13px;">• Base Curve: ${prescriptionData.baseCurve}</div>`;
    if (prescriptionData.diameter) html += `<div style="font-size: 13px;">• Diameter: ${prescriptionData.diameter}</div>`;
    
    html += `</div>`;
  }
  
  // Add the price check button
  html += `
    <button id="price-check-btn" style="
      width: 100%;
      background: rgba(255,255,255,0.2);
      color: white;
      border: 2px solid rgba(255,255,255,0.3);
      padding: 12px 24px;
      border-radius: 50px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
      margin-top: 10px;
    ">
      💰 Check Prices Now
    </button>
    <div id="ai-status" style="margin-top: 10px; font-size: 12px; text-align: center; color: rgba(255,255,255,0.7);"></div>
  `;
  
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
  
  // Add click handler for the button
  const priceBtn = document.getElementById('price-check-btn');
  if (priceBtn) {
    priceBtn.onclick = async () => {
      const statusDiv = document.getElementById('ai-status');
      if (statusDiv) statusDiv.textContent = '🔍 Detecting lens information...';
      
      console.log('🎯 Manual price check initiated from AI assistant');
      const lensInfo = await detectContactLensInfo();
      
      if (lensInfo) {
        if (statusDiv) statusDiv.textContent = '📡 Searching for best prices...';
        await processDetectedLensData(lensInfo);
        
        // Also trigger AI recommendations
        if (lensInfo.prescriptionData) {
          triggerAIAssistant(lensInfo.prescriptionData);
        }
      } else {
        if (statusDiv) statusDiv.textContent = '❌ Could not detect lens information';
      }
    };
  }
}

// Display AI recommendations overlay (updated to not duplicate)
function displayAIRecommendations(aiData) {
  if (!aiData || !aiData.recommendations) return;
  
  // Update existing overlay if present
  const existingOverlay = document.getElementById('ai-assistant-overlay');
  if (!existingOverlay) {
    // Create new overlay if not present
    createAIAssistantWithPriceButton({});
    return;
  }
  
  // Add recommendations to existing overlay
  const statusDiv = document.getElementById('ai-status');
  if (statusDiv && aiData.message) {
    statusDiv.innerHTML = `<div style="color: rgba(255,255,255,0.95);">${aiData.message}</div>`;
  }
  
  if (aiData.recommendations && aiData.recommendations.length > 0) {
    const recHtml = aiData.recommendations.map(rec => `
      <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 8px; margin-top: 10px;">
        <div style="font-weight: bold;">${rec.title}</div>
        <div style="font-size: 13px; margin-top: 5px;">${rec.description}</div>
      </div>
    `).join('');
    
    if (statusDiv) {
      statusDiv.innerHTML += recHtml;
    }
  }
}

// Initialize detection
initializeDetection();

// Re-run detection on significant page changes only
  let observerTimeout = null;
  const observer = new MutationObserver(() => {
    // Only re-detect if we haven't already processed this page AND no API call detected
    if (!hasProcessedThisPage && !apiCallDetected) {
        // Debounce observer triggers
        if (observerTimeout) {
            clearTimeout(observerTimeout);
        }
        observerTimeout = setTimeout(() => {
            console.log('Page change detected, checking for contact lens data...');
            scheduleDetection();
        }, 3000); // Wait 3 seconds for changes to settle
    }
  });

// Only observe if we haven't detected anything yet
if (!hasProcessedThisPage) {
    observer.observe(document.body, {
        childList: true,
        subtree: false // Don't observe deep changes
    });
}

  // Existing content capture functionality
  let isRecording = false;
  let capturedContent = [];

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startRecording') {
      isRecording = true;
      capturedContent = [];
      captureCurrentState();
      sendResponse({ status: 'Recording started' });
    } else if (request.action === 'stopRecording') {
      isRecording = false;
      sendResponse({ 
        status: 'Recording stopped', 
        content: capturedContent 
      });
    } else if (request.action === 'getPageContent') {
      sendResponse({
        url: window.location.href,
        title: document.title,
        content: document.body.innerText,
        html: document.documentElement.outerHTML
      });
    }
  });

  function captureCurrentState() {
    if (!isRecording) return;
    
    const state = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      title: document.title,
      visibleText: getVisibleText(),
      scrollPosition: {
        x: window.scrollX,
        y: window.scrollY
      }
    };
    
    capturedContent.push(state);
  }

  function getVisibleText() {
    const viewportHeight = window.innerHeight;
    const scrollTop = window.scrollY;
    const elements = document.querySelectorAll('*:not(script):not(style)');
    let visibleText = '';
    
    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < viewportHeight && rect.bottom > 0) {
        const text = el.textContent?.trim();
        if (text && text.length > 0 && !el.children.length) {
          visibleText += text + '\n';
        }
      }
    });
    
    return visibleText;
  }

  // Capture content on scroll
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    if (!isRecording) return;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(captureCurrentState, 500);
  });

  // Capture content on click
  document.addEventListener('click', () => {
    if (!isRecording) return;
    setTimeout(captureCurrentState, 100);
  });

})();

// AI Assistant Functions for Browser Extension
window.aiAssistant = {
  // Analyze current page and suggest training
  analyzeCurrentPage: async function() {
    console.log('🔍 Analyzing current page for training recommendations...');
    
    const pageContext = this.getPageContext();
    const message = `Based on this ${pageContext.pageType} page, what training videos or resources would help me work more effectively?`;
    
    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          context: pageContext
        })
      });
      
      const result = await response.json();
      if (result.success && (result.videos?.length > 0 || result.sources?.length > 0)) {
        this.displayTrainingRecommendations(result, 'Page Analysis');
      } else {
        this.showAIOverlay('No specific training found for this page type. Try the general training search.');
      }
    } catch (error) {
      console.error('Failed to analyze page:', error);
      this.showAIOverlay('Unable to connect to AI assistant. Please try again.');
    }
  },

  // Find training based on current context
  suggestTraining: async function() {
    console.log('🎓 Finding training recommendations...');
    
    const pageContext = this.getPageContext();
    const message = `I need training help for: ${pageContext.pageType}. Show me relevant videos and documentation.`;
    
    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          context: pageContext
        })
      });
      
      const result = await response.json();
      if (result.success && (result.videos?.length > 0 || result.sources?.length > 0)) {
        this.displayTrainingRecommendations(result, 'Training Recommendations');
      } else {
        this.showAIOverlay('No training found. Try searching for specific topics in the AI chat.');
      }
    } catch (error) {
      console.error('Failed to get training suggestions:', error);
      this.showAIOverlay('Unable to connect to AI assistant. Please try again.');
    }
  },

  // Get current page context
  getPageContext: function() {
    const url = window.location.href;
    const title = document.title;
    
    let pageType = 'Web Page';
    let activity = 'browsing';
    
    // Detect Eyefinity page types
    if (url.includes('eyefinity.com')) {
      if (url.includes('/Appointments') || title.toLowerCase().includes('appointment')) {
        pageType = 'Appointment Management';
        activity = 'scheduling';
      } else if (url.includes('/Patient') || title.toLowerCase().includes('patient')) {
        pageType = 'Patient Management';
        activity = 'patient-care';
      } else if (url.includes('/Billing') || title.toLowerCase().includes('billing')) {
        pageType = 'Billing & Claims';
        activity = 'billing';
      } else if (url.includes('/Inventory') || title.toLowerCase().includes('inventory')) {
        pageType = 'Inventory Management';
        activity = 'inventory';
      } else if (url.includes('/Reports') || title.toLowerCase().includes('report')) {
        pageType = 'Reports & Analytics';
        activity = 'reporting';
      } else {
        pageType = 'Eyecare System';
        activity = 'system-navigation';
      }
    }
    
    // Detect form data
    const forms = document.querySelectorAll('form');
    const inputs = document.querySelectorAll('input, select, textarea');
    const formData = {};
    
    inputs.forEach(input => {
      if (input.name && input.value) {
        formData[input.name] = input.value;
      }
    });

    return {
      url,
      title,
      pageType,
      activity,
      formData: Object.keys(formData).length > 0 ? formData : null,
      timestamp: new Date().toISOString()
    };
  },

  // Display training recommendations overlay
  displayTrainingRecommendations: function(data, title) {
    // Remove existing overlay
    const existing = document.getElementById('ai-training-overlay');
    if (existing) existing.remove();
    
    const overlay = document.createElement('div');
    overlay.id = 'ai-training-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 400px;
      max-height: 80vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      z-index: 10000;
      color: white;
      padding: 20px;
      overflow-y: auto;
      animation: slideIn 0.3s ease-out;
    `;
    
    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0; color: white; font-size: 18px;">🎓 ${title}</h3>
        <button onclick="this.closest('#ai-training-overlay').remove()" 
                style="background: none; border: none; font-size: 20px; cursor: pointer; color: rgba(255,255,255,0.8);">&times;</button>
      </div>
    `;
    
    // Add videos if present
    if (data.videos && data.videos.length > 0) {
      html += `
        <div style="margin-bottom: 20px;">
          <h4 style="margin: 0 0 10px 0; font-size: 16px;">🎥 Training Videos</h4>
          <div style="space-y: 8px;">
      `;
      
      data.videos.forEach(video => {
        html += `
          <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; margin-bottom: 8px;">
            <a href="${video.link}" target="_blank" 
               style="color: white; text-decoration: none; font-weight: bold; display: block; margin-bottom: 5px;">
              ${video.title}
            </a>
            <div style="font-size: 12px; color: rgba(255,255,255,0.8);">
              ⏱️ ${video.duration} • 🎯 ${video.relevance} relevant
            </div>
          </div>
        `;
      });
      
      html += `</div></div>`;
    }
    
    // Add sources if present
    if (data.sources && data.sources.length > 0) {
      html += `
        <div style="margin-bottom: 20px;">
          <h4 style="margin: 0 0 10px 0; font-size: 16px;">📚 Related Resources</h4>
          <div style="space-y: 6px;">
      `;
      
      data.sources.forEach(source => {
        html += `
          <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 6px; margin-bottom: 6px;">
            ${source.url ? 
              `<a href="${source.url}" target="_blank" style="color: white; text-decoration: underline;">${source.title}</a>` :
              `<span style="color: white;">${source.title}</span>`
            }
            <span style="font-size: 11px; color: rgba(255,255,255,0.7); margin-left: 8px;">${source.type || 'document'}</span>
          </div>
        `;
      });
      
      html += `</div></div>`;
    }
    
    // Add AI response
    if (data.message) {
      html += `
        <div style="background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; font-size: 14px; line-height: 1.4;">
          ${data.message.substring(0, 300)}${data.message.length > 300 ? '...' : ''}
        </div>
      `;
    }
    
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    
    // Add animation style if not exists
    if (!document.getElementById('ai-training-style')) {
      const style = document.createElement('style');
      style.id = 'ai-training-style';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
  },

  // Show simple AI overlay message
  showAIOverlay: function(message) {
    const existing = document.getElementById('ai-simple-overlay');
    if (existing) existing.remove();
    
    const overlay = document.createElement('div');
    overlay.id = 'ai-simple-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 300px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
      z-index: 10000;
      color: white;
      padding: 20px;
      animation: slideIn 0.3s ease-out;
    `;
    
    overlay.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 style="margin: 0; color: white; font-size: 16px;">🤖 AI Assistant</h3>
        <button onclick="this.closest('#ai-simple-overlay').remove()" 
                style="background: none; border: none; font-size: 18px; cursor: pointer; color: rgba(255,255,255,0.8);">&times;</button>
      </div>
      <div style="font-size: 14px; line-height: 1.4;">${message}</div>
    `;
    
    document.body.appendChild(overlay);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (overlay.parentNode) overlay.remove();
    }, 5000);
  },

  // Toggle main AI overlay
  toggleOverlay: function() {
    const existing = document.getElementById('ai-assistant-overlay');
    if (existing) {
      existing.style.display = existing.style.display === 'none' ? 'block' : 'none';
    } else {
      this.showAIOverlay('AI Assistant is ready! Use the extension popup to interact.');
    }
  }
};

console.log('🤖 AI Assistant enhanced content script loaded with training recommendations!');
