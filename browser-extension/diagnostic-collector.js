/**
 * Diagnostic Collector
 * Captures screenshots, browser data, and machine info for support cases
 */

class DiagnosticCollector {
  constructor() {
    this.data = {};
    // Note: Console and network interceptors are set up globally via IIFEs at bottom of file
    
    // Screen recording state - stored globally to persist across page changes
    if (!window.__screenRecordingState) {
      window.__screenRecordingState = {
        mediaRecorder: null,
        recordedChunks: [],
        isRecording: false,
        recordingStartTime: null,
        stream: null,
        recordedVideoBlob: null
      };
    }
    
    // Use global state
    this.state = window.__screenRecordingState;
  }
  
  // Getters for backward compatibility
  get mediaRecorder() { return this.state.mediaRecorder; }
  set mediaRecorder(val) { this.state.mediaRecorder = val; }
  
  get recordedChunks() { return this.state.recordedChunks; }
  set recordedChunks(val) { this.state.recordedChunks = val; }
  
  get isRecording() { return this.state.isRecording; }
  set isRecording(val) { this.state.isRecording = val; }
  
  get recordingStartTime() { return this.state.recordingStartTime; }
  set recordingStartTime(val) { this.state.recordingStartTime = val; }
  
  get stream() { return this.state.stream; }
  set stream(val) { this.state.stream = val; }
  
  get recordedVideoBlob() { return this.state.recordedVideoBlob; }
  set recordedVideoBlob(val) { this.state.recordedVideoBlob = val; }

  /**
   * Collect all diagnostic information
   */
  async collectAll() {
    console.log('🔍 Collecting diagnostic information...');

    const diagnostics = {
      // Browser Information
      userAgent: navigator.userAgent,
      browserName: this.getBrowserName(),
      browserVersion: this.getBrowserVersion(),
      platform: navigator.platform,
      language: navigator.language,
      cookiesEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,

      // Screen & Display
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      colorDepth: window.screen.colorDepth,
      pixelRatio: window.devicePixelRatio,

      // Page Context
      url: window.location.href,
      referrer: document.referrer,
      pageTitle: document.title,

      // Network & Connection
      onlineStatus: navigator.onLine,
      connectionType: this.getConnectionType(),

      // Memory & Performance
      memoryUsage: this.getMemoryUsage(),
      performanceMetrics: this.getPerformanceMetrics(),

      // Extension Data (will be populated by background script)
      extensionVersion: chrome?.runtime?.getManifest()?.version,
      extensionId: chrome?.runtime?.id,

      // Timestamp
      collectedAt: new Date().toISOString()
    };

    // Capture screenshot
    diagnostics.screenshot = await this.captureScreenshot();

    // Collect console logs (last 100 entries)
    diagnostics.consoleLogs = this.getRecentConsoleLogs();

    // Collect network requests
    diagnostics.networkRequests = this.getNetworkRequests();
    diagnostics.networkErrors = this.getFailedNetworkRequests();

    // Collect storage data (sanitized)
    diagnostics.localStorage = this.getLocalStorageInfo();
    diagnostics.sessionStorage = this.getSessionStorageInfo();
    diagnostics.cookies = this.getCookiesInfo();

    // Collect user info (if available)
    diagnostics.userInfo = this.getUserInfo();

    console.log('✅ Diagnostics collected:', diagnostics);
    console.log('📊 Stats:', {
      consoleLogs: diagnostics.consoleLogs.length,
      networkRequests: diagnostics.networkRequests.length,
      networkErrors: diagnostics.networkErrors.length,
      cookies: diagnostics.cookies.count,
      hasScreenshot: !!diagnostics.screenshot
    });
    return diagnostics;
  }

