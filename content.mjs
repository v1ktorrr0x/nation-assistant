// Nation Assistant Content Script
'use strict';

import { MESSAGE_TYPES } from './services/constants.js';

if (!window.nationAssistantInjected) {
  window.nationAssistantInjected = true;
  const MAX_TEXT_LENGTH = 6000;

  function extractText() {
    const text = document.body.innerText;
    const cleaned = text.replace(/\s+/g, ' ').trim();
    return cleaned.length > MAX_TEXT_LENGTH ? cleaned.substring(0, MAX_TEXT_LENGTH) + '...' : cleaned;
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === MESSAGE_TYPES.PING) {
      sendResponse({ pong: true });
      return;
    }

    if (message.type === MESSAGE_TYPES.GET_PAGE_CONTENT) {
      const pageContent = extractText();
      sendResponse({
        pageContent,
        metadata: {
          title: document.title,
          url: location.href
        }
      });
      return;
    }

    sendResponse({ error: 'Unknown message type' });
  });
}