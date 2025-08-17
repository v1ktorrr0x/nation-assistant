// Nation Assistant Content Script
'use strict';

import { MESSAGE_TYPES } from './services/constants.js';

if (!window.nationAssistantInjected) {
  window.nationAssistantInjected = true;
  const MAX_TEXT_LENGTH = 12000; // Increased limit for Markdown

  function getArticleMarkdown() {
    try {
      // Use a clone of the document to avoid affecting the live page
      const documentClone = document.cloneNode(true);
      const article = new Readability(documentClone).parse();

      if (article && article.content) {
        // Initialize Turndown service
        const turndownService = new TurndownService({
          headingStyle: 'atx',
          hr: '---',
          bulletListMarker: '*',
          codeBlockStyle: 'fenced'
        });

        // Convert the article HTML to Markdown
        let markdown = turndownService.turndown(article.content);

        // Truncate if necessary
        if (markdown.length > MAX_TEXT_LENGTH) {
          markdown = markdown.substring(0, MAX_TEXT_LENGTH) + '...';
        }
        return markdown;
      }
      return null;
    } catch (error) {
      console.error('Error extracting article:', error);
      // Fallback to basic text extraction if Readability fails
      const text = document.body.innerText;
      const cleaned = text.replace(/\s+/g, ' ').trim();
      return cleaned.length > MAX_TEXT_LENGTH ? cleaned.substring(0, MAX_TEXT_LENGTH) + '...' : cleaned;
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === MESSAGE_TYPES.PING) {
      sendResponse({ pong: true });
      return;
    }

    if (message.type === MESSAGE_TYPES.GET_PAGE_CONTENT) {
      const pageContent = getArticleMarkdown();
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