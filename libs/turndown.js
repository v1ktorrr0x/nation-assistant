(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.TurndownService = factory());
})(this, (function () { 'use strict';

  function extend (destination) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (source.hasOwnProperty(key)) destination[key] = source[key];
      }
    }
    return destination
  }

  function repeat (character, count) {
    return Array(count + 1).join(character)
  }

  var blockElements = [
    'address', 'article', 'aside', 'audio', 'blockquote', 'body', 'canvas',
    'center', 'dd', 'dir', 'div', 'dl', 'dt', 'fieldset', 'figcaption',
    'figure', 'footer', 'form', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'header', 'hgroup', 'hr', 'html', 'isindex', 'li', 'main', 'menu', 'nav',
    'noframes', 'noscript', 'ol', 'p', 'pre', 'section', 'table', 'tbody',
    'tfoot', 'th', 'thead', 'tr', 'ul', 'video'
  ];

  function isBlock (node) {
    return blockElements.indexOf(node.nodeName.toLowerCase()) !== -1
  }

  var voidElements = [
    'area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img', 'input',
    'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'
  ];

  function isVoid (node) {
    return voidElements.indexOf(node.nodeName.toLowerCase()) !== -1
  }

  var NAME_CHAR = '[A-Za-z_]';
  var IDENT_CHAR = '[A-Za-z0-9_-]';

  var ESCAPE_CHAR_AFTER = '(?!' + IDENT_CHAR + ')';

  var ESCAPE_CHAR = '\\';
  var ASTERISK = '*';
  var UNDERSCORE = '_';
  var BACKTICK = '`';
  var DOLLAR = '$';

  // Safer literal regex definitions to avoid bracket/paren escaping issues
  var REGEX_ESCAPE_CHAR = /([\\`*_{}\[\]()#+\-.!>])/g;

  var REGEX_SPECIAL_CHAR = /([\\*_{}\[\]()#+\-.!>`])/g;

  var REGEX_SPECIAL_CHAR_WITH_DOLLAR = /([\\*_{}\[\]()#+\-.!>`$])/g;

  var leadingWhitespace = /^[ \r\n\t]/;
  var trailingWhitespace = /[ \r\n\t]$/;
  var leadingNewLine = /^\n/;
  var trailingNewLine = /\n$/;

  /**
   * Manages a collection of rules used to convert HTML to Markdown
   */

  function Rules (options) {
    this.options = options;
    this._keep = [];
    this._remove = [];

    this.blankRule = {
      replacement: function (content, node) {
        return node.isBlock ? '\n\n' : ''
      }
    };

    this.defaultRule = {
      replacement: function (content, node) {
        return node.isBlock ? '\n\n' + content + '\n\n' : content
      }
    };

    this.array = [];
    for (var key in options.rules) this.array.push(options.rules[key]);
  }

  Rules.prototype = {
    add: function (key, rule) {
      this.array.unshift(rule);
    },

    keep: function (filter) {
      this._keep.unshift({
        filter: filter,
        replacement: this.options.keepReplacement
      });
    },

    remove: function (filter) {
      this._remove.unshift({
        filter: filter,
        replacement: function () {
          return ''
        }
      });
    },

    forNode: function (node) {
      if (node.isBlank) return this.blankRule
      var rule;

      if ((rule = findRule(this.array, node, this))) return rule
      if ((rule = findRule(this._keep, node, this))) return rule
      if ((rule = findRule(this._remove, node, this))) return rule

      return this.defaultRule
    },

    forEach: function (fn) {
      for (var i = 0; i < this.array.length; i++) fn(this.array[i], i);
    }
  };

  function findRule (rules, node, thisArg) {
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (filterValue(rule, node, thisArg)) return rule
    }
    return void 0
  }

  function filterValue (rule, node, thisArg) {
    var filter = rule.filter;
    if (typeof filter === 'string') {
      return (filter === node.nodeName.toLowerCase())
    } else if (Array.isArray(filter)) {
      return (filter.indexOf(node.nodeName.toLowerCase()) > -1)
    } else if (typeof filter === 'function') {
      return filter.call(thisArg, node)
    } else {
      throw new TypeError('`filter` needs to be a string, array, or function')
    }
  }

  /**
   * The collapseWhitespace function is adapted from collapse-whitespace
   * by Luc Thevenard.
   *
   * The MIT License (MIT)
   *
   * Copyright (c) 2014 Luc Thevenard <lucthevenard@gmail.com>
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in
   * all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   * THE SOFTWARE.
   */

  /**
   * collapse-whitespace
   *
   * @param {Object}     options
   * @param {Boolean}    options.removeLeadingNewLine
   * @param {Boolean}    options.removeTrailingNewLine
   * @param {Boolean}    options.trimStart
   * @param {Boolean}    options.trimEnd
   * @param {Boolean}    options.preserveWithinCode
   */
  function collapseWhitespace (options) {
    var removeLeadingNewLine = options.removeLeadingNewLine;
    var removeTrailingNewLine = options.removeTrailingNewLine;
    var trimStart = options.trimStart;
    var trimEnd = options.trimEnd;
    var preserveWithinCode = options.preserveWithinCode;
    var regStart = /^\s+/;
    var regEnd = /\s+$/;

    return function (node) {
      if (node.isCode && preserveWithinCode) return

      var text = node.textContent;

      if (trimStart) text = text.replace(regStart, '');
      if (trimEnd) text = text.replace(regEnd, '');

      var prev = node.previousSibling;
      var next = node.nextSibling;

      if (!prev || !next) {
        if (removeLeadingNewLine && removeTrailingNewLine) return
        if (removeLeadingNewLine) text = text.replace(leadingNewLine, '');
        if (removeTrailingNewLine) text = text.replace(trailingNewLine, '');
        node.textContent = text;
        return
      }

      var prevIsBlock = isBlock(prev);
      var nextIsBlock = isBlock(next);
      var prevIsVoid = isVoid(prev);
      var nextIsVoid = isVoid(next);

      if (prevIsBlock && removeLeadingNewLine) {
        text = text.replace(leadingNewLine, '');
      }
      if (nextIsBlock && removeTrailingNewLine) {
        text = text.replace(trailingNewLine, '');
      }
      if (
        (prevIsBlock || prevIsVoid) &&
        (nextIsBlock || nextIsVoid)
      ) {
        text = text.replace(/\s+/g, ' ');
      } else if (
        (prevIsBlock || prevIsVoid)
      ) {
        text = text.replace(/^[ \t\r\n]+/g, '');
        text = text.replace(/\s+/g, ' ');
      } else if (
        (nextIsBlock || nextIsVoid)
      ) {
        text = text.replace(/[ \t\r\n]+$/g, '');
        text = text.replace(/\s+/g, ' ');
      } else {
        text = text.replace(/\s+/g, ' ');
      }

      node.textContent = text;
    }
  }

  var rules = {};

  rules.paragraph = {
    filter: 'p',

    replacement: function (content) {
      return '\n\n' + content + '\n\n'
    }
  };

  rules.lineBreak = {
    filter: 'br',

    replacement: function (content, node, options) {
      return options.br + '\n'
    }
  };

  rules.heading = {
    filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],

    replacement: function (content, node, options) {
      var hLevel = Number(node.nodeName.charAt(1));

      if (options.headingStyle === 'setext' && hLevel < 3) {
        var underline = repeat((hLevel === 1 ? '=' : '-'), content.length);
        return (
          '\n\n' + content + '\n' + underline + '\n\n'
        )
      } else {
        return '\n\n' + repeat('#', hLevel) + ' ' + content + '\n\n'
      }
    }
  };

  rules.blockquote = {
    filter: 'blockquote',

    replacement: function (content) {
      content = content.replace(/^\n+|\n+$/g, '');
      content = content.replace(/^/gm, '> ');
      return '\n\n' + content + '\n\n'
    }
  };

  rules.list = {
    filter: ['ul', 'ol'],

    replacement: function (content, node) {
      var parent = node.parentNode;
      if (parent.nodeName === 'LI' && parent.lastElementChild === node) {
        return '\n' + content
      } else {
        return '\n\n' + content + '\n\n'
      }
    }
  };

  rules.listItem = {
    filter: 'li',

    replacement: function (content, node, options) {
      content = content.replace(/^\n+/, '').replace(/\n+$/, '\n').replace(/\n/gm, '\n    ');
      var prefix = options.bulletListMarker + '   ';
      var parent = node.parentNode;
      if (parent.nodeName === 'OL') {
        var start = parent.getAttribute('start');
        var index = Array.prototype.indexOf.call(parent.children, node);
        prefix = (start ? Number(start) + index : index + 1) + '.  ';
      }
      return (
        prefix + content + (node.nextSibling && !/\n$/.test(content) ? '\n' : '')
      )
    }
  };

  rules.indentedCodeBlock = {
    filter: function (node, options) {
      return (
        options.codeBlockStyle === 'indented' &&
        node.nodeName === 'PRE' &&
        node.firstChild &&
        node.firstChild.nodeName === 'CODE'
      )
    },

    replacement: function (content, node, options) {
      return (
        '\n\n    ' +
        node.firstChild.textContent.replace(/\n/g, '\n    ') +
        '\n\n'
      )
    }
  };

  rules.fencedCodeBlock = {
    filter: function (node, options) {
      return (
        options.codeBlockStyle === 'fenced' &&
        node.nodeName === 'PRE' &&
        node.firstChild &&
        node.firstChild.nodeName === 'CODE'
      )
    },

    replacement: function (content, node, options) {
      var className = node.firstChild.getAttribute('class') || '';
      var language = (className.match(/language-(\S+)/) || [null, ''])[1];
      var code = node.firstChild.textContent;
      var fenceChar = options.fence.charAt(0);
      var fenceSize = 3;
      var fenceInCodeRegex = new RegExp('^' + fenceChar + '{3,}', 'gm');

      var match;
      while ((match = fenceInCodeRegex.exec(code))) {
        if (match[0].length >= fenceSize) {
          fenceSize = match[0].length + 1;
        }
      }

      var fence = repeat(fenceChar, fenceSize);

      return (
        '\n\n' + fence + language + '\n' +
        code.replace(/\n$/, '') +
        '\n' + fence + '\n\n'
      )
    }
  };

  rules.horizontalRule = {
    filter: 'hr',

    replacement: function (content, node, options) {
      return '\n\n' + options.hr + '\n\n'
    }
  };

  rules.inlineLink = {
    filter: function (node, options) {
      return (
        options.linkStyle === 'inlined' &&
        node.nodeName === 'A' &&
        node.getAttribute('href')
      )
    },

    replacement: function (content, node) {
      var href = node.getAttribute('href');
      var title = cleanAttribute(node.getAttribute('title'));
      if (title) title = ' "' + title + '"';
      return '[' + content + '](' + href + title + ')'
    }
  };

  rules.referenceLink = {
    filter: function (node, options) {
      return (
        options.linkStyle === 'referenced' &&
        node.nodeName === 'A' &&
        node.getAttribute('href')
      )
    },

    replacement: function (content, node, options) {
      var href = node.getAttribute('href');
      var title = cleanAttribute(node.getAttribute('title'));
      if (title) title = ' "' + title + '"';
      var replacement;
      var reference;

      switch (options.linkReferenceStyle) {
        case 'collapsed':
          replacement = '[' + content + '][]';
          reference = '[' + content + ']: ' + href + title;
          break
        case 'shortcut':
          replacement = '[' + content + ']';
          reference = '[' + content + ']: ' + href + title;
          break
        default:
          var id = this.references.length + 1;
          replacement = '[' + content + '][' + id + ']';
          reference = '[' + id + ']: ' + href + title;
      }

      this.references.push(reference);
      return replacement
    },

    references: [],

    append: function (options) {
      var references = '';
      if (this.references.length) {
        references = '\n\n' + this.references.join('\n') + '\n\n';
        this.references = []; // Reset references
      }
      return references
    }
  };

  rules.emphasis = {
    filter: ['em', 'i'],

    replacement: function (content, node, options) {
      if (!content.trim()) return ''
      return options.emDelimiter + content + options.emDelimiter
    }
  };

  rules.strong = {
    filter: ['strong', 'b'],

    replacement: function (content, node, options) {
      if (!content.trim()) return ''
      return options.strongDelimiter + content + options.strongDelimiter
    }
  };

  rules.code = {
    filter: function (node) {
      var hasSiblings = node.previousSibling || node.nextSibling;
      var isCodeBlock = node.parentNode.nodeName === 'PRE' && !hasSiblings;

      return node.nodeName === 'CODE' && !isCodeBlock
    },

    replacement: function (content) {
      if (!content.trim()) return ''

      var delimiter = BACKTICK;
      var leadingSpace = '';
      var trailingSpace = '';
      var matches = content.match(/`+/gm);
      if (matches) {
        if (leadingWhitespace.test(content)) leadingSpace = ' ';
        if (trailingWhitespace.test(content)) trailingSpace = ' ';
        while (matches.indexOf(delimiter) !== -1) delimiter += BACKTICK;
      }

      return delimiter + leadingSpace + content + trailingSpace + delimiter
    }
  };

  rules.image = {
    filter: 'img',

    replacement: function (content, node) {
      var alt = cleanAttribute(node.getAttribute('alt'));
      var src = node.getAttribute('src') || '';
      var title = cleanAttribute(node.getAttribute('title'));
      var titlePart = title ? ' "' + title + '"' : '';
      return src ? '![' + alt + ']' + '(' + src + titlePart + ')' : ''
    }
  };

  function cleanAttribute (attribute) {
    return attribute ? attribute.replace(/(\n+\s*)+/g, '\n') : ''
  }

  var reduce = Array.prototype.reduce;
  var leadingNewLines = /^\n*/;
  var trailingNewLines = /\n*$/;
  var escapes = [
    [/\\/g, '\\\\'],
    [/\*/g, '\\*'],
    [/^-/g, '\\-'],
    [/^\+ /g, '\\+ '],
    [/^(=+)/g, '\\$1'],
    [/^(#{1,6}) /g, '\\$1 '],
    [/`/g, '\\`'],
    [/^~~~/g, '\\~~~'],
    [/\[/g, '\\['],
    [/\]/g, '\\]'],
    [/^>/g, '\\>'],
    [/_/g, '\\_'],
    [/^(\d+)\. /g, '$1\\. ']
  ];

  function Node (node, options) {
    this.node = node;
    this.options = options;
  }

  Node.prototype = {
    /**
     * Creates a Node instance from a DOM node.
     * @param {DOMNode} node
     * @return {Node}
     */
    init: function (node) {
      if (!node) return

      this.node = node;
      this.nodeName = node.nodeName.toLowerCase();
      this.textContent = this.getTextContent();
      this.isBlock = isBlock(node);
      this.isCode = this.nodeName === 'code' || this.isPre;
      this.isBlank = this.getIsBlank();
      this.flankingWhitespace = this.getFlankingWhitespace();
      this.isPre = this.nodeName === 'pre' || (this.options.preformattedCode && this.isPreLike());
    },

    /**
     * Return true if the node is a pre-like element.
     * @return {Boolean}
     */
    isPreLike: function () {
      var isPreLike = false;
      if (this.node.nodeType === 3) return isPreLike

      var isPre = this.nodeName === 'pre';
      var hasPreParent = false;
      var hasPreSibling = false;
      var el = this.node;

      while (el) {
        if (el.previousSibling) {
          var ps = el.previousSibling;
          while (ps) {
            if (ps.nodeName === 'PRE') hasPreSibling = true;
            ps = ps.previousSibling;
          }
        }
        if (el.parentNode) {
          el = el.parentNode;
          if (el.nodeName === 'PRE') hasPreParent = true;
        } else {
          el = null;
        }
      }

      if (isPre || hasPreParent || hasPreSibling) {
        isPreLike = true;
      }

      return isPreLike
    },

    /**
     * Gets the text content of the node.
     * @return {string}
     */
    getTextContent: function () {
      if (this.isPre) {
        return this.node.textContent
      }
      return this.node.innerText || this.node.textContent
    },

    /**
     * Returns true if the node is blank, or a block-level element with no text.
     * @return {Boolean}
     */
    getIsBlank: function () {
      return (
        ['hr', 'br', 'script', 'style'].indexOf(this.nodeName) !== -1 ||
        (this.isBlock && !this.textContent && !this.hasVoidOrBlockChildren())
      )
    },

    /**
     * Returns true if the node has a void or block-level child.
     * @return {Boolean}
     */
    hasVoidOrBlockChildren: function () {
      var children = this.node.childNodes;
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (isVoid(child) || isBlock(child)) return true
      }
      return false
    },

    /**
     * Determines whether the node is surrounded by whitespace.
     * @return {Object}
     */
    getFlankingWhitespace: function () {
      var content = this.textContent;
      var leading = '';
      var trailing = '';

      if (!this.isBlock) {
        if (leadingWhitespace.test(content)) leading = ' ';
        if (trailingWhitespace.test(content)) trailing = ' ';
      }

      return { leading: leading, trailing: trailing }
    },

    /**
     * Escapes markdown syntax.
     * @param {String} string
     * @return {String}
     */
    escape: function (string) {
      var isCode = this.isCode;
      var isPre = this.isPre;
      var options = this.options;
      var lang = '';

      if (isPre) {
        var preNode = this.node;
        var codeNode = preNode.querySelector('code');
        if (codeNode) {
          lang = codeNode.getAttribute('class');
          if (lang) {
            lang = lang.replace('language-', '');
          }
        }
      }

      if (isCode) {
        return string.replace(/`/g, '\\`')
      }

      if (options.escapeMode === 'bksp-pre-code') {
        if (isPre) {
          return string
        } else if (isCode) {
          return string.replace(/\\/g, '\\\\').replace(/`/g, '\\`')
        }
      }

      if (options.escapeMode === 'pre-code') {
        if (isPre || isCode) {
          return string
        }
      }

      return reduce.call(escapes, function (string, escape) {
        return string.replace(escape[0], escape[1])
      }, string)
    },

    /**
     * Appends markdown to the current state.
     * @param {string} markdown
     */
    output: function (markdown) {
      var state = this.state;
      var options = this.options;
      var isBlock = this.isBlock;
      var isVoid = this.isVoid;
      var isPre = this.isPre;
      var isCode = this.isCode;
      var flankingWhitespace = this.flankingWhitespace;
      var leading = flankingWhitespace.leading;
      var trailing = flankingWhitespace.trailing;
      var text = this.textContent;

      if (state.output) {
        if (isBlock || isPre) {
          // Add a double newline before a block element
          var newlines = isPre ? '\n\n' : '\n\n';
          var previousIsBlock = state.previous && state.previous.isBlock;

          if (state.output.slice(-2) !== newlines) {
            if (!previousIsBlock) {
              state.output = state.output.replace(trailingNewLines, newlines);
            } else {
              state.output += newlines;
            }
          }
        }
      }

      // Add leading whitespace
      if (leading) {
        if (!leadingWhitespace.test(state.output)) {
          state.output += leading;
        }
      }

      // Add the markdown
      state.output += markdown;

      // Add trailing whitespace
      if (trailing) {
        if (!trailingWhitespace.test(state.output)) {
          state.output += trailing;
        }
      }

      // Save the current node as the previous
      state.previous = this;
    },

    /**
     * Processes the given node and its children.
     * @param {Node} node
     * @return {String}
     */
    process: function (node) {
      var self = this;
      var state = {
        output: '',
        previous: null
      };

      var processNode = function (node) {
        self.init(node);
        var replacement = self.options.rules.forNode(self).replacement;
        var content = self.processChildren(node);
        var markdown = replacement.call(self, content, self);
        self.output(markdown);
      };

      var processChildren = function (node) {
        var children = node.childNodes;
        for (var i = 0; i < children.length; i++) {
          processNode(children[i]);
        }
        return state.output
      };

      processNode(node);
      return state.output
    }
  };

  function RootNode (element, options) {
    this.element = element;
    this.options = options;
    this.state = {
      output: '',
      references: {},
      previous: null
    };
  }

  RootNode.prototype = {
    /**
     * Converts an element to markdown.
     * @return {String}
     */
    convert: function () {
      var markdown = this.processChildren(this.element);
      return this.postProcess(markdown)
    },

    /**
     * Post-processes the markdown.
     * @param {String} markdown
     * @return {String}
     */
    postProcess: function (markdown) {
      var self = this;
      this.options.rules.forEach(function (rule) {
        if (typeof rule.append === 'function') {
          markdown += rule.append.call(self, self.options);
        }
      });
      return markdown.replace(/^[\t\r\n]+/, '').replace(/[\t\r\n\s]+$/, '')
    },

    /**
     * Processes the children of the given node.
     * @param {Node} node
     * @return {String}
     */
    processChildren: function (node) {
      var self = this;
      var children = node.childNodes;
      for (var i = 0; i < children.length; i++) {
        var child = new Node(children[i], this.options);
        this.processNode(child);
      }
      return this.state.output
    },

    /**
     * Processes a node.
     * @param {Node} node
     */
    processNode: function (node) {
      var self = this;
      var replacement = this.options.rules.forNode(node).replacement;
      var content = this.processChildren(node.node);
      var markdown = replacement.call(this, content, node);
      this.output(markdown);
    },

    /**
     * Appends markdown to the current state.
     * @param {string} markdown
     */
    output: function (markdown) {
      var state = this.state;
      var options = this.options;
      var isBlock = this.isBlock;
      var isVoid = this.isVoid;
      var isPre = this.isPre;
      var isCode = this.isCode;
      var flankingWhitespace = this.flankingWhitespace;
      var leading = flankingWhitespace.leading;
      var trailing = flankingWhitespace.trailing;
      var text = this.textContent;

      if (state.output) {
        if (isBlock || isPre) {
          // Add a double newline before a block element
          var newlines = isPre ? '\n\n' : '\n\n';
          var previousIsBlock = state.previous && state.previous.isBlock;

          if (state.output.slice(-2) !== newlines) {
            if (!previousIsBlock) {
              state.output = state.output.replace(trailingNewLines, newlines);
            } else {
              state.output += newlines;
            }
          }
        }
      }

      // Add leading whitespace
      if (leading) {
        if (!leadingWhitespace.test(state.output)) {
          state.output += leading;
        }
      }

      // Add the markdown
      state.output += markdown;

      // Add trailing whitespace
      if (trailing) {
        if (!trailingWhitespace.test(state.output)) {
          state.output += trailing;
        }
      }

      // Save the current node as the previous
      state.previous = this;
    }
  };

  /**
   * Escapes special characters in a string.
   * @param {String} string
   * @return {String}
   */
  function escapeSpecialChars (string, options) {
    if (options.escapeMode === 'dollar') {
      return string.replace(REGEX_SPECIAL_CHAR_WITH_DOLLAR, function (match) {
        return ESCAPE_CHAR + match
      })
    }
    return string.replace(REGEX_SPECIAL_CHAR, function (match) {
      return ESCAPE_CHAR + match
    })
  }

  /**
   * Replaces escaped characters in a string.
   * @param {String} string
   * @return {String}
   */
  function unescapeSpecialChars (string) {
    return string.replace(REGEX_ESCAPE_CHAR, function (match, character) {
      return character
    })
  }

  var nodeConversion = {
    /**
     * Appends markdown to the current state.
     * @param {string} markdown
     */
    output: function (markdown) {
      var state = this.state;
      var options = this.options;
      var isBlock = this.isBlock;
      var isVoid = this.isVoid;
      var isPre = this.isPre;
      var isCode = this.isCode;
      var flankingWhitespace = this.flankingWhitespace;
      var leading = flankingWhitespace.leading;
      var trailing = flankingWhitespace.trailing;
      var text = this.textContent;

      if (state.output) {
        if (isBlock || isPre) {
          // Add a double newline before a block element
          var newlines = isPre ? '\n\n' : '\n\n';
          var previousIsBlock = state.previous && state.previous.isBlock;

          if (state.output.slice(-2) !== newlines) {
            if (!previousIsBlock) {
              state.output = state.output.replace(trailingNewLines, newlines);
            } else {
              state.output += newlines;
            }
          }
        }
      }

      // Add leading whitespace
      if (leading) {
        if (!leadingWhitespace.test(state.output)) {
          state.output += leading;
        }
      }

      // Add the markdown
      state.output += markdown;

      // Add trailing whitespace
      if (trailing) {
        if (!trailingWhitespace.test(state.output)) {
          state.output += trailing;
        }
      }

      // Save the current node as the previous
      state.previous = this;
    },

    /**
     * Processes the given node and its children.
     * @param {Node} node
     * @return {String}
     */
    process: function (node) {
      var self = this;
      var state = {
        output: '',
        previous: null
      };

      var processNode = function (node) {
        self.init(node);
        var replacement = self.options.rules.forNode(self).replacement;
        var content = self.processChildren(node);
        var markdown = replacement.call(self, content, self);
        self.output(markdown);
      };

      var processChildren = function (node) {
        var children = node.childNodes;
        for (var i = 0; i < children.length; i++) {
          processNode(children[i]);
        }
        return state.output
      };

      processNode(node);
      return state.output
    }
  };

  /**
   * turndown
   * @param {Object} options
   */
  function TurndownService (options) {
    if (!(this instanceof TurndownService)) return new TurndownService(options)

    var defaults = {
      rules: rules,
      headingStyle: 'setext',
      hr: '* * *',
      bulletListMarker: '*',
      codeBlockStyle: 'indented',
      fence: '```',
      emDelimiter: '_',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full',
      br: '  ',
      preformattedCode: false,
      keepReplacement: function (content, node) {
        return node.isBlock ? '\n\n' + node.outerHTML + '\n\n' : node.outerHTML
      },
      blankReplacement: function (content, node) {
        return node.isBlock ? '\n\n' : ''
      },
      defaultReplacement: function (content, node) {
        return node.isBlock ? '\n\n' + content + '\n\n' : content
      },
      escapeMode: 'default'
    };
    this.options = extend({}, defaults, options);
    this.rules = new Rules(this.options);
    this.escape = this.options.escapeMode === 'none'
      ? function (string) { return string }
      : escapeSpecialChars;
  }

  TurndownService.prototype = {
    /**
     * Converts an HTML string to markdown
     * @param {String} html
     * @return {String}
     */
    turndown: function (html) {
      if (typeof html !== 'string') {
        throw new TypeError(html + ' is not a string')
      }

      var rootNode = new RootNode(this.htmlToElement(html), this.options);
      var markdown = rootNode.convert();
      return markdown
    },

    /**
     * Adds a rule
     * @param {String} key
     * @param {Object} rule
     */
    addRule: function (key, rule) {
      this.rules.add(key, rule);
      return this
    },

    /**
     * Keep a node (as HTML) that matches the filter
     * @param {String|Array|Function} filter
     */
    keep: function (filter) {
      this.rules.keep(filter);
      return this
    },

    /**
     * Remove a node that matches the filter
     * @param {String|Array|Function} filter
     */
    remove: function (filter) {
      this.rules.remove(filter);
      return this
    },

    /**
     * Use a plugin
     * @param {Function} plugin
     */
    use: function (plugin) {
      if (Array.isArray(plugin)) {
        for (var i = 0; i < plugin.length; i++) this.use(plugin[i]);
      } else if (typeof plugin === 'function') {
        plugin(this);
      } else {
        throw new TypeError('plugin must be a Function or an Array of Functions')
      }
      return this
    },

    /**
     * Escapes Markdown characters
     * @param {String} string
     * @return {String}
     */
    escape: function (string) {
      return this.escape(string)
    },

    /**
     * Unescapes Markdown characters
     * @param {String} string
     * @return {String}
     */
    unescape: function (string) {
      return unescapeSpecialChars(string)
    },

    /**
     * Converts an HTML string to a DOM element
     * @param {String} html
     * @return {HTMLElement}
     */
    htmlToElement: function (html) {
      var element = document.createElement('div');
      element.innerHTML = html;
      return element
    },

    /**
     * Converts an HTML string to a DOM node
     * @param {String} html
     * @return {Node}
     */
    htmlToNode: function (html) {
      var node = this.htmlToElement(html);
      return this.nodeFor(node)
    },

    /**
     * Creates a Node instance from a DOM node
     * @param {DOMNode} node
     * @return {Node}
     */
    nodeFor: function (node) {
      return new Node(node, this.options)
    }
  };

  return TurndownService;

}));
