// sidepanel/logger.js
'use strict';

const DEBUG = true;

export const logger = {
    log: (message, ...args) => {
        if (DEBUG) console.log(`[Sidepanel] ${message}`, ...args);
    },
    warn: (message, ...args) => {
        if (DEBUG) console.warn(`[Sidepanel] ${message}`, ...args);
    },
    error: (message, ...args) => {
        if (DEBUG) console.error(`[Sidepanel] ${message}`, ...args);
    },
    debug: (message, ...args) => {
        if (DEBUG) console.debug(`[Sidepanel] ${message}`, ...args);
    }
};