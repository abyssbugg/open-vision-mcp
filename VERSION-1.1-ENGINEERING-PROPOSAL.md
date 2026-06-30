# Version 1.1 Engineering Proposal: First-Class Ollama Support

**Status:** Approved (with architectural clarification: OllamaProvider is the single ownership boundary for Ollama-native protocol handling)
**Predecessor:** Ollama Feasibility Assessment (approved); Version 1 Release Readiness Review (approved with minor changes)
**Codebase:** fork HEAD `341112f` (Version 1 release candidate, feature-complete)
**Objective:** Extend the existing provider architecture with first-class Ollama support (local + Cloud) while preserving the stability of the Version 1 release.

---

## 1. Version 1.1 Objectives

1. **Add Ollama as the 10th provider** — a single `PROVIDER=ollama` entry that serves both local Ollama (`http://localhost:11434`) and Ollama Cloud (`https://api.ollama.com`) through the native `/api/chat` endpoint.
2. **Implement a dedicated `OllamaProvider`** — translates the existing `VisionProvider.analyzeImage` interface to/from Ollama's native API shape, the same way `AzureOpenAIProvider` handles Azure's unique API in Version 1.
3. **Live-validate Ollama Cloud vision** — execute the first live end-to-end `analyze_image` test with real credentials, confirming the request translation, response parsing, and MCP tool output pipeline work against a real provider.
4. **Preserve the Version 1 stability** — no changes to the existing 9 providers, the `VisionProvider` interface, `ProviderCapabilities` shape, MCP tool schemas, or backwards compatibility. Version 1.1 is purely additive: one new provider id, one new adapter class, one new factory case, one new test file, updated config tables.

**What Version 1.1 IS NOT:**
- A redesign of the `VisionProvider` abstraction
- A change to any existing provider's behavior
- A change to MCP tool schemas or names
- A new abstraction layer or interface
- An architecture study for OAuth/subscription/desktop-session authentication
- A Phase 2C-scale multi-provider expansion
- A release of Version 2

---

## 2. Scope

### 2.1 In scope

| Item | Effort |
|---|---|
| `OllamaProvider implements VisionProvider` (`src/providers/ollama.ts`) | ~150 lines |
| Request translation: OpenAI multimodal → Ollama native `/api/chat` | Core of the adapter |
| Response translation: Ollama native response → `ImageAnalysisResult` | Core of the adapter |
| Provider factory integration: `'ollama'` case + `PROVIDER_CAPABILITIES` entry | Trivial |
| Config: `'ollama'` entry in `PROVIDER_DEFAULTS` (baseUrl, model, requiresExplicitModel) | Trivial |
| `ProviderId` widening: add `'ollama'` | Trivial |
| Unit tests: `test/unit/ollama-provider.test.ts` (~12 tests) | Medium |
| Factory tests: +2 dispatch + capability tests | Low |
| Config tests: +2 default-resolution + missing-MODEL tests | Low |
| `.env.example` update: document Ollama (local + Cloud) | Low |
| README update: add Ollama to the provider table + troubleshooting | Low |
| Live validation: Ollama Cloud vision with available `OLLAMA_API_KEY` | ~30 min |
| Release notes for V1.1 | Low |

### 2.2 Out of scope (explicit)

- ❌ Any provider beyond Ollama (the 9 existing providers are final for V1/V1.1)
- ❌ `VisionProvider` interface changes
- ❌ `ProviderCapabilities` shape changes
- ❌ MCP tool schema/name changes
- ❌ Changes to any existing provider's adapter, config, or behavior
- ❌ OAuth, subscription-based auth, desktop-session auth, CLI-session auth
- ❌ Architecture studies for future authentication models
- ❌ Streaming support
- ❌ Retry/backoff (D8 — future hardening)
- ❌ Dependency audit (D11 — addressed in V1)
- ❌ MCP SDK upgrade (D12 — addressed in V1)
- ❌ `npm publish` (Version 1 must be published first)
- ❌ Stage 2 live validation for the existing 9 providers (separate, opportunistic)
- ❌ Removing `OpenRouterConfig` interface (removed in V1)
- ❌ Any change to the Version 1 release candidate's behavior

