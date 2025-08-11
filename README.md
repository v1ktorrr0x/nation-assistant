# Nation Assistant

AI-powered Chrome extension that provides intelligent web content analysis through an intuitive sidebar interface with streaming responses and contextual suggestions.

## ✨ Features

### 🤖 **Intelligent Page Analysis**
- Smart content extraction and AI-powered analysis
- Contextual suggestions based on page type (articles, tutorials, documentation, products)
- Real-time streaming responses with interactive controls

### 🎯 **Context Menu Integration**
- Right-click selected text for instant analysis
- Smart translation with auto-language detection
- Quick access to AI insights without leaving the page

### 💬 **Advanced Chat Interface**
- Streaming animation with speed controls (click to accelerate, double-click for instant)
- Message actions (copy, regenerate, bookmark)
- Enhanced error handling with actionable recovery options

### ⚡ **Smart User Experience**
- Character count validation with visual feedback
- Keyboard shortcuts for power users
- Connection status monitoring
- Contextual welcome messages with page-aware suggestions

## 🚀 Installation

### For Users
1. Download the extension from Chrome Web Store (coming soon)
2. Click the Nation Assistant icon in your toolbar
3. Configure your Crestal Network API key in settings
4. Start analyzing web content with AI assistance

### For Developers
1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory
5. Configure your API key and start developing

## 📖 Usage

### **Basic Usage**
- **Click Extension Icon**: Opens sidebar with smart suggestions for the current page
- **Select & Right-Click**: Instant analysis of selected text
- **Type Questions**: Ask anything about the page content

### **Advanced Features**
- **Streaming Control**: Click streaming responses to speed up, double-click for instant completion
- **Message Actions**: Copy responses, regenerate answers, or bookmark important information
- **Keyboard Shortcuts**: 
  - `Enter` - Send message
  - `Shift+Enter` - New line
  - `Escape` - Clear input
  - `Ctrl/Cmd+K` - Focus input
  - `Ctrl/Cmd+R` - Retry last message

### **Context Menu Options**
- **Analyze Page** - Complete page analysis
- **Chat with Selection** - Analyze selected text
- **Quick Translate** - Auto-detect and translate
- **Translate to [Language]** - Direct translation options

## ⚙️ Configuration

### **API Setup**
1. Get your API key from [Crestal Network](https://crestal.network)
2. Open extension settings (⚙️ icon)
3. Enter your API key and test connection
4. Customize response parameters if needed

### **Customization Options**
- **Model Selection**: Choose AI model (default: gpt-4.1-nano)
- **Response Length**: Adjust max tokens (default: 300)
- **Temperature**: Control response creativity (default: 0.7)
- **Base URL**: Custom API endpoint (optional)

## 🔒 Security & Privacy

- **Local Processing**: Content analysis happens locally with secure API communication
- **No Data Storage**: No personal data stored on external servers
- **Input Sanitization**: XSS protection and content security policies
- **Secure Communication**: All API calls use HTTPS encryption
- **Privacy First**: Only page content you explicitly analyze is sent to AI

## 🛠️ Technical Details

### **Architecture**
- **Manifest V3**: Modern Chrome extension architecture
- **Service Worker**: Efficient background processing
- **Content Scripts**: Secure page content extraction
- **Side Panel API**: Native Chrome sidebar integration

### **Supported Browsers**
- Chrome 88+ (Manifest V3 support required)
- Chromium-based browsers with side panel support

### **Dependencies**
- Font Awesome 6.4.0 (icons)
- Google Fonts (Inter, Space Mono)
- Crestal Network API (AI processing)

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for details on:
- Code style and standards
- Testing requirements
- Pull request process
- Issue reporting

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Issues**: Report bugs or request features on GitHub
- **Documentation**: Check our wiki for detailed guides
- **Community**: Join our Discord for discussions and support

---

**Made with ❤️ by the Nation Browser Suite team**