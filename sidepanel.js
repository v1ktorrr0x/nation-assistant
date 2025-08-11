// Nation Assistant Simple Chat Sidepanel
'use strict';

// ===== COMPLETELY REWORKED AI RESPONSE SYSTEM =====

/**
 * Advanced AI Response Formatter - Robust content processing
 */
class AIResponseFormatter {
  constructor() {
    this.patterns = {
      // Headers
      h1: /^# (.+)$/gm,
      h2: /^## (.+)$/gm,
      h3: /^### (.+)$/gm,
      h4: /^#### (.+)$/gm,
      
      // Lists
      bulletList: /^[-*+•] (.+)$/gm,
      numberedList: /^\d+\. (.+)$/gm,
      
      // Text formatting
      bold: /\*\*(.*?)\*\*/g,
      italic: /\*(.*?)\*/g,
      code: /`([^`]+)`/g,
      
      // Links
      markdownLink: /\[([^\]]+)\]\(([^)]+)\)/g,
      autoLink: /(https?:\/\/[^\s<>"]+)/g,
      
      // Special
      hashtag: /#(\w+)/g,
      blockquote: /^> (.+)$/gm
    };
  }

  format(content) {
    if (!content || typeof content !== 'string') {
      return '<div class="ai-error">Invalid response content</div>';
    }

    try {
      // Normalize content
      const normalized = this.normalizeContent(content);
      
      // Process content in stages
      const processed = this.processContent(normalized);
      
      return processed;
    } catch (error) {
      console.error('AI Response formatting error:', error);
      return `<div class="ai-error">Formatting error: ${error.message}</div>`;
    }
  }

  normalizeContent(content) {
    return content
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
  }

  processContent(content) {
    // Split content into blocks (separated by double newlines)
    const blocks = content.split(/\n\s*\n/).filter(block => block.trim());
    
    const processedBlocks = blocks.map(block => this.processBlock(block.trim()));
    
    return processedBlocks.join('\n');
  }

  processBlock(block) {
    // Check what type of block this is
    const blockType = this.identifyBlockType(block);
    
    switch (blockType) {
      case 'header':
        return this.processHeader(block);
      case 'list':
        return this.processList(block);
      case 'code':
        return this.processCodeBlock(block);
      case 'blockquote':
        return this.processBlockquote(block);
      default:
        return this.processParagraph(block);
    }
  }

  identifyBlockType(block) {
    const lines = block.split('\n');
    const firstLine = lines[0].trim();
    
    // Check for headers
    if (firstLine.match(/^#{1,4} /)) return 'header';
    
    // Check for lists (if most lines are list items)
    const listLines = lines.filter(line => 
      line.trim().match(/^[-*+•] /) || line.trim().match(/^\d+\. /)
    );
    if (listLines.length > lines.length * 0.5) return 'list';
    
    // Check for code blocks
    if (block.includes('```')) return 'code';
    
    // Check for blockquotes
    if (firstLine.startsWith('> ')) return 'blockquote';
    
