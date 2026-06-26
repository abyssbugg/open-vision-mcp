# PHASE 2C — Implementation Plan: Provider Expansion and Deferred Hygiene

**Status:** Approved (revised per Pre-Implementation Readiness Review — R1 through R6 incorporated)
**Predecessor:** Phase Transition Report (approved); Phase 3 (approved, complete)
**Codebase under plan:** fork HEAD `5076c85` (Phase 3 final)
**Scope:** Add 3 deferred providers (Chutes, Cerebras, Azure); resolve deferred hygiene D4, D5, D6.
**Principle:** Hygiene first, then providers — the new providers are born into a cleaned-up codebase. Small, incremental, independently verifiable commits. The green Phase 3 test suite (136/136) is the safety net.

---

## 1. Phase Objectives

1. **Resolve D4** — startup log strings in `src/index.ts` become provider-aware (no hardcoded "OpenRouter" when `PROVIDER != openrouter`).
2. **Resolve D5** — remove the vision-by-name heuristic in `OpenAICompatibleProvider.validateModel`; trust the user's model id; warn if `/models` reports the model lacks vision modality.
3. **Resolve D6** — gate `response_format: { type: 'json_object' }` on `provider.capabilities.jsonMode` so non-JSON-mode providers don't break.
4. **Add Chutes** (`'chutes'`) — extends `OpenAICompatibleProvider` with a `supported_features` preflight in `validateModel`.
5. **Add Cerebras** (`'cerebras'`) — uses `OpenAICompatibleProvider` directly (conditional on Spike 2A-1 confirming vision support; if the spike fails or is skipped, Cerebras is deferred and documented).
6. **Add Azure OpenAI** (`'azure'`) — dedicated `AzureOpenAIProvider implements VisionProvider` (different auth scheme `api-key`, deployment-based URL, no `/models` endpoint).
7. **Preserve the MCP contract** — no tool name, schema, or output format changes.
8. **Preserve runtime behavior for existing 6 providers** — the D4/D5/D6 hygiene changes must not change the HTTP request body, response parsing, or error messages for the 6 existing providers.

