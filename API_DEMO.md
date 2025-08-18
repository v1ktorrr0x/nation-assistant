## Nation/Intentkit API – minimal flow

```mermaid
sequenceDiagram
  participant UI as Side Panel
  participant BG as Background
  participant CS as Content Script
  participant LLM as Nation/Intentkit API

  UI->>BG: chat/summarize/key-points/translate
  BG->>CS: GET_PAGE_CONTENT
  CS-->>BG: pageContent (Markdown/text)
  BG->>LLM: POST {baseUrl}/chat/completions (messages)
  LLM-->>BG: choices[0].message.content
  BG-->>UI: response
```

### What to configure
- **API Key**: `crestalApiKey` (Options page)
- **Base URL**: `apiBaseUrl` (set to Intentkit/Nation-compatible endpoint)

### Where things live
- **Requests**: `services/llm-service.js` (`makeRequest`, `chatWithPage`, `summarizePage`, `listKeyPoints`, `translateText`)
- **Coordination**: `background.js` (injects content script, calls LLM, returns result)
- **UI messaging**: `sidepanel/api.js` (sends message to background, renders reply)
- **Extraction**: `content.mjs` (Readability + Turndown → Markdown/text)

### Request shape (OpenAI-compatible)
- POST `{baseUrl}/chat/completions`
- Headers: `Authorization: Bearer <key>`, `Content-Type: application/json`
- Body: `{ model, messages, max_tokens, temperature }`

Tip: Switch providers by changing `apiBaseUrl` in Options; the message schema stays the same.

