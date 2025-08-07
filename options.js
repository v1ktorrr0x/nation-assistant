// Nation Assistant Options - Simplified
'use strict';

class OptionsManager {
  constructor() {
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadSettings();
  }

  setupEventListeners() {
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
      settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveSettings().catch(error => {
          this.showStatus(`Error: ${error.message}`, 'error');
        });
      });
    }

    const testBtn = document.getElementById('test-btn');
    if (testBtn) {
      testBtn.addEventListener('click', () => {
        this.testConnection().catch(error => {
          this.showStatus(`Test failed: ${error.message}`, 'error');
        });
      });
    }

    // No additional setup needed for simplified UI
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['crestalApiKey']);

      const apiKeyElement = document.getElementById('api-key');
      if (apiKeyElement && result.crestalApiKey) {
        apiKeyElement.value = result.crestalApiKey;
      }

      // Settings loaded successfully
    } catch (error) {
      this.showStatus('Failed to load settings', 'error');
    }
  }

  async saveSettings() {
    const apiKeyElement = document.getElementById('api-key');

    if (!apiKeyElement) {
      throw new Error('Nation Agent API key field not found');
    }

    const apiKey = apiKeyElement.value.trim();

    if (!apiKey) {
      throw new Error('Nation Agent API key is required');
    }

    // Fixed Crestal Network settings
    const settings = {
      crestalApiKey: apiKey,
      apiBaseUrl: 'https://open.service.crestal.network/v1',
      llmModel: 'gpt-4.1-nano',
      llmMaxTokens: 300,
      llmTemperature: 0.7
    };

    await chrome.storage.sync.set(settings);
    this.showStatus('Settings saved successfully!', 'success');

    await chrome.runtime.sendMessage({ type: 'reloadSettings' });
    await chrome.runtime.sendMessage({ type: 'settingsUpdated' });
  }

  async testConnection() {
    const testBtn = document.getElementById('test-btn');
    if (!testBtn) {
      throw new Error('Test button not found');
    }

    const originalText = testBtn.textContent;
    testBtn.textContent = 'Testing...';
    testBtn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({ type: 'testConnection' });
      if (response.success) {
        this.showStatus('✅ Connection successful!', 'success');
      } else {
        throw new Error(response.error);
      }
    } finally {
      testBtn.textContent = originalText;
      testBtn.disabled = false;
    }
  }

  showStatus(message, type) {
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = `status-message status-${type}`;
      statusEl.style.display = 'block';

      if (type === 'success') {
        setTimeout(() => {
          statusEl.style.display = 'none';
        }, 3000);
      }
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OptionsManager();
});