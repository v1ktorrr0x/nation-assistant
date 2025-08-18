// sidepanel/state.js
'use strict';

// Remove circular import - logger will be passed as parameter where needed

export const state = {
  isProcessing: false,
  currentTabId: null,
  currentStreamingController: null,
  lastUserMessage: null,
  activeTimeouts: new Set(), // Track active timeouts for cleanup
  activeIntervals: new Set(), // Track active intervals for cleanup
  eventListeners: new Map(), // Track event listeners for cleanup
  lastStateUpdate: Date.now(),
  stateVersion: 1
};

/**
 * Validate and sanitize application state
 */
export function validateState() {


  // Validate processing state
  if (typeof state.isProcessing !== 'boolean') {
    console.warn('[State] Invalid isProcessing state, resetting to false');
    state.isProcessing = false;
  }

  // Validate tab ID
  if (state.currentTabId !== null && typeof state.currentTabId !== 'number') {
    console.warn('[State] Invalid currentTabId, resetting');
    state.currentTabId = null;
  }

  // Clean up stale timeouts and intervals
  cleanupStaleResources();

  // Update state metadata
  state.lastStateUpdate = Date.now();
  state.stateVersion++;

  return true;
}

/**
 * Safe state update with validation
 */
export function updateState(updates) {
  try {
    Object.assign(state, updates);
    validateState();
    console.debug('[State] State updated successfully', updates);
  } catch (error) {
    console.error('[State] State update failed:', error);
    // Restore to safe state if update fails
    state.isProcessing = false;
  }
}

/**
 * Clean up stale resources to prevent memory leaks
 */
export function cleanupStaleResources() {
  // Clear any stale timeouts
  state.activeTimeouts.forEach(timeoutId => {
    if (timeoutId && typeof timeoutId === 'number') {
      try {
        clearTimeout(timeoutId);
      } catch (error) {
        console.warn('[State] Failed to clear timeout:', timeoutId);
      }
    }
  });
  state.activeTimeouts.clear();

  // Clear any stale intervals
  state.activeIntervals.forEach(intervalId => {
    if (intervalId && typeof intervalId === 'number') {
      try {
        clearInterval(intervalId);
      } catch (error) {
        console.warn('[State] Failed to clear interval:', intervalId);
      }
    }
  });
  state.activeIntervals.clear();

  // Clean up event listeners that are no longer needed
  state.eventListeners.forEach((cleanup, element) => {
    try {
      if (element && !document.contains(element)) {
        if (typeof cleanup === 'function') {
          cleanup();
        }
        state.eventListeners.delete(element);
      }
    } catch (error) {
      console.warn('[State] Failed to cleanup event listener:', error);
      state.eventListeners.delete(element);
    }
  });
}
