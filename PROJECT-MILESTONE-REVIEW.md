# Project Milestone Review

**Milestone:** Completion of Phase 2B.5 Stage 1 (provider abstraction operationally validated)
**Codebase:** `2a3b5f9` — 10 source files, ~1745 lines
**Phases completed:** 0, 1, 2A, 2B, 2B.5 Stage 1
**Phases pending:** 2B.5 Stage 2 (optional), 2C, 3, 4

---

## 1. What Has Been Accomplished

### 1.1 Phase 0 — Baseline Validation
- Cloned upstream `jonathanjude/openrouter-image-mcp` at `c9c28d7` into `baseline/` (immutable reference).
- Empirically confirmed: source compiles clean (`npm run build` exit 0); test suite stale (73/116 fail); ESLint config broken; MCP protocol contract intact (black-box `mcp-server.test.ts` 8/8).
- Confirmed every assessment claim that could be checked.
- **Deliverable:** Baseline Validation Report.

### 1.2 Phase 1 — Provider Abstraction Layer
- Introduced `VisionProvider` interface, `ProviderCapabilities`, `ProviderId` in `src/types/index.ts`.
- `OpenRouterClient implements VisionProvider` + readonly `capabilities` getter.
- Added `ProviderFactory` with `satisfies never` exhaustiveness guard.
- Decoupled all 3 tool handlers from the concrete `OpenRouterClient` type.
- Wired `index.ts` through `ProviderFactory.create('openrouter', config)`.
- **5 commits, all additive-first.** Concrete coupling reduced from 4 sites to 1. Sentinel stayed 8/8 throughout.
- **Deliverables:** Implementation Plan, Completion Report.

### 1.3 Phase 2A — Provider Compatibility Validation
- Researched 9 target providers against 16 compatibility dimensions using authoritative sources (official docs, litellm, cross-provider corroboration).
- Classified: 6 Fully Compatible, 2 Compatible with Adapter, 1 Provider-Specific Implementation, 0 Not Recommended.
- Identified the critical design constraint: `baseUrl` must be a full-prefix field (path conventions diverge across providers).
- Produced adapter requirements, risk assessment, priority order, validation spikes.
- **Deliverable:** Provider Compatibility Validation.

### 1.4 Phase 2B — OpenAI-Compatible Provider Expansion
- Generalized `OpenRouterConfig` → `ProviderConfig` with `provider` discriminator.
- Generalized env vars: `PROVIDER`, `API_KEY`, `MODEL`, `BASE_URL`, `EXTRA_HEADERS` with legacy `OPENROUTER_*` fallback.
- Created shared `OpenAICompatibleProvider` (move-not-rewrite from `OpenRouterClient`).
- Migrated OpenRouter onto the shared adapter; preserved `HTTP-Referer`/`X-Title` as default `extraHeaders`.
- Added 5 new providers (OpenAI, Together, DeepInfra, Fireworks, Groq) as config-only entries.
- Deleted `OpenRouterClient` (behavior moved to the shared adapter).
- Dropped the singleton pattern on the provider.
- **6 commits, additive-first.** Sentinel stayed 8/8 throughout.
- **Deliverables:** Implementation Plan, Completion Report.

