# PHASE 2B — Implementation Plan: OpenAI-Compatible Provider Expansion

**Status:** Draft — awaiting approval
**Predecessor:** Phase 2A Provider Compatibility Validation (approved)
**Scope:** Six fully-compatible OpenAI-compatible providers via a shared adapter, plus config generalization.
**Principle:** Small, incremental, reversible commits. No abstraction changes. No MCP contract changes. No behavior changes for existing OpenRouter users.

---

## 1. Objective

Transform the server from a single-provider (OpenRouter) implementation into a provider-neutral server supporting six OpenAI-compatible providers through one shared adapter, with OpenRouter migrated onto that same adapter. Preserve the MCP contract byte-for-byte. Preserve existing OpenRouter runtime behavior byte-for-byte.

**What this phase IS:**
- Generalize `OpenRouterConfig` → `ProviderConfig` carrying a `provider: ProviderId` discriminator.
- Generalize env vars from `OPENROUTER_*` to `PROVIDER`, `API_KEY`, `MODEL`, `BASE_URL` with backwards-compatible fallback to the old names.
- Introduce `src/providers/openai-compatible.ts` — one shared adapter implementing `VisionProvider` for the six FC providers.
- Migrate `OpenRouterClient`'s behavior onto the shared adapter (preserving `HTTP-Referer`/`X-Title` as opt-in `extraHeaders`).
- Add five new providers (OpenAI, Together, DeepInfra, Fireworks, Groq) as config-only entries.
- Widen the `ProviderId` union and add cases to `ProviderFactory`.
- Replace the literal `'openrouter'` in `index.ts` with `config.provider`.

**What this phase IS NOT:**
- Adding Chutes, Cerebras, or Azure OpenAI (Phase 2C).
- Adding Anthropic native, Gemini native, or Bedrock (out of scope entirely).
- Changing the `VisionProvider` interface or `ProviderCapabilities` shape (Phase 2A confirmed sufficiency).
- Changing MCP tool names, schemas, or output format.
- Removing the singleton pattern on `Config` / `Logger` / `ImageProcessor`.
- Fixing tests (Phase 3) or lint config (Phase 3).
- Implementing retry/backoff (`RETRY_ATTEMPTS` remains read-but-unused).
- Implementing streaming.
- Removing the committed `.tgz` or updating README (separate hygiene pass).
- Removing the vision-by-name heuristic in `validateModel` (optional hygiene, deferred to 2C per Phase 2A §6.2).

---

## 2. Scope — Provider Set

| Provider | `ProviderId` | Default `baseUrl` | Phase 2B? |
|---|---|---|---|
| OpenRouter | `'openrouter'` | `https://openrouter.ai/api/v1` | ✅ (migrated) |
| OpenAI | `'openai'` | `https://api.openai.com/v1` | ✅ (new) |
| Together | `'together'` | `https://api.together.xyz/v1` | ✅ (new) |
| DeepInfra | `'deepinfra'` | `https://api.deepinfra.com/v1/openai` | ✅ (new) |
| Fireworks | `'fireworks'` | `https://api.fireworks.ai/inference/v1` | ✅ (new) |
| Groq | `'groq'` | `https://api.groq.com/openai/v1` | ✅ (new) |
| Chutes | `'chutes'` | `https://llm.chutes.ai/v1` | ❌ Phase 2C |
| Cerebras | `'cerebras'` | `https://api.cerebras.ai/v1` | ❌ Phase 2C |
| Azure OpenAI | `'azure'` | (per-deployment) | ❌ Phase 2C |

---

## 3. Out of Scope (explicit, to prevent scope creep)

- ❌ Chutes, Cerebras, Azure OpenAI — Phase 2C
- ❌ Anthropic native, Gemini native, Bedrock — not on the roadmap
- ❌ `VisionProvider` interface changes
- ❌ `ProviderCapabilities` shape changes
- ❌ MCP tool schema changes (any)
- ❌ Streaming
- ❌ Retry/backoff implementation
- ❌ Test repair (Phase 3)
- ❌ Lint config fix (Phase 3)
- ❌ README rewrite / npm package rename
- ❌ Removal of committed `.tgz`
- ❌ Removal of vision-by-name heuristic (deferred hygiene)
- ❌ Live API calls in CI (no keys available; smoke tests use dummy keys + mocked HTTP or are manual)

---

## 4. Files to be Modified

