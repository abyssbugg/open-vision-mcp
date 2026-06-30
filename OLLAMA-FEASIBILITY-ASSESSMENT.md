# Ollama Feasibility Assessment

**Date:** pre-Version-1-release evaluation
**Codebase:** fork HEAD `341112f` (Phase 4 final, release candidate)
**Purpose:** Determine whether Ollama support can be incorporated into the existing provider abstraction with minimal, localized changes.
**Available credential:** `OLLAMA_API_KEY` (57 chars, Ollama Cloud token format)

---

## 1. Support for Local Ollama Models

**Local Ollama** (running at `http://localhost:11434`) exposes:
- **Native API:** `/api/chat` — Ollama's own request/response shape
- **OpenAI-compatible API:** `/v1/chat/completions` — standard OpenAI Chat Completions shape (per official docs, supported since Feb 2024)

The OpenAI-compatible endpoint at `http://localhost:11434/v1/chat/completions` accepts:
- Standard OpenAI multimodal request body (`messages[].content[].type: 'text' | 'image_url'`, `image_url.url: data:image/...;base64,...`)
- `model`, `max_tokens`, `temperature`, `response_format`
- `Authorization: Bearer ollama` (auth required but value ignored for local)

**Classification: Fully Compatible (FC)** — local Ollama works through the existing `OpenAICompatibleProvider` with `baseUrl: http://localhost:11434/v1`. Config-only entry, no adapter code needed.

---

## 2. Support for Ollama Cloud Models

**Ollama Cloud** (at `https://api.ollama.com`) was tested with the available key:

| Endpoint | Auth | Result |
|---|---|---|
| `/v1/models` (OpenAI-compatible) | `Authorization: Bearer <key>` | ✅ 200 — lists 35 models |
| `/v1/chat/completions` (OpenAI-compatible) | `Authorization: Bearer <key>` | ❌ 401 "Unauthorized" |
| `/v1/chat/completions` with `X-API-Key` | `X-API-Key: <key>` | ❌ 401 "Unauthorized" |
| `/api/chat` (native Ollama API) | `Authorization: Bearer <key>` | ✅ 200 — text completion works |
| `/api/chat` with `images` field (vision) | `Authorization: Bearer <key>` | ✅ 200 — **vision analysis confirmed** (returned a real description of the test screenshot) |

**The OpenAI-compatible chat endpoint (`/v1/chat/completions`) returns 401** with the available key. The key CAN do inference (the native `/api/chat` endpoint works, including vision), but the OpenAI-compatible `/v1/` chat path is not accessible. This may be a key-permission issue, a tier limitation, or the Cloud's `/v1/` compatibility layer requiring different auth.

**The native `/api/chat` endpoint works** but uses a **different request/response shape**:

| Aspect | OpenAI shape (existing adapter) | Ollama native shape |
|---|---|---|
| Message content | `content: [{type: 'text', text: '...'}, {type: 'image_url', image_url: {url: 'data:...'}}]` | `content: '...'` (plain string) + `images: ['<base64>']` (separate field) |
| Response choices | `choices[0].message.content` | `message.content` (no `choices` array) |
| Usage tokens | `usage.prompt_tokens`, `usage.completion_tokens` | `prompt_eval_count`, `eval_count` (top-level, not nested) |
| Max tokens | `max_tokens` | `options.num_predict` |
| Done signal | Implicit (HTTP 200) | `done: true`, `done_reason: 'stop'` |
| Model list | `data: [{id: '...'}]` | Same ✅ |

**Classification: Provider-Specific Implementation (PSI)** — Ollama Cloud requires a dedicated adapter (`OllamaProvider`) that translates between the existing `VisionProvider` interface and the native Ollama API shape. This is comparable to the Azure adapter (Phase 2C) — a new class implementing `VisionProvider` with its own `analyzeImage`, `testConnection`, `validateModel`, and `extractErrorMessage`.

---

## 3. Compatibility with the Existing VisionProvider Abstraction