  /**
   * Capture screenshot of current page
   */
  async captureScreenshot() {
    try {
      console.log('📸 Attempting screenshot capture...');
      
      // Use chrome API to capture visible tab (must be called from background or popup)
      return new Promise((resolve) => {
        if (chrome?.runtime?.sendMessage) {
          console.log('📤 Sending screenshot request to background...');
          
          // Set a timeout in case background doesn't respond
          const timeout = setTimeout(() => {
            console.warn('⏱️ Screenshot request timed out after 3s, trying fallback');
            this.captureViaHTML2Canvas().then(resolve).catch(() => {
              console.warn('📸 Screenshot capture failed - returning null');
              resolve(null);
            });
          }, 3000);
          
          // Send message to background script to capture screenshot
          chrome.runtime.sendMessage(
            { type: 'captureScreenshot' },
            (response) => {
              clearTimeout(timeout);
              
              if (chrome.runtime.lastError) {
                console.warn('❌ Screenshot via background failed:', chrome.runtime.lastError.message);
                this.captureViaHTML2Canvas().then(resolve).catch(() => {
                  console.warn('📸 Fallback also failed - returning null');
                  resolve(null);
                });
              } else if (response && response.success && response.screenshot) {
                console.log('✅ Screenshot captured via background!');
                resolve(response.screenshot);
              } else {
                console.warn('⚠️ Background response missing screenshot, trying fallback');
                this.captureViaHTML2Canvas().then(resolve).catch(() => {
                  console.warn('📸 Fallback failed - returning null');
                  resolve(null);
                });
              }
            }
          );
        } else {
          console.warn('⚠️ Chrome runtime not available, trying fallback');
          // Fallback: use html2canvas library if available
          this.captureViaHTML2Canvas().then(resolve).catch(() => {
            console.warn('📸 Fallback failed - returning null');
            resolve(null);
          });
        }
      });
    } catch (error) {
      console.error('❌ Screenshot capture error:', error);
      return null;
    }
  }

  /**
   * Fallback screenshot using HTML2Canvas (if available) or simple DOM capture
   */
  async captureViaHTML2Canvas() {
    try {
      // Check if html2canvas is available
      if (typeof html2canvas !== 'undefined') {
        const canvas = await html2canvas(document.body, {
          allowTaint: true,
          useCORS: true,
          logging: false,
          width: window.innerWidth,
          height: Math.min(window.innerHeight, 2000) // Limit height
        });
        return canvas.toDataURL('image/png');
      }
      
      // Fallback: Return null (screenshot not available)
      console.warn('html2canvas not available, skipping screenshot');
      return null;
    } catch (error) {
      console.error('HTML2Canvas screenshot failed:', error);
      return null;
    }
  }

