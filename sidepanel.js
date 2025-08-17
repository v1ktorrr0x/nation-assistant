// nation assistant chat sidepanel
'use strict';

// Enable comprehensive logging for debugging - disable in production
const DEBUG = false;
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
    const lines = content.split('\n');
    const processedLines = [];
    let listStack = []; // Track nested lists

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Handle code blocks
      if (trimmed.startsWith('```')) {
        // Close all open lists
        while (listStack.length > 0) {
          processedLines.push('</ul>');
          listStack.pop();
        }
        const codeBlockResult = this.handleCodeBlock(line, lines, i);
        processedLines.push(codeBlockResult.html);
        i += codeBlockResult.skipLines - 1;
        continue;
      }

      // Handle bullet points with nesting
      const bulletMatch = line.match(/^(\s*)[-*+•] (.+)$/);
      if (bulletMatch) {
        const indent = bulletMatch[1].length;
        const content = this.processInlineFormatting(bulletMatch[2]);

        // Determine nesting level (every 2 spaces = 1 level)
        const level = Math.floor(indent / 2);

        // Adjust list stack to match current level
        while (listStack.length > level + 1) {
          processedLines.push('</ul>');
          listStack.pop();
        }

        // Open new list if needed
        if (listStack.length === level) {
          processedLines.push('<ul>');
          listStack.push('ul');
        }

        processedLines.push(`<li>${content}</li>`);
        continue;
      }

      // Handle headers
      const headerMatch = trimmed.match(/^(#{1,6}) (.+)$/);
      if (headerMatch) {
        // Close all open lists
        while (listStack.length > 0) {
          processedLines.push('</ul>');
          listStack.pop();
        }
        const level = headerMatch[1].length;
        const content = this.processInlineFormatting(headerMatch[2]);
        processedLines.push(`<h${level}>${content}</h${level}>`);
        continue;
      }

      // Handle empty lines
      if (!trimmed) {
        // Close all open lists on empty line
        while (listStack.length > 0) {
          processedLines.push('</ul>');
          listStack.pop();
        }
        processedLines.push('');
        continue;
      }

      // Handle regular content
      // Close all open lists
      while (listStack.length > 0) {
        processedLines.push('</ul>');
        listStack.pop();
      }

      const formatted = this.processInlineFormatting(trimmed);
      processedLines.push(`<p>${formatted}</p>`);
    }

    // Close any remaining lists
    while (listStack.length > 0) {
      processedLines.push('</ul>');
      listStack.pop();
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
   * Process list items with proper list grouping
   */
  processListItem(line, bulletMatch, numberMatch) {
    const isNumbered = !!numberMatch;
    const match = bulletMatch || numberMatch;
    const indent = match[1].length;
    const content = match[2];

    const listType = isNumbered ? 'ol' : 'ul';
    let html = '';

    // Handle list opening/closing logic
    if (this.parsingState.listStack.length === 0) {
      // Starting first list
      html += `<${listType}>`;
      this.parsingState.listStack.push(listType);
      this.parsingState.currentIndent = indent;
    } else {
      const currentListType = this.parsingState.listStack[this.parsingState.listStack.length - 1];

      if (indent > this.parsingState.currentIndent) {
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

        // Start new list if needed or if list type changed
        if (this.parsingState.listStack.length === 0 ||
          this.parsingState.listStack[this.parsingState.listStack.length - 1] !== listType) {
          if (this.parsingState.listStack.length > 0) {
            const closingType = this.parsingState.listStack.pop();
            html += `</${closingType}>`;
          }
          html += `<${listType}>`;
          this.parsingState.listStack.push(listType);
          this.parsingState.currentIndent = indent;
        }
      } else if (currentListType !== listType) {
        // Same indent but different list type - close current and start new
        const closingType = this.parsingState.listStack.pop();
        html += `</${closingType}>`;
        html += `<${listType}>`;
        this.parsingState.listStack.push(listType);
      }
      // If same indent and same type, just add the item (no opening/closing needed)
    }

    // Add list item with inline formatting
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
   * Close any open elements - simplified
   */
  getClosingTags() {
    // Not used in simplified approach
    return '';
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
  if (typeof text !== 'string') {
    return '';
  }
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Comprehensive input validation and sanitization
 */
function validateAndSanitizeInput(input) {
  if (!input || typeof input !== 'string') {
    return { isValid: false, sanitized: '', error: 'Invalid input type' };
  }

  // Enhanced length validation with user guidance
  const MAX_INPUT_LENGTH = 4000;
  if (input.length > MAX_INPUT_LENGTH) {
    const excess = input.length - MAX_INPUT_LENGTH;
    return {
      isValid: false,
      sanitized: input.substring(0, MAX_INPUT_LENGTH),
      error: `Message is ${excess} characters too long. Please shorten your message to under ${MAX_INPUT_LENGTH} characters for better AI processing.`
    };
  }

  // Check for minimum meaningful content
  const trimmed = input.trim();
  if (trimmed.length < 2) {
    return {
      isValid: false,
      sanitized: trimmed,
      error: 'Please enter a meaningful message to get a helpful response.'
    };
  }

  // Remove potentially dangerous patterns
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/data:text\/html/gi, '') // Remove data URLs
    .trim();

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<link/i,
    /<meta/i,
    /eval\s*\(/i,
    /Function\s*\(/i
  ];

  const hasSuspiciousContent = suspiciousPatterns.some(pattern => pattern.test(sanitized));

  if (hasSuspiciousContent) {
    return {
      isValid: false,
      sanitized: sanitized.replace(/[<>]/g, ''),
      error: 'Your message contains HTML or code that could be unsafe. Please use plain text for better results.'
    };
  }

  // Check for excessive repetition (potential spam)
  const words = sanitized.split(/\s+/);
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  if (words.length > 10 && uniqueWords.size / words.length < 0.3) {
    return {
      isValid: false,
      sanitized,
      error: 'Your message appears to have excessive repetition. Please rephrase for better AI understanding.'
    };
  }

  return { isValid: true, sanitized, error: null };
}

/**
 * Sanitize HTML content for safe display
 */
function sanitizeHtmlContent(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Create a temporary element to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Remove dangerous elements and attributes
  const dangerousElements = temp.querySelectorAll('script, iframe, object, embed, link[rel="stylesheet"], meta, style');
  dangerousElements.forEach(el => el.remove());

  // Remove dangerous attributes
  const allElements = temp.querySelectorAll('*');
  allElements.forEach(el => {
    // Remove event handler attributes
    Array.from(el.attributes).forEach(attr => {
      if (attr.name.startsWith('on') || attr.name === 'style') {
        el.removeAttribute(attr.name);
      }
    });

    // Sanitize href attributes
    if (el.hasAttribute('href')) {
      const href = el.getAttribute('href');
      if (href && (href.startsWith('javascript:') || href.startsWith('data:'))) {
        el.removeAttribute('href');
      }
    }
  });

  return temp.innerHTML;
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
    const timeoutId = setTimeout(() => {
      state.activeTimeouts.delete(timeoutId);
      handleSendMessage(state.lastUserMessage, true);
    }, 100);
    state.activeTimeouts.add(timeoutId);
  } catch (error) {
    logger.error('Error retrying last message:', error);
    addSystemMessage("Failed to retry message. Please try sending a new message.");
  }
}

/**
 * Cleanup function to prevent memory leaks
 */
function cleanup() {
  // Clear all active timeouts
  state.activeTimeouts.forEach(timeoutId => {
    clearTimeout(timeoutId);
  });
  state.activeTimeouts.clear();

  // Clear all active intervals
  state.activeIntervals.forEach(intervalId => {
    clearInterval(intervalId);
  });
  state.activeIntervals.clear();

  // Remove all tracked event listeners
  state.eventListeners.forEach((listener, element) => {
    if (element && typeof element.removeEventListener === 'function') {
      element.removeEventListener(listener.event, listener.handler);
    }
  });
  state.eventListeners.clear();

  // Stop any active streaming
  if (state.currentStreamingController) {
    state.currentStreamingController();
    state.currentStreamingController = null;
  }

  logger.log('Cleanup completed - all timeouts, intervals, and listeners cleared');
}

/**
 * Manage storage quota to prevent exhaustion
 */
function manageStorageQuota() {
  const MAX_HISTORY_SIZE = 100; // Maximum number of messages to keep
  const MAX_MESSAGE_LENGTH = 10000; // Maximum length per message

  try {
    // Trim chat history if it exceeds maximum size
    if (state.chatHistory.length > MAX_HISTORY_SIZE) {
      const excessCount = state.chatHistory.length - MAX_HISTORY_SIZE;
      state.chatHistory.splice(0, excessCount);
      logger.log(`Trimmed ${excessCount} old messages from chat history`);
    }

    // Trim individual messages that are too long
    state.chatHistory.forEach((message, index) => {
      if (message.content && message.content.length > MAX_MESSAGE_LENGTH) {
        const originalLength = message.content.length;
        message.content = message.content.substring(0, MAX_MESSAGE_LENGTH) + '... [truncated]';
        logger.log(`Truncated message ${index} from ${originalLength} to ${message.content.length} characters`);
      }
    });

    // Estimate storage usage and warn if approaching limits
    const estimatedSize = JSON.stringify(state.chatHistory).length;
    const STORAGE_WARNING_THRESHOLD = 4 * 1024 * 1024; // 4MB warning threshold

    if (estimatedSize > STORAGE_WARNING_THRESHOLD) {
      logger.warn(`Chat history approaching storage limit: ${(estimatedSize / 1024 / 1024).toFixed(2)}MB`);
      // Could show user warning here if needed
    }

  } catch (error) {
    logger.error('Error managing storage quota:', error);
  }
}

/**
 * Enhanced timeout wrapper that tracks timeouts for cleanup
 */
function safeSetTimeout(callback, delay) {
  const timeoutId = setTimeout(() => {
    state.activeTimeouts.delete(timeoutId);
    callback();
  }, delay);
  state.activeTimeouts.add(timeoutId);
  return timeoutId;
}

/**
 * Enhanced interval wrapper that tracks intervals for cleanup
 */
function safeSetInterval(callback, delay) {
  const intervalId = setInterval(callback, delay);
  state.activeIntervals.add(intervalId);
  return intervalId;
}

/**
 * Enhanced event listener wrapper that tracks listeners for cleanup
 */
function safeAddEventListener(element, event, handler, options) {
  element.addEventListener(event, handler, options);
  state.eventListeners.set(element, { event, handler });
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
  lastUserMessage: null,
  activeTimeouts: new Set(), // Track active timeouts for cleanup
  activeIntervals: new Set(), // Track active intervals for cleanup
  eventListeners: new Map(), // Track event listeners for cleanup
  // Add state validation tracking
  lastStateUpdate: Date.now(),
  stateVersion: 1
};

/**
 * Validate and sanitize application state
 */
function validateState() {
  // Ensure chatHistory is an array and not too large
  if (!Array.isArray(state.chatHistory)) {
    logger.warn('Invalid chatHistory detected, resetting');
    state.chatHistory = [];
  }

  // Limit chat history size for memory management
  if (state.chatHistory.length > 100) {
    logger.log('Trimming chat history for memory management');
    state.chatHistory = state.chatHistory.slice(-50); // Keep last 50 messages
  }

  // Validate processing state
  if (typeof state.isProcessing !== 'boolean') {
    logger.warn('Invalid isProcessing state, resetting to false');
    state.isProcessing = false;
  }

  // Validate tab ID
  if (state.currentTabId !== null && typeof state.currentTabId !== 'number') {
    logger.warn('Invalid currentTabId, resetting');
    state.currentTabId = null;
  }

  // Clean up stale timeouts and intervals
  cleanupStaleResources();

  // Update state metadata
  state.lastStateUpdate = Date.now();
  state.stateVersion++;

  return true;
}

/**
 * Safe state update with validation
 */
function updateState(updates) {
  try {
    Object.assign(state, updates);
    validateState();
    logger.debug('State updated successfully', updates);
  } catch (error) {
    logger.error('State update failed:', error);
    // Restore to safe state if update fails
    state.isProcessing = false;
  }
}

/**
 * Clean up stale resources to prevent memory leaks
 */
function cleanupStaleResources() {
  // Clear any stale timeouts
  state.activeTimeouts.forEach(timeoutId => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
  state.activeTimeouts.clear();

  // Clear any stale intervals
  state.activeIntervals.forEach(intervalId => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });
  state.activeIntervals.clear();

  // Clean up event listeners that are no longer needed
  state.eventListeners.forEach((cleanup, element) => {
    if (!document.contains(element)) {
      cleanup();
      state.eventListeners.delete(element);
    }
  });
}

// application functions

async function init() {
  try {
    // Validate initial state
    validateState();

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

    // Set up periodic state validation (every 30 seconds)
    const validationInterval = setInterval(() => {
      validateState();
    }, 30000);

    // Track the interval for cleanup
    state.activeIntervals.add(validationInterval);

    logger.log('Application initialized successfully');

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
    helpBtn: document.getElementById('help-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    inputContainer: document.getElementById('input-container')
  };

  // Initialize application
  await init();
});

// Cleanup on page unload to prevent memory leaks
window.addEventListener('beforeunload', () => {
  cleanup();
});

// Cleanup on visibility change (when sidepanel is hidden)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Pause streaming animations when hidden to save resources
    pauseStreamingAnimations();
  } else {
    // Resume when visible again
    resumeStreamingAnimations();
  }
});

