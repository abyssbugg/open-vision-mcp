# PHASE 4 — Implementation Plan: Release Preparation

**Status:** Approved (revised: package name deferred to placeholder until final naming decision)
**Predecessor:** Phase 2C Completion Report (approved); Stage 2 Readiness Report (approved — Stage 2 paused pending credentials)
**Codebase:** fork HEAD `df19181` (Phase 2C final)
**Objective:** Prepare the project for release while explicitly documenting that live provider validation (Stage 2) remains an outstanding operational validation, to be executed opportunistically when provider credentials become available.

---

## 1. Phase Objectives

1. **Rename the npm package** from `openrouter-image-mcp` (upstream's name, which we cannot publish) to a provider-neutral name. Retire the `OpenRouterConfig` interface alias (D7-partial) at this point — package rename is the natural breaking-change boundary.
2. **Rewrite the README** to be provider-neutral — document all 9 providers, the new env var schema, the legacy fallback, and the "live validation pending" status.
3. **Remove the committed `.tgz` artifact** (D10) — it's a stale build product that shouldn't be in version control.
4. **Remove `src/.DS_Store`** (D13) from disk and add `.DS_Store` to `.gitignore` to prevent future tracking.
5. **Audit dependencies** (D11) — classify the 20 vulnerabilities (1 critical, 13 high, 6 moderate) into: fixable now (non-breaking), fixable with breaking changes (defer), dev-only (non-blocking for runtime).
6. **Assess the MCP SDK upgrade** (D12) — determine if `@modelcontextprotocol/sdk` can be upgraded from `^0.5.0` to current without breaking the server. If non-breaking, upgrade; if breaking, document and defer.
7. **Produce the Release Readiness Report** — clearly distinguish engineering validation (complete: 163/163 tests, sentinel 8/8, all phase gates passed) from operational validation (pending: Stage 2 live provider validation).
8. **Preserve the MCP contract** — no tool name, schema, or output format changes.
9. **Preserve runtime behavior** — no behavior changes beyond the package rename + README.

**What this phase IS NOT:**
- Executing Stage 2 (paused pending credentials; opportunistic in the future)
- Adding providers (Phase 2A scope is the ceiling; Phase 2C added the final 3)
- Changing the `VisionProvider` interface or `ProviderCapabilities` shape
- Changing MCP tool schemas or names
- Implementing retry/backoff (D8 — future hardening)
- Fixing the double timeout (D9 — future hardening)
- Fixing invalid base64 handling (D15 — future hardening)
- A live validation phase (all validation in Phase 4 is static/automated, not live API)
- A code-logic phase (the only source changes are: retire `OpenRouterConfig` interface alias, remove `src/.DS_Store` from disk, update `package.json` metadata)

---

## 2. Scope

### 2.1 In scope

| Item | Debt ID | Effort |
|---|---|---|
| npm package rename (package.json `name`, `bin`, `description`, `keywords`) | — | Low |
| Retire `OpenRouterConfig` interface alias (D7-partial) | D7 | Trivial |
| README rewrite (provider-neutral, 9 providers, env vars, legacy fallback, live-validation-pending) | — | Medium |
| Remove committed `.tgz` (D10) | D10 | Trivial |
| Remove `src/.DS_Store` + add to `.gitignore` (D13) | D13 | Trivial |
| Dependency audit (D11) — classify + fix non-breaking, document breaking | D11 | Medium |
| MCP SDK upgrade assessment (D12) — upgrade if non-breaking, defer if breaking | D12 | Medium |
| Release Readiness Report | — | Low |
| Final integration test sweep | — | Low |

### 2.2 Out of scope (explicit)

- ❌ Stage 2 (live provider validation) — paused pending credentials
- ❌ New providers — Phase 2C was the final provider expansion
- ❌ `VisionProvider` interface changes
- ❌ MCP tool schema/name changes
- ❌ D8 (RETRY_ATTEMPTS unused) — future hardening
- ❌ D9 (double timeout) — future hardening
- ❌ D15 (invalid base64) — future hardening
- ❌ Code-logic changes beyond the alias retirement + metadata updates
- ❌ CI/CD pipeline setup (out of scope; release is manual via `npm publish`)

---

## 3. Explicit Out-of-Scope Items

See §2.2. The key boundary: **Phase 4 is release *preparation*, not release *execution*.** The actual `npm publish` is a manual step the user performs after Phase 4 approval. Phase 4 makes the codebase publishable; it doesn't publish.

**Stage 2 remains explicitly paused.** The Release Readiness Report will document that operational validation is pending and that Stage 2 may be executed at any future time when credentials become available. This does not block release — the engineering validation (163/163 tests, 10/10 Phase 2B.5 Stage 1 gates, all phase gates) is complete.

---

## 4. Package Rename Strategy

### 4.1 Current state

- `package.json` `name`: `openrouter-image-mcp` (upstream's name; cannot publish — npm registry has it at `1.0.13`)
- `bin`: `openrouter-image-mcp` → `dist/index.js`
- `description`: `"MCP server for image analysis using OpenRouter's vision models"`
- `keywords`: includes `openrouter` + provider-specific terms
- `README.md`: 64 mentions of "OpenRouter"
- `src/index.ts` MCP server `name`: already neutralized to `'vision-mcp'` in Phase 2C D4

### 4.2 Name candidates (checked availability)

| Name | Availability |
|---|---|
| `vision-mcp` | ❌ taken (0.1.0) |
| `vision-mcp-server` | ❌ taken (1.0.1) |
| `open-vision-mcp` | ✅ available |
| `provider-vision-mcp` | ✅ available |
| `multi-vision-mcp` | ✅ available |

### 4.3 Package name: DEFERRED (placeholder until final naming decision)

**Per the approved revision: the final npm package name is not yet decided.** Phase 4 uses a placeholder name in `package.json` and proceeds with all other rename work (description, keywords, bin entry, README). The placeholder is a temporary value that will be replaced when the final product naming decision is made.

**Placeholder name:** `open-vision-mcp` (subject to change — this is not the final name)

The rename commit (commit 4) updates `package.json` with the placeholder name. When the final name is decided, a follow-up commit replaces the placeholder. No other file depends on the package name; the MCP server `name` field is already `'vision-mcp'` (Phase 2C D4), independent of the npm name.

**If the user prefers a different placeholder**, the rename commit is a one-line change to `package.json` + the bin entry.

### 4.4 Rename changes

| File | Change |
|---|---|
| `package.json` | `name`: `openrouter-image-mcp` → `open-vision-mcp`; `description`: provider-neutral; `bin`: `open-vision-mcp` → `dist/index.js`; `keywords`: drop `openrouter`, add `multi-provider`, `openai-compatible`, `azure`, `chutes`, `cerebras`, `groq` |
| `package-lock.json` | regenerated by `npm install` after `package.json` rename |
| `README.md` | full rewrite (§5) |

**No source code depends on the package name.** The `dist/index.js` entry point is unaffected. Existing MCP client configurations that use `npx openrouter-image-mcp` will break — this is an expected, documented breaking change (the package is being renamed; users update their MCP client config to the new name).

---

## 5. README Rewrite Strategy

### 5.1 Current state

The README (15KB, 64 "OpenRouter" mentions) is entirely OpenRouter-centric:
- Title: "OpenRouter Image MCP Server"
- Quick start: OpenRouter API key + OpenRouter model
- MCP config examples: `npx openrouter-image-mcp` with `OPENROUTER_API_KEY`
- Model recommendations table: OpenRouter models only
- Troubleshooting: OpenRouter-specific

### 5.2 New README structure

1. **Title:** `open-vision-mcp` — Provider-Neutral Vision MCP Server
2. **What it does:** image analysis via any of 9 supported providers
3. **Supported providers:** table (provider, base URL, vision model, key env var, notes)
4. **Quick start:** `PROVIDER=openrouter API_KEY=... MODEL=... npx open-vision-mcp` + the legacy fallback note
5. **Configuration:** full env var table (PROVIDER, API_KEY, MODEL, BASE_URL, EXTRA_HEADERS, server config) + legacy fallback section
6. **MCP client configuration:** examples for Claude Code, Claude Desktop, Cursor, Cline — with the new package name + new env vars
7. **Tools:** the 3 tools (unchanged from baseline) with their schemas
8. **Provider-specific notes:** Azure's `BASE_URL` requirement + `?api-version=`; Chutes' per-model `supported_features`; Cerebras' unverified vision support (document the optimistic classification)
9. **Validation status:** explicit section — "Engineering validation: complete (163/163 tests). Live provider validation: pending (Stage 2 to be executed when credentials become available). Cerebras vision support: unverified."
10. **Development:** build, test, lint commands
11. **License:** MIT
12. **Attribution:** forked from `jonathanjude/openrouter-image-mcp` (MIT)

### 5.3 Key documentation requirements

- **The live-validation-pending status must be prominent.** Users need to know that the provider matrix is unit-tested but not yet live-validated. Cerebras vision support is specifically called out as unverified.
- **The legacy env var fallback must be documented.** Existing OpenRouter users with `OPENROUTER_API_KEY` set should see that their config continues to work.
- **Azure's `BASE_URL` requirement must be clear.** Azure is the only provider that requires `BASE_URL` (including `?api-version=`); `MODEL` is ignored for Azure.

---

## 6. D7-Partial: Retire `OpenRouterConfig` Interface Alias

### 6.1 Current state

`src/types/index.ts` exports:
```typescript
export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}
```

This interface is **not referenced by any source file** (Phase 2B removed all source references; Phase 3 removed `getOpenRouterConfig()`). It's retained only for potential external consumers who might `import { OpenRouterConfig }` from the package.

### 6.2 Retirement

At the package rename (Phase 4), the package's public API changes anyway (new name, new bin). This is the natural breaking-change boundary. **Remove the `OpenRouterConfig` interface** from `src/types/index.ts`. Any external consumer importing it will get a clear "not exported" error and can migrate to `ProviderConfig` (which has the same shape plus the `provider` discriminator).

**Verification before removal:** `grep -rn "OpenRouterConfig" src/ test/` → must return zero code references (only the interface declaration itself + comments). Verified during Phase 3; re-verify before the removal commit.

---

## 7. D10: Remove Committed `.tgz` Artifact

### 7.1 Current state

`openrouter-image-mcp-1.0.0.tgz` (15,811 bytes) is in the repo root — a stale build product committed by the upstream. It's not used by the build, not referenced by `package.json`, and pollutes the repo.

### 7.2 Removal

`git rm openrouter-image-mcp-1.0.0.tgz`. Add `*.tgz` to `.gitignore` to prevent future commits of build products.

---

## 8. D13: Remove `src/.DS_Store`

### 8.1 Current state

`src/.DS_Store` exists on disk (6,148 bytes) but is **not tracked in git** (verified: `git ls-files src/ | grep -i ds_store` returns nothing). It's a macOS Finder artifact.

### 8.2 Removal

- Delete the file from disk: `rm src/.DS_Store`.
- Add `.DS_Store` to `.gitignore` (it may already be there via the root `.gitignore` — verify; if not, add it).

---

## 9. D11: Dependency Audit

### 9.1 Current state

`npm audit` reports 20 vulnerabilities (1 critical, 13 high, 6 moderate, 0 low).

### 9.2 Classification

| Package | Severity | Type | Action |
|---|---|---|---|
| `@modelcontextprotocol/sdk` | high | runtime dep | **Assess upgrade** (D12 — see §11) |
| `axios` | high | runtime dep | **Investigate** — check if the vulnerability is in a code path the server uses (HTTP client for provider APIs + image URL fetch). If the fix is non-breaking, upgrade. |
| `@typescript-eslint/*` (5 packages) | high | **dev dep** | Non-blocking for runtime. Upgrade if non-breaking; otherwise defer (dev deps don't ship). |
| `ajv` | moderate | transitive (via eslint) | dev-only; non-blocking. |

### 9.3 Audit procedure

1. Run `npm audit --json` and capture the full report.
2. For each runtime vulnerability (`@modelcontextprotocol/sdk`, `axios`): check if the fix is non-breaking by reading the changelog / trying the upgrade in a branch.
3. For dev vulnerabilities: upgrade if `npm audit fix` is non-breaking; otherwise document and defer.
4. **Do not run `npm audit fix --force`** — it introduces breaking changes. Only `npm audit fix` (non-breaking) or manual upgrades.

### 9.4 Gate

After the audit, the runtime vulnerabilities (`@modelcontextprotocol/sdk`, `axios`) are either fixed (non-breaking upgrade) or documented (breaking — defer to a future hardening phase with a note in the Release Readiness Report). Dev vulnerabilities are documented but don't block release.

---

## 10. D12: MCP SDK Upgrade Assessment

### 10.1 Current state

`@modelcontextprotocol/sdk@^0.5.0`. The current SDK on npm may be a higher version.

### 10.2 Assessment procedure

1. Check the latest SDK version: `npm view @modelcontextprotocol/sdk version`.
2. Read the SDK changelog for breaking changes between `0.5.0` and the latest.
3. In a branch, upgrade to the latest and run `npm run build && npm test`.
4. If build + tests pass (non-breaking): commit the upgrade.
5. If build or tests fail (breaking): document the breaking changes; defer the upgrade to a future phase; keep `^0.5.0`.

### 10.3 Known usage

The server uses:
- `Server` from `@modelcontextprotocol/sdk/server/index.js`
- `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`
- `CallToolRequestSchema`, `ListToolsRequestSchema`, `Tool` from `@modelcontextprotocol/sdk/types.js`

If the SDK renamed any of these, the upgrade is breaking. If it only added new features or fixed bugs in these exports, the upgrade is non-breaking.

---

## 11. Release Readiness Report

### 11.1 Structure

The Release Readiness Report (the final Phase 4 deliverable) will contain:

1. **Engineering validation status: COMPLETE**
   - 163/163 tests pass
   - `npm run build` exit 0
   - `npm run lint` exit 0 (0 errors)
   - Sentinel 8/8 (black-box MCP protocol)
   - Phase 2B.5 Stage 1: 10/10 mandatory gates passed
   - MCP contract byte-identical to baseline (tool names + schemas)
   - Backwards compatibility: legacy env vars work (sentinel uses them)
   - 9 providers supported through 3 adapter patterns

2. **Operational validation status: PENDING**
   - Stage 2 (live provider validation): paused pending credentials
   - Cerebras vision support: unverified (Spike 2A-1 not executed — no key)
   - No provider has been live-validated end-to-end through `analyze_image` with a real key
   - Stage 2 may be executed at any future time when credentials become available
   - The codebase is unit-tested but not yet live-confirmed against real provider APIs

3. **Release decision:** the package is publishable with the explicit caveat that live validation is pending. Users should be informed in the README that the provider matrix is unit-tested but not yet live-validated. Cerebras vision support is specifically called out as unverified.

4. **Technical debt status:** D4/D5/D6 resolved (Phase 2C); D7/D10/D11/D12/D13 addressed or documented (Phase 4); D8/D9/D15 deferred (future hardening).

5. **Known limitations:**
   - `npm test` exit code is 1 due to pre-existing vitest+Node 25 `process.exit` noise (all 163 tests pass per the JSON reporter)
   - `RETRY_ATTEMPTS` config is read but unused (D8)
   - Double timeout in `analyze-image.ts` (D9 — redundant but harmless)
   - Invalid base64 doesn't throw (D15 — pre-existing, low-impact)

### 11.2 Release decision gates

The Release Readiness Report recommends release when:
- All Phase 4 success criteria (§16) are met
- The README explicitly documents "live validation pending"
- The Cerebras unverified-vision status is documented
- No critical runtime vulnerabilities remain unfixed (or they're documented with a mitigation)

---

## 12. File-by-File Implementation Plan

### 12.1 Source files to modify (2)

| File | Change | Lines |
|---|---|---|
| `src/types/index.ts` | Remove `OpenRouterConfig` interface (D7-partial) | -6 lines |
| `package.json` | Rename to `open-vision-mcp`; update `description`, `bin`, `keywords` | ~10 lines edited |

### 12.2 Files to delete (2)

| File | Reason |
|---|---|
| `openrouter-image-mcp-1.0.0.tgz` | D10 — stale build product |
| `src/.DS_Store` | D13 — macOS artifact (not tracked, but on disk) |

### 12.3 Files to rewrite (1)

| File | Change |
|---|---|
| `README.md` | Full rewrite — provider-neutral, 9 providers, new env vars, legacy fallback, live-validation-pending status (§5) |

### 12.4 Config files to modify (2)

| File | Change |
|---|---|
| `.gitignore` | Add `*.tgz` + `.DS_Store` (if not already present) |
| `package-lock.json` | Regenerated by `npm install` after the rename |

### 12.5 Files to add (2)

| File | Purpose |
|---|---|
| `PHASE-4-RELEASE-READINESS-REPORT.md` | The release readiness assessment (§11) |
| `PHASE-4-COMPLETION-REPORT.md` | Phase 4 completion record |

---

## 13. Commit Sequence

**9 commits, ordered: cleanup first (D10, D13), then rename (D7, package.json), then README, then dependency audit, then SDK assessment, then the reports.**

```
phase4: remove committed .tgz artifact + add *.tgz to .gitignore (D10)
phase4: remove src/.DS_Store + add .DS_Store to .gitignore (D13)
phase4: retire OpenRouterConfig interface alias (D7-partial)
phase4: rename npm package to open-vision-mcp + update metadata
phase4: rewrite README as provider-neutral + document live-validation-pending status
phase4: dependency audit — fix non-breaking runtime vulns, document breaking/dev (D11)
phase4: MCP SDK upgrade assessment — upgrade if non-breaking, defer if breaking (D12)
phase4: final integration test sweep + release readiness report
phase4: phase 4 completion report
```

### 13.1 Per-commit buildability

Each commit must leave the repo buildable (build + lint + tests + sentinel green).

| Commit | Build | Lint | Tests | Sentinel |
|---|---|---|---|---|
| 1 (D10 .tgz) | ✅ | ✅ | 163/163 | 8/8 |
| 2 (D13 .DS_Store) | ✅ | ✅ | 163/163 | 8/8 |
| 3 (D7 alias) | ✅ | ✅ | 163/163 | 8/8 |
| 4 (rename) | ✅ | ✅ | 163/163 | 8/8 |
| 5 (README) | ✅ | ✅ | 163/163 | 8/8 |
| 6 (D11 audit) | ✅ | ✅ | 163/163 | 8/8 |
| 7 (D12 SDK) | ✅ (or documented breaking) | ✅ | 163/163 (or documented) | 8/8 |
| 8 (final sweep + readiness report) | ✅ | ✅ | 163/163 | 8/8 |
| 9 (completion report) | ✅ | ✅ | 163/163 | 8/8 |

---

## 14. Validation Strategy

### 14.1 Per-commit validation

After **each** commit:
1. `npm run build` — exit 0
2. `npm run lint` — exit 0 (0 errors)
3. `CI=true npx vitest run --reporter=json` — all tests pass (JSON reporter authoritative)
4. `/tmp/sentinel-check.sh` — 8/8
5. `grep -rn "OpenRouterConfig" src/ test/` — after commit 3, zero code refs
6. `git diff --stat` — verify only intended files changed

### 14.2 End-of-Phase 4 validation gate

| Check | Command | Expected |
|---|---|---|
| Build clean | `npm run build` | exit 0 |
| Lint clean | `npm run lint` | exit 0 (0 errors) |
| Tests green | JSON reporter | 163/163 (or updated count if D12 added tests) |
| Sentinel | `/tmp/sentinel-check.sh` | 8/8 |
| MCP schemas unchanged | `diff` vs baseline tool block | byte-identical |
| No `OpenRouterConfig` in src/test | `grep -rn OpenRouterConfig src/ test/` | zero hits |
| No `openrouter-image-mcp` in package.json | `jq .name package.json` | `open-vision-mcp` |
| `.tgz` removed | `ls *.tgz` | not found |
| `.DS_Store` not tracked | `git ls-files \| grep -i ds_store` | zero hits |
| README documents live-validation-pending | `grep -i "live validation\|pending" README.md` | present |
| README documents Cerebras unverified | `grep -i "cerebras.*unverified\|unverified.*cerebras" README.md` | present |
| Release Readiness Report exists | `ls PHASE-4-RELEASE-READINESS-REPORT.md` | file present |

---

## 15. Rollback Strategy

### 15.1 Per-commit rollback

Each commit is independently revertible. The ordering is: cleanup first (trivial, no behavior change), then rename (D7 + package.json), then README, then deps, then reports. If any commit fails, revert it and re-plan.

### 15.2 Emergency rollback

`git reset --hard pre-phase-2c` (tag at `5076c85`) — restores the codebase to the pre-Phase-2C state. Or `git reset --hard df19181` (Phase 2C final) to restore just the Phase 2C state without Phase 4.

### 15.3 Partial-completion safety

If Phase 4 is interrupted after, say, commit 4 (rename) but before commit 9 (completion report), the repo is in a **valid, publishable state** — renamed, tests green, but README not yet rewritten. The remaining commits can be resumed.

---

## 16. Success Criteria

| # | Criterion | Verification |
|---|---|---|
| S1 | `npm run build` exit 0 | `npm run build` |
| S2 | `npm run lint` exit 0 | `npm run lint` (0 errors) |
| S3 | All tests pass | JSON reporter: 0 fail |
| S4 | Sentinel 8/8 | `/tmp/sentinel-check.sh` |
| S5 | MCP tool names unchanged | `diff` vs baseline |
| S6 | MCP tool schemas unchanged | `diff` vs baseline |
| S7 | `package.json` name is the agreed placeholder (final name deferred) | `jq .name` |
| S8 | No `OpenRouterConfig` in src/test | `grep` |
| S9 | `.tgz` removed | `ls *.tgz` |
| S10 | `.DS_Store` not tracked | `git ls-files` |
| S11 | README documents live-validation-pending | `grep` |
| S12 | README documents Cerebras unverified | `grep` |
| S13 | README documents all 9 providers | `grep` |
| S14 | README documents legacy env var fallback | `grep` |
| S15 | Release Readiness Report exists + distinguishes engineering vs. operational validation | `ls` + inspection |
| S16 | No new runtime dependencies | `diff` vs Phase 2C deps (unless D12 upgrade is non-breaking) |
| S17 | Runtime vulnerabilities either fixed or documented | `npm audit` + report |
| S18 | `npm test` (JSON reporter) all pass | (same as S3) |

**All 18 must hold for Phase 4 completion.**

---

## 17. Failure Criteria

Phase 4 fails (abort and re-plan) if:

1. **Sentinel regresses** at any commit and cannot be restored.
2. **`npm run build` fails** at any commit due to a Phase 4 change.
3. **The package rename breaks the build** (e.g., `dist/index.js` path changes) — would indicate a `package.json` misconfiguration.
4. **The `OpenRouterConfig` removal breaks a non-test consumer** — would indicate an unexpected external dependency (re-add the alias and defer retirement).
5. **The MCP SDK upgrade (D12) breaks the server** and the breaking change cannot be resolved without a larger refactor — defer the upgrade and document in the Release Readiness Report.
6. **A runtime vulnerability cannot be fixed or documented** — would indicate a deeper issue requiring a dedicated security phase.

**None indicated by current evidence.**

---

## 18. Completion Criteria

Phase 4 is complete when ALL of the following hold:

1. All 18 success criteria (S1–S18) are verified green.
2. 9 commits land in the fork's git history, each with a descriptive message referencing this plan.
3. `baseline/` remains immutable.
4. The Phase 4 Completion Report is written, documenting:
   - Final commit list
   - Success criteria verification table
   - Sentinel checkpoint after each commit
   - Dependency audit outcome (fixed vs. documented)
   - MCP SDK upgrade outcome (upgraded vs. deferred)
   - Release Readiness Report summary (engineering validation complete; operational validation pending)
   - Known limitations + caveats for release
5. The Release Readiness Report is written and committed.
6. No providers were added (Phase 2C was the final expansion).
7. No MCP schema changes (tool names + inputSchema byte-identical to baseline).
8. Stage 2 remains explicitly paused (not executed; pending credentials).

---

## 19. Expected Deliverables

1. **Phase 4 Implementation Plan** (this document, approved)
2. **9 commits** in the fork's git history
3. **`PHASE-4-RELEASE-READINESS-REPORT.md`** — the release readiness assessment
4. **`PHASE-4-COMPLETION-REPORT.md`** — Phase 4 completion record
5. **Renamed package** (`open-vision-mcp`) with updated metadata
6. **Provider-neutral README** documenting all 9 providers + live-validation-pending status
7. **Cleaned repo** (no `.tgz`, no `.DS_Store`, `OpenRouterConfig` retired)
8. **Dependency audit** outcome (fixed non-breaking; documented breaking/dev)
9. **MCP SDK assessment** outcome (upgraded or deferred with rationale)

### Estimated effort
- D10/D13 cleanup: ~15 min
- D7 alias removal: ~10 min
- Package rename: ~30 min
- README rewrite: ~1.5 hours
- Dependency audit: ~1 hour
- MCP SDK assessment: ~45 min
- Reports: ~1 hour
- **Total: ~5 hours** (~0.5–1 engineer-day)

---

## 20. Approval Checklist

Before coding begins, confirm:

- [ ] §1 Objectives match intent (release prep; Stage 2 explicitly paused).
- [ ] §2/§3 Scope and out-of-scope are correct (no Stage 2; no new providers; no code-logic changes beyond alias retirement + metadata).
- [ ] §4 Package rename strategy + recommended name `open-vision-mcp` is acceptable (or specify a different name).
- [ ] §5 README rewrite strategy is acceptable (especially: live-validation-pending status must be prominent).
- [ ] §6 `OpenRouterConfig` retirement is acceptable (breaking change; natural at rename).
- [ ] §9–§10 Dependency audit + SDK assessment procedures are acceptable.
- [ ] §11 Release Readiness Report structure correctly distinguishes engineering vs. operational validation.
- [ ] §16 Success criteria (18 items) are the correct bar.
- [ ] §17 Failure criteria correctly identify abort conditions.
- [ ] §19 Effort estimate (~5 hours) is acceptable.
- [ ] The explicit "Stage 2 paused pending credentials" framing is agreed.

---

**Awaiting approval. No code changes will be made until this plan is authorized.**