// Extension Authentication Module
class ExtensionAuth {
  constructor() {
    this.apiBaseUrl = 'http://localhost:3001';
    this.isAuthenticated = false;
    this.userInfo = null;
  }

  async checkAuth() {
    try {
      const stored = await chrome.storage.sync.get(['authToken', 'userInfo']);
      
      if (stored.authToken) {
        // Validate token with server
        const isValid = await this.validateToken(stored.authToken);
        if (isValid) {
          this.isAuthenticated = true;
          this.userInfo = stored.userInfo;
          return true;
        }
      }
      
      this.isAuthenticated = false;
      return false;
    } catch (error) {
      console.error('Auth check failed:', error);
      return false;
    }
  }

  async validateToken(token) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/extension/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.valid && data.hasExtensionAccess;
      }
      
      return false;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  async login(email, accessCode) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/extension/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, accessCode })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Store auth data
        await chrome.storage.sync.set({
          authToken: data.token,
          userInfo: {
            email: data.email,
            name: data.name,
            role: data.role,
            organization: data.organization
          }
        });
        
        this.isAuthenticated = true;
        this.userInfo = data;
        
        return { success: true, user: data };
      } else {
        const error = await response.json();
        return { success: false, error: error.message || 'Login failed' };
      }
    } catch (error) {
      console.error('Login failed:', error);
      return { success: false, error: error.message };
    }
  }

  async logout() {
    try {
      // Clear stored auth data
      await chrome.storage.sync.remove(['authToken', 'userInfo']);
      
      this.isAuthenticated = false;
      this.userInfo = null;
      
      return { success: true };
    } catch (error) {
      console.error('Logout failed:', error);
      return { success: false, error: error.message };
    }
  }

  getUser() {
    return this.userInfo;
  }

  isLoggedIn() {
    return this.isAuthenticated;
  }
}

// Export for use in other extension scripts
if (typeof window !== 'undefined') {
  window.ExtensionAuth = ExtensionAuth;
}