/**
 * Comprehensive cleanup function to prevent memory leaks
 */
function cleanup() {
  // Stop all streaming controllers
  if (state.currentStreamingController) {
    state.currentStreamingController();
    state.currentStreamingController = null;
  }

  // Clean up all message elements with streaming controllers
  const messageElements = document.querySelectorAll('.message-content');
  messageElements.forEach(element => {
    if (element.streamingController) {
      element.streamingController();
      element.streamingController = null;
    }
  });

  // Use the enhanced cleanup system
  cleanupStaleResources();

  // Reset processing state safely
  updateState({ isProcessing: false });

  logger.log('Cleanup completed');
}

/**
 * Pause streaming animations to save resources
 */
function pauseStreamingAnimations() {
  const streamingElements = document.querySelectorAll('.streaming');
  streamingElements.forEach(element => {
    if (element.streamingController) {
      element.dataset.wasPaused = 'true';
      element.streamingController();
    }
  });
}

/**
 * Resume streaming animations when visible
 */
function resumeStreamingAnimations() {
  // Note: This is a placeholder - actual resume logic would need
  // to store streaming state and resume from where it left off
  logger.log('Resuming streaming animations');
}

/**
 * Clear all pending timeouts (placeholder for timeout tracking)
 */
function clearAllTimeouts() {
  // In a more complete implementation, we would track all timeout IDs
  // and clear them here
  logger.log('Clearing all timeouts');
}

