## Intentkit/Nation API demo

```mermaid
flowchart LR
  A[Web Page] --> B[Content Script<br/>Scrape → Markdown]
  B --> C[Background<br/>Sanitize / Validate]
  C --> D[(Nation/Intentkit API)]
  D --> E[Background<br/>Format / Normalize]
  E --> F[Side Panel UI<br/>Render]
  
  classDef webPage fill:#151513,stroke:#D0FF16,stroke-width:2px,color:#D0FF16
  classDef contentScript fill:#0C0C0C,stroke:#747A6F,stroke-width:2px,color:#D0FF16
  classDef background fill:#0C0C0C,stroke:#747A6F,stroke-width:2px,color:#D0FF16
  classDef api fill:#D0FF16,stroke:#5A6C11,stroke-width:3px,color:#0C0C0C
  classDef ui fill:#151513,stroke:#D0FF16,stroke-width:2px,color:#D0FF16
  
  class A webPage
  class B contentScript
  class C background
  class D api
  class E background
  class F ui
```

### Key steps
- **Scrape**: The content script extracts readable content (Readability) and converts to Markdown (Turndown), with length limits.
- **Sanitize**: Content is normalized and truncated to safe size; UI input is validated before sending.
- **Send**: Background posts a Chat Completions request to the configured base URL with Bearer auth.
- **Receive & format**: The response text is returned; when structured JSON is detected, it's formatted for display.

### Configure
- **API Key**: `crestalApiKey` (Options)
- **Base URL**: `apiBaseUrl` (set your Intentkit/Nation-compatible endpoint)

### Request (OpenAI-compatible)
- POST `{baseUrl}/chat/completions` with `{ model, messages, max_tokens, temperature }`

