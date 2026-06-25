# PHASE 2A — Provider Compatibility Validation

**Status:** Analysis only — no implementation, no repo changes.
**Scope:** OpenAI-compatible providers (Phase 2B target set).
**Question to answer:** Can Phase 2 implementation proceed using the current `VisionProvider` abstraction with only localized provider implementations?

---

## 0. Executive Summary

**Answer: YES — proceed to Phase 2B**, with one mandatory pre-implementation adjustment and three optional hygiene adjustments.

The current `VisionProvider` abstraction (Phase 1) is sufficient to support **seven of eight** target OpenAI-compatible providers through a single shared `OpenAICompatibleProvider` implementation, differing only in configuration (base URL + headers + capabilities). One provider (**Azure OpenAI**) requires its own adapter due to a non-`Bearer` auth scheme. One provider (**Cerebras**) has unresolved vision-support uncertainty that gates a firm compatibility classification.

The Phase 1 interface needs **no structural changes**. The Phase 1 factory needs **one widening** of the `ProviderId` union (already anticipated by the plan). The `OpenRouterConfig` type needs generalization to `ProviderConfig` (also already anticipated).

**Mandatory pre-2B adjustment:** Generalize config to carry `provider`, `apiKey`, `model`, `baseUrl` as first-class fields, with per-provider defaults populated by the factory. Without this, every provider implementation re-implements env-var reading.

---

## 1. Methodology

Each provider was evaluated against the current implementation's coupling points (identified in Phase 0):