    return 'paragraph';
  }

  processHeader(block) {
    return block
      .replace(this.patterns.h4, '<h4>$1</h4>')
      .replace(this.patterns.h3, '<h3>$1</h3>')
      .replace(this.patterns.h2, '<h2>$1</h2>')
      .replace(this.patterns.h1, '<h1>$1</h1>');
  }

  processList(block) {
    const lines = block.split('\n');
    const listItems = [];
    let currentListType = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const bulletMatch = trimmed.match(/^[-*+•] (.+)$/);
      const numberMatch = trimmed.match(/^\d+\. (.+)$/);
      
      if (bulletMatch) {
        if (currentListType !== 'ul') {
          if (currentListType) listItems.push(`</${currentListType}>`);
          listItems.push('<ul>');
          currentListType = 'ul';
        }
        listItems.push(`<li>${this.processInlineFormatting(bulletMatch[1])}</li>`);
      } else if (numberMatch) {
        if (currentListType !== 'ol') {
          if (currentListType) listItems.push(`</${currentListType}>`);
          listItems.push('<ol>');
          currentListType = 'ol';
        }
        listItems.push(`<li>${this.processInlineFormatting(numberMatch[1])}</li>`);
      } else {
        // Regular text in list context
        if (currentListType) {
          listItems.push(`</${currentListType}>`);
          currentListType = null;
        }
        listItems.push(`<p>${this.processInlineFormatting(trimmed)}</p>`);
      }
    }
    
    if (currentListType) {
      listItems.push(`</${currentListType}>`);
    }
    
    return listItems.join('\n');
  }

  processCodeBlock(block) {
    return block.replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, language, code) => {
      const cleanCode = this.escapeHtml(code.trim());
      return `<pre><code class="language-${language || 'text'}">${cleanCode}</code></pre>`;
    });
  }

  processBlockquote(block) {
    return block.replace(this.patterns.blockquote, '<blockquote>$1</blockquote>');
  }

  processParagraph(block) {
    // Process inline formatting and convert line breaks
    const formatted = this.processInlineFormatting(block);
    const withBreaks = formatted.replace(/\n/g, '<br>');
    return `<p>${withBreaks}</p>`;
  }

  processInlineFormatting(text) {
    return text
      // Links first (to avoid conflicts)
      .replace(this.patterns.markdownLink, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(this.patterns.autoLink, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
      
      // Text formatting
      .replace(this.patterns.bold, '<strong>$1</strong>')
      .replace(this.patterns.italic, '<em>$1</em>')
      .replace(this.patterns.code, '<code>$1</code>')
      
      // Special elements
      .replace(this.patterns.hashtag, '<span class="hashtag">#$1</span>');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Create global formatter instance
const aiFormatter = new AIResponseFormatter();

/**
 * Main formatting function - now uses the advanced formatter
 */
function formatAIResponse(content) {
  return aiFormatter.format(content);
}

// All formatting functions removed - using ultra-simple approach

// Removed formatNumberedSections - universal CSS handles all formatting

// ===== UTILITY FUNCTIONS =====

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Ensure all AI responses use streaming animation
 * This function wraps addMessage to force streaming for AI responses
 */
function addAIMessage(content, save = true) {
  // Validate that this is being used for AI content
  if (typeof content !== 'string' || !content.trim()) {
    return null;
  }
  return addMessage(content, "ai", save);
}

/**
 * Add system message without streaming (for notifications, status updates)
 */
function addSystemMessage(content, save = false) {
  return addMessage(content, "system", save);
}

/**
 * Update input validation and character count
 */
function updateInputValidation() {
  const { chatInput } = elements;
  if (!chatInput) return;
  
  const text = chatInput.value;
  const length = text.length;
  const maxLength = 4000;
  
  // Create or update character counter
  let counter = document.getElementById('char-counter');
  if (!counter) {
    counter = document.createElement('div');
    counter.id = 'char-counter';
    counter.className = 'char-counter';
    
    const inputFooter = document.querySelector('.input-footer');
    if (inputFooter) {
      inputFooter.appendChild(counter);
    }
  }
  
  // Update counter display
  const remaining = maxLength - length;
  counter.textContent = `${length}/${maxLength}`;
  
  // Update counter color based on remaining characters
  if (remaining < 0) {
    counter.className = 'char-counter error';
  } else if (remaining < 100) {
    counter.className = 'char-counter warning';
  } else {
    counter.className = 'char-counter';
  }
  
  // Update input container border for visual feedback
  const inputContainer = elements.inputContainer;
  if (inputContainer) {
    if (remaining < 0) {
      inputContainer.style.borderColor = 'rgba(255, 107, 107, 0.5)';
    } else if (remaining < 100) {
      inputContainer.style.borderColor = 'rgba(255, 193, 7, 0.5)';
    } else {
      inputContainer.style.borderColor = '';
    }
  }
}

/**
 * Retry the last user message
 */
function retryLastMessage() {
  if (state.lastUserMessage && !state.isProcessing) {
    handleSendMessage(state.lastUserMessage, true);
  }
}

/**
 * Development helper: Validate that all AI messages use streaming
 * This function can be called to check for any bypassed streaming
 */
function validateStreamingImplementation() {
  const aiMessages = document.querySelectorAll('.message.ai .message-content');
  let bypassedCount = 0;
  
  aiMessages.forEach((messageContent, index) => {
    // Check if message was created without streaming indicators
    const hasStreamingCursor = messageContent.querySelector('.streaming-cursor');
    const hasStreamingIndicator = messageContent.querySelector('.streaming-speed-indicator');
    
    // Check streaming implementation
    if (!hasStreamingCursor && !hasStreamingIndicator && messageContent.innerHTML.length > 50) {
      bypassedCount++;
    }
  });
  
  // Development validation complete
  
  return bypassedCount === 0;
}

// Removed complex structured response functions - universal CSS handles all content types automatically

function formatPlainText(content) {
  const escaped = escapeHtml(content);
  const withBreaks = escaped.replace(/\n\n/g, '</p><p class="ai-text">').replace(/\n/g, '<br>');
  return `<p class="ai-text">${withBreaks}</p>`;
}

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}



// ===== MAIN APPLICATION =====

// Global state and elements
let elements = {};
let state = {
  chatHistory: [],
  isProcessing: false,
  currentTabId: null,
  currentStreamingController: null,
  lastUserMessage: null
};

// ===== APPLICATION FUNCTIONS =====

async function init() {
  try {
  setupEventListeners();
  await loadCurrentTab();
  await handleContextAction();

  // Show welcome message if no context action
  if (!await hasContextAction()) {
    showWelcomeMessage();
  }

  enableChatInput();
  
  // Focus input and disable send button initially
  setTimeout(() => elements.chatInput?.focus(), 200);
  if (elements.sendBtn) elements.sendBtn.disabled = true;
  
  } catch (error) {
  console.error('Initialization error:', error);
  // Show error in chat if possible
  const chatMessages = elements.chatMessages;
  if (chatMessages) {
    const errorEl = document.createElement('div');
    errorEl.classList.add('message', 'system');
    errorEl.innerHTML = '<div class="message-content">❌ Failed to initialize. Please refresh the page.</div>';
    chatMessages.appendChild(errorEl);
  }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize DOM Elements
  elements = {
  chatMessages: document.getElementById('chat-messages'),
  chatInput: document.getElementById('chat-input'),
  sendBtn: document.getElementById('send-btn'),
  tabTitle: document.getElementById('tab-title'),
  tabUrl: document.getElementById('tab-url'),
  refreshBtn: document.getElementById('refresh-btn'),
  settingsBtn: document.getElementById('settings-btn'),
  inputContainer: document.getElementById('input-container')
  };

  // Initialize application
  await init();
});

function setupEventListeners() {
  const { chatInput, sendBtn, refreshBtn, settingsBtn, inputContainer } = elements;

  // Chat input events
  chatInput?.addEventListener('input', handleInputChange);
  chatInput?.addEventListener('keydown', handleKeyDown);
  chatInput?.addEventListener('click', () => chatInput.focus());

  // Button events
  sendBtn?.addEventListener('click', handleSendMessage);
  refreshBtn?.addEventListener('click', handleRefresh);
  settingsBtn?.addEventListener('click', () => chrome.runtime.openOptionsPage());

  // Input container focus
  inputContainer?.addEventListener('click', (e) => {
  if (e.target !== chatInput) chatInput?.focus();
  });
}

function handleInputChange() {
  const { chatInput, sendBtn } = elements;
  if (!chatInput) return;

  // Auto-resize textarea
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';

  // Update character count and validation
  updateInputValidation();

  // Update send button state
  if (sendBtn) {
    const text = chatInput.value.trim();
    const isValid = text && text.length <= 4000 && !state.isProcessing;
    sendBtn.disabled = !isValid;
    
    // Update button appearance with better feedback
    if (isValid) {
      sendBtn.style.background = 'linear-gradient(135deg, #d0ff16 0%, #a8cc12 100%)';
      sendBtn.style.color = '#000';
      sendBtn.title = 'Send message';
    } else if (state.isProcessing) {
      sendBtn.style.background = 'rgba(255, 255, 255, 0.1)';
      sendBtn.style.color = '#666666';
      sendBtn.title = 'Processing...';
    } else if (!text) {
      sendBtn.style.background = 'rgba(255, 255, 255, 0.1)';
      sendBtn.style.color = '#666666';
      sendBtn.title = 'Enter a message to send';
    } else if (text.length > 4000) {
      sendBtn.style.background = 'rgba(255, 107, 107, 0.2)';
      sendBtn.style.color = '#ff6b6b';
      sendBtn.title = 'Message too long (max 4000 characters)';
    }
  }
}

function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (elements.sendBtn && !elements.sendBtn.disabled) {
      handleSendMessage();
    }
  } else if (e.key === 'Escape') {
    // Clear input on Escape
    if (elements.chatInput) {
      elements.chatInput.value = '';
      handleInputChange();
    }
  } else if (e.ctrlKey || e.metaKey) {
    // Keyboard shortcuts
    if (e.key === 'k') {
      e.preventDefault();
      elements.chatInput?.focus();
    } else if (e.key === 'r') {
      e.preventDefault();
      if (state.lastUserMessage && !state.isProcessing) {
        retryLastMessage();
      }
    }
  }
}