| File | Change | Lines touched (est.) |
|---|---|---|
| `src/types/index.ts` | Widen `ProviderId` union (5 new members). Add `ProviderConfig` interface. **Keep** `OpenRouterConfig` as a type alias for backwards compat in tests. | +12 lines |
| `src/config/index.ts` | Read new env vars (`PROVIDER`, `API_KEY`, `MODEL`, `BASE_URL`) with fallback to legacy (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL`). Per-provider `baseUrl` defaults. Rename internal field + accessor to `providerConfig` / `getProviderConfig()`. **Keep** `getOpenRouterConfig()` as a deprecated delegate to `getProviderConfig()` for test compatibility. | ~25 lines edited |
| `src/providers/factory.ts` | Widen switch with 5 new cases. Accept `ProviderConfig` instead of `OpenRouterConfig`. Per-provider default `baseUrl` injection if user did not override. | ~30 lines edited |
| `src/providers/openai-compatible.ts` | **NEW** — the shared adapter. See §9. | ~150 lines (new file) |
| `src/utils/openrouter-client.ts` | **Delete** — behavior migrated to `OpenAICompatibleProvider`. `ProviderFactory` returns the shared adapter for `'openrouter'` too. | -231 lines (file removed) |
| `src/index.ts` | Replace `config.getOpenRouterConfig()` with `config.getProviderConfig()`. Replace `openRouterConfig` variable name with `providerConfig`. Replace literal `'openrouter'` with `providerConfig.provider`. | ~10 lines edited |
| `.env.example` | Document new env vars + legacy fallback. Add a `PROVIDER=` line with `openrouter` as default. | ~15 lines edited |

**Net: 6 files modified, 1 file added, 1 file deleted.** ~250 lines changed, of which ~150 are the new shared adapter (carrying over ~180 lines of battle-tested logic from `openrouter-client.ts`).

---

## 5. Files to be Created

| File | Purpose |
|---|---|
| `src/providers/openai-compatible.ts` | The shared `OpenAICompatibleProvider` class implementing `VisionProvider`. One class covers all six 2B providers. |

**Single new file.** No new test files in 2B (test repair is Phase 3). No new config files. No new directories.

---

## 6. Dependency Graph

### 6.1 Before (end of Phase 1)

```
src/index.ts
  ├─> src/config/index.ts ─> src/types/index.ts (OpenRouterConfig, ServerConfig, VisionProvider, ProviderCapabilities, ProviderId)
  ├─> src/providers/factory.ts ─> src/utils/openrouter-client.ts (concrete, singleton)
  │                                 └> src/types/index.ts, src/utils/logger.ts
  ├─> src/utils/image-processor.ts ─> src/types/index.ts
  ├─> src/utils/logger.ts
  ├─> src/tools/analyze-image.ts      ─> VisionProvider (interface)
  ├─> src/tools/analyze-webpage.ts    ─> VisionProvider (interface)
  └─> src/tools/analyze-mobile-app.ts ─> VisionProvider (interface)
```

**Concrete coupling sites:** `src/providers/factory.ts` references `OpenRouterClient` (1 site, down from 4 in baseline).

### 6.2 After (target end of Phase 2B)

```
src/index.ts
  ├─> src/config/index.ts ─> src/types/index.ts (ProviderConfig, ServerConfig, VisionProvider, ProviderCapabilities, ProviderId)
  ├─> src/providers/factory.ts ─> src/providers/openai-compatible.ts (shared adapter)
  │                                 └> src/types/index.ts, src/utils/logger.ts
  ├─> src/utils/image-processor.ts ─> src/types/index.ts
  ├─> src/utils/logger.ts
  ├─> src/tools/analyze-image.ts      ─> VisionProvider (interface)    [unchanged from Phase 1]
  ├─> src/tools/analyze-webpage.ts    ─> VisionProvider (interface)    [unchanged from Phase 1]
  └─> src/tools/analyze-mobile-app.ts ─> VisionProvider (interface)    [unchanged from Phase 1]

src/utils/openrouter-client.ts  [DELETED]
```

**Concrete coupling sites:** `src/providers/factory.ts` references `OpenAICompatibleProvider` (1 site). The concrete `OpenRouterClient` is gone; OpenRouter becomes a config preset on the shared adapter.

**Key invariant preserved:** Tool handlers, MCP schemas, and the dispatch in `index.ts` are unchanged from Phase 1. The seam holds.

---

## 7. Configuration Migration Strategy

### 7.1 New env var schema

| Env var | Required? | Default | Purpose |
|---|---|---|---|
| `PROVIDER` | No (defaults to `openrouter`) | `openrouter` | Provider discriminator |
| `API_KEY` | **Yes** | — | API key for the selected provider |
| `MODEL` | No | Per-provider default (see §11) | Model id |
| `BASE_URL` | No | Per-provider default (see §11) | Full-prefix base URL (no path appending) |
| `EXTRA_HEADERS` | No | Empty | Optional JSON string of extra headers (e.g. for OpenRouter ranking) |
| `LOG_LEVEL` | No | `info` | Unchanged |
| `MAX_IMAGE_SIZE` | No | `10485760` | Unchanged |
| `RETRY_ATTEMPTS` | No | `3` | Unchanged (still unused) |
| `PORT` | No | `3000` | Unchanged |

### 7.2 Legacy env var fallback (backwards compatibility)

| Legacy var | Maps to | Behavior |
|---|---|---|
| `OPENROUTER_API_KEY` | `API_KEY` | Used if `API_KEY` unset |
| `OPENROUTER_MODEL` | `MODEL` | Used if `MODEL` unset |
| `OPENROUTER_BASE_URL` | `BASE_URL` | Used if `BASE_URL` unset |

**Resolution precedence:** new var > legacy var > per-provider default.

**Effect:** An existing OpenRouter user with `OPENROUTER_API_KEY=...` set and nothing else continues to work with zero config changes. The server silently treats them as `PROVIDER=openrouter` (the default), lifts `OPENROUTER_API_KEY` into `API_KEY`, and proceeds.

### 7.3 Validation rules

- If `PROVIDER` is set to an id not in the `ProviderId` union → throw at startup with a message listing valid ids.
- If `API_KEY` (or legacy `OPENROUTER_API_KEY`) is missing → throw the existing "API key required" error (message text preserved verbatim).
- If `PROVIDER != 'openrouter'` but only `OPENROUTER_*` env vars are set (no `API_KEY`/`MODEL`/`BASE_URL`) → accept the legacy vars for `API_KEY`/`MODEL`/`BASE_URL` but **do not** silently set `PROVIDER=openrouter` if the user explicitly set `PROVIDER=something_else`. The user's explicit `PROVIDER` wins; the legacy vars are just key/model/url sources.

---

## 8. ProviderConfig Migration Plan

### 8.1 Type changes in `src/types/index.ts`

```typescript
// Widen ProviderId (Phase 1 had only 'openrouter')
export type ProviderId =
  | 'openrouter'
  | 'openai'
  | 'together'
  | 'deepinfra'
  | 'fireworks'
  | 'groq';

// New unified config
export interface ProviderConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl: string;
  extraHeaders?: Record<string, string>;
}

