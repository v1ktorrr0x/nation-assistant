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
      const jsonResponse = JSON.parse(rawResponse);

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
   * Chat with webpage content using a single optimized prompt with enhanced context
   */
  async chatWithPage(pageContent, userQuery = "", chatHistory = []) {
    const finalQuery = userQuery.trim() === ""
      ? "What is this page about? Give me a brief overview."
      : userQuery;

    // Build enhanced prompt with conversation history context
    const contextualPrompt = this.buildContextualPrompt(finalQuery, pageContent, chatHistory);

    const messages = [
      {
        role: 'system',
        content: `You are a helpful web content assistant. Always respond in English. Answer questions about web pages naturally and conversationally. Keep responses concise unless the user asks for detailed information.`
      },
      {
        role: 'user',
        content: contextualPrompt
      }
    ];

    const rawResponse = await this.makeRequest(messages);
    return this.formatResponse(rawResponse);
  }

  /**
   * Build a contextual prompt that includes conversation history for better continuity
   */
  buildContextualPrompt(currentQuery, pageContent, chatHistory) {
    let prompt = '';

    // Add conversation context if exists
    if (chatHistory.length > 0) {
      prompt += `**CONVERSATION CONTEXT:**\n`;
      
      // Get last 4 messages (2 exchanges) for context
      const recentHistory = chatHistory.slice(-4);
      
      recentHistory.forEach((msg) => {
        const role = msg.role === 'user' ? 'My previous question' : 'Your previous response';
        prompt += `${role}: ${msg.content}\n`;
      });
      
      prompt += `\n**CURRENT QUESTION:** ${currentQuery}\n\n`;
      prompt += `Please answer my current question while considering our previous conversation. `;
      prompt += `If my current question relates to something we discussed before, reference that context appropriately.\n\n`;
    } else {
      prompt += `**QUESTION:** ${currentQuery}\n\n`;
    }

    prompt += `**WEBPAGE CONTENT:**\n${pageContent}`;

    return prompt;
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
}

// Export for background script
export { LLMService };