### 1.5 Phase 2B.5 Stage 1 — Multi-Provider Validation
- Executed 18 test cases across 10 mandatory gates — all pass.
- Verified: configuration resolution, request body byte-identity to Phase 1, MCP schema byte-identity to baseline, auth headers (OpenRouter gets `extraHeaders`, others don't), provider-aware error messages, image processing, timeouts, capabilities, base URLs, logging (no key leakage).
- Used a local HTTP capture server for keyless validation of the request/auth/error surface.
- **No code modified.** Codebase remains at `2a3b5f9`.
- **Deliverables:** Validation Plan, Validation Results, Stage 1 Validation Report.

### 1.6 Quantitative summary

| Metric | Value |
|---|---|
| Commits on top of upstream | 11 (2 chore + 5 phase1 + 6 phase2b) |
| Source files | 10 |
| Source lines | ~1745 |
| Providers supported | 6 (openrouter, openai, together, deepinfra, fireworks, groq) |
| Concrete coupling sites | 1 (`ProviderFactory` references `OpenAICompatibleProvider`) |
| New runtime dependencies | 0 |
| MCP schema changes | 0 (byte-identical to baseline) |
| Sentinel | 8/8 at every checkpoint |
| Mandatory validation gates | 10/10 pass |
| Phase reports | 8 |

---

## 2. Which Assumptions Have Been Fully Validated

| Assumption | Validated by | Evidence |
|---|---|---|
| The repository is clean and modular enough to fork | Phase 0 | `npm run build` exit 0; 9 files, ~40KB |
| Provider coupling is concentrated in one file | Phase 0 + Phase 1 | Coupling reduced 4→1 by Phase 1; remaining 1 is the factory |
| The request payload is already OpenAI-compatible | Phase 2A + Phase 2B.5 TM-20 | `diff` of `requestBody` block baseline vs 2B → zero differences |
| The MCP contract is stable and preservable | Phase 1 + Phase 2B.5 TM-03 | `diff` of `const tools: Tool[]` block baseline vs 2B → zero differences |
| A provider abstraction layer can be introduced cleanly | Phase 1 | 5 additive commits; interface extracted from existing class; zero behavior change |
| Legacy OpenRouter users experience zero behavior change | Phase 2B.5 TM-04, TM-19 | Sentinel (legacy env vars) 8/8; legacy `tools/list` smoke test passes |
| `baseUrl` must be a full-prefix field | Phase 2A + Phase 2B.5 G9 | All 6 defaults verified against evidence table; no path appending in adapter |
| OpenRouter's `HTTP-Referer`/`X-Title` are provider-specific, not universal | Phase 2A + Phase 2B.5 G4 | Capture server confirmed: OpenRouter has them, other 5 don't |
| Error messages should be provider-aware | Phase 2B + Phase 2B.5 G5 | All 5 non-openrouter providers produce errors containing their own id |
| No API key leakage in logs | Phase 2B.5 G10 | `LOG_LEVEL=debug` grep for key → 0 occurrences |
| The `satisfies never` exhaustiveness guard is valuable | Phase 2B commit 1 | It caught the union-widening/switch-update coupling at compile time |
| Move-not-rewrite preserves behavior | Phase 2B + Phase 2B.5 TM-20 | Git detected delete+add as rename; body byte-identical |
| The sentinel is a reliable regression canary | Every phase | 8/8 at every commit across Phase 1 and Phase 2B |

---

## 3. Which Assumptions Remain Unverified

| Assumption | Why unverified | What would verify it |
|---|---|---|
| Real providers accept the request body and return parseable vision analyses | No API keys available | Stage 2 (live provider validation) |
| Per-provider latency is acceptable | No live tests | Stage 2 |
| Provider-specific response edge cases (e.g., usage field presence, finish_reason variants) don't break parsing | No live tests | Stage 2 |
| Cerebras supports vision input | Phase 2A spike not executed | Spike 2A-1 |
| Azure OpenAI requires a dedicated adapter (PSI classification) | Phase 2A assessment only | Phase 2C implementation |
| Chutes per-model `supported_features` preflight is needed | Phase 2A assessment only | Phase 2C implementation |
| The startup log strings saying "OpenRouter" is a deferred-debt issue, not a runtime bug | Acknowledged in Phase 2B.5 §6 | Phase 2C adjustment #1 |
| `RETRY_ATTEMPTS` being unused is harmless | No retry scenarios tested | Future hardening phase |
| 20 npm vulnerabilities are not exploitable in this server's context | No audit performed | Future hardening phase |
| MCP SDK 0.5.0 is compatible with current MCP clients | Not tested against current clients | Future upgrade |

**None of these block Phase 2C or production readiness.** They are either Tier 2/3 validation (Stage 2) or future hardening.

---

## 4. Technical Debt Currently Exists

Consolidated from Phase 0, Phase 2B Completion Report §9, and Phase 2B.5 Stage 1 §7:

| # | Debt item | Origin | Severity | Phase to address |
|---|---|---|---|---|
| D1 | Stale unit + integration tests (73 failing at baseline) | Phase 0 | High | Phase 3 |
| D2 | Broken `.eslintrc.json` (`@typescript-eslint/recommended` → `plugin:@typescript-eslint/recommended`) | Phase 0 | Medium | Phase 3 |
| D3 | `npm test` and `npm run lint` not green | Phase 0 | High | Phase 3 |
| D4 | Startup log strings say "OpenRouter" even when `PROVIDER != openrouter` | Phase 2B deferred | Medium | Phase 2C |
| D5 | Vision-by-name heuristic in `validateModel` (brittle, provider-specific) | Phase 2A §6.2 | Medium | Phase 2C |
| D6 | `response_format` sent unconditionally; not gated on `capabilities.jsonMode` | Phase 2A §6.2 | Low (no-op for 2B providers) | Phase 2C |
| D7 | `OpenRouterConfig` type alias + `getOpenRouterConfig()` legacy accessor | Phase 2B (kept for test compat) | Low | Phase 3 |
| D8 | `RETRY_ATTEMPTS` config read but never used | Phase 0 | Low | Future hardening |
| D9 | Double timeout in `analyze-image.ts` (axios 120s + `Promise.race` 120s) | Phase 0 | Low | Future hardening |
| D10 | Committed `openrouter-image-mcp-1.0.0.tgz` artifact in repo root | Phase 0 | Low | Future hygiene |
| D11 | 20 npm vulnerabilities (6 moderate, 13 high, 1 critical) | Phase 0 | Medium | Future hardening |
| D12 | MCP SDK 0.5.0 is old | Phase 0 | Low | Future upgrade |
| D13 | `src/.DS_Store` tracked in repo | macOS artifact | Trivial | Future hygiene |
| D14 | Startup error logging truncated (`unhandledRejection` handler doesn't serialize `reason`) | Phase 2B.5 §6.1 | Medium | Phase 3 or hygiene |
| D15 | Invalid base64 doesn't throw (Buffer.from produces garbage) | Phase 2B.5 §6.1 | Low | Future hygiene |

---

## 5. Which Technical Debt Should Be Addressed Before Adding More Providers

**Must address before Phase 2C:**

| Debt | Why before 2C |
|---|---|
| D4 (startup log strings) | Adding 3 more providers makes the misleading "OpenRouter" strings worse. One-commit hygiene change localized to `src/index.ts`. |
| D5 (vision-by-name heuristic) | Adding Chutes/Cerebras/Azure makes the heuristic increasingly brittle and misleading. Replace with: trust user's model id; warn if `/models` reports no vision modality. |
| D6 (`response_format` gating) | Azure may have models that reject `json_object`. Adding the `if (capabilities.jsonMode)` guard now is forward-compatible hygiene. |

**Must address before production release (Phase 3):**

| Debt | Why before release |
|---|---|
| D1, D3 (stale tests) | A production release with 73 failing tests has no regression safety net. |
| D2 (ESLint config) | A production release should have lint green. |
| D7 (legacy alias/accessor) | Retire `OpenRouterConfig` and `getOpenRouterConfig()` once tests are repaired. |
| D14 (startup error logging) | Production users need clear error messages when config is wrong. |

**Can defer until after release:**

| Debt | Why deferrable |
|---|---|
| D8, D9, D10, D13, D15 | Cosmetic / low-impact |
| D11 (vulnerabilities) | Audit and fix in a dedicated hardening sprint; not blocking |
| D12 (MCP SDK) | Protocol-stable; upgrade is optional |

---

## 6. Implementation Decisions to Revisit While the Codebase Is Still Small

The codebase is ~1745 lines across 10 files. Revisiting decisions now is cheap; later it won't be.

### 6.1 Worth revisiting now

| Decision | Current state | Revisit rationale | Recommendation |
|---|---|---|---|
| `OpenRouterConfig` type alias kept for test compat | `src/types/index.ts` exports both `ProviderConfig` and `OpenRouterConfig = ProviderConfig` | Dual names confuse readers. Phase 3 retires it, but if Phase 3 is delayed, the alias lingers. | **Keep as-is for now.** Retire in Phase 3 step 1 as planned. Not worth a separate commit. |
| `getOpenRouterConfig()` legacy accessor | `src/config/index.ts` delegates to `getProviderConfig()` | Same as above. | **Keep as-is.** Retire in Phase 3. |
| `Config` singleton | `Config.getInstance()` | The provider singleton was dropped in 2B, but `Config`/`Logger`/`ImageProcessor` retain singletons. Inconsistent. | **Defer.** `Config` singleton is harmless (read-once at startup). Not worth changing before release. |
| `Logger` doesn't serialize error `reason` in `unhandledRejection` | `src/utils/logger.ts:53-60` only prints `.stack` | D14 — startup errors are truncated. | **Address in Phase 3** (test repair phase) since Logger is test-covered. |
| `index.ts` has `Config.getInstance()` outside try/catch | `src/index.ts:18-19` | If Config throws, the error hits `unhandledRejection` instead of the `main()` catch block. D14. | **Address in Phase 3 or 2C.** Move `Config.getInstance()` inside the try block. One-line fix. |
| Startup `testConnection` + `validateModel` make real HTTP calls | `src/index.ts:246-264` | Blocks startup if the provider is down. Pre-existing. | **Defer.** This is existing behavior; changing it is a behavior change. Document in README. |

### 6.2 Not worth revisiting

| Decision | Why leave it |
|---|---|
| `ImageProcessor` singleton | Provider-neutral, harmless, tested. |
| `axios` as the HTTP client | Works, no reason to switch. |
| Signature-based MIME detection (no native deps) | Excellent for portability. |
| 3 separate tool handlers instead of 1 parameterized | The tools have distinct prompt-building logic; merging them would add complexity. |
| `PROVIDER_DEFAULTS` table in `Config` | Clean, centralized, easy to extend. |
| `PROVIDER_CAPABILITIES` table in `ProviderFactory` | Clean, centralized, easy to extend. |

---

## 7. Is the Current Architecture Still Appropriate?

**YES.** Every learning has reinforced, not contradicted, the architecture:

| Learning | Architectural implication |
|---|---|
| 6 providers work through one shared adapter | The `OpenAICompatibleProvider` + per-provider config is the right abstraction granularity. |
| `baseUrl` divergence across providers | The full-prefix `baseUrl` design rule was correct. |
| OpenRouter's headers are provider-specific | The `extraHeaders` config field was the right abstraction. |
| Capabilities are uniform across 2B providers | The `ProviderCapabilities` interface is sufficient as-is. |
| The `satisfies never` guard caught a real issue | The factory's exhaustiveness checking is valuable; keep it. |
| Move-not-rewrite preserved behavior | The adapter is in the right place (`src/providers/`) with the right shape. |
| The sentinel (legacy env vars) stayed green throughout | The backwards-compat layer is correctly designed. |

**No architectural changes recommended.** The Phase 1 seam (`VisionProvider` interface) and the Phase 2B shared adapter are the right structure. Phase 2C adds providers by widening the union and adding cases — exactly as the architecture was designed to accommodate.

---

## 8. Is Phase 2C Still the Highest-Value Next Investment?

**NO — not immediately.** The highest-value next investment is **Phase 3 (test repair)**, for three reasons:

### 8.1 Risk argument

The codebase has had 73 failing tests since baseline. Every Phase 1 and Phase 2B commit relied on the sentinel (8/8) as the regression canary, but the sentinel is a single black-box test. The 73 failing unit/integration tests represent **lost coverage** — they test `Config`, `OpenRouterClient`/`OpenAICompatibleProvider`, `ImageProcessor`, `Logger`, and the tool handlers at the unit level. Without them, any future change (Phase 2C, 2D, or production bug fixes) flies blind.

Adding 3 more providers (Phase 2C) without a green test suite means:
- No unit-level regression detection for the new providers.
- No unit-level regression detection for the 2B providers when 2C modifies shared code (e.g., removing the vision heuristic, gating `response_format`).
- The sentinel alone is insufficient for multi-provider changes.

### 8.2 Cost argument

Phase 3 (test repair) was already estimated at "the largest single chunk of work" in the Phase 1 plan. It's now larger because Phase 2B renamed `OpenRouterConfig` → `ProviderConfig` and `getOpenRouterConfig()` → `getProviderConfig()`, affecting 21 test references. Repairing tests after 2C would be even larger because 2C adds provider-specific test cases.

### 8.3 Value argument

A green test suite is a **prerequisite for production release**, not a nice-to-have. Phase 2C adds features (more providers) that are not needed for the existing OpenRouter user base. The codebase already supports 6 providers — that's a 6× expansion from baseline. Adding 3 more before repairing tests is diminishing returns.

### 8.4 Counter-argument (and why it doesn't hold)

The counter-argument is "Phase 2C is small (add 3 cases to the factory + 1 dedicated adapter for Azure), so do it first, then repair tests once." This would be valid if 2C didn't also include the deferred hygiene items (D4, D5, D6) which modify the shared adapter. Modifying the shared adapter without a green test suite is risky.

### 8.5 Recommendation

**Reorder: Phase 3 before Phase 2C.** Repair the test suite now while the codebase is small and the test surface is well-understood. Then execute Phase 2C with full regression coverage.

---

## 9. Should Any Phases Be Reordered?

**YES.** Recommended reorder:

### Current planned order
```
2B.5 Stage 2 (optional) → 2C → 3 → 4 → release
```

### Recommended order
```
3 (test repair) → 2C (provider expansion + hygiene) → 2B.5 Stage 2 (live validation) → 4 (release validation) → release
```

### Rationale

| Reorder | Why |
|---|---|
| **Phase 3 before 2C** | Green tests are a prerequisite for safely modifying the shared adapter (which 2C does for D4/D5/D6). |
| **2B.5 Stage 2 after 2C** | Stage 2 validates live providers. Validating 6 providers (2B) then re-validating 9 (2C) is wasteful. Do Stage 2 once, after 2C, against the full matrix. |
| **Phase 4 after Stage 2** | Phase 4 is release validation. It should incorporate Stage 2's live-test results. |

### What does NOT reorder
- Phase 2A (complete, not repeated)
- Phase 2B (complete, not repeated)
- Phase 0, Phase 1 (complete)

---

## 10. Recommended Execution Path to First Production-Ready Release

```
MILESTONE (current)
  ├─ Phase 2B.5 Stage 1 COMPLETE (all gates pass)
  └─ Codebase at 2a3b5f9

▼

PHASE 3 — TEST REPAIR (recommended next)
  ├─ Fix .eslintrc.json (D2) — 1 line
  ├─ Migrate test references: OpenRouterConfig → ProviderConfig, getOpenRouterConfig → getProviderConfig (D7) — mechanical
  ├─ Repair 4 stale unit test files (analyze-image, analyze-webpage, analyze-mobile-app, openrouter-client→openai-compatible)
  ├─ Repair 2 stale integration test files (edge-cases, meta-guy-analysis)
  ├─ Add provider abstraction test coverage (factory dispatch, capabilities, extraHeaders, legacy fallback)
  ├─ Improve Logger.error to serialize reason (D14)
  ├─ Move Config.getInstance() inside try/catch in index.ts (D14)
  └─ Gate: npm test green, npm run lint green, npm run build green, sentinel 8/8

▼

PHASE 2C — PROVIDER EXPANSION + HYGIENE
  ├─ D4: provider-aware startup log strings (src/index.ts)
  ├─ D5: remove vision-by-name heuristic; trust user model id
  ├─ D6: gate response_format on capabilities.jsonMode
  ├─ Spike 2A-1: verify Cerebras vision support (30 min, requires key)
  ├─ Add 'chutes' provider (extends OpenAICompatibleProvider, supported_features preflight)
  ├─ Add 'cerebras' provider (conditional on spike result)
  ├─ Add 'azure' provider (dedicated AzureOpenAIProvider — PSI)
  └─ Gate: npm test green, npm run lint green, sentinel 8/8, 3 new providers smoke-tested

▼

PHASE 2B.5 STAGE 2 — LIVE PROVIDER VALIDATION
  ├─ Obtain API keys for as many providers as possible
  ├─ Execute TM-17 (single provider) and TM-18 (full matrix)
  ├─ Record latency, response shapes, edge cases
  └─ Gate: at least 1 provider live-validated end-to-end

▼

PHASE 4 — RELEASE VALIDATION
  ├─ Full integration test sweep
  ├─ README update (provider-neutral docs)
  ├─ npm package rename (openrouter-image-mcp → vision-mcp or similar)
  ├─ Remove committed .tgz (D10)
  ├─ Remove .DS_Store (D13)
  ├─ Dependency audit (D11) — fix or document
  ├─ MCP SDK upgrade assessment (D12)
  └─ Gate: all green, README accurate, package publishable

▼

PRODUCTION-READY RELEASE
```

---

## 11. Current Architecture Health Assessment

| Dimension | Rating | Evidence |
|---|---|---|
| **Modularity** | Excellent | 10 files, clear separation (config, providers, tools, utils, types) |
| **Coupling** | Excellent | 1 concrete coupling site (factory); tools depend on interface |
| **Testability** | Poor → recoverable | 73 tests fail, but the test surface is well-understood and repair is scoped |
| **MCP compatibility** | Excellent | Schemas byte-identical to baseline; sentinel 8/8 at every checkpoint |
| **Backwards compatibility** | Excellent | Legacy env vars work; OpenRouter user experience unchanged |
| **Provider neutrality** | Excellent | 6 providers through 1 shared adapter; per-provider config drives behavior |
| **Error handling** | Good | Provider-aware errors; empty-choices handled; startup error logging truncated (D14) |
| **Logging** | Good | No key leakage; provider-aware adapter strings; startup strings stale (D4) |
| **Dependency health** | Fair | No new deps; 20 vulnerabilities pending audit; MCP SDK 0.5.0 old |
| **Documentation** | Fair | Code is well-commented; README still says "OpenRouter" (D4-adjacent); 8 phase reports are thorough |
| **Runtime safety** | Good | Timeouts consistent; image validation present; no native deps |

**Overall: GOOD and trending EXCELLENT.** The architecture is sound. The test debt is the primary drag.

---

## 12. Technical Debt Assessment (prioritized)

### 12.1 Priority matrix

| Priority | Debt | Effort | Value | Do when |
|---|---|---|---|---|
| P0 | D1, D3 (stale tests) | High (1-2 days) | Critical (regression safety) | Phase 3 |
| P0 | D2 (ESLint config) | Trivial (1 line) | High (lint green) | Phase 3 |
| P1 | D14 (startup error logging) | Low (Logger + index.ts) | High (user experience) | Phase 3 |
| P1 | D4 (startup log strings) | Low (index.ts) | Medium (provider correctness) | Phase 2C |
| P1 | D5 (vision heuristic) | Low (openai-compatible.ts) | Medium (correctness) | Phase 2C |
| P1 | D6 (response_format gating) | Low (openai-compatible.ts) | Low-now, High-future | Phase 2C |
| P2 | D7 (legacy alias/accessor) | Trivial | Low (cleanliness) | Phase 3 |
| P2 | D11 (vulnerabilities) | Medium (audit + fix) | Medium (security) | Pre-release or dedicated sprint |
| P3 | D8, D9, D10, D13, D15 | Low each | Low each | Post-release hygiene |
| P3 | D12 (MCP SDK) | Medium (upgrade + test) | Low (protocol-stable) | Post-release |

### 12.2 Debt-by-phase allocation

```
Phase 3:  D1, D2, D3, D7, D14 (+ index.ts try/catch fix)
Phase 2C: D4, D5, D6
Phase 4:  D10, D13, D11 (audit), D12 (assessment)
Post-release: D8, D9, D15
```

---

## 13. Risk Assessment (current state)

| Risk | Likelihood | Impact | Status | Mitigation |
|---|---|---|---|---|
| Phase 2C modifies shared adapter without test coverage | Medium | High | **Elevated** | Reorder: Phase 3 first |
| Live provider behavior diverges from documented shape | Low | Medium | Unchanged | Stage 2 after 2C |
| Cerebras vision support unverified | Medium | Low | Unchanged | Spike 2A-1 in 2C |
| Azure adapter is more complex than estimated | Medium | Medium | Unchanged | Phase 2C plan will scope this |
| Test repair reveals a hidden 2B bug | Low | Medium | Unchanged | Phase 3 will surface it |
| npm vulnerabilities are exploitable | Low | High | Unchanged | Phase 4 audit |
| MCP SDK 0.5.0 breaks against a current MCP client | Low | Medium | Unchanged | Phase 4 assessment |
| Startup error path confuses users | Medium | Low | Elevated (D14) | Phase 3 fix |

**No new high-impact risks.** The reorder (Phase 3 first) reduces the top risk (2C without coverage).

---

## 14. Release Readiness Assessment

**Not yet release-ready.** Gaps:

| Release criterion | Status | Gap |
|---|---|---|
| Build green | ✅ | — |
| Lint green | ❌ | D2 (Phase 3) |
| Tests green | ❌ | D1, D3 (Phase 3) |
| MCP contract verified | ✅ | — |
| Provider abstraction validated | ✅ (Tier 1) | Tier 2/3 (Stage 2) |
| Backwards compatibility | ✅ | — |
| README accurate | ❌ | Still says "OpenRouter"; needs provider-neutral rewrite |
| npm package name | ❌ | `openrouter-image-mcp` is taken; needs rename |
| Committed artifact removed | ❌ | D10 |
| Dependencies audited | ❌ | D11 |
| Error messages clear | ⚠️ | D14 |
| License clean | ✅ | MIT |

**Estimated path to release:** Phase 3 → Phase 2C → Stage 2 → Phase 4 → release. **4 phases.**

---

## 15. Updated Engineering Roadmap

```
COMPLETED
  Phase 0   — Baseline Validation                    ✅
  Phase 1   — Provider Abstraction Layer              ✅
  Phase 2A  — Provider Compatibility Validation       ✅
  Phase 2B  — OpenAI-Compatible Provider Expansion    ✅
  Phase 2B.5 Stage 1 — Keyless Validation             ✅

RECOMMENDED NEXT
  Phase 3   — Test Repair + Lint + Logger Hygiene     ◀ highest value
  Phase 2C  — Provider Expansion (Chutes/Cerebras/Azure) + 2B-hygiene (D4/D5/D6)
  Phase 2B.5 Stage 2 — Live Provider Validation
  Phase 4   — Release Validation (README, rename, audit, cleanup)

DEFERRED
  Future hardening — D8, D9, D11 (audit), D12 (SDK upgrade), D15
```

---

## 16. Priority Matrix

| Work item | Value | Effort | Priority |
|---|---|---|---|
| Phase 3 (test repair) | Critical | High | **P0 — do next** |
| D2 (ESLint fix) | High | Trivial | P0 (inside Phase 3) |
| D14 (Logger + index.ts error path) | High | Low | P0 (inside Phase 3) |
| Phase 2C (3 providers + hygiene) | Medium | Medium | P1 (after Phase 3) |
| D4, D5, D6 (2B hygiene) | Medium | Low | P1 (inside Phase 2C) |
| Stage 2 (live validation) | Medium | Low (with keys) | P2 (after 2C) |
| Phase 4 (release prep) | Critical | Medium | P2 (after Stage 2) |
| D11 (vuln audit) | Medium | Medium | P3 (pre-release or sprint) |
| D12 (SDK upgrade) | Low | Medium | P3 (post-release) |
| D8, D9, D10, D13, D15 | Low | Low | P3 (post-release hygiene) |

---

## 17. Go / No-Go Recommendation for Phase 2C

### NO-GO on Phase 2C as the immediate next step.

### GO on Phase 3 as the immediate next step.

**Rationale:**

1. **Phase 2C modifies the shared adapter** (D4: log strings, D5: remove vision heuristic, D6: gate `response_format`). The shared adapter is the most critical file in the codebase — it serves all 6 current providers and will serve all 9 after 2C.

2. **The shared adapter has no unit test coverage.** The 16 `openrouter-client.test.ts` failures (Phase 0) mean the adapter's unit tests are broken. Modifying the adapter without repairing these tests first is flying blind.

3. **Phase 3 is a prerequisite for production release anyway.** Doing it now (when the codebase is small) is cheaper than doing it later (when 2C has added 3 more providers and more test surface).

4. **Phase 2C is not time-sensitive.** The codebase already supports 6 providers — a 6× expansion from baseline. The 3 deferred providers (Chutes, Cerebras, Azure) are nice-to-have, not must-have, for the first production release.

5. **The reorder reduces the top risk in the register** (Phase 2C without coverage).

### Conditions for Phase 2C GO (after Phase 3)

- `npm test` green
- `npm run lint` green
- `npm run build` green
- Sentinel 8/8
- Logger error serialization improved (D14)
- `Config.getInstance()` inside try/catch (D14)

Once Phase 3 is complete, Phase 2C can proceed with full regression coverage as a safety net.

---

## 18. Summary

**What we have:** A provider-neutral Vision MCP with 6 working OpenAI-compatible providers, a clean abstraction, byte-preserved MCP contract, backwards compatibility, and operational validation at the keyless tier.

**What we lack:** A green test suite, lint, provider-aware startup strings, and live-provider validation.

**What we should do next:** Phase 3 (test repair) — not Phase 2C. This is the highest-value investment because it restores the regression safety net before the next round of shared-adapter modifications.

**What we should do after:** Phase 2C (3 more providers + deferred hygiene), then Stage 2 (live validation), then Phase 4 (release prep).

**The architecture is sound. The discipline is sound. The reorder is a refinement, not a course correction.**

---

**Milestone review complete. Awaiting direction on whether to proceed with Phase 3 planning (recommended) or Phase 2C planning (original order).**