**What this phase IS NOT:**
- Adding providers beyond Chutes, Cerebras, Azure (Phase 2A scope is the ceiling)
- Changing the `VisionProvider` interface or `ProviderCapabilities` shape (Phase 2A confirmed sufficiency)
- Changing MCP tool schemas or names
- Live API validation (that's Phase 2B.5 Stage 2, after 2C)
- README rewrite / npm package rename (Phase 4)
- Dependency audit / MCP SDK upgrade (Phase 4)
- Removing the committed `.tgz` (Phase 4)
- Removing the `OpenRouterConfig` interface alias (Phase 4, at package rename)
- Implementing retry/backoff (future hardening)
- Removing the singleton pattern on `Config`/`Logger`/`ImageProcessor` (out of scope)

---

## 2. Scope

### 2.1 In scope

| Item | Debt/Provider | Classification | Effort |
|---|---|---|---|
| D4 — provider-aware startup log strings | D4 | Hygiene | Low |
| D5 — remove vision-by-name heuristic | D5 | Hygiene | Low |
| D6 — gate `response_format` on `capabilities.jsonMode` | D6 | Hygiene | Low |
| Spike 2A-1 — Cerebras vision support verification | Spike | Validation | 30 min (requires key) |
| Chutes provider | New | CA (Compatible with Adapter) | Medium |
| Cerebras provider | New | CA (conditional on spike) | Low (if spike passes) |
| Azure OpenAI provider | New | PSI (Provider-Specific Implementation) | Medium-High |
| `ProviderId` widening (3 new members) | Config | — | Trivial |
| `PROVIDER_DEFAULTS` additions (3 entries) | Config | — | Low |
| `PROVIDER_CAPABILITIES` additions (3 entries) | Config | — | Low |
| Factory `case` additions (3) | Factory | — | Low |
| Unit tests for 3 new providers + D4/D5/D6 | Tests | — | Medium |

### 2.2 Out of scope (explicit)

- ❌ Any provider not in {Chutes, Cerebras, Azure} — Phase 2A is the ceiling
- ❌ Anthropic native, Gemini native, Bedrock — not on the roadmap
- ❌ `VisionProvider` interface changes
- ❌ `ProviderCapabilities` shape changes
- ❌ MCP tool schema changes
- ❌ Live API calls in CI (no keys; unit tests use mocked HTTP)
- ❌ README / npm rename / `.tgz` removal — Phase 4
- ❌ `OpenRouterConfig` alias removal — Phase 4 (at package rename)
- ❌ Dependency audit, MCP SDK upgrade — Phase 4
- ❌ Retry/backoff implementation — future hardening
- ❌ Streaming support — out of scope

---

## 3. Explicit Out-of-Scope Items

See §2.2 above. The key boundaries:
- **No new abstractions.** The `VisionProvider` interface, `ProviderCapabilities`, and `ProviderFactory` are unchanged in shape. Phase 2A confirmed they are sufficient.
- **No new dependencies.** The shared adapter uses `axios`; Azure uses the same `axios`. No new npm packages.
- **No MCP contract changes.** Tool names, schemas, and output format are byte-identical to baseline.
- **No live validation.** Unit tests mock HTTP. Live validation is Phase 2B.5 Stage 2.
- **No Phase 4 work.** README, npm rename, `.tgz` removal, dependency audit, MCP SDK upgrade are all Phase 4.

---

## 4. Technical Objectives

1. **Hygiene before providers.** D4, D5, D6 are resolved before any new provider is added, so the new providers are born into a clean codebase.
2. **Minimal per-provider code.** Chutes and Cerebras extend `OpenAICompatibleProvider` (subclass or config-only entry). Azure is the only dedicated adapter class.
3. **Per-provider capability accuracy.** `PROVIDER_CAPABILITIES` reflects each provider's actual capabilities. Azure gets `modelsEndpoint: false` (no `/v1/models`).
4. **`ProviderId` exhaustiveness.** The factory's `satisfies never` guard continues to catch missing cases.
5. **Test coverage for every change.** D4/D5/D6 get regression tests. Each new provider gets dispatch + capability tests. The sentinel stays 8/8.
6. **No behavior change for existing 6 providers.** D5 changes `validateModel`'s heuristic but the method already returns `true` when the model exists (the heuristic only logs a warning). D6 adds a conditional that's a no-op for all 6 current providers (all have `jsonMode: true`). D4 changes log strings — the only observable behavior change, and it's the intended one.

---

## 5. Root-Cause Analysis of D4, D5, D6

### 5.1 D4 — Startup log strings say "OpenRouter"

**Evidence:** `src/index.ts:22,239,245,248,250` contain hardcoded "OpenRouter" strings:
- Line 22: `logger.info('Starting OpenRouter Image MCP Server');`
- Line 239: `logger.info('OpenRouter Image MCP Server started successfully');`
- Line 245: `logger.info('Testing OpenRouter API connection...');`
- Line 248: `logger.error('Failed to connect to OpenRouter API - tools may not work');`
- Line 250: `logger.info('OpenRouter API connection successful');`

Also line 36: `name: 'openrouter-image-mcp'` (the MCP server name) and line 52: `description: 'Analyze images using OpenRouter\'s vision models...'` (the tool description).

**Root cause:** Phase 2B commit 5 (the `index.ts` cleanup) intentionally left these unchanged to keep the commit mechanical (rename `openRouterConfig` → `providerConfig`). The Phase 2B Completion Report §9 documented this as deferred debt. The Phase 2B.5 Stage 1 §6.2 confirmed the startup log strings say "OpenRouter" when `PROVIDER != openrouter`, which is misleading.

**Fix:** Make the log strings use `providerConfig.provider` (e.g., `Starting ${provider} Image MCP Server`). The MCP server `name` (line 36) and tool `description` (line 52) are user-facing schema fields — those should be neutralized to avoid leaking "OpenRouter" into the MCP client's tool listing.

### 5.2 D5 — Vision-by-name heuristic in `validateModel`

**Evidence:** `src/providers/openai-compatible.ts:77-88`:
```typescript
const modelLower = modelId.toLowerCase();
const supportsVision = model?.architecture?.modality?.includes('vision') ||
                      model?.architecture?.modality?.includes('image') ||
                      model?.capabilities?.vision ||
                      modelLower.includes('vision') ||
                      modelLower.includes('claude-3') ||
                      modelLower.includes('claude-3.5') ||
                      modelLower.includes('gpt-4-vision') ||
                      modelLower.includes('gpt-4o') ||
                      modelLower.includes('gemini') ||
                      modelLower.includes('llama-3.2-90b-vision') ||
                      modelLower.includes('llama-3.2-11b-vision');
```

**Root cause:** This heuristic was inherited verbatim from the Phase 1 `OpenRouterClient` (Phase 0 finding). It's brittle (hardcoded model-name patterns), provider-specific (only OpenRouter returns the `architecture.modality` field; other providers' `/models` responses have different shapes), and increasingly wrong as new providers are added (Chutes/Cerebras/Azure model ids don't match these patterns).

**Behavioral impact:** The heuristic only affects a `logger.warn` — `validateModel` returns `true` regardless (line 89 in the original). So removing it does not change the method's return value; it only stops the misleading "Model may not support vision" warning for models that don't match the pattern.

**Fix:** Remove the `modelLower.includes(...)` block entirely. Keep the `model?.architecture?.modality?.includes('vision')` check (it's based on the provider's actual response, not a name pattern). If the `/models` response doesn't include modality info (Azure, some OpenAI-compatible providers), `validateModel` returns `true` without a warning (trust the user's model id). The method's return value is unchanged.

**Note (R2):** After this change, `validateModel` may log "Model may not support vision" more often for providers whose `/models` response doesn't include `architecture.modality` (e.g., some OpenAI-compatible providers that return a different schema). This is the intended behavior — the method trusts the user's model id and only warns based on provider-reported metadata, not name patterns. The commit message must include this note so future maintainers understand the increased warning frequency is expected.

### 5.3 D6 — `response_format` not gated on `capabilities.jsonMode`

**Evidence:** `src/providers/openai-compatible.ts:156`:
```typescript
response_format: options.format === 'json' ? { type: 'json_object' } : undefined,
```

**Root cause:** The `response_format` is sent unconditionally whenever `options.format === 'json'`, regardless of whether the provider supports JSON mode. For the 6 current providers (all `jsonMode: true`), this is a no-op. But Azure (and potentially other future providers) may have models that reject `response_format: { type: 'json_object' }`.

**Fix:** Gate on `this.capabilities.jsonMode`:
```typescript
response_format: (options.format === 'json' && this.capabilities.jsonMode)
  ? { type: 'json_object' }
  : undefined,
```

For all 6 current providers (`jsonMode: true`), the behavior is byte-identical. For Azure (`jsonMode: true` on supported models), the behavior is also unchanged. The gating is forward-compatible: if a future provider sets `jsonMode: false`, the `response_format` is omitted, and the tool handler's existing JSON-parsing fallback (in `analyze-image.ts`) handles the case where the model returns JSON-like text without the `response_format` hint.

---

## 6. Spike 2A-1 Execution Plan

