// Nation Assistant Simple Chat Sidepanel
'use strict';

// ===== AI RESPONSE FORMATTING =====

/**
 * Main formatter for AI responses with Nation theme
 */
function formatAIResponse(content) {
  if (!content || typeof content !== 'string') {
  return '<p class="error-text">Invalid response</p>';
  }

  // Normalize line endings
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // Apply formatting pipeline
  return [
  formatCodeBlocks,
  formatHeaders,
  formatTextStyles,
  formatLists,
  formatLinks,
  formatParagraphs
  ].reduce((text, formatter) => formatter(text), normalized);
}

function formatCodeBlocks(content) {
  return content
  // Code blocks with language
  .replace(/```(\w+)?\n?([\s\S]*?)```/g, (match, language, code) => {
    const lang = language || 'text';
    const cleanCode = escapeHtml(code.trim());
    return `<div class="code-block" data-language="${lang}"><pre><code>${cleanCode}</code></pre></div>`;
  })
  // Inline code
  .replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');
}

function formatHeaders(content) {
  return content.replace(/^(#{1,6})\s+(.+)$/gm, (match, hashes, text) => {
  const level = hashes.length;
  const cleanText = escapeHtml(text.trim());
  return `<h${level} class="ai-header ai-header-${level}">${cleanText}</h${level}>`;
  });
}

function formatTextStyles(content) {
  return content
  .replace(/\*\*(.*?)\*\*/g, '<strong class="ai-bold">$1</strong>')
  .replace(/\*(.*?)\*/g, '<em class="ai-italic">$1</em>')
  .replace(/~~(.*?)~~/g, '<del class="ai-strikethrough">$1</del>');
}

function formatLists(content) {
  return wrapListItems(
  content
    // Unordered lists
    .replace(/^(\s*)[-*+]\s+(.+)$/gm, (match, indent, text) => {
      const level = Math.floor(indent.length / 2);
      return `<li class="ai-list-item ai-list-unordered" data-level="${level}">${text.trim()}</li>`;
    })
    // Ordered lists
    .replace(/^(\s*)\d+\.\s+(.+)$/gm, (match, indent, text) => {
      const level = Math.floor(indent.length / 2);
      return `<li class="ai-list-item ai-list-ordered" data-level="${level}">${text.trim()}</li>`;
    })
  );
}

function formatLinks(content) {
  return content
  // Markdown links
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, 
    '<a href="$2" class="ai-link" target="_blank" rel="noopener noreferrer">$1</a>')
  // Auto-links
  .replace(/(https?:\/\/[^\s<>"]+)/g, 
    '<a href="$1" class="ai-link ai-auto-link" target="_blank" rel="noopener noreferrer">$1</a>');
}

function wrapListItems(content) {
  return content
  // Wrap unordered lists
  .replace(/(<li class="ai-list-item ai-list-unordered"[^>]*>.*?<\/li>(?:\s*<li class="ai-list-item ai-list-unordered"[^>]*>.*?<\/li>)*)/gs,
    '<ul class="ai-list ai-list-unordered">$1</ul>')
  // Wrap ordered lists
  .replace(/(<li class="ai-list-item ai-list-ordered"[^>]*>.*?<\/li>(?:\s*<li class="ai-list-item ai-list-ordered"[^>]*>.*?<\/li>)*)/gs,
    '<ol class="ai-list ai-list-ordered">$1</ol>');
}

function formatParagraphs(content) {
  return content
  .split(/\n\s*\n/)
  .map(part => {
    const trimmed = part.trim();
    if (!trimmed) return '';
    
    // Don't wrap block elements
    if (trimmed.match(/^<(h[1-6]|div|pre|ul|ol|blockquote|hr)/i)) {
      return trimmed;
    }
    
    // Convert line breaks and wrap in paragraph
    const withBreaks = trimmed.replace(/\n/g, '<br>');
    return `<p class="ai-text">${withBreaks}</p>`;
  })
  .filter(Boolean)
  .join('\n\n');
}

// ===== UTILITY FUNCTIONS =====

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

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
  currentTabId: null
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

  // Update send button state
  if (sendBtn) {
  const shouldEnable = chatInput.value.trim() && !state.isProcessing;
  sendBtn.disabled = !shouldEnable;
  
  // Update button appearance
  if (shouldEnable) {
    sendBtn.style.background = 'linear-gradient(135deg, #d0ff16 0%, #a8cc12 100%)';
    sendBtn.style.color = '#000';
  } else {
    sendBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    sendBtn.style.color = '#666666';
  }
  }
}

function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
  e.preventDefault();
  if (elements.sendBtn && !elements.sendBtn.disabled) {
    handleSendMessage();
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
    addMessage("❌ Failed to start new conversation. Please try again.", "ai");
  }
  }

