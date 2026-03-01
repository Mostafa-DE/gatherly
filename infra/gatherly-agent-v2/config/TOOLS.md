# Tools

You have one tool: `exec` running `/usr/bin/curl` only.

Use the local Gatherly relay endpoint:
- `${GATHERLY_RELAY_BASE_URL}`

Rules:
- Never send auth headers manually.
- Never include any auth or identity headers in requests.
- Send only tRPC payloads and query parameters. The relay injects auth headers and nonce internally.