  /**
   * Get browser name
   */
  getBrowserName() {
    const ua = navigator.userAgent;
    if (ua.indexOf('Firefox') > -1) return 'Firefox';
    if (ua.indexOf('Edg') > -1) return 'Edge';
    if (ua.indexOf('Chrome') > -1) return 'Chrome';
    if (ua.indexOf('Safari') > -1) return 'Safari';
    if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) return 'Opera';
    return 'Unknown';
  }

  /**
   * Get browser version
   */
  getBrowserVersion() {
    const ua = navigator.userAgent;
    let match;
    
    if ((match = ua.match(/Firefox\/(\d+\.\d+)/))) return match[1];
    if ((match = ua.match(/Edg\/(\d+\.\d+)/))) return match[1];
    if ((match = ua.match(/Chrome\/(\d+\.\d+)/))) return match[1];
    if ((match = ua.match(/Version\/(\d+\.\d+).*Safari/))) return match[1];
    if ((match = ua.match(/OPR\/(\d+\.\d+)/))) return match[1];
    
    return 'Unknown';
  }

  /**
   * Get connection type
   */
  getConnectionType() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return connection ? connection.effectiveType : 'Unknown';
  }

  /**
   * Get memory usage info
   */
  getMemoryUsage() {
    if (performance.memory) {
      return {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      };
    }
    return null;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    const timing = performance.timing;
    return {
      pageLoadTime: timing.loadEventEnd - timing.navigationStart,
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
      tcpConnection: timing.connectEnd - timing.connectStart,
      serverResponse: timing.responseEnd - timing.requestStart
    };
  }

  /**
   * Get recent console logs (stored by console interceptor)
   */
  getRecentConsoleLogs() {
    if (window.__consoleLogs) {
      return window.__consoleLogs.slice(-100).map(log => ({
        ...log,
        age: Date.now() - new Date(log.timestamp).getTime()
      })); // Last 100 logs with age
    }
    return [];
  }

  /**
   * Get network requests (from performance API)
   */
  getNetworkRequests() {
    try {
      const resources = performance.getEntriesByType('resource');
      return resources.slice(-50).map(resource => ({
        name: resource.name,
        type: resource.initiatorType,
        duration: Math.round(resource.duration),
        size: resource.transferSize || 0,
        protocol: resource.nextHopProtocol,
        status: 'completed',
        startTime: Math.round(resource.startTime)
      }));
    } catch (error) {
      console.error('Failed to get network requests:', error);
      return [];
    }
  }

  /**
   * Get failed network requests
   */
  getFailedNetworkRequests() {
    if (window.__networkErrors) {
      return window.__networkErrors.slice(-20);
    }
    return [];
  }

  /**
   * Get cookies (sanitized)
   */
  getCookiesInfo() {
    try {
      const cookies = document.cookie.split(';').map(c => {
        const [name, ...valueParts] = c.trim().split('=');
        return {
          name: name,
          hasValue: valueParts.length > 0,
          size: c.length
        };
      });
      return {
        count: cookies.length,
        totalSize: cookies.reduce((sum, c) => sum + c.size, 0),
        cookies: cookies.filter(c => !c.name.toLowerCase().includes('token'))
      };
    } catch (error) {
      return { count: 0, error: error.message };
    }
  }

  /**
   * Get session storage info
   */
  getSessionStorageInfo() {
    try {
      const storage = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && !key.toLowerCase().includes('token') && !key.toLowerCase().includes('password')) {
          storage[key] = sessionStorage.getItem(key)?.substring(0, 100);
        }
      }
      return { count: sessionStorage.length, keys: Object.keys(storage) };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get localStorage info (sanitized - no sensitive data)
   */
  getLocalStorageInfo() {
    try {
      const storage = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // Don't include sensitive keys
        if (key && !key.toLowerCase().includes('token') && !key.toLowerCase().includes('password')) {
          storage[key] = localStorage.getItem(key)?.substring(0, 100); // Truncate values
        }
      }
      return storage;
    } catch (error) {
      return { error: 'Cannot access localStorage' };
    }
  }

  /**
   * Collect user information (if available)
   */
  getUserInfo() {
    // This should be populated from your app's user session
    return {
      userId: localStorage.getItem('userId'),
      userEmail: localStorage.getItem('userEmail'),
      userName: localStorage.getItem('userName'),
      userCompany: localStorage.getItem('userCompany'),
      userPhone: localStorage.getItem('userPhone')
    };
  }

  /**
   * Capture error details
   */
  captureError(error) {
    return {
      errorMessage: error.message,
      errorStack: error.stack,
      errorTimestamp: new Date().toISOString(),
      errorName: error.name
    };
  }

  /**
   * 🎬 Start screen recording
   */
  async startScreenRecording() {
    try {
      console.log('📹 Starting screen recording...');
      
      // Request screen capture with audio
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      // Create media recorder - try MP4 first for better compatibility
      const options = {
        mimeType: 'video/mp4;codecs=avc1,mp4a',
        videoBitsPerSecond: 1000000 // 1 Mbps - smaller files for email compatibility
      };

      // Fallback chain: MP4 → WebM VP9 → WebM VP8 → WebM (any)
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.log('⚠️ MP4 not supported, trying WebM VP9');
        options.mimeType = 'video/webm;codecs=vp9,opus';
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.log('⚠️ WebM VP9 not supported, trying WebM VP8');
        options.mimeType = 'video/webm;codecs=vp8,opus';
      }
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.log('⚠️ WebM VP8 not supported, using default WebM');
        options.mimeType = 'video/webm';
      }
      
      console.log(`📹 Using MIME type: ${options.mimeType}`);

      this.mediaRecorder = new MediaRecorder(this.stream, options);
      this.recordedChunks = [];
      this.recordingStartTime = Date.now();
      this.isRecording = true;

      // Collect data chunks
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
          console.log(`📹 Recording chunk: ${Math.round(event.data.size / 1024)}KB`);
        }
      };

      // Handle recording stop
      this.mediaRecorder.onstop = () => {
        console.log('📹 Recording stopped');
        this.isRecording = false;
        
        // Create blob from chunks
        this.recordedVideoBlob = new Blob(this.recordedChunks, {
          type: this.mediaRecorder.mimeType
        });
        
        const sizeInMB = (this.recordedVideoBlob.size / (1024 * 1024)).toFixed(2);
        console.log(`✅ Recording complete: ${sizeInMB}MB`);
        
        // Stop all tracks
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
        }
      };

      // Handle stream ending (user stops sharing)
      this.stream.getVideoTracks()[0].onended = () => {
        console.log('📹 User stopped screen sharing');
        if (this.isRecording) {
          this.stopScreenRecording();
        }
      };

      // Start recording
      this.mediaRecorder.start(1000); // Collect data every second
      console.log('✅ Screen recording started');

      return {
        success: true,
        message: 'Recording started successfully'
      };

    } catch (error) {
      console.error('❌ Screen recording failed:', error);
      this.isRecording = false;
      
      return {
        success: false,
        error: error.message,
        message: error.name === 'NotAllowedError' 
          ? 'Screen recording permission denied' 
          : 'Screen recording not supported or failed'
      };
    }
  }

  /**
   * ⏹️ Stop screen recording
   */
  async stopScreenRecording() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve({
          success: false,
          message: 'No active recording to stop'
        });
        return;
      }

      console.log('⏹️ Stopping screen recording...');

      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        
        // Create blob from chunks
        this.recordedVideoBlob = new Blob(this.recordedChunks, {
          type: this.mediaRecorder.mimeType
        });
        
        const duration = ((Date.now() - this.recordingStartTime) / 1000).toFixed(1);
        const sizeInMB = (this.recordedVideoBlob.size / (1024 * 1024)).toFixed(2);
        
        console.log(`✅ Recording stopped: ${duration}s, ${sizeInMB}MB`);
        
        // Stop all tracks
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
        }

        resolve({
          success: true,
          duration: parseFloat(duration),
          size: parseFloat(sizeInMB),
          blob: this.recordedVideoBlob
        });
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * 📹 Get recording state
   */
  getRecordingState() {
    return {
      isRecording: this.isRecording,
      duration: this.recordingStartTime 
        ? ((Date.now() - this.recordingStartTime) / 1000).toFixed(1)
        : 0,
      hasRecording: !!this.recordedVideoBlob
    };
  }

  /**
   * 🎬 Get recorded video as base64
   */
  async getRecordedVideoBase64() {
    if (!this.recordedVideoBlob) {
      return null;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result);
      };
      reader.readAsDataURL(this.recordedVideoBlob);
    });
  }

  /**
   * 🗑️ Clear recorded video
   */
  clearRecording() {
    this.recordedVideoBlob = null;
    this.recordedChunks = [];
    this.recordingStartTime = null;
    console.log('🗑️ Recording cleared');
  }
}

