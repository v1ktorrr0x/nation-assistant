# State Management Architecture

## Overview

Nation Assistant implements a comprehensive state management system across multiple Chrome extension components, ensuring consistent user experience and reliable data flow between the background service worker, content scripts, and UI components.

## State Components

### 1. Global Application State

#### Background Service State
```javascript
// Located in: background.js
class NationAssistantBackground {
  constructor() {
    this.llmService = new LLMService();
    // Service initialization and configuration state
  }
}
```

#### Sidepanel UI State
```javascript
// Located in: sidepanel.js
let state = {
  chatHistory: [],           // Persistent conversation history
  isProcessing: false,       // API call processing state
  currentTabId: null,        // Active tab context
  currentStreamingController: null, // Streaming animation control
  lastUserMessage: null      // Retry functionality state
};
```

#### LLM Service State
```javascript
// Located in: services/llm-service.js
class LLMService {
  constructor() {
    this.apiKey = null;        // API authentication
    this.model = 'gpt-4.1-nano'; // Model configuration
    this.maxTokens = 300;      // Response limits
    this.temperature = 0.7;    // Response creativity
    this.baseUrl = 'https://open.service.crestal.network/v1';
    this.initialized = false;  // Service readiness state
  }
}
```

### 2. Persistent Storage State

#### Chrome Storage Sync (Cross-device)
```javascript
// Settings that sync across browser instances
{
  crestalApiKey: string,     // User API key
  apiBaseUrl: string,        // Service endpoint
  llmModel: string,          // AI model preference
  llmMaxTokens: number,      // Response length limit
  llmTemperature: number     // Response creativity setting
}
```

#### Chrome Storage Local (Device-specific)
```javascript
// Temporary context and actions
{
  contextAction: {
    action: 'translate' | 'analyze',
    originalText: string,
    translation?: string,
    targetLanguage?: string,
    detectedLanguage?: string,
    loading: boolean,
    error?: string,
    smart?: boolean,
    timestamp: number,
    tabId: number
  }
}
```

### 3. Runtime Communication State

#### Message Types
```javascript
// Background ↔ Sidepanel Communication
{
  type: 'getActiveTab' | 'chatWithPage' | 'testConnection' | 'reloadSettings',
  tabId?: number,
  question?: string,
  chatHistory?: Array,
  testConfig?: Object
}

// Background ↔ Content Communication  
{
  type: 'PING' | 'GET_PAGE_CONTENT',
  // Response includes page content and metadata
}

// Context Action Broadcasting
{
  type: 'TRANSLATION_READY' | 'TRANSLATION_ERROR',
  translation?: string,
  targetLanguage?: string,
  detectedLanguage?: string,
  error?: string
}
```

## State Flow Patterns

### 1. User Message Processing Flow

```
User Input (sidepanel.js)
    ↓ Validation & State Update
    ↓ state.isProcessing = true
    ↓ state.lastUserMessage = message
    ↓
Background Message (background.js)
    ↓ Tab Content Extraction
    ↓ LLM Service Call
    ↓ Response Processing
    ↓
Response Streaming (sidepanel.js)
    ↓ UI Animation Control
    ↓ state.currentStreamingController
    ↓ Chat History Update
    ↓ state.isProcessing = false
```

### 2. Context Menu Translation Flow

```
Context Menu Click (background.js)
    ↓ Storage.local.set(contextAction)
    ↓ Sidepanel Open
    ↓
Translation Processing (background.js)
    ↓ LLM Service Translation
    ↓ Storage Update with Result
    ↓ Runtime Message Broadcast
    ↓
UI Update (sidepanel.js)
    ↓ Context Action Display
    ↓ User Interaction Options
```

### 3. Settings Configuration Flow

```
Options Page (options.js)
    ↓ Form Validation
    ↓ Storage.sync.set(settings)
    ↓ Background Message (reloadSettings)
    ↓
Background Service (background.js)
    ↓ LLM Service Reinitialization
    ↓ Connection Test
    ↓ State Synchronization
```

## State Consistency Mechanisms

### 1. Error State Management

