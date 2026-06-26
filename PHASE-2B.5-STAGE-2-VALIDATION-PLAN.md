# Phase 2B.5 Stage 2 — Live Provider Validation Plan

**Status:** Draft — awaiting approval
**Predecessor:** Phase 2C Completion Report (approved); Phase 2B.5 Stage 1 (approved)
**Codebase under test:** fork HEAD `df19181` (Phase 2C final)
**Objective:** Validate the completed 9-provider matrix using real provider credentials before release preparation begins.

---

## 1. Validation Objectives

1. **Confirm each provider's request is accepted** — the exact request body produced by `OpenAICompatibleProvider`/`ChutesProvider`/`AzureOpenAIProvider` is accepted by the real provider API and returns a 200.
2. **Confirm vision analysis works end-to-end** — the `analyze_image` MCP tool, called through the server's stdio protocol, returns a plausible non-empty analysis of a test image for each provider with a valid key.
3. **Confirm response parsing is correct** — the `choices[0].message.content` extraction + `usage` token counting produces the expected `ImageAnalysisResult` shape.
4. **Confirm JSON mode works** — `format=json` produces parseable JSON for providers that support `response_format: { type: 'json_object' }`.
5. **Confirm error handling is provider-aware** — invalid credentials produce a provider-aware error (`<provider> API Error: ...`) through the MCP tool output.
6. **Confirm Azure's unique path** — Azure's `api-key` header, deployment-URL routing, and omitted `model` field produce a successful analysis.
7. **Confirm Chutes' `supported_features` preflight** — `ChutesProvider.validateModel` fetches `/models` and checks `supported_features` without breaking the analysis path.
8. **Execute Spike 2A-1** — verify Cerebras vision support on `llama-4-scout-17b-16e-instruct` (or confirm it's text-only and document).
9. **Collect latency observations** — record per-provider `analyze_image` latency for Phase 4 release notes (not a gate; informational).
10. **Record evidence** — capture request/response pairs, error messages, and latencies so results are reproducible.

**What Stage 2 IS NOT:**
- A load test (single-request validation only)
- A streaming test (the server is non-streaming; out of scope)
- A retry/backoff test (D8 is deferred)
- A security audit (D11 is Phase 4)
- A README/npm rename (Phase 4)
- A code modification phase (validation only — if a defect is found, a separate hotfix phase is spawned)

---

## 2. Scope

### 2.1 In scope

| Item | Scope |
|---|---|
| 9 providers | openrouter, openai, together, deepinfra, fireworks, groq, chutes, cerebras, azure |
| Positive tests | valid key + valid image → successful analysis |
| Negative tests | invalid key → provider-aware error |
| JSON mode | `format=json` for at least 1 provider that supports it |
| Azure-specific | api-key header, deployment URL, omitted model field |
| Chutes-specific | `supported_features` preflight |
| Spike 2A-1 | Cerebras vision verification |
| Latency | per-provider `analyze_image` timing |
| Reproducibility | every test command + env + output recorded |

### 2.2 Out of scope (explicit)

- ❌ Load testing, stress testing, concurrent-request testing
- ❌ Streaming
- ❌ Retry/backoff (D8 deferred)
- ❌ Security audit (D11 — Phase 4)
- ❌ Dependency audit (D11 — Phase 4)
- ❌ MCP SDK upgrade (D12 — Phase 4)
- ❌ README rewrite, npm package rename (Phase 4)
- ❌ `.tgz` removal (D10 — Phase 4)
- ❌ `OpenRouterConfig` alias removal (Phase 4 at rename)
- ❌ Code modifications (if a defect is found, stop and produce a defect report; a hotfix phase is spawned separately)
- ❌ Providers beyond the 9 implemented (no Anthropic native, Gemini native, Bedrock)

---

## 3. Explicit Out-of-Scope Items

See §2.2. The key boundary: **Stage 2 is validation only. No code changes.** If a provider fails live validation, the response is:
1. Stop testing that provider.
2. Record the failure (request, response, error).
3. Classify: (a) code defect → hotfix phase needed; (b) provider API change → update `PROVIDER_DEFAULTS` or adapter in a hotfix; (c) user-experience issue (e.g., wrong model id) → document in release notes.
4. Continue testing other providers (if the failure is isolated).

---

## 4. Provider Validation Matrix

| # | Provider | Classification | Adapter | `jsonMode` | `modelsEndpoint` | Vision model (suggested) | Key env var |
|---|---|---|---|---|---|---|---|
| 1 | openrouter | FC | `OpenAICompatibleProvider` | ✅ | ✅ | `google/gemini-2.0-flash-exp:free` | `OPENROUTER_API_KEY` |
| 2 | openai | FC | `OpenAICompatibleProvider` | ✅ | ✅ | `gpt-4o` | `OPENAI_API_KEY` |
| 3 | together | FC | `OpenAICompatibleProvider` | ✅ | ✅ | (user must choose a vision model) | `TOGETHER_API_KEY` |
| 4 | deepinfra | FC | `OpenAICompatibleProvider` | ✅ | ✅ | (user must choose a vision model) | `DEEPINFRA_API_KEY` |
| 5 | fireworks | FC | `OpenAICompatibleProvider` | ✅ | ✅ | `accounts/fireworks/models/llama4-scout-17b-16e-instruct` | `FIREWORKS_API_KEY` |
| 6 | groq | FC | `OpenAICompatibleProvider` | ✅ | ✅ | `llama-3.2-90b-vision-preview` | `GROQ_API_KEY` |
| 7 | chutes | CA | `ChutesProvider` | ✅ | ✅ | (user must choose; check `supported_features`) | `CHUTES_API_KEY` |
| 8 | cerebras | CA (conditional) | `OpenAICompatibleProvider` | ✅ | ✅ | `llama-4-scout-17b-16e-instruct` | `CEREBRAS_API_KEY` |
| 9 | azure | PSI | `AzureOpenAIProvider` | ✅ | ❌ | (deployment-configured) | `AZURE_API_KEY` + `BASE_URL` |

**Classification legend:** FC = Fully Compatible, CA = Compatible with Adapter, PSI = Provider-Specific Implementation.

---

## 5. Required Credentials

### 5.1 API keys

One key per provider being validated. Keys are the user's responsibility to obtain; this plan does not provide them. Store keys in environment variables (never in git, never logged — the server avoids logging keys, verified in Phase 2B.5 Stage 1 G10).

| Provider | Env var | Where to obtain |
|---|---|---|
| openrouter | `OPENROUTER_API_KEY` | https://openrouter.ai/keys |
| openai | `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| together | `TOGETHER_API_KEY` | https://api.together.ai/settings/api-keys |
| deepinfra | `DEEPINFRA_API_KEY` | https://deepinfra.com/dashboard |
| fireworks | `FIREWORKS_API_KEY` | https://fireworks.ai/account/api-keys |
| groq | `GROQ_API_KEY` | https://console.groq.com/keys |
| chutes | `CHUTES_API_KEY` | https://chutes.ai/ (cpk_... format) |
| cerebras | `CEREBRAS_API_KEY` | https://cerebras.ai/ |
| azure | `AZURE_API_KEY` + `BASE_URL` | Azure portal → resource → keys + deployment URL |

### 5.2 Azure-specific requirements

Azure requires two pieces of configuration:
1. **`API_KEY`** (or `AZURE_API_KEY` mapped to `API_KEY`): the Azure resource key.
2. **`BASE_URL`**: the full deployment URL including `?api-version=`, e.g.:
   ```
   https://<resource>.openai.azure.com/openai/deployments/<deployment>?api-version=2024-02-15-preview
   ```
   The deployment must be a vision-capable model (e.g., `gpt-4o` deployment).

### 5.3 Key availability handling

**If a key is unavailable for a provider, that provider is marked "deferred — no key" and skipped.** Stage 2 proceeds with whatever keys are available. A provider with no key is not a failure; it's a documented gap for opportunistic execution later.

**Minimum for Stage 2 to proceed:** at least 1 provider with a valid key. If zero keys are available, Stage 2 is deferred entirely and Phase 4 proceeds with the note "live validation pending."

---

## 6. Test Environment Requirements

### 6.1 Codebase

- Fork root: `/Users/datamatics/desktop/open-image-mcp`
- Git HEAD: `df19181` (Phase 2C final) — must not change during Stage 2
- `pre-phase-2c` tag at `5076c85` (rollback point)
- Build: `npm run build` must produce `dist/index.js` before testing
- `baseline/` reference clone (immutable)

### 6.2 Runtime

- Node v25.9.0 (the runtime used throughout the project)
- macOS darwin (the project's platform)
- `/tmp/mcp-client.py` (the JSON-RPC stdio client from Phase 2B.5 Stage 1)

### 6.3 Test fixtures

- **Tier-1 image (trivial):** 1×1 red PNG from `TestHelpers.SAMPLE_IMAGES.RED_PNG` — for quick smoke tests.
- **Tier-2 image (substantive):** a real photograph or screenshot, ~100–500KB, JPEG or PNG. **Suggested:** a screenshot of a simple webpage with clear text and a button (so the vision model has concrete content to describe). This image is required for meaningful vision-analysis validation. The 1×1 PNG is too trivial — some providers may return "I see a red pixel" which doesn't exercise the analysis path meaningfully.
- **Test prompt:** `"What do you see in this image? Answer in one sentence."`

### 6.4 Evidence storage

- `PHASE-2B.5-STAGE-2-VALIDATION-RESULTS.md` — the results file, structured per-provider with: command, env, output, result, latency, timestamp.
- `/tmp/stage2-captures/` — directory for captured request/response pairs (optional, if a local capture server is used for debugging).

### 6.5 No CI

Stage 2 is **manual**. Live API calls cannot run in CI without secrets. All validation is executed by a human (or agent) with real keys, locally.

---

## 7. Per-Provider Validation Procedures

### 7.1 General procedure (applies to all 9 providers)

For each provider with a valid key:

1. **Set env vars:**
   ```bash
   export PROVIDER=<provider-id>
   export API_KEY=<real-key>
   export MODEL=<vision-model-id>          # except azure (ignored)
   export BASE_URL=<deployment-url>         # only for azure
   export LOG_LEVEL=info
   ```
2. **Build (if not already):** `npm run build`
3. **Smoke test (Tier-1 image):** run `tools/list` to confirm the server starts and lists 3 tools.
4. **Positive test (Tier-2 image):** call `analyze_image` with the substantive test image + test prompt. Record: `isError`, `content[0].text`, latency.
5. **JSON mode test:** call `analyze_image` with `format=json`. Record: whether the response is valid JSON.
6. **Negative test:** set `API_KEY=invalid-key`, call `analyze_image`. Record: error message (must be provider-aware).
7. **Restore env vars** for the next provider.

### 7.2 Provider-specific procedures

#### 7.2.1 OpenRouter
- Suggested model: `google/gemini-2.0-flash-exp:free` (free tier; good for validation)
- Extra headers (`HTTP-Referer`, `X-Title`) are applied automatically by `PROVIDER_DEFAULTS`.
- Verify: the request is accepted; analysis is returned.

#### 7.2.2 OpenAI
- Suggested model: `gpt-4o`
- Verify: the request is accepted; analysis is returned; `usage` tokens are reported.

#### 7.2.3 Together
- User must supply `MODEL` (no default; `requiresExplicitModel: true`).
- Suggested vision model: check Together's model catalog for a vision-capable model (e.g., a Llama 3.2 vision variant).
- Verify: the request is accepted; analysis is returned.

#### 7.2.4 DeepInfra
- User must supply `MODEL` (no default).
- Suggested vision model: check DeepInfra's catalog (e.g., `meta-llama/Llama-3.2-90B-Vision-Instruct`).
- Verify: the request is accepted; analysis is returned.

#### 7.2.5 Fireworks
- User must supply `MODEL` (no default).
- Suggested model: `accounts/fireworks/models/llama4-scout-17b-16e-instruct` (or check Fireworks' vision model list).
- Verify: the request is accepted; analysis is returned.

#### 7.2.6 Groq
- Suggested model: `llama-3.2-90b-vision-preview`
- Verify: the request is accepted; analysis is returned. Groq is fast; latency should be notably low.

#### 7.2.7 Chutes
- User must supply `MODEL` (no default).
- Suggested model: check Chutes' `/models` endpoint (public, no auth) for a vision-capable model with `supported_features` including `vision`.
- **Additional:** verify `ChutesProvider.validateModel` checks `supported_features` — observe the startup log for any "may not support vision" warning.
- Verify: the request is accepted; analysis is returned.

#### 7.2.8 Cerebras (Spike 2A-1)
- Suggested model: `llama-4-scout-17b-16e-instruct` (the default; vision support unverified).
- **Spike objective:** confirm whether this model accepts multimodal input and returns a vision analysis.
- If the model returns a text-only response or rejects the image: **Cerebras vision support is unconfirmed.** Document in the results. Do not remove Cerebras from the codebase — it's optimistically added; the user gets a clear error if the model doesn't support vision.
- If the model returns a vision analysis: **Cerebras vision support is confirmed.** Record the result.
- Verify: the request is accepted (or fails with a clear vision-not-supported error).

#### 7.2.9 Azure
- Requires `BASE_URL` (full deployment URL + `?api-version=`) and `API_KEY`.
- `MODEL` is ignored (R4: `requiresExplicitModel: false`).
- **Additional verification:**
  - Confirm the `api-key` header is sent (not `Authorization: Bearer`) — can be verified by pointing `BASE_URL` at a local capture server first, or by observing that Azure accepts the request (if it rejected the auth scheme, it would 401).
  - Confirm the `model` field is omitted from the request body (R1) — same capture-server technique.
  - Confirm `testConnection` returns `true` without an HTTP call (check the startup log: "Azure testConnection: no /models endpoint; trusting deployment URL").
- Verify: the request is accepted; analysis is returned.

---

## 8. Positive Test Cases

For each provider (with a valid key):

| ID | Test | Expected |
|---|---|---|
| P-1 | `tools/list` returns 3 tools | `['analyze_image', 'analyze_webpage_screenshot', 'analyze_mobile_app_screenshot']` |
| P-2 | `analyze_image` with Tier-2 image + test prompt | `isError: false` (or absent); `content[0].text` is a non-empty string plausibly describing the image |
| P-3 | `analyze_image` with `format=json` | Response text is valid JSON (or falls back to text with a `structuredData.analysis` wrapper) |
| P-4 | `analyze_webpage_screenshot` with a webpage screenshot | `isError: false`; text contains webpage-analysis content |
| P-5 | `analyze_mobile_app_screenshot` with a mobile screenshot | `isError: false`; text contains mobile-app-analysis content |
| P-6 | `usage` tokens reported (if the provider returns usage) | `result.usage` contains `promptTokens`, `completionTokens`, `totalTokens` |

**P-2 is the primary positive gate.** P-4/P-5 are secondary (use the same provider path; differ only in prompt). P-3 validates JSON mode. P-6 is informational.

---

## 9. Negative Test Cases

For each provider:

| ID | Test | Expected |
|---|---|---|
| N-1 | `API_KEY=invalid-key` + `analyze_image` | `isError: true`; `content[0].text` contains `<provider> API Error: ...` (provider-aware) |
| N-2 | `MODEL=<nonexistent-model>` + `analyze_image` | `isError: true`; error mentions the model or a 404 |
| N-3 | Empty image data (`type=base64, data=""`) | `isError: true`; error mentions image data |
| N-4 | Unsupported MIME (`type=base64, data=<valid>, mimeType=application/pdf`) | `isError: true`; error mentions "Unsupported image type" |

**N-1 is the primary negative gate** (provider-aware error handling). N-2/N-3/N-4 are secondary (pre-existing behavior; should work uniformly across providers).

---

## 10. Error-Handling Validation

| ID | Test | Expected |
|---|---|---|
| E-1 | Invalid key (N-1) | Error message contains the provider id (e.g., `openai API Error: ...`), NOT "OpenRouter API Error" |
| E-2 | Network error (point `BASE_URL` at an unreachable host) | `isError: true`; error is a network-related message (not a crash, not a stack trace) |
| E-3 | Empty choices (provider returns `{"choices":[]}`) | `isError: true`; error is "No response from model" |
| E-4 | Empty content (provider returns `{"choices":[{"message":{}}]}`) | `isError: true`; error is "Empty response from model" |

E-3/E-4 are hard to trigger against real providers (they'd return valid responses). These are covered by the unit tests (Phase 3, 2C) and don't need live validation. **E-1 and E-2 are the live gates.**

---

## 11. Image Validation Scenarios

| ID | Scenario | Image | Expected |
|---|---|---|---|
| I-1 | Trivial image | 1×1 red PNG | Provider returns a brief description (e.g., "a red pixel" or "a small red square") |
| I-2 | Substantive image | Real photo or screenshot (~100–500KB) | Provider returns a meaningful description of the content |
| I-3 | File input | Save Tier-2 image to `/tmp/test.jpg`; `type=file, data=/tmp/test.jpg` | Same as I-2 (file is converted to base64 by `ImageProcessor`) |
| I-4 | URL input | Host Tier-2 image on a public URL; `type=url, data=<url>` | Same as I-2 (URL is fetched + base64-encoded by `ImageProcessor`) |

**I-2 is the primary image gate.** I-3/I-4 verify the `ImageProcessor` paths (already covered by unit tests, but live confirmation is valuable). I-1 is a quick smoke test.

---

## 12. Performance Measurements

**Not a gate.** Informational only, for Phase 4 release notes.

| Metric | How to measure |
|---|---|
| Per-provider `analyze_image` latency | `time` the MCP `tools/call` for P-2; record wall-clock seconds |
| Server startup time | `time` from `node dist/index.js` to "started successfully" log |
| Image processing time | (optional) `time` the `ImageProcessor.processImage` call via a debug log |

Record latencies in the results file. No pass/fail threshold — just data.

---

## 13. Logging Requirements

During Stage 2, set `LOG_LEVEL=info` (or `debug` for deeper investigation). Verify:

| ID | Requirement |
|---|---|
| L-1 | No API key appears in log output (re-verify Phase 2B.5 G10 with a real key) |
| L-2 | Startup logs are provider-aware (D4: "Starting <provider> Image MCP Server", not "Starting OpenRouter Image MCP Server") |
| L-3 | Adapter logs are provider-aware ("Sending request to <provider> API") |
| L-4 | Azure's `testConnection` no-op is logged ("Azure testConnection: no /models endpoint; trusting deployment URL") |
| L-5 | Chutes' `supported_features` warning (if any) is logged with the provider context |

---

## 14. Success Criteria

### 14.1 Per-provider success (for each provider with a valid key)

| # | Criterion |
|---|---|
| PS-1 | Server starts with `PROVIDER=<id>` + valid key; `tools/list` returns 3 tools |
| PS-2 | `analyze_image` with Tier-2 image returns `isError: false` + non-empty analysis |
| PS-3 | Invalid key produces a provider-aware error (`<provider> API Error: ...`) |
| PS-4 | No API key leakage in logs |

### 14.2 Overall Stage 2 success

| # | Criterion |
|---|---|
| OS-1 | At least 1 provider passes PS-1 through PS-4 (minimum viable validation) |
| OS-2 | All providers with valid keys pass PS-1 through PS-4 (full validation) |
| OS-3 | Spike 2A-1 executed (Cerebras vision confirmed or unconfirmed — either is acceptable; document the result) |
| OS-4 | Azure-specific: `api-key` header + omitted `model` field verified (via capture server or successful analysis) |
| OS-5 | Chutes-specific: `supported_features` preflight runs without breaking the analysis path |
| OS-6 | No code modified during Stage 2 (enforced — validation only) |
| OS-7 | Results file `PHASE-2B.5-STAGE-2-VALIDATION-RESULTS.md` committed with all evidence |
| OS-8 | Codebase SHA unchanged at `df19181` throughout Stage 2 |

**Explicitly NOT a gate:** all 9 providers passing. If a provider has no key, it's "deferred — no key," not a failure.

---

## 15. Failure Criteria

### 15.1 Provider failure (isolated)

A provider **fails** if, with a valid key:
- PS-1 fails (server doesn't start or `tools/list` is wrong) → likely a config defect
- PS-2 fails (`analyze_image` returns `isError: true` with a non-auth error, or empty analysis) → likely a request/response defect
- PS-3 fails (error message says "OpenRouter" or doesn't include the provider id) → D4 regression
- PS-4 fails (key appears in logs) → D14/logging defect

**On provider failure:**
1. Stop testing that provider.
2. Record: the command, env, full output, HTTP status (if available), error message.
3. Classify:
   - **Code defect** (e.g., wrong request body, wrong auth scheme) → hotfix phase needed.
   - **Provider API change** (e.g., endpoint moved, field deprecated) → update `PROVIDER_DEFAULTS` or adapter in a hotfix.
   - **User-experience issue** (e.g., user picked a non-vision model) → document in release notes; not a code defect.
4. Continue testing other providers (if the failure is isolated).

### 15.2 Stage 2 abort

Stage 2 is **aborted** (and a re-plan is needed) if:
- The server crashes on startup for a provider with a valid key (not a config error, an actual crash).
- A defect is found that affects multiple providers (e.g., the shared `OpenAICompatibleProvider.analyzeImage` has a bug).
- The codebase SHA changes during Stage 2 (someone modified code mid-validation).

**Abort action:** stop all testing, produce a defect report, do not resume until the defect is fixed in a hotfix phase.

---

## 16. Decision Gates

| Gate | When | Criterion | Action if fail |
|---|---|---|---|
| G1 — Pre-Stage-2 | Before testing | Codebase at `df19181`; build green; sentinel 8/8; at least 1 key available | If 0 keys: defer Stage 2; proceed to Phase 4 with "live validation pending" |
| G2 — Per-provider | After each provider's tests | PS-1 through PS-4 pass (or provider is "deferred — no key") | If fail: record, classify, continue to next provider |
| G3 — Post-Spike-2A-1 | After Cerebras test | Cerebras vision confirmed or unconfirmed (either is acceptable; document) | If unconfirmed: document in release notes; Cerebras stays in codebase (optimistic) |
| G4 — End-of-Stage-2 | After all providers tested | OS-1 through OS-8 met; results file committed | If OS-1 not met (0 providers validated): defer; proceed to Phase 4 with "live validation pending" |
| G5 — Sign-off | After G4 | Stage 2 Completion Report written and approved | Proceed to Phase 4 planning |

---

## 17. Rollback Strategy

### 17.1 Codebase rollback

Stage 2 does **not** modify code. If a defect is found that requires a fix:
1. Stop Stage 2.
2. Spawn a **hotfix phase** (separate from Stage 2).
3. The hotfix phase has its own implementation plan + review + execution.
4. After the hotfix, re-run Stage 2 for the affected provider(s).

### 17.2 Evidence rollback

The results file (`PHASE-2B.5-STAGE-2-VALIDATION-RESULTS.md`) is the sole artifact. If evidence is contaminated (e.g., wrong env vars used), delete and re-run. No git rollback needed (the results file is documentation, not code).

### 17.3 Emergency

`git reset --hard pre-phase-2c` (tag at `5076c85`) — restores the codebase to the pre-Phase-2C state. Only used if Stage 2 reveals a severe Phase 2C regression (unlikely given the 163/163 green suite).

---

## 18. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| No API keys available for any provider | Medium | Low (Stage 2 deferred; Phase 4 proceeds with "pending") | Document; proceed to Phase 4 |
| A provider's API has changed since Phase 2A research | Low | Medium | If a provider rejects the request, classify as "provider API change"; hotfix `PROVIDER_DEFAULTS` or adapter |
| Azure deployment URL is misconfigured | Medium | Low | The Azure `BASE_URL`-required validation (Phase 2C commit 9) catches missing URLs; a wrong URL produces a clear Azure 404 |
| Cerebras vision support is unconfirmed (Spike 2A-1) | Medium | Low | Either outcome is acceptable; document in release notes |
| API key leakage in logs | Very Low | High | Phase 2B.5 Stage 1 G10 verified zero leakage; re-verify with a real key during Stage 2 L-1 |
| Rate limiting during testing | Low | Low | Single-request validation; if rate-limited, wait and retry; record the rate-limit error |
| A provider returns an unexpected response shape | Low | Medium | The `analyzeImage` response parsing handles `choices[0].message.content` + `usage`; if the shape differs, `No response from model` or `Empty response from model` error fires |
| Test image is too trivial (1×1 PNG) → provider returns an unhelpful response | Medium | Low | Use the Tier-2 substantive image for P-2; Tier-1 is only for the smoke test |
| Stage 2 reveals a hidden Phase 2C defect | Low | High | Stop, produce a defect report, spawn a hotfix phase; do not proceed to Phase 4 until fixed |
| Network latency makes testing slow | Low | Very Low | Allow up to 120s per `analyze_image` (the adapter timeout); record latency |

**Overall Stage 2 risk: LOW.** The largest risk (hidden defect) is exactly what Stage 2 is designed to surface — finding it is a success, not a failure.

---

## 19. Expected Deliverables

1. **Stage 2 Live Provider Validation Plan** (this document, approved)
2. **`PHASE-2B.5-STAGE-2-VALIDATION-RESULTS.md`** — evidence file with:
   - Per-provider test results (PS-1 through PS-4)
   - Command + env + output + latency + timestamp for each test
   - Spike 2A-1 result (Cerebras vision)
   - Azure-specific verification (api-key header, omitted model field)
   - Chutes-specific verification (supported_features preflight)
   - Provider-aware error message verification (N-1)
   - Logging verification (L-1 through L-5)
   - Performance observations (latency per provider)
3. **Stage 2 Completion Report** (`PHASE-2B.5-STAGE-2-COMPLETION-REPORT.md`) with:
   - Executive summary
   - Providers validated (pass) / deferred (no key) / failed (defect)
   - Success criteria verification table
   - Spike 2A-1 outcome
   - Defects found (if any) + classification
   - Recommendations for Phase 4 (e.g., release notes for Cerebras, latency expectations)
   - Go/No-Go for Phase 4

**No code changes. No new files in `src/`. No new tests.** Stage 2 is validation only.

---

## 20. Completion Criteria

Stage 2 is complete when ALL of the following hold:

1. All providers with valid keys have been tested against PS-1 through PS-4 (pass or fail-with-classification).
2. Providers without keys are marked "deferred — no key" in the results file.
3. Spike 2A-1 has been executed (Cerebras vision confirmed or unconfirmed) OR is marked "deferred — no Cerebras key."
4. Azure-specific verification (api-key header, omitted model field) is documented (if Azure key available).
5. Chutes-specific verification (`supported_features` preflight) is documented (if Chutes key available).
6. Logging verification (L-1 through L-5) is documented.
7. Performance observations (latency) are recorded for each tested provider.
8. Results file is committed (or staged) with all evidence.
9. Stage 2 Completion Report is written.
10. No code was modified during Stage 2 (codebase SHA remains `df19181`).
11. `baseline/` remains immutable.

---

## 21. Approval Checklist

Before execution begins, confirm:

- [ ] §1 Validation objectives match intent.
- [ ] §2/§3 Scope and out-of-scope are correct (especially: no code changes; validation only).
- [ ] §4 Provider matrix (9 providers) is correct.
- [ ] §5 Credential requirements are clear (especially Azure's `BASE_URL` requirement).
- [ ] §6 Test environment is correct (codebase at `df19181`; Tier-2 substantive image required).
- [ ] §7 Per-provider procedures are executable.
- [ ] §8–§11 Test cases (positive, negative, error, image) are sufficient.
- [ ] §14 Success criteria (PS-1–PS-4, OS-1–OS-8) are the correct bar.
- [ ] §15 Failure criteria correctly classify provider failure vs. Stage 2 abort.
- [ ] §16 Decision gates (G1–G5) are correct.
- [ ] §18 Risk assessment is acceptable (especially: "no keys" → defer, not fail).
- [ ] §20 Completion criteria are correct.

---

**Awaiting approval. No validation is executed and no code is modified until this plan is authorized.**