async function handleRefresh() {
  if (state.isProcessing) return;

  try {
    // Clear chat history
    state.chatHistory = [];

    // Clear chat messages with smooth transition
    const { chatMessages } = elements;
    if (chatMessages) {
      chatMessages.style.opacity = '0.5';
      setTimeout(() => {
        chatMessages.innerHTML = '';
        chatMessages.style.opacity = '1';
        showWelcomeMessage();
      }, 150);
    }

    // Reload current tab info
    await loadCurrentTab();

    // Clear input
    const { chatInput } = elements;
    if (chatInput) {
      chatInput.value = '';
      handleInputChange();
    }

    // Focus input
    setTimeout(() => chatInput?.focus(), 300);

  } catch (error) {
    addAIMessage("❌ Failed to start new conversation. Please try again.");
  }
  }

async function handleSendMessage(messageText = null, isRegenerate = false) {
  const { chatInput } = elements;
  const message = messageText || chatInput?.value.trim();
  if (!message || state.isProcessing) return;

  // Validate message length
  if (message.length > 4000) {
    showError('Message is too long. Please keep it under 4000 characters.', {});
    return;
  }

  // Add user message (skip if regenerating)
  let userMessageEl = null;
  if (!isRegenerate) {
    userMessageEl = addMessage(message, "user");
    state.lastUserMessage = message; // Store for retry functionality
    if (chatInput) {
      chatInput.value = "";
      handleInputChange();
    }
  }

  // Show immediate feedback with more specific status
  showTypingIndicator();
  setProcessing(true, isRegenerate ? 'Regenerating response...' : 'Reading page content...');

  try {
    // Update status to show we're analyzing
    setProcessing(true, 'Analyzing page content...');
    
    const response = await chrome.runtime.sendMessage({
      type: 'chatWithPage',
      tabId: state.currentTabId,
      question: message,
      chatHistory: state.chatHistory.slice(-4).map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      }))
    });

    hideTypingIndicator();
    
    if (response?.success) {
      addAIMessage(response.data.response);
    } else {
      throw new Error(response?.error || 'Unknown error');
    }
  } catch (error) {
    hideTypingIndicator();
    showError(error.message, {
      apiKey: error.message.includes('API key') || error.message.includes('401'),
      connection: error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')
    });
  } finally {
    userMessageEl?.classList.remove('loading');
    setProcessing(false);
    chatInput?.focus();
  }
  }

