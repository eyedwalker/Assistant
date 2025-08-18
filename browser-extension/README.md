# 🤖 Eyecare AI Assistant - Browser Extension

Transform your Encompass/Eyefinity workflow with AI-powered assistance directly in your browser!

## 🚀 Features

### **Floating AI Chat Widget**
- **Context-Aware Assistance** - Understands what page you're on and what you're doing
- **Real-time Help** - Get instant answers about eyecare procedures and system usage
- **Smart Suggestions** - Contextual training recommendations based on your current workflow

### **Browser Session Integration**
- **Page Analysis** - Automatically detects patient management, billing, scheduling screens
- **Form Field Assistance** - AI help with data entry and form completion
- **Workflow Optimization** - Suggestions to improve efficiency and reduce errors

### **Training Integration**
- **Contextual Training** - Relevant training modules suggested based on current tasks
- **Just-in-Time Learning** - Access training content without leaving your workflow
- **Progress Tracking** - Seamless integration with your training progress

## 📦 Installation

### **Step 1: Load Extension in Chrome**
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `browser-extension` folder
5. The extension should appear in your extensions list

### **Step 2: Pin Extension**
1. Click the extensions icon (puzzle piece) in Chrome toolbar
2. Find "Eyecare AI Assistant" and click the pin icon
3. The AI assistant icon will appear in your toolbar

### **Step 3: Start AI Assistant Server**
Make sure your AI assistant server is running:
```bash
cd "AI Assistant Helper"
npm run dev
```
The server should be running at `http://localhost:3000`

## 🎯 Usage

### **On Encompass/Eyefinity Pages:**
1. **Floating Button** - Look for the blue AI button in bottom-right corner
2. **Click to Chat** - Opens intelligent chat overlay with page context
3. **Context Menu** - Right-click anywhere for AI help options

### **Extension Popup:**
1. **Click Extension Icon** - Opens control panel
2. **Quick Actions** - Analyze page, find training, open dashboard
3. **Status Check** - See connection status and page context

### **Smart Features:**
- **Auto-Detection** - Recognizes patient management, billing, scheduling pages
- **Form Help** - AI assistance with data entry and validation
- **Error Prevention** - Warns about potential mistakes before submission
- **Training Suggestions** - Contextual learning recommendations

## 🔧 Configuration

### **API Connection:**
- Default: `http://localhost:3000`
- Modify `apiBaseUrl` in `content.js` and `popup.js` for different servers

### **Permissions:**
- **activeTab** - Read current page content for context
- **storage** - Save user preferences and context
- **scripting** - Inject AI assistant overlay
- **tabs** - Analyze page context and navigation

## 🎨 Customization

### **Styling:**
Edit `overlay.css` to customize:
- Colors and themes
- Button position and size
- Overlay dimensions and layout

### **Functionality:**
Modify `content.js` to add:
- Custom page detection logic
- Additional form field analysis
- Specialized workflow assistance

## 🔍 How It Works

### **Page Context Analysis:**
```javascript
// Detects current workflow
detectPageType() {
  if (url.includes('patient')) return '👤 Patient Management';
  if (url.includes('billing')) return '💰 Billing & Claims';
  // ... more detection logic
}
```

### **AI Integration:**
```javascript
// Sends context-aware messages to AI
const response = await fetch('/api/chat', {
  body: JSON.stringify({
    message: userMessage,
    context: {
      pageType: 'Patient Management',
      formData: extractedFormData,
      url: currentUrl
    }
  })
});
```

### **Smart Suggestions:**
- **Patient Records** - "Need help with patient data entry?"
- **Insurance Claims** - "Having trouble with claim submission?"
- **Scheduling** - "Want tips for efficient appointment booking?"

## 🛠 Development

### **File Structure:**
```
browser-extension/
├── manifest.json      # Extension configuration
├── content.js         # Main overlay and page interaction
├── overlay.css        # Styling for AI assistant UI
├── popup.html         # Extension popup interface
├── popup.js          # Popup functionality
├── background.js     # Service worker for background tasks
└── README.md         # This file
```

### **Key Components:**
- **Content Script** - Injects AI overlay into pages
- **Background Service** - Handles API communication and context
- **Popup Interface** - Quick access controls and status
- **Context Analysis** - Smart page and form detection

## 🎯 Use Cases

### **Patient Management:**
- "How do I update insurance information?"
- "What's the best practice for patient data entry?"
- "Show me the patient management training module"

### **Billing & Claims:**
- "Help me process this insurance claim"
- "What codes should I use for this procedure?"
- "Find training on billing procedures"

### **Scheduling:**
- "How do I handle appointment conflicts?"
- "What's the optimal scheduling workflow?"
- "Show me scheduling best practices"

## 🔒 Privacy & Security

- **Local Processing** - Page analysis happens locally in browser
- **Secure Communication** - HTTPS communication with AI server
- **No Data Storage** - No sensitive patient data stored in extension
- **Permission Control** - Only accesses pages when explicitly activated

## 🚀 Next Steps

1. **Install the extension** following the steps above
2. **Navigate to Encompass/Eyefinity** in your browser
3. **Look for the blue AI button** in the bottom-right corner
4. **Click to start chatting** with context-aware AI assistance
5. **Explore training suggestions** based on your current workflow

The extension transforms your browser into an intelligent eyecare assistant, providing contextual help and training exactly when and where you need it!

## 🆘 Troubleshooting

### **Extension Not Loading:**
- Check that Developer mode is enabled
- Verify all files are in the browser-extension folder
- Look for errors in Chrome DevTools console

### **AI Not Responding:**
- Ensure AI assistant server is running at localhost:3000
- Check network connectivity
- Verify API endpoints are accessible

### **Context Not Working:**
- Refresh the page after installing extension
- Check browser permissions for the extension
- Ensure you're on an Encompass/Eyefinity page

Ready to revolutionize your eyecare workflow with AI assistance! 🎉
