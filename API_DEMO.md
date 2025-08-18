## Intentkit/Nation API demo (minimal)

```mermaid
sequenceDiagram
  participant UI as Side Panel
  participant BG as Background
  participant CS as Content Script
  participant LLM as Nation/Intentkit API

  UI->>BG: ask (chat/summarize/key-points)
  BG->>CS: GET_PAGE_CONTENT
  Note over CS: Scrape DOM → Readability + Turndown
  CS-->>BG: Scraped + sanitized content (Markdown/text)
  Note over BG: Validate input, cap length
  BG->>LLM: POST {baseUrl}/chat/completions (messages)
  LLM-->>BG: choices[0].message.content
  Note over BG: Format/normalize response
  BG-->>UI: Rendered answer
```

### Key steps
- **Scrape**: The content script extracts readable content (Readability) and converts to Markdown (Turndown), with length limits.
- **Sanitize**: Content is normalized and truncated to safe size; UI input is validated before sending.
- **Send**: Background posts a Chat Completions request to the configured base URL with Bearer auth.
- **Receive & format**: The response text is returned; when structured JSON is detected, it’s formatted for display.

### Configure
- **API Key**: `crestalApiKey` (Options)
- **Base URL**: `apiBaseUrl` (set your Intentkit/Nation-compatible endpoint)

### Request (OpenAI-compatible)
- POST `{baseUrl}/chat/completions` with `{ model, messages, max_tokens, temperature }`

