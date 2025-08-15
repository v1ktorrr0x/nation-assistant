// nation assistant chat sidepanel
'use strict';

// Enable comprehensive logging for debugging
const DEBUG = true;
const logger = {
  log: (message, ...args) => {
    if (DEBUG) console.log(`[Sidepanel] ${message}`, ...args);
  },
  warn: (message, ...args) => {
    if (DEBUG) console.warn(`[Sidepanel] ${message}`, ...args);
  },
  error: (message, ...args) => {
    if (DEBUG) console.error(`[Sidepanel] ${message}`, ...args);
  },
  debug: (message, ...args) => {
    if (DEBUG) console.debug(`[Sidepanel] ${message}`, ...args);
  }
};

// ai response formatting system

/**
 * minimal ai response formatter - preserves original llm structure
 * only applies essential markdown formatting while maintaining original content flow
 */
class AIResponseFormatter {
  constructor() {
    // minimal patterns - only essential markdown elements
    this.patterns = {
      // headers - only if explicitly marked with #
      h1: /^# (.+)$/gm,
      h2: /^## (.+)$/gm,
      h3: /^### (.+)$/gm,
      h4: /^#### (.+)$/gm,
      h5: /^##### (.+)$/gm,
      h6: /^###### (.+)$/gm,

      // lists - only if explicitly marked
      bulletList: /^(\s*)[-*+•] (.+)$/gm,
      numberedList: /^(\s*)\d+\. (.+)$/gm,

      // basic text formatting
      bold: /\*\*(.*?)\*\*/g,
      italic: /\*([^*\n]+)\*/g,
      code: /`([^`\n]+)`/g,

      // code blocks
      codeBlock: /```(\w+)?\n?([\s\S]*?)```/g,

      // links
      markdownLink: /\[([^\]]+)\]\(([^)]+)\)/g,
      autoLink: /(https?:\/\/[^\s<>"'`]+)/g,

      // blockquotes
      blockquote: /^> (.+)$/gm,

      // horizontal rules
      horizontalRule: /^---+$/gm
    };

    // minimal state tracking
    this.parsingState = {
      inCodeBlock: false,
      listStack: [],
      currentIndent: 0
    };
  }

  /**
   * Format content with minimal processing to preserve original structure
   */
  format(content) {
    if (!content || typeof content !== 'string') {
      return '<div class="ai-error">Invalid response content</div>';
    }

    try {
      // reset parsing state
      this.resetParsingState();

      // minimal normalization - preserve original line breaks and spacing
      const normalized = this.minimalNormalize(content);

      // process with minimal changes to preserve llm structure
      const processed = this.processWithMinimalChanges(normalized);

      return processed;
    } catch (error) {
      console.error('AI Response formatting error:', error);
      return `<div class="ai-error">Formatting error: ${error.message}</div>`;
    }
  }

  resetParsingState() {
    this.parsingState = {
      inCodeBlock: false,
      listStack: [],
      currentIndent: 0
    };
  }

  /**
   * Minimal normalization - preserve original structure as much as possible
   */
  minimalNormalize(content) {
    return content
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // don't convert tabs or trim - preserve original spacing
      ;
  }

  /**
   * Process content with minimal changes to preserve LLM's original structure
   * Only apply essential formatting while keeping the natural flow
   */
  processWithMinimalChanges(content) {
    // process line by line but preserve original paragraph structure
    const lines = content.split('\n');
    const processedLines = [];
    let currentParagraph = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Handle code blocks first (preserve exactly as is)
      if (trimmed.startsWith('```')) {
        // Finish current paragraph if any
        if (currentParagraph.length > 0) {
          processedLines.push(this.processParagraph(currentParagraph.join('\n')));
          currentParagraph = [];
        }

        const codeBlockResult = this.handleCodeBlock(line, lines, i);
        processedLines.push(codeBlockResult.html);
        i += codeBlockResult.skipLines - 1; // -1 because loop will increment
        continue;
      }

      // Skip processing if inside code block
      if (this.parsingState.inCodeBlock) {
        processedLines.push(this.escapeHtml(line));
        continue;
      }

      // Handle explicit markdown elements
      if (this.isExplicitMarkdownElement(trimmed)) {
        // Finish current paragraph if any
        if (currentParagraph.length > 0) {
          processedLines.push(this.processParagraph(currentParagraph.join('\n')));
          currentParagraph = [];
        }

        // Process the markdown element
        processedLines.push(this.processMarkdownElement(line));
        continue;
      }

      // Handle empty lines - preserve paragraph breaks
      if (!trimmed) {
        if (currentParagraph.length > 0) {
          processedLines.push(this.processParagraph(currentParagraph.join('\n')));
          currentParagraph = [];
        }
        processedLines.push(''); // Preserve empty line
        continue;
      }

      // Regular content - accumulate into paragraph
      currentParagraph.push(line);
    }

    // Process any remaining paragraph
    if (currentParagraph.length > 0) {
      processedLines.push(this.processParagraph(currentParagraph.join('\n')));
    }

    // Close any open elements
    const closingTags = this.getClosingTags();
    if (closingTags) {
      processedLines.push(closingTags);
    }

    return processedLines.join('\n');
  }

  /**
   * Check if a line is an explicit markdown element (starts with markdown syntax)
   */
  isExplicitMarkdownElement(line) {
    return (
      line.match(/^#{1,6} /) ||           // Headers
      line.match(/^(\s*)[-*+•] /) ||      // Bullet lists
      line.match(/^(\s*)\d+\. /) ||       // Numbered lists
      line.match(/^> /) ||                // Blockquotes
      line.match(/^---+$/)                // Horizontal rules
    );
  }

  /**
   * Process explicit markdown elements
   */
  processMarkdownElement(line) {
    const trimmed = line.trim();

    // Headers
    const headerMatch = trimmed.match(/^(#{1,6}) (.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const content = this.processInlineFormatting(headerMatch[2]);
      return `<h${level}>${content}</h${level}>`;
    }

    // Horizontal rules
    if (this.patterns.horizontalRule.test(trimmed)) {
      return '<hr>';
    }

    // Blockquotes
    const blockquoteMatch = line.match(/^> (.+)$/);
    if (blockquoteMatch) {
      const content = this.processInlineFormatting(blockquoteMatch[1]);
      return `<blockquote>${content}</blockquote>`;
    }

    // Lists
    const bulletMatch = line.match(/^(\s*)[-*+•] (.+)$/);
    const numberMatch = line.match(/^(\s*)\d+\. (.+)$/);

    if (bulletMatch || numberMatch) {
      return this.processListItem(line, bulletMatch, numberMatch);
    }

    // Fallback to paragraph
    return this.processParagraph(line);
  }

  /**
   * Process a paragraph with minimal formatting - preserve original line breaks
   */
  processParagraph(content) {
    if (!content.trim()) return '';

    // Apply only inline formatting, preserve line structure
    const formatted = this.processInlineFormatting(content);

    // Convert single line breaks to <br> to preserve original formatting
    const withBreaks = formatted.replace(/\n/g, '<br>');

    return `<p>${withBreaks}</p>`;
  }

  /**
   * Handle code blocks - preserve exactly as LLM sent them
   */
  handleCodeBlock(line, allLines, currentIndex) {
    const trimmed = line.trim();
    const match = trimmed.match(/^```(\w+)?/);

    if (!this.parsingState.inCodeBlock) {
      // Starting a code block
      this.parsingState.inCodeBlock = true;
      const language = match[1] || 'text';

      // Find the closing ```
      let endIndex = currentIndex + 1;
      let codeContent = [];

      while (endIndex < allLines.length) {
        const nextLine = allLines[endIndex];
        if (nextLine.trim() === '```') {
          break;
        }
        // Preserve original spacing and content exactly
        codeContent.push(this.escapeHtml(nextLine));
        endIndex++;
      }

      this.parsingState.inCodeBlock = false;

      const codeHtml = `<pre><code class="language-${language}">${codeContent.join('\n')}</code></pre>`;
      return { html: codeHtml, skipLines: endIndex - currentIndex + 1 };
    } else {
      // Closing a code block
      this.parsingState.inCodeBlock = false;
      return { html: '', skipLines: 1 };
    }
  }

  /**
   * Process list items with minimal nesting logic
   */
  processListItem(line, bulletMatch, numberMatch) {
    const isNumbered = !!numberMatch;
    const match = bulletMatch || numberMatch;
    const indent = match[1].length;
    const content = match[2];

    const listType = isNumbered ? 'ol' : 'ul';
    let html = '';

    // Simple list handling - minimal nesting
    if (this.parsingState.listStack.length === 0) {
      // Starting first list
      html += `<${listType}>`;
      this.parsingState.listStack.push(listType);
      this.parsingState.currentIndent = indent;
    } else if (indent > this.parsingState.currentIndent) {
      // Starting nested list
      html += `<${listType}>`;
      this.parsingState.listStack.push(listType);
      this.parsingState.currentIndent = indent;
    } else if (indent < this.parsingState.currentIndent) {
      // Closing nested lists
      while (this.parsingState.listStack.length > 0 && indent < this.parsingState.currentIndent) {
        const closingType = this.parsingState.listStack.pop();
        html += `</${closingType}>`;
        this.parsingState.currentIndent = Math.max(0, this.parsingState.currentIndent - 2);
      }

      // Start new list if needed
      if (this.parsingState.listStack.length === 0) {
        html += `<${listType}>`;
        this.parsingState.listStack.push(listType);
        this.parsingState.currentIndent = indent;
      }
    }

    // Add list item with minimal processing
    const processedContent = this.processInlineFormatting(content);
    html += `<li>${processedContent}</li>`;

    return html;
  }

  /**
   * Minimal inline formatting - only process explicit markdown with better word boundary handling
   */
  processInlineFormatting(text) {
    if (!text) return '';

    return text
      // Process code first to avoid conflicts
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')

      // Links (only explicit markdown links and URLs)
      .replace(this.patterns.markdownLink, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(this.patterns.autoLink, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')

      // Basic text formatting - improved patterns to avoid breaking within words
      .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
  }

  /**
   * Close any open elements
   */
  getClosingTags() {
    let closingTags = '';

    // Close any open lists
    if (this.parsingState.listStack.length > 0) {
      closingTags += this.parsingState.listStack.reverse().map(type => `</${type}>`).join('');
      this.parsingState.listStack = [];
    }

    return closingTags;
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
 * Main formatting function - preserves original LLM structure
 */
function formatAIResponse(content) {
  return aiFormatter.format(content);
}

// formatting functions removed - using simple approach

// utility functions

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Smooth scroll to bottom of chat messages
 */
function smoothScrollToBottom() {
  if (elements.chatMessages) {
    // Use smooth scrolling for better UX
    elements.chatMessages.scrollTo({
      top: elements.chatMessages.scrollHeight,
      behavior: 'smooth'
    });
  }
}

/**
 * Instant scroll to bottom (for rapid streaming)
 */
function instantScrollToBottom() {
  if (elements.chatMessages) {
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  }
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
    } else {
      // If no input footer exists, don't create the counter
      return;
    }
  }

  // Calculate remaining characters
  const remaining = maxLength - length;

  // Update counter display (only if counter exists and is in DOM)
  if (counter && counter.parentNode) {
    counter.textContent = `${length}/${maxLength}`;

    // Update counter color based on remaining characters
    if (remaining < 0) {
      counter.className = 'char-counter error';
    } else if (remaining < 100) {
      counter.className = 'char-counter warning';
    } else {
      counter.className = 'char-counter';
    }
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
  try {
    logger.log('Retry attempt - lastUserMessage:', state.lastUserMessage, 'isProcessing:', state.isProcessing);

    if (!state.lastUserMessage) {
      logger.warn('No last message to retry');
      addSystemMessage("No previous message to retry. Please send a new message.");
      return;
    }

    if (state.isProcessing) {
      logger.warn('Cannot retry while processing');
      addSystemMessage("Please wait for the current request to complete before retrying.");
      return;
    }

    logger.log('Retrying last message:', state.lastUserMessage);
    
    // Add a small delay to ensure UI state is properly reset
    setTimeout(() => {
      handleSendMessage(state.lastUserMessage, true);
    }, 100);
  } catch (error) {
    logger.error('Error retrying last message:', error);
    addSystemMessage("Failed to retry message. Please try sending a new message.");
  }
}



// Removed complex structured response functions - universal CSS handles all content types automatically



function formatTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}



// main application

// global state and elements
let elements = {};
let state = {
  chatHistory: [],
  isProcessing: false,
  currentTabId: null,
  currentStreamingController: null,
  lastUserMessage: null
};

// application functions

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
  
  logger.log('handleSendMessage called:', { messageText, isRegenerate, message, isProcessing: state.isProcessing });
  
  if (!message || state.isProcessing) {
    logger.warn('Message send blocked:', { hasMessage: !!message, isProcessing: state.isProcessing });
    return;
  }

  // Validate message length
  if (message.length > 4000) {
    showError('Message is too long. Please keep it under 4000 characters.', {});
    return;
  }

  // Store message for retry functionality (always store, even when regenerating)
  state.lastUserMessage = message;
  logger.log('Stored last user message for retry:', message);

  // Add user message (skip if regenerating)
  let userMessageEl = null;
  if (!isRegenerate) {
    userMessageEl = addMessage(message, "user");
    if (chatInput) {
      chatInput.value = "";
      handleInputChange();
    }
  }

  // Show immediate feedback with sleek status updates
  showTypingIndicator('SCANNING...', 'reading');
  setProcessing(true, isRegenerate ? 'REGENERATING...' : 'SCANNING...', 'reading');

  try {
    // Progressive status updates with terminal-style messages
    setTimeout(() => {
      updateTypingIndicator('PROCESSING...', 'analyzing');
      setProcessing(true, 'PROCESSING...', 'analyzing');
    }, 800);

    setTimeout(() => {
      updateTypingIndicator('GENERATING...', 'generating');
      setProcessing(true, 'GENERATING...', 'generating');
    }, 1600);

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

    // Update connection status based on error type
    if (error.message.includes('fetch') || error.message.includes('network')) {
      updateConnectionStatus('disconnected');
    } else if (error.message.includes('API key') || error.message.includes('401')) {
      updateConnectionStatus('error');
    }

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
  console.log('Showing error dialog:', { message, context });

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
      <div class="error-content">${escapeHtml(message)}</div>
      <div class="error-actions">
        ${actionButtons}
      </div>
    </div>
  `;

  errorEl.innerHTML = errorContent;

  elements.chatMessages.appendChild(errorEl);

  // Add event listeners for error action buttons after DOM insertion
  setTimeout(() => {
    const actionBtns = errorEl.querySelectorAll('.error-action-btn');
    console.log('Found action buttons:', actionBtns.length);

    actionBtns.forEach((btn, index) => {
      const action = btn.dataset.action;
      console.log(`Setting up button ${index}:`, action);

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Error action button clicked:', action);
        handleErrorAction(action, errorEl);
      });
    });
  }, 100);

  smoothScrollToBottom();
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

  chatMessages.appendChild(messageEl);

  // Handle content display - universal formatting for all content
  const formattedContent = formatAIResponse(content);
  if (sender === 'ai') {
    // Stop any existing streaming
    if (state.currentStreamingController) {
      state.currentStreamingController();
    }

    // Add streaming class for CSS styling
    messageContent.classList.add('streaming');

    // Start streaming animation for AI responses
    const streamingController = startTypingEffect(messageContent, formattedContent);
    state.currentStreamingController = streamingController;

    // Add action buttons after streaming completes
    setTimeout(() => {
      // Remove streaming class when done
      messageContent.classList.remove('streaming');

      if (!messageEl.querySelector('.message-actions')) {
        messageEl.appendChild(createMessageActions(content));
      }
    }, 3000);
  } else {
    // System and user messages display immediately without streaming
    messageContent.innerHTML = formattedContent;
  }

  smoothScrollToBottom();

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
      <i class="fas fa-copy"></i>
    </button>
    <button class="action-btn" data-action="regenerate" title="Regenerate response">
      <i class="fas fa-redo"></i>
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
    button.innerHTML = '<i class="fas fa-check"></i>';
    button.title = 'Copied!';

    setTimeout(() => {
      button.classList.remove('success');
      button.innerHTML = '<i class="fas fa-copy"></i>';
      button.title = 'Copy message';
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

  // Enhanced loading state on button
  button.innerHTML = '<div class="enhanced-loading-spinner"></div>';
  button.title = 'REGENERATING...';
  button.disabled = true;
  button.classList.add('processing');

  // Add visual feedback
  button.style.transform = 'scale(0.95)';
  button.style.background = 'rgba(208, 255, 22, 0.1)';
  button.style.borderColor = 'rgba(208, 255, 22, 0.3)';

  // Reset button state after processing
  const originalReset = () => {
    button.innerHTML = '<i class="fas fa-redo"></i>';
    button.title = 'Regenerate response';
    button.disabled = false;
    button.classList.remove('processing');
    button.style.transform = '';
    button.style.background = '';
    button.style.borderColor = '';
  };

  // Store reset function for cleanup
  button.dataset.resetFunction = 'originalReset';

  // Resend the last message
  handleSendMessage(lastUserMessage.content, true).finally(() => {
    setTimeout(originalReset, 500); // Small delay for better UX
  });
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
 * Enhanced streaming animation for AI responses - inspired by AI sidebar
 * Maintains structure during streaming while providing smooth animation
 */
function startTypingEffect(element, finalContent) {
  // Clear any existing content
  element.innerHTML = '';

  // Create a temporary container to parse the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = finalContent;

  // Get all text nodes and elements for streaming with enhanced structure preservation
  const streamableContent = extractStreamableContent(tempDiv);

  // Start the enhanced streaming animation and return the controller
  return streamContentWithStructure(element, streamableContent);
}

/**
 * Enhanced streaming function that preserves markdown structure
 * Inspired by AI sidebar's approach but adapted for Nation Assistant's style
 */
function streamContentWithStructure(element, streamableContent) {
  let currentIndex = 0;
  let isStreaming = true;
  let streamingSpeed = 50; // Base speed in milliseconds
  let currentElement = element;
  let elementStack = []; // Track nested elements

  // Create streaming cursor
  const cursor = document.createElement('span');
  cursor.className = 'streaming-cursor';
  cursor.textContent = '▊';

  // Speed control variables
  let speedMultiplier = 1;
  let isInstant = false;

  // Add click handlers for speed control (maintaining original functionality)
  let clickCount = 0;
  let clickTimer = null;

  const handleClick = () => {
    clickCount++;

    if (clickTimer) clearTimeout(clickTimer);

    clickTimer = setTimeout(() => {
      if (clickCount === 1) {
        // Single click - speed up
        speedMultiplier = Math.min(speedMultiplier * 2, 8);
        showSpeedIndicator('Faster');
      } else if (clickCount >= 2) {
        // Double click - instant
        isInstant = true;
        showSpeedIndicator('Instant');
      }
      clickCount = 0;
    }, 300);
  };

  element.addEventListener('click', handleClick);

  const showSpeedIndicator = (text) => {
    const indicator = document.createElement('div');
    indicator.className = 'streaming-speed-indicator visible';
    indicator.textContent = text;
    element.appendChild(indicator);

    setTimeout(() => {
      indicator.classList.remove('visible');
      setTimeout(() => indicator.remove(), 300);
    }, 1500);
  };

  const streamNext = () => {
    if (!isStreaming || currentIndex >= streamableContent.length) {
      // Streaming complete
      cursor.remove();
      element.classList.remove('streaming');
      element.removeEventListener('click', handleClick);
      // Final scroll to ensure we're at the bottom
      smoothScrollToBottom();
      return;
    }

    const item = streamableContent[currentIndex];

    // Handle instant mode
    if (isInstant) {
      // Add all remaining content instantly
      while (currentIndex < streamableContent.length) {
        const currentItem = streamableContent[currentIndex];
        processStreamItem(currentItem);
        currentIndex++;
      }
      cursor.remove();
      element.removeEventListener('click', handleClick);
      // Final scroll after instant completion
      smoothScrollToBottom();
      return;
    }

    processStreamItem(item);
    currentIndex++;

    // Calculate next delay based on content type and speed
    let delay = calculateDelay(item) / speedMultiplier;

    setTimeout(streamNext, delay);
  };

  const processStreamItem = (item) => {
    switch (item.type) {
      case 'text':
        // Add text content
        const textNode = document.createTextNode(item.content);
        currentElement.appendChild(textNode);

        // Update cursor position
        cursor.remove();
        currentElement.appendChild(cursor);
        break;

      case 'element':
        // Complete element (headers, code blocks, tables, etc.)
        cursor.remove();
        currentElement.appendChild(item.element);
        currentElement.appendChild(cursor);
        break;

      case 'element_start':
        // Start of an element
        cursor.remove();
        const newElement = item.element;
        currentElement.appendChild(newElement);

        // Push current element to stack and switch context
        elementStack.push(currentElement);
        currentElement = newElement;
        currentElement.appendChild(cursor);
        break;

      case 'element_end':
        // End of an element
        cursor.remove();

        // Pop back to parent element
        if (elementStack.length > 0) {
          currentElement = elementStack.pop();
        }
        currentElement.appendChild(cursor);
        break;
    }

    // Auto-scroll to bottom after each item
    instantScrollToBottom();
  };

  const calculateDelay = (item) => {
    // Enhanced delay calculation based on content type
    if (item.priority === 'high') {
      return streamingSpeed * 2; // Slower for important elements
    }

    if (item.isWhitespace) {
      return streamingSpeed * 0.3; // Faster for whitespace
    }

    if (item.isCodeBlock || item.isTable) {
      return streamingSpeed * 3; // Slower for complex elements
    }

    if (item.isInlineFormatting || item.isInlineCode) {
      return streamingSpeed * 0.5; // Faster for inline elements
    }

    if (item.type === 'element_start' || item.type === 'element_end') {
      return streamingSpeed * 0.2; // Very fast for structure elements
    }

    // Default text speed with some variation
    const baseDelay = streamingSpeed;
    const variation = Math.random() * 20 - 10; // ±10ms variation
    return Math.max(baseDelay + variation, 10);
  };

  // Start streaming
  streamNext();

  // Return controller function
  return () => {
    isStreaming = false;
    cursor.remove();
    element.removeEventListener('click', handleClick);
  };
}

/**
 * Enhanced streaming content extraction - inspired by AI sidebar
 * Extracts content that can be streamed while preserving markdown structure
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

      // Handle different element types with enhanced structure preservation
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        // Headers are treated as complete blocks for better visual impact
        const headerElement = node.cloneNode(true);
        content.push({
          type: 'element',
          element: headerElement,
          content: node.textContent,
          isBlock: true,
          priority: 'high' // Headers get priority in streaming
        });
      } else if (['p', 'div', 'blockquote'].includes(tagName)) {
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
        // Lists need special handling to maintain structure
        content.push({
          type: 'element_start',
          element: node.cloneNode(false),
          isBlock: true,
          listType: tagName
        });

        // Process list items with structure preservation
        Array.from(node.children).forEach(child => {
          if (child.tagName.toLowerCase() === 'li') {
            content.push({
              type: 'element_start',
              element: child.cloneNode(false),
              isBlock: false,
              isListItem: true
            });

            Array.from(child.childNodes).forEach(grandChild => traverse(grandChild));

            content.push({
              type: 'element_end',
              tagName: 'li',
              isBlock: false,
              isListItem: true
            });
          }
        });

        content.push({
          type: 'element_end',
          tagName: tagName,
          isBlock: true,
          listType: tagName
        });
      } else if (['li'].includes(tagName)) {
        // List items handled above in list processing
        content.push({
          type: 'element_start',
          element: node.cloneNode(false),
          isBlock: false,
          isListItem: true
        });

        Array.from(node.childNodes).forEach(child => traverse(child));

        content.push({
          type: 'element_end',
          tagName: tagName,
          isBlock: false,
          isListItem: true
        });
      } else if (['pre'].includes(tagName)) {
        // Code blocks are treated as complete elements for syntax integrity
        const codeElement = node.cloneNode(true);
        content.push({
          type: 'element',
          element: codeElement,
          content: node.textContent,
          isBlock: true,
          isCodeBlock: true,
          priority: 'high' // Code blocks get priority
        });
      } else if (['code'].includes(tagName)) {
        // Inline code - check if it's inside a pre block
        const isInlineCode = !node.closest('pre');
        if (isInlineCode) {
          content.push({
            type: 'element_start',
            element: node.cloneNode(false),
            isBlock: false,
            isInlineCode: true
          });

          Array.from(node.childNodes).forEach(child => traverse(child));

          content.push({
            type: 'element_end',
            tagName: tagName,
            isBlock: false,
            isInlineCode: true
          });
        }
      } else if (['strong', 'em', 'del', 'a', 'span'].includes(tagName)) {
        // Inline formatting elements
        content.push({
          type: 'element_start',
          element: node.cloneNode(false),
          isBlock: false,
          isInlineFormatting: true
        });

        Array.from(node.childNodes).forEach(child => traverse(child));

        content.push({
          type: 'element_end',
          tagName: tagName,
          isBlock: false,
          isInlineFormatting: true
        });
      } else if (['br', 'hr'].includes(tagName)) {
        // Self-closing elements
        content.push({
          type: 'element',
          element: node.cloneNode(false),
          content: '',
          isBlock: tagName === 'hr',
          isSelfClosing: true
        });
      } else if (['table', 'thead', 'tbody', 'tr', 'th', 'td'].includes(tagName)) {
        // Enhanced table handling
        if (tagName === 'table') {
          // Tables are treated as complete blocks for better formatting
          const tableElement = node.cloneNode(true);
          content.push({
            type: 'element',
            element: tableElement,
            content: node.textContent,
            isBlock: true,
            isTable: true,
            priority: 'high'
          });
        } else {
          // For table sub-elements, process with structure preservation
          content.push({
            type: 'element_start',
            element: node.cloneNode(false),
            isBlock: ['thead', 'tbody', 'tr'].includes(tagName),
            isTableElement: true
          });

          Array.from(node.childNodes).forEach(child => traverse(child));

          content.push({
            type: 'element_end',
            tagName: tagName,
            isBlock: ['thead', 'tbody', 'tr'].includes(tagName),
            isTableElement: true
          });
        }
      } else {
        // Generic element handling
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
      }
    }
  }

  traverse(container);

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

    // Final scroll to bottom
    smoothScrollToBottom();
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

    // Auto-scroll to bottom during streaming
    instantScrollToBottom();

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

      // Auto-scroll to bottom
      instantScrollToBottom();

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

      instantScrollToBottom();

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

function showTypingIndicator(statusText = 'THINKING...', stage = 'thinking') {
  const { chatMessages } = elements;
  if (!chatMessages) return;

  // Remove existing indicator
  hideTypingIndicator();

  const typingEl = document.createElement('div');
  typingEl.classList.add('typing-indicator', `stage-${stage}`);
  typingEl.id = 'typing-indicator';

  const stageIcons = {
    reading: '<i class="fas fa-search"></i>',
    analyzing: '<i class="fas fa-microchip"></i>',
    generating: '<i class="fas fa-bolt"></i>',
    translating: '<i class="fas fa-globe"></i>',
    thinking: '<i class="fas fa-terminal"></i>'
  };

  typingEl.innerHTML = `
    <div class="typing-avatar">
      ${stageIcons[stage] || stageIcons.thinking}
    </div>
    <div class="typing-content">
      <div class="typing-status">${statusText}</div>
    </div>
  `;

  chatMessages.appendChild(typingEl);
  smoothScrollToBottom();


}

function hideTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) {
    // Fade out animation before removal
    indicator.style.opacity = '0';
    indicator.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      indicator.remove();
    }, 300);
  }
}

function updateTypingIndicator(statusText, stage = 'thinking') {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) {
    const statusEl = indicator.querySelector('.typing-status');
    const avatarEl = indicator.querySelector('.typing-avatar');

    if (statusEl) {
      statusEl.textContent = statusText;
    }

    if (avatarEl) {
      const stageIcons = {
        reading: '<i class="fas fa-search"></i>',
        analyzing: '<i class="fas fa-microchip"></i>',
        generating: '<i class="fas fa-bolt"></i>',
        translating: '<i class="fas fa-globe"></i>',
        thinking: '<i class="fas fa-terminal"></i>'
      };
      avatarEl.innerHTML = stageIcons[stage] || stageIcons.thinking;
    }

    // Update stage class
    indicator.className = `typing-indicator stage-${stage}`;

    // Trigger a subtle animation to show the update
    indicator.style.transform = 'scale(1.02)';
    setTimeout(() => {
      indicator.style.transform = 'scale(1)';
    }, 200);
  }
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

function showError(message, context = {}) {
  console.log('Showing error dialog:', { message, context });

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
      <div class="error-content">${escapeHtml(message)}</div>
      <div class="error-actions">
        ${actionButtons}
      </div>
    </div>
  `;

  errorEl.innerHTML = errorContent;

  elements.chatMessages.appendChild(errorEl);

  // Add event listeners for error action buttons after DOM insertion
  setTimeout(() => {
    const actionBtns = errorEl.querySelectorAll('.error-action-btn');
    console.log('Found action buttons:', actionBtns.length);

    actionBtns.forEach((btn, index) => {
      const action = btn.dataset.action;
      console.log(`Setting up button ${index}:`, action);

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Error action button clicked:', action);
        handleErrorAction(action, errorEl);
      });
    });
  }, 100);

  smoothScrollToBottom();
}

function handleErrorAction(action, errorEl) {
  try {
    switch (action) {
      case 'configure-api':
        chrome.runtime.openOptionsPage();
        break;
      case 'retry':
        // Remove error dialog immediately when retry is clicked
        if (errorEl && errorEl.parentNode) {
          errorEl.remove();
        }
        // Ensure processing state is reset before retry
        setProcessing(false);
        retryLastMessage();
        break;
      case 'refresh':
        location.reload();
        break;
      case 'retry-delayed':
        // Show countdown feedback
        const btn = errorEl.querySelector(`[data-action="${action}"]`);
        if (btn) {
          btn.disabled = true;
          let countdown = 5;
          btn.innerHTML = `<i class="fas fa-clock"></i> Retry in ${countdown}s`;

          const countdownInterval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
              btn.innerHTML = `<i class="fas fa-clock"></i> Retry in ${countdown}s`;
            } else {
              clearInterval(countdownInterval);
              if (errorEl && errorEl.parentNode) {
                errorEl.remove();
              }
              // Ensure processing state is reset before retry
              setProcessing(false);
              retryLastMessage();
            }
          }, 1000);
        } else {
          // Fallback if button not found
          setTimeout(() => {
            if (errorEl && errorEl.parentNode) {
              errorEl.remove();
            }
            // Ensure processing state is reset before retry
            setProcessing(false);
            retryLastMessage();
          }, 5000);
        }
        break;
      default:
        console.warn('Unknown error action:', action);
    }
  } catch (error) {
    console.error('Error handling action:', action, error);
    // Fallback: just remove the error dialog
    if (errorEl && errorEl.parentNode) {
      errorEl.remove();
    }
  }
}