function setupEventListeners() {
  const { chatInput, sendBtn, refreshBtn, helpBtn, settingsBtn, inputContainer } = elements;

  // Chat input events
  chatInput?.addEventListener('input', handleInputChange);
  chatInput?.addEventListener('keydown', handleKeyDown);
  chatInput?.addEventListener('click', () => chatInput.focus());

  // Button events
  sendBtn?.addEventListener('click', handleSendMessage);
  refreshBtn?.addEventListener('click', handleRefresh);
  helpBtn?.addEventListener('click', showHelpDialog);
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
    // Enhanced keyboard shortcuts
    if (e.key === 'k') {
      e.preventDefault();
      elements.chatInput?.focus();
    } else if (e.key === 'r') {
      e.preventDefault();
      if (state.lastUserMessage && !state.isProcessing) {
        retryLastMessage();
      }
    } else if (e.key === 'n') {
      e.preventDefault();
      handleRefresh();
    } else if (e.key === ',') {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    } else if (e.key === '?' || e.key === '/') {
      e.preventDefault();
      showHelpDialog();
    }
  } else if (e.key === 'ArrowUp' && e.altKey) {
    // Navigate to previous message
    e.preventDefault();
    navigateMessages('up');
  } else if (e.key === 'ArrowDown' && e.altKey) {
    // Navigate to next message
    e.preventDefault();
    navigateMessages('down');
  } else if (e.key === 'Tab') {
    // Improve tab navigation
    const focusableElements = document.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length > 0) {
      const currentIndex = Array.from(focusableElements).indexOf(document.activeElement);
      let nextIndex;

      if (e.shiftKey) {
        nextIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
      } else {
        nextIndex = currentIndex >= focusableElements.length - 1 ? 0 : currentIndex + 1;
      }

      focusableElements[nextIndex].focus();
      e.preventDefault();
    }
  }
}

