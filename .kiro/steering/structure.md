# Project Structure

## Root Files

- **manifest.json**: Chrome extension configuration (Manifest V3)
- **background.js**: Service worker for extension lifecycle management
- **content.js**: Content script for page interaction and data extraction
- **sidepanel.js**: Main UI logic for the AI chat interface
- **options.js**: Settings/configuration page logic
- **debug-config.js**: Debug configuration injected into content scripts

## HTML Files

- **sidepanel.html**: Main AI chat interface (Chrome side panel)
- **options.html**: Extension settings and API configuration page

## Directory Structure

```
/
├── icons/           # Extension icons (16, 32, 48, 128px)
├── services/        # Modular services
│   └── llm-service.js    # Crestal Network API integration
├── styles/          # CSS stylesheets
│   ├── sidepanel.css     # Main UI styling (cyberpunk theme)
│   └── nation-theme.css  # Shared theme components
└── .kiro/           # Kiro AI assistant configuration
    └── steering/    # AI guidance documents
```

## Architecture Patterns

### Service Layer
- **LLMService**: Centralized API communication with Crestal Network
- Modular design allows easy service extension

### Component Organization
- **Background Script**: Extension coordinator and event handler
- **Content Scripts**: Page content extraction with security boundaries
- **UI Components**: Sidebar interface with streaming response handling

### File Naming Conventions
- Kebab-case for directories (`services/`, `styles/`)
- Camelcase for JavaScript classes (`LLMService`, `AIResponseFormatter`)
- Descriptive names reflecting functionality (`llm-service.js`, `sidepanel.css`)

### Security Boundaries
- Content scripts run in isolated context
- Background service worker handles privileged operations
- CSP enforced for extension pages
- Input sanitization required for user content