---

## 3. Explicit Out-of-Scope Items

See §2.2. The key boundary: **Version 1.1 is one new provider.** No architecture changes, no interface changes, no existing-provider modifications. The pattern is identical to the Azure adapter addition in Phase 2C — a dedicated class implementing the existing interface, wired through the existing factory.

---

## 4. Why Ollama Belongs in Version 1.1 Instead of Version 1

### 4.1 Version 1 is feature-complete and release-ready

The Release Readiness Review (approved) classified Version 1 as "APPROVE WITH MINOR RELEASE CHANGES" — only the final package naming decision remains. The engineering validation is complete (163/163 tests, 10/10 Stage 1 gates, MCP contract preserved, zero runtime vulnerabilities). Adding a 10th provider with a dedicated adapter right before release would:
- Introduce risk into a stable release candidate
- Require re-running the full validation gate
- Delay the release for a single-provider addition
- Create an asymmetry (Ollama live-validated; 9 others not)

### 4.2 Ollama requires a dedicated adapter (not "minimal, localized changes")

The Ollama Feasibility Assessment confirmed that Ollama Cloud's OpenAI-compatible `/v1/chat/completions` endpoint returns 401 with the available key. The native `/api/chat` endpoint works (including vision) but uses a different request/response shape. A dedicated `OllamaProvider` adapter (~150 lines + 12 tests) is required — comparable to the Azure adapter from Phase 2C. This is a proper engineering increment, not a config-only addition.

### 4.3 V1.1 is the right vehicle

V1.1 is a minor release (one new provider, non-breaking) that builds on the stable V1 foundation. It:
- Preserves V1's stability (no changes to existing providers)
- Adds the highest-value next provider (Ollama is the most popular local LLM runtime)
- Enables live validation (the available Cloud key confirms vision works)
- Follows the proven engineering discipline (plan → review → implement → validate → report)
- Is small enough to execute in ~4 hours

### 4.4 What V1.1 is NOT

- Not a major release (no breaking changes)
- Not a redesign (no interface changes)
- Not an architecture study (no auth model exploration)
- Not a multi-provider expansion (one provider, one adapter)

---

## 5. Local Ollama Implementation Strategy

### 5.1 Architecture

Local Ollama runs at `http://localhost:11434` by default. It exposes both:
- `/v1/chat/completions` (OpenAI-compatible) — works with `OpenAICompatibleProvider` (FC classification)
- `/api/chat` (native Ollama API) — requires the dedicated adapter

**Decision: use the native `/api/chat` endpoint for both local and Cloud.**