**Local Ollama:** ✅ Fully compatible — `OpenAICompatibleProvider` works as-is with `baseUrl: http://localhost:11434/v1`. The `VisionProvider` interface, `ProviderCapabilities`, and `ProviderFactory` are sufficient. No new class needed.

**Ollama Cloud:** ⚠️ Requires a dedicated adapter — the native `/api/chat` shape is NOT OpenAI-compatible. A new `OllamaProvider implements VisionProvider` class is needed, similar to `AzureOpenAIProvider`. The `VisionProvider` interface is sufficient (no interface changes needed); only a new implementation class + factory case.

**The VisionProvider interface itself does NOT need to change.** The existing interface (`analyzeImage`, `testConnection`, `validateModel?`, `capabilities`) covers Ollama's requirements. This is the same conclusion as Phase 2A for all providers.

---

## 4. Required Configuration Changes

### Local Ollama (if added as FC — config-only)
```typescript
// src/config/index.ts — PROVIDER_DEFAULTS
ollama: {
  baseUrl: 'http://localhost:11434/v1',
  model: 'llama3.2-vision',  // or 'llava', 'gemma3:12b', etc.
  // No requiresExplicitModel — user sets MODEL
},
```

### Ollama Cloud (if added as PSI — dedicated adapter)
```typescript
// src/config/index.ts — PROVIDER_DEFAULTS
ollama: {
  baseUrl: 'https://api.ollama.com',  // native API base
  model: 'gemma3:12b',  // vision-capable
  requiresExplicitModel: false,
},
```

**Problem: one `PROVIDER=ollama` can't serve both local and Cloud** if they use different APIs (OpenAI-compatible vs native). Options:
- **Option A:** Two provider ids (`ollama` for local FC, `ollama-cloud` for Cloud PSI) — confusing, violates the "one provider = one id" pattern
- **Option B:** One `ollama` id with a dedicated adapter that detects local vs Cloud by `baseUrl` (if localhost → use `/v1/chat/completions`; if `api.ollama.com` → use `/api/chat`) — complex, fragile
- **Option C:** One `ollama` id with a dedicated adapter that always uses the native `/api/chat` (works for both local and Cloud) — clean, but local users lose the OpenAI-compatible optimization (though the native API is equally functional locally)

**Option C is cleanest** but requires a dedicated adapter even for local — meaning local Ollama is no longer "config-only."

### `.env.example` additions
```bash
# Ollama (local or cloud)
# For local: BASE_URL defaults to http://localhost:11434
# For cloud: set BASE_URL=https://api.ollama.com and API_KEY=<cloud-token>
```

---

## 5. Required Provider Implementation Changes

### If local-only (FC — config-only)
- **New files:** 0
- **Modified files:** `src/types/index.ts` (+1 to `ProviderId`), `src/config/index.ts` (+1 to `PROVIDER_DEFAULTS`), `src/providers/factory.ts` (+1 `case` + `PROVIDER_CAPABILITIES` entry), `.env.example`
- **New adapter class:** None — uses `OpenAICompatibleProvider`
- **Effort:** ~30 minutes (identical to Cerebras — config-only entry)

### If both local + Cloud (PSI — dedicated adapter)
- **New files:** `src/providers/ollama.ts` (~150 lines — `OllamaProvider implements VisionProvider`)
- **New test files:** `test/unit/ollama-provider.test.ts` (~12 tests)
- **Modified files:** `src/types/index.ts` (+1 to `ProviderId`), `src/config/index.ts` (+1 to `PROVIDER_DEFAULTS`), `src/providers/factory.ts` (+1 `case` + `PROVIDER_CAPABILITIES` entry + import), `.env.example`, `test/unit/provider-factory.test.ts` (+2 tests), `test/unit/config.test.ts` (+2 tests)
- **New adapter class:** `OllamaProvider` — translates OpenAI multimodal request → Ollama native `/api/chat` shape; parses Ollama native response → `ImageAnalysisResult`; provider-aware errors
- **Effort:** ~2–3 hours (comparable to the Azure adapter in Phase 2C)