function showError(message, context = {}) {
  const errorEl = document.createElement('div');
  errorEl.classList.add('message', 'system');
  
  // Provide more specific error guidance
  let errorTitle = 'Something went wrong';
  let actionButtons = '';
  
  if (context.apiKey || message.includes('API key') || message.includes('401')) {
    errorTitle = 'API Configuration Issue';
    actionButtons = `
      <button class="error-action-btn" data-action="configure-api">
        <i class="fas fa-cog"></i> Configure API Key
      </button>
    `;
  } else if (context.connection || message.includes('fetch') || message.includes('network')) {
    errorTitle = 'Connection Problem';
    actionButtons = `
      <button class="error-action-btn" data-action="retry">
        <i class="fas fa-redo"></i> Retry
      </button>
      <button class="error-action-btn" data-action="refresh">
        <i class="fas fa-refresh"></i> Refresh
      </button>
    `;
  } else if (message.includes('rate limit') || message.includes('429')) {
    errorTitle = 'Rate Limit Reached';
    actionButtons = `
      <button class="error-action-btn" data-action="retry-delayed">
        <i class="fas fa-clock"></i> Retry in 5s
      </button>
    `;
  } else {
    actionButtons = `
      <button class="error-action-btn" data-action="retry">
        <i class="fas fa-redo"></i> Try Again
      </button>
    `;
  }
  
  const errorContent = `
    <div class="error-message">
      <div class="error-header">
        <i class="fas fa-exclamation-triangle"></i>
        ${errorTitle}
      </div>
      <div class="error-content">${message}</div>
      <div class="error-actions">
        ${actionButtons}
      </div>
    </div>
  `;

  errorEl.innerHTML = errorContent;
  
  // Add event listeners for error action buttons
  const actionBtns = errorEl.querySelectorAll('.error-action-btn');
  actionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      handleErrorAction(action);
    });
  });

  elements.chatMessages.appendChild(errorEl);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function handleErrorAction(action) {
  switch (action) {
    case 'configure-api':
      chrome.runtime.openOptionsPage();
      break;
    case 'retry':
      retryLastMessage();
      break;
    case 'refresh':
      location.reload();
      break;
    case 'retry-delayed':
      setTimeout(() => retryLastMessage(), 5000);
      break;
  }
}

function addMessage(content, sender, save = true) {
  const { chatMessages } = elements;
  if (!chatMessages) return null;

  // Remove welcome message
  chatMessages.querySelector('.welcome-message')?.remove();

  // Create message structure
  const messageEl = document.createElement('div');
  messageEl.classList.add('message', sender);

  const messageHeader = createMessageHeader(sender);
  const messageContent = document.createElement('div');
  messageContent.classList.add('message-content');

  messageEl.appendChild(messageHeader);
  messageEl.appendChild(messageContent);

  // Add action buttons for AI messages
  if (sender === 'ai') {
    messageContent.appendChild(createMessageActions(content));
  }

  chatMessages.appendChild(messageEl);

  // Handle content display - universal formatting for all content
  const formattedContent = formatAIResponse(content);
  if (sender === 'ai') {
    // IMPORTANT: All AI messages MUST use streaming animation
    // Stop any existing streaming
    if (state.currentStreamingController) {
      state.currentStreamingController();
    }
    
    // Start new streaming animation for AI responses
    state.currentStreamingController = startTypingEffect(messageContent, formattedContent);
  } else {
    // System and user messages display immediately without streaming
    messageContent.innerHTML = formattedContent;
  }

  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Save to history
  if (save) {
    state.chatHistory.push({ content, sender, timestamp: new Date() });
  }

  return messageEl;
  }

function createMessageHeader(sender) {
  const header = document.createElement('div');
  header.classList.add('message-header');

  const avatar = document.createElement('div');
  avatar.classList.add('message-avatar');
  avatar.innerHTML = sender === 'user' ? 'U' : '<i class="fas fa-robot"></i>';

  const senderName = document.createElement('span');
  senderName.classList.add('message-sender');
  senderName.textContent = sender === 'user' ? 'You' : 'Nation Assistant';

  const time = document.createElement('span');
  time.classList.add('message-time');
  time.textContent = formatTime();

  header.append(avatar, senderName, time);
  return header;
  }

function createMessageActions(content) {
  const actionsEl = document.createElement('div');
  actionsEl.classList.add('message-actions');
  
  actionsEl.innerHTML = `
    <button class="action-btn" data-action="copy" title="Copy message">
      <i class="fas fa-copy"></i> Copy
    </button>
    <button class="action-btn" data-action="regenerate" title="Regenerate response">
      <i class="fas fa-redo"></i> Retry
    </button>
  `;

  // Add event listeners for action buttons
  actionsEl.addEventListener('click', (e) => {
    const button = e.target.closest('.action-btn');
    if (!button) return;

    const action = button.dataset.action;
    handleMessageAction(action, content, button);
  });

  return actionsEl;
  }

function handleMessageAction(action, content, button) {
  switch (action) {
    case 'copy':
      copyToClipboard(content, button);
      break;
    case 'regenerate':
      regenerateLastResponse(button);
      break;
  }
  }

function copyToClipboard(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    // Show success feedback
    button.classList.add('success');
    button.innerHTML = '<i class="fas fa-check"></i> Copied!';
    
    setTimeout(() => {
      button.classList.remove('success');
      button.innerHTML = '<i class="fas fa-copy"></i> Copy';
    }, 2000);
  }).catch(() => {
    showError('Failed to copy to clipboard');
  });
  }

function regenerateLastResponse(button) {
  if (state.isProcessing) return;
  
  // Get the last user message
  const lastUserMessage = state.chatHistory.slice().reverse().find(msg => msg.sender === 'user');
  if (!lastUserMessage) return;

  // Show loading state on button
  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Retrying...';
  button.disabled = true;

  // Resend the last message
  handleSendMessage(lastUserMessage.content, true);
  }

