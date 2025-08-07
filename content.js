// Nation Assistant Content Script
'use strict';

if (!window.nationAssistantInjected) {
  window.nationAssistantInjected = true;

  function extractText() {
    const text = document.body.innerText;
    const cleaned = text.replace(/\s+/g, ' ').trim();
    return cleaned.length > 6000 ? cleaned.substring(0, 6000) + '...' : cleaned;
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'PING') {
      sendResponse({ pong: true });
      return;
    }

    if (message.type === 'GET_PAGE_CONTENT') {
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