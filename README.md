# open-vision-mcp

**Provider-neutral Vision MCP Server** — image analysis via 10 inference providers through a single MCP server.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?logo=node.js&logoColor=white)](https://nodejs.org/)

> **⚠️ Validation status:** This server is **engineering-validated** (163/163 unit/integration tests pass) but **live provider validation is pending**. No provider has been tested end-to-end with real API credentials yet. Cerebras vision support is specifically **unverified**. See the [Validation Status](#validation-status) section below.

---

## What It Does

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that gives AI agents the ability to **see and understand images** using any of 9 supported inference providers. All providers are accessed through a single code path with per-provider configuration.

Perfect for screenshots, photos, diagrams, webpage analysis, and mobile app UI review.

---

## Supported Providers

| Provider | `PROVIDER` | Default `baseUrl` | Suggested vision model | `MODEL` required? | Notes |
|---|---|---|---|---|---|
| OpenRouter | `openrouter` | `https://openrouter.ai/api/v1` | `google/gemini-2.0-flash-exp:free` | No (default: `anthropic/claude-3.5-sonnet`) | Sends `HTTP-Referer`/`X-Title` ranking headers |
| OpenAI | `openai` | `https://api.openai.com/v1` | `gpt-4o` | No | — |
| Together | `together` | `https://api.together.xyz/v1` | (check Together's model catalog) | **Yes** | Multi-model aggregator |
| DeepInfra | `deepinfra` | `https://api.deepinfra.com/v1/openai` | (check DeepInfra's catalog) | **Yes** | Multi-model aggregator |
| Fireworks | `fireworks` | `https://api.fireworks.ai/inference/v1` | (check Fireworks' catalog) | **Yes** | Multi-model aggregator |
| Groq | `groq` | `https://api.groq.com/openai/v1` | `llama-3.2-90b-vision-preview` | No | Fast inference |
| Chutes | `chutes` | `https://llm.chutes.ai/v1` | (check Chutes' `/models` for `supported_features`) | **Yes** | Per-model capability preflight |
| Cerebras | `cerebras` | `https://api.cerebras.ai/v1` | `llama-4-scout-17b-16e-instruct` | No | ⚠️ Vision support **unverified** |
| Azure OpenAI | `azure` | (user-supplied deployment URL) | (deployment-configured) | No (ignored) | Requires `BASE_URL` with `?api-version=`; uses `api-key` header |
| Ollama | `ollama` | `http://localhost:11434` | `llama3.2-vision` | No | Local (default) or Cloud (`BASE_URL=https://api.ollama.com`); uses native `/api/chat` endpoint |

---

## Quick Start

### Prerequisites

- **Node.js** 18+
- An API key for at least one provider above

### Option 1: Use with npx (recommended)

```bash
# Set your provider, API key, and model
export PROVIDER=openrouter
export API_KEY=sk-or-v1-your-api-key-here
export MODEL=google/gemini-2.0-flash-exp:free

# Run the server
npx open-vision-mcp
```

### Option 2: Install globally

```bash
npm install -g open-vision-mcp
open-vision-mcp
```

### Option 3: Clone and build

```bash
git clone https://github.com/abyssbugg/open-image-mcp.git
cd open-image-mcp
npm install
npm run build
node dist/index.js
```

---

## Configuration

All configuration is via environment variables.

### Environment Variables

| Variable | Required? | Default | Purpose |
|---|---|---|---|
| `PROVIDER` | No | `openrouter` | Provider discriminator (one of the 9 above) |
| `API_KEY` | **Yes** | — | API key for the selected provider |
| `MODEL` | Depends | Per-provider default | Model id (required for `together`, `deepinfra`, `fireworks`, `chutes`; ignored by `azure`) |
| `BASE_URL` | No (yes for `azure`) | Per-provider default | Full-prefix base URL (must include `/v1` or `/api/v1` as appropriate). Azure requires the full deployment URL with `?api-version=`. |
| `EXTRA_HEADERS` | No | Per-provider default | JSON object string of extra HTTP headers (e.g., OpenRouter's `HTTP-Referer`/`X-Title`) |
| `LOG_LEVEL` | No | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `MAX_IMAGE_SIZE` | No | `10485760` (10MB) | Maximum image size in bytes |
| `RETRY_ATTEMPTS` | No | `3` | (Reserved — not yet implemented) |
| `PORT` | No | `3000` | (Reserved — not used by stdio transport) |

### Legacy Environment Variables (backwards compatible)

If the new variables above are unset, the server falls back to the legacy OpenRouter variables:

| Legacy variable | Maps to |
|---|---|
| `OPENROUTER_API_KEY` | `API_KEY` |
| `OPENROUTER_MODEL` | `MODEL` |
| `OPENROUTER_BASE_URL` | `BASE_URL` |

**Resolution precedence:** new variable > legacy variable > per-provider default.

**Existing OpenRouter users** with only `OPENROUTER_API_KEY` set continue to work with zero config changes. The server defaults to `PROVIDER=openrouter` and lifts the legacy variables into the new fields.

### Azure OpenAI Configuration

Azure is the only provider that **requires** `BASE_URL` (no per-provider default). The `BASE_URL` must be the full deployment URL including the `api-version` query parameter:

```bash
export PROVIDER=azure
export API_KEY=your-azure-resource-key
export BASE_URL=https://your-resource.openai.azure.com/openai/deployments/your-deployment?api-version=2024-02-15-preview
```

For Azure, `MODEL` is ignored — the deployment name is in `BASE_URL`. Azure uses the `api-key` header (not `Authorization: Bearer`). Azure has no `/models` endpoint; `testConnection` and `validateModel` return `true` without making HTTP calls (the first `analyze_image` call is the real health check).

---

## MCP Client Configuration

### Claude Code

Add to `~/.claude.json`:

```json
{
  "mcp": {
    "servers": {
      "vision": {
        "command": "npx",
        "args": ["open-vision-mcp"],
        "env": {
          "PROVIDER": "openrouter",
          "API_KEY": "sk-or-v1-your-key-here",
          "MODEL": "google/gemini-2.0-flash-exp:free"
        }
      }
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vision": {
      "command": "npx",
      "args": ["open-vision-mcp"],
      "env": {
        "PROVIDER": "openai",
        "API_KEY": "sk-your-key-here",
        "MODEL": "gpt-4o"
      }
    }
  }
}
```

### Other MCP Clients

- **Cursor:** `~/.cursor/mcp.json`
- **Cline:** `~/.cline/mcp.json`
- **Windsurf:** MCP settings file
- Check your agent's MCP documentation

### Switching Providers

Change only the env vars — no code changes:

```bash
# Switch from OpenRouter to Groq
export PROVIDER=groq
export API_KEY=gsk-your-groq-key
export MODEL=llama-3.2-90b-vision-preview

npx open-vision-mcp
```

---

## Tools

The server exposes 3 MCP tools. Tool names and schemas are identical for all providers.

### `analyze_image`

General image analysis. Supports base64, file paths, and URLs.

**Parameters:**
- `type` — `base64` | `file` | `url`
- `data` — image data (base64 string, file path, or URL)
- `mimeType` — MIME type (required for `base64`)
- `prompt` — custom analysis prompt (optional)
- `format` — `text` | `json` (default: `text`)
- `maxTokens` — max response tokens (default: 4000)
- `temperature` — sampling temperature 0–2 (default: 0.1)

### `analyze_webpage_screenshot`

Webpage screenshot specialist. Extracts content, layout, navigation, forms, and accessibility info.

**Additional parameters:**
- `focusArea` — `layout` | `content` | `navigation` | `forms` | `interactive` | `accessibility`
- `includeAccessibility` — include accessibility analysis (default: `true`)
- `format` — `text` | `json` (default: `json`)

### `analyze_mobile_app_screenshot`

Mobile app screenshot specialist. UI design, UX, platform conventions, accessibility.

**Additional parameters:**
- `platform` — `ios` | `android` | `auto-detect` (default: `auto-detect`)
- `focusArea` — `ui-design` | `user-experience` | `navigation` | `accessibility` | `performance` | `onboarding`
- `includeUXHeuristics` — include Nielsen's 10 heuristics (default: `true`)
- `format` — `text` | `json` (default: `json`)

---

## Validation Status

### Engineering Validation: COMPLETE

- **163/163 unit + integration tests pass** (JSON reporter; `npm test`)
- **`npm run build` exit 0** — TypeScript strict mode, zero errors
- **`npm run lint` exit 0** — ESLint, zero errors
- **Sentinel 8/8** — black-box MCP protocol test over stdio
- **Phase 2B.5 Stage 1: 10/10 mandatory gates passed** — keyless validation (configuration, request construction, auth headers, error handling, image processing, timeouts, capabilities, base URLs, logging)
- **MCP contract byte-identical to baseline** — tool names, schemas, and output format unchanged from the original upstream
- **Backwards compatibility verified** — legacy `OPENROUTER_API_KEY` env var fallback works end-to-end

### Operational Validation: PENDING

- **Live provider validation (Stage 2):** paused pending valid API credentials. No provider has been tested end-to-end through `analyze_image` with a real key. Stage 2 may be executed at any future time when credentials become available.
- **Cerebras vision support: UNVERIFIED.** The `llama-4-scout-17b-16e-instruct` model is configured as the default, but whether it accepts multimodal (image) input has not been confirmed. If it doesn't support vision, the user gets a clear provider-aware error at runtime.
- **Provider response shapes:** unit tests mock axios and assert the request/response shape. Live APIs have not been confirmed to match the mocked shapes, though all providers are OpenAI-compatible per their official documentation.

### What This Means for Users

The server is **architecturally sound and thoroughly unit-tested**. The provider abstraction, configuration resolution, request construction, error handling, and MCP protocol are all verified. However, **no live API call has been made against any provider**. Users should be aware that:
1. The request body shape is correct per provider documentation (verified in Phase 2A research), but not confirmed against a live 200 response.
2. Cerebras may not support vision input — use a different provider if vision is critical.
3. If a provider's API has changed since the Phase 2A research (conducted June 2026), the server may need a config update.

---

## Supported Image Formats

| Format | Extension | MIME Type | Status |
|---|---|---|---|
| JPEG | `.jpg`, `.jpeg` | `image/jpeg` | ✅ |
| PNG | `.png` | `image/png` | ✅ |
| WebP | `.webp` | `image/webp` | ✅ |
| GIF | `.gif` | `image/gif` | ✅ |
| **Max size** | — | — | **10MB** (configurable via `MAX_IMAGE_SIZE`) |

MIME type detection is signature-based (no native dependencies).

---

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev

# Run tests
npm test                          # all tests (JSON reporter for counts)
npx vitest run test/unit          # unit tests only
npx vitest run test/integration   # integration tests only

# Lint and format
npm run lint
npm run format

# Clean
npm run clean
```

---

## Troubleshooting

### "API_KEY environment variable is required"
Set `API_KEY` (or the legacy `OPENROUTER_API_KEY`) to your provider's API key.

### "MODEL environment variable is required for provider 'together'"
The `together`, `deepinfra`, `fireworks`, and `chutes` providers are multi-model aggregators with no default model. Set `MODEL` to a vision-capable model id from the provider's catalog.

### "Unknown PROVIDER 'xyz'"
The `PROVIDER` value must be one of: `openrouter`, `openai`, `together`, `deepinfra`, `fireworks`, `groq`, `chutes`, `cerebras`, `azure`.

### "BASE_URL is required for provider 'azure'"
Azure requires `BASE_URL` to be the full deployment URL including `?api-version=`. There is no per-provider default.

### "<provider> API Error: ..."
The error message includes the provider id (e.g., `openai API Error: Invalid API key`). This confirms the provider-aware error handling is working. Check your API key and model id.

### Ollama: connection refused (local)
Ensure Ollama is running locally (`ollama serve` or `ollama pull <model>`). The default `BASE_URL` is `http://localhost:11434`. For Ollama Cloud, set `BASE_URL=https://api.ollama.com` and `API_KEY=<cloud-token>`.

---

## Attribution

This project is a fork of [JonathanJude/openrouter-image-mcp](https://github.com/JonathanJude/openrouter-image-mcp) (MIT license), refactored to be provider-neutral with support for 9 inference providers.

---

## License

MIT — see [LICENSE](LICENSE).