# PHASE 3 — Implementation Plan: Test Repair and Engineering Hygiene

**Status:** Approved (revised per Pre-Implementation Review)
**Predecessor:** Project Milestone Review (approved, recommended reorder)
**Scope:** Restore the regression safety net (tests + lint), fix startup error logging (D14), retire the legacy `getOpenRouterConfig()` runtime accessor.
**Principle:** Repair the safety net before modifying the shared adapter (Phase 2C). Small, incremental, independently verifiable commits.

---

## 1. Phase Objectives

1. **Restore `npm test` to green** — repair all failing test files.
2. **Restore `npm run lint` to green** — fix the broken `.eslintrc.json` config (D2).
3. **Add provider-abstraction test coverage** — unit tests for `ProviderFactory`, `OpenAICompatibleProvider` per-provider behavior, legacy fallback, `EXTRA_HEADERS` parsing.
4. **Improve startup error logging (D14)** — `Logger.error` serializes the `reason` object (the Config relocation was eliminated per the Pre-Implementation Review — the Logger fix alone resolves the observable symptom).
5. **Retire the `getOpenRouterConfig()` runtime accessor** — remove the dead-code method after tests no longer reference it. The `OpenRouterConfig` type alias is **retained** (zero-cost, potential external-consumer compatibility).
6. **Preserve the MCP contract** — no tool name, schema, or output format changes.
7. **Preserve runtime behavior** — no behavior changes beyond clearer error messages.

**What this phase IS NOT:**
- Adding providers (Phase 2C)
- Adding features
- Changing the `VisionProvider` interface
- Changing tool schemas or names
- Removing the vision-by-name heuristic (D5 — Phase 2C)
- Making `response_format` conditional (D6 — Phase 2C)
- Provider-aware startup log strings (D4 — Phase 2C)
- Moving `Config.getInstance()` inside try/catch (eliminated — Logger fix is sufficient)
- Removing the `OpenRouterConfig` type alias (retained indefinitely)
- Dependency audit / MCP SDK upgrade / README rewrite / npm rename (Phase 4)
- Removing the committed `.tgz` (Phase 4)

---

## 2. Scope

### 2.1 In scope

| Item | Debt ID | Effort |
|---|---|---|
| Repair 5 failing unit test files | D1 | High |
| Repair 2 failing integration test files | D1 | Medium |
| Fix `.eslintrc.json` config | D2 | Trivial |
| `npm test` green | D3 | (outcome of D1) |
| `npm run lint` green | D3 | (outcome of D2) |
| `Logger.error` serializes `reason` | D14 | Low |
| `Config.getInstance()` inside try/catch | D14 | Trivial |
| Remove `OpenRouterConfig` type alias | D7 | Trivial (after tests migrated) |
| Remove `getOpenRouterConfig()` accessor | D7 | Trivial (after tests migrated) |
| Add `ProviderFactory` dispatch tests | — | Medium |
| Add `OpenAICompatibleProvider` unit tests | — | Medium |
| Add legacy-fallback + `EXTRA_HEADERS` tests | — | Low |

### 2.2 Out of scope (explicit)