#### Processing State Recovery
```javascript
// Automatic cleanup on errors
finally {
  userMessageEl?.classList.remove('loading');
  setProcessing(false);
  chatInput?.focus();
}
```

#### Connection State Monitoring
```javascript
// Real-time connection status updates
if (error.message.includes('fetch') || error.message.includes('network')) {
  updateConnectionStatus('disconnected');
} else if (error.message.includes('API key') || error.message.includes('401')) {
  updateConnectionStatus('error');
}
```

### 2. State Validation

#### Input Validation
```javascript
// Character count and length validation
function updateInputValidation() {
  const length = chatInput.value.length;
  const maxLength = 4000;
  const remaining = maxLength - length;
  
  // Visual feedback and button state management
  if (remaining < 0) {
    counter.className = 'char-counter error';
    sendBtn.disabled = true;
  }
}
```

#### API Configuration Validation
```javascript
// Settings validation before service calls
async loadSettings() {
  const result = await chrome.storage.sync.get(['crestalApiKey', 'apiBaseUrl']);
  if (!result.crestalApiKey?.trim()) {
    throw new Error('No Crestal API key configured');
  }
}
```

### 3. State Synchronization

#### Cross-Component Updates
```javascript
// Settings changes propagate to all components
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    this.handleStorageChange(changes);
  }
});
```

#### Context Preservation
```javascript
// Conversation context maintained across interactions
const contextualPrompt = this.buildContextualPrompt(currentQuery, pageContent, chatHistory);
```

## Performance Optimizations

### 1. Memory Management

#### Streaming Controller Cleanup
```javascript
// Prevent memory leaks from streaming animations
if (state.currentStreamingController) {
  state.currentStreamingController();
  state.currentStreamingController = null;
}
```

#### Chat History Limits
```javascript
// Limit conversation history for API efficiency
chatHistory: state.chatHistory.slice(-4).map(msg => ({
  role: msg.sender === 'user' ? 'user' : 'assistant',
  content: msg.content
}))
```

### 2. Lazy Loading

#### Service Initialization
```javascript
// Services initialize only when needed
async init() {
  if (this.initialized) return;
  try {
    await this.loadSettings();
    this.initialized = true;
  } catch (error) {
    logger.warn('LLM service initialization failed:', error.message);
  }
}
```

#### Content Script Injection
```javascript
// Content scripts injected on-demand
async ensureContentScript(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    if (response?.pong) return; // Already injected
  } catch { }
  
  // Inject if not present
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
}
```

## Debugging and Monitoring

### 1. Comprehensive Logging

#### Component-Specific Loggers
```javascript
const logger = {
  log: (message, ...args) => {
    if (DEBUG) console.log(`[ComponentName] ${message}`, ...args);
  },
  // ... other log levels
};
```

#### State Change Tracking
```javascript
// Log critical state changes for debugging
logger.log('handleSendMessage called:', { 
  messageText, 
  isRegenerate, 
  message, 
  isProcessing: state.isProcessing 
});
```

### 2. Error Reporting

#### User-Friendly Error Messages
```javascript
function showError(message, context = {}) {
  // Contextual error handling with recovery options
  if (context.apiKey || message.includes('API key')) {
    errorTitle = 'API Configuration Issue';
    actionButtons = `<button class="error-action-btn" data-action="configure-api">Configure API Key</button>`;
  }
}
```

## Best Practices

### 1. State Immutability
- Always create new state objects rather than mutating existing ones
- Use proper cleanup in finally blocks
- Validate state before operations

### 2. Error Boundaries
- Implement comprehensive try-catch blocks
- Provide user-actionable error messages
- Maintain UI consistency during error states

### 3. Performance Considerations
- Limit chat history size for API calls
- Clean up streaming controllers and event listeners
- Use lazy initialization for services

### 4. Security
- Validate all user inputs before processing
- Sanitize content before display
- Use secure storage for sensitive data (API keys)

This state management architecture ensures reliable, performant, and user-friendly operation across all extension components while maintaining data consistency and providing robust error recovery mechanisms.