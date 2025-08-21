// Nation Assistant LLM Service - Crestal Network Integration
'use strict';

// Enable comprehensive logging for debugging - disable in production
const DEBUG = false;
const logger = {
  log: (message, ...args) => {
    if (DEBUG) console.log(`[LLMService] ${message}`, ...args);
  },
  warn: (message, ...args) => {
    if (DEBUG) console.warn(`[LLMService] ${message}`, ...args);
  },
  error: (message, ...args) => {
    if (DEBUG) console.error(`[LLMService] ${message}`, ...args);
  },
  debug: (message, ...args) => {
    if (DEBUG) console.debug(`[LLMService] ${message}`, ...args);
  }
};

class LLMService {
  constructor() {
    this.apiKey = null;
    this.model = 'gpt-4.1-nano';
    this.maxTokens = 300;
    this.temperature = 0.7;
    this.baseUrl = 'https://open.service.crestal.network/v1';
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      await this.loadSettings();
      this.initialized = true;
    } catch (error) {
      logger.warn('LLM service initialization failed:', error.message);
    }
  }

  async initWithConfig(config) {
    if (!config.apiKey?.trim()) {
      throw new Error('No API key provided in test configuration');
    }
    this.apiKey = config.apiKey.trim();
    this.baseUrl = config.baseUrl?.trim() || 'https://open.service.crestal.network/v1';
    this.model = config.model || 'gpt-4.1-nano';
    this.maxTokens = config.maxTokens || 300;
    this.temperature = config.temperature || 0.7;
    this.initialized = true;
  }

  async loadSettings() {
    const result = await chrome.storage.sync.get(['crestalApiKey', 'apiBaseUrl']);
    if (!result.crestalApiKey?.trim()) {
      throw new Error('No Crestal API key configured');
    }
    this.apiKey = result.crestalApiKey.trim();
    this.model = 'gpt-4.1-nano';
    this.maxTokens = 300;
    this.temperature = 0.7;
    this.baseUrl = result.apiBaseUrl?.trim() || 'https://open.service.crestal.network/v1';
  }

  async makeRequest(messages, options = {}) {
    if (!this.apiKey) throw new Error('API key not configured');

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          max_tokens: options.maxTokens || this.maxTokens,
          temperature: options.temperature || this.temperature,
        })
      });

      if (!response.ok) {
        // Secure error handling - don't expose sensitive data
        let errorMessage = 'Request failed';

        try {
          const errorData = await response.json();
          // Only use safe error messages, avoid exposing API details
          if (response.status === 401) {
            errorMessage = 'Invalid API key or authentication failed';
          } else if (response.status === 429) {
            errorMessage = 'Rate limit exceeded. Please try again later';
          } else if (response.status === 403) {
            errorMessage = 'Access forbidden. Check your API permissions';
          } else if (response.status >= 500) {
            errorMessage = 'Service temporarily unavailable';
          } else if (errorData.error?.message && !this.containsSensitiveData(errorData.error.message)) {
            errorMessage = errorData.error.message;
          }
        } catch (parseError) {
          // If we can't parse the error, use generic message
          logger.warn('Failed to parse error response');
        }

        throw new Error(`API Error (${response.status}): ${errorMessage}`);
      }

      const data = await response.json();
      if (!data.choices?.[0]?.message?.content) {
        throw new Error('Invalid API response format');
      }

      return data.choices[0].message.content;
    } catch (error) {
      // Sanitize error before re-throwing
      if (error.message && this.containsSensitiveData(error.message)) {
        throw new Error('API request failed. Please check your configuration.');
      }
      throw error;
    }
  }

  /**
   * Check if error message contains sensitive data that should not be exposed
   */
  containsSensitiveData(message) {
    const sensitivePatterns = [
      /Bearer\s+[A-Za-z0-9\-_]+/i, // Bearer tokens
      /api[_-]?key/i, // API key references
      /token/i, // Token references
      /authorization/i, // Authorization headers
      /sk-[A-Za-z0-9]+/i, // OpenAI-style keys
      /[A-Za-z0-9]{32,}/i // Long alphanumeric strings (potential keys)
    ];

    return sensitivePatterns.some(pattern => pattern.test(message));
  }

  /**
   * Process and format AI response to natural language
   */
  formatResponse(rawResponse) {
    try {
      const trimmed = typeof rawResponse === 'string' ? rawResponse.trim() : '';
      const looksJson = (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
      if (!looksJson) {
        return rawResponse;
      }
      const jsonResponse = JSON.parse(trimmed);

      if (jsonResponse.page_overview) {
        let formatted = jsonResponse.page_overview;

        if (jsonResponse.key_features && jsonResponse.key_features.length > 0) {
          formatted += `\n\nKey features include: ${jsonResponse.key_features.join(', ')}.`;
        }

        if (jsonResponse.target_audience) {
          formatted += `\n\nThis appears to be aimed at ${jsonResponse.target_audience.toLowerCase()}.`;
        }

        if (jsonResponse.call_to_action) {
          formatted += `\n\n${jsonResponse.call_to_action}`;
        }

        return formatted;
      }

      if (typeof jsonResponse === 'object') {
        return Object.values(jsonResponse).join(' ');
      }

      return rawResponse;
    } catch (error) {
      return rawResponse;
    }
  }

  /**
   * Chat with webpage content using simple query + page content
   */
  async chatWithPage(pageContent, userQuery = "", metadata = {}) {
    const finalQuery = userQuery && userQuery.trim() !== ""
      ? userQuery
      : "What is this page about? Give me a brief overview.";

    const metaParts = [];
    try {
      if (metadata && typeof metadata === 'object') {
        if (metadata.title) metaParts.push(`Title: ${metadata.title}`);
        if (metadata.url) metaParts.push(`URL: ${metadata.url}`);
      }
    } catch (_) {}
    const metaBlock = metaParts.length ? `Metadata:\n- ${metaParts.join('\n- ')}\n\n` : "";

    // Focused selection block (if provided)
    const selected = typeof metadata?.selectedText === 'string' && metadata.selectedText.trim().length > 0
      ? metadata.selectedText.trim()
      : null;
    const selectionBlock = selected ? `\n\nFocused selection (treat as primary context):\n"""\n${selected}\n"""\n` : '';

    const messages = [
      {
        role: 'system',
        content: `You read web pages and answer questions. Infer the page type and adapt structure and tone to the content and the user's question.

If a focused selection is provided, prioritize it over the rest of the page content when answering.

Return format:
- Use well-structured Markdown: short headings, bullet lists, and tables when useful.
- When appropriate, include a "Guidelines" or "Recommendations" section tailored to the user's question and the page.
- Include only sections that add value; avoid rigid templates and emojis.
 - Do not include JSON or code-fenced JSON blocks. Return only concise Markdown.

Default to English unless explicitly requested otherwise.`
      },
      {
        role: 'user',
        content: `${metaBlock}Question: ${finalQuery}${selectionBlock}\nWebpage content:\n${pageContent}`
      }
    ];

    const rawResponse = await this.makeRequest(messages, { maxTokens: 600 });
    return this.formatResponse(rawResponse);
  }

  /**
   * Smart translate - auto-detect source language and choose best target
   */
  async smartTranslate(text) {
    const messages = [
      {
        role: 'user',
        content: `You are a professional translator. Analyze this text and:
1. Detect the source language
2. Choose the most appropriate target language (English if source is non-English, or Spanish/French if source is English)
3. Provide an accurate translation

Respond in this exact JSON format:
{
  "detectedLanguage": "detected language name",
  "targetLanguage": "target language name", 
  "translation": "translated text"
}

Text to analyze and translate:
${text}`
      }
    ];

    const response = await this.makeRequest(messages, { maxTokens: 600 });

    try {
      const parsed = JSON.parse(response.trim());
      return {
        detectedLanguage: parsed.detectedLanguage,
        targetLanguage: parsed.targetLanguage,
        translation: parsed.translation
      };
    } catch (error) {
      // Fallback if JSON parsing fails
      return {
        detectedLanguage: 'Unknown',
        targetLanguage: 'English',
        translation: response.trim()
      };
    }
  }

  /**
   * Translate text to target language
   */
  async translateText(text, targetLanguage) {
    const messages = [
      {
        role: 'user',
        content: `You are a professional translator. Translate the following text accurately to ${targetLanguage}. Only provide the translation, no explanations or additional text. Maintain the original tone and meaning.

Text to translate:
${text}`
      }
    ];

    const translation = await this.makeRequest(messages, { maxTokens: 500 });
    return translation.trim();
  }

  /**
   * Summarize page content with adaptive structure and tone
   */
  async summarizePage(pageContent, metadata = {}) {
    const metaParts = [];
    try {
      if (metadata && typeof metadata === 'object') {
        if (metadata.title) metaParts.push(`Title: ${metadata.title}`);
        if (metadata.url) metaParts.push(`URL: ${metadata.url}`);
      }
    } catch (_) {}
    const metaBlock = metaParts.length ? `Metadata:\n- ${metaParts.join('\n- ')}\n\n` : "";

    const messages = [
      {
        role: 'system',
        content: `You summarize web pages. Infer the page type and adapt structure and tone accordingly. Provide a concise overview, then include only the most helpful sections (e.g., key points, steps, metrics, risks, next steps).

Return format:
- Use well-structured Markdown with clear headings and bullet lists.
- Include a short "Guidelines" or "Next Steps" section when helpful, tailored to the page and the reader's likely goal.
- Avoid rigid templates and emojis; include only sections that add value.
 - Do not include JSON or code-fenced JSON blocks. Return only concise Markdown.

Default to English unless requested otherwise.`
      },
      {
        role: 'user',
        content: `${metaBlock}Summarize this page for a busy reader:\n${pageContent}`
      }
    ];

    const summary = await this.makeRequest(messages, { maxTokens: 500 });
    return summary.trim();
  }

  /**
   * Extract key insights with adaptive grouping and tone
   */
  async listKeyPoints(pageContent, metadata = {}) {
    const metaParts = [];
    try {
      if (metadata && typeof metadata === 'object') {
        if (metadata.title) metaParts.push(`Title: ${metadata.title}`);
        if (metadata.url) metaParts.push(`URL: ${metadata.url}`);
      }
    } catch (_) {}
    const metaBlock = metaParts.length ? `Metadata:\n- ${metaParts.join('\n- ')}\n\n` : "";

    const messages = [
      {
        role: 'system',
        content: `You extract the most important insights and actions from content. Adapt structure and tone to the page. Return only the most valuable items; group related items under short headings when helpful. Prefer concrete facts, metrics, decisions, and actionable steps present in the page. Avoid speculation and rigid counts.

Return format:
- Use well-structured Markdown with brief headings and bullet points.
- Include a "Guidelines/Actions" section when applicable.
 - Do not include JSON or code-fenced JSON blocks. Return only concise Markdown.

Default to English unless requested otherwise.`
      },
      {
        role: 'user',
        content: `${metaBlock}From this page, highlight the key insights and actions:\n${pageContent}`
      }
    ];

    const keyPoints = await this.makeRequest(messages, { maxTokens: 600 });
    return keyPoints.trim();
  }

  /**
   * Analyze page content with flexible, professional structure and tone
   */
  async analyzePage(pageContent, metadata = {}) {
    const metaParts = [];
    try {
      if (metadata && typeof metadata === 'object') {
        if (metadata.title) metaParts.push(`Title: ${metadata.title}`);
        if (metadata.url) metaParts.push(`URL: ${metadata.url}`);
      }
    } catch (_) {}
    const metaBlock = metaParts.length ? `Metadata:\n- ${metaParts.join('\n- ')}\n\n` : "";

    const messages = [
      {
        role: 'system',
        content: `You analyze web content. Infer the context and adapt structure and tone to the page. Provide a concise, professional analysis with only sections that add value.

Return format:
- Use well-structured Markdown with clear headings and bullet lists.
- Include a "Guidelines" or "Recommendations" section for the reader when appropriate.
- Avoid emojis and rigid templates.
 - Do not include JSON or code-fenced JSON blocks. Return only concise Markdown.

Default to English unless requested otherwise.`
      },
      {
        role: 'user',
        content: `${metaBlock}Analyze this page:\n${pageContent}`
      }
    ];

    const analysis = await this.makeRequest(messages, { maxTokens: 700 });
    return analysis.trim();
  }
}

// Export for background script
export { LLMService };