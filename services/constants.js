export const MESSAGE_TYPES = {
  GET_ACTIVE_TAB: 'getActiveTab',
  CHAT_WITH_PAGE: 'chatWithPage',
  TEST_CONNECTION: 'testConnection',
  RELOAD_SETTINGS: 'reloadSettings',
  PING: 'PING',
  GET_PAGE_CONTENT: 'GET_PAGE_CONTENT',
  TRANSLATION_READY: 'TRANSLATION_READY',
  TRANSLATION_ERROR: 'TRANSLATION_ERROR',
  SUMMARIZE_PAGE: 'summarizePage',
  EXPLAIN_PAGE: 'explainPage',
  LIST_KEY_POINTS: 'listKeyPoints',
  CHECK_API_KEY: 'checkApiKey',
};

export const CONTEXT_MENU_IDS = {
  PARENT: 'nation-assistant',
  ANALYZE_PAGE: 'analyze-page',
  CHAT_WITH_SELECTION: 'chat-with-selection',
  TRANSLATE_AUTO: 'translate-auto',
  TRANSLATE_SPANISH: 'translate-spanish',
  TRANSLATE_FRENCH: 'translate-french',
  TRANSLATE_GERMAN: 'translate-german',
  TRANSLATE_CHINESE: 'translate-chinese',
  TRANSLATE_ITALIAN: 'translate-italian',
  TRANSLATE_PORTUGUESE: 'translate-portuguese',
  TRANSLATE_RUSSIAN: 'translate-russian',
  TRANSLATE_JAPANESE: 'translate-japanese',
  TRANSLATE_KOREAN: 'translate-korean',
  TRANSLATE_ARABIC: 'translate-arabic',
  TRANSLATE_MORE: 'translate-more',
};

export const COMMANDS = {
  OPEN_SIDEPANEL: 'open-sidepanel',
};

export const STORAGE_KEYS = {
  CONTEXT_ACTION: 'contextAction',
  API_KEY: 'crestalApiKey',
  API_BASE_URL: 'apiBaseUrl',
};

export const LANGUAGES = [
    { id: CONTEXT_MENU_IDS.TRANSLATE_SPANISH, title: '🇪🇸 Spanish', code: 'es', language: 'Spanish' },
    { id: CONTEXT_MENU_IDS.TRANSLATE_FRENCH, title: '🇫🇷 French', code: 'fr', language: 'French' },
    { id: CONTEXT_MENU_IDS.TRANSLATE_GERMAN, title: '🇩🇪 German', code: 'de', language: 'German' },
    { id: CONTEXT_MENU_IDS.TRANSLATE_CHINESE, title: '🇨🇳 Chinese', code: 'zh', language: 'Chinese' },
];

export const MORE_LANGUAGES = [
    { id: CONTEXT_MENU_IDS.TRANSLATE_ITALIAN, title: 'Italian', code: 'it', language: 'Italian' },
    { id: CONTEXT_MENU_IDS.TRANSLATE_PORTUGUESE, title: 'Portuguese', code: 'pt', language: 'Portuguese' },
    { id: CONTEXT_MENU_IDS.TRANSLATE_RUSSIAN, title: 'Russian', code: 'ru', language: 'Russian' },
    { id: CONTEXT_MENU_IDS.TRANSLATE_JAPANESE, title: 'Japanese', code: 'ja', language: 'Japanese' },
    { id: CONTEXT_MENU_IDS.TRANSLATE_KOREAN, title: 'Korean', code: 'ko', language: 'Korean' },
    { id: CONTEXT_MENU_IDS.TRANSLATE_ARABIC, title: 'Arabic', code: 'ar', language: 'Arabic' },
];

export const ELEMENT_IDS = {
    CHAR_COUNTER: 'char-counter',
    CHAT_MESSAGES: 'chat-messages',
    CHAT_INPUT: 'chat-input',
    SEND_BTN: 'send-btn',
    TAB_TITLE: 'tab-title',
    TAB_URL: 'tab-url',
    REFRESH_BTN: 'refresh-btn',
    HELP_BTN: 'help-btn',
    SETTINGS_BTN: 'settings-btn',
    INPUT_CONTAINER: 'input-container',
    TYPING_INDICATOR: 'typing-indicator',
    TRANSLATION_LOADING: 'translation-loading',
    HELP_DIALOG: 'help-dialog',
};
