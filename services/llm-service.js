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
   * Chat with webpage content using simple query + page content
   */
  async chatWithPage(pageContent, userQuery = "") {
    const finalQuery = userQuery.trim() === ""
      ? "What is this page about? Give me a brief overview."
      : userQuery;

    const messages = [
      {
        role: 'system',
        content: `You are a helpful web content assistant. Always respond in English. Answer questions about web pages naturally and conversationally. Keep responses concise unless the user asks for detailed information.`
      },
      {
        role: 'user',
        content: `**QUESTION:** ${finalQuery}

**WEBPAGE CONTENT:**
${pageContent}`
      }
    ];

    const rawResponse = await this.makeRequest(messages);
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
   * Summarize page content with specialized prompt
   */
  async summarizePage(pageContent) {
    const messages = [
      {
        role: 'system',
        content: `You are a professional content summarizer specializing in web content analysis. Your task is to create executive-level summaries that busy professionals can quickly understand. Always respond in English with clear, actionable insights using structured formatting.`
      },
      {
        role: 'user',
        content: `Create a comprehensive yet concise summary of this webpage using the following structured format:

**📄 CONTENT SUMMARY**

**Main Topic:** [One clear sentence describing what this page is about]

**Content Type:** [Article, Product Page, Tutorial, Documentation, Blog Post, etc.]

**Key Insights:**
• [First core insight or main argument]
• [Second core insight or main argument] 
• [Third core insight if applicable]

**Target Audience:** [Who this content is designed for]

**Next Steps:** [Any actionable information or recommended actions]

Use this exact structure with markdown formatting. Keep each section concise but informative.

**Content to summarize:**
${pageContent}`
      }
    ];

    const summary = await this.makeRequest(messages, { maxTokens: 500 });
    return summary.trim();
  }

  /**
   * Extract key points from page content
   */
  async listKeyPoints(pageContent) {
    const messages = [
      {
        role: 'system',
        content: `You are a strategic information analyst who extracts the most valuable insights from content. Your expertise is in identifying actionable intelligence, key facts, and critical takeaways that decision-makers need. Always respond in English with structured, impactful formatting.`
      },
      {
        role: 'user',
        content: `Extract the most important insights from this webpage using the following structured format:

**🔍 KEY INSIGHTS**

**📊 Facts & Data:**
• [Important numbers, statistics, or research findings]
• [Additional quantitative information if available]

**⚡ Actionable Items:**
• [Steps, recommendations, or how-to information]
• [Things users can do or implement]

**💡 Key Arguments:**
• [Main claims, conclusions, or expert opinions]
• [Important reasoning or logic presented]

**📋 Important Details:**
• [Critical dates, names, specifications, or requirements]
• [Essential information to remember]

**🎯 Value Propositions:**
• [Benefits, advantages, or unique features highlighted]
• [What makes this content/product/service valuable]

**Instructions:**
- Only include sections that have relevant content
- Limit to 5-7 total points across all sections
- Each point should be 1-2 sentences maximum
- Start each point with the most important concept
- Use clear, actionable language

**Content to analyze:**
${pageContent}`
      }
    ];

    const keyPoints = await this.makeRequest(messages, { maxTokens: 600 });
    return keyPoints.trim();
  }



  /**
   * Analyze page content with specialized prompt for general analysis
   */
  async analyzePage(pageContent) {
    const messages = [
      {
        role: 'system',
        content: `You are a senior digital content strategist and UX analyst with expertise in web content evaluation. You provide comprehensive, professional analysis that helps users understand the strategic value and context of web content. Always respond in English with structured, professional formatting.`
      },
      {
        role: 'user',
        content: `Conduct a comprehensive analysis of this webpage using the following structured format:

**🔍 CONTENT ANALYSIS**

**📂 Content Classification**
• **Type:** [Article, Product Page, Landing Page, Documentation, etc.]
• **Industry:** [Domain/industry context]
• **Format:** [Structure and presentation style]

**🎯 Strategic Purpose**
• **Primary Objective:** [Main goal of this page]
• **Target Audience:** [Intended users and their intent]
• **Business Goals:** [Commercial or informational objectives]

**💎 Key Value Propositions**
• **Main Benefits:** [Primary value offered to users]
• **Differentiators:** [Unique selling points or advantages]
• **Core Message:** [Central thesis or key takeaway]

**⭐ Quality Assessment**
• **Information Depth:** [Comprehensive/Basic/Surface-level]
• **Credibility:** [High/Medium/Low with reasoning]
• **User Experience:** [Professional/Good/Needs Improvement]
• **Overall Rating:** [Excellent/Good/Fair/Poor]

**🚀 Actionable Insights**
• **Next Steps:** [What users should do after reading]
• **Key Takeaways:** [Most important points for decision-making]
• **Relevance:** [Value for different user types]

Use this exact structure with markdown formatting and emojis. Keep each point concise but informative.

**Content to analyze:**
${pageContent}`
      }
    ];

    const analysis = await this.makeRequest(messages, { maxTokens: 700 });
    return analysis.trim();
  }
}

// Export for background script
export { LLMService };