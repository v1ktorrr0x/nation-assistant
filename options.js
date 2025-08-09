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
        this.saveSettings().catch(() => {
          // Error handling is done in saveSettings method
        });
      });
    }

    const testBtn = document.getElementById('test-btn');
    if (testBtn) {
      testBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.testConnection().catch(() => {
          // Error handling is done in testConnection method
        });
      });
    }

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') {
          e.preventDefault();
          this.saveSettings().catch(() => {});
        } else if (e.key === 't') {
          e.preventDefault();
          this.testConnection().catch(() => {});
        }
      }
    });
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['crestalApiKey', 'apiBaseUrl']);

      const apiKeyElement = document.getElementById('api-key');
      if (apiKeyElement && result.crestalApiKey) {
        apiKeyElement.value = result.crestalApiKey;
      }

      const baseUrlElement = document.getElementById('base-url');
      if (baseUrlElement && result.apiBaseUrl) {
        baseUrlElement.value = result.apiBaseUrl;
      }

      // Settings loaded successfully
    } catch (error) {
      // Silent fail for loading settings - user will see when they try to save
      console.error('Failed to load settings:', error);
    }
  }

  async saveSettings() {
    const saveBtn = document.querySelector('.save-btn');
    const apiKeyElement = document.getElementById('api-key');
    const baseUrlElement = document.getElementById('base-url');

    if (!apiKeyElement) {
      throw new Error('Nation Agent API key field not found');
    }

    const apiKey = apiKeyElement.value.trim();
    const baseUrl = baseUrlElement ? baseUrlElement.value.trim() : '';

    if (!apiKey) {
      throw new Error('Nation Agent API key is required');
    }

    // Subtle loading state
    this.setButtonState(saveBtn, 'loading');

    try {
      // Use custom base URL or default to Crestal Network
      const finalBaseUrl = baseUrl || 'https://open.service.crestal.network/v1';

      const settings = {
        crestalApiKey: apiKey,
        apiBaseUrl: finalBaseUrl,
        llmModel: 'gpt-4.1-nano',
        llmMaxTokens: 300,
        llmTemperature: 0.7
      };

      await chrome.storage.sync.set(settings);

      await chrome.runtime.sendMessage({ type: 'reloadSettings' });
      await chrome.runtime.sendMessage({ type: 'settingsUpdated' });

      // Show success state in button
      this.setButtonState(saveBtn, 'success');
      setTimeout(() => {
        this.setButtonState(saveBtn, 'default');
      }, 2000);

    } catch (error) {
      // Show error state in button
      this.setButtonState(saveBtn, 'error');
      setTimeout(() => {
        this.setButtonState(saveBtn, 'default');
      }, 3000);
      throw error;
    }
  }

  async testConnection() {
    const testBtn = document.getElementById('test-btn');
    const apiKeyElement = document.getElementById('api-key');
    const baseUrlElement = document.getElementById('base-url');

    if (!testBtn) {
      throw new Error('Test button not found');
    }

    if (!apiKeyElement) {
      throw new Error('API key field not found');
    }

    const apiKey = apiKeyElement.value.trim();
    const baseUrl = baseUrlElement ? baseUrlElement.value.trim() : '';

    if (!apiKey) {
      this.setButtonState(testBtn, 'error');
      setTimeout(() => {
        this.setButtonState(testBtn, 'default');
      }, 3000);
      throw new Error('Please enter an API key to test');
    }

    // Show loading state
    this.setButtonState(testBtn, 'loading');

    try {
      // Use current input values for testing
      const finalBaseUrl = baseUrl || 'https://open.service.crestal.network/v1';
      
      const response = await chrome.runtime.sendMessage({ 
        type: 'testConnection',
        testConfig: {
          apiKey: apiKey,
          baseUrl: finalBaseUrl,
          model: 'gpt-4.1-nano'
        }
      });

      if (response.success) {
        // Show success state in button
        this.setButtonState(testBtn, 'success');
        setTimeout(() => {
          this.setButtonState(testBtn, 'default');
        }, 2000);
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      // Show error state in button
      this.setButtonState(testBtn, 'error');
      setTimeout(() => {
        this.setButtonState(testBtn, 'default');
      }, 3000);
      throw error;
    }
  }

  setButtonState(button, state) {
    if (!button) return;

    const btnIcon = button.querySelector('.btn-icon i');
    const btnTitle = button.querySelector('.btn-title');
    const btnDesc = button.querySelector('.btn-desc');

    // Store original content if not already stored
    if (!button.dataset.originalIcon) {
      button.dataset.originalIcon = btnIcon ? btnIcon.className : '';
      button.dataset.originalTitle = btnTitle ? btnTitle.textContent : '';
      button.dataset.originalDesc = btnDesc ? btnDesc.textContent : '';
    }

    // Remove all state classes with transition
    button.classList.remove('btn-loading', 'btn-processing', 'btn-success', 'btn-error', 'btn-transitioning');
    button.disabled = false;

    // Add transition class for smooth animations
    button.classList.add('btn-transitioning');

    // Small delay to ensure transition class is applied
    setTimeout(() => {
      if (state === 'loading') {
        button.classList.add('btn-loading');
        button.disabled = true;
        
        if (btnIcon) btnIcon.className = 'fas fa-spinner btn-icon-spin';
        if (btnTitle) {
          btnTitle.textContent = button.id === 'test-btn' ? 'Connecting...' : 'Deploying...';
        }
        if (btnDesc) {
          btnDesc.textContent = button.id === 'test-btn' ? 'Testing API connection' : 'Saving configuration';
        }
      } else if (state === 'success') {
        button.classList.add('btn-success');
        
        if (btnIcon) btnIcon.className = 'fas fa-check-circle btn-icon-bounce';
        if (btnTitle) {
          btnTitle.textContent = button.id === 'test-btn' ? 'Connected!' : 'Deployed!';
        }
        if (btnDesc) {
          btnDesc.textContent = button.id === 'test-btn' ? 'API connection verified' : 'Configuration saved';
        }
      } else if (state === 'error') {
        button.classList.add('btn-error');
        
        if (btnIcon) btnIcon.className = 'fas fa-exclamation-triangle btn-icon-shake';
        if (btnTitle) {
          btnTitle.textContent = button.id === 'test-btn' ? 'Failed' : 'Error';
        }
        if (btnDesc) {
          btnDesc.textContent = button.id === 'test-btn' ? 'Connection failed' : 'Save failed';
        }
      } else {
        // Reset to original state
        if (btnIcon) btnIcon.className = button.dataset.originalIcon;
        if (btnTitle) btnTitle.textContent = button.dataset.originalTitle;
        if (btnDesc) btnDesc.textContent = button.dataset.originalDesc;
      }
      
      // Remove transition class after animation
      setTimeout(() => {
        button.classList.remove('btn-transitioning');
      }, 300);
    }, 50);
  }

  showStatus(message, type) {
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = `status-message status-${type}`;
      statusEl.style.display = 'block';
      statusEl.style.opacity = '1';
      statusEl.style.transform = 'translateY(0)';
      
      // Add animation class after a brief delay to trigger animation
      setTimeout(() => {
        statusEl.classList.add('status-animate');
      }, 10);
      
      // Remove animation class after animation completes
      setTimeout(() => {
        statusEl.classList.remove('status-animate');
      }, 300);

      // Auto-hide success messages
      if (type === 'success') {
        setTimeout(() => {
          statusEl.style.opacity = '0';
          statusEl.style.transform = 'translateY(-10px)';
          setTimeout(() => {
            statusEl.style.display = 'none';
            statusEl.style.opacity = '1';
            statusEl.style.transform = 'translateY(10px)';
          }, 300);
        }, 4000);
      }
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OptionsManager();
});