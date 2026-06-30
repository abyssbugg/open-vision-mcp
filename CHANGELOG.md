# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [2.1.0] — 2026-06-30

### Added
- Ollama provider (local + Cloud) with dedicated `OllamaProvider` adapter
- Native `/api/chat` endpoint support for Ollama (request/response translation)
- `/v1/models` endpoint for Ollama model discovery and validation
- 16 unit tests for `OllamaProvider` (182 total)
- Live validation: Ollama Cloud vision analysis confirmed end-to-end (first live-validated provider)
- `.env.example` Ollama section (local + Cloud configuration, vision models)
- README Ollama entry in provider table + troubleshooting

### Changed
- Package version: 2.0.0 → 2.1.0
- `ProviderId` widened to 10 members (added `'ollama'`)
- `PROVIDER_DEFAULTS` table: added `ollama` entry (baseUrl `http://localhost:11434`, model `llama3.2-vision`)
- `PROVIDER_CAPABILITIES` table: added `ollama` entry
- Factory: added `'ollama'` case dispatching to `OllamaProvider`

### Architectural
- `OllamaProvider` established as the single ownership boundary for all Ollama-native protocol handling
- No changes to `VisionProvider` interface, `ProviderCapabilities` shape, or MCP tool schemas
- No changes to existing 9 providers (0 lines changed in their adapters)

## [2.0.0] — 2026-06-26

### Added
- Provider-neutral architecture: `VisionProvider` interface, `ProviderFactory`, `ProviderCapabilities`
- 9 inference providers: OpenRouter, OpenAI, Together, DeepInfra, Fireworks, Groq, Chutes, Cerebras, Azure OpenAI
- Shared `OpenAICompatibleProvider` adapter (6 fully-compatible providers)
- Dedicated `ChutesProvider` (extends `OpenAICompatibleProvider` with `supported_features` preflight)
- Dedicated `AzureOpenAIProvider` (api-key auth, deployment URL, no /models endpoint, omits model field)
- New environment variables: `PROVIDER`, `API_KEY`, `MODEL`, `BASE_URL`, `EXTRA_HEADERS`
- Legacy env var fallback: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL`
- Per-provider default configuration (`PROVIDER_DEFAULTS` table)
- Per-provider capability declaration (`PROVIDER_CAPABILITIES` table)
- Provider-aware error messages (`<provider> API Error: ...`)
- Provider-aware startup log strings (D4)
- `response_format` gating on `capabilities.jsonMode` (D6)
- Logger error serialization for non-Error payloads (D14)
- `satisfies never` exhaustiveness guard in `ProviderFactory`
- MCP SDK upgraded from ^0.5.0 to ^1.29.0 (non-breaking)
- axios upgraded from ^1.6.0 to ^1.18.1 (non-breaking)
- @typescript-eslint upgraded from v6 to v8
- 182 unit + integration tests (163 V1 + 19 V1.1)
- Sentinel black-box MCP protocol test (8/8)
- Phase 2B.5 Stage 1 keyless validation (10/10 mandatory gates)
- Full provider-neutral README with validation status disclosure
- Comprehensive `.env.example` with all providers + legacy fallback

### Removed
- `OpenRouterClient` class (replaced by shared `OpenAICompatibleProvider`)
- `OpenRouterConfig` interface (replaced by `ProviderConfig`)
- `getOpenRouterConfig()` accessor (replaced by `getProviderConfig()`)
- Vision-by-name heuristic in `validateModel` (D5 — brittle, provider-specific)
- Hardcoded "OpenRouter" in startup log strings (D4)
- Committed `.tgz` build artifact (D10)
- `meta-guy-analysis.test.ts` (redundant coverage, syntax error, tested deleted API)

### Breaking changes
- Package renamed: `openrouter-image-mcp` → `open-vision-mcp`
- MCP server name: `openrouter-image-mcp` → `vision-mcp`
- Tool description: "OpenRouter's vision models" → "the configured vision provider"
- `OpenRouterConfig` interface removed (use `ProviderConfig`)
- Environment variable schema generalized (legacy fallback preserved — existing users unaffected)

### Security
- Zero runtime vulnerabilities (SDK + axios upgraded)
- 8 dev-only vulnerabilities remaining (vitest/esbuild/vite — don't ship with the package)
- API keys never logged (verified in Phase 2B.5 Stage 1)
- Input validation: image size, MIME type, prompt length, EXTRA_HEADERS JSON