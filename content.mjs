// Nation Assistant Content Script
'use strict';

import { MESSAGE_TYPES } from './services/constants.js';

if (!window.nationAssistantInjected) {
  window.nationAssistantInjected = true;
  const MAX_TEXT_LENGTH = 12000; // Limit output length

  function normalizeWhitespace(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/\r/g, '')
      .replace(/[\t ]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function getElementText(el) {
    try {
      return (el?.innerText || '').trim();
    } catch (_e) {
      return '';
    }
  }

  function extractBasicContent() {
    const candidates = [
      document.querySelector('article'),
      document.querySelector('main'),
      document.body
    ];
    for (const el of candidates) {
      const text = getElementText(el);
      if (text && text.length > 0) {
        const sourceTag = el?.tagName ? el.tagName.toLowerCase() : 'body';
        return { text, source: sourceTag };
      }
    }
    return { text: '', source: 'none' };
  }

  function getPageText() {
    const { text, source } = extractBasicContent();
    let cleaned = normalizeWhitespace(text);
    if (cleaned.length > MAX_TEXT_LENGTH) cleaned = cleaned.slice(0, MAX_TEXT_LENGTH) + '...';
    return { content: cleaned, usedSource: `basic:${source}` };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === MESSAGE_TYPES.PING) {
      sendResponse({ pong: true });
      return;
    }

    if (message.type === MESSAGE_TYPES.GET_PAGE_CONTENT) {
      try {
        const { content, usedSource } = getPageText();
        sendResponse({
          pageContent: content,
          metadata: {
            title: document.title,
            url: location.href,
            readableTitle: null,
            byline: null,
            siteName: null,
            length: content.length,
            usedSource,
            attempts: []
          },
          error: content ? null : 'No content found'
        });
      } catch (err) {
        sendResponse({
          pageContent: '',
          metadata: {
            title: document.title,
            url: location.href,
            readableTitle: null,
            byline: null,
            siteName: null,
            length: 0,
            usedSource: 'basic:error',
            attempts: []
          },
          error: err?.message || 'Content extraction failed'
        });
      }
      return false;
    }

    sendResponse({ error: 'Unknown message type' });
  });
}