- ❌ D4 (startup log strings) — Phase 2C
- ❌ D5 (vision heuristic) — Phase 2C
- ❌ D6 (`response_format` gating) — Phase 2C
- ❌ D8 (`RETRY_ATTEMPTS` unused) — future hardening
- ❌ D9 (double timeout) — future hardening
- ❌ D10 (committed `.tgz`) — Phase 4
- ❌ D11 (vulnerabilities) — Phase 4 or dedicated sprint
- ❌ D12 (MCP SDK upgrade) — Phase 4 or post-release
- ❌ D13 (`.DS_Store`) — Phase 4
- ❌ D15 (invalid base64 doesn't throw) — future hardening
- ❌ New providers — Phase 2C
- ❌ README / npm rename — Phase 4
- ❌ Any change to `src/tools/*.ts` logic (tool handlers already decoupled in Phase 1)
- ❌ Any change to MCP schemas in `src/index.ts`

---

## 3. Root-Cause Analysis of Failing Tests

Empirically confirmed at the current codebase (`2a3b5f9`):

### 3.1 Unit test status: 30/33 pass, 3 fail (was 35/84 at baseline — count dropped because failing files don't register their tests)

| File | Status | Root cause |
|---|---|---|
| `test/unit/logger.test.ts` | ✅ 24/24 | — |
| `test/unit/image-processor.test.ts` | ✅ 5/5 | — |
| `test/unit/config.test.ts` | ❌ 1/4 | **Assertion drift** — expects old error message `"OPENROUTER_API_KEY environment variable is required"` but Phase 2B now throws `"API_KEY environment variable is required (or the legacy OPENROUTER_API_KEY)"`. Also calls `getOpenRouterConfig()` (legacy accessor — still works, delegates). |
| `test/unit/analyze-image-tool.test.ts` | ❌ file fails to load | **Import resolution** — imports `registerAnalyzeImageTool` from `src/tools/analyze-image.js` (doesn't exist — source exports `handleAnalyzeImage`) AND imports `OpenRouterClient` from `src/utils/openrouter-client.js` (deleted in Phase 2B). |
| `test/unit/analyze-webpage-tool.test.ts` | ❌ file fails to load | Same as above — imports `registerAnalyzeWebpageTool` + `OpenRouterClient`. |
| `test/unit/analyze-mobile-app-tool.test.ts` | ❌ file fails to load | Same — imports `registerAnalyzeMobileAppTool` + `OpenRouterClient`. |
| `test/unit/openrouter-client.test.ts` | ❌ file fails to load | **Import resolution** — imports `OpenRouterClient` from `src/utils/openrouter-client.js` (deleted). Also asserts `axios.create` was called with `timeout: 60000` (source uses `120000`). |

### 3.2 Integration test status: 8/8 pass (sentinel), 2 files fail to load

| File | Status | Root cause |
|---|---|---|
| `test/integration/mcp-server.test.ts` | ✅ 8/8 | Black-box subprocess test — the sentinel. Uses legacy env vars. **Must stay green throughout Phase 3.** |
| `test/integration/edge-cases.test.ts` | ❌ file fails to load | **Import resolution** — imports `OpenRouterClient` (deleted) + `TestHelpers` from `../utils/test-helpers.js` (exists). Tests the old `registerAnalyzeXTool` API. |
| `test/integration/meta-guy-analysis.test.ts` | ❌ file fails to load | **Transform/syntax error** at line 477 — `Expected "}" but found ";"`. A pre-existing syntax bug in the test file itself, independent of Phase 2B. |

### 3.3 Failure classification

| Class | Files | Fix strategy |
|---|---|---|
| **A — Import resolution (deleted module)** | 5 files (3 tool tests + openrouter-client + edge-cases) | Rewrite to import `OpenAICompatibleProvider` / `handleAnalyzeImage` / `ProviderFactory` |
| **B — Assertion drift (error message)** | 1 file (config) | Update assertions to match new error messages + env-var names |
| **C — Stale API (registerAnalyzeXTool)** | 4 files (3 tool tests + edge-cases) — overlaps with A | Rewrite to test `handleAnalyzeImage(args, config, provider, logger)` signature |
| **D — Syntax error** | 1 file (meta-guy) | Fix the syntax error at line 477, then assess whether the test logic is still valid |

---

## 4. Test Migration Strategy

### 4.1 Principle

**Rewrite, don't patch.** The stale tests test an API that no longer exists (`registerAnalyzeXTool`, `OpenRouterClient`). Patching them to import different modules would leave the test logic testing the wrong things. A clean rewrite — testing the actual current API (`handleAnalyzeImage`, `OpenAICompatibleProvider`, `ProviderFactory`) — is more reliable and more valuable.

### 4.2 Migration per file

| File | Strategy |
|---|---|
| `test/unit/config.test.ts` | **Update assertions** (not a rewrite). Change expected error message to `"API_KEY environment variable is required"`. Add tests for new env vars (`PROVIDER`, `API_KEY`, `MODEL`, `BASE_URL`, `EXTRA_HEADERS`), legacy fallback, per-provider defaults, invalid provider error, missing-`MODEL` error. |
| `test/unit/analyze-image-tool.test.ts` | **Rewrite.** Import `handleAnalyzeImage` from `src/tools/analyze-image.js`. Mock `VisionProvider` (interface) instead of `OpenRouterClient` (concrete). Test the `(args, config, provider, logger)` signature. Cover: base64/file/URL inputs, unsupported MIME, size limit, processing error, provider error, empty result, default options. |
| `test/unit/analyze-webpage-tool.test.ts` | **Rewrite.** Same pattern as analyze-image. Cover: focus areas, accessibility flag, JSON format, default settings, URL input. |
| `test/unit/analyze-mobile-app-tool.test.ts` | **Rewrite.** Same pattern. Cover: platform (ios/android/auto-detect), focus areas, UX heuristics flag, JSON format. |
| `test/unit/openrouter-client.test.ts` → `test/unit/openai-compatible-provider.test.ts` | **Rename + rewrite.** Test `OpenAICompatibleProvider` directly. Mock axios. Cover: `analyzeImage` (text + JSON response, empty choices, empty content, axios error, generic error, default prompt), `testConnection`, `validateModel`, `extractErrorMessage` (provider-aware), `capabilities` getter, `extraHeaders` in axios config. |
| `test/integration/edge-cases.test.ts` | **Rewrite.** Remove `OpenRouterClient` import. Use `TestHelpers` (still valid). Mock `VisionProvider`. Cover: empty base64, large image, corrupted data, non-existent file, invalid URL, auth failure, rate limit, model unavailable, timeout, parse error, missing params, invalid types, null/undefined, long params. |
| `test/integration/meta-guy-analysis.test.ts` | **Fix syntax, then assess.** Fix line 477 syntax error. If the test logic is still valid against the current API, update imports. If not, rewrite or delete. |

### 4.3 New test files to add

| File | Purpose |
|---|---|
| `test/unit/provider-factory.test.ts` | Test `ProviderFactory.create` for each `ProviderId`: returns `OpenAICompatibleProvider`, has correct `capabilities`, throws on invalid id. |
| `test/unit/provider-config.test.ts` | (Optional — may fold into `config.test.ts`.) Test per-provider default resolution, env-var precedence, `EXTRA_HEADERS` parsing. |

### 4.4 Test conventions to follow

- Use `vitest` (`describe`, `it`, `expect`, `vi`) — matches existing tests.
- Mock at the module level with `vi.mock('...')`.
- Mock `Logger` to avoid console noise.
- Mock `axios` for provider tests.
- Reset singletons in `beforeEach`/`afterEach` (existing pattern).
- No real network calls (keyless validation principle from Phase 2B.5).
- Each test file should be independently runnable (`npx vitest run <file>`).

---

## 5. Lint Repair Strategy

### 5.1 Root cause

`.eslintrc.json` extends `"@typescript-eslint/recommended"` (bare string). The installed `@typescript-eslint/eslint-plugin@^6.0.0` exposes this config as `"plugin:@typescript-eslint/recommended"`. The bare form was valid in older plugin versions; the config resolution path changed in v6.

### 5.2 Fix

One-line change in `.eslintrc.json`:

```diff
- "@typescript-eslint/recommended"
+ "plugin:@typescript-eslint/recommended"
```

### 5.3 Verification

```bash
npm run lint  # must exit 0
```

### 5.4 Follow-up

After the config is fixed, lint may surface source-code warnings (e.g., `@typescript-eslint/no-explicit-any` is `warn`, not `error`). Phase 3 scope is **lint green** — if warnings exist, they're acceptable (warnings don't fail lint). If errors exist, fix them. **Do not** change lint rules to suppress errors; fix the source.

---

## 6. Logger Improvement Strategy (D14)

### 6.1 Root cause

`Logger.error(message, error?)` at `src/utils/logger.ts:53-60`:
```typescript
public error(message: string, error?: any): void {
  if (this.shouldLog('error')) {
    console.error(this.formatMessage('error', message));
    if (error && error.stack) {
      console.error(error.stack);
    }
  }
}
```

The `unhandledRejection` handler at `src/index.ts:273-277` calls `logger.error('Unhandled Rejection at:', { reason, promise })`. The second arg `{reason, promise}` has no `.stack`, so nothing prints beyond the message string. The actual rejection reason is swallowed.

### 6.2 Fix

Update `Logger.error` to serialize the error data when there's no `.stack`:

```typescript
public error(message: string, error?: any): void {
  if (this.shouldLog('error')) {
    console.error(this.formatMessage('error', message));
    if (error && error.stack) {
      console.error(error.stack);
    } else if (error !== undefined) {
      // Serialize non-Error payloads (e.g., { reason, promise } from unhandledRejection)
      try {
        console.error(typeof error === 'object' ? JSON.stringify(error, null, 2) : String(error));
      } catch {
        console.error('[unserializable error object]');
      }
    }
  }
}
```

### 6.3 Behavior change

- **Before:** `unhandledRejection` prints `[timestamp] [ERROR] Unhandled Rejection at:` and nothing else.
- **After:** prints the same line + a JSON serialization of `{reason, promise}` (or the reason's message if it's an Error).

This is a **strict improvement** — no information is lost, and previously-swallowed information is now surfaced. No downstream code depends on the truncated behavior.

### 6.4 Test coverage

`test/unit/logger.test.ts` (currently 24/24 passing) must continue to pass. Add 1–2 new tests:
- `error()` serializes a non-Error object (e.g., `{reason: 'x'}`) via `JSON.stringify`.
- `error()` serializes a string reason via `String()`.
- `error()` handles circular references without crashing (the `try/catch` fallback).

---

## 7. Config Initialization Improvement Strategy (D14)

### 7.1 Root cause

`src/index.ts:17-19`:
```typescript
async function main() {
  const logger = Logger.getInstance();
  const config = Config.getInstance();  // ← OUTSIDE try/catch
```

If `Config.getInstance()` throws (invalid provider, missing API key, malformed `EXTRA_HEADERS`), the error is uncaught and hits the `unhandledRejection`/`uncaughtException` handler (line 273/280), which calls `process.exit(1)` with the truncated logging described in §6.

### 7.2 Fix

Move `Config.getInstance()` inside the try/catch:

```typescript
async function main() {
  const logger = Logger.getInstance();
  let config: Config;
  try {
    config = Config.getInstance();
  } catch (error) {
    logger.error('Failed to initialize configuration', error);
    process.exit(1);
  }

  try {
    logger.info('Starting OpenRouter Image MCP Server');
    // ... rest of main
```

Alternatively, merge into a single try/catch:

```typescript
async function main() {
  const logger = Logger.getInstance();
  try {
    const config = Config.getInstance();
    logger.info('Starting OpenRouter Image MCP Server');
    // ... rest of main
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}
```

**Choose the merged version** — it's simpler and the existing catch block already handles startup errors.

### 7.3 Behavior change

- **Before:** config errors hit `unhandledRejection` → truncated message → `process.exit(1)`.
- **After:** config errors hit `main()`'s catch → `logger.error('Failed to start server', error)` → `process.exit(1)`.

The error message is now clear (thanks to §6's Logger fix + the catch block's `error.stack` printing). The exit code is unchanged. This is a **strict improvement** in user experience.

### 7.4 Test coverage

The sentinel (`mcp-server.test.ts`) spawns the server with valid env vars, so this path isn't exercised by existing tests. The `config.test.ts` rewrite (§4.2) tests `Config.getInstance()` directly and asserts the thrown error messages. No new integration test needed for the `index.ts` wiring — the behavior change is "error is caught earlier and printed better," which is covered by the §6 Logger tests + the §4.2 config tests.

---

## 8. File-by-File Implementation Plan

### 8.1 Source files to modify (3)

| File | Change | Lines |
|---|---|---|
| `.eslintrc.json` | Fix `@typescript-eslint/recommended` → `plugin:@typescript-eslint/recommended` | 1 line |
| `src/utils/logger.ts` | `error()` serializes non-Error `error` arg | +6 lines |
| `src/index.ts` | Move `Config.getInstance()` inside try/catch | ~3 lines rearranged |
| `src/types/index.ts` | Remove `OpenRouterConfig` type alias (after tests migrated) | -4 lines |
| `src/config/index.ts` | Remove `getOpenRouterConfig()` accessor (after tests migrated) | -5 lines |

### 8.2 Test files to modify (5)

| File | Change |
|---|---|
| `test/unit/config.test.ts` | Update assertions + add new-env-var coverage |
| `test/unit/analyze-image-tool.test.ts` | Rewrite for `handleAnalyzeImage` + `VisionProvider` mock |
| `test/unit/analyze-webpage-tool.test.ts` | Rewrite for `handleAnalyzeWebpage` + `VisionProvider` mock |
| `test/unit/analyze-mobile-app-tool.test.ts` | Rewrite for `handleAnalyzeMobileApp` + `VisionProvider` mock |
| `test/integration/edge-cases.test.ts` | Rewrite: remove `OpenRouterClient` import, mock `VisionProvider` |
| `test/integration/meta-guy-analysis.test.ts` | Fix syntax error at line 477, then assess/rewrite |

### 8.3 Test files to add (2)

| File | Purpose |
|---|---|
| `test/unit/openai-compatible-provider.test.ts` | Replaces `openrouter-client.test.ts`; tests the shared adapter |
| `test/unit/provider-factory.test.ts` | Tests factory dispatch + capabilities + invalid-id error |

### 8.4 Test files to delete (1)

| File | Reason |
|---|---|
| `test/unit/openrouter-client.test.ts` | Replaced by `openai-compatible-provider.test.ts` (the class it tested was deleted in Phase 2B) |

---

## 9. Commit Sequence (Revised per Pre-Implementation Review)

**12 commits, ordered: lint first (unblocks lint green), then Logger (D14), then test repair (split into small commits), then legacy-accessor removal (last, highest risk).**

```
pre:   git tag pre-phase-3                                              [rollback point]

 1. phase3: fix .eslintrc.json config resolution                        [trivial, unblocks lint]
 2. phase3: improve Logger.error to serialize non-Error payloads         [D14]
 3. phase3: rewrite config.test.ts for new env vars + legacy fallback
 4. phase3: rewrite analyze-image-tool.test.ts (port all 12 scenarios)
 5. phase3: rewrite analyze-webpage-tool.test.ts (port all 10 scenarios)
 6. phase3: rewrite analyze-mobile-app-tool.test.ts (port all 12 scenarios)
 7. phase3: replace openrouter-client.test.ts with openai-compatible-provider.test.ts (~11 tests)
 8. phase3: add provider-factory.test.ts
 9. phase3: rewrite edge-cases.test.ts part 1 (image + input validation, ~12 tests)
10. phase3: rewrite edge-cases.test.ts part 2 (API + config + network, ~12 tests)
11. phase3: delete meta-guy-analysis.test.ts (redundant coverage)
12. phase3: remove getOpenRouterConfig() legacy accessor
```

### 9.1 Per-commit buildability

Each commit must leave the repo in a buildable state (`npm run build` exit 0). The sentinel must stay 8/8.

| Commit | Build | Sentinel | Lint | Test status after commit |
|---|---|---|---|---|
| pre (tag) | ✅ | 8/8 | fail (config) | baseline: 33/41 pass |
| 1 (eslint) | ✅ | 8/8 | GREEN | 33/41 pass (no test changes) |
| 2 (logger) | ✅ | 8/8 | GREEN | logger tests still pass |
| 3 (config.test) | ✅ | 8/8 | GREEN | config tests GREEN |
| 4 (analyze-image) | ✅ | 8/8 | GREEN | analyze-image tests GREEN |
| 5 (analyze-webpage) | ✅ | 8/8 | GREEN | analyze-webpage tests GREEN |
| 6 (analyze-mobile) | ✅ | 8/8 | GREEN | analyze-mobile tests GREEN |
| 7 (provider test) | ✅ | 8/8 | GREEN | provider tests GREEN |
| 8 (factory test) | ✅ | 8/8 | GREEN | factory tests GREEN |
| 9 (edge-cases p1) | ✅ | 8/8 | GREEN | edge-cases p1 GREEN |
| 10 (edge-cases p2) | ✅ | 8/8 | GREEN | edge-cases p2 GREEN |
| 11 (delete meta-guy) | ✅ | 8/8 | GREEN | meta-guy gone |
| 12 (remove accessor) | ✅ | 8/8 | GREEN | **ALL GREEN** |

### 9.2 Behavioral preservation check (per test-rewrite commit)

After each test-rewrite commit, verify:
```bash
echo "old: $(git show HEAD~1:<old-file> | grep -c '  it(' 2>/dev/null || echo 0)"
echo "new: $(grep -c '  it(' <new-file>)"
```
The new file's test count must be ≥ the old file's count, OR every dropped test must be documented in the commit message with rationale.

**Expected drops (documented):**
- `openrouter-client.test.ts` (17) → `openai-compatible-provider.test.ts` (~11): drops 2 singleton tests (obsolete — adapter is not a singleton), minimizes 5 `validateModel` tests to 1 smoke (heuristic is D5, slated for Phase 2C removal).
- `meta-guy-analysis.test.ts` (12) → deleted: coverage fully redundant with tool tests + image-processor tests.

---

## 10. Validation Strategy

### 10.1 Per-commit validation

After **each** commit:
1. `npm run build` — must exit 0.
2. `/tmp/sentinel-check.sh` — must stay 8/8.
3. `npm run lint` — must be GREEN (after commit 1).
4. `npx vitest run <affected-test-file>` — the file being repaired must pass (for test-rewrite commits).
5. `git diff --stat` — verify only intended files changed.
6. **Behavioral preservation check** (test-rewrite commits only): `grep -c "  it(" <new-file>` ≥ `git show HEAD~1:<old-file> | grep -c "  it("`, or every drop documented in the commit message.

### 10.2 End-of-Phase 3 validation gate

| Check | Command | Expected |
|---|---|---|
| Build clean | `npm run build` | exit 0 |
| Lint clean | `npm run lint` | exit 0, zero errors (warnings acceptable) |
| Unit tests green | `npx vitest run test/unit --exclude='**/baseline/**'` | all pass |
| Integration tests green | `npx vitest run test/integration --exclude='**/baseline/**'` | all pass |
| Full test suite green | `npm test` | **exit 0** |
| Sentinel | `/tmp/sentinel-check.sh` | 8/8 |
| No `getOpenRouterConfig` in src or tests | `grep -rn "getOpenRouterConfig" src/ test/` | zero hits |
| No `OpenRouterClient` in tests | `grep -rn "OpenRouterClient" test/` | zero hits |
| `openrouter-client.test.ts` deleted | `ls test/unit/openrouter-client.test.ts` | not found |
| `meta-guy-analysis.test.ts` deleted | `ls test/integration/meta-guy-analysis.test.ts` | not found |
| `openai-compatible-provider.test.ts` exists + passes | `ls` + `npx vitest run` | file present, tests pass |
| `provider-factory.test.ts` exists + passes | `ls` + `npx vitest run` | file present, tests pass |
| Logger serializes non-Error | `test/unit/logger.test.ts` new tests pass | verified |
| MCP schemas unchanged | `diff` vs baseline tool block | byte-identical |
| No new deps | `diff baseline/package.json package.json` | only metadata |
| Test count documented | completion report | pre/post counts recorded |
| `OpenRouterConfig` type alias retained | `grep "OpenRouterConfig" src/types/index.ts` | still present (intentionally retained) |

### 10.3 Regression sentinel

`test/integration/mcp-server.test.ts` (8/8) remains the canary. It must stay green at every commit. If any commit breaks the sentinel, **stop immediately** and produce a failure report.

---

## 11. Regression Prevention Strategy

### 11.1 Sentinel protection

The sentinel is the only test that has been green since baseline. It must not break. Any commit that breaks the sentinel is a regression, regardless of whether other tests pass.

### 11.2 No source-logic changes

Phase 3 does **not** change tool handler logic, MCP schemas, request body construction, or provider behavior. The only source changes are:
- `.eslintrc.json` (config, not logic)
- `logger.ts` (error serialization — strict improvement)
- `index.ts` (Config.getInstance() relocation — same catch behavior)
- `types/index.ts` (remove alias — after tests migrated)
- `config/index.ts` (remove legacy accessor — after tests migrated)

If any of these inadvertently change runtime behavior, the sentinel or the repaired tests should catch it.

### 11.3 Test quality

The rewritten tests must:
- Test the **current** API (not the old `registerAnalyzeXTool` API).
- Mock at the module level (existing pattern).
- Cover the same scenarios as the original tests (base64/file/URL, errors, defaults, edge cases).
- Add coverage for Phase 2B features (per-provider config, legacy fallback, `extraHeaders`, `EXTRA_HEADERS` parsing, factory dispatch, capabilities).

### 11.4 Lint as a gate

After commit 1, `npm run lint` is a gate. Any subsequent commit that introduces a lint error must fix it before proceeding.

---

## 12. Rollback Strategy

### 12.1 Per-commit rollback

Each commit is independently revertible. The ordering is: config fixes → source improvements → test rewrites → legacy-shim removal. If any commit fails, revert it and re-plan.

### 12.2 Emergency rollback

`git reset --hard 2a3b5f9` (Phase 2B final commit) restores the codebase to the pre-Phase-3 state. The `baseline/` reference clone is immutable.

### 12.3 Partial-completion safety

If Phase 3 is interrupted after, say, commit 4 (config test repaired) but before commit 8 (full green), the repo is in a **better state than baseline** (lint green, Logger improved, config tests green) but not fully green. This is an acceptable partial state — it's strictly better than the starting point, and the remaining commits can be resumed.

---

## 13. Success Criteria

| # | Criterion | Verification |
|---|---|---|
| S1 | `npm run build` exit 0 | `npm run build` |
| S2 | `npm run lint` exit 0 | `npm run lint` |
| S3 | `npm test` exit 0 | `npm test` |
| S4 | Sentinel 8/8 | `/tmp/sentinel-check.sh` |
| S5 | MCP schemas byte-identical to baseline | `diff` of tool block |
| S6 | No `getOpenRouterConfig` in `src/` or `test/` | `grep -rn getOpenRouterConfig src/ test/` → 0 |
| S7 | No `OpenRouterClient` in `test/` | `grep -rn OpenRouterClient test/` → 0 |
| S8 | `openrouter-client.test.ts` deleted | `ls test/unit/openrouter-client.test.ts` → not found |
| S9 | `meta-guy-analysis.test.ts` deleted | `ls test/integration/meta-guy-analysis.test.ts` → not found |
| S10 | `openai-compatible-provider.test.ts` exists + passes | `ls` + `npx vitest run` |
| S11 | `provider-factory.test.ts` exists + passes | `ls` + `npx vitest run` |
| S12 | Logger.error serializes non-Error payloads | `test/unit/logger.test.ts` new tests pass |
| S13 | No new runtime dependencies | `diff baseline/package.json package.json` |
| S14 | No MCP tool schema changes | `diff` vs baseline tool block |
| S15 | `OpenRouterConfig` type alias retained | `grep "OpenRouterConfig" src/types/index.ts` (intentionally kept) |
| S16 | Behavioral preservation per test-rewrite commit | `grep -c "  it("` check (see §9.2) |
| S17 | Test count documented in completion report | pre: 33/41 pass; post: recorded |

**All 17 must hold for Phase 3 completion.**

---

## 14. Failure Criteria

Phase 3 fails (abort and re-plan) if:

1. **Sentinel regresses** at any commit and cannot be restored by reverting that commit.
2. **`npm run build` fails** at any commit and the root cause is a Phase 3 change (not a pre-existing issue).
3. **A rewritten test cannot be made green** because the source code behaves differently than the Phase 2B documentation predicts — this would indicate a hidden 2B bug that must be fixed before continuing.
4. **`npm run lint` introduces errors that cannot be fixed without changing lint rules** — would indicate a lint-config conflict that needs re-planning.
5. **Removing `OpenRouterConfig` / `getOpenRouterConfig()` breaks a non-test consumer** — would indicate an external dependency on the legacy shim that wasn't identified.

**None of these are indicated by current evidence.**

---

## 15. Completion Criteria

Phase 3 is complete when ALL of the following hold:

1. All 15 success criteria (S1–S15) are verified green.
2. 8 commits land in the fork's git history, each with a descriptive message referencing this plan.
3. `baseline/` remains immutable.
4. The Phase 3 Completion Report is written, documenting:
   - Final commit list
   - Success criteria verification table
   - Sentinel checkpoint after each commit
   - Any mid-flight adjustments (with rationale)
   - Test count before/after (baseline: 35/84 pass; target: all pass)
   - Remaining technical debt (D4, D5, D6 deferred to 2C; D8–D15 deferred as documented)
5. No providers were added (Phase 2C scope, enforced).
6. No MCP schema changes (enforced).
7. No new dependencies (enforced).

---

## 16. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Rewritten tests miss a scenario the original tests covered | Medium | Medium | Diff the original test `it()` blocks against the rewrites; ensure every scenario is preserved or explicitly dropped with rationale |
| `meta-guy-analysis.test.ts` syntax error is a symptom of deeper rot | Medium | Low | If the file can't be repaired reasonably, delete it and document the loss of coverage; the test exercised `ImageProcessor` + `OpenRouterClient` which are covered elsewhere |
| Lint surfaces source errors that require non-trivial fixes | Low | Medium | Lint rules are `warn` for `no-explicit-any` and `no-console`; only `no-unused-vars` is `error`. Source is clean at baseline (build passes). Risk is low. |
| Logger change breaks existing `logger.test.ts` (24 tests) | Low | Medium | The change is additive (new `else if` branch); existing assertions about `error.stack` printing remain valid. Verify by running `logger.test.ts` after commit 2. |
| `Config.getInstance()` relocation changes behavior | Low | Low | The catch block already calls `process.exit(1)`. Moving the throw site inside the try just routes the error to a clearer logger. Sentinel uses valid env vars, so this path isn't exercised. |
| Removing `OpenRouterConfig` alias breaks a test that wasn't fully migrated | Medium | Low | The alias removal is the **last** commit (commit 8), after all tests are migrated. `grep -rn OpenRouterConfig test/` must return 0 before the removal commit. |
| `edge-cases.test.ts` rewrite is larger than estimated | Medium | Low | The file is 22KB with ~25 test cases. If the rewrite is too large, split into 2 commits (edge-cases-part1, edge-cases-part2). |
| Test repair reveals a hidden Phase 2B bug | Low | High | If a rewritten test fails because the source behaves wrong, **stop**, document the bug, decide whether to fix in Phase 3 (if trivial) or defer to a hotfix. |

**Overall Phase 3 risk: LOW-MEDIUM.** The largest risk (hidden 2B bug) is actually a *benefit* of Phase 3 — it surfaces issues that the stale tests were hiding.

---

## 17. Estimated Effort

| Work item | Effort |
|---|---|
| Commit 1: eslint config fix | 5 min |
| Commit 2: Logger.error improvement | 30 min (incl. test additions) |
| Commit 3: index.ts Config relocation | 15 min |
| Commit 4: config.test.ts rewrite | 1 hr (new env-var coverage) |
| Commit 5: 3 tool handler test rewrites | 3 hr (1 hr each) |
| Commit 6: openai-compatible-provider.test.ts | 2 hr (covers full adapter surface) |
| Commit 7: edge-cases.test.ts + meta-guy fix | 2.5 hr (edge-cases is large; meta-guy may be deleted) |
| Commit 8: provider-factory.test.ts + D7 removal | 1.5 hr |
| **Total** | **~11 hours** (1.5 engineer-days) |

This aligns with the Phase 1 plan's estimate ("the largest single chunk of work") and the Milestone Review's "High (1-2 days)."

---

## 18. Expected Deliverables

1. **8 commits** in the fork's git history, each buildable and independently revertible.
2. **`npm test` green** — all unit and integration tests pass.
3. **`npm run lint` green** — zero errors (warnings acceptable).
4. **`npm run build` green** — zero TypeScript errors.
5. **Sentinel 8/8** — preserved throughout.
6. **2 new test files** — `openai-compatible-provider.test.ts`, `provider-factory.test.ts`.
7. **1 deleted test file** — `openrouter-client.test.ts`.
8. **6 repaired test files** — config, 3 tool tests, edge-cases, meta-guy.
9. **Logger improvement** — `error()` serializes non-Error payloads.
10. **`index.ts` improvement** — `Config.getInstance()` inside try/catch.
11. **Legacy shim removal** — `OpenRouterConfig` alias + `getOpenRouterConfig()` removed.
12. **Phase 3 Completion Report** — documenting all of the above.

---

## 19. Approval Checklist

Before coding begins, confirm:

- [ ] §1 Objectives match intent.
- [ ] §2 Scope is correct; §2.2 out-of-scope list is acceptable (especially: D4/D5/D6 deferred to 2C).
- [ ] §3 Root-cause analysis matches the empirical evidence.
- [ ] §4 Test migration strategy (rewrite, don't patch) is acceptable.
- [ ] §5 Lint fix (one-line config change) is acceptable.
- [ ] §6 Logger improvement (serialize non-Error payloads) is acceptable.
- [ ] §7 Config relocation (inside try/catch) is acceptable.
- [ ] §8 File-by-file plan is complete and minimal.
- [ ] §9 Commit sequence (8 commits, lint first) is acceptable.
- [ ] §10 Validation gate (15 checks) is the correct bar.
- [ ] §13 Success criteria (S1–S15) are acceptable.
- [ ] §14 Failure criteria correctly identify abort conditions.
- [ ] §17 Effort estimate (~1.5 engineer-days) is acceptable.
- [ ] The reorder rationale (Phase 3 before 2C) is still agreed.

---

**Awaiting approval. No code changes will be made until this plan is authorized.**