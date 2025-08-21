// Login page script
document.addEventListener('DOMContentLoaded', async () => {
  const auth = new ExtensionAuth();
  
  // Check if already logged in
  const isLoggedIn = await auth.checkAuth();
  if (isLoggedIn) {
    // Close login window and open popup
    window.close();
    chrome.action.openPopup();
    return;
  }
  
  const form = document.getElementById('login-form');
  const errorDiv = document.getElementById('error-message');
  const successDiv = document.getElementById('success-message');
  const loginBtn = document.getElementById('login-btn');
  const btnText = document.getElementById('btn-text');
  const spinner = document.getElementById('spinner');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const accessCode = document.getElementById('accessCode').value;
    
    // Clear messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    // Show loading state
    loginBtn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'block';
    
    try {
      const result = await auth.login(email, accessCode);
      
      if (result.success) {
        successDiv.textContent = 'Login successful! Redirecting...';
        successDiv.style.display = 'block';
        
        // Notify background script
        chrome.runtime.sendMessage({
          type: 'LOGIN_SUCCESS',
          user: result.user
        });
        
        // Close login window after brief delay
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        errorDiv.textContent = result.error || 'Login failed. Please check your credentials.';
        errorDiv.style.display = 'block';
        
        // Reset button
        loginBtn.disabled = false;
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
      }
    } catch (error) {
      errorDiv.textContent = 'An error occurred. Please try again.';
      errorDiv.style.display = 'block';
      
      // Reset button
      loginBtn.disabled = false;
      btnText.style.display = 'inline';
      spinner.style.display = 'none';
    }
  });
});