**Rationale:**
- A single `OllamaProvider` using `/api/chat` works for both local and Cloud — no conditional logic based on `baseUrl`
- The native API is equally functional for local use (Ollama's primary API; the OpenAI-compat layer is a convenience wrapper)
- Using the native API everywhere means one adapter class, one code path, one test suite — the cleanest design
- Local users who specifically want the OpenAI-compatible endpoint can still use `PROVIDER=ollama` with `BASE_URL=http://localhost:11434/v1` and... wait, no — that would route through `OpenAICompatibleProvider`, not `OllamaProvider`. The factory dispatches by `provider` id, not by `baseUrl`.

**Resolution:** The factory always dispatches `'ollama'` to `OllamaProvider`, regardless of `baseUrl`. `OllamaProvider` uses `/api/chat` (native). If a local user sets `BASE_URL=http://localhost:11434/v1` (the OpenAI-compat path), `OllamaProvider` would POST to `http://localhost:11434/v1/api/chat` which is wrong. **The `baseUrl` for Ollama must NOT include `/v1`** — it's the base without the `/v1` suffix (the native API is at `{baseUrl}/api/chat`, not `{baseUrl}/v1/api/chat`).

**Default `baseUrl`:** `http://localhost:11434` (no `/v1`; the adapter appends `/api/chat`)

For Ollama Cloud, the user sets `BASE_URL=https://api.ollama.com` (no `/v1`). The adapter appends `/api/chat`.

### 5.2 Local Ollama configuration

```bash
# Local Ollama (default)
PROVIDER=ollama
API_KEY=ollama          # required by the adapter but ignored by local Ollama
MODEL=llama3.2-vision    # or llava, gemma3:12b, minicpm-v, etc.
# BASE_URL defaults to http://localhost:11434
```

Local Ollama ignores the API key (any value works), but the adapter sends `Authorization: Bearer <key>` — Ollama accepts it silently. No special handling needed.

---

## 6. Ollama Cloud Implementation Strategy

### 6.1 Architecture

Ollama Cloud runs at `https://api.ollama.com`. The native `/api/chat` endpoint accepts `Authorization: Bearer <cloud-token>` and returns the native Ollama response shape.

```bash
# Ollama Cloud
PROVIDER=ollama
API_KEY=691babd3...      # the Cloud token
MODEL=gemma3:12b         # vision-capable model from the /v1/models list
BASE_URL=https://api.ollama.com
```

### 6.2 Key behavior

- `/v1/models` (OpenAI-compatible): returns 200 with a model list — used by `testConnection` and `validateModel`
- `/api/chat` (native): returns 200 with the native response — used by `analyzeImage`
- The adapter uses BOTH endpoints: `/v1/models` for discovery/validation, `/api/chat` for inference

**This is a hybrid adapter** — it's not purely OpenAI-compatible (the chat endpoint is native) but it IS OpenAI-compatible for the models list. `testConnection` and `validateModel` can use the `/v1/models` endpoint (which works with the Cloud key, confirmed empirically).

---

## 7. OllamaProvider Architecture

### 7.0 Ownership Boundary (Architectural Clarification)

`OllamaProvider` is the **single ownership boundary** for all Ollama-native protocol handling. This means:

- **Native Ollama request translation** (OpenAI multimodal → Ollama `/api/chat` shape) belongs **only** in `OllamaProvider`. No other file in the codebase contains Ollama-specific request construction logic.
- **Native Ollama response translation** (Ollama `/api/chat` response → `ImageAnalysisResult`) belongs **only** in `OllamaProvider`. No other file contains Ollama-specific response parsing logic.
- **Future Ollama-native capabilities** (e.g., Ollama's `keep_alive`, `num_ctx`, `num_gpu`, raw `/api/generate`, `/api/pull` endpoints, or any other Ollama-specific feature) must **extend `OllamaProvider`** rather than introducing protocol-specific logic into shared provider infrastructure (`OpenAICompatibleProvider`, `ProviderFactory`, `Config`, `types`, or tool handlers).

This boundary ensures long-term architectural consistency: the shared infrastructure remains protocol-neutral, and all Ollama-specific protocol knowledge is encapsulated in one file (`src/providers/ollama.ts`). The factory dispatches to `OllamaProvider`; the adapter handles the rest. No other component needs to know that Ollama uses a different API shape.

This clarification does not change the implementation scope — it documents the architectural invariant that the implementation must respect.

### 7.1 Class shape

```typescript
// src/providers/ollama.ts
import axios, { AxiosInstance } from 'axios';
import {
  ImageAnalysisResult,
  ProviderCapabilities,
  ProviderConfig,
  VisionProvider,
} from '../types/index.js';
import { Logger } from '../utils/logger.js';

export class OllamaProvider implements VisionProvider {
  private client: AxiosInstance;
  private config: ProviderConfig;
  private logger: Logger;
  public readonly capabilities: ProviderCapabilities;

  constructor(config: ProviderConfig, capabilities: ProviderCapabilities) {
    this.config = config;
    this.logger = Logger.getInstance();
    this.capabilities = capabilities;

    this.client = axios.create({
      baseURL: config.baseUrl,        // http://localhost:11434 or https://api.ollama.com
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        ...(config.extraHeaders ?? {}),
      },
      timeout: 120000,
      maxContentLength: 50 * 1024 * 1024,
      maxBodyLength: 50 * 1024 * 1024,
    });
  }
  // ...
}
```

### 7.2 Capabilities

```typescript
{ jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' }
```

- `jsonMode: true` — Ollama's native API supports `format: 'json'` (equivalent to `response_format: { type: 'json_object' }`), but the request field is different. The adapter translates.
- `modelsEndpoint: true` — the `/v1/models` endpoint works for both local and Cloud.
- `maxTokensField: 'max_tokens'` — the adapter translates to `options.num_predict` in the native API.

---

## 8. Request Translation Strategy

### 8.1 OpenAI multimodal → Ollama native `/api/chat`

| OpenAI field | Ollama native field | Translation |
|---|---|---|
| `model` | `model` | Direct (same field) |
| `messages[0].content[0].text` (prompt) | `messages[0].content` | Extract the text part; set as plain string |
| `messages[0].content[1].image_url.url` | `messages[0].images` | Extract the base64 from `data:image/...;base64,<data>`; set as `images: ['<raw-base64>']` (no data URL prefix) |
| `max_tokens` | `options.num_predict` | Move to nested `options` object |
| `temperature` | `options.temperature` | Move to nested `options` object |
| `response_format: { type: 'json_object' }` | `format: 'json'` | Translate the response_format to Ollama's `format` field |
| `stream` (not set) | `stream: false` | Explicitly set to `false` (non-streaming) |

### 8.2 Request body construction

```typescript
const requestBody = {
  model: this.config.model,
  messages: [{
    role: 'user',
    content: promptText,                    // plain string (not content array)
    images: imageData ? [imageData] : [],  // raw base64 array (no data: prefix)
  }],
  stream: false,
  options: {
    num_predict: Math.min(options.maxTokens || 4000, 8000),
    temperature: options.temperature || 0.1,
  },
  format: (options.format === 'json' && this.capabilities.jsonMode) ? 'json' : undefined,
};
```

### 8.3 Key differences from `OpenAICompatibleProvider`

1. **Content is a plain string**, not a `content[]` array with `type: 'text'` + `type: 'image_url'` parts.
2. **Images are a separate top-level array** on the message, not nested inside `content[]` as `image_url.url`.
3. **No `data:` prefix** on the base64 — Ollama expects raw base64, not a data URL.
4. **`max_tokens` becomes `options.num_predict`** — nested under `options`, not top-level.
5. **`response_format` becomes `format`** — Ollama's native field for JSON mode.
6. **`stream: false` is explicit** — Ollama defaults to streaming; the adapter must opt out.

---

## 9. Response Translation Strategy

### 9.1 Ollama native response → `ImageAnalysisResult`

| Ollama native field | `ImageAnalysisResult` field | Translation |
|---|---|---|
| `message.content` | `analysis` | Direct (string) |
| (no `choices[]` array) | — | No `choices[0]` unwrapping needed |
| `prompt_eval_count` | `usage.promptTokens` | Rename |
| `eval_count` | `usage.completionTokens` | Rename |
| `prompt_eval_count + eval_count` | `usage.totalTokens` | Sum |
| `model` | `model` | Direct |
| `done: true`, `done_reason: 'stop'` | (implicit success) | No translation needed (success is implicit from HTTP 200) |

### 9.2 Response parsing

```typescript
const content = response.data.message?.content;
if (!content) {
  throw new Error('Empty response from model');
}

const promptTokens = response.data.prompt_eval_count ?? 0;
const completionTokens = response.data.eval_count ?? 0;

// JSON mode: if format was 'json', try to parse the content as JSON
let analysis = content;
let structuredData: any;
if (options.format === 'json') {
  try {
    structuredData = JSON.parse(content);
    analysis = JSON.stringify(structuredData, null, 2);
  } catch {
    analysis = content;
    structuredData = { analysis: content };
  }
} else {
  structuredData = { analysis };
}

return {
  success: true,
  analysis,
  structuredData,
  model: this.config.model,
  usage: {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  },
};
```

### 9.3 Error handling

```typescript
private extractErrorMessage(error: any): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data?.error) {
      // Ollama native error shape: { "error": "model not found" }
      return `ollama API Error: ${typeof data.error === 'string' ? data.error : data.error.message || 'Unknown error'}`;
    }
    if (data?.message) {
      return `ollama API Error: ${data.message}`;
    }
    return `HTTP ${error.response?.status}: ${error.message}`;
  }
  if (error instanceof Error) return error.message;
  return 'Unknown error occurred';
}
```

---

## 10. Provider Factory Integration

### 10.1 `ProviderId` widening

```typescript
export type ProviderId =
  | 'openrouter' | 'openai' | 'together' | 'deepinfra' | 'fireworks'
  | 'groq' | 'chutes' | 'cerebras' | 'azure'
  | 'ollama';  // NEW
```

### 10.2 Factory case

```typescript
case 'ollama':
  return new OllamaProvider(config, capabilities);
```

### 10.3 `PROVIDER_CAPABILITIES` entry

```typescript
ollama: { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' },
```

### 10.4 `satisfies never` guard

The guard is restored after the case is added (same pattern as Phase 2C commit 8).

---

## 11. Configuration Strategy

### 11.1 `PROVIDER_DEFAULTS` entry

```typescript
ollama: {
  baseUrl: 'http://localhost:11434',   // local default; Cloud users override with https://api.ollama.com
  model: 'llama3.2-vision',            // vision-capable default
  requiresExplicitModel: false,        // has a default, but users commonly change it
},
```

### 11.2 Env vars for Ollama

```bash
# Local (default — zero config beyond PROVIDER + API_KEY + MODEL)
PROVIDER=ollama
API_KEY=ollama          # ignored by local Ollama, but sent as Bearer
MODEL=llama3.2-vision

# Cloud
PROVIDER=ollama
API_KEY=691babd3...      # the Cloud token
MODEL=gemma3:12b
BASE_URL=https://api.ollama.com
```

### 11.3 `.env.example` update

Add an Ollama section:
```bash
# Ollama (local or cloud)
# Local: BASE_URL defaults to http://localhost:11434; API_KEY can be any value (ignored)
# Cloud: set BASE_URL=https://api.ollama.com and API_KEY=<cloud-token>
# Vision models: llava, llama3.2-vision, gemma3:12b, minicpm-v, qwen3-vl
```

---

## 12. Testing Strategy

### 12.1 Unit tests (`test/unit/ollama-provider.test.ts`, ~12 tests)

| # | Test | Coverage |
|---|---|---|
| 1 | Constructor: Bearer auth + baseUrl | Auth config |
| 2 | `capabilities`: exposes injected values | Capability check |
| 3 | `analyzeImage`: success — request body is native shape (plain-string content + images array + options.num_predict) | Request translation |
| 4 | `analyzeImage`: success — response parsing (message.content → analysis; prompt_eval_count/eval_count → usage) | Response translation |
| 5 | `analyzeImage`: image data has no `data:` prefix (raw base64) | Request translation detail |
| 6 | `analyzeImage`: `format=json` sets Ollama's `format: 'json'` field (not `response_format`) | JSON mode translation |
| 7 | `analyzeImage`: `format=json` response is JSON-parsed; fallback to text on parse failure | JSON response handling |
| 8 | `analyzeImage`: empty response (no `message.content`) → error | Error path |
| 9 | `analyzeImage`: axios error → provider-aware `ollama API Error: ...` | Error handling |
| 10 | `analyzeImage`: generic error → error.message | Error handling |
| 11 | `testConnection`: `/v1/models` → 200 → true | Health check |
| 12 | `validateModel`: model exists in `/v1/models` → true | Model validation |

### 12.2 Factory tests (`test/unit/provider-factory.test.ts`, +2 tests)

- Dispatch: returns `OllamaProvider` for `'ollama'`
- Capabilities: correct `{ jsonMode, modelsEndpoint, maxTokensField }`

### 12.3 Config tests (`test/unit/config.test.ts`, +2 tests)

- Default resolution: `ollama` → `baseUrl: http://localhost:11434`, `model: llama3.2-vision`
- Custom `BASE_URL` override (Cloud)

### 12.4 Test count

Version 1: 163 tests → Version 1.1: ~179 tests (+16: 12 ollama-provider + 2 factory + 2 config)

---

## 13. Live Validation Strategy

### 13.1 Available credentials

`OLLAMA_API_KEY` (57 chars, format `691babd3...`) — valid for Ollama Cloud:
- `/v1/models` → 200 (model discovery)
- `/api/chat` (text) → 200 (text completion)
- `/api/chat` (vision with `images` field) → 200 (**vision analysis confirmed** in the feasibility assessment)

### 13.2 Live validation procedure

1. **Set env vars:**
   ```bash
   export PROVIDER=ollama
   export API_KEY=$OLLAMA_API_KEY
   export MODEL=gemma3:12b
   export BASE_URL=https://api.ollama.com
   export LOG_LEVEL=info
   ```

2. **Build:**
   ```bash
   npm run build
   ```

3. **Smoke test (tools/list):**
   ```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"initialize",...}{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
     | node dist/index.js
   ```
   Expected: 3 tools listed.

4. **Positive test (vision analysis):**
   ```bash
   B64=$(base64 -i /tmp/stage2-test.png | tr -d '\n')
   echo '{"jsonrpc":"2.0","id":1,...}{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"analyze_image","arguments":{"type":"base64","data":"'$B64'","mimeType":"image/png","prompt":"What do you see in this image? Answer in one sentence."}}}' \
     | node dist/index.js
   ```
   Expected: `isError: false`; `content[0].text` is a non-empty analysis of the screenshot.

5. **Negative test (invalid key):**
   ```bash
   export API_KEY=invalid-key
   # repeat the positive test
   ```
   Expected: `isError: true`; `content[0].text` contains `ollama API Error: ...`

6. **JSON mode test:**
   ```bash
   # repeat the positive test with format=json
   ```
   Expected: response text is valid JSON (or falls back to text).

7. **Record:** latency, response text, error messages, timestamp in the validation results file.

### 13.3 Expected outcome

Based on the feasibility assessment's empirical test (`/api/chat` with `images` field returned a real description of the test screenshot), the live validation should pass PS-1 (startup), PS-2 (analysis), and PS-3 (provider-aware error). This would make Ollama the **first live-validated provider** in the project.

### 13.4 What live validation confirms

- The `OllamaProvider` request translation is correct (the server sends the native shape; Ollama accepts it)
- The response translation is correct (the server parses `message.content` + `prompt_eval_count`/`eval_count` correctly)
- The MCP tool output pipeline works end-to-end with a real provider
- Provider-aware error handling works against a real 401/400
- The `format: 'json'` translation works for JSON mode

---

## 14. Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Ollama native API response shape differs from documented | Low | The feasibility assessment empirically tested `/api/chat` and confirmed the response shape (`message.content`, `prompt_eval_count`, `eval_count`). |
| Local Ollama's `/api/chat` has a slightly different response shape than Cloud | Low | The native API is the same for both local and Cloud (it's Ollama's own API, not a Cloud-specific wrapper). |
| The `/v1/models` endpoint works for Cloud but not local | Very Low | The feasibility assessment confirmed `/v1/models` works on Cloud. Local Ollama also exposes `/v1/models` (documented). |
| `format: 'json'` behavior differs between Ollama and OpenAI | Low | Ollama's `format: 'json'` returns JSON content; the adapter's `JSON.parse` + fallback handles both valid and invalid JSON. |
| Adding Ollama breaks the `satisfies never` guard | Very Low | Same pattern as Phase 2C: temporarily relax, add the case, restore. |
| Live validation reveals a translation bug | Low | Unit tests mock the exact request/response shape from the feasibility assessment. If the live test reveals a discrepancy, it's a unit-test-missing-scenario issue, fixable in the same phase. |
| Ollama Cloud model availability changes | Low | The user sets `MODEL`; the adapter passes it through. Model list is dynamic. |
| Ollama Cloud key expires before V1.1 execution | Low | The key is valid now; if it expires, live validation is deferred (same as Stage 2 for other providers). |
| V1.1 scope creep (adding more than Ollama) | Medium | The out-of-scope list (§2.2) is explicit. This is one provider, one adapter. |
| V1 release is delayed because V1.1 planning distracts | Low | V1 is feature-complete; V1.1 planning does not modify the V1 codebase. |

**Overall V1.1 risk: LOW.** The feasibility assessment de-risked the API surface; the adapter pattern is proven (Azure in Phase 2C); the tests mock the empirically-confirmed shapes.

---

## 15. Estimated Implementation Effort

| Item | Effort |
|---|---|
| `OllamaProvider` adapter (`src/providers/ollama.ts`) | 1.5 hours |
| Unit tests (`test/unit/ollama-provider.test.ts`, ~12 tests) | 1 hour |
| Factory + config + types + `.env.example` updates | 30 min |
| Factory + config tests | 30 min |
| README update (Ollama in provider table) | 15 min |
| Live validation (Ollama Cloud) | 30 min |
| Validation report + completion report | 30 min |
| **Total** | **~5 hours** (~0.5–1 engineer-day) |

---

## 16. Success Criteria

| # | Criterion | Verification |
|---|---|---|
| S1 | `npm run build` exit 0 | `npm run build` |
| S2 | `npm run lint` exit 0 | `npm run lint` (0 errors) |
| S3 | All tests pass (~179/179) | JSON reporter: 0 fail |
| S4 | Sentinel 8/8 | `/tmp/sentinel-check.sh` |
| S5 | MCP tool names + schemas unchanged | `diff` vs V1 |
| S6 | No existing provider behavior changed | all existing 163 tests still pass |
| S7 | `ProviderId` includes `'ollama'` | `grep` |
| S8 | `OllamaProvider` exists + implements `VisionProvider` | `ls` + `grep implements` |
| S9 | Factory dispatches `'ollama'` to `OllamaProvider` | factory test |
| S10 | `PROVIDER_DEFAULTS` has `'ollama'` entry | `grep` |
| S11 | `PROVIDER_CAPABILITIES` has `'ollama'` entry | `grep` |
| S12 | No new runtime dependencies | `diff` vs V1 deps |
| S13 | `.env.example` documents Ollama (local + Cloud) | `grep` |
| S14 | README includes Ollama in the provider table | `grep` |
| S15 | Live validation: Ollama Cloud vision analysis succeeds | MCP `tools/call` returns non-empty analysis |
| S16 | Live validation: provider-aware error on invalid key | MCP `tools/call` returns `ollama API Error: ...` |
| S17 | `satisfies never` guard restored | `grep` |
| S18 | No `VisionProvider` interface changes | `diff` vs V1 types |

**All 18 must hold for V1.1 completion.**

---

## 17. Completion Criteria

Version 1.1 is complete when ALL of the following hold:

1. All 18 success criteria (S1–S18) are verified green.
2. The implementation is organized into small, independently verifiable commits (estimated 4–5 commits).
3. Live validation is executed with the available `OLLAMA_API_KEY` and the results are recorded.
4. The Version 1.1 Completion Report is written.
5. The Version 1 codebase (the 9 existing providers) is not modified — V1.1 is purely additive.
6. No interface changes (`VisionProvider`, `ProviderCapabilities`).
7. No MCP schema changes.
8. The Version 1 release candidate is not touched (V1.1 branches from V1 or builds on top of it).

---

## 18. Expected Deliverables

1. **Version 1.1 Engineering Proposal** (this document, approved)
2. **4–5 commits** in the fork's git history:
   - `v1.1: add OllamaProvider adapter + unit tests`
   - `v1.1: widen ProviderId + PROVIDER_DEFAULTS + PROVIDER_CAPABILITIES + factory case`
   - `v1.1: add factory + config tests`
   - `v1.1: update .env.example + README with Ollama documentation`
   - `v1.1: live validation results + completion report`
3. **1 new source file:** `src/providers/ollama.ts` (~150 lines)
4. **1 new test file:** `test/unit/ollama-provider.test.ts` (~12 tests)
5. **4 modified files:** `src/types/index.ts`, `src/config/index.ts`, `src/providers/factory.ts`, `.env.example`
6. **1 modified test file:** `test/unit/provider-factory.test.ts`
7. **1 modified test file:** `test/unit/config.test.ts`
8. **README updated** with Ollama in the provider table
9. **Live validation results** recorded in a results file
10. **Version 1.1 Completion Report**

### Estimated effort
~5 hours / ~0.5–1 engineer-day

---

## 19. Relationship to Version 1

### What V1.1 does NOT change about V1
- The 9 existing providers are untouched
- The `VisionProvider` interface is unchanged
- The `ProviderCapabilities` shape is unchanged
- The MCP tool schemas are unchanged
- The `.env.example` legacy fallback is preserved
- The package name (placeholder) is unchanged (V1.1 doesn't resolve the naming)
- The README's validation-status disclosure is preserved (Ollama is live-validated; the other 9 remain "pending")

### What V1.1 adds to V1
- A 10th provider (`ollama`) with a dedicated adapter
- ~16 new tests (163 → ~179)
- Ollama documentation in `.env.example` + README
- The first live-validated provider (Ollama Cloud, if the key is still valid)

### Versioning
- Version 1.1 is a **minor release** (non-breaking; one new provider)
- The version in `package.json` goes from `2.0.0` to `2.1.0` (semver minor: new feature, non-breaking)
- Users on V1 (`2.0.0`) can upgrade to V1.1 (`2.1.0`) with zero config changes

---

## 20. Approval Checklist

Before implementation begins, confirm:

- [ ] §1 Objectives match intent (one new provider; preserve V1 stability).
- [ ] §2/§3 Scope and out-of-scope are correct (no auth models, no redesign, no existing-provider changes).
- [ ] §4 Why V1.1 not V1 is agreed (V1 is feature-complete; Ollama needs a dedicated adapter).
- [ ] §5/§6 Local + Cloud strategies are acceptable (single adapter, native `/api/chat`, one `PROVIDER=ollama`).
- [ ] §7 `OllamaProvider` architecture is acceptable (implements `VisionProvider`, same pattern as Azure).
- [ ] §8/§9 Request/response translation is correct per the empirical evidence.
- [ ] §10/§11 Factory + config integration is acceptable.
- [ ] §12 Testing strategy covers all translation paths (~16 new tests).
- [ ] §13 Live validation strategy is executable with the available key.
- [ ] §14 Risk assessment is acceptable (LOW overall).
- [ ] §16/§17 Success + completion criteria are the correct bar.
- [ ] §19 Relationship to V1 is clear (additive, non-breaking, semver minor).

---

**Awaiting approval. No code changes will be made until this proposal is authorized.**