function setProcessing(processing, statusText = 'THINKING...', stage = 'thinking') {
  const { sendBtn, chatInput, inputContainer } = elements;
  state.isProcessing = processing;

  // Update send button with enhanced feedback
  if (sendBtn) {
    sendBtn.disabled = processing || !chatInput?.value.trim();
    if (processing) {
      sendBtn.innerHTML = '<div class="enhanced-loading-spinner"></div>';
      sendBtn.classList.add('processing');
      sendBtn.style.background = 'rgba(208, 255, 22, 0.1)';
      sendBtn.style.color = '#D0FF16';
      sendBtn.style.borderColor = 'rgba(208, 255, 22, 0.3)';
      sendBtn.title = statusText;
    } else {
      sendBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
      sendBtn.classList.remove('processing');
      sendBtn.style.borderColor = '';
      sendBtn.title = 'Send message';
      handleInputChange();
    }
  }

  // Update input container with visual feedback
  if (inputContainer) {
    inputContainer.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    if (processing) {
      inputContainer.style.opacity = '0.7';
      inputContainer.style.transform = 'scale(0.98)';
      inputContainer.classList.add('processing');
    } else {
      inputContainer.style.opacity = '1';
      inputContainer.style.transform = 'scale(1)';
      inputContainer.classList.remove('processing');
    }
  }

  // Update input placeholder with sleek terminal messages
  if (chatInput) {
    chatInput.disabled = processing;
    if (processing) {
      const terminalMessages = {
        reading: 'SCANNING...',
        analyzing: 'PROCESSING...',
        generating: 'GENERATING...',
        translating: 'TRANSLATING...',
        thinking: 'THINKING...'
      };
      chatInput.placeholder = `${terminalMessages[stage] || 'PROCESSING...'}`;
    } else {
      chatInput.placeholder = 'Message Nation Assistant...';
    }
  }

  // Update typing indicator with stage information
  const typingStatus = document.querySelector('.typing-status');
  const typingIndicator = document.getElementById('typing-indicator');
  if (typingStatus && processing) {
    typingStatus.textContent = statusText;
    if (typingIndicator) {
      typingIndicator.className = `typing-indicator stage-${stage}`;
    }
  }

  // Add processing state to body for global styling
  if (processing) {
    document.body.classList.add('processing');
  } else {
    document.body.classList.remove('processing');
  }
}

