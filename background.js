// Nation Assistant Background Script
'use strict';

import { LLMService } from './services/llm-service.js';
import {
    MESSAGE_TYPES,
    CONTEXT_MENU_IDS,
    COMMANDS,
    STORAGE_KEYS,
    LANGUAGES,
    MORE_LANGUAGES
} from './services/constants.js';


// Enable comprehensive logging for debugging
const DEBUG = false;
const logger = {
  log: (message, ...args) => {
    if (DEBUG) console.log(`[Background] ${message}`, ...args);
  },
  warn: (message, ...args) => {
    if (DEBUG) console.warn(`[Background] ${message}`, ...args);
  },
  error: (message, ...args) => {
    if (DEBUG) console.error(`[Background] ${message}`, ...args);
  },
  debug: (message, ...args) => {
    if (DEBUG) console.debug(`[Background] ${message}`, ...args);
  }
};

/**
 * Background Service - Extension coordinator
 */
class NationAssistantBackground {
    constructor() {
        this.llmService = new LLMService();
        this.init();
    }

    /**
     * Initialize background service
     */
    async init() {
        try {
            await this.llmService.init();
            this.setupEventListeners();
            this.setupContextMenus();
            this.setupMessageHandlers();
        } catch (error) {
            logger.error('Initialization error:', error);
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync') {
                this.handleStorageChange(changes);
            }
        });
        chrome.action.onClicked.addListener((tab) => {
            logger.log('Extension icon clicked, opening sidepanel for tab:', tab.id);
            chrome.sidePanel.open({ tabId: tab.id }).catch(error => {
                logger.error('Failed to open sidepanel:', error);
            });
        });

        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
                this.ensureContentScript(tabId).catch(() => { });
            }
        });

        // Global keyboard shortcut handler
        chrome.commands.onCommand.addListener((command) => {
            this.handleCommand(command);
        });
    }

    /**
     * Handle storage changes
     */
    async handleStorageChange(changes) {
        if (changes[STORAGE_KEYS.API_KEY] || changes[STORAGE_KEYS.API_BASE_URL]) {
            await this.llmService.loadSettings();
        }
    }

    /**
     * Handle keyboard commands
     */
    async handleCommand(command) {
        try {
            switch (command) {
                case COMMANDS.OPEN_SIDEPANEL:
                    const tab = await this.getActiveTab();
                    if (tab) {
                        await chrome.sidePanel.open({ tabId: tab.id });
                    }
                    break;
                default:
                    logger.debug('Unknown command:', command);
            }
        } catch (error) {
            console.error('[Background] Command handler error:', error);
        }
    }

    /**
     * Setup context menus
     */
    setupContextMenus() {
        chrome.contextMenus.removeAll();

        chrome.contextMenus.create({
            id: CONTEXT_MENU_IDS.PARENT,
            title: 'Nation Assistant',
            contexts: ['page', 'selection']
        });

        chrome.contextMenus.create({
            id: CONTEXT_MENU_IDS.ANALYZE_PAGE,
            parentId: CONTEXT_MENU_IDS.PARENT,
            title: 'Analyze Page',
            contexts: ['page']
        });

        chrome.contextMenus.create({
            id: CONTEXT_MENU_IDS.CHAT_WITH_SELECTION,
            parentId: CONTEXT_MENU_IDS.PARENT,
            title: 'Chat with Selection',
            contexts: ['selection']
        });

        // Add quick translate options - flatten menu structure
        chrome.contextMenus.create({
            id: CONTEXT_MENU_IDS.TRANSLATE_AUTO,
            parentId: CONTEXT_MENU_IDS.PARENT,
            title: '🌐 Quick Translate',
            contexts: ['selection']
        });

        // Add most common languages directly under main menu
        LANGUAGES.forEach(lang => {
            chrome.contextMenus.create({
                id: lang.id,
                parentId: CONTEXT_MENU_IDS.PARENT,
                title: lang.title,
                contexts: ['selection']
            });
        });

        // Add "More Languages" submenu for less common ones
        chrome.contextMenus.create({
            id: CONTEXT_MENU_IDS.TRANSLATE_MORE,
            parentId: CONTEXT_MENU_IDS.PARENT,
            title: '🌍 More Languages...',
            contexts: ['selection']
        });

        MORE_LANGUAGES.forEach(lang => {
            chrome.contextMenus.create({
                id: lang.id,
                parentId: CONTEXT_MENU_IDS.TRANSLATE_MORE,
                title: lang.title,
                contexts: ['selection']
            });
        });


        chrome.contextMenus.onClicked.addListener((info, tab) => {
            this.handleContextMenuClick(info, tab);
        });
    }

    /**
     * Setup message handlers
     */
    setupMessageHandlers() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open
        });
    }

    /**
     * Handle messages
     */
    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.type) {
                case MESSAGE_TYPES.GET_ACTIVE_TAB:
                    const tab = await this.getActiveTab();
                    sendResponse({ success: true, data: tab });
                    break;

                case MESSAGE_TYPES.CHAT_WITH_PAGE:
                    sendResponse(await this.handleChatWithPage(message));
                    break;

                case MESSAGE_TYPES.SUMMARIZE_PAGE:
                    sendResponse(await this.handleSummarizePage(message));
                    break;

                case MESSAGE_TYPES.LIST_KEY_POINTS:
                    sendResponse(await this.handleListKeyPoints(message));
                    break;

                case MESSAGE_TYPES.EXPLAIN_PAGE:
                    sendResponse(await this.handleExplainPage(message));
                    break;

                case MESSAGE_TYPES.TEST_CONNECTION:
                    if (message.testConfig) {
                        // Test with provided configuration (from options page)
                        const tempService = new LLMService();
                        await tempService.initWithConfig(message.testConfig);
                        await tempService.makeRequest([{ role: 'user', content: 'test' }], { maxTokens: 10 });
                    } else {
                        // Test with current stored configuration
                        await this.llmService.makeRequest([{ role: 'user', content: 'test' }], { maxTokens: 10 });
                    }
                    sendResponse({ success: true, data: { connected: true } });
                    break;

                case MESSAGE_TYPES.RELOAD_SETTINGS:
                    await this.llmService.loadSettings();
                    sendResponse({ success: true, data: { reloaded: true } });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown message type' });
            }
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    /**
     * Handle context menu clicks
     */
    async handleContextMenuClick(info, tab) {
        const menuItemId = info.menuItemId;
        const selectionText = info.selectionText;

        try {
            const allLanguages = [...LANGUAGES, ...MORE_LANGUAGES];
            const language = allLanguages.find(lang => lang.id === menuItemId);

            if (language) {
                await this.startTranslation(selectionText, language.language, tab);
                return;
            }

            switch (menuItemId) {
                case CONTEXT_MENU_IDS.ANALYZE_PAGE:
                    await chrome.sidePanel.open({ tabId: tab.id });
                    break;

                case CONTEXT_MENU_IDS.CHAT_WITH_SELECTION:
                    await chrome.storage.local.set({
                        [STORAGE_KEYS.CONTEXT_ACTION]: {
                            action: 'analyze',
                            text: selectionText,
                            timestamp: Date.now(),
                            tabId: tab.id
                        }
                    });
                    await chrome.sidePanel.open({ tabId: tab.id });
                    break;
                case CONTEXT_MENU_IDS.TRANSLATE_AUTO:
                    this.startSmartTranslation(selectionText, tab);
                    break;
            }
        } catch (error) {
            console.error('[Background] Context menu error:', error, 'Menu item:', menuItemId);
        }
    }

    /**
     * Get active tab
     */
    async getActiveTab() {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return tabs[0] || null;
    }

    /**
     * Ensure content script is injected with retry logic and better error handling
     */
    async ensureContentScript(tabId, retryCount = 0) {
        const maxRetries = 3;
        
        try {
            // Check if content script is already injected
            const response = await chrome.tabs.sendMessage(tabId, { type: MESSAGE_TYPES.PING });
            if (response?.pong) return true;
        } catch { 
            // Content script not present, continue with injection
        }

        try {
            // Get tab info to check if injection is possible
            const tab = await chrome.tabs.get(tabId);
            
            // Check if tab URL supports content script injection
            if (!tab.url || 
                tab.url.startsWith('chrome://') || 
                tab.url.startsWith('chrome-extension://') ||
                tab.url.startsWith('moz-extension://') ||
                tab.url.startsWith('edge://') ||
                tab.url === 'about:blank') {
                throw new Error('Content script injection not supported on this page type');
            }

            // Inject content script
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['libs/Readability.js', 'libs/turndown.js', 'debug-config.js', 'content.js']
            });

            // Wait for injection to complete
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Verify injection worked
            const verify = await chrome.tabs.sendMessage(tabId, { type: MESSAGE_TYPES.PING });
            if (verify?.pong) {
                logger.log('Content script successfully injected for tab:', tabId);
                return true;
            }
            
            throw new Error('Content script verification failed');
            
        } catch (error) {
            logger.warn(`Content script injection attempt ${retryCount + 1} failed:`, error.message);
            
            // Retry logic for transient failures
            if (retryCount < maxRetries && 
                !error.message.includes('not supported') &&
                !error.message.includes('Cannot access')) {
                
                await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1)));
                return this.ensureContentScript(tabId, retryCount + 1);
            }
            
            // Final failure - provide user-friendly error
            if (error.message.includes('not supported')) {
                throw new Error('This page type doesn\'t support content analysis. Try a regular webpage.');
            } else if (error.message.includes('Cannot access')) {
                throw new Error('Cannot access this page. The website may be blocking extensions.');
            } else {
                throw new Error('Unable to analyze this page. Please try refreshing and try again.');
            }
        }
    }

    /**
     * Handle chat with page with enhanced error handling
     */
    async handleChatWithPage(message) {
        const { tabId, question = "" } = message;

        try {
            const tab = tabId ? await chrome.tabs.get(tabId) : await this.getActiveTab();
            if (!tab) throw new Error('No active tab found. Please make sure you have a webpage open.');

            // Enhanced content script injection with user feedback
            try {
                await this.ensureContentScript(tab.id);
            } catch (injectionError) {
                // Provide specific guidance based on injection failure
                throw new Error(`${injectionError.message}\n\nTip: Try refreshing the page or navigating to a different website.`);
            }

            // Get page content with timeout
            const contentPromise = chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.GET_PAGE_CONTENT });
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Page content extraction timed out')), 10000)
            );
            
            const response = await Promise.race([contentPromise, timeoutPromise]);
            
            if (!response?.pageContent) {
                throw new Error('Unable to extract content from this page. The page might be empty or still loading.');
            }

            if (response.pageContent.trim().length < 10) {
                throw new Error('This page appears to have very little content to analyze. Try a different page with more text.');
            }

            const llmResponse = await this.llmService.chatWithPage(response.pageContent, question);

            return { success: true, data: { response: llmResponse } };
            
        } catch (error) {
            logger.error('Chat with page failed:', error.message);
            
            // Provide user-friendly error messages
            let userMessage = error.message;
            
            if (error.message.includes('Extension context invalidated')) {
                userMessage = 'Extension needs to be reloaded. Please refresh the page and try again.';
            } else if (error.message.includes('No active tab')) {
                userMessage = 'No active tab found. Please make sure you have a webpage open and try again.';
            } else if (error.message.includes('API key')) {
                userMessage = 'API configuration issue. Please check your settings and ensure your API key is valid.';
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
                userMessage = 'Network connection issue. Please check your internet connection and try again.';
            }
            
            return { success: false, error: userMessage };
        }
    }

    /**
     * A generic handler for page actions like summarize, explain, etc.
     */
    async _handlePageAction(message, actionCallback) {
        const { tabId, ...rest } = message;
        try {
            const tab = tabId ? await chrome.tabs.get(tabId) : await this.getActiveTab();
            if (!tab) throw new Error('No active tab found.');

            await this.ensureContentScript(tab.id);

            const contentPromise = chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.GET_PAGE_CONTENT });
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Page content extraction timed out')), 10000)
            );

            const response = await Promise.race([contentPromise, timeoutPromise]);
            if (!response?.pageContent) {
                throw new Error('Unable to extract content from this page.');
            }
             if (response.pageContent.trim().length < 10) {
                throw new Error('This page appears to have very little content to analyze.');
            }

            const llmResponse = await actionCallback(response.pageContent, rest);
            return { success: true, data: { response: llmResponse } };
        } catch (error) {
            logger.error('Page action failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Handles summarizing the page
     */
    async handleSummarizePage(message) {
        return this._handlePageAction(message, (pageContent) => {
            return this.llmService.summarizePage(pageContent);
        });
    }

    /**
     * Handles listing key points from the page
     */
    async handleListKeyPoints(message) {
        return this._handlePageAction(message, (pageContent) => {
            return this.llmService.listKeyPoints(pageContent);
        });
    }

    /**
     * Handles explaining a selection from the page
     */
    async handleExplainPage(message) {
        return this._handlePageAction(message, (pageContent, { selectedText }) => {
            return this.llmService.explainPage(pageContent, selectedText);
        });
    }


    /**
     * Start smart translation (auto-detect best target language)
     */
    startSmartTranslation(selectedText, tab) {
        try {
            if (!selectedText || !selectedText.trim()) {
                throw new Error('No text selected for translation');
            }

            chrome.sidePanel.open({ tabId: tab.id }).then(() => {
                this.handleSmartTranslation(selectedText, tab);
            }).catch(error => {
                console.error('[Background] Failed to open sidepanel:', error);
            });

        } catch (error) {
            console.error('[Background] Smart translation start error:', error);
        }
    }

    /**
     * Start translation
     */
    startTranslation(selectedText, targetLanguage, tab) {
        try {
            if (!selectedText || !selectedText.trim()) {
                throw new Error('No text selected for translation');
            }

            chrome.sidePanel.open({ tabId: tab.id }).then(() => {
                this.handleTranslation(selectedText, targetLanguage, tab);
            }).catch(error => {
                console.error('[Background] Failed to open sidepanel:', error);
            });

        } catch (error) {
            console.error('[Background] Translation start error:', error);
        }
    }

    /**
     * Handle smart translation (auto-detect target language)
     */
    async handleSmartTranslation(selectedText, tab) {
        try {
            if (!selectedText || !selectedText.trim()) {
                throw new Error('No text selected for translation');
            }

            await chrome.storage.local.set({
                [STORAGE_KEYS.CONTEXT_ACTION]: {
                    action: 'translate',
                    originalText: selectedText,
                    translation: null,
                    targetLanguage: 'Auto-detected',
                    loading: true,
                    smart: true,
                    timestamp: Date.now(),
                    tabId: tab.id
                }
            });

            // Use LLM to detect language and translate to most appropriate target
            const smartTranslation = await this.llmService.smartTranslate(selectedText);

            await chrome.storage.local.set({
                [STORAGE_KEYS.CONTEXT_ACTION]: {
                    action: 'translate',
                    originalText: selectedText,
                    translation: smartTranslation.translation,
                    targetLanguage: smartTranslation.targetLanguage,
                    detectedLanguage: smartTranslation.detectedLanguage,
                    loading: false,
                    smart: true,
                    timestamp: Date.now(),
                    tabId: tab.id
                }
            });

            chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.TRANSLATION_READY,
                translation: smartTranslation.translation,
                targetLanguage: smartTranslation.targetLanguage,
                detectedLanguage: smartTranslation.detectedLanguage,
                smart: true
            }).catch(() => { });

        } catch (error) {
            console.error('[Background] Smart translation error:', error);

            await chrome.storage.local.set({
                [STORAGE_KEYS.CONTEXT_ACTION]: {
                    action: 'translate',
                    originalText: selectedText,
                    translation: null,
                    targetLanguage: 'Auto-detected',
                    loading: false,
                    error: error.message,
                    smart: true,
                    timestamp: Date.now(),
                    tabId: tab.id
                }
            });

            chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.TRANSLATION_ERROR,
                error: error.message
            }).catch(() => { });
        }
    }

    /**
     * Handle translation request
     */
    async handleTranslation(selectedText, targetLanguage, tab) {
        try {
            if (!selectedText || !selectedText.trim()) {
                throw new Error('No text selected for translation');
            }

            await chrome.storage.local.set({
                [STORAGE_KEYS.CONTEXT_ACTION]: {
                    action: 'translate',
                    originalText: selectedText,
                    translation: null,
                    targetLanguage: targetLanguage,
                    loading: true,
                    timestamp: Date.now(),
                    tabId: tab.id
                }
            });

            const translation = await this.llmService.translateText(selectedText, targetLanguage);

            await chrome.storage.local.set({
                [STORAGE_KEYS.CONTEXT_ACTION]: {
                    action: 'translate',
                    originalText: selectedText,
                    translation: translation,
                    targetLanguage: targetLanguage,
                    loading: false,
                    timestamp: Date.now(),
                    tabId: tab.id
                }
            });

            chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.TRANSLATION_READY,
                translation: translation,
                targetLanguage: targetLanguage
            }).catch(() => { });

        } catch (error) {
            console.error('[Background] Translation error:', error);

            await chrome.storage.local.set({
                [STORAGE_KEYS.CONTEXT_ACTION]: {
                    action: 'translate',
                    originalText: selectedText,
                    translation: null,
                    targetLanguage: targetLanguage,
                    loading: false,
                    error: error.message,
                    timestamp: Date.now(),
                    tabId: tab.id
                }
            });

            chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.TRANSLATION_ERROR,
                error: error.message
            }).catch(() => { });
        }
    }




}

// Initialize background service
new NationAssistantBackground();