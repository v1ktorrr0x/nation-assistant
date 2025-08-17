// sidepanel/ui.js
'use strict';

import { state, updateState } from './state.js';
import { formatAIResponse } from './formatter.js';
import { formatTime, escapeHtml, logger } from './utils.js';
import { retryLastMessage, handleSendMessage } from './api.js';
import { ELEMENT_IDS } from '../services/constants.js';


export let elements = {};

export function initUI() {
    elements = {
        chatMessages: document.getElementById(ELEMENT_IDS.CHAT_MESSAGES),
        chatInput: document.getElementById(ELEMENT_IDS.CHAT_INPUT),
        sendBtn: document.getElementById(ELEMENT_IDS.SEND_BTN),
        tabTitle: document.getElementById(ELEMENT_IDS.TAB_TITLE),
        tabUrl: document.getElementById(ELEMENT_IDS.TAB_URL),
        refreshBtn: document.getElementById(ELEMENT_IDS.REFRESH_BTN),
        helpBtn: document.getElementById(ELEMENT_IDS.HELP_BTN),
        settingsBtn: document.getElementById(ELEMENT_IDS.SETTINGS_BTN),
        inputContainer: document.getElementById(ELEMENT_IDS.INPUT_CONTAINER)
    };
}

/**
 * Ensure all AI responses use streaming animation
 * This function wraps addMessage to force streaming for AI responses
 */
export function addAIMessage(content, save = true) {
    // Validate that this is being used for AI content
    if (typeof content !== 'string' || !content.trim()) {
        return null;
    }
    return addMessage(content, "ai", save);
}

/**
 * Add system message without streaming (for notifications, status updates)
 */
export function addSystemMessage(content, save = false) {
    return addMessage(content, "system", save);
}

/**
 * Update input validation and character count
 */
export function updateInputValidation() {
    const { chatInput } = elements;
    if (!chatInput) return;

    const text = chatInput.value;
    const length = text.length;
    const maxLength = 4000;

    // Create or update character counter
    let counter = document.getElementById(ELEMENT_IDS.CHAR_COUNTER);
    if (!counter) {
        counter = document.createElement('div');
        counter.id = ELEMENT_IDS.CHAR_COUNTER;
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
 * Comprehensive cleanup function to prevent memory leaks
 */
export function cleanup() {
    // Stop all streaming controllers
    if (state.currentStreamingController) {
        state.currentStreamingController();
        updateState({ currentStreamingController: null });
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
    // cleanupStaleResources(); // This is called in state.js

    // Reset processing state safely
    updateState({ isProcessing: false });

    logger.log('Cleanup completed');
}

/**
 * Smooth scroll to bottom of chat messages
 */
export function smoothScrollToBottom() {
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        // Use smooth scrolling for better UX
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    }
}

/**
 * Instant scroll to bottom (for rapid streaming)
 */
function instantScrollToBottom() {
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

/**
 * Pause streaming animations to save resources
 */
export function pauseStreamingAnimations() {
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
export function resumeStreamingAnimations() {
    // Note: This is a placeholder - actual resume logic would need
    // to store streaming state and resume from where it left off
    logger.log('Resuming streaming animations');
}

/**
 * Clear all pending timeouts (placeholder for timeout tracking)
 */
export function clearAllTimeouts() {
    // In a more complete implementation, we would track all timeout IDs
    // and clear them here
    logger.log('Clearing all timeouts');
}

export function handleInputChange() {
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

export function handleKeyDown(e) {
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

export async function handleRefresh() {
    if (state.isProcessing) return;

    try {
        // Clear chat history
        updateState({ chatHistory: [] });


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

export function showError(message, context = {}) {
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

export function addMessage(content, sender, save = true) {
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
        updateState({ currentStreamingController: streamingController });


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
export function showWelcomeMessage() {
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

export function showTypingIndicator(statusText = 'THINKING...', stage = 'thinking') {
    const { chatMessages } = elements;
    if (!chatMessages) return;

    // Remove existing indicator
    hideTypingIndicator();

    const typingEl = document.createElement('div');
    typingEl.classList.add('typing-indicator', `stage-${stage}`);
    typingEl.id = ELEMENT_IDS.TYPING_INDICATOR;

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

export function hideTypingIndicator() {
    const indicator = document.getElementById(ELEMENT_IDS.TYPING_INDICATOR);
    if (indicator) {
        // Fade out animation before removal
        indicator.style.opacity = '0';
        indicator.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            indicator.remove();
        }, 300);
    }
}

export function updateTypingIndicator(statusText, stage = 'thinking') {
    const indicator = document.getElementById(ELEMENT_IDS.TYPING_INDICATOR);
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

export function setProcessing(processing, statusText = 'THINKING...', stage = 'thinking') {
    const { sendBtn, chatInput, inputContainer } = elements;
    updateState({ isProcessing: processing });


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
    const typingIndicator = document.getElementById(ELEMENT_IDS.TYPING_INDICATOR);
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

export function enableChatInput() {
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

/**
 * Show comprehensive help dialog with shortcuts and tips
 */
export function showHelpDialog() {
    // Remove existing help dialog if present
    const existingDialog = document.getElementById(ELEMENT_IDS.HELP_DIALOG);
    if (existingDialog) {
        existingDialog.remove();
        return;
    }

    const helpDialog = document.createElement('div');
    helpDialog.id = ELEMENT_IDS.HELP_DIALOG;
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