// Backwards-compat alias for stale tests (Phase 3 will remove this)
export type OpenRouterConfig = ProviderConfig;
```

**Note on the alias:** `OpenRouterConfig` is referenced by 21 test sites that are already stale (Phase 0 finding). Keeping the alias lets those tests compile during 2B without touching them; Phase 3 removes the alias when tests are repaired. **This is the smallest reversible change.**

### 8.2 `Config` class changes in `src/config/index.ts`

- Internal field: `private providerConfig: ProviderConfig` (renamed from `openRouterConfig`).
- New accessor: `getProviderConfig(): ProviderConfig`.
- Legacy accessor kept: `getOpenRouterConfig(): ProviderConfig { return this.getProviderConfig(); }` — delegates, preserves test compatibility.
- Env reading: new vars first, legacy fallback, per-provider default for `baseUrl`.

### 8.3 `ProviderFactory.create` signature change

```typescript
// Phase 1
static create(provider: ProviderId, config: OpenRouterConfig): VisionProvider

// Phase 2B
static create(config: ProviderConfig): VisionProvider
```

The `provider` argument is removed from the call signature because it's now inside `ProviderConfig`. The factory reads `config.provider` internally. This is a one-line signature change; the only caller is `index.ts`.

### 8.4 `index.ts` call site change

```typescript
// Phase 1
const openRouterConfig = config.getOpenRouterConfig();
const provider = ProviderFactory.create('openrouter', openRouterConfig);

// Phase 2B
const providerConfig = config.getProviderConfig();
const provider = ProviderFactory.create(providerConfig);
```

The `providerConfig.model` references at log lines (240, 253, 258, 261, 263) become `providerConfig.model` — pure rename, no behavior change.

---

## 9. Shared OpenAICompatibleProvider Design

### 9.1 Class shape

```typescript
// src/providers/openai-compatible.ts
import axios, { AxiosInstance } from 'axios';
import {
  ImageAnalysisResult,
  ProviderCapabilities,
  ProviderConfig,
  VisionProvider,
} from '../types/index.js';
import { Logger } from '../utils/logger.js';

