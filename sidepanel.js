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

// Simple AI response formatting - just display as-is with colors

/**
 * Main formatting function - simple display with colors
 */
function formatAIResponse(content) {
  if (!content || typeof content !== 'string') {
    return '<div class="ai-error">Invalid response content</div>';
  }

  // 1. Parse the Markdown content using marked.js
  const dirtyHtml = marked.parse(content);

  // 2. Sanitize the HTML using DOMPurify to prevent XSS attacks
  const cleanHtml = DOMPurify.sanitize(dirtyHtml);

  return cleanHtml;
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
  const maxLength = 8000;

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

    // Force stop any ongoing operations before retry
    if (state.isProcessing) {
      logger.log('Stopping current processing for retry');
      if (state.currentStreamingController) {
        state.currentStreamingController();
        state.currentStreamingController = null;
      }
      setProcessing(false);
    }

    logger.log('Retrying last message:', state.lastUserMessage);

    // Add a small delay to ensure UI state is properly reset
    setTimeout(() => {
      handleSendMessage(state.lastUserMessage, true);
    }, 100);
  } catch (error) {
    logger.error('Error retrying last message:', error);
    // Ensure state is reset even on error
    setProcessing(false);
    if (state.currentStreamingController) {
      state.currentStreamingController();
      state.currentStreamingController = null;
    }
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

/**
 * Force reset all states - use when things get stuck
 */
function forceResetAllStates() {
  logger.log('Force resetting all states');

  // Stop streaming
  if (state.currentStreamingController) {
    try {
      state.currentStreamingController();
    } catch (error) {
      logger.warn('Error stopping streaming during force reset:', error);
    }
    state.currentStreamingController = null;
  }

  // Reset processing state
  setProcessing(false);

  // Re-enable all inputs
  if (elements.chatInput) {
    elements.chatInput.disabled = false;
  }

  // Remove any stuck loading states
  document.querySelectorAll('.processing, .loading').forEach(el => {
    el.classList.remove('processing', 'loading');
  });

  // Reset button states
  if (elements.sendBtn) {
    elements.sendBtn.disabled = !elements.chatInput?.value.trim();
  }

  logger.log('All states force reset completed');
}

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
    const isValid = text && text.length <= 8000 && !state.isProcessing;
    sendBtn.disabled = !isValid;
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
    } else if (e.key === 'x') {
      // Ctrl+X: Force reset all states (emergency reset)
      e.preventDefault();
      forceResetAllStates();
      addSystemMessage("🔄 All states have been force reset.");
    }
  }
}

async function handleRefresh() {
  // Refresh should ALWAYS work - force stop any ongoing operations
  try {
    // Stop any streaming immediately
    if (state.currentStreamingController) {
      state.currentStreamingController();
      state.currentStreamingController = null;
    }

    // Force reset processing state
    setProcessing(false);

    // Clear chat history
    state.chatHistory = [];
    state.lastUserMessage = null;

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

    // Clear input and reset state
    const { chatInput } = elements;
    if (chatInput) {
      chatInput.value = '';
      chatInput.disabled = false;
      handleInputChange();
    }

    // Focus input
    setTimeout(() => chatInput?.focus(), 300);

    logger.log('Refresh completed - all states reset');

  } catch (error) {
    logger.error('Refresh error:', error);
    // Even if refresh fails, ensure states are reset
    setProcessing(false);
    if (state.currentStreamingController) {
      state.currentStreamingController();
      state.currentStreamingController = null;
    }
    addSystemMessage("❌ Failed to refresh completely, but states have been reset.");
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
  if (message.length > 8000) {
    showError('Message is too long. Please keep it under 8000 characters.', {});
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
    // Ensure processing state is always reset
    setProcessing(false);
    // Ensure input is re-enabled
    if (elements.chatInput) {
      elements.chatInput.disabled = false;
    }
    chatInput?.focus();
  }
}

function showError(message, context = {}) {
  const template = document.getElementById('error-message-template');
  if (!template) return;

  const errorEl = template.content.cloneNode(true);
  const errorTitleEl = errorEl.querySelector('.error-title');
  const errorContentEl = errorEl.querySelector('.error-content');
  const errorActionsEl = errorEl.querySelector('.error-actions');

  let errorTitle = 'Something went wrong';
  let actionButtonsHtml = '';

  if (context.apiKey || message.includes('API key') || message.includes('401')) {
    errorTitle = 'API Configuration Issue';
    actionButtonsHtml = `<button class="error-action-btn" data-action="configure-api"><i class="fas fa-cog"></i> Configure API Key</button>`;
  } else if (context.connection || message.includes('fetch') || message.includes('network')) {
    errorTitle = 'Connection Problem';
    actionButtonsHtml = `
      <button class="error-action-btn" data-action="retry"><i class="fas fa-redo"></i> Retry</button>
      <button class="error-action-btn" data-action="refresh"><i class="fas fa-refresh"></i> Refresh</button>
    `;
  } else if (message.includes('rate limit') || message.includes('429')) {
    errorTitle = 'Rate Limit Reached';
    actionButtonsHtml = `<button class="error-action-btn" data-action="retry-delayed"><i class="fas fa-clock"></i> Retry in 5s</button>`;
  } else {
    actionButtonsHtml = `<button class="error-action-btn" data-action="retry"><i class="fas fa-redo"></i> Try Again</button>`;
  }

  errorTitleEl.textContent = errorTitle;
  errorContentEl.textContent = message;
  errorActionsEl.innerHTML = actionButtonsHtml;

  const messageNode = errorEl.firstElementChild;
  elements.chatMessages.appendChild(errorEl);

  // Add event listeners for the newly created action buttons
  const actionBtns = messageNode.querySelectorAll('.error-action-btn');
  actionBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleErrorAction(btn.dataset.action, messageNode);
    });
  });

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
      try {
        state.currentStreamingController();
      } catch (error) {
        logger.warn('Error stopping previous streaming:', error);
      }
      state.currentStreamingController = null;
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

      // Clear the streaming controller reference
      if (state.currentStreamingController === streamingController) {
        state.currentStreamingController = null;
      }

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
    <button class="action-btn" data-action="copy" title="Copy message" aria-label="Copy message">
      <i class="fas fa-copy"></i>
    </button>
    <button class="action-btn" data-action="regenerate" title="Regenerate response" aria-label="Regenerate response">
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

  const template = document.getElementById('welcome-message-template');
  if (!template) return;

  const welcomeEl = template.content.cloneNode(true);

  // Add event listeners for suggestion buttons
  const suggestionBtns = welcomeEl.querySelectorAll('.suggestion-btn');
  suggestionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action) {
        handleSmartAction(action);
      }
    });
  });

  chatMessages.appendChild(welcomeEl);
}