### 6.1 Objective
Determine whether Cerebras supports multimodal (vision) input on the `llama-4-scout-17b-16e-instruct` model.

### 6.2 Method
A 30-minute manual spike using a real Cerebras API key (if available).

```bash
curl -X POST https://api.cerebras.ai/v1/chat/completions \
  -H "Authorization: Bearer $CEREBRAS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-4-scout-17b-16e-instruct",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "text", "text": "What do you see in this image? Answer in one sentence."},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="}}
      ]
    }],
    "max_tokens": 100
  }'
```

### 6.3 Outcomes

| Result | Action |
|---|---|
| **200 with content describing the image** | Cerebras classified as FC; implement as a config-only entry (like Groq) using `OpenAICompatibleProvider` directly |
| **4xx with "image not supported" or similar** | Cerebras classified as text-only; **defer Cerebras** to a future phase; document in the completion report |
| **200 with non-vision response** (model ignored the image) | Same as 4xx — defer |
| **No Cerebras API key available** | **Skip the spike**; implement Cerebras as a config-only entry *assuming* vision support (optimistic), with a clear warning in `.env.example` that Cerebras vision support is unverified. Document in the completion report that live validation is pending. |

### 6.4 Gate
The spike is **optional** for Phase 2C implementation. Cerebras can be implemented optimistically (config-only entry) without the spike, with the understanding that live validation (Stage 2) is the true gate. If the spike is not possible (no key), Cerebras is still added — the risk is that a user configures `PROVIDER=cerebras` and gets a vision-error at runtime, which is a user-experience issue, not a code defect.

**Recommendation:** attempt the spike if a key is available; otherwise, implement optimistically and document.

---

## 7. Chutes Implementation Strategy

### 7.1 Classification (Phase 2A): CA — Compatible with Adapter

**Why CA, not FC:** Chutes' `/models` response includes a per-model `supported_features` field. Capability (JSON mode, vision) varies by model, not just by provider. A pure config-only entry would miss this.

### 7.2 Implementation

**Approach:** subclass `OpenAICompatibleProvider` with a `ChutesProvider` that overrides `validateModel` to consult `supported_features`.

```typescript
// src/providers/chutes.ts
import { OpenAICompatibleProvider } from './openai-compatible.js';

export class ChutesProvider extends OpenAICompatibleProvider {
  // Chutes /models returns supported_features per model. Override
  // validateModel to check it and warn if the model lacks vision or
  // json support.
  // (The parent validateModel is inherited; Chutes only needs the
  //  per-model capability check, which is additive.)
}
```

**Actually, on inspection:** the parent `validateModel` already fetches `/models` and checks `model?.architecture?.modality`. Chutes' `supported_features` is a different field. The cleanest approach: override `validateModel` in `ChutesProvider` to also check `supported_features` (in addition to the inherited modality check).

**Factory wiring:**
```typescript
case 'chutes':
  return new ChutesProvider(config, capabilities);
```

**Config:**
```typescript
chutes: {
  baseUrl: 'https://llm.chutes.ai/v1',
  requiresExplicitModel: true,  // multi-model aggregator
},
```

**Capabilities:**
```typescript
chutes: { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' },
```

