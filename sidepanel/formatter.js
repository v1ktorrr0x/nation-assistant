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
    let listStack = []; // Track nested lists

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Handle code blocks
      if (trimmed.startsWith('```')) {
        // Close all open lists
        while (listStack.length > 0) {
          processedLines.push('</ul>');
          listStack.pop();
        }
        const codeBlockResult = this.handleCodeBlock(line, lines, i);
        processedLines.push(codeBlockResult.html);
        i += codeBlockResult.skipLines - 1;
        continue;
      }

      // Handle bullet points with nesting
      const bulletMatch = line.match(/^(\s*)[-*+•] (.+)$/);
      if (bulletMatch) {
        const indent = bulletMatch[1].length;
        const content = this.processInlineFormatting(bulletMatch[2]);

        // Determine nesting level (every 2 spaces = 1 level)
        const level = Math.floor(indent / 2);

        // Adjust list stack to match current level
        while (listStack.length > level + 1) {
          processedLines.push('</ul>');
          listStack.pop();
        }

        // Open new list if needed
        if (listStack.length === level) {
          processedLines.push('<ul>');
          listStack.push('ul');
        }

        processedLines.push(`<li>${content}</li>`);
        continue;
      }

      // Handle headers
      const headerMatch = trimmed.match(/^(#{1,6}) (.+)$/);
      if (headerMatch) {
        // Close all open lists
        while (listStack.length > 0) {
          processedLines.push('</ul>');
          listStack.pop();
        }
        const level = headerMatch[1].length;
        const content = this.processInlineFormatting(headerMatch[2]);
        processedLines.push(`<h${level}>${content}</h${level}>`);
        continue;
      }

      // Handle empty lines
      if (!trimmed) {
        // Close all open lists on empty line
        while (listStack.length > 0) {
          processedLines.push('</ul>');
          listStack.pop();
        }
        processedLines.push('');
        continue;
      }

      // Handle regular content
      // Close all open lists
      while (listStack.length > 0) {
        processedLines.push('</ul>');
        listStack.pop();
      }

      const formatted = this.processInlineFormatting(trimmed);
      processedLines.push(`<p>${formatted}</p>`);
    }

    // Close any remaining lists
    while (listStack.length > 0) {
      processedLines.push('</ul>');
      listStack.pop();
    }

    return processedLines.join('\n');
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

    return text
      // Process code first to avoid conflicts
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')

      // Links (only explicit markdown links and URLs)
      .replace(this.patterns.markdownLink, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(this.patterns.autoLink, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')

      // Basic text formatting - improved patterns to avoid breaking within words
      .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
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
