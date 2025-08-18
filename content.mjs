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
      
      // Check if Readability is available
      if (typeof Readability === 'undefined') {
        throw new Error('Readability library not loaded');
      }
      
      const article = new Readability(documentClone).parse();

      if (article && article.content && typeof article.content === 'string') {
        // Check if TurndownService is available
        if (typeof TurndownService === 'undefined') {
          throw new Error('TurndownService library not loaded');
        }
        
        // Initialize Turndown service
        const turndownService = new TurndownService({
          headingStyle: 'atx',
          hr: '---',
          bulletListMarker: '*',
          codeBlockStyle: 'fenced'
        });

        // Convert the article HTML to Markdown
        let markdown = turndownService.turndown(article.content);

        // Ensure markdown is a string
        if (typeof markdown !== 'string') {
          throw new Error('Turndown conversion failed');
        }

        // Truncate if necessary
        if (markdown.length > MAX_TEXT_LENGTH) {
          markdown = markdown.substring(0, MAX_TEXT_LENGTH) + '...';
        }
        return markdown;
      }
      
      // If no article content found, throw error to trigger fallback
      throw new Error('No readable content found by Readability');
      
    } catch (error) {
      console.error('Error extracting article:', error);
      
      // Fallback to basic text extraction
      try {
        const text = document.body?.innerText || document.body?.textContent || '';
        const cleaned = text.replace(/\s+/g, ' ').trim();
        
        if (!cleaned) {
          return 'No content could be extracted from this page.';
        }
        
        return cleaned.length > MAX_TEXT_LENGTH ? cleaned.substring(0, MAX_TEXT_LENGTH) + '...' : cleaned;
      } catch (fallbackError) {
        console.error('Fallback extraction also failed:', fallbackError);
        return 'Unable to extract content from this page.';
      }
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