// Debug Configuration for Nation Assistant
// Set DEBUG to false to disable all logging

window.NATION_DEBUG = {
  enabled: false,
  components: {
    sidepanel: false,
    background: false,
    llmService: false,
    retry: false,
    errors: true
  },
  
  // Log levels
  levels: {
    log: true,
    warn: true,
    error: true,
    debug: true
  }
};

// Global logger factory
window.createLogger = function(component) {
  return {
    log: (message, ...args) => {
      if (window.NATION_DEBUG?.enabled && window.NATION_DEBUG?.components[component] && window.NATION_DEBUG?.levels.log) {
        console.log(`[${component.toUpperCase()}] ${message}`, ...args);
      }
    },
    warn: (message, ...args) => {
      if (window.NATION_DEBUG?.enabled && window.NATION_DEBUG?.components[component] && window.NATION_DEBUG?.levels.warn) {
        console.warn(`[${component.toUpperCase()}] ${message}`, ...args);
      }
    },
    error: (message, ...args) => {
      if (window.NATION_DEBUG?.enabled && window.NATION_DEBUG?.components[component] && window.NATION_DEBUG?.levels.error) {
        console.error(`[${component.toUpperCase()}] ${message}`, ...args);
      }
    },
    debug: (message, ...args) => {
      if (window.NATION_DEBUG?.enabled && window.NATION_DEBUG?.components[component] && window.NATION_DEBUG?.levels.debug) {
        console.debug(`[${component.toUpperCase()}] ${message}`, ...args);
      }
    }
  };
};

// Helper functions for debugging
window.NATION_DEBUG.toggleComponent = function(component) {
  if (this.components[component] !== undefined) {
    this.components[component] = !this.components[component];
    console.log(`Debug logging for ${component}: ${this.components[component] ? 'ENABLED' : 'DISABLED'}`);
  }
};

window.NATION_DEBUG.toggleAll = function() {
  this.enabled = !this.enabled;
  console.log(`Debug logging: ${this.enabled ? 'ENABLED' : 'DISABLED'}`);
};

window.NATION_DEBUG.showConfig = function() {
  console.table(this.components);
};

console.log('🐛 Nation Assistant Debug Mode Enabled');
console.log('Available commands:');
console.log('- NATION_DEBUG.toggleAll() - Toggle all logging');
console.log('- NATION_DEBUG.toggleComponent("sidepanel") - Toggle specific component');
console.log('- NATION_DEBUG.showConfig() - Show current configuration');