export class OpenAICompatibleProvider implements VisionProvider {
  private client: AxiosInstance;
  private config: ProviderConfig;
  private logger: Logger;
  public readonly capabilities: ProviderCapabilities;

  constructor(config: ProviderConfig, capabilities: ProviderCapabilities) {
    this.config = config;
    this.logger = Logger.getInstance();
    this.capabilities = capabilities;

    this.client = axios.create({
      baseURL: config.baseUrl,                // FULL prefix — no path appending
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        ...(config.extraHeaders ?? {}),      // OpenRouter ranking headers etc.
      },
      timeout: 120000,
      maxContentLength: 50 * 1024 * 1024,
      maxBodyLength: 50 * 1024 * 1024,
    });
  }

  async analyzeImage(...): Promise<ImageAnalysisResult> { /* carried over */ }
  async testConnection(): Promise<boolean> { /* carried over */ }
  async validateModel(modelId: string): Promise<boolean> { /* carried over */ }
  private extractErrorMessage(error: any): string { /* carried over */ }
}
```

### 9.2 What is carried over verbatim from `OpenRouterClient`

- The entire `analyzeImage` method body (request body shape, response parsing, JSON-mode handling, error extraction).
- The `testConnection` method (GET `/models`).
- The `validateModel` method (including the vision-by-name heuristic — deferred hygiene, not removed in 2B).
- The `extractErrorMessage` private method.

**This is a move, not a rewrite.** The logic is battle-tested; relocating it from `openrouter-client.ts` to `openai-compatible.ts` preserves behavior.

### 9.3 What changes

- The constructor accepts `ProviderConfig` (with `extraHeaders`) instead of `OpenRouterConfig`.
- `capabilities` is **injected** via the constructor (passed by the factory per provider id), not hardcoded. This lets the same class report different capabilities if a future provider needs different settings — though for 2B, all six FC providers get `{ jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' }`.
- `HTTP-Referer` and `X-Title` are **no longer hardcoded**. They move into `extraHeaders`, which the factory populates from the `EXTRA_HEADERS` env var or from a per-provider default (OpenRouter gets its current values as the default `extraHeaders`; others get `{}`).

### 9.4 What is NOT singleton

The Phase 1 `OpenRouterClient` was a singleton (`getInstance`). The shared adapter **drops the singleton pattern** — the factory constructs a fresh instance per server startup. This is safe because:
- The server constructs the provider exactly once in `main()`.
- The singleton was never used to share state across calls; it was just an accessor convenience.
- Dropping it eliminates the "first-call-wins" anti-pattern flagged in Phase 0 and Phase 2A.

**Risk:** None — the only caller is the factory, and the factory is called once. If a future phase needs provider swapping at runtime, this also makes it easier.

---

## 10. OpenRouter Migration Strategy

### 10.1 What changes for OpenRouter users

- **Env vars:** `OPENROUTER_API_KEY` still works (legacy fallback). New canonical: `API_KEY`.
- **Model:** `OPENROUTER_MODEL` still works. New canonical: `MODEL`.
- **Base URL:** `OPENROUTER_BASE_URL` still works. New canonical: `BASE_URL`.
- **Headers:** `HTTP-Referer: https://github.com/openrouter-image-mcp` and `X-Title: OpenRouter Image MCP` are preserved as the **default `extraHeaders`** for `PROVIDER=openrouter` when `EXTRA_HEADERS` is unset. Users can override via `EXTRA_HEADERS='{"HTTP-Referer":"…","X-Title":"…"}'`.

### 10.2 What stays identical for OpenRouter users

- The HTTP request body sent to `https://openrouter.ai/api/v1/chat/completions`.
- The response parsing.
- The error messages.
- The startup log strings ("Starting OpenRouter Image MCP Server", "Using model: …", "OpenRouter API connection successful", etc.).
- The tool schemas.
- The tool names.
- The tool outputs.

### 10.3 Migration verification

- Sentinel: `test/integration/mcp-server.test.ts` stays 8/8 (black-box MCP protocol over stdio).
- Live smoke: `OPENROUTER_API_KEY=dummy node dist/index.js` starts and lists 3 tools (same as Phase 1 verification).
- Diff check: `git diff baseline/src/utils/openrouter-client.ts src/providers/openai-compatible.ts` shows the logic carried over, with only the constructor + headers changed.

---

## 11. Per-Provider Default Configuration

The factory supplies per-provider defaults when the user does not override `baseUrl` or `model`:

| Provider | Default `baseUrl` | Default `model` | Default `extraHeaders` |
|---|---|---|---|
| `openrouter` | `https://openrouter.ai/api/v1` | `anthropic/claude-3.5-sonnet` | `{ 'HTTP-Referer': 'https://github.com/openrouter-image-mcp', 'X-Title': 'OpenRouter Image MCP' }` |
| `openai` | `https://api.openai.com/v1` | `gpt-4o` | `{}` |
| `together` | `https://api.together.xyz/v1` | (no default — user must set `MODEL`) | `{}` |
| `deepinfra` | `https://api.deepinfra.com/v1/openai` | (no default — user must set `MODEL`) | `{}` |
| `fireworks` | `https://api.fireworks.ai/inference/v1` | (no default — user must set `MODEL`) | `{}` |
| `groq` | `https://api.groq.com/openai/v1` | `llama-3.2-90b-vision-preview` | `{}` |

**Rationale for `openrouter`'s defaults:** preserve the current behavior exactly. The current `Config` defaults `model` to `anthropic/claude-3.5-sonnet` and `baseUrl` to `https://openrouter.ai/api/v1`.

**Rationale for `openai`/`groq` model defaults:** the most common vision-capable model on each platform. Users can override.

**Rationale for no default model on Together/DeepInfra/Fireworks:** these are multi-model aggregators; picking one would be arbitrary. Require the user to set `MODEL`. The server throws a clear error if `MODEL` is unset for these providers.

**Critical design rule (from Phase 2A §5.1):** the adapter NEVER appends `/v1` or any path to `baseUrl`. Each default `baseUrl` includes its full path. User-supplied `BASE_URL` must also be a full prefix. Documented in `.env.example`.

---

## 12. Environment Variable Migration Strategy

### 12.1 `.env.example` (new content)

```bash
# Provider configuration
# PROVIDER defaults to 'openrouter' for backwards compatibility.
# Valid: openrouter | openai | together | deepinfra | fireworks | groq
PROVIDER=openrouter

# API key (required). Legacy: OPENROUTER_API_KEY
API_KEY=your_api_key_here

# Model id (optional; per-provider default if unset). Legacy: OPENROUTER_MODEL
MODEL=google/gemini-2.0-flash-exp:free

# Base URL (optional; per-provider default if unset). MUST be a full prefix
# including /v1 or /api/v1 as appropriate for the provider.
# Legacy: OPENROUTER_BASE_URL
# BASE_URL=https://openrouter.ai/api/v1

# Optional extra headers as a JSON object string.
# For OpenRouter ranking: '{"HTTP-Referer":"https://your.app","X-Title":"Your App"}'
# EXTRA_HEADERS=

# Server configuration (unchanged)
PORT=3000
LOG_LEVEL=info
RETRY_ATTEMPTS=3
MAX_IMAGE_SIZE=10485760

# --- Legacy fallback (deprecated, still supported) ---
# OPENROUTER_API_KEY=...
# OPENROUTER_MODEL=...
# OPENROUTER_BASE_URL=...
```

### 12.2 Resolution algorithm (in `Config` constructor)

```
provider := env.PROVIDER ?? 'openrouter'
apiKey   := env.API_KEY     ?? env.OPENROUTER_API_KEY     // legacy fallback
model    := env.MODEL       ?? env.OPENROUTER_MODEL       ?? perProviderDefault(provider)
baseUrl  := env.BASE_URL    ?? env.OPENROUTER_BASE_URL    ?? perProviderDefault(provider)
extraHeaders := parseJSON(env.EXTRA_HEADERS) ?? perProviderDefaultHeaders(provider)
```

### 12.3 Backwards compatibility guarantee

A user with the **exact** existing `.env`:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=google/gemini-2.0-flash-exp:free
```

…continues to work with **zero changes**. The server detects `PROVIDER` unset → defaults to `openrouter`, lifts `OPENROUTER_API_KEY` into `API_KEY`, applies the OpenRouter default `baseUrl`, applies the OpenRouter default `extraHeaders`, and proceeds. Runtime behavior is identical.

---

## 13. Validation Strategy

### 13.1 Per-commit validation (during implementation)

After **each** commit:
1. `npm run build` — must exit 0.
2. `/tmp/sentinel-check.sh` — sentinel (8/8 black-box MCP tests) must stay green.
3. `grep -rn "OpenRouterClient" src/` — must return zero hits after the migration commit.
4. `git diff --stat` — verify only intended files changed.

### 13.2 End-of-Phase 2B validation gate

| Check | Command | Expected |
|---|---|---|
| Build clean | `npm run build` | exit 0 |
| No new deps | `diff baseline/package.json package.json` | only metadata; no dependency additions |
| Tool handlers unchanged | `diff <(sed -n …)` vs Phase 1 tool-schema block | byte-identical |
| MCP schemas unchanged | `diff` vs baseline tool block | byte-identical |
| Concrete coupling | `grep -rn "OpenRouterClient" src/` | zero hits |
| `openrouter-client.ts` removed | `ls src/utils/openrouter-client.ts` | "No such file" |
| Shared adapter exists | `ls src/providers/openai-compatible.ts` | file present |
| `ProviderConfig` exists | `grep "interface ProviderConfig" src/types/index.ts` | one hit |
| `ProviderId` widened | `grep -c "'openrouter'\|'openai'\|'together'\|'deepinfra'\|'fireworks'\|'groq'" src/types/index.ts` | ≥6 |
| Sentinel | `/tmp/sentinel-check.sh` | 8/8 |
| Live smoke (OpenRouter legacy env) | `OPENROUTER_API_KEY=dummy node dist/index.js` + `tools/list` | 3 tools enumerated |
| Live smoke (new env) | `PROVIDER=openai API_KEY=dummy MODEL=gpt-4o node dist/index.js` + `tools/list` | 3 tools enumerated |
| Legacy fallback works | `OPENROUTER_API_KEY=dummy OPENROUTER_MODEL=x node dist/index.js` | starts without error |

**Explicitly not validated in 2B (per plan):**
- `npm test` (full) — Phase 3
- `npm run lint` — Phase 3
- Live API calls with real keys — no keys; deferred to manual smoke / Phase 4

### 13.3 Regression sentinel

`test/integration/mcp-server.test.ts` (8/8) remains the canary. It spawns the server with `OPENROUTER_API_KEY='test-api-key'` and `OPENROUTER_MODEL='test-model'` (legacy env vars — see `test/integration/mcp-server.test.ts:14-16`). **The legacy fallback path MUST keep this test green.** This is the empirical proof that backwards compatibility holds.

---

## 14. Test Strategy

**Phase 2B does not repair or add tests.** This is explicitly Phase 3's scope.

However, Phase 2B must not **break** the sentinel. The sentinel (`mcp-server.test.ts`) uses legacy env vars and the black-box protocol — it exercises the legacy fallback path end-to-end.

**Risk:** The sentinel's mock `Config` (lines 221, 314, 399, 488, 545, 601) returns `getOpenRouterConfig()` results. The legacy accessor is preserved (§8.2), so these mocks continue to type-check. The sentinel passes 8/8 at baseline and after Phase 1; the legacy accessor delegate keeps it green through 2B.

**What 2B does NOT touch in tests:** nothing. Test files are not modified in 2B. Phase 3 repairs them.

---

## 15. Rollback Strategy

Phase 2B is a sequence of small commits. Rollback is granular:

| Step | Commit | Rollback |
|---|---|---|
| 1. Widen `ProviderId` + add `ProviderConfig` (additive) | `phase2b: widen ProviderId, add ProviderConfig` | `git revert` — removes new types; nothing references them yet. |
| 2. Add `OpenAICompatibleProvider` (new file, no callers) | `phase2b: add shared OpenAICompatibleProvider` | `git rm` the new file; nothing imports it yet. |
| 3. Generalize `Config` (new env vars + `getProviderConfig`, keep `getOpenRouterConfig` delegate) | `phase2b: generalize Config with legacy fallback` | `git revert` — restores old `Config`. |
| 4. Wire `ProviderFactory` to return `OpenAICompatibleProvider` for all 6 ids; delete `openrouter-client.ts` | `phase2b: route factory through shared adapter, remove OpenRouterClient` | `git revert` — restores `OpenRouterClient` and old factory. |
| 5. Update `index.ts` to use `getProviderConfig()` + `ProviderFactory.create(providerConfig)` | `phase2b: index.ts uses ProviderConfig` | `git revert` — restores `getOpenRouterConfig()` call. |
| 6. Update `.env.example` | `phase2b: document new env vars + legacy fallback` | `git revert` — restores old `.env.example`. |

**Ordering rationale:** Steps 1–2 are purely additive. Step 3 adds new behavior while preserving old. Step 4 is the swap (the only commit that changes runtime wiring). Step 5 updates the sole caller. Step 6 is documentation. If any step fails to build or breaks the sentinel, the previous step is a known-good state.

**Emergency rollback (all of Phase 2B):** `git reset --hard <sha-of-final-phase-1-commit>` (`c41c4b2`). The `baseline/` reference clone is immutable and untouched.

---

## 16. Risk Assessment (Phase 2B specific)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Deleting `openrouter-client.ts` loses a behavior the shared adapter didn't capture | Low | High | The shared adapter is a **move** of the method bodies, not a rewrite. Diff review during step 4. Sentinel + live smoke catch regressions. |
| Legacy env var fallback breaks for existing OpenRouter users | Low | High | Sentinel uses legacy env vars; staying green is the proof. Live smoke with `OPENROUTER_API_KEY=dummy` is an explicit 2B gate. |
| `extraHeaders` default for OpenRouter doesn't match the current hardcoded values | Low | Medium | Diff the `HTTP-Referer` and `X-Title` strings verbatim against `baseline/src/utils/openrouter-client.ts:20-21`. |
| A provider's default `baseUrl` is wrong (typo, wrong path) | Medium | Medium | Cross-checked against Phase 2A evidence table §2. Each default is from official docs. |
| `ProviderConfig` alias for `OpenRouterConfig` breaks a test | Very Low | Low | The alias is a type alias, structurally identical. Tests that type-check today continue to type-check. |
| Factory signature change (`create(config)` vs `create(provider, config)`) breaks a caller | Very Low | Low | Only caller is `index.ts`; updated in the same commit sequence (step 5). |
| `EXTRA_HEADERS` JSON parsing fails on malformed input | Low | Low | Wrap in try/catch; throw a clear startup error pointing at `EXTRA_HEADERS`. |
| Stale tests break further due to renamed internal `Config` field | Medium | None | Tests are already broken (Phase 0). 2B does not claim `npm test` passes. The legacy `getOpenRouterConfig()` delegate keeps the sentinel's mocks type-checking. |
| User sets `PROVIDER=openai` but only has `OPENROUTER_API_KEY` set | Medium | Low | Legacy fallback applies: `API_KEY := OPENROUTER_API_KEY`. The user's explicit `PROVIDER=openai` is honored; the key is reused. Documented in `.env.example`. |
| Per-provider default `model` for Together/DeepInfra/Fireworks is unset → startup throws | Certain by design | Low | Intended behavior. Clear error message: "`MODEL` environment variable is required for provider 'together'". |

**Overall Phase 2B risk: LOW.** The largest single risk (deleting `openrouter-client.ts`) is mitigated by the move-not-rewrite discipline and the sentinel.

---

## 17. Commit Plan

Six commits, ordered additive-first, swap-middle, caller-last:

```
phase2b: widen ProviderId union, add ProviderConfig type             [additive]
phase2b: add shared OpenAICompatibleProvider                         [additive, no callers]
phase2b: generalize Config with new env vars + legacy fallback       [additive behavior, old path preserved]
phase2b: route ProviderFactory through shared adapter; delete OpenRouterClient  [the swap]
phase2b: update index.ts to use ProviderConfig + new factory signature  [caller update]
phase2b: update .env.example with new + legacy env vars              [docs]
```

Each commit is independently buildable. Each is independently revertible. The sentinel runs after each.

---

## 18. Success Criteria

| # | Criterion | Verification |
|---|---|---|
| S1 | MCP tool names unchanged | diff vs Phase 1 tool block |
| S2 | MCP tool schemas byte-identical | diff vs Phase 1 tool block |
| S3 | Sentinel (8/8 black-box MCP tests) green | `/tmp/sentinel-check.sh` |
| S4 | `npm run build` exit 0 | `npm run build` |
| S5 | No new runtime dependencies | `diff baseline/package.json package.json` |
| S6 | Zero `OpenRouterClient` references in `src/` | `grep -rn "OpenRouterClient" src/` → 0 hits |
| S7 | `openrouter-client.ts` deleted | `ls src/utils/openrouter-client.ts` → not found |
| S8 | `OpenAICompatibleProvider` exists and implements `VisionProvider` | `ls src/providers/openai-compatible.ts` + `grep "implements VisionProvider"` |
| S9 | `ProviderId` widened to 6 members | `grep -c` check |
| S10 | `ProviderConfig` interface exists | `grep "interface ProviderConfig"` |
| S11 | Legacy env var fallback works | `OPENROUTER_API_KEY=dummy node dist/index.js` starts; sentinel green |
| S12 | New env var path works | `PROVIDER=openai API_KEY=dummy MODEL=gpt-4o node dist/index.js` starts + `tools/list` returns 3 tools |
| S13 | `index.ts` uses `getProviderConfig()` + `ProviderFactory.create(providerConfig)` | `grep` |
| S14 | `.env.example` documents new + legacy vars | inspection |
| S15 | OpenRouter default `extraHeaders` preserve `HTTP-Referer`/`X-Title` values verbatim | diff vs `baseline/src/utils/openrouter-client.ts:20-21` |

**Explicitly NOT a 2B success criterion:** `npm test` passing, `npm run lint` passing — Phase 3.

---

## 19. Failure Criteria (would abort 2B and force re-planning)

1. The shared adapter cannot reproduce OpenRouter's exact runtime behavior (sentinel regresses and cannot be fixed by config tuning). Would force keeping `OpenRouterClient` as a separate class and rethinking the shared-adapter thesis.
2. Legacy env var fallback cannot be made to preserve the existing OpenRouter user experience. Would force a breaking-change migration with deprecation notices — contradicts the "no behavior changes" principle.
3. Base URL prefix handling cannot be unified (a provider requires path manipulation that contradicts the full-prefix rule). Would force per-provider URL builders — an abstraction change.
4. `tsc` cannot compile the migration without touching tool handlers or MCP schemas. Would indicate the Phase 1 seam is insufficient — contradicts Phase 2A's conclusion.

**None indicated by current evidence.**

---

## 20. Validation Gates

| Gate | When | Criterion |
|---|---|---|
| G1 — Pre-implementation | Before commit 1 | Phase 2B plan approved (this document) |
| G2 — Per-commit | After each of 6 commits | `npm run build` exit 0 + sentinel 8/8 |
| G3 — Post-swap | After commit 4 (the swap) | `grep OpenRouterClient src/` = 0; `ls openai-compatible.ts` exists; sentinel 8/8 |
| G4 — End-of-phase | After commit 6 | All S1–S15 met |
| G5 — Sign-off | After G4 | Phase 2B Completion Report written; user approves |

---

## 21. Completion Criteria

Phase 2B is complete when ALL of the following hold:

1. All 15 success criteria (S1–S15) are verified green.
2. Six commits land in the fork's git history, each with a descriptive message referencing this plan.
3. `baseline/` remains immutable (no changes to the reference clone).
4. The Phase 2B Completion Report is written and committed, documenting:
   - Final commit list
   - Success criteria verification table
   - Sentinel checkpoint after each commit
   - Any mid-flight adjustments (with rationale)
   - Architectural outcome (concrete coupling count, file count)
   - Diff statistics
5. No tests were repaired (Phase 3 scope, enforced).
6. No lint config was changed (Phase 3 scope, enforced).
7. No new providers beyond the 6 FC set were added (Phase 2C scope, enforced).

---

## 22. What Phase 2C Will Then Do Safely

With the shared adapter in place, Phase 2C's scope is localized:
1. Add `chutes` case to `ProviderFactory` + any `supported_features` preflight.
2. Add `cerebras` case (after Spike 2A-1 confirms vision support).
3. Add `azure` case with a dedicated `AzureOpenAIProvider` (different auth + URL shape).
4. Optional hygiene: remove the vision-by-name heuristic from `validateModel`; make `response_format` conditional on `capabilities.jsonMode` (already a no-op for 2B providers).

None of these touch tool handlers, MCP schemas, or `index.ts` wiring.

---

## 23. Approval Checklist

Before coding begins, confirm:

- [ ] §1 Objective matches intent.
- [ ] §2 Scope (6 FC providers) is correct; §3 Out-of-scope list is acceptable.
- [ ] §4 File modification list is complete and minimal.
- [ ] §7 Env var migration + §8 ProviderConfig migration preserve backwards compatibility acceptably.
- [ ] §9 Shared adapter design (move-not-rewrite, injected capabilities, dropped singleton) is acceptable.
- [ ] §10 OpenRouter migration preserves the existing user experience.
- [ ] §11 Per-provider defaults are correct (especially: no default model for Together/DeepInfra/Fireworks).
- [ ] §13 Validation gates (especially S11 legacy fallback + S12 new-env path) are the correct bar.
- [ ] §15 Rollback strategy (6 ordered commits) is acceptable.
- [ ] §17 Commit plan ordering (additive-first, swap-middle, caller-last) is acceptable.
- [ ] §18 Success criteria S1–S15 are acceptable.
- [ ] §19 Failure criteria correctly identify abort conditions.

---

**Awaiting approval. No code changes will be made until this plan is authorized.**