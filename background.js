// Nation Assistant Background Script
'use strict';

import { LLMService } from './services/llm-service.js';

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
            console.error('[Background] Initialization error:', error);
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
            chrome.sidePanel.open({ tabId: tab.id }).catch(error => {
                console.error('[Background] Failed to open sidepanel:', error);
            });
        });

        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
                this.ensureContentScript(tabId).catch(() => { });
            }
        });
    }

    /**
     * Handle storage changes
     */
    async handleStorageChange(changes) {
        if (changes.crestalApiKey || changes.apiBaseUrl) {
            await this.llmService.loadSettings();
        }
    }

    /**
     * Setup context menus
     */
    setupContextMenus() {
        chrome.contextMenus.removeAll();

        chrome.contextMenus.create({
            id: 'nation-assistant',
            title: 'Nation Assistant',
            contexts: ['page', 'selection']
        });

        chrome.contextMenus.create({
            id: 'analyze-page',
            parentId: 'nation-assistant',
            title: 'Analyze Page',
            contexts: ['page']
        });

        chrome.contextMenus.create({
            id: 'chat-with-selection',
            parentId: 'nation-assistant',
            title: 'Chat with Selection',
            contexts: ['selection']
        });

        // Add translate submenu
        chrome.contextMenus.create({
            id: 'translate',
            parentId: 'nation-assistant',
            title: 'Translate',
            contexts: ['selection']
        });


        const languages = [
            { id: 'translate-spanish', title: 'Spanish', code: 'es' },
            { id: 'translate-french', title: 'French', code: 'fr' },
            { id: 'translate-german', title: 'German', code: 'de' },
            { id: 'translate-italian', title: 'Italian', code: 'it' },
            { id: 'translate-portuguese', title: 'Portuguese', code: 'pt' },
            { id: 'translate-russian', title: 'Russian', code: 'ru' },
            { id: 'translate-chinese', title: 'Chinese', code: 'zh' },
            { id: 'translate-japanese', title: 'Japanese', code: 'ja' },
            { id: 'translate-korean', title: 'Korean', code: 'ko' },
            { id: 'translate-arabic', title: 'Arabic', code: 'ar' }
        ];

        languages.forEach(lang => {
            chrome.contextMenus.create({
                id: lang.id,
                parentId: 'translate',
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
                case 'getActiveTab':
                    const tab = await this.getActiveTab();
                    sendResponse({ success: true, data: tab });
                    break;

                case 'chatWithPage':
                    const result = await this.handleChatWithPage(message);
                    sendResponse(result);
                    break;

                case 'testConnection':
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

                case 'reloadSettings':
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
        try {
            switch (info.menuItemId) {
                case 'analyze-page':
                    await chrome.sidePanel.open({ tabId: tab.id });
                    break;

                case 'chat-with-selection':
                    await chrome.storage.local.set({
                        contextAction: {
                            action: 'analyze',
                            text: info.selectionText,
                            timestamp: Date.now(),
                            tabId: tab.id
                        }
                    });
                    await chrome.sidePanel.open({ tabId: tab.id });
                    break;
                case 'translate-spanish':
                    this.startTranslation(info.selectionText, 'Spanish', tab);
                    break;
                case 'translate-french':
                    this.startTranslation(info.selectionText, 'French', tab);
                    break;
                case 'translate-german':
                    this.startTranslation(info.selectionText, 'German', tab);
                    break;
                case 'translate-italian':
                    this.startTranslation(info.selectionText, 'Italian', tab);
                    break;
                case 'translate-portuguese':
                    this.startTranslation(info.selectionText, 'Portuguese', tab);
                    break;
                case 'translate-russian':
                    this.startTranslation(info.selectionText, 'Russian', tab);
                    break;
                case 'translate-chinese':
                    this.startTranslation(info.selectionText, 'Chinese', tab);
                    break;
                case 'translate-japanese':
                    this.startTranslation(info.selectionText, 'Japanese', tab);
                    break;
                case 'translate-korean':
                    this.startTranslation(info.selectionText, 'Korean', tab);
                    break;
                case 'translate-arabic':
                    this.startTranslation(info.selectionText, 'Arabic', tab);
                    break;
            }
        } catch (error) {
            console.error('[Background] Context menu error:', error, 'Menu item:', info.menuItemId);
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
     * Ensure content script is injected
     */
    async ensureContentScript(tabId) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
            if (response?.pong) return;
        } catch { }

        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
        });

        await new Promise(resolve => setTimeout(resolve, 100));
        const verify = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
        if (!verify?.pong) throw new Error('Content script injection failed');
    }

    /**
     * Handle chat with page
     */
    async handleChatWithPage(message) {
        const { tabId, question = "", chatHistory = [] } = message;

        const tab = tabId ? await chrome.tabs.get(tabId) : await this.getActiveTab();
        if (!tab) throw new Error('No active tab');

        await this.ensureContentScript(tab.id);

        const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' });
        if (!response?.pageContent) throw new Error('No page content');

        const llmResponse = await this.llmService.chatWithPage(response.pageContent, question, chatHistory);

        return { success: true, data: { response: llmResponse } };
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
     * Handle translation request
     */
    async handleTranslation(selectedText, targetLanguage, tab) {
        try {
            if (!selectedText || !selectedText.trim()) {
                throw new Error('No text selected for translation');
            }

            await chrome.storage.local.set({
                contextAction: {
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
                contextAction: {
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
                type: 'TRANSLATION_READY',
                translation: translation
            }).catch(() => { });

        } catch (error) {
            console.error('[Background] Translation error:', error);

            await chrome.storage.local.set({
                contextAction: {
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
                type: 'TRANSLATION_ERROR',
                error: error.message
            }).catch(() => { });
        }
    }




}

// Initialize background service
new NationAssistantBackground();