/**
 * Navigate between messages with keyboard
 */
function navigateMessages(direction) {
  const messages = document.querySelectorAll('.message');
  if (messages.length === 0) return;

  const currentFocused = document.activeElement;
  let currentIndex = -1;

  // Find currently focused message
  messages.forEach((msg, index) => {
    if (msg.contains(currentFocused) || msg === currentFocused) {
      currentIndex = index;
    }
  });

  let nextIndex;
  if (direction === 'up') {
    nextIndex = currentIndex <= 0 ? messages.length - 1 : currentIndex - 1;
  } else {
    nextIndex = currentIndex >= messages.length - 1 ? 0 : currentIndex + 1;
  }

  messages[nextIndex].focus();
  messages[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  // Enhanced race condition protection
  if (!message || state.isProcessing) {
    logger.warn('Message send blocked:', { hasMessage: !!message, isProcessing: state.isProcessing });
    return;
  }

  // Immediately set processing state to prevent race conditions
  state.isProcessing = true;

  // Additional safety check after state change
  if (!message.trim()) {
    state.isProcessing = false;
    logger.warn('Empty message after processing state set');
    return;
  }

  // Comprehensive input validation
  const validation = validateAndSanitizeInput(message);
  if (!validation.isValid) {
    state.isProcessing = false; // Reset processing state
    showError(validation.error, {});
    return;
  }

  // Use sanitized message
  const sanitizedMessage = validation.sanitized;

  // Store sanitized message for retry functionality (always store, even when regenerating)
  state.lastUserMessage = sanitizedMessage;
  logger.log('Stored last user message for retry:', sanitizedMessage);

  // Add user message (skip if regenerating)
  let userMessageEl = null;
  if (!isRegenerate) {
    userMessageEl = addMessage(sanitizedMessage, "user");
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
      question: sanitizedMessage,
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

    // Connection status monitoring removed for cleaner UI

    showError(error.message, {
      apiKey: error.message.includes('API key') || error.message.includes('401'),
      connection: error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')
    });
  } finally {
    // Comprehensive cleanup in finally block
    try {
      userMessageEl?.classList.remove('loading');

      // Always reset processing state
      state.isProcessing = false;
      setProcessing(false);

      // Re-enable input and focus
      if (chatInput) {
        chatInput.disabled = false;
        chatInput.focus();
      }

      // Update input validation to reflect current state
      handleInputChange();

      logger.log('Message processing cleanup completed');
    } catch (cleanupError) {
      logger.error('Error during message processing cleanup:', cleanupError);
      // Force reset even if cleanup fails
      state.isProcessing = false;
    }
  }
}

function showError(message, context = {}) {
  logger.debug('Showing error dialog:', { message, context });

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
    logger.debug('Found action buttons:', actionBtns.length);

    actionBtns.forEach((btn, index) => {
      const action = btn.dataset.action;
      logger.debug(`Setting up button ${index}:`, action);

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        logger.debug('Error action button clicked:', action);
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

  // Create message structure with accessibility improvements
  const messageEl = document.createElement('div');
  messageEl.classList.add('message', sender);

  // Add accessibility attributes
  messageEl.setAttribute('role', 'article');
  messageEl.setAttribute('aria-label', `${sender === 'user' ? 'Your message' : 'AI response'} at ${formatTime()}`);
  messageEl.setAttribute('tabindex', '0');

  const messageHeader = createMessageHeader(sender);
  const messageContent = document.createElement('div');
  messageContent.classList.add('message-content');
  messageContent.setAttribute('role', 'main');
  messageContent.setAttribute('aria-live', sender === 'ai' ? 'polite' : 'off');

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

  // Save to history with quota management
  if (save) {
    const newMessage = { content, sender, timestamp: new Date() };
    state.chatHistory.push(newMessage);

    // Implement storage quota management
    manageStorageQuota();
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
 * Enhanced streaming animation for AI responses with proper cleanup
 * Maintains structure during streaming while providing smooth animation
 */
function startTypingEffect(element, finalContent) {
  // Clear any existing content and cleanup previous streaming
  element.innerHTML = '';

  // Stop any existing streaming controller for this element
  if (element.streamingController) {
    element.streamingController();
    element.streamingController = null;
  }

  // Create a temporary container to parse the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = finalContent;

  // Get all text nodes and elements for streaming with enhanced structure preservation
  const streamableContent = extractStreamableContent(tempDiv);

  // Start the enhanced streaming animation and return the controller
  const controller = streamContentWithStructure(element, streamableContent);

  // Store controller on element for cleanup
  element.streamingController = controller;

  return controller;
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

    if (clickTimeoutId) clearTimeout(clickTimeoutId);

    clickTimeoutId = setTimeout(() => {
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
      clickTimeoutId = null;
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

  // Store timeout IDs for proper cleanup
  let streamTimeoutId = null;
  let clickTimeoutId = null;

  const streamNext = () => {
    if (!isStreaming || currentIndex >= streamableContent.length) {
      // Streaming complete - proper cleanup
      cleanupStreaming();
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
      cleanupStreaming();
      return;
    }

    processStreamItem(item);
    currentIndex++;

    // Calculate next delay based on content type and speed
    let delay = calculateDelay(item) / speedMultiplier;

    // Store timeout ID for cleanup
    streamTimeoutId = setTimeout(streamNext, delay);
  };

  const cleanupStreaming = () => {
    // Clear all timeouts
    if (streamTimeoutId) {
      clearTimeout(streamTimeoutId);
      streamTimeoutId = null;
    }
    if (clickTimeoutId) {
      clearTimeout(clickTimeoutId);
      clickTimeoutId = null;
    }

    // Remove cursor safely
    if (cursor && cursor.parentNode) {
      cursor.remove();
    }

    // Remove event listeners
    element.removeEventListener('click', handleClick);

    // Clear streaming state
    element.classList.remove('streaming');
    isStreaming = false;

    // Clear controller reference
    if (element.streamingController) {
      element.streamingController = null;
    }

    // Final scroll to ensure we're at the bottom
    smoothScrollToBottom();
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

  // Return enhanced controller function with proper cleanup
  return () => {
    isStreaming = false;
    cleanupStreaming();
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

function handleErrorAction(action, errorEl) {
  try {
    switch (action) {
      case 'configure-api':
        chrome.runtime.openOptionsPage();
        // Show feedback that settings are opening
        if (errorEl) {
          const feedback = document.createElement('div');
          feedback.className = 'action-feedback';
          feedback.innerHTML = '<i class="fas fa-external-link-alt"></i> Opening settings...';
          errorEl.appendChild(feedback);

          setTimeout(() => {
            if (errorEl && errorEl.parentNode) {
              errorEl.remove();
            }
          }, 2000);
        }
        break;

      case 'retry':
        // Provide immediate feedback
        if (errorEl) {
          const btn = errorEl.querySelector(`[data-action="${action}"]`);
          if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Retrying...';
            btn.disabled = true;
          }
        }

        // Remove error dialog after brief delay
        setTimeout(() => {
          if (errorEl && errorEl.parentNode) {
            errorEl.remove();
          }
        }, 500);

        // Ensure clean state before retry
        updateState({ isProcessing: false });
        retryLastMessage();
        break;

      case 'refresh':
        // Show feedback before refresh
        if (errorEl) {
          const btn = errorEl.querySelector(`[data-action="${action}"]`);
          if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            btn.disabled = true;
          }
        }

        setTimeout(() => {
          location.reload();
        }, 500);
        break;

      case 'retry-delayed':
        // Enhanced countdown with better UX
        const btn = errorEl.querySelector(`[data-action="${action}"]`);
        if (btn) {
          btn.disabled = true;
          let countdown = 5;

          const updateCountdown = () => {
            btn.innerHTML = `<i class="fas fa-clock"></i> Retry in ${countdown}s`;
            btn.style.background = `linear-gradient(90deg, rgba(208, 255, 22, 0.1) ${((5 - countdown) / 5) * 100}%, transparent ${((5 - countdown) / 5) * 100}%)`;
          };

          updateCountdown();

          const countdownInterval = setInterval(() => {
            countdown--;
            if (countdown > 0) {
              updateCountdown();
            } else {
              clearInterval(countdownInterval);

              // Clean transition to retry
              btn.innerHTML = '<i class="fas fa-redo"></i> Retrying...';
              btn.style.background = 'rgba(208, 255, 22, 0.2)';

              setTimeout(() => {
                if (errorEl && errorEl.parentNode) {
                  errorEl.remove();
                }
                updateState({ isProcessing: false });
                retryLastMessage();
              }, 300);
            }
          }, 1000);

          // Track interval for cleanup
          state.activeIntervals.add(countdownInterval);
        }
        break;

      default:
        logger.warn('Unknown error action:', action);
        // Still provide feedback for unknown actions
        if (errorEl && errorEl.parentNode) {
          errorEl.remove();
        }
    }
  } catch (error) {
    logger.error('Error handling action:', action, error);

    // Enhanced fallback with user feedback
    if (errorEl) {
      const fallbackMsg = document.createElement('div');
      fallbackMsg.className = 'error-fallback';
      fallbackMsg.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Action failed. Please try refreshing the page.';
      errorEl.appendChild(fallbackMsg);

      setTimeout(() => {
        if (errorEl && errorEl.parentNode) {
          errorEl.remove();
        }
      }, 3000);
    }

    // Ensure clean state
    updateState({ isProcessing: false });
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

// Connection status functions removed for cleaner UI

async function loadCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      state.currentTabId = tab.id;

      const { tabTitle, tabUrl } = elements;
      if (tabTitle) tabTitle.textContent = tab.title || 'Current Page';
      if (tabUrl) tabUrl.textContent = tab.url ? new URL(tab.url).hostname : '';
    }
  } catch (error) {
    // Silently handle error
    logger.warn('Failed to load current tab:', error.message);
  }
}

// Connection status testing removed for cleaner UI



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

    // Check if context action is stale (older than 5 minutes)
    const now = Date.now();
    const actionAge = now - (contextAction.timestamp || 0);
    const maxAge = 5 * 60 * 1000; // 5 minutes

    if (actionAge > maxAge) {
      logger.log('Context action expired, cleaning up');
      chrome.storage.local.remove(['contextAction']);
      return;
    }

    // Validate context action data
    if (!contextAction.action || (!contextAction.text && !contextAction.originalText)) {
      logger.warn('Invalid context action data, cleaning up');
      chrome.storage.local.remove(['contextAction']);
      return;
    }

    // Handle different context actions with enhanced error recovery
    try {
      switch (contextAction.action) {
        case 'translate':
          await handleTranslateAction(contextAction);
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
    } catch (actionError) {
      logger.error('Error processing context action:', actionError);

      // Show user-friendly error and clean up
      addSystemMessage('❌ Failed to process the selected text. Please try selecting the text again.');
      chrome.storage.local.remove(['contextAction']);
    }
  } catch (error) {
    logger.error('Error handling context action:', error);

    // Clean up on any error
    chrome.storage.local.remove(['contextAction']).catch(() => { });
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

/**
 * Show comprehensive help dialog with shortcuts and tips
 */
function showHelpDialog() {
  // Remove existing help dialog if present
  const existingDialog = document.getElementById('help-dialog');
  if (existingDialog) {
    existingDialog.remove();
    return;
  }

  const helpDialog = document.createElement('div');
  helpDialog.id = 'help-dialog';
  helpDialog.className = 'help-dialog-overlay';

  helpDialog.innerHTML = `
    <div class="help-dialog">
      <div class="help-header">
        <h2><i class="fas fa-question-circle"></i> Nation Assistant Help</h2>
        <button class="help-close" aria-label="Close help">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <div class="help-content">
        <div class="help-section">
          <h3><i class="fas fa-keyboard"></i> Keyboard Shortcuts</h3>
          <div class="shortcut-grid">
            <div class="shortcut-item">
              <kbd>Enter</kbd>
              <span>Send message</span>
            </div>
            <div class="shortcut-item">
              <kbd>Shift + Enter</kbd>
              <span>New line</span>
            </div>
            <div class="shortcut-item">
              <kbd>Ctrl + K</kbd>
              <span>Focus input</span>
            </div>
            <div class="shortcut-item">
              <kbd>Ctrl + R</kbd>
              <span>Retry last message</span>
            </div>
            <div class="shortcut-item">
              <kbd>Ctrl + N</kbd>
              <span>New conversation</span>
            </div>
            <div class="shortcut-item">
              <kbd>Ctrl + ,</kbd>
              <span>Open settings</span>
            </div>
            <div class="shortcut-item">
              <kbd>Alt + ↑/↓</kbd>
              <span>Navigate messages</span>
            </div>
            <div class="shortcut-item">
              <kbd>Escape</kbd>
              <span>Clear input</span>
            </div>
          </div>
        </div>

        <div class="help-section">
          <h3><i class="fas fa-mouse-pointer"></i> Interaction Tips</h3>
          <ul class="help-tips">
            <li><strong>Click AI responses</strong> to speed up streaming</li>
            <li><strong>Double-click</strong> for instant completion</li>
            <li><strong>Right-click text</strong> on any webpage for quick analysis</li>
            <li><strong>Use action buttons</strong> to copy or regenerate responses</li>
          </ul>
        </div>

        <div class="help-section">
          <h3><i class="fas fa-lightbulb"></i> Best Practices</h3>
          <ul class="help-tips">
            <li>Be specific in your questions for better results</li>
            <li>Ask follow-up questions to dive deeper</li>
            <li>Use "Summarize this page" for quick overviews</li>
            <li>Select text and right-click for targeted analysis</li>
            <li>Keep messages under 4000 characters for optimal processing</li>
          </ul>
        </div>

        <div class="help-section">
          <h3><i class="fas fa-language"></i> Translation Features</h3>
          <ul class="help-tips">
            <li>Select text and right-click for instant translation</li>
            <li>Use "Quick Translate" for auto-language detection</li>
            <li>Choose specific target languages from the menu</li>
            <li>Copy translations with the built-in copy button</li>
          </ul>
        </div>

        <div class="help-section">
          <h3><i class="fas fa-exclamation-triangle"></i> Troubleshooting</h3>
          <ul class="help-tips">
            <li><strong>No response?</strong> Check your API key in settings</li>
            <li><strong>Slow responses?</strong> Check your internet connection</li>
            <li><strong>Page analysis not working?</strong> Try refreshing the page</li>
            <li><strong>Extension not loading?</strong> Restart your browser</li>
          </ul>
        </div>
      </div>
      
      <div class="help-footer">
        <p>Press <kbd>Ctrl + ?</kbd> anytime to toggle this help dialog</p>
      </div>
    </div>
  `;

  // Add styles for the help dialog
  const helpStyles = document.createElement('style');
  helpStyles.textContent = `
    .help-dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: fadeIn 0.2s ease-out;
    }

    .help-dialog {
      background: rgba(13, 13, 13, 0.95);
      border: 1px solid rgba(208, 255, 22, 0.3);
      border-radius: 12px;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      font-family: 'Inter', sans-serif;
    }

    .help-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid rgba(208, 255, 22, 0.2);
    }

    .help-header h2 {
      margin: 0;
      color: #D0FF16;
      font-size: 18px;
      font-weight: 600;
    }

    .help-close {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.7);
      font-size: 16px;
      cursor: pointer;
      padding: 8px;
      border-radius: 6px;
      transition: all 0.2s ease;
    }

    .help-close:hover {
      background: rgba(208, 255, 22, 0.1);
      color: #D0FF16;
    }

    .help-content {
      padding: 24px;
    }

    .help-section {
      margin-bottom: 24px;
    }

    .help-section h3 {
      color: #D0FF16;
      font-size: 14px;
      font-weight: 600;
      margin: 0 0 12px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .shortcut-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 8px;
    }

    .shortcut-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 6px;
      font-size: 13px;
    }

    .shortcut-item kbd {
      background: rgba(208, 255, 22, 0.2);
      color: #D0FF16;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: 'Space Mono', monospace;
      font-size: 11px;
      font-weight: 600;
    }

    .help-tips {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .help-tips li {
      padding: 8px 0;
      color: rgba(255, 255, 255, 0.8);
      font-size: 13px;
      line-height: 1.4;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .help-tips li:last-child {
      border-bottom: none;
    }

    .help-tips strong {
      color: #D0FF16;
    }

    .help-footer {
      padding: 16px 24px;
      border-top: 1px solid rgba(208, 255, 22, 0.2);
      text-align: center;
    }

    .help-footer p {
      margin: 0;
      color: rgba(255, 255, 255, 0.6);
      font-size: 12px;
    }

    .help-footer kbd {
      background: rgba(208, 255, 22, 0.2);
      color: #D0FF16;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Space Mono', monospace;
      font-size: 11px;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }

    @media (prefers-reduced-motion: reduce) {
      .help-dialog-overlay {
        animation: none;
      }
    }
  `;

  document.head.appendChild(helpStyles);
  document.body.appendChild(helpDialog);

  // Event listeners
  const closeBtn = helpDialog.querySelector('.help-close');
  closeBtn.addEventListener('click', () => {
    helpDialog.remove();
    helpStyles.remove();
  });

  // Close on overlay click
  helpDialog.addEventListener('click', (e) => {
    if (e.target === helpDialog) {
      helpDialog.remove();
      helpStyles.remove();
    }
  });

  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      helpDialog.remove();
      helpStyles.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  // Focus management
  closeBtn.focus();
}