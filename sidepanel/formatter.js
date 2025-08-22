/**
 * minimal ai response formatter - preserves original llm structure
 * only applies essential markdown formatting while maintaining original content flow
 */
class AIResponseFormatter {
  constructor() {
    // minimal patterns - only essential markdown elements
    this.patterns = {
      // headers - only if explicitly marked with #
      h1: /^# (.+)$/gm,
      h2: /^## (.+)$/gm,
      h3: /^### (.+)$/gm,
      h4: /^#### (.+)$/gm,
      h5: /^##### (.+)$/gm,
      h6: /^###### (.+)$/gm,

      // lists - only if explicitly marked
      bulletList: /^(\s*)[-*+•] (.+)$/gm,
      numberedList: /^(\s*)\d+\. (.+)$/gm,

      // basic text formatting
      bold: /\*\*(.*?)\*\*/g,
      italic: /\*([^*\n]+)\*/g,
      code: /`([^`\n]+)`/g,

      // code blocks
      codeBlock: /```(\w+)?\n?([\s\S]*?)```/g,

      // links
      markdownLink: /\[([^\]]+)\]\(([^)]+)\)/g,
      autoLink: /(https?:\/\/[^\s<>"'`]+)/g,

      // blockquotes
      blockquote: /^> (.+)$/gm,

      // horizontal rules
      horizontalRule: /^---+$/gm
    };

    // minimal state tracking
    this.parsingState = {
      inCodeBlock: false,
      listStack: [],
      currentIndent: 0
    };
  }

  /**
   * Format content with minimal processing to preserve original structure
   */
  format(content) {
    if (!content || typeof content !== 'string') {
      return '<div class="ai-error">Invalid response content</div>';
    }

    try {
      // reset parsing state
      this.resetParsingState();

      // minimal normalization - preserve original line breaks and spacing
      const normalized = this.minimalNormalize(content);

      // process with minimal changes to preserve llm structure
      const processed = this.processWithMinimalChanges(normalized);

      return processed;
    } catch (error) {
      console.error('AI Response formatting error:', error);
      return `<div class="ai-error">Formatting error: ${error.message}</div>`;
    }
  }

  resetParsingState() {
    this.parsingState = {
      inCodeBlock: false,
      listStack: [],
      currentIndent: 0
    };
  }

  /**
   * Minimal normalization - preserve original structure as much as possible
   */
  minimalNormalize(content) {
    return content
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // don't convert tabs or trim - preserve original spacing
      ;
  }

  /**
   * Process content with minimal changes to preserve LLM's original structure
   * Only apply essential formatting while keeping the natural flow
   */
  processWithMinimalChanges(content) {
    const lines = content.split('\n');
    const processedLines = [];
    // Track nested lists as a stack of { type: 'ul'|'ol' }
    let listStack = [];
    // Track last pushed list item index for continuation lines
    let lastListItemIndex = -1;
    // Track blockquote state
    let inBlockquote = false;
    // Maintain a separate list stack for lists inside blockquotes
    let bqListStack = [];
    let lastBqListItemIndex = -1;

    const closeAllLists = () => {
      while (listStack.length > 0) {
        const closing = listStack.pop();
        processedLines.push(`</${closing.type}>`);
      }
      lastListItemIndex = -1;
    };

    const ensureListAtLevel = (level, desiredType) => {
      // Shrink stack to desired level (stack length should be level+1)
      while (listStack.length > level + 1) {
        const closing = listStack.pop();
        processedLines.push(`</${closing.type}>`);
      }

      // If same depth but type changed, switch the list type
      if (listStack.length === level + 1) {
        const top = listStack[listStack.length - 1];
        if (top.type !== desiredType) {
          // Close current list and open new one of desired type
          listStack.pop();
          processedLines.push(`</${top.type}>`);
          processedLines.push(`<${desiredType}>`);
          listStack.push({ type: desiredType });
        }
        return;
      }

      // If we need to go deeper, open lists until we reach level
      while (listStack.length < level + 1) {
        processedLines.push(`<${desiredType}>`);
        listStack.push({ type: desiredType });
      }
    };

    // Helpers for lists inside blockquotes
    const closeBQLists = () => {
      while (bqListStack.length > 0) {
        const closing = bqListStack.pop();
        processedLines.push(`</${closing.type}>`);
      }
      lastBqListItemIndex = -1;
    };

    const ensureBQListAtLevel = (level, desiredType) => {
      while (bqListStack.length > level + 1) {
        const closing = bqListStack.pop();
        processedLines.push(`</${closing.type}>`);
      }

      if (bqListStack.length === level + 1) {
        const top = bqListStack[bqListStack.length - 1];
        if (top.type !== desiredType) {
          bqListStack.pop();
          processedLines.push(`</${top.type}>`);
          processedLines.push(`<${desiredType}>`);
          bqListStack.push({ type: desiredType });
        }
        return;
      }

      while (bqListStack.length < level + 1) {
        processedLines.push(`<${desiredType}>`);
        bqListStack.push({ type: desiredType });
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Handle code blocks
      if (trimmed.startsWith('```')) {
        // Close blockquote and lists before code block
        if (inBlockquote) {
          processedLines.push('</blockquote>');
          inBlockquote = false;
        }
        closeAllLists();
        const codeBlockResult = this.handleCodeBlock(line, lines, i);
        processedLines.push(codeBlockResult.html);
        i += codeBlockResult.skipLines - 1;
        continue;
      }

      // Handle horizontal rule
      if (/^---+$/.test(trimmed)) {
        if (inBlockquote) {
          processedLines.push('</blockquote>');
          inBlockquote = false;
        }
        closeAllLists();
        processedLines.push('<hr>');
        continue;
      }

      // Handle headers
      const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        if (inBlockquote) {
          processedLines.push('</blockquote>');
          inBlockquote = false;
        }
        closeAllLists();
        const level = headerMatch[1].length;
        const hContent = this.processInlineFormatting(headerMatch[2]);
        processedLines.push(`<h${level}>${hContent}</h${level}>`);
        continue;
      }

      // Handle Setext-style headers (top-level only):
      // Line of text followed by a line of === => h1, --- => h2
      if (trimmed && i + 1 < lines.length && !inBlockquote) {
        const next = lines[i + 1].trim();
        if (/^=+$/.test(next)) {
          closeAllLists();
          const hContent = this.processInlineFormatting(trimmed);
          processedLines.push(`<h1>${hContent}</h1>`);
          i++; // skip underline line
          continue;
        }
        if (/^-+$/.test(next)) {
          // Disambiguate from horizontal rule: treat as h2 only when current line has content
          closeAllLists();
          const hContent = this.processInlineFormatting(trimmed);
          processedLines.push(`<h2>${hContent}</h2>`);
          i++; // skip underline line
          continue;
        }
      }

      // Handle lists (bulleted, numbered, alphabetic, roman)
      const checkboxMatch = line.match(/^(\s*)[-*+•–—]\s+\[( |x|X)\]\s+(.+)$/);
      const bulletMatch = line.match(/^(\s*)[-*+•–—]\s+(.+)$/);
      const numberMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
      const alphaMatch = line.match(/^(\s*)[a-zA-Z][\.)]\s+(.+)$/);
      const romanMatch = line.match(/^(\s*)(?:\(?)([ivxlcdm]+)[\.)]\s+(.+)$/i);
      if (checkboxMatch || bulletMatch || numberMatch || alphaMatch || romanMatch) {
        // Normalize indent: tabs count as 2 spaces
        const indentStr = (checkboxMatch ? checkboxMatch[1] : bulletMatch ? bulletMatch[1] : numberMatch ? numberMatch[1] : alphaMatch ? alphaMatch[1] : romanMatch[1]).replace(/\t/g, '  ');
        const indent = indentStr.length;
        const level = Math.floor(indent / 2);
        const desiredType = (bulletMatch || checkboxMatch) ? 'ul' : 'ol';
        let rawContent = checkboxMatch ? checkboxMatch[3] : bulletMatch ? bulletMatch[2] : numberMatch ? numberMatch[2] : alphaMatch ? alphaMatch[2] : romanMatch[3];
        let itemContent = this.processInlineFormatting(rawContent);

        // Render task list checkbox visually (disabled)
        if (checkboxMatch) {
          const checked = /(x|X)/.test(checkboxMatch[2]);
          itemContent = `<input type="checkbox" disabled ${checked ? 'checked' : ''}> ${itemContent}`;
        }

        // If entering a list, close blockquote
        if (inBlockquote) {
          processedLines.push('</blockquote>');
          inBlockquote = false;
        }

        // NEW: If we are already inside a list and this is an indented bullet/number,
        // treat it as a continuation of the previous list item rather than a nested list.
        // This preserves "text under key points" without malformed nested structures.
        if (listStack.length > 0 && indent > 0 && lastListItemIndex >= 0) {
          processedLines[lastListItemIndex] = processedLines[lastListItemIndex]
            .replace(/<\/li>$/, `<br>• ${itemContent}</li>`);
          continue;
        }

        // Ensure correct list stack
        ensureListAtLevel(level, desiredType);

        // Add list item
        processedLines.push(`<li>${itemContent}</li>`);
        lastListItemIndex = processedLines.length - 1;
        continue;
      }

      // Handle blockquotes (lines starting with "> ")
      const blockquoteMatch = line.match(/^>\s?(.*)$/);
      if (blockquoteMatch) {
        // Close any top-level lists before entering blockquote context
        closeAllLists();
        if (!inBlockquote) {
          processedLines.push('<blockquote>');
          inBlockquote = true;
        }

        const inner = blockquoteMatch[1] || '';
        const innerTrimmed = inner.trim();

        // Code fences inside blockquotes are not fully supported; treat as paragraph
        // Support headers within blockquote
        const bqHeader = innerTrimmed.match(/^(#{1,6})\s+(.+)$/);
        if (bqHeader) {
          closeBQLists();
          const hLevel = bqHeader[1].length;
          const hContent = this.processInlineFormatting(bqHeader[2]);
          processedLines.push(`<h${hLevel}>${hContent}</h${hLevel}>`);
          continue;
        }

        // Horizontal rule in blockquote
        if (/^---+$/.test(innerTrimmed)) {
          closeBQLists();
          processedLines.push('<hr>');
          continue;
        }

        // Lists within blockquote
        const bqBullet = inner.match(/^(\s*)[-*+•–—]\s+(.+)$/);
        const bqNumber = inner.match(/^(\s*)\d+\.\s+(.+)$/);
        if (bqBullet || bqNumber) {
          const indentStr = (bqBullet ? bqBullet[1] : bqNumber[1]).replace(/\t/g, '  ');
          const indent = indentStr.length;
          const level = Math.floor(indent / 2);
          const desiredType = bqBullet ? 'ul' : 'ol';
          ensureBQListAtLevel(level, desiredType);
          const itemContent = this.processInlineFormatting(bqBullet ? bqBullet[2] : bqNumber[2]);
          processedLines.push(`<li>${itemContent}</li>`);
          lastBqListItemIndex = processedLines.length - 1;
          continue;
        }

        // Continuation lines for list items within blockquote
        const bqIndentOnly = inner.match(/^(\s+)(.+)$/);
        if (bqListStack.length > 0 && bqIndentOnly && lastBqListItemIndex >= 0) {
          const contText = this.processInlineFormatting(bqIndentOnly[2].trim());
          processedLines[lastBqListItemIndex] = processedLines[lastBqListItemIndex].replace(/<\/li>$/, `<br>${contText}</li>`);
          continue;
        }

        // Regular paragraph within blockquote
        closeBQLists();
        const bqContent = this.processInlineFormatting(innerTrimmed);
        processedLines.push(`<p>${bqContent}</p>`);
        continue;
      }

      // Handle empty lines: if inside a list, keep paragraph spacing within the same item
      if (!trimmed) {
        if (listStack.length > 0 && lastListItemIndex >= 0) {
          processedLines[lastListItemIndex] = processedLines[lastListItemIndex]
            .replace(/<\/li>$/, `<br><br></li>`);
        } else {
          processedLines.push('');
        }
        continue;
      }

      // Handle regular content
      // If inside blockquote and current line isn't a blockquote, close it
      if (inBlockquote) {
        // Close any open blockquote lists before ending blockquote
        closeBQLists();
        processedLines.push('</blockquote>');
        inBlockquote = false;
      }

      // Continuation lines for list items: indented non-list lines while a list is open
      const indentOnlyMatch = line.match(/^(\s+)(.+)$/);
      if (listStack.length > 0 && indentOnlyMatch && lastListItemIndex >= 0) {
        const contText = this.processInlineFormatting(indentOnlyMatch[2].trim());
        // Append to the last <li> before its closing tag
        processedLines[lastListItemIndex] = processedLines[lastListItemIndex].replace(/<\/li>$/, `<br>${contText}</li>`);
        continue;
      }

      // Otherwise, close lists and add paragraph
      closeAllLists();
      const formatted = this.processInlineFormatting(trimmed);
      processedLines.push(`<p>${formatted}</p>`);
    }

    // Close open blockquote and lists at the end
    if (inBlockquote) {
      closeBQLists();
      processedLines.push('</blockquote>');
      inBlockquote = false;
    }

    closeAllLists();

    // Collapse consecutive empty lines for cleaner spacing
    const collapsed = [];
    for (let i = 0; i < processedLines.length; i++) {
      const line = processedLines[i];
      if (line === '' && collapsed.length > 0 && collapsed[collapsed.length - 1] === '') {
        continue;
      }
      collapsed.push(line);
    }

    return collapsed.join('\n');
  }



  /**
   * Check if a line is an explicit markdown element (starts with markdown syntax)
   */
  isExplicitMarkdownElement(line) {
    return (
      line.match(/^#{1,6} /) ||           // Headers
      line.match(/^(\s*)[-*+•] /) ||      // Bullet lists
      line.match(/^(\s*)\d+\. /) ||       // Numbered lists
      line.match(/^> /) ||                // Blockquotes
      line.match(/^---+$/)                // Horizontal rules
    );
  }

  /**
   * Process explicit markdown elements
   */
  processMarkdownElement(line) {
    const trimmed = line.trim();

    // Headers
    const headerMatch = trimmed.match(/^(#{1,6}) (.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const content = this.processInlineFormatting(headerMatch[2]);
      return `<h${level}>${content}</h${level}>`;
    }

    // Horizontal rules
    if (this.patterns.horizontalRule.test(trimmed)) {
      return '<hr>';
    }

    // Blockquotes
    const blockquoteMatch = line.match(/^> (.+)$/);
    if (blockquoteMatch) {
      const content = this.processInlineFormatting(blockquoteMatch[1]);
      return `<blockquote>${content}</blockquote>`;
    }

    // Lists
    const bulletMatch = line.match(/^(\s*)[-*+•] (.+)$/);
    const numberMatch = line.match(/^(\s*)\d+\. (.+)$/);

    if (bulletMatch || numberMatch) {
      return this.processListItem(line, bulletMatch, numberMatch);
    }

    // Fallback to paragraph
    return this.processParagraph(line);
  }

  /**
   * Process a paragraph with minimal formatting - preserve original line breaks
   */
  processParagraph(content) {
    if (!content.trim()) return '';

    // Apply only inline formatting, preserve line structure
    const formatted = this.processInlineFormatting(content);

    // Convert single line breaks to <br> to preserve original formatting
    const withBreaks = formatted.replace(/\n/g, '<br>');

    return `<p>${withBreaks}</p>`;
  }

  /**
   * Handle code blocks - preserve exactly as LLM sent them
   */
  handleCodeBlock(line, allLines, currentIndex) {
    const trimmed = line.trim();
    const match = trimmed.match(/^```(\w+)?/);

    if (!this.parsingState.inCodeBlock) {
      // Starting a code block
      this.parsingState.inCodeBlock = true;
      const language = match[1] || 'text';

      // Find the closing ```
      let endIndex = currentIndex + 1;
      let codeContent = [];

      while (endIndex < allLines.length) {
        const nextLine = allLines[endIndex];
        if (nextLine.trim() === '```') {
          break;
        }
        // Preserve original spacing and content exactly
        codeContent.push(this.escapeHtml(nextLine));
        endIndex++;
      }

      this.parsingState.inCodeBlock = false;

      const codeHtml = `<pre><code class="language-${language}">${codeContent.join('\n')}</code></pre>`;
      return { html: codeHtml, skipLines: endIndex - currentIndex + 1 };
    } else {
      // Closing a code block
      this.parsingState.inCodeBlock = false;
      return { html: '', skipLines: 1 };
    }
  }

  /**
   * Process list items with proper list grouping
   */
  processListItem(line, bulletMatch, numberMatch) {
    const isNumbered = !!numberMatch;
    const match = bulletMatch || numberMatch;
    const indent = match[1].length;
    const content = match[2];

    const listType = isNumbered ? 'ol' : 'ul';
    let html = '';

    // Handle list opening/closing logic
    if (this.parsingState.listStack.length === 0) {
      // Starting first list
      html += `<${listType}>`;
      this.parsingState.listStack.push(listType);
      this.parsingState.currentIndent = indent;
    } else {
      const currentListType = this.parsingState.listStack[this.parsingState.listStack.length - 1];

      if (indent > this.parsingState.currentIndent) {
        // Starting nested list
        html += `<${listType}>`;
        this.parsingState.listStack.push(listType);
        this.parsingState.currentIndent = indent;
      } else if (indent < this.parsingState.currentIndent) {
        // Closing nested lists
        while (this.parsingState.listStack.length > 0 && indent < this.parsingState.currentIndent) {
          const closingType = this.parsingState.listStack.pop();
          html += `</${closingType}>`;
          this.parsingState.currentIndent = Math.max(0, this.parsingState.currentIndent - 2);
        }

        // Start new list if needed or if list type changed
        if (this.parsingState.listStack.length === 0 ||
          this.parsingState.listStack[this.parsingState.listStack.length - 1] !== listType) {
          if (this.parsingState.listStack.length > 0) {
            const closingType = this.parsingState.listStack.pop();
            html += `</${closingType}>`;
          }
          html += `<${listType}>`;
          this.parsingState.listStack.push(listType);
          this.parsingState.currentIndent = indent;
        }
      } else if (currentListType !== listType) {
        // Same indent but different list type - close current and start new
        const closingType = this.parsingState.listStack.pop();
        html += `</${closingType}>`;
        html += `<${listType}>`;
        this.parsingState.listStack.push(listType);
      }
      // If same indent and same type, just add the item (no opening/closing needed)
    }

    // Add list item with inline formatting
    const processedContent = this.processInlineFormatting(content);
    html += `<li>${processedContent}</li>`;

    return html;
  }

  /**
   * Minimal inline formatting - only process explicit markdown with better word boundary handling
   */
  processInlineFormatting(text) {
    if (!text) return '';

    // Start by escaping all HTML to avoid injection, then apply safe transforms
    let result = this.escapeHtml(text)
      // Process inline code first to avoid conflicts
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      // Convert explicit markdown links next
      .replace(this.patterns.markdownLink, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Auto-link bare URLs only outside existing <a> and <code> tags
    result = this.autoLinkOutsideTags(result);

    // Basic text formatting - avoid breaking within words
    result = result
      .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
      // Underscore variants
      .replace(/__([^_\n]+?)__/g, '<strong>$1</strong>')
      .replace(/_([^_\n]+?)_/g, '<em>$1</em>');

    return result;
  }

  /**
   * Auto-link URLs but skip inside existing <a> and <code> tags to avoid corrupting attributes/text
   */
  autoLinkOutsideTags(text) {
    if (!text) return '';

    // Split content into segments keeping existing anchors and code spans intact
    const segments = text.split(/(<a\b[^>]*>[\s\S]*?<\/a>|<code\b[^>]*>[\s\S]*?<\/code>)/gi);

    return segments
      .map(part => {
        if (!part) return '';
        // If the segment is an existing anchor or code block, return as-is
        if (/^<a\b/i.test(part) || /^<code\b/i.test(part)) return part;
        // Otherwise, auto-link bare URLs in this plain-text segment
        return part.replace(this.patterns.autoLink, (m, url) => {
          // Trim trailing punctuation that is not part of the URL
          const trailing = url.match(/[).,!?:;]+$/);
          const cleanUrl = trailing ? url.slice(0, -trailing[0].length) : url;
          const tail = trailing ? trailing[0] : '';
          return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>${tail}`;
        });
      })
      .join('');
  }

  /**
   * Close any open elements - simplified
   */
  getClosingTags() {
    // Not used in simplified approach
    return '';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Create global formatter instance
const aiFormatter = new AIResponseFormatter();

/**
 * Main formatting function - preserves original LLM structure
 */
export function formatAIResponse(content) {
  return aiFormatter.format(content);
}