### Adapter implementation details (if PSI)
```typescript
// OllamaProvider.analyzeImage — request translation
// OpenAI input → Ollama native:
//   messages[0].content = promptText (plain string)
//   messages[0].images = [imageData] (raw base64, no data: prefix)
//   options.num_predict = maxTokens
//
// Ollama native response → ImageAnalysisResult:
//   message.content → analysis
//   prompt_eval_count → usage.promptTokens
//   eval_count → usage.completionTokens
//   (no choices[] array)
```

---

## 6. Required Test Additions

### If local-only (FC)
- `provider-factory.test.ts`: +1 dispatch test (returns `OpenAICompatibleProvider` for `'ollama'`)
- `config.test.ts`: +1 default resolution test (`ollama` defaults)

### If both local + Cloud (PSI)
- `ollama-provider.test.ts` (new, ~12 tests):
  - Constructor: Bearer auth, base URL
  - `analyzeImage`: request translation (plain string content + images array)
  - `analyzeImage`: response parsing (message.content, prompt_eval_count, eval_count)
  - `analyzeImage`: empty response handling
  - `analyzeImage`: error handling (provider-aware `ollama API Error: ...`)
  - `testConnection`: `/v1/models` works (OpenAI-compatible list endpoint)
  - `validateModel`: `/v1/models` check
  - `capabilities`: `{ jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' }`
- `provider-factory.test.ts`: +2 tests (dispatch + capabilities)
- `config.test.ts`: +2 tests (defaults + missing-MODEL)

---

## 7. Live Validation with Available Key

**Yes — live validation is possible** for Ollama Cloud. The available `OLLAMA_API_KEY`:
- ✅ Lists models (`/v1/models` → 200, 35 models)
- ✅ Performs text completion (`/api/chat` → 200)
- ✅ **Performs vision analysis** (`/api/chat` with `images` field → 200, real description of test screenshot)

This makes Ollama the **first and only provider with confirmed live vision validation** — a significant milestone. All 9 existing providers are engineering-validated (unit tests) but not live-validated (Stage 2 is paused). Ollama Cloud can be both engineering-validated AND live-validated if added.

**The 401 on `/v1/chat/completions`** means a dedicated adapter (native `/api/chat`) is required for Cloud — the OpenAI-compatible endpoint is not available with this key. Live validation can only proceed via the native API path.

---

## 8. Estimated Implementation Effort

| Scope | Effort | New files | Modified files |
|---|---|---|---|
| Local Ollama only (FC, config-only) | ~30 min | 0 | 4 |
| Both local + Cloud (PSI, dedicated adapter) | ~2–3 hours | 2 | 6 |
| Both + live validation | ~3–4 hours | 2 | 6 |

---

## 9. Risks

| Risk | Severity | Notes |
|---|---|---|
| Local + Cloud have different APIs — one `PROVIDER=ollama` can't cleanly serve both via the existing adapter | Medium | Option C (always native `/api/chat`) resolves this but requires a dedicated adapter even for local |
| Ollama Cloud's `/v1/chat/completions` 401 is unexplained — may be a key-permission issue, not an endpoint issue | Medium | If the OpenAI-compatible endpoint works with a different key/tier, Ollama could be FC (config-only). But the current evidence says 401. |
| Ollama's `/api/chat` response shape may differ between local and Cloud versions | Low | The native API is documented; both local and Cloud use it. Risk is low. |
| Adding a 10th provider to V1 expands the scope right before release | Medium | The release readiness review said "no new providers" for V1; adding Ollama contradicts this |
| `satisfies never` guard must be updated (trivial, same as Phase 2C) | Low | Same pattern as every provider addition |
| Ollama Cloud model availability changes frequently | Low | The `/models` endpoint is dynamic; the user sets `MODEL` |
| No vision-specific model in the Cloud model list is labeled "vision" — users must know which models support images | Low | README documents the suggested vision models; same as Together/DeepInfra/Fireworks/Chutes |

---

## 10. V1 or V2?

### Arguments for including in V1