/**
 * Handle smart action buttons with specialized prompts
 */
async function handleSmartAction(action) {
  if (state.isProcessing) return;

  // Show immediate feedback
  showTypingIndicator('PROCESSING...', 'analyzing');
  setProcessing(true, 'PROCESSING...', 'analyzing');

  try {
    let response;

    switch (action) {
      case 'analyze':
        response = await chrome.runtime.sendMessage({
          type: 'analyzePageContent',
          tabId: state.currentTabId
        });
        break;

      case 'summarize':
        response = await chrome.runtime.sendMessage({
          type: 'summarizePageContent',
          tabId: state.currentTabId
        });
        break;

      case 'key-insights':
        response = await chrome.runtime.sendMessage({
          type: 'extractKeyInsights',
          tabId: state.currentTabId
        });
        break;

      default:
        throw new Error('Unknown smart action');
    }

    hideTypingIndicator();

    if (response?.success) {
      // Add user message showing what action was taken
      const actionLabels = {
        'analyze': '📄 Analyze this page',
        'summarize': '📝 Summarize content',
        'key-insights': '💡 Key insights'
      };
      addMessage(actionLabels[action], "user");
      addAIMessage(response.data.response);
    } else {
      throw new Error(response?.error || 'Unknown error');
    }
  } catch (error) {
    hideTypingIndicator();
    showError(error.message, { action: true });
  } finally {
    setProcessing(false);
  }
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
        // Force reset all states before retry
        forceResetAllStates();
        setTimeout(() => retryLastMessage(), 100);
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
              // Force reset all states before retry
              forceResetAllStates();
              setTimeout(() => retryLastMessage(), 100);
            }
          }, 1000);
        } else {
          // Fallback if button not found
          setTimeout(() => {
            if (errorEl && errorEl.parentNode) {
              errorEl.remove();
            }
            // Force reset all states before retry
            forceResetAllStates();
            setTimeout(() => retryLastMessage(), 100);
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
  state.isProcessing = processing;
  document.body.classList.toggle('processing', processing);

  const { chatInput, sendBtn } = elements;

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

  if (sendBtn) {
    sendBtn.disabled = processing || !chatInput?.value.trim();
    sendBtn.title = processing ? statusText : 'Send message';
    if (processing) {
      sendBtn.innerHTML = '<div class="enhanced-loading-spinner"></div>';
    } else {
      sendBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    }
  }

  // Update typing indicator if it exists
  const typingIndicator = document.getElementById('typing-indicator');
  if (typingIndicator && processing) {
    const statusEl = typingIndicator.querySelector('.typing-status');
    if (statusEl) {
      statusEl.textContent = statusText;
    }
    typingIndicator.className = `typing-indicator stage-${stage}`;
  }

  // This will trigger the CSS-based styles
  handleInputChange();
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
