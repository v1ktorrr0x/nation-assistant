# Technology Stack

## Core Technologies

- **Chrome Extension**: Manifest V3 architecture with service worker
- **JavaScript**: ES6+ with modules, strict mode enforced
- **Service Worker**: Background processing for extension lifecycle and state coordination
- **Content Scripts**: Secure page content extraction and injection
- **Chrome APIs**: Side Panel, Storage (sync/local), Tabs, Context Menus, Notifications, Runtime Messaging

## State Management Technologies

- **Chrome Storage API**: Persistent configuration and user preferences
- **Runtime Messaging**: Real-time communication between extension components
- **Local Storage**: Temporary state and context actions
- **Memory State**: In-memory caching for performance optimization
- **Event-Driven Architecture**: Message passing for component coordination

## External Dependencies

- **Crestal Network API**: AI/LLM service integration (gpt-4.1-nano default model)
- **Font Awesome 6.4.0**: Icon library for UI components
- **Google Fonts**: Inter (primary), Space Mono (monospace terminal font)

## Build System

No complex build process required - this is a vanilla JavaScript Chrome extension.

### Common Commands

```bash
# Package extension for distribution
npm run package

# No build step needed
npm run build  # Just echoes "No build process required"
```

### Development Setup

1. Load unpacked extension in Chrome developer mode
2. Configure API key in extension options
3. Test in `chrome://extensions/` developer mode
4. Monitor console logs with DEBUG flag enabled

## Code Standards

- **Strict Mode**: All JavaScript files use `'use strict';`
- **ES6 Modules**: Import/export syntax for modular architecture
- **Comprehensive Logging**: DEBUG flag controls console output with prefixed loggers
- **Error Handling**: Try-catch blocks with proper error propagation and user feedback
- **Security**: Content Security Policy enforced, input sanitization required
- **State Consistency**: Centralized state management patterns with validation

## API Integration

- **Base URL**: `https://open.service.crestal.network/v1`
- **Authentication**: API key-based with secure storage
- **Streaming**: Real-time response handling with typing effects
- **Models**: Configurable (default: gpt-4.1-nano)
- **Parameters**: Configurable temperature (0.7), max tokens (300)
- **Error Recovery**: Automatic retry mechanisms and connection monitoring

## State Architecture Patterns

### Component Communication
- **Background ↔ Sidepanel**: Runtime messaging for API calls and settings
- **Background ↔ Content**: Page content extraction and context actions
- **Storage Synchronization**: Settings sync across browser instances
- **Event Broadcasting**: State changes propagated to all components

### Data Flow
1. **User Input** → Sidepanel validation → Background processing
2. **API Response** → Background formatting → Sidepanel display
3. **Context Actions** → Storage persistence → Component notification
4. **Settings Changes** → Storage sync → Service reinitialization