1. **Live validation is possible** — the available key can confirm vision analysis works, making Ollama the first live-validated provider. This is a significant confidence signal for release.
2. **Local Ollama is trivial** (config-only, ~30 min) — the lowest-effort provider addition possible.
3. **Ollama is the most popular local LLM runtime** — supporting it is high-value for users who want privacy/offline/local inference.
4. **The VisionProvider interface needs no changes** — the adapter fits cleanly.
5. **The engineering discipline is proven** — Phase 2C added 3 providers (Chutes, Cerebras, Azure); adding one more follows the exact same pattern.

### Arguments for deferring to V2

1. **Cloud requires a dedicated adapter** — not "minimal, localized changes" (the user's criterion). A new `OllamaProvider` class (~150 lines) + tests (~12 cases) is comparable to the Azure adapter, which was a full Phase 2C deliverable.
2. **Adding only local Ollama creates a confusing UX** — `PROVIDER=ollama` works locally but 401s on Cloud. Users would hit the 401 and not understand why. The clean solution (Option C: always native `/api/chat`) requires the dedicated adapter anyway.
3. **The release readiness review said "zero Critical, zero High findings"** — the project is ready for release NOW. Adding a new provider + adapter right before release introduces risk and dilutes the release candidate.
4. **Stage 2 is paused** — adding Ollama and live-validating it while the other 9 providers remain unvalidated creates an asymmetry. The release notes would say "Ollama live-validated; 9 others pending" which is confusing.
5. **The user said "This is not a roadmap expansion"** — adding a 10th provider with a dedicated adapter is arguably a scope expansion. The "minimal, localized changes" criterion is not met for Cloud.
6. **V2 can do it properly** — a V2 release with Ollama (both local + Cloud via native adapter) + live validation of all 10 providers is a stronger, more coherent release than bolting Ollama onto V1 at the last minute.

### Deciding factor

The user's criterion is "minimal, localized changes." The evidence shows:
- **Local Ollama** = minimal (config-only, ~30 min) ✅
- **Ollama Cloud** = NOT minimal (dedicated adapter, ~2–3 hours, new class, new tests) ❌

Since the user asked about BOTH local and Cloud, and Cloud requires a dedicated adapter (not minimal), the honest answer is that full Ollama support does NOT meet the "minimal, localized changes" criterion. Local-only would meet it, but creates a confusing UX (works locally, 401s on Cloud).

---

## 11. Recommendation

### **Defer to Version 2**

**Technical reasoning:**

1. **Ollama Cloud requires a dedicated adapter** (`OllamaProvider` implementing the native `/api/chat` API), which is comparable to the Azure adapter from Phase 2C (~150 lines + 12 tests). This does not meet the "minimal, localized changes" criterion the user specified.

2. **Adding only local Ollama (config-only, FC) is technically minimal** (~30 min), but creates a confusing user experience: `PROVIDER=ollama` would work for local Ollama but return 401 on Ollama Cloud. The clean solution — a single `OllamaProvider` using the native `/api/chat` endpoint for both local and Cloud — requires the dedicated adapter, which is V2 scope.

3. **The project is release-ready** (Release Readiness Review: "APPROVE WITH MINOR RELEASE CHANGES" — only the package name placeholder remains). Bolting on a new provider + dedicated adapter at this stage introduces risk and dilutes the release candidate.

4. **Ollama is high-value for V2** — it's the most popular local LLM runtime, the native API supports vision (live-confirmed), and a V2 release with a proper `OllamaProvider` + live validation across all 10 providers would be a stronger, more coherent release.

5. **The VisionProvider interface needs no changes** — V2 can add Ollama cleanly through the existing abstraction, following the exact pattern established by Azure in Phase 2C. The architecture is ready; the timing is not.

**In V2, the implementation would be:**
- Add `OllamaProvider implements VisionProvider` (`src/providers/ollama.ts`)
- Uses the native `/api/chat` endpoint for both local and Cloud (works everywhere)
- Translates OpenAI multimodal → Ollama native request shape
- Parses Ollama native response → `ImageAnalysisResult`
- Live validation with the available Cloud key (vision confirmed)
- ~2–3 hours implementation + ~30 min live validation

---

**Recommendation: Defer to Version 2.**