// sidepanel/api.js
'use strict';

import { state, updateState } from './state.js';
import { logger, validateAndSanitizeInput } from './utils.js';
import {
    addAIMessage,
    addSystemMessage,
    addMessage,
    showError,
    showTypingIndicator,
    hideTypingIndicator,
    updateTypingIndicator,
    setProcessing,
    handleInputChange,
    smoothScrollToBottom
} from './ui.js';
import { MESSAGE_TYPES, STORAGE_KEYS } from '../services/constants.js';

export async function handleSendMessage(messageText = null, isRegenerate = false) {
    const chatInput = document.getElementById('chat-input');
    const message = messageText || chatInput?.value.trim();

    logger.log('handleSendMessage called:', { messageText, isRegenerate, message, isProcessing: state.isProcessing });

    // Enhanced race condition protection
    if (!message || state.isProcessing) {
        logger.warn('Message send blocked:', { hasMessage: !!message, isProcessing: state.isProcessing });
        return;
    }

    // Immediately set processing state to prevent race conditions
    updateState({ isProcessing: true });


    // Additional safety check after state change
    if (!message.trim()) {
        updateState({ isProcessing: false });
        logger.warn('Empty message after processing state set');
        return;
    }

    // Comprehensive input validation
    const validation = validateAndSanitizeInput(message);
    if (!validation.isValid) {
        updateState({ isProcessing: false }); // Reset processing state
        showError(validation.error, {});
        return;
    }

    // Use sanitized message
    const sanitizedMessage = validation.sanitized;



    // Store sanitized message and track chat action for retry functionality
    updateState({ 
        lastUserMessage: sanitizedMessage,
        lastAction: { 
            type: 'chat', 
            data: { message: sanitizedMessage } 
        }
    });
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
            type: MESSAGE_TYPES.CHAT_WITH_PAGE,
            tabId: state.currentTabId,
            question: sanitizedMessage
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
            connection: error.message.includes('fetch') || error.message.includes('Failed to fetch')
        });
    } finally {
        // Comprehensive cleanup in finally block
        try {
            userMessageEl?.classList.remove('loading');

            // Always reset processing state
            updateState({ isProcessing: false });
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
            updateState({ isProcessing: false });
        }
    }
}

/**
 * Retry the last action (chat message or smart action)
 */
export function retryLastMessage() {
    try {
        logger.log('Retry attempt - lastAction:', state.lastAction, 'isProcessing:', state.isProcessing);

        if (!state.lastAction) {
            logger.warn('No last action to retry');
            addSystemMessage("No previous action to retry. Please try again.");
            return;
        }

        if (state.isProcessing) {
            logger.warn('Cannot retry while processing');
            addSystemMessage("Please wait for the current request to complete before retrying.");
            return;
        }

        logger.log('Retrying last action:', state.lastAction);

        // Add a small delay to ensure UI state is properly reset
        const timeoutId = setTimeout(() => {
            state.activeTimeouts.delete(timeoutId);
            
            if (state.lastAction.type === 'chat') {
                // Retry chat message
                handleSendMessage(state.lastAction.data.message, true);
            } else if (state.lastAction.type === 'smart') {
                // Retry smart action - import dynamically to avoid circular imports
                import('./ui.js').then(({ handleSmartAction }) => {
                    handleSmartAction(state.lastAction.data.actionType);
                }).catch(error => {
                    logger.error('Failed to load smart action handler for retry:', error);
                    addSystemMessage("Failed to retry smart action. Please try again manually.");
                });
            }
        }, 100);
        state.activeTimeouts.add(timeoutId);
    } catch (error) {
        logger.error('Error retrying last action:', error);
        addSystemMessage("Failed to retry action. Please try again.");
    }
}


export async function loadCurrentTab() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            updateState({ currentTabId: tab.id });

            const tabTitle = document.getElementById('tab-title');
            const tabUrl = document.getElementById('tab-url');
            if (tabTitle) tabTitle.textContent = tab.title || 'Current Page';
            if (tabUrl) tabUrl.textContent = tab.url ? new URL(tab.url).hostname : '';
        }
    } catch (error) {
        // Silently handle error
        logger.warn('Failed to load current tab:', error.message);
    }
}


export async function hasContextAction() {
    try {
        const result = await chrome.storage.local.get([STORAGE_KEYS.CONTEXT_ACTION]);
        return !!result.contextAction;
    } catch (error) {
        return false;
    }
}

