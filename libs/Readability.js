/*
 * Copyright (c) 2010-2017 Arc90 Inc
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/*
 * This code is heavily based on Arc90's readability.js (1.7.1)
 * available at: http://code.google.com/p/arc90labs-readability
 */
/**
 * A standalone version of the readability library used for Firefox Reader View.
 *
 * See https://github.com/mozilla/readability
 */

var Readability = function(doc, options) {
  options = options || {};

  this._doc = doc;
  this._articleTitle = null;
  this._articleByline = null;
  this._articleDir = null;
  this._articleSiteName = null;
  this._attempts = [];

  // Default constants must be defined before they are used below
  this.DEFAULT_MAX_ELEMS_TO_PARSE = 5000;
  this.DEFAULT_N_TOP_CANDIDATES = 5;
  this.DEFAULT_CHAR_THRESHOLD = 500;
  this.CLASSES_TO_PRESERVE = ["page"];

  // Readability options
  this._debug = !!options.debug;
  this._maxElemsToParse = options.maxElemsToParse || this.DEFAULT_MAX_ELEMS_TO_PARSE;
  this._nbTopCandidates = options.nbTopCandidates || this.DEFAULT_N_TOP_CANDIDATES;
  this._charThreshold = options.charThreshold || this.DEFAULT_CHAR_THRESHOLD;
  this._classesToPreserve = this.CLASSES_TO_PRESERVE.concat(options.classesToPreserve || []);

  // The relative importance of tuneable factors
  this._balanceFactors = {
    // The parameters that all of these functions share are:
    // `gravity`, `negative`, `positive`, `seperator`
    //
    // `gravity` is the factor by which the score is divided. Higher values
    //          give smaller scores and lower values give larger scores
    //
    // `negative` is a list of patterns that will reduce the score of a node
    //
    // `positive` is a list of patterns that will increase the score of a node
    //
    // `seperator` is a string to separate the regular expression pattern
    title: {
      gravity: 4,
      negative: [],
      positive: []
    },
    single_image: {
      gravity: 2,
      negative: [],
      positive: []
    },
    element: {
      gravity: 1,
      negative: [],
      positive: []
    },
    sentence: {
      gravity: 1,
      negative: [],
      positive: []
    },
    paragraph: {
      gravity: 1,
      negative: [],
      positive: []
    },
    link: {
      gravity: 1.25,
      negative: [],
      positive: []
    },
    list: {
      gravity: 1,
      negative: [],
      positive: []
    },
    list_item: {
      gravity: 1,
      negative: [],
      positive: []
    },
    table: {
      gravity: 1,
      negative: [],
      positive: []
    },
    table_row: {
      gravity: 1,
      negative: [],
      positive: []
    },
    table_cell: {
      gravity: 1,
      negative: [],
      positive: []
    },
    table_caption: {
      gravity: 1,
      negative: [],
      positive: []
    }
  };

  this._log = function () {
    if (this._debug) {
      console.log.apply(console, arguments);
    }
  };

  // Start with a ridiculously large number just to be safe.
  this.FLAG_STRIP_UNLIKELYS = 0x1;
  this.FLAG_WEIGHT_CLASSES = 0x2;
  this.FLAG_CLEAN_CONDITIONALLY = 0x4;

  // The flags that are enabled by default.
  this.DEFAULT_FLAGS = this.FLAG_STRIP_UNLIKELYS | this.FLAG_WEIGHT_CLASSES | this.FLAG_CLEAN_CONDITIONALLY;

  // All of the regular expressions in use within readability.
  // Defined up here so we don't instantiate them repeatedly in loops.
  this.REGEXPS = {
    // NOTE: These two regular expressions are duplicated in
    // Readability-readerable.js. Please keep them in sync.
    unlikelyCandidates: /-ad-|ai2html|banner|breadcrumbs|combx|comment|community|cover-wrap|disqus|extra|foot|header|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|tweet|twitter/i,
    okMaybeItsACandidate: /and|article|body|column|main|shadow/i,

    // Used to check if a node is a candidate for paragraph classification.
    positive: /article|body|content|entry|hentry|main|page|pagination|post|text|blog|story/i,
    negative: /hidden|^hid$|hid$|hid\s|hid\s\w/i,
    extraneous: /print|archive|comment|disqus|extra|foot|header|menu|remark|rss|shoutbox|sidebar|sponsor|ad-break|agegate|pagination|pager|popup|tweet|twitter|img/i,
    byline: /byline|author|dateline|writtenby|p-author/i,
    replaceFonts: /<(\/?)font[^>]*>/gi,
    normalize: /\s{2,}/g,
    videos: /\/\/(www\.)?(dailymotion|youtube|youtube-nocookie|player\.vimeo)\.com/i,
    nextLink: /(next|weiter|continue|>([^\|]|$)|»([^\|]|$))/i,
    prevLink: /(prev|earl|old|new|<|«)/i,
    whitespace: /^\s*$/,
    hasContent: /\S$/,
  };

  this.UNLIKELY_ROLES = ["menu", "menubar", "complementary", "navigation", "alert", "alertdialog", "dialog"];
};