// Modern welcome message with actionable suggestions
function showWelcomeMessage() {
  const { chatMessages } = elements;
  if (!chatMessages) return;

  const welcomeEl = document.createElement('div');
  welcomeEl.classList.add('welcome-message');
  welcomeEl.innerHTML = `
    <div class="welcome-icon"><i class="fas fa-robot"></i></div>
    <div class="welcome-title">Welcome to Nation Assistant</div>
    <div class="welcome-subtitle">
      I can help you understand and analyze this webpage. Here are some things you can try:
    </div>
    <div class="welcome-suggestions">
      <button class="suggestion-btn" data-message="What is this page about?">
        📄 Analyze this page
      </button>
      <button class="suggestion-btn" data-message="Summarize the main points">
        📝 Summarize content
      </button>
      <button class="suggestion-btn" data-message="What are the key takeaways?">
        💡 Key insights
      </button>
    </div>
    <div class="welcome-tip">
      💡 <strong>Tip:</strong> Select text on any page and right-click to analyze it directly!
    </div>
  `;

  // Add event listeners for suggestion buttons
  const suggestionBtns = welcomeEl.querySelectorAll('.suggestion-btn');
  suggestionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const message = btn.dataset.message;
      if (message) {
        handleSendMessage(message);
      }
    });
  });

  chatMessages.appendChild(welcomeEl);
}

/**
 * Advanced streaming animation for AI responses
 */
function startTypingEffect(element, finalContent) {
  // Clear any existing content
  element.innerHTML = '';
  
  // Create a temporary container to parse the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = finalContent;
  
  // Get all text nodes and elements for streaming
  const streamableContent = extractStreamableContent(tempDiv);
  
  // Start the streaming animation and return the controller
  return streamContent(element, streamableContent);
}

/**
 * Extract content that can be streamed (text nodes and elements)
 */
function extractStreamableContent(container) {
  const content = [];
  
  function traverse(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text) {
        // Split text into words and spaces for natural streaming
        const parts = text.split(/(\s+)/);
        parts.forEach(part => {
          if (part) {
            content.push({ 
              type: 'text', 
              content: part,
              isWhitespace: /^\s+$/.test(part)
            });
          }
        });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      
      // Handle different element types
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        // Headers are treated as complete blocks
        const headerElement = node.cloneNode(true);
        content.push({ 
          type: 'element', 
          element: headerElement,
          content: node.textContent,
          isBlock: true 
        });
      } else if (['p', 'div', 'li', 'blockquote'].includes(tagName)) {
        content.push({ 
          type: 'element_start', 
          element: node.cloneNode(false),
          isBlock: true 
        });
        
        // Process children
        Array.from(node.childNodes).forEach(child => traverse(child));
        
        content.push({ 
          type: 'element_end', 
          tagName: tagName,
          isBlock: true 
        });
      } else if (['ul', 'ol'].includes(tagName)) {
        content.push({ 
          type: 'element_start', 
          element: node.cloneNode(false),
          isBlock: true 
        });
        
        // Process list items
        Array.from(node.children).forEach(child => traverse(child));
        
        content.push({ 
          type: 'element_end', 
          tagName: tagName,
          isBlock: true 
        });
      } else if (['pre', 'code'].includes(tagName)) {
        // Code blocks are treated as complete elements
        const codeElement = node.cloneNode(true);
        content.push({ 
          type: 'element', 
          element: codeElement,
          content: node.textContent,
          isBlock: tagName === 'pre' 
        });
      } else if (['strong', 'em', 'a', 'span'].includes(tagName)) {
        content.push({ 
          type: 'element_start', 
          element: node.cloneNode(false),
          isBlock: false 
        });
        
        Array.from(node.childNodes).forEach(child => traverse(child));
        
        content.push({ 
          type: 'element_end', 
          tagName: tagName,
          isBlock: false 
        });
      } else if (['br'].includes(tagName)) {
        // Line breaks are treated as single elements
        content.push({ 
          type: 'element', 
          element: node.cloneNode(false),
          content: '',
          isBlock: false 
        });
      } else if (['table', 'thead', 'tbody', 'tr', 'th', 'td'].includes(tagName)) {
        // Tables are treated as complete blocks for better formatting
        if (tagName === 'table') {
          const tableElement = node.cloneNode(true);
          content.push({ 
            type: 'element', 
            element: tableElement,
            content: node.textContent,
            isBlock: true 
          });
        } else {
          // For table sub-elements, process normally
          content.push({ 
            type: 'element_start', 
            element: node.cloneNode(false),
            isBlock: ['thead', 'tbody', 'tr'].includes(tagName)
          });
          
          Array.from(node.childNodes).forEach(child => traverse(child));
          
          content.push({ 
            type: 'element_end', 
            tagName: tagName,
            isBlock: ['thead', 'tbody', 'tr'].includes(tagName)
          });
        }
      } else {
        // For other elements, just process children
        Array.from(node.childNodes).forEach(child => traverse(child));
      }
    }
  }
  
  Array.from(container.childNodes).forEach(child => traverse(child));
  
  // Filter out empty content and optimize
  return content.filter(item => {
    if (item.type === 'text') {
      return item.content.length > 0;
    }
    return true;
  });
}

/**
 * Stream content with smooth animation and enhanced user controls
 */