function addConnectionStatusIndicator() {
  const header = document.querySelector('.nation-header .header-actions');
  if (header && !document.getElementById('connection-status')) {
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'connection-status';
    statusIndicator.className = 'connection-status';
    statusIndicator.innerHTML = '<div class="status-dot"></div>';
    statusIndicator.title = 'Connection status';
    header.insertBefore(statusIndicator, header.firstChild);
  }
}

function updateConnectionStatus(status = 'connected') {
  const indicator = document.getElementById('connection-status');
  if (indicator) {
    const dot = indicator.querySelector('.status-dot');
    if (dot) {
      dot.className = `status-dot ${status}`;

      const statusMessages = {
        connected: 'ONLINE',
        connecting: 'CONNECTING...',
        disconnected: 'OFFLINE',
        error: 'ERROR'
      };

      indicator.title = statusMessages[status] || 'Unknown status';
    }
  }
}

async function loadCurrentTab() {
  try {
    addConnectionStatusIndicator();
    updateConnectionStatus('connected');

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

  // Check if required elements exist
  if (!statusDot || !statusText) return;

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
  smoothScrollToBottom();
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

// Duplicate function removed - hasContextAction already defined above



// Listen for translation updates from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TRANSLATION_READY') {
    // Remove loading message
    const loadingMsg = document.getElementById('translation-loading');
    if (loadingMsg) {
      loadingMsg.remove();
    }

    // SIMPLIFIED: Just treat translation as a regular AI response
    const { translation, targetLanguage, detectedLanguage, smart } = message;
    let translationText = `**Translation to ${targetLanguage}:**\n\n"${translation}"`;

    if (smart && detectedLanguage) {
      translationText = `**Smart Translation** (${detectedLanguage} → ${targetLanguage}):\n\n"${translation}"`;
    }

    addAIMessage(translationText);

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

// Removed complex showTranslationResult and copyTranslation functions
// Translation now uses simple addAIMessage like any other AI response
