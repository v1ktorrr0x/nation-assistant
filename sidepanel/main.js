// sidepanel/main.js
'use strict';

import { state, validateState } from './state.js';
import {
    initUI,
    elements,
    showWelcomeMessage,
    enableChatInput,
    handleInputChange,
    handleKeyDown,
    handleRefresh,
    showHelpDialog,
    cleanup,
    pauseStreamingAnimations,
    resumeStreamingAnimations,
    addAIMessage,
    addSystemMessage,
    showError
} from './ui.js';
import { loadCurrentTab, handleContextAction, hasContextAction, handleSendMessage } from './api.js';
import { logger } from './utils.js';
import { MESSAGE_TYPES, STORAGE_KEYS } from '../services/constants.js';

async function init() {
    try {
        // Validate initial state
        validateState();

        initUI();

        // Check for API key first
        const apiKeyResponse = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CHECK_API_KEY });
        if (!apiKeyResponse.data.isConfigured) {
            showError('API key not configured. Please configure it in the options page.', { apiKey: true });
            return; // Stop initialization
        }
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

document.addEventListener('DOMContentLoaded', async () => {
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

// Listen for translation updates from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MESSAGE_TYPES.TRANSLATION_READY) {
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
        chrome.storage.local.remove([STORAGE_KEYS.CONTEXT_ACTION]);
    } else if (message.type === MESSAGE_TYPES.TRANSLATION_ERROR) {
        // Remove loading message
        const loadingMsg = document.getElementById('translation-loading');
        if (loadingMsg) {
            loadingMsg.remove();
        }

        // Show error with AI streaming for consistency
        addAIMessage(`❌ Translation failed: ${message.error}`);

        // Clear the context action
        chrome.storage.local.remove([STORAGE_KEYS.CONTEXT_ACTION]);
    }
});