async function handleSendMessage(messageText = null, isRegenerate = false) {
  const { chatInput } = elements;
  const message = messageText || chatInput?.value.trim();
  if (!message || state.isProcessing) return;

  // Add user message (skip if regenerating)
  let userMessageEl = null;
  if (!isRegenerate) {
    userMessageEl = addMessage(message, "user");
    if (chatInput) {
      chatInput.value = "";
      handleInputChange();
    }
  }

  // Show immediate feedback
  showTypingIndicator();
  setProcessing(true, isRegenerate ? 'Regenerating...' : 'Analyzing...');

  try {
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
      addMessage(response.data.response, "ai");
    } else {
      throw new Error(response?.error || 'Unknown error');
    }
  } catch (error) {
    hideTypingIndicator();
    showError(error.message, {
      apiKey: error.message.includes('API key'),
      connection: error.message.includes('fetch') || error.message.includes('network')
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
  
  let errorContent = `
    <div class="error-message">
      <div class="error-header">
        <i class="fas fa-exclamation-triangle"></i>
        Something went wrong
      </div>
      <div class="error-content">${message}</div>
      <div class="error-actions">
  `;

  if (context.apiKey) {
    errorContent += `
      <button class="error-action-btn" onclick="chrome.runtime.openOptionsPage()">
        <i class="fas fa-cog"></i> Fix Settings
      </button>
    `;
  }

  if (context.connection) {
    errorContent += `
      <button class="error-action-btn" onclick="location.reload()">
        <i class="fas fa-refresh"></i> Retry
      </button>
    `;
  }

  errorContent += `
      </div>
    </div>
  `;

  errorEl.innerHTML = errorContent;
  elements.chatMessages.appendChild(errorEl);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
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

  // Handle content display
  const formattedContent = formatAIResponse(content);
  if (sender === 'ai') {
    startTypingEffect(messageContent, formattedContent);
  } else {
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

  // Modern welcome message
function showWelcomeMessage() {
  const { chatMessages } = elements;
  if (!chatMessages) return;

  const welcomeEl = document.createElement('div');
  welcomeEl.classList.add('welcome-message');
  welcomeEl.innerHTML = `
    <div class="welcome-icon"><i class="fas fa-robot"></i></div>
    <div class="welcome-title">Welcome to Nation Assistant</div>
    <div class="welcome-subtitle">
      I'm here to help you understand and analyze this webpage. 
      Ask me anything about the content, and I'll provide insights and answers.
    </div>
  `;

  chatMessages.appendChild(welcomeEl);
  }

  // Enhanced typing effect that works with formatted content
function startTypingEffect(element, finalContent) {
  // Typing indicator is already shown from handleSendMessage
  // Just start typing the content immediately
  
  // For formatted content, use chunk-based typing
  if (finalContent.includes('<')) {
    typeFormattedContent(element, finalContent);
  } else {
    typeSimpleContent(element, finalContent);
  }
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
    }
  } catch (error) {
    // Silently handle error
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

  const inputContainer = document.getElementById('input-container');
  if (inputContainer) {
    inputContainer.style.pointerEvents = 'auto';
  }
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

  // Handle context actions (like translation)
async function handleContextAction() {
  try {
    const result = await chrome.storage.local.get(['contextAction']);
    const contextAction = result.contextAction;

    if (!contextAction || (Date.now() - contextAction.timestamp > 30000)) {
      return; // No action or too old
    }

    if (contextAction.action === 'translate') {
      // Show original text
      addMessage(`Original text: "${contextAction.originalText}"`, "user", false);
      
      if (contextAction.loading) {
        // Show loading message
        const loadingMsg = addMessage(`Translating to ${contextAction.targetLanguage}...`, "ai", false);
        loadingMsg.classList.add('loading');
        loadingMsg.id = 'translation-loading';
      } else if (contextAction.error) {
        // Show error
        addMessage(`Translation error: ${contextAction.error}`, "system", false);
      } else if (contextAction.translation) {
        // Show translation result
        addMessage(`Translation (${contextAction.targetLanguage}): "${contextAction.translation}"`, "ai", false);
        addMessage("You can now ask questions about this translation or continue the conversation!", "system", false);
      }
    } else if (contextAction.action === 'analyze') {
      // Handle text analysis (existing functionality)
      addMessage(`Selected text: "${contextAction.text}"`, "user", false);
      addMessage("I can help you analyze this text. What would you like to know about it?", "ai", false);
    }

    // Don't clear the context action if it's still loading
    if (!contextAction.loading) {
      await chrome.storage.local.remove(['contextAction']);
    }
  } catch (error) {
    console.error('Error handling context action:', error);
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
    
    // Add translation result
    addMessage(`Translation: "${message.translation}"`, "ai", false);
    addMessage("You can now ask questions about this translation or continue the conversation!", "system", false);
    
    // Clear the context action
    chrome.storage.local.remove(['contextAction']);
  } else if (message.type === 'TRANSLATION_ERROR') {
    // Remove loading message
    const loadingMsg = document.getElementById('translation-loading');
    if (loadingMsg) {
      loadingMsg.remove();
    }
    
    // Show error
    addMessage(`Translation error: ${message.error}`, "system", false);
    
    // Clear the context action
    chrome.storage.local.remove(['contextAction']);
  }
});
