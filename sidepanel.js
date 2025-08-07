// Nation Assistant Simple Chat Sidepanel
'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements - Updated for modern interface
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const tabTitle = document.getElementById('tab-title');
  const tabUrl = document.getElementById('tab-url');
  const refreshBtn = document.getElementById('refresh-btn');
  const settingsBtn = document.getElementById('settings-btn');

  // State
  let chatHistory = [];
  let isProcessing = false;
  let currentTabId = null;

  // Initialize
  await init();

  async function init() {
    try {
      setupEventListeners();
      await loadCurrentTab();

      // Check for context actions (like translation)
      await handleContextAction();

      // Show modern welcome message (only if no context action)
      if (!await hasContextAction()) {
        showWelcomeMessage();
      }

      // Enable the input
      enableChatInput();

      // Focus input after delay
      setTimeout(() => {
        if (chatInput) {
          chatInput.focus();
        }
      }, 200);

      if (sendBtn) {
        sendBtn.disabled = true; // Will be enabled when user types
      }
    } catch (error) {
      addMessage("❌ Failed to initialize. Please refresh the page.", "system");
    }
  }

  function setupEventListeners() {
    // Chat input
    if (chatInput) {
      chatInput.addEventListener('input', handleInputChange);
      chatInput.addEventListener('keydown', handleKeyDown);
      chatInput.addEventListener('click', handleInputClick);
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', handleSendMessage);
    }

    // Refresh button
    if (refreshBtn) {
      refreshBtn.addEventListener('click', handleRefresh);
    }

    // Settings button
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
    }

    // Input container click handler
    const inputContainer = document.getElementById('input-container');
    if (inputContainer) {
      inputContainer.addEventListener('click', (e) => {
        if (chatInput && e.target !== chatInput) {
          chatInput.focus();
        }
      });
    }
  }

  function handleInputChange() {
    if (!chatInput) return;

    // Auto-resize textarea
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';

    // Enable/disable send button with modern styling
    if (sendBtn) {
      const shouldEnable = !(!chatInput.value.trim() || isProcessing);
      sendBtn.disabled = !shouldEnable;
      
      // Update button appearance
      if (shouldEnable && !isProcessing) {
        sendBtn.style.background = 'linear-gradient(135deg, #d0ff16 0%, #a8cc12 100%)';
        sendBtn.style.color = '#000';
      } else {
        sendBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        sendBtn.style.color = '#666666';
      }
    }
  }

  function handleInputClick() {
    if (chatInput) {
      chatInput.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (sendBtn && !sendBtn.disabled) {
        handleSendMessage();
      }
    }
  }

  async function handleRefresh() {
    if (isProcessing) return;

    try {
      // Clear chat history
      chatHistory = [];

      // Clear chat messages with smooth transition
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
      if (chatInput) {
        chatInput.value = '';
        handleInputChange();
      }

      // Focus input
      setTimeout(() => {
        if (chatInput) {
          chatInput.focus();
        }
      }, 300);

    } catch (error) {
      addMessage("❌ Failed to start new conversation. Please try again.", "ai");
    }
  }

  async function handleSendMessage() {
    const message = chatInput.value.trim();
    if (!message || isProcessing) return;

    // Add user message with loading state
    const userMessageEl = addMessage(message, "user");
    chatInput.value = "";
    handleInputChange();

    // Set processing state
    setProcessing(true);

    // Add loading animation to user message
    if (userMessageEl) {
      userMessageEl.classList.add('loading');
    }

    try {
      // Send to background script
      const response = await chrome.runtime.sendMessage({
        type: 'chatWithPage',
        tabId: currentTabId,
        question: message,
        chatHistory: chatHistory.slice(-4).map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))
      });

      if (response && response.success) {
        addMessage(response.data.response, "ai");
      } else {
        throw new Error(response?.error || 'Unknown error');
      }
    } catch (error) {
      let errorMessage = "Sorry, I encountered an error. ";

      if (error.message.includes('API key')) {
        errorMessage += "Please check your API settings in the extension options.";
      } else {
        errorMessage += "Please try again or check your connection.";
      }

      addMessage(errorMessage, "ai");
    } finally {
      // Remove loading animation from user message
      if (userMessageEl) {
        userMessageEl.classList.remove('loading');
      }

      setProcessing(false);
      if (chatInput) chatInput.focus();
    }
  }

  function addMessage(content, sender, save = true) {
    if (!chatMessages) return null;

    // Remove welcome message if it exists
    const welcomeMsg = chatMessages.querySelector('.welcome-message');
    if (welcomeMsg) {
      welcomeMsg.remove();
    }

    const messageEl = document.createElement('div');
    messageEl.classList.add('message', sender);

    // Create message header with avatar and info
    const messageHeader = document.createElement('div');
    messageHeader.classList.add('message-header');

    const messageAvatar = document.createElement('div');
    messageAvatar.classList.add('message-avatar');
    messageAvatar.innerHTML = sender === 'user' ? 'U' : '<i class="fas fa-robot"></i>';

    const messageSender = document.createElement('span');
    messageSender.classList.add('message-sender');
    messageSender.textContent = sender === 'user' ? 'You' : 'Nation Assistant';

    const messageTime = document.createElement('span');
    messageTime.classList.add('message-time');
    messageTime.textContent = formatTime();

    messageHeader.appendChild(messageAvatar);
    messageHeader.appendChild(messageSender);
    messageHeader.appendChild(messageTime);

    // Create message content
    const messageContent = document.createElement('div');
    messageContent.classList.add('message-content');

    // Enhanced Markdown formatting for structured content
    let formattedContent = content
      // Code blocks first (to protect them from other replacements)
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      // Headers (## and ###)
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      // Bold text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic text
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Blockquotes
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      // Inline code (`code`)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Convert double line breaks to paragraph breaks
      .replace(/\n\s*\n/g, '</p><p>')
      // Convert remaining single line breaks to spaces for natural flow
      .replace(/\n/g, ' ')
      // Clean up extra spaces
      .replace(/\s+/g, ' ')
      .trim();

    // Wrap in paragraphs if content has paragraph breaks
    if (formattedContent.includes('</p><p>')) {
      formattedContent = '<p>' + formattedContent + '</p>';
    } else if (formattedContent && !formattedContent.startsWith('<')) {
      formattedContent = '<p>' + formattedContent + '</p>';
    }

    messageEl.appendChild(messageHeader);
    messageEl.appendChild(messageContent);
    chatMessages.appendChild(messageEl);

    // Apply typing effect for AI messages
    if (sender === 'ai') {
      startTypingEffect(messageContent, formattedContent);
    } else {
      messageContent.innerHTML = formattedContent;
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (save) {
      chatHistory.push({ content, sender, timestamp: new Date() });
    }

    return messageEl;
  }

  // Modern welcome message
  function showWelcomeMessage() {
    if (!chatMessages) return;

    const welcomeEl = document.createElement('div');
    welcomeEl.classList.add('welcome-message');
    welcomeEl.innerHTML = `
      <div class="welcome-icon">
        <i class="fas fa-robot"></i>
      </div>
      <div class="welcome-title">Welcome to Nation Assistant</div>
      <div class="welcome-subtitle">
        I'm here to help you understand and analyze this webpage. 
        Ask me anything about the content, and I'll provide insights and answers.
      </div>
    `;

    chatMessages.appendChild(welcomeEl);
  }

  // Modern typing effect - more subtle and smooth
  function startTypingEffect(element, finalContent) {
    // Show typing indicator first
    showTypingIndicator();
    
    setTimeout(() => {
      hideTypingIndicator();
      
      // Simple character-by-character typing
      let currentIndex = 0;
      const typingSpeed = 20; // ms per character
      
      element.innerHTML = '';
      
      function typeNextChar() {
        if (currentIndex < finalContent.length) {
          element.innerHTML = finalContent.substring(0, currentIndex + 1);
          currentIndex++;
          
          // Scroll to bottom
          if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }
          
          setTimeout(typeNextChar, typingSpeed);
        } else {
          // Ensure final content is properly set
          element.innerHTML = finalContent;
        }
      }
      
      typeNextChar();
    }, 800);
  }

  function showTypingIndicator() {
    const typingEl = document.createElement('div');
    typingEl.classList.add('typing-indicator');
    typingEl.id = 'typing-indicator';
    typingEl.innerHTML = `
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    `;
    
    chatMessages.appendChild(typingEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function hideTypingIndicator() {
    const typingEl = document.getElementById('typing-indicator');
    if (typingEl) {
      typingEl.remove();
    }
  }

  function formatTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function setProcessing(processing) {
    isProcessing = processing;

    // Update send button with modern loading state
    if (sendBtn) {
      sendBtn.disabled = processing || !chatInput?.value.trim();
      if (processing) {
        sendBtn.innerHTML = '<div class="loading-spinner"></div>';
        sendBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        sendBtn.style.color = '#666666';
      } else {
        sendBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
        handleInputChange(); // Restore proper button state
      }
    }

    // Update input container
    const inputContainer = document.getElementById('input-container');
    if (inputContainer) {
      if (processing) {
        inputContainer.style.opacity = '0.7';
      } else {
        inputContainer.style.opacity = '1';
      }
    }

    // Disable input during processing
    if (chatInput) {
      chatInput.disabled = processing;
      if (processing) {
        chatInput.placeholder = 'Nation Assistant is thinking...';
      } else {
        chatInput.placeholder = 'Message Nation Assistant...';
      }
    }
  }

  async function loadCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        currentTabId = tab.id;

        if (tabTitle) {
          tabTitle.textContent = tab.title || 'Current Page';
        }
        if (tabUrl) {
          tabUrl.textContent = tab.url ? new URL(tab.url).hostname : '';
        }
      }
    } catch (error) {
      // Silently handle error
    }
  }



  // Enable chat input
  function enableChatInput() {
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
});