export async function handleContextAction() {
    try {
        const result = await chrome.storage.local.get([STORAGE_KEYS.CONTEXT_ACTION]);
        const contextAction = result.contextAction;

        if (!contextAction) return;

        // Check if context action is stale (older than 5 minutes)
        const now = Date.now();
        const actionAge = now - (contextAction.timestamp || 0);
        const maxAge = 5 * 60 * 1000; // 5 minutes

        if (actionAge > maxAge) {
            logger.log('Context action expired, cleaning up');
            chrome.storage.local.remove([STORAGE_KEYS.CONTEXT_ACTION]);
            return;
        }

        // Validate context action data
        if (!contextAction.action || (!contextAction.text && !contextAction.originalText)) {
            logger.warn('Invalid context action data, cleaning up');
            chrome.storage.local.remove([STORAGE_KEYS.CONTEXT_ACTION]);
            return;
        }

        // Handle different context actions with enhanced error recovery
        try {
            switch (contextAction.action) {
                case 'translate':
                    await handleTranslateAction(contextAction);
                    break;
                case 'analyze':
                    handleListKeyPointsAction(contextAction);
                    break;
                case 'summarize':
                    handleSummarizeAction(contextAction);
                    break;
                case 'explain':
                    handleExplainAction(contextAction);
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
                chrome.storage.local.remove([STORAGE_KEYS.CONTEXT_ACTION]);
            }
        } catch (actionError) {
            logger.error('Error processing context action:', actionError);

            // Show user-friendly error and clean up
            addSystemMessage('❌ Failed to process the selected text. Please try selecting the text again.');
            chrome.storage.local.remove([STORAGE_KEYS.CONTEXT_ACTION]);
        }
    } catch (error) {
        logger.error('Error handling context action:', error);

        // Clean up on any error
        chrome.storage.local.remove([STORAGE_KEYS.CONTEXT_ACTION]).catch(() => { });
    }
}

function handleTranslateAction(contextAction) {
    try {
        const { originalText, targetLanguage, smart } = contextAction;
        const chatMessages = document.getElementById('chat-messages');

        if (!chatMessages) {
            logger.error('Chat messages container not found');
            return;
        }

        if (!originalText || !originalText.trim()) {
            addSystemMessage('❌ No text provided for translation.');
            return;
        }

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
              <strong>Target:</strong> ${targetLanguage || 'Auto-detected'}
            </div>
          </div>
        </div>
      `;
        chatMessages.appendChild(loadingEl);
        smoothScrollToBottom();
    } catch (error) {
        logger.error('Error in handleTranslateAction:', error);
        addSystemMessage('❌ Failed to process translation request.');
    }
}

export async function _sendPageAction(action) {
    const { type, payload = {}, processingMessage } = action;
    logger.log(`_sendPageAction called:`, { type, payload, isProcessing: state.isProcessing });

    if (state.isProcessing) {
        logger.warn('Action blocked: another process is running.');
        return;
    }

    updateState({ isProcessing: true });
    setProcessing(true, processingMessage, 'analyzing');

    try {
        const response = await chrome.runtime.sendMessage({
            type: type,
            tabId: state.currentTabId,
            ...payload
        });

        if (response?.success) {
            addAIMessage(response.data.response);
        } else {
            throw new Error(response?.error || 'Unknown error performing action');
        }
    } catch (error) {
        showError(error.message, {
            connection: error.message.includes('fetch') || error.message.includes('Failed to fetch')
        });
    } finally {
        updateState({ isProcessing: false });
        setProcessing(false);
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.disabled = false;
            chatInput.focus();
        }
    }
}


function handleSummarizeAction(contextAction) {
    addSystemMessage('Summarizing the page...');
    _sendPageAction({
        type: MESSAGE_TYPES.SUMMARIZE_PAGE,
        processingMessage: 'SUMMARIZING...'
    });
}

function handleExplainAction(contextAction) {
    const { text } = contextAction;
    addSystemMessage(`Explaining: "${text}"`);
    _sendPageAction({
        type: MESSAGE_TYPES.EXPLAIN_PAGE,
        payload: { selectedText: text },
        processingMessage: 'EXPLAINING...'
    });
}

function handleListKeyPointsAction(contextAction) {
    addSystemMessage('Extracting key points from the page...');
    _sendPageAction({
        type: MESSAGE_TYPES.LIST_KEY_POINTS,
        processingMessage: 'EXTRACTING...'
    });
}