function streamContent(element, contentArray) {
  element.innerHTML = '';
  
  let currentIndex = 0;
  let elementStack = [element];
  let isStreaming = true;
  let streamingSpeed = 1; // 1 = normal, 3 = fast, 0 = instant
  let speedIndicator = null;
  
  // Add streaming cursor
  const cursor = document.createElement('span');
  cursor.className = 'streaming-cursor';
  cursor.textContent = '▋';
  
  // Create speed indicator
  function createSpeedIndicator() {
    speedIndicator = document.createElement('div');
    speedIndicator.className = 'streaming-speed-indicator';
    speedIndicator.textContent = getSpeedText();
    element.style.position = 'relative';
    element.appendChild(speedIndicator);
  }
  
  function getSpeedText() {
    switch (streamingSpeed) {
      case 1: return 'Normal Speed';
      case 3: return '3x Speed';
      default: return 'Instant';
    }
  }
  
  function updateSpeedIndicator() {
    if (speedIndicator) {
      speedIndicator.textContent = getSpeedText();
      speedIndicator.classList.add('visible');
      setTimeout(() => {
        if (speedIndicator) {
          speedIndicator.classList.remove('visible');
        }
      }, 1500);
    }
  }
  
  // Add click handler to speed up streaming
  const clickHandler = (e) => {
    if (isStreaming && !e.target.closest('.message-actions')) {
      e.preventDefault();
      e.stopPropagation();
      
      // Cycle through speeds: Normal -> Fast -> Instant
      if (streamingSpeed === 1) {
        streamingSpeed = 3;
        updateSpeedIndicator();
      } else if (streamingSpeed === 3) {
        streamingSpeed = 0;
        finishStreaming();
      }
    }
  };
  
  // Add double-click handler for instant completion
  const doubleClickHandler = (e) => {
    if (isStreaming) {
      e.preventDefault();
      e.stopPropagation();
      finishStreaming();
    }
  };
  
  element.addEventListener('click', clickHandler);
  element.addEventListener('dblclick', doubleClickHandler);
  
  // Create speed indicator
  createSpeedIndicator();
  
  function finishStreaming() {
    isStreaming = false;
    
    // Remove cursor and speed indicator
    const existingCursor = element.querySelector('.streaming-cursor');
    if (existingCursor) {
      existingCursor.remove();
    }
    
    if (speedIndicator) {
      speedIndicator.remove();
      speedIndicator = null;
    }
    
    // Show complete content instantly
    element.innerHTML = '';
    const newElementStack = [element];
    contentArray.forEach(item => {
      processStreamItem(item, newElementStack, element);
    });
    
    // Clean up event listeners
    element.removeEventListener('click', clickHandler);
    element.removeEventListener('dblclick', doubleClickHandler);
    
    // Scroll to bottom
    if (elements.chatMessages) {
      elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }
  }
  
  function processStreamItem(item, stack, rootElement) {
    const currentContainer = stack[stack.length - 1];
    
    switch (item.type) {
      case 'text':
        const textNode = document.createTextNode(item.content);
        currentContainer.appendChild(textNode);
        break;
        
      case 'element':
        const completeElement = item.element.cloneNode(false);
        completeElement.textContent = item.content;
        currentContainer.appendChild(completeElement);
        break;
        
      case 'element_start':
        const startElement = item.element.cloneNode(false);
        currentContainer.appendChild(startElement);
        stack.push(startElement);
        break;
        
      case 'element_end':
        if (stack.length > 1) {
          stack.pop();
        }
        break;
    }
  }
  
  function streamNext() {
    if (!isStreaming || currentIndex >= contentArray.length) {
      finishStreaming();
      return;
    }
    
    const item = contentArray[currentIndex];
    
    // Remove existing cursor
    const existingCursor = element.querySelector('.streaming-cursor');
    if (existingCursor) {
      existingCursor.remove();
    }
    
    // Process the current item
    processStreamItem(item, elementStack, element);
    
    // Add cursor at the end of current container
    const currentContainer = elementStack[elementStack.length - 1];
    currentContainer.appendChild(cursor);
    
    // Scroll to bottom smoothly
    if (elements.chatMessages) {
      elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }
    
    currentIndex++;
    
    // Calculate delay based on content type and streaming speed
    let baseDelay = 50;
    
    if (item.type === 'text') {
      // Adjust delay based on word length and content
      const wordLength = item.content.trim().length;
      if (wordLength === 0) {
        baseDelay = 10; // Spaces and whitespace
      } else if (wordLength <= 3) {
        baseDelay = 30; // Short words
      } else if (wordLength <= 8) {
        baseDelay = 50; // Medium words
      } else {
        baseDelay = 80; // Long words
      }
    } else if (item.type === 'element' && item.isBlock) {
      baseDelay = 150; // Block elements get longer pause
    } else if (item.type === 'element_start' || item.type === 'element_end') {
      baseDelay = 20; // Quick for structural elements
    }
    
    // Apply speed multiplier
    const delay = Math.max(5, Math.round(baseDelay / streamingSpeed));
    
    setTimeout(streamNext, delay);
  }
  
  // Start streaming after a brief delay
  setTimeout(streamNext, 100);
  
  // Return a function to stop streaming
  return () => {
    finishStreaming();
  };
}

function typeFormattedContent(element, content) {
  const chunks = getTypingChunks(content);
  let currentChunk = 0;
  
  element.innerHTML = '';
  
  function typeNextChunk() {
    if (currentChunk < chunks.length) {
      element.innerHTML += chunks[currentChunk];
      currentChunk++;
      
      // Scroll to bottom
      if (elements.chatMessages) {
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
      }
      
      setTimeout(typeNextChunk, 50); // Faster for chunks
    }
  }
  
  typeNextChunk();
  }

function typeSimpleContent(element, content) {
  let currentIndex = 0;
  const typingSpeed = 20;
  
  element.innerHTML = '';
  
  function typeNextChar() {
    if (currentIndex < content.length) {
      element.innerHTML = content.substring(0, currentIndex + 1);
      currentIndex++;
      
      if (elements.chatMessages) {
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
      }
      
      setTimeout(typeNextChar, typingSpeed);
    }
  }
  
  typeNextChar();
  }