1. Authentication header scheme
2. Base URL and path convention (`/v1` vs `/api/v1`)
3. Chat completions endpoint path
4. Multimodal request body shape (`messages[].content[].type: 'text' | 'image_url'`)
5. `response_format: { type: 'json_object' }` support
6. `/models` list endpoint existence and auth requirement
7. Streaming support (informational — current server is non-streaming)
8. Vision-capable model availability
9. Provider-specific request headers (OpenRouter's `HTTP-Referer` / `X-Title`)
10. Response field compatibility (`choices[0].message.content`, `usage`)

**Evidence sources:** official provider docs, litellm provider reference (cross-provider corroboration), Fireworks/Together/Cerebras/Groq official compatibility pages, OpenAI API reference. No provider APIs were called directly (no API keys; would be a Phase 2B spike task).

---

## 2. Provider Compatibility Matrix

Classification legend:
- **FC** = Fully compatible (config swap only, no code)
- **CA** = Compatible with adapter (small per-provider class for header/auth/URL normalization)
- **PSI** = Requires provider-specific implementation (different protocol shape)
- **NR** = Not recommended

| # | Provider | Base URL | Auth | Endpoint | Vision payload | JSON mode | `/models` | Classification |
|---|---|---|---|---|---|---|---|---|
| 1 | **OpenRouter** | `https://openrouter.ai/api/v1` | `Bearer` | `/chat/completions` | OpenAI shape ✅ | ✅ | ✅ (auth required) | **FC** (current) |
| 2 | **OpenAI** | `https://api.openai.com/v1` | `Bearer` | `/chat/completions` | OpenAI shape ✅ | ✅ | ✅ (auth required) | **FC** |
| 3 | **Together** | `https://api.together.xyz/v1` | `Bearer` | `/chat/completions` | OpenAI shape ✅ (documented) | ✅ | ✅ | **FC** |
| 4 | **Fireworks** | `https://api.fireworks.ai/inference/v1` | `Bearer` | `/chat/completions` | OpenAI shape ✅ (documented, identical example) | ✅ | ✅ | **FC** |
| 5 | **DeepInfra** | `https://api.deepinfra.com/v1/openai` | `Bearer` | `/chat/completions` | OpenAI shape ✅ | ✅ | ✅ | **FC** |
| 6 | **Groq** | `https://api.groq.com/openai/v1` | `Bearer` | `/chat/completions` | OpenAI shape ✅ (Llama 3.2 11B/90B vision) | ✅ (json_object mode supported; json_schema on select models) | ✅ | **FC** |
| 7 | **Chutes** | `https://llm.chutes.ai/v1` | `Bearer` (`cpk_…`) | `/chat/completions` | OpenAI shape ✅ | ✅ (per-model `supported_features`) | ✅ (public, no auth — discovery only; auth still required for inference) | **CA** — needs config validation against `supported_features` because capability is per-model, not per-provider |
| 8 | **Cerebras** | `https://api.cerebras.ai/v1` | `Bearer` | `/chat/completions` | ⚠️ Uncertain — docs highlight text-only Llama 3.x; `llama-4-scout-17b-16e-instruct` is listed but multimodal status not confirmed in research | ✅ | ✅ (`/models` requires auth; `/public/v1/models` does not) | **CA** — vision support unverified; requires spike before classification |
| 9 | **Azure OpenAI** | `https://<resource>.openai.azure.com/openai/deployments/<deployment>` | `api-key: <key>` (NOT Bearer) | `/chat/completions?api-version=…` | OpenAI shape ✅ | ✅ | ❌ (no `/v1/models`; deployment-based discovery) | **PSI** — auth scheme + URL shape + deployment model differ |

### Aggregate
- **FC (Fully Compatible, config-swap only):** 6 providers — OpenRouter, OpenAI, Together, Fireworks, DeepInfra, Groq
- **CA (Compatible with Adapter, minor code):** 2 providers — Chutes (per-model capability check), Cerebras (vision uncertainty)
- **PSI (Provider-Specific Implementation):** 1 provider — Azure OpenAI
- **NR:** 0

---

## 3. Capability Matrix

Per the Phase 1 `ProviderCapabilities` interface (`jsonMode`, `modelsEndpoint`, `maxTokensField`):

| Provider | `jsonMode` | `modelsEndpoint` | `maxTokensField` | Notes |
|---|---|---|---|---|
| OpenRouter | `true` | `true` | `max_tokens` | Current. Also accepts `max_completion_tokens`. |
| OpenAI | `true` | `true` | `max_completion_tokens` (newer) / `max_tokens` (legacy) | `gpt-5.5` example uses `max_completion_tokens`; `max_tokens` still accepted on older models. **Use `max_tokens` for cross-provider portability.** |
| Together | `true` | `true` | `max_tokens` | OpenAI-compatible, documented. |
| Fireworks | `true` | `true` | `max_tokens` | OpenAI-compatible, documented. |
| DeepInfra | `true` | `true` | `max_tokens` | OpenAI-compatible, documented. |
| Groq | `true` | `true` | `max_tokens` | `json_object` on all models; `json_schema` on subset. |
| Chutes | `true` (per-model) | `true` (public) | `max_tokens` | Capability is per-model; consult `supported_features` before assuming JSON mode. |
| Cerebras | `true` | `true` (auth) / `true` (public read) | `max_tokens` | Vision model presence unverified. |
| Azure OpenAI | `true` | `false` | `max_tokens` | No `/models` discovery; deployments are configured out-of-band. |

**Cross-provider conclusion:** `max_tokens` is universally accepted. `response_format: { type: 'json_object' }` is universally accepted by the OpenAI-compatible family. The Phase 1 `capabilities` model is sufficient — no new capability fields required.

---

## 4. Risk Assessment

| Risk | Likelihood | Impact | Mitigation | Phase |
|---|---|---|---|---|
| **Base URL path divergence** (`/v1` vs `/api/v1` vs `/v1/openai`) breaks naive config | **Certain** | High | Make `baseUrl` a complete-prefix field (no path appending in code). Each provider's default includes its full path. | 2B config design |
| **OpenRouter headers sent to other providers** cause rejection or noise | Low | Low | Move `HTTP-Referer`/`X-Title` behind an opt-in `extraHeaders` per-provider config. Default empty for non-OpenRouter. | 2B adapter |
| **Chutes per-model capability variance** — assuming `json_mode: true` for all models causes silent fallback to text | Medium | Medium | Document that capability is a *provider default*; per-model overrides are out of scope for 2B. User selects a vision+JSON-capable model. | 2B docs |
| **Cerebras vision support unverified** — adding Cerebras as FC may ship a non-working provider | Medium | High | Run a 30-min spike (curl with a Cerebras key against `llama-4-scout-17b-16e-instruct`) before classifying Cerebras as FC. If spike fails, defer Cerebras to Phase 2C. | Pre-2B spike |
| **Azure OpenAI PSI classification** — requires dedicated adapter (auth + URL) | Certain | Medium | Plan a dedicated `AzureOpenAIProvider` in 2B. Estimated +1 day vs FC providers. | 2B |
| **`max_tokens` vs `max_completion_tokens`** — newer OpenAI models deprecate `max_tokens` | Low | Low | Use `max_tokens` in 2B (universal); revisit if a provider rejects it. | 2B |
| **Provider rate limits differ** — current server has no retry/backoff | Medium | Medium | Out of scope for 2B. Track separately. `RETRY_ATTEMPTS` config exists but is unused (Phase 0 finding); wire it in a later hardening phase. | Deferred |
| **Streaming not supported by current server** | Certain | None (current server is non-streaming) | Out of scope. `VisionProvider` interface is non-streaming; streaming would be a separate phase. | Deferred |
| **Error response shape variance** — `error.error.message` vs `error.message` | Low | Low | Current `extractErrorMessage` already handles both `data.error.message` and `data.message` and bare `error.message`. Generalize to per-provider if needed; current is adequate. | Deferred |
| **Model name namespaces differ** — `openai/gpt-4o` (OpenRouter) vs `gpt-4o` (OpenAI) vs `accounts/fireworks/models/…` (Fireworks) | Certain | None | User supplies the model id; the server passes it through verbatim. No normalization needed. | None |

**Overall risk: LOW.** No abstraction-blocking risks. The base-URL-prefix divergence is the only design constraint that *must* be honored in 2B.

---

## 5. Adapter Requirements

### 5.1 What one shared adapter covers (the `OpenAICompatibleProvider`)

A single class implementing `VisionProvider` handles providers 1–6 (OpenRouter, OpenAI, Together, Fireworks, DeepInfra, Groq) with **only configuration differences**:

```ts
interface OpenAICompatibleConfig {
  baseUrl: string;          // FULL prefix, e.g. 'https://api.openai.com/v1'
  apiKey: string;
  model: string;
  extraHeaders?: Record<string, string>;  // OpenRouter's HTTP-Referer/X-Title
  timeout?: number;
}
```

The adapter:
- Constructs an axios instance with `baseURL: config.baseUrl` and `Authorization: Bearer <key>`.
- Sends the existing request body (already OpenAI-shaped — Phase 0 finding) to `/chat/completions`.
- Parses the existing OpenAI-shaped response.
- Reports `capabilities = { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' }`.

**Critical design rule:** the adapter must NOT append `/v1` or any path prefix to `baseUrl`. Each provider's default `baseUrl` includes its full path. This avoids the `/v1` vs `/api/v1` divergence pitfall.

### 5.2 Provider-specific adapters required

| Provider | Adapter class | Why separate |
|---|---|---|
| Chutes | `ChutesProvider extends OpenAICompatibleProvider` | Per-model `supported_features` lookup (optional preflight); base URL `https://llm.chutes.ai/v1` |
| Cerebras | `CerebrasProvider extends OpenAICompatibleProvider` | Possibly a public `/public/v1/models` fallback for `validateModel`; base URL `https://api.cerebras.ai/v1` |
| Azure OpenAI | `AzureOpenAIProvider implements VisionProvider` | Different auth (`api-key` header, not `Bearer`), URL includes deployment name, no `/models` discovery, query-param `api-version` |

### 5.3 What the Phase 1 `VisionProvider` interface does NOT need to change

- `analyzeImage` signature: ✅ sufficient (universal across all researched providers)
- `testConnection`: ✅ sufficient (GET `/models` for FC providers; Azure overrides)
- `validateModel` optional: ✅ correct (Azure has no `/models`)
- `capabilities` shape: ✅ sufficient (3 fields cover all observed differences)

**No interface changes required.**

---

## 6. Required Abstraction Changes

### 6.1 Mandatory (blocks 2B)

| Change | Where | Why |
|---|---|---|
| Generalize `OpenRouterConfig` → `ProviderConfig` with `{ provider, apiKey, model, baseUrl }` | `src/types/index.ts`, `src/config/index.ts`, `.env.example` | Without this, every new provider re-implements env-var reading. The current `OpenRouterConfig` carries only `{apiKey, model, baseUrl}` — no `provider` discriminator. |
| Widen `ProviderId` union | `src/types/index.ts` | Currently `'openrouter'`. Add `'openai' \| 'together' \| 'fireworks' \| 'deepinfra' \| 'groq' \| 'chutes' \| 'cerebras' \| 'azure'`. |
| Add cases to `ProviderFactory.create` | `src/providers/factory.ts` | One `case` per provider id, returning the corresponding provider instance. |
| Replace literal `'openrouter'` in `index.ts` with `config.provider` | `src/index.ts` | The Phase 1 plan anticipated this one-line change explicitly. |

### 6.2 Optional hygiene (can defer to 2C)

| Change | Where | Why |
|---|---|---|
| Remove vision-by-name heuristic in `validateModel` | `src/utils/openrouter-client.ts` (or its successor) | The `modelLower.includes('gemini')` etc. block is brittle and provider-specific. Replace with: trust the user's model id; log a warning if `/models` says the model lacks vision modality. |
| Make `response_format` conditional on `capabilities.jsonMode` | shared adapter | All 2B providers support `json_mode`, so this is a no-op today. Add the conditional so future non-JSON-mode providers (e.g., some Bedrock) don't break. |
| Move `HTTP-Referer`/`X-Title` behind `extraHeaders` | adapter config | Today they're hardcoded in `OpenRouterClient`. Make them opt-in per-provider. |

### 6.3 What does NOT change

- `ImageProcessor` — provider-neutral (Phase 0, Phase 1 confirmed)
- `Logger` — provider-neutral
- MCP tool schemas in `index.ts` — byte-identical (Phase 1 S1/S2)
- `ImageAnalysisResult` shape — universal across providers
- The 3 tool handlers — already decoupled (Phase 1 S9)

---

## 7. Implementation Priority Order (for Phase 2B planning)

Ordered by **(compatibility certainty × configuration simplicity)** — highest confidence first.

| Priority | Provider | Effort | Rationale |
|---|---|---|---|
| 1 | **OpenAI** | Trivial (config only) | Reference implementation of the OpenAI shape; proves the shared adapter. |
| 2 | **Together** | Trivial | Documented FC; different base URL only. |
| 3 | **DeepInfra** | Trivial | Documented FC; different base URL only. |
| 4 | **Fireworks** | Trivial | Documented FC; different base URL + model namespace. |
| 5 | **Groq** | Trivial | Documented FC; different base URL only. |
| 6 | **OpenRouter** | Already done | Migrate to the shared adapter; preserve `extraHeaders`. |
| 7 | **Chutes** | Small | CA — add `supported_features` preflight (optional). |
| 8 | **Cerebras** | Small (after spike) | CA — gate on vision-support spike. |
| 9 | **Azure OpenAI** | Medium | PSI — dedicated adapter for auth + URL shape. |

**Recommended 2B scope:** priorities 1–6 (the six FC providers, including migrating OpenRouter onto the shared adapter). This delivers maximum provider coverage with minimum risk. Defer Chutes, Cerebras, and Azure to **2C**.

---

## 8. Validation Spikes Required

### Spike 2A-1 — Cerebras vision capability (30 min, requires Cerebras API key)
**Goal:** Determine whether `llama-4-scout-17b-16e-instruct` on Cerebras accepts multimodal `image_url` input and returns vision analysis.
**Method:** `curl https://api.cerebras.ai/v1/chat/completions` with a tiny base64 PNG and the multimodal content array.
**Success:** 200 with content describing the image → Cerebras upgrades to FC.
**Failure:** 4xx or text-only response → Cerebras stays CA, deferred to 2C.
**Gate:** Must complete before classifying Cerebras in 2B. If no key available, defer Cerebras to 2C by default.

### Spike 2A-2 — Payload portability across 2 FC providers (1 hr, requires keys for any 2 of OpenAI/Together/Groq/DeepInfra/Fireworks)
**Goal:** Empirically confirm the *exact* request body produced by the current `openrouter-client.ts:73-95` is accepted unchanged by at least two non-OpenRouter FC providers.
**Method:** Construct the identical POST body, swap `baseURL` + `Authorization`, send to two providers, compare response shape.
**Success:** Both return `choices[0].message.content` non-empty.
**Failure:** One rejects — identify the delta and scope it into the adapter.
**Gate:** Recommended but not blocking. The Phase 0 assessment already reasoned this from documentation; empirical confirmation reduces residual risk before 2B.

**No spikes required for:** OpenAI, Together, DeepInfra, Fireworks, Groq, OpenRouter — documentation is authoritative and consistent across sources.

---

## 9. Success Criteria (for Phase 2B, not 2A)

Carried forward for when 2B begins — these are the gates 2B must meet:

1. **S1 (preserved):** MCP tool names unchanged.
2. **S2 (preserved):** MCP tool schemas unchanged.
3. **S-2B-1:** At least 3 OpenAI-compatible providers (e.g., OpenAI, Together, Groq) work end-to-end through the shared `OpenAICompatibleProvider`, verified by a live `tools/list` + `analyze_image` smoke test with real API keys (or mocked HTTP for unit tests).
4. **S-2B-2:** A user can switch providers by changing only `PROVIDER`, `API_KEY`, `MODEL`, `BASE_URL` env vars — no code changes.
5. **S-2B-3:** `npm run build` exit 0.
6. **S-2B-4:** Sentinel (`test/integration/mcp-server.test.ts`) remains 8/8.
7. **S-2B-5:** No new runtime dependencies.
8. **S-2B-6:** `OpenRouterConfig` is renamed/replaced by `ProviderConfig` carrying a `provider: ProviderId` field; all references updated.

---

## 10. Failure Criteria (would abort 2B and force a return to design)

1. Spike 2A-1 or 2A-2 reveals that the OpenAI-compatible family diverges in the multimodal content-array shape (e.g., one provider requires `image` instead of `image_url`). This would invalidate the "shared adapter" thesis and force per-provider adapters even for the FC group.
2. The Phase 1 `VisionProvider` interface is found to be structurally inadequate (e.g., a provider requires a preflight call not representable as `testConnection`/`validateModel`).
3. Base URL prefix handling cannot be unified (e.g., a provider requires path manipulation that contradicts the "full-prefix baseUrl" rule).

**None of these are indicated by current evidence.** They are listed as tripwires.

---

## 11. Decision

### Can Phase 2 implementation proceed using the current `VisionProvider` abstraction with only localized provider implementations?

**YES.**

The Phase 1 abstraction is sufficient. Six providers are fully compatible through a single shared adapter with configuration differences only. Two more are compatible with small per-provider extensions. One (Azure) requires a dedicated adapter, anticipated by the interface's optional `validateModel`.

**One mandatory pre-2B adjustment:** generalize config to carry `provider` as a first-class field. This was already anticipated by the Phase 1 plan ("Phase 2 will widen the ProviderId union and read this from config") and does not constitute an abstraction change — it's a config-shape change localized to `src/config/index.ts` and `src/types/index.ts`.

**Recommendation: Proceed to Phase 2B.**

Suggested 2B scope:
- Implement the shared `OpenAICompatibleProvider`.
- Migrate `OpenRouterClient` onto it (preserve `extraHeaders` for `HTTP-Referer`/`X-Title`).
- Add 5 more FC providers as config-only entries: OpenAI, Together, DeepInfra, Fireworks, Groq.
- Generalize env vars: `PROVIDER`, `API_KEY`, `MODEL`, `BASE_URL` with sensible per-provider defaults populated by the factory.
- Defer Chutes, Cerebras, Azure to Phase 2C.
- Run Spike 2A-2 before final 2B sign-off (empirical portability confirmation).

**No abstraction changes required. No interface changes required. Phase 1's seam is the right seam.**

---

## 12. Evidence Index

| Provider | Source | URL |
|---|---|---|
| OpenAI | API Reference (auth, vision, json mode) | https://developers.openai.com/api/docs/guides/images-vision |
| OpenAI | API Reference (overview, Bearer) | https://developers.openai.com/api/reference/overview |
| OpenRouter | Quickstart (base URL, headers) | https://openrouter.ai/docs/quickstart |
| OpenRouter | API reference (chat completions) | https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request |
| Together | OpenAI compatibility page | https://docs.together.ai/docs/inference/openai-compatibility |
| Fireworks | Vision models guide | https://docs.fireworks.ai/guides/querying-vision-language-models |
| DeepInfra | Chat overview | https://docs.deepinfra.com/chat/overview |
| Groq | Structured outputs (json_object mode) | https://console.groq.com/docs/structured-outputs |
| Groq | API reference (/models) | https://console.groq.com/docs/api-reference |
| Chutes | llms.txt (base URL, auth, per-model features) | https://chutes.ai/llms.txt |
| Chutes | LLM chat examples | https://chutes.ai/docs/examples/llm-chat |
| Cerebras | OpenAI compatibility | https://inference-docs.cerebras.ai/resources/openai |
| Azure OpenAI | REST API reference (api-key header, deployment URL) | https://learn.microsoft.com/en-us/azure/foundry/openai/reference |
| Cross-provider | Fireworks blog comparison table | https://fireworks.ai/blog/best-llm-api-providers |

---

**Phase 2A complete. Awaiting authorization to draft the Phase 2B implementation plan (no code changes until that plan is approved, per the established discipline).**