// Console interceptor to store logs
(function() {
  if (!window.__consoleLogs) {
    window.__consoleLogs = [];
  }

  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
  };

  ['log', 'warn', 'error', 'info'].forEach(method => {
    console[method] = function(...args) {
      window.__consoleLogs.push({
        level: method,
        message: args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' '),
        timestamp: new Date().toISOString()
      });

      // Keep only last 100 logs
      if (window.__consoleLogs.length > 100) {
        window.__consoleLogs = window.__consoleLogs.slice(-100);
      }

      originalConsole[method].apply(console, args);
    };
  });
})();

// Network error interceptor
(function() {
  if (!window.__networkErrors) {
    window.__networkErrors = [];
  }

  // Intercept fetch errors
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    return originalFetch.apply(this, args).then(response => {
      if (!response.ok) {
        window.__networkErrors.push({
          type: 'fetch',
          url: args[0],
          status: response.status,
          statusText: response.statusText,
          timestamp: new Date().toISOString()
        });
      }
      return response;
    }).catch(error => {
      window.__networkErrors.push({
        type: 'fetch',
        url: args[0],
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    });
  };

  // Intercept XHR errors
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this.__requestInfo = { method, url };
    return originalOpen.apply(this, [method, url, ...args]);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('error', () => {
      if (this.__requestInfo) {
        window.__networkErrors.push({
          type: 'xhr',
          method: this.__requestInfo.method,
          url: this.__requestInfo.url,
          error: 'Network request failed',
          timestamp: new Date().toISOString()
        });
      }
    });

    this.addEventListener('load', () => {
      if (this.status >= 400 && this.__requestInfo) {
        window.__networkErrors.push({
          type: 'xhr',
          method: this.__requestInfo.method,
          url: this.__requestInfo.url,
          status: this.status,
          statusText: this.statusText,
          timestamp: new Date().toISOString()
        });
      }
    });

    return originalSend.apply(this, args);
  };

  // Keep only last 50 errors
  setInterval(() => {
    if (window.__networkErrors.length > 50) {
      window.__networkErrors = window.__networkErrors.slice(-50);
    }
  }, 60000); // Every minute
})();

// Make available globally
if (typeof window !== 'undefined') {
  window.DiagnosticCollector = DiagnosticCollector;
  console.log('✅ DiagnosticCollector loaded and ready');
}