Readability.prototype = {
  /**
   * Run any post-process modifications to article content as necessary.
   *
   * @param Element
   * @return void
   */
  _postProcessContent: function(articleContent) {
    // Readability cannot open relative uris so we convert them to absolute uris.
    this._fixRelativeUris(articleContent);
  },

  /**
   * Iterates over a node and removes unlikely candidates.
   *
   * @param Element
   * @return void
   */
  _removeUnlikelyCandidates: function (elem) {
    for (var i = elem.childNodes.length - 1; i >= 0; i--) {
      var child = elem.childNodes[i];
      var childName = child.nodeName.toLowerCase();

      if (child.nodeType == 3 /* text node */) {
        continue;
      }

      if (child.nodeType != 1 /* element node */) {
        this._removeNode(child);
        continue;
      }

      var role = child.getAttribute("role");
      if (role && this.UNLIKELY_ROLES.indexOf(role) !== -1) {
        this._removeNode(child);
        continue;
      }

      // Remove unlikely candidates
      var unlikelyMatchString = child.className + child.id;
      if (this.REGEXPS.unlikelyCandidates.test(unlikelyMatchString) &&
          !this.REGEXPS.okMaybeItsACandidate.test(unlikelyMatchString) &&
          child.tagName !== "BODY" &&
          child.tagName !== "A") {
        this._log("Removing unlikely candidate - " + unlikelyMatchString);
        this._removeNode(child);
      } else {
        // Recurse
        this._removeUnlikelyCandidates(child);
      }
    }
  },

  /**
   * Iterate over a node and strip leading/trailing whitespace.
   *
   * @param Element
   * @return void
   */
  _cleanHeaders: function(elem) {
    for (var i = 1; i < 7; i++) {
      var headers = elem.getElementsByTagName("h" + i);
      for (var j = headers.length - 1; j >= 0; j--) {
        if (this._getCharCount(headers[j], " ") < 3) {
          this._removeNode(headers[j]);
        }
      }
    }
  },

  /**
   * Check if this node has only whitespace and a single P element
   *
   * @param Element
   * @return boolean
   */
  _isSingleP: function(elem) {
    // If this is a P element, check its parent to see if it's a DIV
    // with only this P element as a child.
    if (elem.tagName === "P" && elem.parentNode.childNodes.length === 1) {
      return true;
    }

    if (elem.childNodes.length !== 1 || elem.childNodes[0].tagName !== "P") {
      return false;
    }

    // At this point, the root element has a single P element as a child.
    // Add up the text length of all the children of the P element.
    var parent = elem.childNodes[0];
    var score = 0;
    for (var i = 0; i < parent.childNodes.length; i++) {
      score += this._getInnerText(parent.childNodes[i]).length;
    }

    return score < (5 * 25);
  },

  /**
   * Decide whether or not the current node is a candidate for the article.
   *
   * @param Element
   * @return boolean
   **/
  _isCandidate: function(elem) {
    // If the node has a score, let's leave it alone.
    if (elem.hasOwnProperty("readability")) {
      return true;
    }

    // Remove nodes that are empty.
    if (!this.REGEXPS.hasContent.test(this._getInnerText(elem))) {
      return false;
    }

    if (this._isSingleP(elem)) {
      return false;
    }

    // If the element has a negative score, let's discard it.
    var score = this._getScore(elem);
    if (score.negative >= 25 &&
        !(score.content > 75 && score.positive > score.negative)) {
      return false;
    }

    return true;
  },

  /**
   * Concat all CSS classes on a node.
   *
   * @param Element
   * @return string;
   */
  _concatClasses: function(elem) {
    var cls = "";
    if (typeof elem.className === "string") {
      cls = elem.className;
    } else if (elem.className && typeof elem.className.baseVal === "string") {
      // Handle SVGAnimatedString
      cls = elem.className.baseVal;
    } else if (elem.classList && typeof elem.classList.value === "string") {
      // Fallback for DOMTokenList
      cls = elem.classList.value;
    }
    var id = (typeof elem.id === "string") ? elem.id : "";
    return (cls + " " + id).trim();
  },

  /**
   * Get the density of links as a percentage of the content
   * This is the amount of text that is inside a link divided by the total text in the node.
   *
   * @param Element
   * @return number
   **/
  _getLinkDensity: function(elem) {
    var textLength = this._getInnerText(elem).length;
    if (textLength === 0)
      return 0;

    var linkLength = 0;
    var links = elem.getElementsByTagName("a");
    for (var i = 0; i < links.length; i++) {
      linkLength += this._getInnerText(links[i]).length;
    }

    return linkLength / textLength;
  },

  /**
   * Get the number of times a string s appears in the node.
   *
   * @param Element
   * @param string - what to count. Default is ","
   * @return number
  **/
  _getCharCount: function(elem, s) {
    s = s || ",";
    return this._getInnerText(elem).split(s).length - 1;
  },

  /**
   * Get the inner text of a node - cross browser compatibly.
   * This also strips out any excess whitespace to be found.
   *
   * @param Element
   * @return string
  **/
  _getInnerText: function(e, normalizeSpaces) {
    normalizeSpaces = (typeof normalizeSpaces == 'undefined') ? true : normalizeSpaces;

    var textContent = e.textContent.trim();

    if (normalizeSpaces) {
      return textContent.replace(this.REGEXPS.normalize, " ");
    }
    return textContent;
  },

  /**
   * Removes the class "readability-styled" from every element and its children.
   *
   * @param Element
   * @return void
   */
  _removeReadabilityStyles: function(elem) {
    var i,
        cur = elem.firstChild;

    // Remove any root styles we may have added.
    if (typeof elem.removeAttribute == 'function' && elem.className != "readability-styled") {
      elem.removeAttribute("style");
    }

    // For each child, remove the classname and recurse.
    while (cur) {
      if (cur.nodeType == 1) { // ELEMENT_NODE
        if (cur.className != "readability-styled") {
          cur.removeAttribute("style");
        }
        this._removeReadabilityStyles(cur);
      }
      cur = cur.nextSibling;
    }
  },

  /**
   * Get an elements class/id weight. Uses regular expressions to tell if this
   * element should be weighted positively or negatively.
   *
   * @param Element
   * @return number (Integer)
   **/
  _getClassWeight: function(elem) {
    if (this._isCandidate(elem)) {
      return 0;
    }

    var weight = 0;
    var contentScore = 0;
    if (typeof(elem.readability) != 'undefined') {
      contentScore = elem.readability.contentScore;
    }

    // Add weight for areas that have barely any content but have a positive classname.
    if (this._getCharCount(elem) < 25 && contentScore < 25) {
      // If the class is negative, kill the node.
      if (this.REGEXPS.negative.test(this._concatClasses(elem))) {
        weight = -50;
      }

      // If the class is positive, boost the node.
      if (this.REGEXPS.positive.test(this._concatClasses(elem))) {
        weight = 25;
      }
    }

    // Add weight for areas that have a lot of content.
    else {
      // If the class is negative, score it down.
      if (this.REGEXPS.negative.test(this._concatClasses(elem))) {
        weight = -25;
      }

      // If the class is positive, score it up.
      if (this.REGEXPS.positive.test(this._concatClasses(elem))) {
        weight = 50;
      }
    }

    return weight;
  },

  /**
   * Remove a node from the document.
   *
   * @param Element
   * @return void
   */
  _removeNode: function(node) {
    if (node.parentElement) {
      node.parentElement.removeChild(node);
    }
  },

  /**
   * Find a cleaned up version of the current document's title.
   *
   * @return string
   */
  _getArticleTitle: function() {
    var doc = this._doc;
    var curTitle = "",
        origTitle = doc.title;

    try {
      curTitle = origTitle;

      // If they had an element with id "title" in their page
      if (typeof curTitle !== "string")
        curTitle = this._getInnerText(doc.getElementsByTagName('title')[0]);
    } catch (e) {/* ignore exceptions setting the title. */
    }

    var titleHadHierarchicalSeparators = false;
    function wordCount(str) {
      return str.split(' ').length;
    }

    // If there's a separator in the title, first remove the final part
    if (curTitle.match(/ [\|\-\\\/>»] /)) {
      titleHadHierarchicalSeparators = true;
      curTitle = curTitle.replace(/(.*)[\|\-\\\/>»] .*/gi,'$1');

      // If the resulting title is too short (3 words or less), remove
      // the first part instead:
      if (wordCount(curTitle) < 3)
        curTitle = origTitle.replace(/[^\|\-\\\/>»]*[\|\-\\\/>»](.*)/gi,'$1');
    } else if (curTitle.indexOf(': ') !== -1) {
      // Check if we have an heading containing this exact string, so we
      // could assume it's the full title.
      var headers = this._concatNodeList(
        doc.getElementsByTagName('h1'),
        doc.getElementsByTagName('h2')
      );
      var trimmedTitle = curTitle.trim();
      var matchingHeader = headers.some(function(header) {
        return header.textContent.trim() === trimmedTitle;
      });
      if (!matchingHeader) {
        curTitle = origTitle.substring(origTitle.lastIndexOf(':') + 1);

        // If the resulting title is too short (3 words or less), remove
        // the first part instead:
        if (wordCount(curTitle) < 3)
          curTitle = origTitle.substring(origTitle.indexOf(':') + 1);
      }
    } else if (curTitle.length > 150 || curTitle.length < 15) {
      var hOnes = doc.getElementsByTagName('h1');

      if (hOnes.length === 1)
        curTitle = this._getInnerText(hOnes[0]);
    }

    curTitle = curTitle.trim();
    // If we now have 4 words or fewer as our title, and either no
    // 'hierarchical' separators (\, /, >) were found in the original
    // title or we decreased the number of words by more than 1 word,
    // use the original title.
    var curTitleWordCount = wordCount(curTitle);
    var origTitleWordCount = wordCount((origTitle || "").replace(this.REGEXPS.normalize, ' ').trim());
    if (curTitleWordCount <= 4 &&
        (!titleHadHierarchicalSeparators ||
         curTitleWordCount != (origTitleWordCount - 1))) {
      curTitle = origTitle;
    }

    return curTitle;
  },

  /**
   * Prepare the HTML document for readability to scrape it.
   * This includes things like stripping javascript, CSS, and handling terrible markup.
   *
   * @return void
   **/
  _prepDocument: function() {
    var doc = this._doc;

    // Remove all style tags in head
    var styleTags = doc.getElementsByTagName("style");
    for (var i = styleTags.length -1; i >= 0; i--) {
      this._removeNode(styleTags[i]);
    }

    if (doc.body) {
      this._replaceBrs(doc.body);
    }

    var fonts = doc.getElementsByTagName("font");
    for (var k = fonts.length - 1; k >= 0; k--) {
      var font = fonts[k];
      var images = font.getElementsByTagName("img");
      var replacement = null;

      // If the font tag has a single image inside of it, replace it.
      if (images.length === 1) {
        replacement = images[0];
      }
      // If the font tag has a single text node inside of it, replace it.
      else if (font.childNodes.length === 1 && font.childNodes[0].nodeType === 3) {
        replacement = this._doc.createTextNode(font.innerHTML);
      }

      if (replacement) {
        font.parentNode.replaceChild(replacement, font);
      }
    }
  },

  /**
   * Finds the next element, starting from the given node, and ignoring
   * whitespace in between. If the given node is an element, the same node is
   * returned.
   */
  _nextElement: function (node) {
    var next = node;
    while (next
           && (next.nodeType != 1 /* ELEMENT_NODE */)
           && this.REGEXPS.whitespace.test(next.textContent)) {
      next = next.nextSibling;
    }
    return next;
  },

  /**
   * Replaces 2 or more successive <br> elements with a single <p>.
   * Whitespace between <br> elements are ignored. For example:
   *   <br>
   *   <br>
   * becomes <p></p>
   *   <br>
   *   some text
   *   <br>
   * becomes <p>some text</p>
   */
  _replaceBrs: function (elem) {
    var brs = elem.getElementsByTagName("br");
    // We iterate backwards through the elements, so that we can remove them without affecting the index of the remaining nodes.
    for (var i = brs.length - 1; i >= 0; i--) {
      var br = brs[i];
      var next = br.nextSibling;

      // If we find a <br> chain, remove the <br>s until we hit another element or non-whitespace text
      var replace = false;
      while ((next = this._nextElement(next)) && next.tagName == "BR") {
        replace = true;
        var brSibling = next.nextSibling;
        this._removeNode(next);
        next = brSibling;
      }

      // If we removed a <br> chain, replace the last <br> with a <p>.
      if (replace) {
        var p = this._doc.createElement("p");
        br.parentNode.replaceChild(p, br);

        // Put next non-empty node into the <p>
        next = p.nextSibling;
        while (next) {
          // If we've hit another <br><br>, we're done with this <p>.
          if (next.tagName == "BR") {
            var nextElem = this._nextElement(next.nextSibling);
            if (nextElem && nextElem.tagName == "BR")
              break;
          }

          if (!this.REGEXPS.whitespace.test(next.textContent)) {
            var sibling = next.nextSibling;
            p.appendChild(next);
            next = sibling;
          } else {
            next = next.nextSibling;
          }
        }
      }
    }
  },

  _setNodeTag: function (node, tag) {
    var replacement = node.ownerDocument.createElement(tag);
    while (node.firstChild) {
      replacement.appendChild(node.firstChild);
    }
    node.parentNode.replaceChild(replacement, node);
    if (node.readability)
      replacement.readability = node.readability;

    for (var i = 0; i < node.attributes.length; i++) {
      replacement.setAttribute(node.attributes[i].name, node.attributes[i].value);
    }
    return replacement;
  },

  /**
   * Prepare the article node for display. Clean out any inline styles,
   * iframes, forms, strip extraneous <p> tags, etc.
   *
   * @param Element
   * @return void
   */
  _prepArticle: function(articleContent) {
    this._cleanStyles(articleContent);

    // Check for data tables before we continue, to avoid removing items in
    // those tables, which will often be isolated even though they're
    // visually linked.
    this._markDataTables(articleContent);

    // Clean out anything that looks like a date, courtesy component or byline.
    this._cleanConditionally(articleContent, "h1");
    this._cleanConditionally(articleContent, "h2");
    this._cleanConditionally(articleContent, "h3");
    this._cleanConditionally(articleContent, "h4");
    this._cleanConditionally(articleContent, "h5");
    this._cleanConditionally(articleContent, "h6");
    this._cleanConditionally(articleContent, "p");
    this._cleanConditionally(articleContent, "td");
    this._cleanConditionally(articleContent, "pre");

    // Remove nested elements.
    var articleChildren = articleContent.children;
    for (var i = articleChildren.length - 1; i >= 0; i--) {
      var child = articleChildren[i];

      // If this node has scored less than 25, remove it.
      // The only a few exceptions are if we're in a table, or if this is the only child.
      if (child.readability && child.readability.contentScore < 25 && child.tagName !== "TBODY") {
        this._removeNode(child);
      }
    }

    // Remove extra paragraphs.
    var paragraphs = articleContent.getElementsByTagName("p");
    for (i = paragraphs.length - 1; i >= 0; i--) {
      var p = paragraphs[i];
      var imgCount    = p.getElementsByTagName("img").length;
      var embedCount  = p.getElementsByTagName("embed").length;
      var objectCount = p.getElementsByTagName("object").length;
      // At this point, nasty iframes have been removed, so we don't have to check for them.
      var videoCount = p.getElementsByTagName("video").length;

      if (imgCount === 0 && embedCount === 0 && objectCount === 0 && videoCount === 0 && this._getInnerText(p, false) === "") {
        this._removeNode(p);
      }
    }

    // Remove any divs that look like headers
    var headers = articleContent.getElementsByTagName("div");
    for (i = headers.length - 1; i >= 0; i--) {
      var header = headers[i];
      if (this._isElementWithoutContent(header)) {
        var h1s = header.getElementsByTagName("h1");
        var h2s = header.getElementsByTagName("h2");
        if (h1s.length == 1 && h2s.length == 0) {
          this._removeNode(header);
        } else if (h2s.length == 1 && h1s.length == 0) {
          this._removeNode(header);
        }
      }
    }

    // Remove all spans in the content
    var spans = articleContent.getElementsByTagName("span");
    for (i = spans.length - 1; i >= 0; i--) {
      this._removeNode(spans[i]);
    }

    var brs = articleContent.getElementsByTagName("br");
    for (i = brs.length - 1; i >= 0; i--) {
      this._removeNode(brs[i]);
    }
  },

  /**
   * Initialize a node with the readability object. Also checks the
   * className/id for special names to add to its score.
   *
   * @param Element
   * @return void
  **/
  _initializeNode: function(node) {
    node.readability = {"contentScore": 0};

    switch(node.tagName) {
      case 'DIV':
        node.readability.contentScore += 5;
        break;

      case 'PRE':
      case 'TD':
      case 'BLOCKQUOTE':
        node.readability.contentScore += 3;
        break;

      case 'ADDRESS':
      case 'OL':
      case 'UL':
      case 'DL':
      case 'DD':
      case 'DT':
      case 'LI':
      case 'FORM':
        node.readability.contentScore -= 3;
        break;

      case 'H1':
      case 'H2':
      case 'H3':
      case 'H4':
      case 'H5':
      case 'H6':
      case 'TH':
        node.readability.contentScore -= 5;
        break;
    }

    node.readability.contentScore += this._getClassWeight(node);
  },

  _removeAndGetNext: function(node) {
    var nextNode = this._getNextNode(node, true);
    this._removeNode(node);
    return nextNode;
  },

  /**
   * Traverse the DOM from node to node, starting at the node passed in.
   * Pass true for the second parameter to indicate this node should be used instead of its parent.
   *
   * @param Element
   * @param boolean
   * @return Element
  **/
  _getNextNode: function(node, useSelf) {
    // Falsy node? Stop here.
    if (!node) {
      return node;
    }

    // Default to false for useSelf
    useSelf = (typeof useSelf == 'undefined') ? false : useSelf;

    var nextNode = (useSelf) ? node : node.nextSibling;

    while(nextNode && nextNode.nodeType !== 1) {
      nextNode = nextNode.nextSibling;
    }

    return nextNode;
  },

  /**
   * Checks if this node is an exact match for one of the given tags
   * @param {Node} node
   * @param {Array} tags
   * @returns {boolean}
   */
  _isExactMatch: function(node, tags) {
    return tags.some(function(tag) {
      return node.tagName === tag;
    });
  },

  /**
   * For the given node, check to see if any of its child nodes are image candidates.
   *
   * @param Element
   * @return boolean
  **/
  _isImageCandidate: function(node) {
    return this._isExactMatch(node, ["IMG", "PICTURE", "FIGURE"]) ||
           (node.tagName === "A" && node.getElementsByTagName("img").length);
  },

  /**
   * For the given node, check to see if any of its child nodes are text candidates.
   *
   * @param Element
   * @return boolean
  **/
  _isTextCandidate: function(node) {
    return this._isExactMatch(node, ["P", "PRE", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "CODE", "UL", "OL", "LI", "TABLE"]);
  },

  /**
   * For the given node, check to see if any of its child nodes are list candidates.
   *
   * @param Element
   * @return boolean
  **/
  _isListCandidate: function(node) {
    return this._isExactMatch(node, ["UL", "OL"]);
  },

  /**
   * For the given node, check to see if any of its child nodes are table candidates.
   *
   * @param Element
   * @return boolean
  **/
  _isTableCandidate: function(node) {
    return this._isExactMatch(node, ["TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TH", "TD"]);
  },

  _isElementWithoutContent: function(node) {
    return node.nodeType === 1 && // It's an element
           node.textContent.trim().length === 0 && // It has no text content
           (node.children.length === 0 || // It has no children elements
            node.children.length === node.getElementsByTagName("br").length + node.getElementsByTagName("hr").length); // Or all children are <br>s or <hr>s
  },

  /**
   * Traverse the DOM from node to node, starting at the node passed in.
   * Pass true for the second parameter to indicate this node should be used instead of its parent.
   *
   * @param Element
   * @param boolean
   * @return Element
  **/
  _getSibling: function(node, useSelf) {
    // Falsy node? Stop here.
    if (!node) {
      return node;
    }

    // Default to false for useSelf
    useSelf = (typeof useSelf == 'undefined') ? false : useSelf;

    var sibling = (useSelf) ? node : node.nextSibling;

    while (sibling && sibling.nodeType !== 1) {
      sibling = sibling.nextSibling;
    }

    return sibling;
  },

  /**
   * Get the score of a node. This is based on the class of the node, the number of links, the number of p tags, etc.
   *
   * @param Element
   * @return object with "positive" and "negative" properties
  **/
  _getScore: function(node) {
    var score = {
      positive: 0,
      negative: 0
    };

    // We can't do anything if the node has no children.
    if (!node.childNodes.length) {
      return score;
    }

    // Iterate through all of the children of this node and find their score.
    for (var i = 0; i < node.childNodes.length; i++) {
      var child = node.childNodes[i];

      // If the child is a text node, we don't do anything.
      if (child.nodeType === 3) {
        continue;
      }

      // If the child has a "readability" object, we can use that to get the score.
      if (child.hasOwnProperty("readability")) {
        score.positive += child.readability.contentScore;
        continue;
      }

      var childScore = this._getScore(child);
      score.positive += childScore.positive;
      score.negative += childScore.negative;
    }

    // Add a point for just having a child.
    score.positive++;

    // Add points for any p/pre/td tags.
    var p = node.getElementsByTagName("p").length;
    var pre = node.getElementsByTagName("pre").length;
    var td = node.getElementsByTagName("td").length;
    score.positive += p + pre + td;

    // Add points for any ol/ul tags.
    var ul = node.getElementsByTagName("ul").length;
    var ol = node.getElementsByTagName("ol").length;
    score.positive += ul + ol;

    // Add points for any h1/h2/h3 tags.
    var h1 = node.getElementsByTagName("h1").length;
    var h2 = node.getElementsByTagName("h2").length;
    var h3 = node.getElementsByTagName("h3").length;
    score.positive += h1 + h2 + h3;

    // Add points for any blockquote tags.
    var blockquote = node.getElementsByTagName("blockquote").length;
    score.positive += blockquote;

    // Add points for any img tags.
    var img = node.getElementsByTagName("img").length;
    score.positive += img;

    // Add points for any li tags.
    var li = node.getElementsByTagName("li").length;
    score.positive += li * 0.5;

    // Add points for any a tags.
    var a = node.getElementsByTagName("a").length;
    score.positive += a * 0.25;

    // Subtract points for any form tags.
    var form = node.getElementsByTagName("form").length;
    score.negative += form * 2;

    // Subtract points for any h1/h2/h3 tags that are not in the top 2 levels.
    var h1 = node.getElementsByTagName("h1").length;
    var h2 = node.getElementsByTagName("h2").length;
    var h3 = node.getElementsByTagName("h3").length;
    score.negative += h1 + h2 + h3;

    // Subtract points for any div tags that have a negative classname.
    var div = node.getElementsByTagName("div");
    for (var i = 0; i < div.length; i++) {
      if (this.REGEXPS.negative.test(this._concatClasses(div[i]))) {
        score.negative += 25;
      }
    }

    return score;
  },

  /**
   * Get the density of text as a percentage of the content.
   * This is the amount of text that is not inside a link divided by the total text in the node.
   *
   * @param Element
   * @return number
  **/
  _getTextDensity: function(elem) {
    var textLength = this._getInnerText(elem).length;
    if (textLength === 0) {
      return 0;
    }

    var linkLength = 0;
    var links = elem.getElementsByTagName("a");
    for (var i = 0; i < links.length; i++) {
      linkLength += this._getInnerText(links[i]).length;
    }

    return (textLength - linkLength) / textLength;
  },

  /***
   * grabArticle - based on isCrap above
   *
   * @param page a document object of the page to analyze
   * @return Element
  **/
  _grabArticle: function (page) {
    this._log("**** grabArticle ****");
    var doc = this._doc;
    var isPaging = (page !== null) ? true: false;
    page = page ? page : this._doc.body;

    // We can't grab an article if we don't have a page!
    if (!page) {
      this._log("No body found in document. Abort.");
      return null;
    }

    var pageCacheHtml = page.innerHTML;

    var allElements = page.getElementsByTagName('*');

    /**
     * The first pass through recursively extracts candidates and scores them.
     * A score is determined by things like number of commas, density of links, etc.
     *
     * @param Element
     * @return boolean
     **/
    var getArticleContent = function(node) {
      // Falsy node? Stop here.
      if (!node) {
        return null;
      }

      // If the node has a "readability" object, we don't need to parse it again.
      if (node.hasOwnProperty("readability")) {
        return node;
      }

      // If the node is a text node, we don't do anything.
      if (node.nodeType === 3) {
        return null;
      }

      // If the node has a "readability-ignore" class, we don't do anything.
      if (this._concatClasses(node).indexOf("readability-ignore") !== -1) {
        return null;
      }

      // If the node is a text candidate, we want to check it.
      if (this._isTextCandidate(node)) {
        // If the node has a child that is not a text candidate, we want to check that child.
        for (var i = 0; i < node.childNodes.length; i++) {
          var child = node.childNodes[i];
          if (!this._isTextCandidate(child)) {
            var article = getArticleContent.call(this, child);
            if (article) {
              return article;
            }
          }
        }
      }

      // If the node is a list candidate, we want to check it.
      if (this._isListCandidate(node)) {
        // If the node has a child that is not a list candidate, we want to check that child.
        for (var i = 0; i < node.childNodes.length; i++) {
          var child = node.childNodes[i];
          if (!this._isListCandidate(child)) {
            var article = getArticleContent.call(this, child);
            if (article) {
              return article;
            }
          }
        }
      }

      // If the node is a table candidate, we want to check it.
      if (this._isTableCandidate(node)) {
        // If the node has a child that is not a table candidate, we want to check that child.
        for (var i = 0; i < node.childNodes.length; i++) {
          var child = node.childNodes[i];
          if (!this._isTableCandidate(child)) {
            var article = getArticleContent.call(this, child);
            if (article) {
              return article;
            }
          }
        }
      }

      // If the node is an image candidate, we want to check it.
      if (this._isImageCandidate(node)) {
        // If the node has a child that is not an image candidate, we want to check that child.
        for (var i = 0; i < node.childNodes.length; i++) {
          var child = node.childNodes[i];
          if (!this._isImageCandidate(child)) {
            var article = getArticleContent.call(this, child);
            if (article) {
              return article;
            }
          }
        }
      }

      // If the node has a "readability" object, we can use that to get the score.
      if (node.hasOwnProperty("readability")) {
        return node;
      }

      // If the node has a "readability-ignore" class, we don't do anything.
      if (this._concatClasses(node).indexOf("readability-ignore") !== -1) {
        return null;
      }

      // If the node has a score, we want to check it.
      var score = this._getScore(node);
      if (score.positive > 0) {
        node.readability = {
          "contentScore": score.positive
        };
        return node;
      }

      return null;
    }.bind(this);

    var nodesToScore = [];
    for (var nodeIndex = 0; nodeIndex < allElements.length; nodeIndex++) {
      var node = allElements[nodeIndex];

      // If the node has a "readability-ignore" class, we don't do anything.
      if (this._concatClasses(node).indexOf("readability-ignore") !== -1) {
        continue;
      }

      // If the node has a "readability" object, we don't need to parse it again.
      if (node.hasOwnProperty("readability")) {
        continue;
      }

      // If the node is a text candidate, we want to check it.
      if (this._isTextCandidate(node)) {
        // If the node has a child that is not a text candidate, we want to check that child.
        for (var i = 0; i < node.childNodes.length; i++) {
          var child = node.childNodes[i];
          if (!this._isTextCandidate(child)) {
            var article = getArticleContent.call(this, child);
            if (article) {
              nodesToScore.push(article);
            }
          }
        }
      }

      // If the node is a list candidate, we want to check it.
      if (this._isListCandidate(node)) {
        // If the node has a child that is not a list candidate, we want to check that child.
        for (var i = 0; i < node.childNodes.length; i++) {
          var child = node.childNodes[i];
          if (!this._isListCandidate(child)) {
            var article = getArticleContent.call(this, child);
            if (article) {
              nodesToScore.push(article);
            }
          }
        }
      }

      // If the node is a table candidate, we want to check it.
      if (this._isTableCandidate(node)) {
        // If the node has a child that is not a table candidate, we want to check that child.
        for (var i = 0; i < node.childNodes.length; i++) {
          var child = node.childNodes[i];
          if (!this._isTableCandidate(child)) {
            var article = getArticleContent.call(this, child);
            if (article) {
              nodesToScore.push(article);
            }
          }
        }
      }

      // If the node is an image candidate, we want to check it.
      if (this._isImageCandidate(node)) {
        // If the node has a child that is not an image candidate, we want to check that child.
        for (var i = 0; i < node.childNodes.length; i++) {
          var child = node.childNodes[i];
          if (!this._isImageCandidate(child)) {
            var article = getArticleContent.call(this, child);
            if (article) {
              nodesToScore.push(article);
            }
          }
        }
      }

      // If the node has a "readability" object, we can use that to get the score.
      if (node.hasOwnProperty("readability")) {
        nodesToScore.push(node);
        continue;
      }

      // If the node has a score, we want to check it.
      var score = this._getScore(node);
      if (score.positive > 0) {
        node.readability = {
          "contentScore": score.positive
        };
        nodesToScore.push(node);
      }
    }

    /**
     * After we've gone through the entire document, we have a list of candidates.
     * Now we need to determine which candidate is the best one.
     *
     * @return Element
     **/
    var getBestCandidate = function() {
      var bestCandidate = null;
      var bestScore = 0;

      for (var i = 0; i < nodesToScore.length; i++) {
        var node = nodesToScore[i];
        var score = node.readability.contentScore;

        if (score > bestScore) {
          bestCandidate = node;
          bestScore = score;
        }
      }

      return bestCandidate;
    };

    var bestCandidate = getBestCandidate();

    // If we don't have a best candidate, we can't do anything.
    if (!bestCandidate) {
      if (isPaging) {
        return null;
      }

      // This is a last-ditch effort to find some content.
      // If we have a single div with a lot of text, we'll use that.
      var divs = doc.getElementsByTagName("div");
      if (divs.length === 1) {
        bestCandidate = divs[0];
      }
      // If we have a single p with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("p").length === 1) {
        bestCandidate = doc.getElementsByTagName("p")[0];
      }
      // If we have a single pre with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("pre").length === 1) {
        bestCandidate = doc.getElementsByTagName("pre")[0];
      }
      // If we have a single td with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("td").length === 1) {
        bestCandidate = doc.getElementsByTagName("td")[0];
      }
      // If we have a single blockquote with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("blockquote").length === 1) {
        bestCandidate = doc.getElementsByTagName("blockquote")[0];
      }
      // If we have a single code with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("code").length === 1) {
        bestCandidate = doc.getElementsByTagName("code")[0];
      }
      // If we have a single ul with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("ul").length === 1) {
        bestCandidate = doc.getElementsByTagName("ul")[0];
      }
      // If we have a single ol with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("ol").length === 1) {
        bestCandidate = doc.getElementsByTagName("ol")[0];
      }
      // If we have a single li with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("li").length === 1) {
        bestCandidate = doc.getElementsByTagName("li")[0];
      }
      // If we have a single table with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("table").length === 1) {
        bestCandidate = doc.getElementsByTagName("table")[0];
      }
      // If we have a single article with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("article").length === 1) {
        bestCandidate = doc.getElementsByTagName("article")[0];
      }
      // If we have a single section with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("section").length === 1) {
        bestCandidate = doc.getElementsByTagName("section")[0];
      }
      // If we have a single header with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("header").length === 1) {
        bestCandidate = doc.getElementsByTagName("header")[0];
      }
      // If we have a single footer with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("footer").length === 1) {
        bestCandidate = doc.getElementsByTagName("footer")[0];
      }
      // If we have a single nav with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("nav").length === 1) {
        bestCandidate = doc.getElementsByTagName("nav")[0];
      }
      // If we have a single aside with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("aside").length === 1) {
        bestCandidate = doc.getElementsByTagName("aside")[0];
      }
      // If we have a single figure with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("figure").length === 1) {
        bestCandidate = doc.getElementsByTagName("figure")[0];
      }
      // If we have a single figcaption with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("figcaption").length === 1) {
        bestCandidate = doc.getElementsByTagName("figcaption")[0];
      }
      // If we have a single main with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("main").length === 1) {
        bestCandidate = doc.getElementsByTagName("main")[0];
      }
      // If we have a single summary with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("summary").length === 1) {
        bestCandidate = doc.getElementsByTagName("summary")[0];
      }
      // If we have a single details with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("details").length === 1) {
        bestCandidate = doc.getElementsByTagName("details")[0];
      }
      // If we have a single time with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("time").length === 1) {
        bestCandidate = doc.getElementsByTagName("time")[0];
      }
      // If we have a single mark with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("mark").length === 1) {
        bestCandidate = doc.getElementsByTagName("mark")[0];
      }
      // If we have a single wbr with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("wbr").length === 1) {
        bestCandidate = doc.getElementsByTagName("wbr")[0];
      }
      // If we have a single ruby with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("ruby").length === 1) {
        bestCandidate = doc.getElementsByTagName("ruby")[0];
      }
      // If we have a single rt with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("rt").length === 1) {
        bestCandidate = doc.getElementsByTagName("rt")[0];
      }
      // If we have a single rp with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("rp").length === 1) {
        bestCandidate = doc.getElementsByTagName("rp")[0];
      }
      // If we have a single bdi with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("bdi").length === 1) {
        bestCandidate = doc.getElementsByTagName("bdi")[0];
      }
      // If we have a single bdo with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("bdo").length === 1) {
        bestCandidate = doc.getElementsByTagName("bdo")[0];
      }
      // If we have a single keygen with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("keygen").length === 1) {
        bestCandidate = doc.getElementsByTagName("keygen")[0];
      }
      // If we have a single output with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("output").length === 1) {
        bestCandidate = doc.getElementsByTagName("output")[0];
      }
      // If we have a single progress with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("progress").length === 1) {
        bestCandidate = doc.getElementsByTagName("progress")[0];
      }
      // If we have a single meter with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("meter").length === 1) {
        bestCandidate = doc.getElementsByTagName("meter")[0];
      }
      // If we have a single canvas with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("canvas").length === 1) {
        bestCandidate = doc.getElementsByTagName("canvas")[0];
      }
      // If we have a single svg with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("svg").length === 1) {
        bestCandidate = doc.getElementsByTagName("svg")[0];
      }
      // If we have a single math with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("math").length === 1) {
        bestCandidate = doc.getElementsByTagName("math")[0];
      }
      // If we have a single video with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("video").length === 1) {
        bestCandidate = doc.getElementsByTagName("video")[0];
      }
      // If we have a single audio with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("audio").length === 1) {
        bestCandidate = doc.getElementsByTagName("audio")[0];
      }
      // If we have a single source with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("source").length === 1) {
        bestCandidate = doc.getElementsByTagName("source")[0];
      }
      // If we have a single track with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("track").length === 1) {
        bestCandidate = doc.getElementsByTagName("track")[0];
      }
      // If we have a single embed with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("embed").length === 1) {
        bestCandidate = doc.getElementsByTagName("embed")[0];
      }
      // If we have a single object with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("object").length === 1) {
        bestCandidate = doc.getElementsByTagName("object")[0];
      }
      // If we have a single param with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("param").length === 1) {
        bestCandidate = doc.getElementsByTagName("param")[0];
      }
      // If we have a single map with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("map").length === 1) {
        bestCandidate = doc.getElementsByTagName("map")[0];
      }
      // If we have a single area with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("area").length === 1) {
        bestCandidate = doc.getElementsByTagName("area")[0];
      }
      // If we have a single script with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("script").length === 1) {
        bestCandidate = doc.getElementsByTagName("script")[0];
      }
      // If we have a single noscript with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("noscript").length === 1) {
        bestCandidate = doc.getElementsByTagName("noscript")[0];
      }
      // If we have a single template with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("template").length === 1) {
        bestCandidate = doc.getElementsByTagName("template")[0];
      }
      // If we have a single slot with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("slot").length === 1) {
        bestCandidate = doc.getElementsByTagName("slot")[0];
      }
      // If we have a single datalist with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("datalist").length === 1) {
        bestCandidate = doc.getElementsByTagName("datalist")[0];
      }
      // If we have a single optgroup with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("optgroup").length === 1) {
        bestCandidate = doc.getElementsByTagName("optgroup")[0];
      }
      // If we have a single option with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("option").length === 1) {
        bestCandidate = doc.getElementsByTagName("option")[0];
      }
      // If we have a single select with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("select").length === 1) {
        bestCandidate = doc.getElementsByTagName("select")[0];
      }
      // If we have a single textarea with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("textarea").length === 1) {
        bestCandidate = doc.getElementsByTagName("textarea")[0];
      }
      // If we have a single input with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("input").length === 1) {
        bestCandidate = doc.getElementsByTagName("input")[0];
      }
      // If we have a single label with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("label").length === 1) {
        bestCandidate = doc.getElementsByTagName("label")[0];
      }
      // If we have a single fieldset with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("fieldset").length === 1) {
        bestCandidate = doc.getElementsByTagName("fieldset")[0];
      }
      // If we have a single legend with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("legend").length === 1) {
        bestCandidate = doc.getElementsByTagName("legend")[0];
      }
      // If we have a single button with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("button").length === 1) {
        bestCandidate = doc.getElementsByTagName("button")[0];
      }
      // If we have a single style with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("style").length === 1) {
        bestCandidate = doc.getElementsByTagName("style")[0];
      }
      // If we have a single title with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("title").length === 1) {
        bestCandidate = doc.getElementsByTagName("title")[0];
      }
      // If we have a single meta with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("meta").length === 1) {
        bestCandidate = doc.getElementsByTagName("meta")[0];
      }
      // If we have a single link with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("link").length === 1) {
        bestCandidate = doc.getElementsByTagName("link")[0];
      }
      // If we have a single base with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("base").length === 1) {
        bestCandidate = doc.getElementsByTagName("base")[0];
      }
      // If we have a single head with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("head").length === 1) {
        bestCandidate = doc.getElementsByTagName("head")[0];
      }
      // If we have a single body with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("body").length === 1) {
        bestCandidate = doc.getElementsByTagName("body")[0];
      }
      // If we have a single html with a lot of text, we'll use that.
      else if (doc.getElementsByTagName("html").length === 1) {
        bestCandidate = doc.getElementsByTagName("html")[0];
      }
    }

    // If we have a best candidate, let's use it.
    if (bestCandidate) {
      var article = this._doc.createElement("div");
      if (isPaging) {
        article.id = "readability-content";
      }

      // Set the article title.
      var articleTitle = this._getArticleTitle();
      if (articleTitle) {
        var h1 = this._doc.createElement("h1");
        h1.innerHTML = articleTitle;
        article.appendChild(h1);
      }

      var siblingScore = 0;
      var sibling = bestCandidate.previousSibling;
      while (sibling) {
        if (sibling.nodeType === 1) {
          var score = this._getScore(sibling);
          if (score.positive > 0) {
            siblingScore += score.positive;
          }
        }
        sibling = sibling.previousSibling;
      }

      var parent = bestCandidate.parentNode;
      var parentScore = this._getScore(parent);
      if (parentScore.positive > 0) {
        var score = parentScore.positive;
        if (score > siblingScore) {
          bestCandidate = parent;
        }
      }

      // Now that we have the best candidate, let's clean it up.
      this._prepArticle(bestCandidate);

      // Now that we have the best candidate, let's append it to the article.
      article.appendChild(bestCandidate);

      // If we're not in paging mode, let's do a post-process on the article.
      if (!isPaging) {
        this._postProcessContent(article);
      }

      return article;
    }

    if (!isPaging) {
      page.innerHTML = pageCacheHtml;
      return null;
    }
  },

  /**
   * Reads the meta data of the document.
   *
   * @return object with "title", "byline", "dir" and "siteName" properties
   */
  _getArticleMetadata: function() {
    var data = {};
    var values = {};
    var metaElements = this._doc.getElementsByTagName("meta");

    // Match "description", "author" and "site_name" meta tags
    var namePattern = /^\s*((twitter)\s*:\s*)?(description|author|site_name)\s*$/gi;
    var propertyPattern = /^\s*og\s*:\s*(description|author|site_name)\s*$/gi;

    // Find description tags.
    for (var i = 0; i < metaElements.length; i++) {
      var meta = metaElements[i];
      var elementName = meta.getAttribute("name");
      var elementProperty = meta.getAttribute("property");

      if (elementName) {
        var nameMatch = elementName.match(namePattern);
        if (nameMatch) {
          var content = meta.getAttribute("content");
          if (content) {
            // Convert to lower case and remove trailing whitespace
            var name = nameMatch[0].toLowerCase().replace(/\s+$/, "");
            values[name] = content.trim();
          }
        }
      }
      if (elementProperty) {
        var propertyMatch = elementProperty.match(propertyPattern);
        if (propertyMatch) {
          var content = meta.getAttribute("content");
          if (content) {
            // Convert to lower case and remove trailing whitespace
            var property = propertyMatch[0].toLowerCase().replace(/\s+$/, "");
            values[property] = content.trim();
          }
        }
      }
    }

    // Set the description
    data.description = values["description"] || values["og:description"] || values["twitter:description"];

    // Set the author
    data.author = values["author"] || values["og:author"] || values["twitter:author"];

    // Set the site name
    data.siteName = values["site_name"] || values["og:site_name"] || values["twitter:site_name"];

    // Find the byline
    var byline = this._doc.querySelector("[itemprop=author], [rel=author]");
    if (byline) {
      data.byline = byline.textContent.trim();
    }

    return data;
  },

  /**
   * Removes trailing whitespace from a string
   *
   * @param string
   * @return string
   */
  _trim: function(s) {
    return s.replace(/^\s+|\s+$/g, '');
  },

  /**
   * Get the innerHTML of a node.
   *
   * @param Element
   * @return string
   */
  _getInnerHTML: function(e) {
    return e.innerHTML;
  },

  /**
   * Get the outerHTML of a node.
   *
   * @param Element
   * @return string
   */
  _getOuterHTML: function(e) {
    return e.outerHTML;
  },

  /**
   * Get the children of a node.
   *
   * @param Element
   * @return array
   */
  _getChildren: function(e) {
    return e.children;
  },

  /**
   * Get the parent of a node.
   *
   * @param Element
   * @return Element
   */
  _getParent: function(e) {
    return e.parentNode;
  },

  /**
   * Get the siblings of a node.
   *
   * @param Element
   * @return array
   */
  _getSiblings: function(e) {
    var siblings = [];
    var sibling = e.previousSibling;
    while (sibling) {
      siblings.push(sibling);
      sibling = sibling.previousSibling;
    }
    siblings.reverse();
    sibling = e.nextSibling;
    while (sibling) {
      siblings.push(sibling);
      sibling = sibling.nextSibling;
    }
    return siblings;
  },

  /**
   * Get the index of a node in its parent.
   *
   * @param Element
   * @return number
   */
  _getIndex: function(e) {
    var i = 0;
    var sibling = e.previousSibling;
    while (sibling) {
      i++;
      sibling = sibling.previousSibling;
    }
    return i;
  },

  /**
   * Get the text of a node.
   *
   * @param Element
   * @return string
   */
  _getText: function(e) {
    return e.textContent;
  },

  /**
   * Get the tag name of a node.
   *
   * @param Element
   * @return string
   */
  _getTagName: function(e) {
    return e.tagName;
  },

  /**
   * Get the attributes of a node.
   *
   * @param Element
   * @return object
   */
  _getAttributes: function(e) {
    var attrs = {};
    for (var i = 0; i < e.attributes.length; i++) {
      attrs[e.attributes[i].name] = e.attributes[i].value;
    }
    return attrs;
  },

  /**
   * Get the class name of a node.
   *
   * @param Element
   * @return string
   */
  _getClassName: function(e) {
    return e.className;
  },

  /**
   * Get the id of a node.
   *
   * @param Element
   * @return string
   */
  _getId: function(e) {
    return e.id;
  },

  /**
   * Get the name of a node.
   *
   * @param Element
   * @return string
   */
  _getName: function(e) {
    return e.name;
  },

  /**
   * Get the value of a node.
   *
   * @param Element
   * @return string
   */
  _getValue: function(e) {
    return e.value;
  },

  /**
   * Get the type of a node.
   *
   * @param Element
   * @return string
   */
  _getType: function(e) {
    return e.type;
  },

  /**
   * Get the src of a node.
   *
   * @param Element
   * @return string
   */
  _getSrc: function(e) {
    return e.src;
  },

  /**
   * Get the href of a node.
   *
   * @param Element
   * @return string
   */
  _getHref: function(e) {
    return e.href;
  },

  /**
   * Get the action of a node.
   *
   * @param Element
   * @return string
   */
  _getAction: function(e) {
    return e.action;
  },

  /**
   * Get the method of a node.
   *
   * @param Element
   * @return string
   */
  _getMethod: function(e) {
    return e.method;
  },

  /**
   * Get the target of a node.
   *
   * @param Element
   * @return string
   */
  _getTarget: function(e) {
    return e.target;
  },

  /**
   * Get the title of a node.
   *
   * @param Element
   * @return string
   */
  _getTitle: function(e) {
    return e.title;
  },

  /**
   * Get the alt of a node.
   *
   * @param Element
   * @return string
   */
  _getAlt: function(e) {
    return e.alt;
  },

  /**
   * Get the rel of a node.
   *
   * @param Element
   * @return string
   */
  _getRel: function(e) {
    return e.rel;
  },

  /**
   * Get the selected index of a node.
   *
   * @param Element
   *   @return number
   */
  _getSelectedIndex: function(e) {
    return e.selectedIndex;
  },

  /**
   * Get the options of a node.
   *
   * @param Element
   * @return array
   */
  _getOptions: function(e) {
    return e.options;
  },

  /**
   * Get the selected options of a node.
   *
   * @param Element
   * @return array
   */
  _getSelectedOptions: function(e) {
    var selectedOptions = [];
    for (var i = 0; i < e.options.length; i++) {
      if (e.options[i].selected) {
        selectedOptions.push(e.options[i]);
      }
    }
    return selectedOptions;
  },

  /**
   * Get the checked property of a node.
   *
   * @param Element
   * @return boolean
   */
  _getChecked: function(e) {
    return e.checked;
  },

  /**
   * Get the disabled property of a node.
   *
   * @param Element
   * @return boolean
   */
  _getDisabled: function(e) {
    return e.disabled;
  },

  /**
   * Get the multiple property of a node.
   *
   * @param Element
   * @return boolean
   */
  _getMultiple: function(e) {
    return e.multiple;
  },

  /**
   * Get the readonly property of a node.
   *
   * @param Element
   * @return boolean
   */
  _getReadonly: function(e) {
    return e.readOnly;
  },

  /**
   * Get the required property of a node.
   *
   * @param Element
   * @return boolean
   */
  _getRequired: function(e) {
    return e.required;
  },

  /**
   * Get the selected property of a node.
   *
   * @param Element
   * @return boolean
   */
  _getSelected: function(e) {
    return e.selected;
  },

  /**
   * Get the style of a node.
   *
   * @param Element
   * @return object
   */
  _getStyle: function(e) {
    return e.style;
  },

  /**
   * Get the computed style of a node.
   *
   * @param Element
   * @return object
   */
  _getComputedStyle: function(e) {
    return window.getComputedStyle(e, null);
  },

  /**
   * Get the bounding client rect of a node.
   *
   * @param Element
   * @return object
   */
  _getBoundingClientRect: function(e) {
    return e.getBoundingClientRect();
  },

  /**
   * Get the client width of a node.
   *
   * @param Element
   * @return number
   */
  _getClientWidth: function(e) {
    return e.clientWidth;
  },

  /**
   * Get the client height of a node.
   *
   * @param Element
   * @return number
   */
  _getClientHeight: function(e) {
    return e.clientHeight;
  },

  /**
   * Get the scroll width of a node.
   *
   * @param Element
   * @return number
   */
  _getScrollWidth: function(e) {
    return e.scrollWidth;
  },

  /**
   * Get the scroll height of a node.
   *
   * @param Element
   * @return number
   */
  _getScrollHeight: function(e) {
    return e.scrollHeight;
  },

  /**
   * Get the scroll left of a node.
   *
   * @param Element
   * @return number
   */
  _getScrollLeft: function(e) {
    return e.scrollLeft;
  },

  /**
   * Get the scroll top of a node.
   *
   * @param Element
   * @return number
   */
  _getScrollTop: function(e) {
    return e.scrollTop;
  },

  /**
   * Get the offset width of a node.
   *
   * @param Element
   * @return number
   */
  _getOffsetWidth: function(e) {
    return e.offsetWidth;
  },

  /**
   * Get the offset height of a node.
   *
   * @param Element
   * @return number
   */
  _getOffsetHeight: function(e) {
    return e.offsetHeight;
  },

  /**
   * Get the offset left of a node.
   *
   * @param Element
   * @return number
   */
  _getOffsetLeft: function(e) {
    return e.offsetLeft;
  },

  /**
   * Get the offset top of a node.
   *
   * @param Element
   * @return number
   */
  _getOffsetTop: function(e) {
    return e.offsetTop;
  },

  /**
   * Get the offset parent of a node.
   *
   * @param Element
   * @return Element
   */
  _getOffsetParent: function(e) {
    return e.offsetParent;
  },

  /**
   * Get the first child of a node.
   *
   * @param Element
   * @return Element
   */
  _getFirstChild: function(e) {
    return e.firstChild;
  },

  /**
   * Get the last child of a node.
   *
   * @param Element
   * @return Element
   */
  _getLastChild: function(e) {
    return e.lastChild;
  },

  /**
   * Get the next sibling of a node.
   *
   * @param Element
   * @return Element
   */
  _getNextSibling: function(e) {
    return e.nextSibling;
  },

  /**
   * Get the previous sibling of a node.
   *
   * @param Element
   * @return Element
   */
  _getPreviousSibling: function(e) {
    return e.previousSibling;
  },

  /**
   * Get the first element child of a node.
   *
   * @param Element
   * @return Element
   */
  _getFirstElementChild: function(e) {
    return e.firstElementChild;
  },

  /**
   * Get the last element child of a node.
   *
   * @param Element
   * @return Element
   */
  _getLastElementChild: function(e) {
    return e.lastElementChild;
  },

  /**
   * Get the next element sibling of a node.
   *
   * @param Element
   * @return Element
   */
  _getNextElementSibling: function(e) {
    return e.nextElementSibling;
  },

  /**
   * Get the previous element sibling of a node.
   *
   * @param Element
   * @return Element
   */
  _getPreviousElementSibling: function(e) {
    return e.previousElementSibling;
  },

  /**
   * Get the child count of a node.
   *
   * @param Element
   * @return number
   */
  _getChildCount: function(e) {
    return e.childElementCount;
  },

  /**
   * Get the children of a node.
   *
   * @param Element
   * @return array
   */
  _getChildNodes: function(e) {
    return e.childNodes;
  },

  /**
   * Get the node name of a node.
   *
   * @param Element
   * @return string
   */
  _getNodeName: function(e) {
    return e.nodeName;
  },

  /**
   * Get the node type of a node.
   *
   * @param Element
   * @return number
   */
  _getNodeType: function(e) {
    return e.nodeType;
  },

  /**
   * Get the node value of a node.
   *
   * @param Element
   * @return string
   */
  _getNodeValue: function(e) {
    return e.nodeValue;
  },

  /**
   * Set the innerHTML of a node.
   *
   * @param Element
   * @param string
   */
  _setInnerHTML: function(e, html) {
    e.innerHTML = html;
  },

  /**
   * Set the outerHTML of a node.
   *
   * @param Element
   * @param string
   */
  _setOuterHTML: function(e, html) {
    e.outerHTML = html;
  },

  /**
   * Set the text of a node.
   *
   * @param Element
   * @param string
   */
  _setText: function(e, text) {
    e.textContent = text;
  },

  /**
   * Set the attributes of a node.
   *
   * @param Element
   * @param object
   */
  _setAttributes: function(e, attrs) {
    for (var name in attrs) {
      e.setAttribute(name, attrs[name]);
    }
  },

  /**
   * Set the class name of a node.
   *
   * @param Element
   * @param string
   */
  _setClassName: function(e, className) {
    e.className = className;
  },

  /**
   * Set the id of a node.
   *
   * @param Element
   * @param string
   */
  _setId: function(e, id) {
    e.id = id;
  },

  /**
   * Set the name of a node.
   *
   * @param Element
   * @param string
   */
  _setName: function(e, name) {
    e.name = name;
  },

  /**
   * Set the value of a node.
   *
   * @param Element
   * @param string
   */
  _setValue: function(e, value) {
    e.value = value;
  },

  /**
   * Set the type of a node.
   *
   * @param Element
   * @param string
   */
  _setType: function(e, type) {
    e.type = type;
  },

  /**
   * Set the src of a node.
   *
   * @param Element
   * @param string
   */
  _setSrc: function(e, src) {
    e.src = src;
  },

  /**
   * Set the href of a node.
   *
   * @param Element
   * @param string
   */
  _setHref: function(e, href) {
    e.href = href;
  },

  /**
   * Set the action of a node.
   *
   * @param Element
   * @param string
   */
  _setAction: function(e, action) {
    e.action = action;
  },

  /**
   * Set the method of a node.
   *
   * @param Element
   * @param string
   */
  _setMethod: function(e, method) {
    e.method = method;
  },

  /**
   * Set the target of a node.
   *
   * @param Element
   * @param string
   */
  _setTarget: function(e, target) {
    e.target = target;
  },

  /**
   * Set the title of a node.
   *
   * @param Element
   * @param string
   */
  _setTitle: function(e, title) {
    e.title = title;
  },

  /**
   * Set the alt of a node.
   *
   * @param Element
   * @param string
   */
  _setAlt: function(e, alt) {
    e.alt = alt;
  },

  /**
   * Set the rel of a node.
   *
   * @param Element
   * @param string
   */
  _setRel: function(e, rel) {
    e.rel = rel;
  },

  /**
   * Set the selected index of a node.
   *
   * @param Element
   * @param number
   */
  _setSelectedIndex: function(e, index) {
    e.selectedIndex = index;
  },

  /**
   * Set the checked property of a node.
   *
   * @param Element
   * @param boolean
   */
  _setChecked: function(e, checked) {
    e.checked = checked;
  },

  /**
   * Set the disabled property of a node.
   *
   * @param Element
   * @param boolean
   */
  _setDisabled: function(e, disabled) {
    e.disabled = disabled;
  },

  /**
   * Set the multiple property of a node.
   *
   * @param Element
   * @param boolean
   */
  _setMultiple: function(e, multiple) {
    e.multiple = multiple;
  },

  /**
   * Set the readonly property of a node.
   *
   * @param Element
   * @param boolean
   */
  _setReadonly: function(e, readonly) {
    e.readOnly = readonly;
  },

  /**
   * Set the required property of a node.
   *
   * @param Element
   * @param boolean
   */
  _setRequired: function(e, required) {
    e.required = required;
  },

  /**
   * Set the selected property of a node.
   *
   * @param Element
   * @param boolean
   */
  _setSelected: function(e, selected) {
    e.selected = selected;
  },

  /**
   * Set the style of a node.
   *
   * @param Element
   * @param object
   */
  _setStyle: function(e, style) {
    for (var name in style) {
      e.style[name] = style[name];
    }
  },

  /**
   * Set the scroll left of a node.
   *
   * @param Element
   * @param number
   */
  _setScrollLeft: function(e, left) {
    e.scrollLeft = left;
  },

  /**
   * Set the scroll top of a node.
   *
   * @param Element
   * @param number
   */
  _setScrollTop: function(e, top) {
    e.scrollTop = top;
  },

  /**
   * Add a class to a node.
   *
   * @param Element
   * @param string
   */
  _addClass: function(e, className) {
    e.classList.add(className);
  },

  /**
   * Remove a class from a node.
   *
   * @param Element
   * @param string
   */
  _removeClass: function(e, className) {
    e.classList.remove(className);
  },

  /**
   * Toggle a class on a node.
   *
   * @param Element
   * @param string
   */
  _toggleClass: function(e, className) {
    e.classList.toggle(className);
  },

  /**
   * Check if a node has a class.
   *
   * @param Element
   * @param string
   * @return boolean
   */
  _hasClass: function(e, className) {
    return e.classList.contains(className);
  },

  /**
   * Append a child to a node.
   *
   * @param Element
   * @param Element
   */
  _appendChild: function(e, child) {
    e.appendChild(child);
  },

  /**
   * Prepend a child to a node.
   *
   * @param Element
   * @param Element
   */
  _prependChild: function(e, child) {
    e.insertBefore(child, e.firstChild);
  },

  /**
   * Insert a node before another node.
   *
   * @param Element
   * @param Element
   */
  _insertBefore: function(e, newNode) {
    e.parentNode.insertBefore(newNode, e);
  },

  /**
   * Insert a node after another node.
   *
   * @param Element
   * @param Element
   */
  _insertAfter: function(e, newNode) {
    e.parentNode.insertBefore(newNode, e.nextSibling);
  },

  /**
   * Remove a child from a node.
   *
   * @param Element
   * @param Element
   */
  _removeChild: function(e, child) {
    e.removeChild(child);
  },

  /**
   * Replace a child of a node with another node.
   *
   * @param Element
   * @param Element
   * @param Element
   */
  _replaceChild: function(e, newChild, oldChild) {
    e.replaceChild(newChild, oldChild);
  },

  /**
   * Create an element.
   *
   * @param string
   * @return Element
   */
  _createElement: function(tagName) {
    return this._doc.createElement(tagName);
  },

  /**
   * Create a text node.
   *
   * @param string
   * @return Element
   */
  _createTextNode: function(text) {
    return this._doc.createTextNode(text);
  },

  /**
   * Create a document fragment.
   *
   * @return DocumentFragment
   */
  _createDocumentFragment: function() {
    return this._doc.createDocumentFragment();
  },

  /**
   * Query a selector on a node.
   *
   * @param Element
   * @param string
   * @return Element
   */
  _querySelector: function(e, selector) {
    return e.querySelector(selector);
  },

  /**
   * Query a selector on a node.
   *
   * @param Element
   * @param string
   * @return array
   */
  _querySelectorAll: function(e, selector) {
    return e.querySelectorAll(selector);
  },

  /**
   * Get the owner document of a node.
   *
   * @param Element
   * @return Document
   */
  _getOwnerDocument: function(e) {
    return e.ownerDocument;
  },

  /**
   * Get the default view of a document.
   *
   * @param Document
   * @return Window
   */
  _getDefaultView: function(doc) {
    return doc.defaultView;
  },

  /**
   * Get the location of a window.
   *
   * @param Window
   * @return Location
   */
  _getLocation: function(win) {
    return win.location;
  },

  /**
   * Get the history of a window.
   *
   * @param Window
   * @return History
   */
  _getHistory: function(win) {
    return win.history;
  },

  /**
   * Get the navigator of a window.
   *
   * @param Window
   * @return Navigator
   */
  _getNavigator: function(win) {
    return win.navigator;
  },

  /**
   * Get the screen of a window.
   *
   * @param Window
   * @return Screen
   */
  _getScreen: function(win) {
    return win.screen;
  },

  /**
   * Get the document of a window.
   *
   * @param Window
   * @return Document
   */
  _getDocument: function(win) {
    return win.document;
  },

  /**
   * Get the body of a document.
   *
   * @param Document
   * @return Element
   */
  _getBody: function(doc) {
    return doc.body;
  },

  /**
   * Get the head of a document.
   *
   * @param Document
   * @return Element
   */
  _getHead: function(doc) {
    return doc.head;
  },

  /**
   * Get the document element of a document.
   *
   * @param Document
   * @return Element
   */
  _getDocumentElement: function(doc) {
    return doc.documentElement;
  },

  /**
   * Get the character set of a document.
   *
   * @param Document
   * @return string
   */
  _getCharacterSet: function(doc) {
    return doc.characterSet;
  },

  /**
   * Get the content type of a document.
   *
   * @param Document
   * @return string
   */
  _getContentType: function(doc) {
    return doc.contentType;
  },

  /**
   * Get the doctype of a document.
   *
   * @param Document
   * @return DocumentType
   */
  _getDoctype: function(doc) {
    return doc.doctype;
  },

  /**
   * Get the implementation of a document.
   *
   * @param Document
   * @return DOMImplementation
   */
  _getImplementation: function(doc) {
    return doc.implementation;
  },

  /**
   * Get the URL of a document.
   *
   * @param Document
   * @return string
   */
  _getURL: function(doc) {
    return doc.URL;
  },

  /**
   * Get the base URI of a document.
   *
   * @param Document
   * @return string
   */
  _getBaseURI: function(doc) {
    return doc.baseURI;
  },

  /**
   * Get the cookie of a document.
   *
   * @param Document
   * @return string
   */
  _getCookie: function(doc) {
    return doc.cookie;
  },

  /**
   * Set the cookie of a document.
   *
   * @param Document
   * @param string
   */
  _setCookie: function(doc, cookie) {
    doc.cookie = cookie;
  },

  /**
   * Get the design mode of a document.
   *
   * @param Document
   * @return string
   */
  _getDesignMode: function(doc) {
    return doc.designMode;
  },

  /**
   * Set the design mode of a document.
   *
   * @param Document
   * @param string
   */
  _setDesignMode: function(doc, mode) {
    doc.designMode = mode;
  },

  /**
   * Get the domain of a document.
   *
   * @param Document
   * @return string
   */
  _getDomain: function(doc) {
    return doc.domain;
  },

  /**
   * Set the domain of a document.
   *
   * @param Document
   * @param string
   */
  _setDomain: function(doc, domain) {
    doc.domain = domain;
  },

  /**
   * Get the last modified date of a document.
   *
   * @param Document
   * @return string
   */
  _getLastModified: function(doc) {
    return doc.lastModified;
  },

  /**
   * Get the ready state of a document.
   *
   * @param Document
   * @return string
   */
  _getReadyState: function(doc) {
    return doc.readyState;
  },

  /**
   * Get the referrer of a document.
   *
   * @param Document
   * @return string
   */
  _getReferrer: function(doc) {
    return doc.referrer;
  },

  /**
   * Get the title of a document.
   *
   * @param Document
   * @return string
   */
  _getDocTitle: function(doc) {
    return doc.title;
  },

  /**
   * Set the title of a document.
   *
   * @param Document
   * @param string
   */
  _setDocTitle: function(doc, title) {
    doc.title = title;
  },

  /**
   * Close a document.
   *
   * @param Document
   */
  _close: function(doc) {
    doc.close();
  },

  /**
   * Open a document.
   *
   * @param Document
   * @return Document
   */
  _open: function(doc) {
    return doc.open();
  },

  /**
   * Write to a document.
   *
   * @param Document
   * @param string
   */
  _write: function(doc, text) {
    doc.write(text);
  },

  /**
   * Write a line to a document.
   *
   * @param Document
   * @param string
   */
  _writeln: function(doc, text) {
    doc.writeln(text);
  },

  /**
   * Get an element by id.
   *
   * @param Document
   * @param string
   * @return Element
   */
  _getElementById: function(doc, id) {
    return doc.getElementById(id);
  },

  /**
   * Get elements by class name.
   *
   * @param Document
   * @param string
   * @return array
   */
  _getElementsByClassName: function(doc, className) {
    return doc.getElementsByClassName(className);
  },

  /**
   * Get elements by name.
   *
   * @param Document
   * @param string
   * @return array
   */
  _getElementsByName: function(doc, name) {
    return doc.getElementsByName(name);
  },

  /**
   * Get elements by tag name.
   *
   * @param Document
   * @param string
   * @return array
   */
  _getElementsByTagName: function(doc, tagName) {
    return doc.getElementsByTagName(tagName);
  },

  /**
   * Get elements by tag name and namespace.
   *
   * @param Document
   * @param string
   * @param string
   * @return array
   */
  _getElementsByTagNameNS: function(doc, namespace, tagName) {
    return doc.getElementsByTagNameNS(namespace, tagName);
  },

  /**
   * Add an event listener to a node.
   *
   * @param Element
   * @param string
   * @param function
   * @param boolean
   */
  _addEventListener: function(e, type, listener, useCapture) {
    e.addEventListener(type, listener, useCapture);
  },

  /**
   * Remove an event listener from a node.
   *
   * @param Element
   * @param string
   * @param function
   * @param boolean
   */
  _removeEventListener: function(e, type, listener, useCapture) {
    e.removeEventListener(type, listener, useCapture);
  },

  /**
   * Dispatch an event on a node.
   *
   * @param Element
   * @param Event
   * @return boolean
   */
  _dispatchEvent: function(e, event) {
    return e.dispatchEvent(event);
  },

  /**
   * Create an event.
   *
   * @param string
   * @return Event
   */
  _createEvent: function(type) {
    return this._doc.createEvent(type);
  },

  /**
   * Create a custom event.
   *
   * @param string
   * @param object
   * @return CustomEvent
   */
  _createCustomEvent: function(type, detail) {
    return new CustomEvent(type, detail);
  },

  /**
   * Create a mouse event.
   *
   * @param string
   * @param boolean
   * @param boolean
   * @param Window
   * @param number
   * @param number
   * @param number
   * @param number
   * @param number
   * @param boolean
   * @param boolean
   * @param boolean
   * @param boolean
   * @param number
   * @param Element
   * @return MouseEvent
   */
  _createMouseEvent: function(type, canBubble, cancelable, view, detail, screenX, screenY, clientX, clientY, ctrlKey, altKey, shiftKey, metaKey, button, relatedTarget) {
    var event = this._doc.createEvent("MouseEvents");
    event.initMouseEvent(type, canBubble, cancelable, view, detail, screenX, screenY, clientX, clientY, ctrlKey, altKey, shiftKey, metaKey, button, relatedTarget);
    return event;
  },

  /**
   * Create a keyboard event.
   *
   * @param string
   * @param boolean
   * @param boolean
   * @param Window
   * @param string
   * @param number
   * @param boolean
   * @param boolean
   * @param boolean
   * @param boolean
   * @return KeyboardEvent
   */
  _createKeyboardEvent: function(type, canBubble, cancelable, view, key, location, ctrlKey, altKey, shiftKey, metaKey) {
    var event = this._doc.createEvent("KeyboardEvent");
    event.initKeyboardEvent(type, canBubble, cancelable, view, key, location, ctrlKey, altKey, shiftKey, metaKey);
    return event;
  },

  /**
   * Create a UI event.
   *
   * @param string
   * @param boolean
   * @param boolean
   * @param Window
   * @param number
   * @return UIEvent
   */
  _createUIEvent: function(type, canBubble, cancelable, view, detail) {
    var event = this._doc.createEvent("UIEvents");
    event.initUIEvent(type, canBubble, cancelable, view, detail);
    return event;
  },

  /**
   * Create a mutation event.
   *
   * @param string
   * @param boolean
   * @param boolean
   * @param Node
   * @param string
   * @param string
   * @param string
   * @param number
   * @return MutationEvent
   */
  _createMutationEvent: function(type, canBubble, cancelable, relatedNode, prevValue, newValue, attrName, attrChange) {
    var event = this._doc.createEvent("MutationEvents");
    event.initMutationEvent(type, canBubble, cancelable, relatedNode, prevValue, newValue, attrName, attrChange);
    return event;
  },

  /**
   * Create a focus event.
   *
   * @param string
   * @param boolean
   * @param boolean
   * @param Window
   * @param number
   * @param Element
   * @return FocusEvent
   */
  _createFocusEvent: function(type, canBubble, cancelable, view, detail, relatedTarget) {
    var event = this._doc.createEvent("FocusEvent");
    event.initFocusEvent(type, canBubble, cancelable, view, detail, relatedTarget);
    return event;
  },

  /**
   * Create a touch event.
   *
   * @param string
   * @param boolean
   * @param boolean
   * @param Window
   * @param number
   * @param boolean
   * @param boolean
   * @param boolean
   * @param boolean
   * @param TouchList
   * @param TouchList
   * @param TouchList
   * @return TouchEvent
   */
  _createTouchEvent: function(type, canBubble, cancelable, view, detail, ctrlKey, altKey, shiftKey, metaKey, touches, targetTouches, changedTouches) {
    var event = this._doc.createEvent("TouchEvent");
    event.initTouchEvent(type, canBubble, cancelable, view, detail, ctrlKey, altKey, shiftKey, metaKey, touches, targetTouches, changedTouches);
    return event;
  },

  /**
   * Create a touch.
   *
   * @param Window
   * @param Element
   * @param number
   * @param number
   * @param number
   * @param number
   * @param number
   * @return Touch
   */
  _createTouch: function(view, target, identifier, pageX, pageY, screenX, screenY) {
    return this._doc.createTouch(view, target, identifier, pageX, pageY, screenX, screenY);
  },

  /**
   * Create a touch list.
   *
   * @param Touch...
   * @return TouchList
   */
  _createTouchList: function() {
    return this._doc.createTouchList.apply(this._doc, arguments);
  },

  /**
   * Get the selection of a window.
   *
   * @param Window
   * @return Selection
   */
  _getSelection: function(win) {
    return win.getSelection();
  },

  /**
   * Get the anchor node of a selection.
   *
   * @param Selection
   * @return Node
   */
  _getAnchorNode: function(selection) {
    return selection.anchorNode;
  },

  /**
   * Get the anchor offset of a selection.
   *
   * @param Selection
   * @return number
   */
  _getAnchorOffset: function(selection) {
    return selection.anchorOffset;
  },

  /**
   * Get the focus node of a selection.
   *
   * @param Selection
   * @return Node
   */
  _getFocusNode: function(selection) {
    return selection.focusNode;
  },

  /**
   * Get the focus offset of a selection.
   *
   * @param Selection
   * @return number
   */
  _getFocusOffset: function(selection) {
    return selection.focusOffset;
  },

  /**
   * Get the isCollapsed property of a selection.
   *
   * @param Selection
   * @return boolean
   */
  _getIsCollapsed: function(selection) {
    return selection.isCollapsed;
  },

  /**
   * Get the range count of a selection.
   *
   * @param Selection
   * @return number
   */
  _getRangeCount: function(selection) {
    return selection.rangeCount;
  },

  /**
   * Get a range from a selection.
   *
   * @param Selection
   * @param number
   * @return Range
   */
  _getRangeAt: function(selection, index) {
    return selection.getRangeAt(index);
  },

  /**
   * Collapse a selection.
   *
   * @param Selection
   * @param Node
   * @param number
   */
  _collapse: function(selection, node, offset) {
    selection.collapse(node, offset);
  },

  /**
   * Collapse a selection to the start.
   *
   * @param Selection
   */
  _collapseToStart: function(selection) {
    selection.collapseToStart();
  },

  /**
   * Collapse a selection to the end.
   *
   * @param Selection
   */
  _collapseToEnd: function(selection) {
    selection.collapseToEnd();
  },

  /**
   * Extend a selection.
   *
   * @param Selection
   * @param Node
   * @param number
   */
  _extend: function(selection, node, offset) {
    selection.extend(node, offset);
  },

  /**
   * Select all children of a node.
   *
   * @param Selection
   * @param Node
   */
  _selectAllChildren: function(selection, node) {
    selection.selectAllChildren(node);
  },

  /**
   * Add a range to a selection.
   *
   * @param Selection
   * @param Range
   */
  _addRange: function(selection, range) {
    selection.addRange(range);
  },

  /**
   * Remove a range from a selection.
   *
   * @param Selection
   * @param Range
   */
  _removeRange: function(selection, range) {
    selection.removeRange(range);
  },

  /**
   * Remove all ranges from a selection.
   *
   * @param Selection
   */
  _removeAllRanges: function(selection) {
    selection.removeAllRanges();
  },

  /**
   * Delete from a document.
   *
   * @param Selection
   */
  _deleteFromDocument: function(selection) {
    selection.deleteFromDocument();
  },

  /**
   * Get the string representation of a selection.
   *
   * @param Selection
   * @return string
   */
  _getSelectionString: function(selection) {
    return selection.toString();
  },

  /**
   * Create a range.
   *
   * @return Range
   */
  _createRange: function() {
    return this._doc.createRange();
  },

  /**
   * Get the start container of a range.
   *
   * @param Range
   * @return Node
   */
  _getStartContainer: function(range) {
    return range.startContainer;
  },

  /**
   * Get the start offset of a range.
   *
   * @param Range
   * @return number
   */
  _getStartOffset: function(range) {
    return range.startOffset;
  },

  /**
   * Get the end container of a range.
   *
   * @param Range
   * @return Node
   */
  _getEndContainer: function(range) {
    return range.endContainer;
  },

  /**
   * Get the end offset of a range.
   *
   * @param Range
   * @return number
   */
  _getEndOffset: function(range) {
    return range.endOffset;
  },

  /**
   * Get the collapsed property of a range.
   *
   * @param Range
   * @return boolean
   */
  _getCollapsed: function(range) {
    return range.collapsed;
  },

  /**
   * Get the common ancestor container of a range.
   *
   * @param Range
   * @return Node
   */
  _getCommonAncestorContainer: function(range) {
    return range.commonAncestorContainer;
  },

  /**
   * Set the start of a range.
   *
   * @param Range
   * @param Node
   * @param number
   */
  _setStart: function(range, node, offset) {
    range.setStart(node, offset);
  },

  /**
   * Set the end of a range.
   *
   * @param Range
   * @param Node
   * @param number
   */
  _setEnd: function(range, node, offset) {
    range.setEnd(node, offset);
  },

  /**
   * Set the start of a range before a node.
   *
   * @param Range
   * @param Node
   */
  _setStartBefore: function(range, node) {
    range.setStartBefore(node);
  },

  /**
   * Set the start of a range after a node.
   *
   * @param Range
   * @param Node
   */
  _setStartAfter: function(range, node) {
    range.setStartAfter(node);
  },

  /**
   * Set the end of a range before a node.
   *
   * @param Range
   * @param Node
   */
  _setEndBefore: function(range, node) {
    range.setEndBefore(node);
  },

  /**
   * Set the end of a range after a node.
   *
   * @param Range
   * @param Node
   */
  _setEndAfter: function(range, node) {
    range.setEndAfter(node);
  },

  /**
   * Collapse a range.
   *
   * @param Range
   * @param boolean
   */
  _collapseRange: function(range, toStart) {
    range.collapse(toStart);
  },

  /**
   * Select a node in a range.
   *
   * @param Range
   * @param Node
   */
  _selectNode: function(range, node) {
    range.selectNode(node);
  },

  /**
   * Select the contents of a node in a range.
   *
   * @param Range
   * @param Node
   */
  _selectNodeContents: function(range, node) {
    range.selectNodeContents(node);
  },

  /**
   * Compare the boundary points of two ranges.
   *
   * @param Range
   * @param number
   * @param Range
   * @param number
   * @return number
   */
  _compareBoundaryPoints: function(range, how, sourceRange) {
    return range.compareBoundaryPoints(how, sourceRange);
  },

  /**
   * Delete the contents of a range.
   *
   * @param Range
   */
  _deleteContents: function(range) {
    range.deleteContents();
  },

  /**
   * Extract the contents of a range.
   *
   * @param Range
   * @return DocumentFragment
   */
  _extractContents: function(range) {
    return range.extractContents();
  },

  /**
   * Clone the contents of a range.
   *
   * @param Range
   * @return DocumentFragment
   */
  _cloneContents: function(range) {
    return range.cloneContents();
  },

  /**
   * Insert a node into a range.
   *
   * @param Range
   * @param Node
   */
  _insertNode: function(range, node) {
    range.insertNode(node);
  },

  /**
   * Surround the contents of a range with a node.
   *
   * @param Range
   * @param Node
   */
  _surroundContents: function(range, node) {
    range.surroundContents(node);
  },

  /**
   * Clone a range.
   *
   * @param Range
   * @return Range
   */
  _cloneRange: function(range) {
    return range.cloneRange();
  },

  /**
   * Detach a range.
   *
   * @param Range
   */
  _detach: function(range) {
    range.detach();
  },

  /**
   * Get the string representation of a range.
   *
   * @param Range
   * @return string
   */
  _getRangeString: function(range) {
    return range.toString();
  },

  /**
   * Compare a node to a range.
   *
   * @param Range
   * @param Node
   * @return number
   */
  _compareNode: function(range, node) {
    return range.compareNode(node);
  },

  /**
   * Check if a node is intersected by a range.
   *
   * @param Range
   * @param Node
   * @return boolean
   */
  _intersectsNode: function(range, node) {
    return range.intersectsNode(node);
  },

  /**
   * Check if a point is in a range.
   *
   * @param Range
   * @param Node
   * @param number
   * @return boolean
   */
  _isPointInRange: function(range, node, offset) {
    return range.isPointInRange(node, offset);
  },

  /**
   * Compare a point to a range.
   *
   * @param Range
   * @param Node
   * @param number
   * @return number
   */
  _comparePoint: function(range, node, offset) {
    return range.comparePoint(node, offset);
  },

  /**
   * Create a context from a range.
   *
   * @param Range
   * @return DocumentFragment
   */
  _createContextualFragment: function(range, html) {
    return range.createContextualFragment(html);
  },

  /**
   * Get the bounding client rect of a range.
   *
   * @param Range
   * @return ClientRect
   */
  _getRangeBoundingClientRect: function(range) {
    return range.getBoundingClientRect();
  },

  /**
   * Get the client rects of a range.
   *
   * @param Range
   * @return ClientRectList
   */
  _getRangeClientRects: function(range) {
    return range.getClientRects();
  },

  /**
   * Check if a node is a candidate.
   *
   * @param Node
   * @return boolean
   */
  _isCandidate: function(node) {
    if (!node.parentNode) {
      return false;
    }
    if (!node.textContent.trim()) {
      return false;
    }
    if (this._isElementWithoutContent(node)) {
      return false;
    }
    var score = this._getScore(node);
    if (score.positive < 25) {
      return false;
    }
    var linkDensity = this._getLinkDensity(node);
    if (linkDensity > 0.5) {
      return false;
    }
    var textDensity = this._getTextDensity(node);
    if (textDensity < 0.2) {
      return false;
    }
    return true;
  },

  /**
   * Find the article in a document.
   *
   * @param Document
   * @return Element
   */
  _findArticle: function(doc) {
    var body = this._getBody(doc);
    if (!body) {
      return null;
    }
    var candidates = [];
    var nodes = this._getElementsByTagName(body, "*");
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (this._isCandidate(node)) {
        candidates.push(node);
      }
    }
    if (candidates.length === 0) {
      return null;
    }
    var bestCandidate = candidates[0];
    var bestScore = this._getScore(bestCandidate).positive;
    for (var i = 1; i < candidates.length; i++) {
      var candidate = candidates[i];
      var score = this._getScore(candidate).positive;
      if (score > bestScore) {
        bestCandidate = candidate;
        bestScore = score;
      }
    }
    return bestCandidate;
  },

  /**
   * Clean an element.
   *
   * @param Element
   */
  _clean: function(e) {
    var self = this;
    var cleanConditionally = function(e, tag) {
      if (!e.parentNode) {
        return;
      }
      var tags = self._getElementsByTagName(e, tag);
      for (var i = tags.length - 1; i >= 0; i--) {
        var t = tags[i];
        if (self._isElementWithoutContent(t)) {
          self._removeNode(t);
        }
      }
    };
    cleanConditionally(e, "h1");
    cleanConditionally(e, "h2");
    cleanConditionally(e, "h3");
    cleanConditionally(e, "h4");
    cleanConditionally(e, "h5");
    cleanConditionally(e, "h6");
    cleanConditionally(e, "p");
    cleanConditionally(e, "td");
    cleanConditionally(e, "pre");
    cleanConditionally(e, "div");
  },

  /**
   * Clean the styles of an element.
   *
   * @param Element
   */
  _cleanStyles: function(e) {
    if (!e) {
      return;
    }
    e.removeAttribute("style");
    var children = this._getChildren(e);
    for (var i = 0; i < children.length; i++) {
      this._cleanStyles(children[i]);
    }
  },

  /**
   * Mark data tables.
   *
   * @param Element
   */
  _markDataTables: function(e) {
    var tables = this._getElementsByTagName(e, "table");
    for (var i = 0; i < tables.length; i++) {
      var table = tables[i];
      var rows = this._getElementsByTagName(table, "tr");
      if (rows.length === 0) {
        continue;
      }
      var header = this._getElementsByTagName(rows[0], "th");
      if (header.length === 0) {
        continue;
      }
      var data = [];
      for (var j = 1; j < rows.length; j++) {
        var row = rows[j];
        var cells = this._getElementsByTagName(row, "td");
        if (cells.length !== header.length) {
          continue;
        }
        var rowData = {};
        for (var k = 0; k < header.length; k++) {
          rowData[this._getText(header[k])] = this._getText(cells[k]);
        }
        data.push(rowData);
      }
      if (data.length > 0) {
        table.setAttribute("data-is-data-table", "true");
      }
    }
  },

  /**
   * Fix relative URIs.
   *
   * @param Element
   */
  _fixRelativeUris: function(e) {
    var links = this._getElementsByTagName(e, "a");
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      if (link.hasAttribute("href")) {
        link.href = link.href;
      }
    }
    var imgs = this._getElementsByTagName(e, "img");
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (img.hasAttribute("src")) {
        img.src = img.src;
      }
    }
  },

  /**
   * Concat a list of nodes.
   *
   * @param NodeList...
   * @return array
   */
  _concatNodeList: function() {
    var result = [];
    for (var i = 0; i < arguments.length; i++) {
      var nodeList = arguments[i];
      for (var j = 0; j < nodeList.length; j++) {
        result.push(nodeList[j]);
      }
    }
    return result;
  },

  /**
   * Get the article content.
   *
   * @return object with "title", "byline", "dir", "content" and "textContent" properties
   */
  parse: function() {
    // Avoid parsing too large documents, as per configuration
    if (this._maxElemsToParse > 0) {
      var numPlusMax = this._doc.getElementsByTagName("*").length - this._maxElemsToParse;
      if (numPlusMax > 0) {
        this._log("Aborting parsing document; " + numPlusMax + " elements found over max (" + this._maxElemsToParse + ")");
        return null;
      }
    }

    //
    // Before we do anything, remove all scripts that are not JSON-LD.
    var scripts = this._doc.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      var script = scripts[i];
      if (script.type !== "application/ld+json") {
        this._removeNode(script);
      }
    }

    // Remove all noscript tags.
    var noscripts = this._doc.getElementsByTagName("noscript");
    for (var i = noscripts.length - 1; i >= 0; i--) {
      this._removeNode(noscripts[i]);
    }

    // Remove all style tags.
    var styles = this._doc.getElementsByTagName("style");
    for (var i = styles.length - 1; i >= 0; i--) {
      this._removeNode(styles[i]);
    }

    // Remove all links.
    var links = this._doc.getElementsByTagName("link");
    for (var i = links.length - 1; i >= 0; i--) {
      this._removeNode(links[i]);
    }

    // Remove all comments.
    var comments = this._doc.childNodes;
    for (var i = comments.length - 1; i >= 0; i--) {
      var comment = comments[i];
      if (comment.nodeType === 8) {
        this._removeNode(comment);
      }
    }

    this._prepDocument();
    var metadata = this._getArticleMetadata();
    this._articleTitle = metadata.title || this._getArticleTitle();
    this._articleByline = metadata.byline || metadata.author;
    this._articleDir = this._getArticleDirection();
    this._articleSiteName = metadata.siteName;

    var articleContent = this._grabArticle();
    if (!articleContent)
      return null;

    this._log("Grabbed: " + articleContent.innerHTML);

    this._postProcessContent(articleContent);

    // If we haven't found a good title, try to guess it.
    if (!this._articleTitle) {
      var h1s = articleContent.getElementsByTagName("h1");
      if (h1s.length > 0)
        this._articleTitle = this._getInnerText(h1s[0]);
    }

    // If we still don't have a title, use the document title.
    if (!this._articleTitle)
      this._articleTitle = this._doc.title;

    // If we have a byline, prepend it to the article content.
    if (this._articleByline) {
      var byline = this._doc.createElement("div");
      byline.className = "byline";
      byline.innerHTML = this._articleByline;
      articleContent.insertBefore(byline, articleContent.firstChild);
    }

    return {
      title: this._articleTitle,
      byline: this._articleByline,
      dir: this._articleDir,
      content: articleContent.innerHTML,
      textContent: articleContent.textContent,
      length: articleContent.textContent.length,
      siteName: this._articleSiteName
    };
  },

  /**
   * Get the article direction.
   *
   * @return string
   */
  _getArticleDirection: function() {
    var dir = "";
    var html = this._doc.getElementsByTagName("html")[0];
    if (html) {
      dir = html.getAttribute("dir");
    }
    return dir;
  }
};

if (typeof module === "object") {
  module.exports = Readability;
}
