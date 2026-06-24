# PHASE 1 — Implementation Plan: Provider Abstraction Layer

**Status:** Draft — awaiting approval
**Scope:** Architecture preparation only. OpenRouter remains the sole active provider.
**Principle:** Smallest reversible change. Reduce coupling before introducing new providers.

---

## 1. Objective

Introduce a provider abstraction layer that decouples the MCP tool handlers from the concrete `OpenRouterClient` class, while preserving all existing MCP behavior and runtime outputs.

**What this phase IS:**
- Introducing an interface (`VisionProvider`) that `OpenRouterClient` will implement.
- Introducing a `ProviderCapabilities` model so callers can ask "does this provider support X?" without instanceof checks.
- Introducing a `ProviderFactory` as the single construction point.
- Changing tool handler signatures from `(args, config, OpenRouterClient, logger)` → `(args, config, VisionProvider, logger)`.
- Changing `index.ts` to construct the provider via the factory instead of `OpenRouterClient.getInstance(...)`.

**What this phase IS NOT:**
- Adding any new provider (no OpenAI, Chutes, Groq, Anthropic, Gemini, etc.).
- Changing env var names (still `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL`).
- Changing the request payload shape sent to OpenRouter.
- Changing the response parsing.
- Changing tool names, tool schemas, or tool output format.
- Removing the singleton pattern (deferred — singleton stays for now; factory wraps it).
- Fixing tests (that's Phase 3).
- Fixing lint config (that's Phase 3).

---

## 2. Success Criteria (Phase 1 — precise, falsifiable)

| # | Criterion | Verification |
|---|---|---|
| S1 | MCP tool names unchanged: `analyze_image`, `analyze_webpage_screenshot`, `analyze_mobile_app_screenshot` | Diff `src/index.ts` tool-registration block: zero changes to `name`/`description`/`inputSchema` |
| S2 | MCP tool schemas unchanged (identical `properties`, `required`, `enum` values) | Byte-diff the three tool schemas in `src/index.ts` |
| S3 | `OpenRouterClient` retains identical public method signatures: `analyzeImage`, `testConnection`, `validateModel`, `getInstance` | `git diff` on `src/utils/openrouter-client.ts` shows only `implements VisionProvider` added |
| S4 | Runtime behavior unchanged: identical HTTP request body sent to OpenRouter for a given input | Manual smoke test + existing `test/integration/mcp-server.test.ts` (8/8 black-box tests) continues to pass |
| S5 | No provider functionality removed: `HTTP-Referer`, `X-Title`, `response_format`, vision-heuristic `validateModel` all preserved | Inspection: these remain in `OpenRouterClient` |
| S6 | No new env vars introduced; no existing env vars renamed or removed | `.env.example` unchanged except (optionally) a comment |
| S7 | `npm run build` exits 0 | `npm run build` in fork root |
| S8 | No new runtime dependencies added | `package.json` dependencies array unchanged |
| S9 | Tool handlers no longer import `OpenRouterClient` as a concrete type | `grep -r "OpenRouterClient" src/tools/` returns zero hits |
| S10 | `index.ts` imports `VisionProvider` (type) and uses `ProviderFactory` instead of directly constructing `OpenRouterClient` | `grep` + source inspection |

**Explicitly NOT a success criterion for Phase 1:** `npm test` passing. Tests are repaired in Phase 3. `npm run lint` is also Phase 3.

---

## 3. Files to be Modified (6 files, minimal touches)

| File | Change | Lines touched (est.) |
|---|---|---|
| `src/types/index.ts` | **ADD** `VisionProvider` interface and `ProviderCapabilities` interface. Do **not** rename `OpenRouterConfig` or `ImageAnalysisResult` (preserves compatibility). | +18 lines (additive) |
| `src/utils/openrouter-client.ts` | **ADD** `implements VisionProvider` to the class declaration. **ADD** a `capabilities` getter returning OpenRouter's capability set. **No other changes.** | +6 lines (additive) |
| `src/tools/analyze-image.ts` | Change parameter type `openRouterClient: OpenRouterClient` → `provider: VisionProvider`. Update local references. Drop the `OpenRouterClient` import; add `VisionProvider` import. | ~4 lines edited |
| `src/tools/analyze-webpage.ts` | Same as above. | ~4 lines edited |
| `src/tools/analyze-mobile-app.ts` | Same as above. | ~4 lines edited |
| `src/index.ts` | Replace `OpenRouterClient.getInstance(openRouterConfig)` with `ProviderFactory.create(openRouterConfig)`. Change variable type. Keep all logging strings identical. | ~6 lines edited |

**Total estimated diff:** ~45 lines, of which ~24 are additive (new interfaces + factory) and ~21 are surgical edits. No file deletions. No file renames.

---

## 4. Files to be Added (2 files)

| File | Purpose |
|---|---|
| `src/providers/vision-provider.ts` | Contains the `VisionProvider` interface and `ProviderCapabilities` type. (Alternatively placed in `src/types/` — see §5.) |
| `src/providers/factory.ts` | Contains `ProviderFactory.create(config)` which today returns `OpenRouterClient.getInstance(config)`. Single switch statement with one case, throwing on unknown providers. |

**Why a `providers/` directory rather than putting the interface in `src/types/`?**
- `src/types/index.ts` currently holds pure data-shape types (`ImageAnalysisResult`, `OpenRouterConfig`, etc.). `VisionProvider` is a behavioral interface (methods + capabilities). Mixing behavioral and data types in one barrel file is acceptable but slightly less clean.
- A dedicated `providers/` directory establishes the home for Phase 2's provider implementations (`openai-compatible.ts`, `anthropic-native.ts`, etc.) without reorganizing later.
- **However**, to keep the diff minimal and avoid any path churn, I will place the interface in `src/types/index.ts` (alongside existing types) and place only the factory in `src/providers/factory.ts`. This avoids moving anything.

**Revised plan after that consideration:**

| File | Action |
|---|---|
| `src/types/index.ts` | **Modify** — add `VisionProvider` + `ProviderCapabilities` |
| `src/providers/factory.ts` | **Add** — the factory only |

**Net: 1 file added, 6 files modified.** This is the smallest diff that achieves the objective.

---

## 5. Dependency Graph

### 5.1 Before (current state)

```
src/index.ts
  ├─ imports Config, OpenRouterClient, Logger, 3 tool handlers
  │
  ├─> src/config/index.ts ─> src/types/index.ts
  ├─> src/utils/openrouter-client.ts ─> src/types/index.ts
  │       (concrete class, singleton)
  ├─> src/utils/image-processor.ts ─> src/types/index.ts
  ├─> src/utils/logger.ts
  ├─> src/tools/analyze-image.ts ─> Config, OpenRouterClient (CONCRETE), ImageProcessor, Logger, types
  ├─> src/tools/analyze-webpage.ts ─> Config, OpenRouterClient (CONCRETE), ImageProcessor, Logger, types
  └─> src/tools/analyze-mobile-app.ts ─> Config, OpenRouterClient (CONCRETE), ImageProcessor, Logger, types
```

**Coupling points (concrete `OpenRouterClient` referenced directly):** 4 sites — `index.ts`, `analyze-image.ts`, `analyze-webpage.ts`, `analyze-mobile-app.ts`.

### 5.2 After (Phase 1 target)

```
src/index.ts
  ├─ imports Config, ProviderFactory, Logger, 3 tool handlers
  │
  ├─> src/config/index.ts ─> src/types/index.ts
  ├─> src/providers/factory.ts ─> src/utils/openrouter-client.ts (returns singleton)
  │                                 └> src/types/index.ts  (now also declares VisionProvider)
  ├─> src/utils/image-processor.ts ─> src/types/index.ts
  ├─> src/utils/logger.ts
  ├─> src/tools/analyze-image.ts      ─> Config, VisionProvider (INTERFACE), ImageProcessor, Logger, types
  ├─> src/tools/analyze-webpage.ts    ─> Config, VisionProvider (INTERFACE), ImageProcessor, Logger, types
  └─> src/tools/analyze-mobile-app.ts ─> Config, VisionProvider (INTERFACE), ImageProcessor, Logger, types
```

**Coupling points (concrete `OpenRouterClient` referenced directly):** 1 site — `src/providers/factory.ts` (and `openrouter-client.ts` itself). Down from 4.

**Key invariant preserved:** `OpenRouterClient` is still a singleton, still constructed via `getInstance`, still lives in `src/utils/`. The factory merely wraps the existing singleton accessor.

---

## 6. Interface Definitions (proposed, for review)

```typescript
// Added to src/types/index.ts

export interface ProviderCapabilities {
  /** Provider supports response_format: { type: 'json_object' } */
  readonly jsonMode: boolean;
  /** Provider exposes a /models list endpoint */
  readonly modelsEndpoint: boolean;
  /** Field name used for max tokens in the request body */
  readonly maxTokensField: 'max_tokens' | 'maxOutputTokens';
}

export interface VisionProvider {
  /** Static capability descriptor for this provider. */
  readonly capabilities: ProviderCapabilities;

  /**
   * Analyze an image and return structured/textual analysis.
   * Contract preserved verbatim from OpenRouterClient.analyzeImage.
   */
  analyzeImage(
    imageData: string,        // base64 (no data: prefix)
    mimeType: string,
    prompt: string,
    options: {
      format?: 'text' | 'json';
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<ImageAnalysisResult>;

  /** Health check. Returns true on 200 from /models (or provider equivalent). */
  testConnection(): Promise<boolean>;

  /** Optional: validate that the configured model id is known and vision-capable. */
  validateModel?(modelId: string): Promise<boolean>;
}
```

**Design notes:**
- `analyzeImage` signature is **byte-identical** to the current `OpenRouterClient.analyzeImage`. This is deliberate — the interface is extracted from the existing implementation, not designed fresh. Zero behavior change.
- `validateModel` is optional (`?`) because not all providers (in Phase 2) will expose `/models`. `OpenRouterClient` implements it, so it's always available today.
- `capabilities` is a `readonly` property, not a method — it's a static descriptor, not a query. This lets tool handlers do `if (provider.capabilities.jsonMode) {…}` without async or instanceof.
- **`OpenRouterClient` does not currently have a `capabilities` property.** I'll add one as a class getter returning `{ jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' }`. This is additive and does not affect any existing call site.

---

## 7. Factory Definition (proposed, for review)

```typescript
// src/types/index.ts (additions)
export type ProviderId = 'openrouter';
```

```typescript
// src/providers/factory.ts
import { OpenRouterConfig, ProviderId, VisionProvider } from '../types/index.js';
import { OpenRouterClient } from '../utils/openrouter-client.js';

export class ProviderFactory {
  /**
   * Create the active VisionProvider for the given provider id.
   *
   * Phase 1: only 'openrouter' is supported. The default arm throws so that
   * any unsupported id fails fast at the wiring point rather than silently
   * falling through. Phase 2 adds cases without modifying this signature.
   */
  static create(provider: ProviderId, config: OpenRouterConfig): VisionProvider {
    switch (provider) {
      case 'openrouter':
        return OpenRouterClient.getInstance(config);
      default:
        throw new Error(`Unknown provider: ${provider satisfies never}`);
    }
  }
}
```

**Design notes:**
- The factory is a static method, not a class instance — matches the codebase's existing style.
- `ProviderId` is a single-member union today; Phase 2 widens it (`'openai' | 'chutes' | …`) without changing the factory's signature or any existing call site.
- The `default` arm uses `satisfies never` to keep it exhaustiveness-checked: if a new `ProviderId` member is added later without a corresponding `case`, TypeScript flags it. The arm is unreachable *today* but is the runtime guard for values that escape the type (e.g., `as ProviderId` casts, malformed config).
- `index.ts` passes the literal `'openrouter'` at the call site. This is the wiring point; Phase 2 replaces it with `config.provider` in a one-line change.
- `OpenRouterConfig` is **not** modified in Phase 1. No `provider` field is added. This keeps `.env.example` and `src/config/index.ts` untouched, honoring "no env var changes."
- The factory returns `VisionProvider` (interface), not `OpenRouterClient` (concrete). This is the entire point of the abstraction.

---

## 8. Risk Assessment (Phase 1 specific)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Adding `implements VisionProvider` to `OpenRouterClient` causes a structural mismatch | Low | High | The interface is **extracted from** the existing class, so signatures are guaranteed to match. Verify with `npm run build`. |
| Adding `capabilities` getter to `OpenRouterClient` breaks the singleton or serialization | Very Low | Low | Getter is pure, returns a frozen object literal. No side effects. |
| Changing tool handler param type from `OpenRouterClient` to `VisionProvider` breaks a call site that relied on a method not on the interface | Low | Medium | The only method called is `analyzeImage`, which is on the interface. No `testConnection`/`validateModel` calls exist in tools. |
| Factory returning `OpenRouterClient.getInstance(config)` behaves differently than calling `getInstance` directly in `index.ts` | Very Low | Low | Identical call. Singleton semantics unchanged. |
| `src/providers/` directory doesn't exist; adding it confuses tooling | Very Low | Very Low | Standard TS directory. `tsconfig.json` includes `src/**/*` recursively. |
| Hidden reliance on `OpenRouterClient`'s concrete type in `index.ts` (e.g., the log line `logger.info('Testing OpenRouter API connection...')`) | Low | Very Low | Log strings are not type-checked; leaving them unchanged preserves behavior. Phase 2 will revisit branding. |
| Someone runs `npm test` expecting it to pass | Medium | None | Phase 1 does not claim tests pass. Baseline already documents 73 failing tests. Success criteria S7–S10 are the gate. |

**Overall Phase 1 risk: LOW.** Every change is either additive (new interface, new file, new getter) or a type-only substitution (`Concrete` → `Interface`). No runtime logic changes.

---

## 9. Rollback Strategy

Because Phase 1 is a sequence of small, independent commits, rollback is granular:

| Step | Commit | Rollback action |
|---|---|---|
| 1. Add `VisionProvider` + `ProviderCapabilities` to `src/types/index.ts` | `phase1: add VisionProvider interface` | `git revert <sha>` — removes the interfaces; no code references them yet, so safe. |
| 2. Add `capabilities` getter + `implements VisionProvider` to `OpenRouterClient` | `phase1: OpenRouterClient implements VisionProvider` | `git revert <sha>` — restores concrete class without interface. |
| 3. Add `src/providers/factory.ts` | `phase1: add ProviderFactory` | `git rm src/providers/factory.ts` + revert. Nothing imports it yet. |
| 4. Update `src/tools/*.ts` to use `VisionProvider` | `phase1: decouple tools from concrete client` | `git revert <sha>` — restores concrete imports. |
| 5. Update `src/index.ts` to use `ProviderFactory` | `phase1: index.ts uses factory` | `git revert <sha>` — restores direct singleton construction. |

**Ordering rationale:** Steps 1–3 are purely additive and non-breaking. Step 4 is type-only (build still passes before and after). Step 5 is the only step that changes runtime wiring, and it's last. If any step fails to build, the previous step is a known-good state.

**Emergency rollback (all of Phase 1):** `git reset --hard baseline/main` from the fork root. The `baseline/` reference clone is immutable and never touched.

---

## 10. Validation Strategy

### 10.1 Per-step validation (during implementation)

After **each** commit:
1. `npm run build` — must exit 0.
2. `grep -rn "OpenRouterClient" src/tools/` — must return zero hits after Step 4.
3. `git diff --stat` — verify only intended files changed.

After Step 5 (final):
4. `node dist/index.js` with `OPENROUTER_API_KEY=dummy` — must start and exit cleanly on bad auth (same as baseline behavior). No crash on import/wiring.

### 10.2 End-of-Phase 1 validation gate

| Check | Command | Expected |
|---|---|---|
| Build clean | `npm run build` | exit 0 |
| No new deps | `git diff package.json` | only version metadata if needed; no dependency additions |
| Tool handlers decoupled | `grep -rn "OpenRouterClient" src/tools/` | zero hits |
| Factory exists | `ls src/providers/factory.ts` | file present |
| Interface exists | `grep "interface VisionProvider" src/types/index.ts` | one hit |
| MCP schemas unchanged | diff tool-schema block vs `baseline/src/index.ts` | identical |
| Black-box integration tests | `npx vitest run test/integration/mcp-server.test.ts` | 8/8 pass (same as baseline) |
| Env var names unchanged | `diff .env.example baseline/.env.example` | no differences |

**Explicitly not validated in Phase 1:**
- `npm test` (full) — expected to fail; Phase 3 fixes this.
- `npm run lint` — expected to fail; Phase 3 fixes the config.
- Live API call — no valid key available; deferred to Phase 4 smoke testing.

### 10.3 Regression sentinel

The file `test/integration/mcp-server.test.ts` is the **regression sentinel** for Phase 1. It launches the server as a subprocess and exercises the MCP protocol over stdio — exactly what an MCP client does. If it stays green (8/8) across all Phase 1 commits, the MCP contract is preserved. If it regresses at any step, I stop and investigate before continuing.

---

## 11. Out of Scope (explicit, to prevent scope creep)

The following are tempting, adjacent, and explicitly **deferred**:

- ❌ Renaming `OpenRouterClient` → `OpenAICompatibleProvider` (Phase 2).
- ❌ Renaming `OpenRouterConfig` → `ProviderConfig` (Phase 2).
- ❌ Generalizing env vars (`OPENROUTER_API_KEY` → `PROVIDER_API_KEY`) (Phase 2).
- ❌ Adding a `provider` field to `OpenRouterConfig` (Phase 2).
- ❌ Removing the singleton pattern (Phase 2 or later).
- ❌ Making `response_format` conditional on capabilities (Phase 2).
- ❌ Cleaning up the double-timeout in `analyze-image.ts` (separate hygiene commit, post-Phase 3).
- ❌ Implementing `RETRY_ATTEMPTS` (out of scope entirely).
- ❌ Removing the committed `.tgz` (Phase 2 hygiene).
- ❌ Updating README (Phase 2).
- ❌ Fixing `.eslintrc.json` (Phase 3).
- ❌ Repairing unit/integration tests (Phase 3).

---

## 12. Implementation Order (commit sequence)

```
phase1: add VisionProvider + ProviderCapabilities interfaces    [additive, no refs]
phase1: OpenRouterClient implements VisionProvider               [additive getter + impl]
phase1: add ProviderFactory                                     [additive, no callers yet]
phase1: decouple tool handlers from concrete client             [type-only substitution]
phase1: wire index.ts through ProviderFactory                   [runtime wiring change]
```

Five commits. Each independently buildable. Each independently revertible.

---

## 13. Approval Checklist

Before coding begins, confirm:

- [ ] Objective in §1 matches your intent.
- [ ] Success criteria S1–S10 in §2 are acceptable (especially S2: schema byte-identity, S8: no new deps).
- [ ] File-modification list in §3 is complete and minimal — nothing missing, nothing extra.
- [ ] Interface definitions in §6 are acceptable (signatures preserved verbatim, `validateModel` optional, `capabilities` as readonly property).
- [ ] Factory definition in §7 is acceptable (no switch statement yet, hard-returns `OpenRouterClient.getInstance`).
- [ ] Out-of-scope list in §11 correctly defers everything to Phase 2 / Phase 3.
- [ ] Rollback strategy in §9 is acceptable.
- [ ] Validation gate in §10.2 is the correct bar for declaring Phase 1 done.

---

**Awaiting approval. No code changes will be made until this plan is authorized.**