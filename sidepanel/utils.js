// sidepanel/utils.js
'use strict';

import { state } from './state.js';

const DEBUG = false;
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

export function escapeHtml(text) {
    if (typeof text !== 'string') {
        return '';
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Comprehensive input validation and sanitization
 */
export function validateAndSanitizeInput(input) {
    if (!input || typeof input !== 'string') {
        return { isValid: false, sanitized: '', error: 'Invalid input type' };
    }

    // Enhanced length validation with user guidance
    const MAX_INPUT_LENGTH = 4000;
    if (input.length > MAX_INPUT_LENGTH) {
        const excess = input.length - MAX_INPUT_LENGTH;
        return {
            isValid: false,
            sanitized: input.substring(0, MAX_INPUT_LENGTH),
            error: `Message is ${excess} characters too long. Please shorten your message to under ${MAX_INPUT_LENGTH} characters for better AI processing.`
        };
    }

    // Check for minimum meaningful content
    const trimmed = input.trim();
    if (trimmed.length < 2) {
        return {
            isValid: false,
            sanitized: trimmed,
            error: 'Please enter a meaningful message to get a helpful response.'
        };
    }

    // Remove potentially dangerous patterns
    let sanitized = input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '') // Remove javascript: protocols
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .replace(/data:text\/html/gi, '') // Remove data URLs
        .trim();

    // Check for suspicious patterns
    const suspiciousPatterns = [
        /<iframe/i,
        /<object/i,
        /<embed/i,
        /<link/i,
        /<meta/i,
        /eval\s*\(/i,
        /Function\s*\(/i
    ];

    const hasSuspiciousContent = suspiciousPatterns.some(pattern => pattern.test(sanitized));

    if (hasSuspiciousContent) {
        return {
            isValid: false,
            sanitized: sanitized.replace(/[<>]/g, ''),
            error: 'Your message contains HTML or code that could be unsafe. Please use plain text for better results.'
        };
    }

    // Check for excessive repetition (potential spam)
    const words = sanitized.split(/\s+/);
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    if (words.length > 10 && uniqueWords.size / words.length < 0.3) {
        return {
            isValid: false,
            sanitized,
            error: 'Your message appears to have excessive repetition. Please rephrase for better AI understanding.'
        };
    }

    return { isValid: true, sanitized, error: null };
}

/**
 * Sanitize HTML content for safe display
 */
export function sanitizeHtmlContent(html) {
    if (!html || typeof html !== 'string') {
        return '';
    }

    // Create a temporary element to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Remove dangerous elements and attributes
    const dangerousElements = temp.querySelectorAll('script, iframe, object, embed, link[rel="stylesheet"], meta, style');
    dangerousElements.forEach(el => el.remove());

    // Remove dangerous attributes
    const allElements = temp.querySelectorAll('*');
    allElements.forEach(el => {
        // Remove event handler attributes
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('on') || attr.name === 'style') {
                el.removeAttribute(attr.name);
            }
        });

        // Sanitize href attributes
        if (el.hasAttribute('href')) {
            const href = el.getAttribute('href');
            if (href && (href.startsWith('javascript:') || href.startsWith('data:'))) {
                el.removeAttribute('href');
            }
        }
    });

    return temp.innerHTML;
}


export function formatTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Enhanced timeout wrapper that tracks timeouts for cleanup
 */
export function safeSetTimeout(callback, delay) {
    const timeoutId = setTimeout(() => {
        state.activeTimeouts.delete(timeoutId);
        callback();
    }, delay);
    state.activeTimeouts.add(timeoutId);
    return timeoutId;
}

/**
 * Enhanced interval wrapper that tracks intervals for cleanup
 */
export function safeSetInterval(callback, delay) {
    const intervalId = setInterval(callback, delay);
    state.activeIntervals.add(intervalId);
    return intervalId;
}

/**
 * Enhanced event listener wrapper that tracks listeners for cleanup
 */
export function safeAddEventListener(element, event, handler, options) {
    element.addEventListener(event, handler, options);
    state.eventListeners.set(element, { event, handler });
}
