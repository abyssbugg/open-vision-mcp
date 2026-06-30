# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in open-vision-mcp:

1. **Do not** open a public GitHub issue.
2. Email the maintainer directly with details of the vulnerability.
3. Include steps to reproduce if possible.
4. You will receive a response within 48 hours.

## Security Considerations

- **API keys** are loaded from environment variables only — never hardcoded or logged.
- **Image data** is processed in-memory (base64 → buffer → base64) and not written to disk.
- **Provider communication** is over HTTPS (provider base URLs are HTTPS by default).
- **`EXTRA_HEADERS`** is validated as a JSON object before being sent.
- **Input validation**: image size limits, MIME type validation, prompt length limits.

## Dependency Security

### Runtime dependencies
| Package | Status |
|---|---|
| `@modelcontextprotocol/sdk` | `^1.29.0` — current, no known vulnerabilities |
| `axios` | `^1.18.1` — current, no known vulnerabilities |
| `dotenv` | `^17.2.3` — current, no known vulnerabilities |

### Dev dependencies
Dev dependencies may have known vulnerabilities (check `npm audit`). These do not ship with the npm package — only `dist/`, `README.md`, `LICENSE`, and `.env.example` are published.