function getTypingChunks(html) {
  const chunks = [];
  let currentChunk = '';
  let inTag = false;
  let tagDepth = 0;
  
  for (let i = 0; i < html.length; i++) {
    const char = html[i];
    
    if (char === '<') {
      inTag = true;
      tagDepth++;
    } else if (char === '>') {
      inTag = false;
      tagDepth--;
    }
    
    currentChunk += char;
    
    // Create chunk when we complete a tag or reach text content
    if (!inTag && tagDepth === 0 && (char === '>' || currentChunk.length >= 10)) {
      chunks.push(currentChunk);
      currentChunk = '';
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks.filter(chunk => chunk.trim());
  }

function showTypingIndicator() {
  const { chatMessages } = elements;
  if (!chatMessages) return;

  const typingEl = document.createElement('div');
  typingEl.classList.add('typing-indicator');
  typingEl.id = 'typing-indicator';
  typingEl.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-status">Thinking...</div>
  `;
  
  chatMessages.appendChild(typingEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  }

function hideTypingIndicator() {
  document.getElementById('typing-indicator')?.remove();
  }

  // Error handling utilities
function detectErrorType(message) {
  if (message.includes('API key') || message.includes('401') || message.includes('403')) {
    return 'apiKey';
  }
  if (message.includes('fetch') || message.includes('network') || message.includes('timeout')) {
    return 'network';
  }
  return 'generic';
  }

function setProcessing(processing, statusText = 'Thinking...') {
  const { sendBtn, chatInput, inputContainer } = elements;
  state.isProcessing = processing;

  // Update send button
  if (sendBtn) {
    sendBtn.disabled = processing || !chatInput?.value.trim();
    if (processing) {
      sendBtn.innerHTML = '<div class="loading-spinner"></div>';
      sendBtn.style.background = 'rgba(255, 255, 255, 0.1)';
      sendBtn.style.color = '#666666';
    } else {
      sendBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
      handleInputChange();
    }
  }

  // Update input container
  if (inputContainer) {
    inputContainer.style.transition = 'opacity 0.3s ease';
    inputContainer.style.opacity = processing ? '0.7' : '1';
  }

  // Update input placeholder
  if (chatInput) {
    chatInput.disabled = processing;
    chatInput.placeholder = processing 
      ? `Nation Assistant is ${statusText.toLowerCase()}...`
      : 'Message Nation Assistant...';
  }

  // Update typing indicator
  const typingStatus = document.querySelector('.typing-status');
  if (typingStatus && processing) {
    typingStatus.textContent = statusText;
  }
  }

async function loadCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      state.currentTabId = tab.id;
      
      const { tabTitle, tabUrl } = elements;
      if (tabTitle) tabTitle.textContent = tab.title || 'Current Page';
      if (tabUrl) tabUrl.textContent = tab.url ? new URL(tab.url).hostname : '';
      
      // Test connection status
      updateConnectionStatus();
    }
  } catch (error) {
    // Silently handle error
    updateConnectionStatus(false);
  }
}

async function updateConnectionStatus(forceStatus = null) {
  const statusElement = document.querySelector('.connection-status');
  if (!statusElement) return;
  
  const statusDot = statusElement.querySelector('.status-dot');
  const statusText = statusElement.querySelector('.status-text');
  
  if (forceStatus === false) {
    statusDot.style.background = '#ff6b6b';
    statusText.textContent = 'Disconnected';
    return;
  }
  
  try {
    // Quick connection test
    await chrome.runtime.sendMessage({ type: 'testConnection' });
    statusDot.style.background = '#D0FF16';
    statusText.textContent = 'Connected';
  } catch (error) {
    statusDot.style.background = '#ff6b6b';
    statusText.textContent = 'API Error';
  }
}



  // Enable chat input
function enableChatInput() {
  const { chatInput, sendBtn } = elements;
  
  if (chatInput) {
    chatInput.disabled = false;
    chatInput.removeAttribute('disabled');
    chatInput.style.pointerEvents = 'auto';
    chatInput.style.opacity = '1';
  }

  if (sendBtn) {
    sendBtn.style.pointerEvents = 'auto';
    sendBtn.style.opacity = '1';
  }
}

async function hasContextAction() {
  try {
    const result = await chrome.storage.local.get(['contextAction']);
    return !!result.contextAction;
  } catch (error) {
    return false;
  }
}

async function handleContextAction() {
  try {
    const result = await chrome.storage.local.get(['contextAction']);
    const contextAction = result.contextAction;
    
    if (!contextAction) return;
    
    // Handle different context actions
    switch (contextAction.action) {
      case 'translate':
        handleTranslateAction(contextAction);
        break;
      case 'analyze':
        // Handle text analysis
        if (contextAction.text) {
          addSystemMessage(`Selected text: "${contextAction.text}"`);
          addAIMessage("I can help you understand, translate, or analyze this text. What would you like to know?");
        }
        break;
      default:
        // Generic context action - handle legacy format
        if (contextAction.text || contextAction.originalText) {
          const text = contextAction.text || contextAction.originalText;
          addSystemMessage(`Selected text: "${text}"`);
          addAIMessage("I can help you understand, translate, or analyze this text. What would you like to know?");
        }
    }
    
    // Don't clear context action here for translations - let the message handlers do it
    if (contextAction.action !== 'translate') {
      chrome.storage.local.remove(['contextAction']);
    }
  } catch (error) {
    console.error('Error handling context action:', error);
  }
}

function handleTranslateAction(contextAction) {
  const { originalText, targetLanguage, smart } = contextAction;
  
  // Show enhanced loading message with full context
  const loadingEl = document.createElement('div');
  loadingEl.id = 'translation-loading';
  loadingEl.classList.add('message', 'system');
  
  const displayText = originalText.length > 100 ? 
    originalText.substring(0, 100) + '...' : originalText;
  
  loadingEl.innerHTML = `
    <div class="message-content">
      <div class="translation-context">
        <div class="translation-header">
          <div class="loading-spinner"></div>
          <span>${smart ? '🌐 Smart Translation' : '🔄 Translation'} in progress...</span>
        </div>
        <div class="original-text">
          <strong>Original:</strong> "${displayText}"
        </div>
        <div class="target-info">
          <strong>Target:</strong> ${targetLanguage}
        </div>
      </div>
    </div>
  `;
  elements.chatMessages.appendChild(loadingEl);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function handleSummarizeAction(contextAction) {
  const { text } = contextAction;
  addMessage(`Selected text: "${text}"`, "system", false);
  handleSendMessage(`Please summarize this text: "${text}"`, false);
}

function handleExplainAction(contextAction) {
  const { text } = contextAction;
  addMessage(`Selected text: "${text}"`, "system", false);
  handleSendMessage(`Please explain this text: "${text}"`, false);
}

  // Check if there's a context action
async function hasContextAction() {
  try {
    const result = await chrome.storage.local.get(['contextAction']);
    return result.contextAction && (Date.now() - result.contextAction.timestamp < 30000); // 30 seconds
  } catch (error) {
    return false;
  }
}



// Listen for translation updates from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TRANSLATION_READY') {
    // Remove loading message
    const loadingMsg = document.getElementById('translation-loading');
    if (loadingMsg) {
      loadingMsg.remove();
    }
    
    // Create enhanced translation result display
    showTranslationResult(message);
    
    // Clear the context action
    chrome.storage.local.remove(['contextAction']);
  } else if (message.type === 'TRANSLATION_ERROR') {
    // Remove loading message
    const loadingMsg = document.getElementById('translation-loading');
    if (loadingMsg) {
      loadingMsg.remove();
    }
    
    // Show error with AI streaming for consistency
    addAIMessage(`❌ Translation failed: ${message.error}`);
    
    // Clear the context action
    chrome.storage.local.remove(['contextAction']);
  }
});

function showTranslationResult(translationData) {
  const { translation, targetLanguage, detectedLanguage, smart } = translationData;
  
  // Create enhanced translation display using the standard addMessage with streaming
  const messageEl = document.createElement('div');
  messageEl.classList.add('message', 'ai');
  
  const messageHeader = createMessageHeader('ai');
  const messageContent = document.createElement('div');
  messageContent.classList.add('message-content');
  
  // Build the translation HTML content
  let translationHTML = `
    <div class="translation-result">
      <div class="translation-header">
        <div class="translation-badge">
          ${smart ? '🌐 Smart Translation' : '🔄 Translation'}
        </div>
        ${smart && detectedLanguage ? `<div class="language-info">
          <span class="detected-lang">${detectedLanguage}</span> → <span class="target-lang">${targetLanguage}</span>
        </div>` : `<div class="language-info">
          <span class="target-lang">→ ${targetLanguage}</span>
        </div>`}
      </div>
      <div class="translation-content">
        <div class="translation-text">${escapeHtml(translation)}</div>
      </div>
      <div class="translation-actions">
        <button class="action-btn copy-translation" data-text="${escapeHtml(translation)}" title="Copy translation">
          <i class="fas fa-copy"></i> Copy
        </button>
        <button class="action-btn explain-translation" title="Explain this translation">
          <i class="fas fa-question-circle"></i> Explain
        </button>
        <button class="action-btn alternative-translation" title="Get alternative translation">
          <i class="fas fa-sync-alt"></i> Alternative
        </button>
      </div>
    </div>
  `;
  
  messageEl.appendChild(messageHeader);
  messageEl.appendChild(messageContent);
  
  // Add action buttons for AI messages (standard pattern)
  messageContent.appendChild(createMessageActions(translation));
  
  elements.chatMessages.appendChild(messageEl);

  // Stop any existing streaming
  if (state.currentStreamingController) {
    state.currentStreamingController();
  }
  
  // Start streaming animation for the translation result
  state.currentStreamingController = startTypingEffect(messageContent, translationHTML);
  
  // Add event listeners for translation-specific action buttons after streaming completes
  setTimeout(() => {
    const translationActions = messageContent.querySelector('.translation-actions');
    if (translationActions) {
      translationActions.addEventListener('click', (e) => {
        const button = e.target.closest('.action-btn');
        if (!button) return;
        
        if (button.classList.contains('copy-translation')) {
          copyTranslation(button.dataset.text, button);
        } else if (button.classList.contains('explain-translation')) {
          handleSendMessage(`Please explain this translation: "${translation}"`, false);
        } else if (button.classList.contains('alternative-translation')) {
          handleSendMessage(`Please provide an alternative translation for: "${translation}"`, false);
        }
      });
    }
  }, 1000); // Wait for streaming to complete
  
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  
  // Add follow-up suggestion with streaming animation
  setTimeout(() => {
    addAIMessage("💡 You can ask me to explain the translation, provide alternatives, or continue our conversation!");
  }, 2000); // Delay to let translation streaming finish first
}

function copyTranslation(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    // Show success feedback
    const originalHTML = button.innerHTML;
    button.innerHTML = '<i class="fas fa-check"></i> Copied!';
    button.classList.add('success');
    
    setTimeout(() => {
      button.innerHTML = originalHTML;
      button.classList.remove('success');
    }, 2000);
  }).catch(() => {
    // Show error feedback
    const originalHTML = button.innerHTML;
    button.innerHTML = '<i class="fas fa-times"></i> Failed';
    button.classList.add('error');
    
    setTimeout(() => {
      button.innerHTML = originalHTML;
      button.classList.remove('error');
    }, 2000);
  });
}