### 7.3 Tests
- Factory dispatch returns `ChutesProvider` for `'chutes'`
- `ChutesProvider.validateModel` checks `supported_features` (mocked `/models` response)
- Inherited `analyzeImage` behavior is unchanged (covered by parent's tests)

---

## 8. Cerebras Implementation Strategy

### 8.1 Classification (Phase 2A): CA — conditional on Spike 2A-1

### 8.2 Implementation

**If Spike 2A-1 confirms vision:** Cerebras is FC — a config-only entry using `OpenAICompatibleProvider` directly (like Groq).

**If Spike 2A-1 fails or is skipped:** Cerebras is still added as a config-only entry (optimistic), with `.env.example` noting that vision support is unverified. The risk is a runtime error if the user configures a non-vision model, which is a user-experience issue, not a code defect.

**Approach:** implement as a config-only entry regardless of spike outcome.

```typescript
cerebras: {
  baseUrl: 'https://api.cerebras.ai/v1',
  model: 'llama-4-scout-17b-16e-instruct',  // optimistic default; unverified
},
```

**Capabilities:**
```typescript
cerebras: { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' },
```

**Factory:** `case 'cerebras': return new OpenAICompatibleProvider(config, capabilities);` (no dedicated class)

### 8.3 Tests
- Factory dispatch returns `OpenAICompatibleProvider` for `'cerebras'`
- Default model resolution (`llama-4-scout-17b-16e-instruct`)
- `validateModel` works against a mocked `/models` response

---

## 9. Azure Implementation Strategy

### 9.1 Classification (Phase 2A): PSI — Provider-Specific Implementation

**Why PSI:**
1. **Auth:** Azure uses `api-key: <key>` header, not `Authorization: Bearer <key>`.
2. **URL shape:** `https://<resource>.openai.azure.com/openai/deployments/<deployment>/chat/completions?api-version=<version>` — the deployment name is in the URL path, not the request body's `model` field.
3. **No `/models` endpoint:** Azure uses deployment-based discovery (configured out-of-band), not a `/v1/models` list. So `testConnection` and `validateModel` behave differently.

### 9.2 Implementation

**Dedicated class:** `src/providers/azure.ts` — `AzureOpenAIProvider implements VisionProvider`.

```typescript
export class AzureOpenAIProvider implements VisionProvider {
  public readonly capabilities: ProviderCapabilities;
  private client: AxiosInstance;
  private config: ProviderConfig;
  private logger: Logger;

  constructor(config: ProviderConfig, capabilities: ProviderCapabilities) {
    // config.baseUrl is the full deployment URL:
    //   https://<resource>.openai.azure.com/openai/deployments/<deployment>
    // The adapter appends /chat/completions?api-version=...
    // api-version comes from config.extraHeaders or a new config field.
    // Auth: api-key header instead of Authorization: Bearer.
  }

  async analyzeImage(...): Promise<ImageAnalysisResult> {
    // POST {baseUrl}/chat/completions?api-version={version}
    // Body: same OpenAI multimodal shape, but 'model' field is ignored
    //       by Azure (the deployment is in the URL). Send it anyway for
    //       logging consistency.
    // Response parsing: identical to OpenAICompatibleProvider.
  }

  async testConnection(): Promise<boolean> {
    // Azure has no /models. Use a minimal chat completion as the health
    // check, or just return true if the deployment URL is configured.
    // Simplest: return true (the first analyzeImage call is the real
    // health check). Document this.
  }

  async validateModel?(modelId: string): Promise<boolean> {
    // Azure has no /models. The "model" is the deployment name, which
    // is part of baseUrl. Return true (trust the user's deployment URL).
  }
}
```

### 9.3 Design decisions

1. **`api-version` handling (R6):** Azure requires an `api-version` query parameter. Encode it in `baseUrl` (user supplies `...?api-version=2024-...`). Keeps `ProviderConfig` unchanged and follows the full-prefix `baseUrl` design rule. Documented in `.env.example`.

2. **`model` field in request body (R1):** Azure ignores the `model` field (the deployment is in the URL). **Omit it from the Azure request body entirely** — do not send `model: this.config.model`. This avoids ambiguity (a mismatched `model` field could cause a 400) and is the correct Azure pattern. Add a code comment: "Azure routes by deployment URL; the model field is not needed in the body."

3. **`testConnection` (R3):** Azure has no `/models`. Return `true` unconditionally — a real health check requires a chat completion, which costs tokens and requires a prompt. The first `analyzeImage` call is the real validation. **Add a code comment** in `AzureOpenAIProvider.testConnection`: "Azure has no /models endpoint; deployment discovery is out-of-band. Returns true unconditionally — the first analyzeImage call is the real health check."

4. **`validateModel`:** return `true` (no `/models` endpoint). The "model" is the deployment, configured out-of-band. Same no-op rationale as `testConnection`.

5. **Response parsing:** identical to `OpenAICompatibleProvider` (Azure returns the standard OpenAI chat completion response shape). The `extractErrorMessage` uses `config.provider` for provider-aware errors. **Note (deferred):** a shared `parseChatCompletionResponse` utility could reduce duplication between the two adapters, but extracting it is a refactor, not a Phase 2C requirement. Accept the duplication; extract if a future phase adds more PSI providers.

### 9.4 Factory wiring
```typescript
case 'azure':
  return new AzureOpenAIProvider(config, capabilities);
```

### 9.5 Config (R4)
```typescript
azure: {
  baseUrl: '',  // required — user must set BASE_URL to the full deployment URL + ?api-version=
  requiresExplicitModel: false,  // R4: Azure ignores MODEL (deployment is in BASE_URL)
},
```
The dedicated `BASE_URL`-required validation (§11.2) enforces that Azure has a non-empty `baseUrl`.

### 9.6 Capabilities
```typescript
azure: { jsonMode: true, modelsEndpoint: false, maxTokensField: 'max_tokens' },
```

### 9.7 Tests
- Factory dispatch returns `AzureOpenAIProvider` for `'azure'`
- `analyzeImage` sends `api-key` header (not Bearer)
- `analyzeImage` POSTs to the full `baseUrl` (no path appending)
- `testConnection` returns `true` without an HTTP call
- `validateModel` returns `true` without an HTTP call
- `capabilities.modelsEndpoint` is `false`
- Response parsing matches `OpenAICompatibleProvider` (same response shape)
- Error messages are provider-aware (`azure API Error: ...`)

---

## 10. Factory Update Strategy

### 10.1 `ProviderId` widening (§13 for full type)

```typescript
export type ProviderId =
  | 'openrouter'
  | 'openai'
  | 'together'
  | 'deepinfra'
  | 'fireworks'
  | 'groq'
  | 'chutes'
  | 'cerebras'
  | 'azure';
```

### 10.2 Factory switch

```typescript
switch (config.provider) {
  case 'openrouter':
  case 'openai':
  case 'together':
  case 'deepinfra':
  case 'fireworks':
  case 'groq':
  case 'cerebras':           // NEW — uses OpenAICompatibleProvider directly
    return new OpenAICompatibleProvider(config, capabilities);
  case 'chutes':             // NEW — uses ChutesProvider (subclass)
    return new ChutesProvider(config, capabilities);
  case 'azure':              // NEW — uses AzureOpenAIProvider (dedicated)
    return new AzureOpenAIProvider(config, capabilities);
  default:
    throw new Error(`Unknown provider: ${config.provider satisfies never}`);
}
```

The `satisfies never` exhaustiveness guard continues to work: adding a new `ProviderId` member without a case breaks the build.

### 10.3 `PROVIDER_CAPABILITIES` additions

```typescript
chutes: { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' },
cerebras: { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' },
azure: { jsonMode: true, modelsEndpoint: false, maxTokensField: 'max_tokens' },
```

Azure is the only one with `modelsEndpoint: false`.

---

## 11. Configuration Update Strategy

### 11.1 `PROVIDER_DEFAULTS` additions (R4)

```typescript
chutes: {
  baseUrl: 'https://llm.chutes.ai/v1',
  requiresExplicitModel: true,
},
cerebras: {
  baseUrl: 'https://api.cerebras.ai/v1',
  model: 'llama-4-scout-17b-16e-instruct',  // optimistic; unverified by spike
},
azure: {
  baseUrl: '',  // required: user must set BASE_URL to the full deployment URL + ?api-version=
  requiresExplicitModel: false,  // R4: Azure ignores MODEL (deployment is in BASE_URL)
},
```

### 11.2 `Config` validation

The existing `validateEnvironment` + per-provider default resolution handles the new providers without changes. `requiresExplicitModel: true` for Chutes means a missing `MODEL` throws the existing clear error. Azure has `requiresExplicitModel: false` (R4), so `MODEL` is optional for Azure — and it's ignored at runtime (R1: Azure adapter omits the `model` field from the request body).

For Azure, `baseUrl` is required (no default — empty string). The existing resolution (`process.env.BASE_URL ?? process.env.OPENROUTER_BASE_URL ?? defaults.baseUrl`) would produce an empty string if `BASE_URL` is unset. Add a validation: if `provider === 'azure'` and `baseUrl` is empty (or only whitespace), throw a clear error: `BASE_URL is required for provider 'azure' (Azure uses deployment-specific URLs including ?api-version=, not a per-provider default).`

### 11.3 `.env.example` update (R6)

Add the 3 new providers to the `PROVIDER=` comment. Document Azure's `BASE_URL` requirement including `?api-version=`. Note that `MODEL` is ignored for Azure.

---

## 12. Provider Capabilities Update Strategy

See §10.3. The `ProviderCapabilities` interface shape is unchanged. Only the `PROVIDER_CAPABILITIES` record gains 3 entries.

**D6 interaction:** the `capabilities.jsonMode` gating in `analyzeImage` reads from the injected capabilities. For Azure (`jsonMode: true`), the gating passes. For Chutes/Cerebras (`jsonMode: true`), same. The gating only matters for future providers with `jsonMode: false`, which are out of scope for 2C but the gating is forward-compatible.

---

## 13. Unit Test Strategy

### 13.1 Tests for D4 (provider-aware log strings)

Add to a new `test/unit/index.test.ts` OR extend the sentinel — but the sentinel is black-box. **Better:** add a focused unit test that imports `main` and verifies the log strings contain the provider id. However, `main()` starts the server and calls `process.exit` on error, making it hard to unit-test. **Pragmatic approach:** static verification — grep the log strings for template-literal usage of `providerConfig.provider`. This is covered by the code review, not a unit test.

**Decision:** D4 is verified by code inspection + the sentinel (black-box). No new unit test for D4.

### 13.2 Tests for D5 (vision heuristic removal)

Update `test/unit/openai-compatible-provider.test.ts`:
- The 2 existing `validateModel` tests already cover "model exists" and "model not found". Add 1 test: `validateModel` returns `true` for a model whose name doesn't match any pattern (e.g., `'some-custom-model'`), verifying the heuristic is gone.

### 13.3 Tests for D6 (`response_format` gating)

Update `test/unit/openai-compatible-provider.test.ts`:
- Add 1 test: when `capabilities.jsonMode` is `false` and `options.format === 'json'`, the request body does NOT include `response_format`. This requires constructing a provider with `jsonMode: false` capabilities (not currently in `PROVIDER_CAPABILITIES`, but the test can inject it directly).

### 13.4 Tests for Chutes

New file `test/unit/chutes-provider.test.ts` (or extend `openai-compatible-provider.test.ts`):
- `ChutesProvider.validateModel` checks `supported_features` (mock `/models` response with `supported_features: ['vision', 'json']`)
- Inherited `analyzeImage` behavior (covered by parent tests, no need to duplicate)

### 13.5 Tests for Cerebras

Extend `test/unit/provider-factory.test.ts`:
- Factory dispatch returns `OpenAICompatibleProvider` for `'cerebras'`
- Default model is `llama-4-scout-17b-16e-instruct`

### 13.6 Tests for Azure

New file `test/unit/azure-provider.test.ts`:
- `analyzeImage` sends `api-key` header (not Bearer)
- `analyzeImage` POSTs to the full `baseUrl` (no path appending)
- `testConnection` returns `true` without HTTP call
- `validateModel` returns `true` without HTTP call
- `capabilities.modelsEndpoint` is `false`
- Response parsing matches the OpenAI shape
- Error messages are provider-aware (`azure API Error: ...`)
- D6 gating: with `jsonMode: true` (Azure's default), `response_format` is sent when `format=json`

### 13.7 Factory test updates

Extend `test/unit/provider-factory.test.ts`:
- 3 new dispatch tests (Chutes returns `ChutesProvider`, Cerebras returns `OpenAICompatibleProvider`, Azure returns `AzureOpenAIProvider`)
- 3 new capability tests
- The "unknown provider" error message test verifies all 9 valid ids are listed

### 13.8 Config test updates

Extend `test/unit/config.test.ts`:
- Per-provider default resolution for Chutes, Cerebras, Azure
- Missing `MODEL` error for Chutes and Azure
- Azure missing `BASE_URL` error

### 13.9 Sentinel

The sentinel (`test/integration/mcp-server.test.ts`) stays 8/8. It uses legacy env vars (`PROVIDER` defaults to `openrouter`), so the new providers don't affect it. No changes needed.

---

## 14. Integration Validation Strategy

### 14.1 Per-commit

After each commit:
1. `npm run build` — exit 0
2. `npm run lint` — exit 0 (0 errors)
3. `CI=true npx vitest run --reporter=json` — all tests pass (JSON reporter is authoritative)
4. `/tmp/sentinel-check.sh` — 8/8
5. `grep -rn "OpenRouterClient" src/ test/` — 0 hits (maintained from Phase 3)
6. MCP schema diff vs baseline — byte-identical

### 14.2 End-of-phase

Full Phase 2C validation gate (see §20).

### 14.3 Live validation

**Deferred to Phase 2B.5 Stage 2.** Phase 2C does not make live API calls. Unit tests mock HTTP at the axios layer.

---

## 15. File-by-File Implementation Plan

### 15.1 Source files to modify (5)

| File | Change | Lines (est.) |
|---|---|---|
| `src/index.ts` | D4: provider-aware log strings + neutral MCP server name + neutral tool descriptions | ~10 lines |
| `src/providers/openai-compatible.ts` | D5: remove vision-by-name heuristic (lines 77-88); D6: gate `response_format` on `capabilities.jsonMode` (line 156) | -12, +1 |
| `src/providers/factory.ts` | 3 new `case`s + import `ChutesProvider` + import `AzureOpenAIProvider` + 3 new `PROVIDER_CAPABILITIES` entries | ~15 lines |
| `src/config/index.ts` | 3 new `PROVIDER_DEFAULTS` entries + Azure `BASE_URL`-required validation | ~12 lines |
| `src/types/index.ts` | Widen `ProviderId` (3 new members) | +3 lines |
| `.env.example` | Document 3 new providers + Azure `BASE_URL` requirement | ~10 lines |

### 15.2 Source files to add (2)

| File | Purpose |
|---|---|
| `src/providers/chutes.ts` | `ChutesProvider extends OpenAICompatibleProvider` — overrides `validateModel` for `supported_features` check |
| `src/providers/azure.ts` | `AzureOpenAIProvider implements VisionProvider` — dedicated adapter (api-key auth, no /models) |

### 15.3 Test files to modify (3)

| File | Change |
|---|---|
| `test/unit/openai-compatible-provider.test.ts` | +1 test (D5: no heuristic), +1 test (D6: jsonMode false) |
| `test/unit/provider-factory.test.ts` | +3 dispatch tests, +3 capability tests, update valid-id list |
| `test/unit/config.test.ts` | +3 default resolution tests, +2 missing-MODEL tests, +1 Azure missing-BASE_URL test |

### 15.4 Test files to add (2)

| File | Purpose |
|---|---|
| `test/unit/chutes-provider.test.ts` | `ChutesProvider.validateModel` `supported_features` check |
| `test/unit/azure-provider.test.ts` | Azure auth, URL, testConnection, validateModel, capabilities, response parsing, error messages |

---

## 16. Commit Sequence

**10 commits, ordered: hygiene first (D4, D5, D6), then config widening, then providers one-by-one, each with tests, then `.env.example`.**

```
phase2c: D4 provider-aware startup log strings + neutral MCP/tool metadata
phase2c: D5 remove vision-by-name heuristic from validateModel
phase2c: D6 gate response_format on capabilities.jsonMode
phase2c: widen ProviderId + PROVIDER_DEFAULTS + PROVIDER_CAPABILITIES for 3 new providers
phase2c: add ChutesProvider (extends OpenAICompatibleProvider) + tests
phase2c: add Cerebras provider (config-only) + factory case + tests
phase2c: add AzureOpenAIProvider (dedicated adapter) + tests
phase2c: wire factory to dispatch Chutes/Cerebras/Azure + factory tests
phase2c: Azure BASE_URL-required validation + config tests
phase2c: update .env.example with 3 new providers + Azure BASE_URL note
```

### 16.1 Per-commit buildability

Each commit must leave the repo buildable (build + lint + tests + sentinel green).

| Commit | Build | Lint | Tests | Sentinel |
|---|---|---|---|---|
| 1 (D4) | ✅ | ✅ | 136/136 | 8/8 |
| 2 (D5) | ✅ | ✅ | 137/137 (+1) | 8/8 |
| 3 (D6) | ✅ | ✅ | 138/138 (+1) | 8/8 |
| 4 (widen types) | ✅ | ✅ | 138/138 (additive) | 8/8 |
| 5 (Chutes) | ✅ | ✅ | ~143 (+5) | 8/8 |
| 6 (Cerebras) | ✅ | ✅ | ~145 (+2) | 8/8 |
| 7 (Azure adapter) | ✅ | ✅ | ~153 (+8) | 8/8 |
| 8 (factory wire) | ✅ | ✅ | ~158 (+5) | 8/8 |
| 9 (Azure config validation) | ✅ | ✅ | ~160 (+2) | 8/8 |
| 10 (.env.example) | ✅ | ✅ | ~160 | 8/8 |

**Total: ~160 tests (was 136, +24).** All green at every commit.

### 16.2 Commit 1 (D4) detail

D4 changes user-visible strings. The MCP server `name` (line 36: `'openrouter-image-mcp'`) and tool `description` (line 52: `"...OpenRouter's vision models..."`) are sent to the MCP client. Changing them is a user-facing change but not an MCP contract change (the tool *names* and *schemas* are unchanged; only the descriptive metadata changes).

**Neutralization:**
- Server `name`: `'openrouter-image-mcp'` → `'vision-mcp'` (neutral)
- Tool `analyze_image` description: `"Analyze images using OpenRouter's vision models..."` → `"Analyze images using the configured vision provider. Supports..."` (neutral)
- Log strings: `'Starting OpenRouter Image MCP Server'` → `` `Starting ${providerConfig.provider} Image MCP Server` ``

### 16.3 `satisfies never` guard handling (R5)

Commit 4 widens `ProviderId` with 3 new members. The factory's `satisfies never` guard in `ProviderFactory.create` would break the build because the switch doesn't yet handle the new members (cases are added in commit 8). **Same pattern as Phase 2B commit 1:**

- **Commit 4:** temporarily relax the guard from `satisfies never` to `as string` so the build passes. Document in the commit message: "The exhaustiveness guard is temporarily relaxed; it will be restored in commit 8 when the factory cases for chutes/cerebras/azure are added."
- **Commit 8:** add the 3 new `case`s and restore `satisfies never`. The guard now verifies all 9 `ProviderId` members are handled.

---

## 17. Validation Gates After Every Commit

After **each** commit, run:

```bash
# 1. Build
npm run build
# Expected: exit 0

# 2. Lint
npm run lint
# Expected: exit 0 (warnings acceptable)

# 3. Tests (JSON reporter is authoritative)
CI=true npx vitest run --reporter=json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{d[\"numPassedTests\"]}/{d[\"numTotalTests\"]} pass, {d[\"numFailedTests\"]} fail')"
# Expected: all pass, 0 fail

# 4. Sentinel
/tmp/sentinel-check.sh
# Expected: 8/8 pass, 0 fail

# 5. No OpenRouterClient refs (Phase 3 invariant)
grep -rn "OpenRouterClient" src/ test/ 2>/dev/null | wc -l
# Expected: 0

# 6. MCP schema byte-identity (after commits 1 and 8; others unchanged)
diff <(sed -n "/const tools: Tool\[\]/,/return { tools };/p" baseline/src/index.ts) <(sed -n "/const tools: Tool\[\]/,/return { tools };/p" src/index.ts) | grep -E "name:|description:" | head -5
# Commit 1 (D4) changes the 'description' field — this is expected and acceptable (descriptive metadata, not schema)
# The 'name' and 'inputSchema' fields must remain unchanged
```

---

## 18. Rollback Strategy

### 18.1 Per-commit rollback

Each commit is independently revertible. The ordering is: hygiene first (D4, D5, D6 — each isolated to one concern), then type widening (additive), then providers one-by-one (each self-contained). If any commit fails, revert it and re-plan.

### 18.2 Emergency rollback

`git reset --hard pre-phase-3` (tag at `2a3b5f9`) — restores the codebase to the pre-Phase-3 state. Or `git reset --hard 5076c85` (Phase 3 final) to restore just the Phase 3 state without Phase 2C.

### 18.3 Partial-completion safety

If Phase 2C is interrupted after, say, commit 5 (Chutes added) but before commit 10 (`.env.example`), the repo is in a **valid state** — 6+1 providers work, tests pass, sentinel green. The remaining commits can be resumed.

---

## 19. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| D5 removes a heuristic that was preventing a false warning, but a user relied on that warning | Very Low | Very Low | The heuristic only logged a warning; removing it stops false warnings for new-model names. No behavior regression. |
| D6 gating breaks an existing provider where `jsonMode` was `true` but the model rejected `response_format` | Very Low | Medium | All 6 current providers have `jsonMode: true` and accept `response_format: { type: 'json_object' }`. The gating is a no-op for them. Verified by Phase 2B.5 G2 (request body capture). |
| D4 server name change breaks an MCP client that depends on `'openrouter-image-mcp'` | Low | Low | MCP clients use the server `name` for display, not routing. The tool names (which clients dispatch on) are unchanged. |
| Azure adapter is more complex than estimated (auth + URL + no /models + api-version) | Medium | Medium | Dedicated `AzureOpenAIProvider` class with its own tests. If the implementation reveals a deeper issue, the Azure commit can be reverted and Azure deferred to a sub-phase. |
| Chutes `supported_features` field shape differs from Phase 2A's documentation | Low | Low | The `ChutesProvider.validateModel` override handles the field gracefully (checks if present; warns if absent). Live validation (Stage 2) is the true gate. |
| Cerebras vision support unverified (Spike 2A-1 not executed) | Medium | Low | Cerebras is added optimistically. If it fails at runtime, the user gets a clear provider-aware error. No code defect. |
| `satisfies never` guard flags the widened union before the factory cases are added | Certain (by design) | None | Commit 4 (widen types) + commit 8 (wire factory) are sequenced so the guard is satisfied after commit 8. Between commits 4 and 8, the guard is temporarily relaxed (same as Phase 2B commit 1). Document the temporary relaxation in commit 4. |
| `npm test` exit code 1 (pre-existing vitest+Node 25 noise) confuses the gate | Low | None | Use the JSON reporter for pass/fail; the exit code is a known pre-existing condition, not a regression. |
| Test count drift makes behavioral preservation hard to verify | Low | Low | Each commit's test count is recorded in §16.1. The behavioral preservation check from Phase 3 (`grep -c "  it("`) applies to modified test files. |

**Overall Phase 2C risk: LOW-MEDIUM.** The largest risk (Azure complexity) is mitigated by the dedicated class + dedicated tests. The regression safety net (136/136 tests) catches unexpected interactions.

---

## 20. Success Criteria

| # | Criterion | Verification |
|---|---|---|
| S1 | `npm run build` exit 0 | `npm run build` |
| S2 | `npm run lint` exit 0 | `npm run lint` (0 errors) |
| S3 | All tests pass | JSON reporter: 0 fail |
| S4 | Sentinel 8/8 | `/tmp/sentinel-check.sh` |
| S5 | MCP tool names unchanged | `diff` vs baseline: `name:` fields identical |
| S6 | MCP tool schemas unchanged | `diff` vs baseline: `inputSchema` fields identical |
| S7 | No new runtime dependencies | `diff baseline/package.json package.json` |
| S8 | `ProviderId` widened to 9 members | `grep -c` check |
| S9 | `PROVIDER_DEFAULTS` has 9 entries | `grep -c` check |
| S10 | `PROVIDER_CAPABILITIES` has 9 entries | `grep -c` check |
| S11 | Factory dispatches all 9 providers | factory tests pass |
| S12 | Azure uses `api-key` header (not Bearer) | azure-provider test |
| S13 | Azure `testConnection` returns `true` without HTTP | azure-provider test |
| S14 | Azure `validateModel` returns `true` without HTTP | azure-provider test |
| S15 | Azure `capabilities.modelsEndpoint === false` | azure-provider test |
| S16 | Chutes `validateModel` checks `supported_features` | chutes-provider test |
| S17 | D4: no "OpenRouter" in startup logs when `PROVIDER != openrouter` | grep `src/index.ts` for template-literal provider usage |
| S18 | D5: no `modelLower.includes(...)` in `openai-compatible.ts` | grep |
| S19 | D6: `response_format` gated on `capabilities.jsonMode` | grep + D6 unit test |
| S20 | All 9 providers listed in `Unknown PROVIDER` error | config test |
| S21 | No `OpenRouterClient` in `src/` or `test/` | grep (Phase 3 invariant maintained) |
| S22 | No behavior change for existing 6 providers | sentinel 8/8 + request body capture (if feasible) |

**All 22 must hold for Phase 2C completion.**

---

## 21. Failure Criteria

Phase 2C fails (abort and re-plan) if:

1. **Sentinel regresses** at any commit and cannot be restored by reverting.
2. **`npm run build` fails** at any commit due to a Phase 2C change.
3. **An existing provider's request body changes** (verified by the openai-compatible-provider unit tests, which assert the exact request body shape).
4. **Azure adapter cannot be made to work** with the OpenAI multimodal request body (would indicate Azure's API is more divergent than Phase 2A predicted).
5. **D6 gating breaks an existing provider** (would indicate a provider's `jsonMode` should be `false` but is currently `true` — would require re-evaluating that provider's classification).

**None indicated by current evidence.**

---

## 22. Completion Criteria

Phase 2C is complete when ALL of the following hold:

1. All 22 success criteria (S1–S22) are verified green.
2. 10 commits land in the fork's git history, each with a descriptive message referencing this plan.
3. `baseline/` remains immutable.
4. The Phase 2C Completion Report is written, documenting:
   - Final commit list
   - Success criteria verification table
   - Sentinel checkpoint after each commit
   - Spike 2A-1 result (if executed) or "deferred — no key"
   - Any mid-flight adjustments (with rationale)
   - Test count before/after (136 → ~160)
   - Remaining technical debt (Phase 4 scope + future hardening)
5. No providers beyond Chutes, Cerebras, Azure were added.
6. No MCP tool schema changes (tool names + inputSchema byte-identical to baseline).
7. No new dependencies.
8. `OpenRouterConfig` interface alias is retained (Phase 4 will retire it at package rename).

---

## 23. Expected Deliverables

1. **Phase 2C Implementation Plan** (this document, approved)
2. **10 commits** in the fork's git history, each buildable and independently revertible
3. **2 new source files** — `src/providers/chutes.ts`, `src/providers/azure.ts`
4. **2 new test files** — `test/unit/chutes-provider.test.ts`, `test/unit/azure-provider.test.ts`
5. **5 modified source files** — `src/index.ts`, `src/providers/openai-compatible.ts`, `src/providers/factory.ts`, `src/config/index.ts`, `src/types/index.ts`
6. **3 modified test files** — `openai-compatible-provider.test.ts`, `provider-factory.test.ts`, `config.test.ts`
7. **`.env.example`** updated with 3 new providers + Azure `BASE_URL` note
8. **Phase 2C Completion Report** documenting all of the above
9. **Spike 2A-1 result** (if executed) or "deferred" note
10. **~160 tests passing** (was 136, +24), 0 failures, 0 load errors

### Estimated effort
- Hygiene (D4, D5, D6): ~1 hour
- Type/config widening: ~30 min
- Chutes: ~1 hour
- Cerebras: ~30 min
- Azure: ~2 hours (dedicated adapter + tests)
- Factory wiring + tests: ~30 min
- Config validation + tests: ~30 min
- `.env.example`: ~15 min
- **Total: ~6 hours** (~1 engineer-day, aligning with the Transition Report's ~1.5–2 day estimate with buffer)

---

## 24. Approval Checklist

Before coding begins, confirm:

- [ ] §1 Objectives match intent.
- [ ] §2/§3 Scope and out-of-scope are correct (especially: no providers beyond Chutes/Cerebras/Azure; no Phase 4 work).
- [ ] §5 Root-cause analysis for D4, D5, D6 is accurate.
- [ ] §6 Spike 2A-1 plan is acceptable (optional; optimistic Cerebras if no key).
- [ ] §7 Chutes strategy (subclass + `supported_features`) is acceptable.
- [ ] §8 Cerebras strategy (config-only, optimistic) is acceptable.
- [ ] §9 Azure strategy (dedicated adapter, api-key, no /models, api-version in baseUrl) is acceptable.
- [ ] §10 Factory update (3 new cases) is acceptable.
- [ ] §11 Config update (3 new defaults + Azure BASE_URL validation) is acceptable.
- [ ] §13 Unit test strategy covers all changes.
- [ ] §16 Commit sequence (10 commits, hygiene first) is acceptable.
- [ ] §20 Success criteria (22 items) are the correct bar.
- [ ] §21 Failure criteria correctly identify abort conditions.
- [ ] §23 Effort estimate (~1 engineer-day) is acceptable.

---

**Awaiting approval. No code changes will be made until this plan is authorized.**