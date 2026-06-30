# Release Execution Plan: open-vision-mcp

**Final name:** `open-vision-mcp` (GitHub + npm)
**Current version:** `2.1.0` (placeholder in package.json — needs final naming applied)
**Release candidate:** fork HEAD `b459f36`
**Date:** post-V1.1 release readiness review (APPROVE WITH MINOR RELEASE CHANGES)

---

## Phase Overview

The release process is organized into 6 sequential phases:

| Phase | Scope | Mandatory before first publish? |
|---|---|---|
| Phase R1 — Final Preparation | Naming, cleanup, doc polish | ✅ Yes |
| Phase R2 — Repository Setup | GitHub repo, settings, files | ✅ Yes |
| Phase R3 — Pre-Publish Validation | Final checks, dry runs | ✅ Yes |
| Phase R4 — Publication | npm publish + GitHub release | ✅ Yes |
| Phase R5 — Post-Publish Validation | Verify the published package works | ✅ Yes |
| Phase R6 — Post-Release | Announcement, maintenance, LTS | ❌ After publish |

---

## Phase R1 — Final Preparation (Mandatory)

### R1.1 Apply the final package name

The package name is confirmed as `open-vision-mcp`. It's currently the placeholder in `package.json`. Apply the final name across all files:

| File | Current | Final |
|---|---|---|
| `package.json` `name` | `open-vision-mcp` | `open-vision-mcp` (confirmed — no change needed) |
| `package.json` `bin` | `open-vision-mcp` | `open-vision-mcp` (no change needed) |
| `package.json` `repository.url` | `https://github.com/abyssbugg/open-image-mcp.git` | `https://github.com/abyssbugg/open-vision-mcp.git` |
| `package.json` `bugs.url` | `https://github.com/abyssbugg/open-image-mcp/issues` | `https://github.com/abyssbugg/open-vision-mcp/issues` |
| `package.json` `homepage` | `https://github.com/abyssbugg/open-image-mcp#readme` | `https://github.com/abyssbugg/open-vision-mcp#readme` |
| `package.json` `author` | current | Updated to real author name |
| `README.md` title | `open-vision-mcp` | `open-vision-mcp` (no change needed) |
| `README.md` attribution | current fork URL | Updated to final GitHub URL |
| `README.md` clone command | current | `git clone https://github.com/abyssbugg/open-vision-mcp.git` |

**Action:** one commit applying the final name + repository URLs.

### R1.2 Remove key prefix from proposal doc

**Finding F2 from the V1.1 release review:** `VERSION-1.1-ENGINEERING-PROPOSAL.md` contains `<redacted-key-prefix>` (first 8 chars of the Ollama API key). Replace with `<cloud-token>`.

| File | Current | Final |
|---|---|---|
| `VERSION-1.1-ENGINEERING-PROPOSAL.md` | `API_KEY=<redacted-key-prefix>` (2 occurrences) | `API_KEY=<cloud-token>` |

**Action:** one commit (or squash into R1.1).

### R1.3 README polish

Review the README for accuracy after the final naming is applied:

- [ ] Title: `open-vision-mcp`
- [ ] Badges: npm version badge (will work after first publish), license badge, Node.js badge
- [ ] Provider table: all 10 providers, correct base URLs, correct notes
- [ ] Quick start: `npx open-vision-mcp` (the bin name)
- [ ] MCP client config: correct `args` and `env`
- [ ] Validation Status: engineering complete, Ollama live-validated, 9 pending, Cerebras unverified
- [ ] Attribution: forked from `JonathanJude/openrouter-image-mcp` (MIT)
- [ ] Clone command: final GitHub URL
- [ ] npm install command: `npm install -g open-vision-mcp`
- [ ] No "placeholder" language anywhere
- [ ] No "TBD" or "TODO" language

**Action:** one commit if changes are needed beyond R1.1.

### R1.4 CHANGELOG preparation

Create `CHANGELOG.md` following the [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [2.1.0] — 2026-06-30

### Added
- Ollama provider (local + Cloud) with dedicated `OllamaProvider` adapter
- Native `/api/chat` endpoint support for Ollama
- 16 unit tests for `OllamaProvider` (182 total)
- Live validation: Ollama Cloud vision analysis confirmed end-to-end

### Changed
- Package version: 2.0.0 → 2.1.0

## [2.0.0] — 2026-06-26

### Added
- Provider-neutral architecture: `VisionProvider` interface, `ProviderFactory`, `ProviderCapabilities`
- 10 inference providers: OpenRouter, OpenAI, Together, DeepInfra, Fireworks, Groq, Chutes, Cerebras, Azure OpenAI, Ollama
- Shared `OpenAICompatibleProvider` adapter (6 FC providers)
- Dedicated `ChutesProvider` (supported_features preflight)
- Dedicated `AzureOpenAIProvider` (api-key auth, deployment URL, no /models)
- Dedicated `OllamaProvider` (native /api/chat, local + Cloud)
- New environment variables: `PROVIDER`, `API_KEY`, `MODEL`, `BASE_URL`, `EXTRA_HEADERS`
- Legacy env var fallback: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_BASE_URL`
- Per-provider default configuration (`PROVIDER_DEFAULTS` table)
- Per-provider capability declaration (`PROVIDER_CAPABILITIES` table)
- Provider-aware error messages
- Provider-aware startup log strings
- `response_format` gating on `capabilities.jsonMode` (D6)
- Logger error serialization for non-Error payloads (D14)
- MCP SDK upgraded from ^0.5.0 to ^1.29.0
- axios upgraded from ^1.6.0 to ^1.18.1
- 182 unit + integration tests (163 V1 + 19 V1.1)
- Sentinel black-box MCP protocol test (8/8)
- Phase 2B.5 Stage 1 keyless validation (10/10 mandatory gates)

### Removed
- `OpenRouterClient` (replaced by shared `OpenAICompatibleProvider`)
- `OpenRouterConfig` interface (replaced by `ProviderConfig`)
- `getOpenRouterConfig()` accessor (replaced by `getProviderConfig()`)
- Vision-by-name heuristic in `validateModel` (D5)
- Hardcoded "OpenRouter" in startup log strings (D4)
- Committed `.tgz` build artifact (D10)

### Breaking changes
- Package renamed: `openrouter-image-mcp` → `open-vision-mcp`
- MCP server name: `openrouter-image-mcp` → `vision-mcp`
- Tool description: "OpenRouter's vision models" → "the configured vision provider"
- `OpenRouterConfig` interface removed (use `ProviderConfig`)
- Environment variable schema generalized (legacy fallback preserved)
```

**Action:** create `CHANGELOG.md` in one commit.

### R1.5 LICENSE verification

- [ ] `LICENSE` file exists with MIT text ✅ (verified: present since baseline)
- [ ] `package.json` `license` field is `"MIT"` ✅ (verified)
- [ ] License year is current
- [ ] License holder name is correct (update from upstream's name if needed)

**Action:** verify; one commit if the name/year needs updating.

### R1.6 CONTRIBUTING guide

Create `CONTRIBUTING.md`:

```markdown
# Contributing to open-vision-mcp

Thank you for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/abyssbugg/open-vision-mcp.git
cd open-vision-mcp
npm install
npm run build
```

## Development Commands

| Command | Purpose |
|---|---|
| `npm run build` | TypeScript compilation |
| `npm run lint` | ESLint (0 errors required) |
| `npm test` | Vitest test suite |
| `npm run dev` | Development mode with tsx watch |

## Engineering Standards

- **Build must pass:** `npm run build` exit 0
- **Lint must pass:** `npm run lint` exit 0 (0 errors; warnings acceptable)
- **Tests must pass:** JSON reporter shows 0 failures (the `npm test` exit code is 1 due to a known vitest+Node 25 interaction; the JSON reporter is authoritative)
- **Sentinel must pass:** `test/integration/mcp-server.test.ts` 8/8
- **MCP contract preserved:** tool names and inputSchemas must not change
- **No new runtime dependencies** without explicit justification

## Adding a New Provider

1. Add the provider id to `ProviderId` in `src/types/index.ts`
2. Add defaults to `PROVIDER_DEFAULTS` in `src/config/index.ts`
3. Add capabilities to `PROVIDER_CAPABILITIES` in `src/providers/factory.ts`
4. Add a `case` to `ProviderFactory.create`
5. If the provider is OpenAI-compatible: reuse `OpenAICompatibleProvider` (config-only)
6. If the provider has a unique API: create a dedicated adapter implementing `VisionProvider`
7. Add unit tests for the adapter
8. Add factory dispatch + capability tests
9. Add config default-resolution tests
10. Update `.env.example` and README

## Ownership Boundary

Each dedicated adapter (e.g., `OllamaProvider`, `AzureOpenAIProvider`) is the **single ownership boundary** for its provider's native protocol. All provider-specific request/response translation belongs in the adapter file only. Shared infrastructure (`OpenAICompatibleProvider`, `ProviderFactory`, `Config`, `types`, tool handlers) must remain protocol-neutral.

## Pull Request Process

1. Create a branch from `main`
2. Make small, focused commits with descriptive messages
3. Ensure build + lint + tests + sentinel are green
4. Open a PR with a description referencing any related issues
5. Wait for review

## License

By contributing, you agree that your contributions are licensed under the MIT license.
```

**Action:** create `CONTRIBUTING.md` in one commit.

### R1.7 SECURITY policy

Create `SECURITY.md`:

```markdown
# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in open-vision-mcp:

1. **Do not** open a public GitHub issue.
2. Email the maintainer directly with details of the vulnerability.
3. Include steps to reproduce if possible.
4. You will receive a response within 48 hours.

## Security Considerations

- API keys are loaded from environment variables only — never hardcoded or logged.
- The server does not persist API keys or image data.
- Image data is processed in-memory (base64 → buffer → base64) and not written to disk.
- All provider communication is over HTTPS (provider base URLs are HTTPS).
- `EXTRA_HEADERS` is validated as a JSON object before being sent.

## Dependency Security

Runtime dependencies: `@modelcontextprotocol/sdk`, `axios`, `dotenv`.
Dev dependencies may have known vulnerabilities (check `npm audit`); these do not ship with the npm package.
```

**Action:** create `SECURITY.md` in one commit.

---

## Phase R2 — Repository Setup (Mandatory)

### R2.1 GitHub repository creation

Create a new public repository on GitHub:

| Setting | Value |
|---|---|
| Owner | `abyssbugg` |
| Name | `open-vision-mcp` |
| Visibility | Public |
| Description | `Provider-neutral Vision MCP server — image analysis via 10 inference providers` |
| Initialize with README | No (we have our own) |
| .gitignore | No (we have our own) |
| License | No (we have our own MIT) |

**Action:** create the repository via `gh repo create abyssbugg/open-vision-mcp --public --description "Provider-neutral Vision MCP server — image analysis via 10 inference providers"` or via the GitHub web UI.

### R2.2 Push the codebase

```bash
# Add the new remote (replace origin if it points to the old repo)
git remote add origin https://github.com/abyssbugg/open-vision-mcp.git
# Or if origin exists:
git remote set-url origin https://github.com/abyssbugg/open-vision-mcp.git

# Push all commits + tags
git push -u origin main
git push --tags
```

### R2.3 Repository settings

Configure the GitHub repository settings:

| Setting | Value |
|---|---|
| Default branch | `main` |
| Allow merge commits | Yes |
| Allow squash merging | Yes (preferred for clean history) |
| Allow rebase merging | Yes |
| Allow force pushes | No |
| Allow deletions | No |
| Issues | Enabled |
| Discussions | Enabled |
| Projects | Disabled (or enabled if desired) |
| Wiki | Disabled |
| Pages | Disabled |
| Releases | Enabled |

### R2.4 Branch protection

Configure branch protection for `main`:

| Rule | Value |
|---|---|
| Require pull request before merging | Yes (for collaborators) |
| Require approvals | 1 (if multiple collaborators) |
| Dismiss stale approvals on new push | Yes |
| Require status checks to pass | Yes (when CI is added) |
| Require branches to be up to date | Yes (when CI is added) |
| Require conversation resolution | Yes |
| Require signed commits | Optional (recommended if maintainer has GPG key) |
| Allow force pushes | No |
| Allow deletions | No |

**Note:** if this is a solo-maintainer project, branch protection can be relaxed (direct push to `main` allowed). But if any contributors are expected, enable PR-required + approvals.

### R2.5 Required repository files

Verify these files exist in the repo root:

| File | Status |
|---|---|
| `README.md` | ✅ (provider-neutral, 10 providers, validation status) |
| `LICENSE` | ✅ (MIT) |
| `CHANGELOG.md` | Create in R1.4 |
| `CONTRIBUTING.md` | Create in R1.6 |
| `SECURITY.md` | Create in R1.7 |
| `.env.example` | ✅ (all 10 providers, legacy fallback) |
| `.gitignore` | ✅ (baseline/, node_modules, dist, .DS_Store, *.tgz) |
| `.npmignore` | ✅ (src, test, configs excluded from npm package) |
| `package.json` | ✅ (name open-vision-mcp, version 2.1.0) |
| `tsconfig.json` | ✅ |
| `vitest.config.ts` | ✅ (excludes baseline/) |
| `.eslintrc.json` | ✅ (fixed in Phase 3) |
| `.prettierrc` | ✅ |

### R2.6 GitHub Issue templates

Create `.github/ISSUE_TEMPLATE/bug_report.yml`:

```yaml
name: Bug Report
description: Report a bug in open-vision-mcp
labels: ["bug"]
body:
  - type: dropdown
    id: provider
    attributes:
      label: Provider
      description: Which provider are you using?
      options:
        - openrouter
        - openai
        - together
        - deepinfra
        - fireworks
        - groq
        - chutes
        - cerebras
        - azure
        - ollama
    validations:
      required: true
  - type: textarea
    id: description
    attributes:
      label: Description
      description: What happened? What did you expect?
    validations:
      required: true
  - type: textarea
    id: env
    attributes:
      label: Environment
      description: PROVIDER, MODEL, Node version, OS
      placeholder: "PROVIDER=openai, MODEL=gpt-4o, Node v25.9.0, macOS"
    validations:
      required: true
  - type: textarea
    id: logs
    attributes:
      label: Logs
      description: Relevant log output (with LOG_LEVEL=debug). Do NOT include API keys.
      render: shell
    validations:
      required: false
```

Create `.github/ISSUE_TEMPLATE/feature_request.yml`:

```yaml
name: Feature Request
description: Suggest a new feature or provider
labels: ["enhancement"]
body:
  - type: textarea
    id: description
    attributes:
      label: Feature Description
      description: What feature would you like to see?
    validations:
      required: true
  - type: textarea
    id: use-case
    attributes:
      label: Use Case
      description: Why is this feature useful?
    validations:
      required: true
```

Create `.github/ISSUE_TEMPLATE/config.yml`:

```yaml
blank_issues_enabled: true
contact_links:
  - name: Discussions
    url: https://github.com/abyssbugg/open-vision-mcp/discussions
    about: For questions and general discussion, use Discussions
```

**Action:** create `.github/ISSUE_TEMPLATE/` directory with the 3 files.

### R2.7 Pull Request template

Create `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Summary

<!-- Brief description of the changes -->

## Type of Change

- [ ] Bug fix
- [ ] New provider
- [ ] Enhancement
- [ ] Documentation
- [ ] Refactor
- [ ] Other

## Checklist

- [ ] `npm run build` passes (exit 0)
- [ ] `npm run lint` passes (0 errors)
- [ ] All tests pass (JSON reporter: 0 failures)
- [ ] Sentinel 8/8
- [ ] MCP tool names + schemas unchanged
- [ ] No new runtime dependencies (or justified)
- [ ] `.env.example` updated if new config
- [ ] README updated if user-facing change
- [ ] CHANGELOG updated

## Notes

<!-- Any additional context -->
```

**Action:** create `.github/PULL_REQUEST_TEMPLATE.md`.

### R2.8 GitHub Discussions recommendations

Enable Discussions with these categories:

| Category | Purpose |
|---|---|
| Announcements | Release announcements (maintainer-only posts) |
| General | General questions |
| Providers | Provider-specific discussion (setup, models, issues) |
| Ideas | Feature ideas before they become issues |

**Action:** enable Discussions in repository settings; create the 4 categories.

---

## Phase R3 — Pre-Publish Validation (Mandatory)

### R3.1 Final validation gate

Run the complete validation suite one final time:

```bash
# Build
npm run build
# Expected: exit 0

# Lint
npm run lint
# Expected: exit 0 (0 errors)

# Tests (JSON reporter is authoritative)
CI=true npx vitest run --reporter=json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{d[\"numPassedTests\"]}/{d[\"numTotalTests\"]} pass')"
# Expected: 182/182 pass, 0 fail

# Sentinel
/tmp/sentinel-check.sh
# Expected: 8/8 pass, 0 fail

# MCP schema
diff <(sed -n "/const tools: Tool\[\]/,/return { tools };/p" baseline/src/index.ts | grep "name: '") <(sed -n "/const tools: Tool\[\]/,/return { tools };/p" src/index.ts | grep "name: '")
# Expected: identical

# No secrets
git ls-files | xargs grep -l "sk-or-v1-[a-zA-Z0-9]\{20,\}\|<redacted-key-prefix>\|ghp_[a-zA-Z0-9]\{30,\}" 2>/dev/null
# Expected: no hits

# npm package contents
npm pack --dry-run
# Expected: 32 files, ~114KB, only dist/ + README + LICENSE + .env.example
```

### R3.2 npm publish dry-run

```bash
npm publish --dry-run
```

Verify:
- [ ] Package name is `open-vision-mcp`
- [ ] Version is `2.1.0`
- [ ] Tarball contains only `dist/`, `README.md`, `LICENSE`, `.env.example`
- [ ] No source files, no test files, no phase reports
- [ ] No `.tgz`, no `baseline/`, no `.DS_Store`

### R3.3 npm login

```bash
npm whoami
# If not logged in:
npm login
```

Verify the npm account that will own the package. **The first publish of a name claims it permanently** — ensure the right account is logged in.

### R3.4 Git tag

Create the release tag:

```bash
git tag -a v2.1.0 -m "open-vision-mcp v2.1.0 — Provider-neutral Vision MCP with 10 providers + Ollama live validation"
git push origin v2.1.0
```

---

## Phase R4 — Publication (Mandatory)

### R4.1 npm publish

```bash
npm publish
```

This runs `prepublishOnly` (which runs `npm run build`) and publishes the package.

**Verify immediately after:**
```bash
npm view open-vision-mcp version
# Expected: 2.1.0
```

### R4.2 GitHub Release creation

Create a GitHub Release attached to the `v2.1.0` tag:

```bash
gh release create v2.1.0 \
  --title "open-vision-mcp v2.1.0" \
  --notes "## open-vision-mcp v2.1.0

### What's New

- **10 inference providers** through a single MCP server: OpenRouter, OpenAI, Together, DeepInfra, Fireworks, Groq, Chutes, Cerebras, Azure OpenAI, Ollama
- **Ollama support** (local + Cloud) with dedicated `OllamaProvider` adapter using the native `/api/chat` endpoint
- **Live-validated**: Ollama Cloud vision analysis confirmed end-to-end
- **Provider-neutral architecture**: `VisionProvider` interface, `ProviderFactory`, per-provider capabilities
- **182 unit + integration tests** (0 failures)
- **Legacy backwards compatibility**: existing `OPENROUTER_API_KEY` users work with zero config changes

### Installation

\`\`\`bash
npx open-vision-mcp
# or
npm install -g open-vision-mcp
\`\`\`

### Configuration

\`\`\`bash
export PROVIDER=openrouter
export API_KEY=your-api-key
export MODEL=google/gemini-2.0-flash-exp:free
\`\`\`

See the [README](https://github.com/abyssbugg/open-vision-mcp#readme) for full documentation.

### Validation Status

- **Engineering validation**: COMPLETE (182/182 tests, 10/10 Stage 1 gates, MCP contract preserved)
- **Live validation**: Ollama Cloud PASS; 9 other providers PENDING (credentials required)

See [CHANGELOG.md](https://github.com/abyssbugg/open-vision-mcp/blob/main/CHANGELOG.md) for full details."
```

---

## Phase R5 — Post-Publish Validation (Mandatory)

### R5.1 Verify the published package

```bash
# Create a clean test directory
mkdir /tmp/ovmcp-test && cd /tmp/ovmcp-test

# Install the published package
npx open-vision-mcp --version 2>&1 | head -1
# Or:
npm pack open-vision-mcp@2.1.0
tar -xzf open-vision-mcp-2.1.0.tgz
ls package/
# Verify: dist/, README.md, LICENSE, .env.example, package.json

# Run the server with a dummy key
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}' \
  | PROVIDER=openai API_KEY=dummy MODEL=gpt-4o timeout 5 node package/dist/index.js 2>&1 | head -5
# Expected: server starts, initialize response
```

### R5.2 Verify npm registry

```bash
npm view open-vision-mcp
# Verify: name, version, description, license, repository, keywords
```

### R5.3 Verify GitHub Release

```bash
gh release view v2.1.0
# Verify: tag, title, notes, assets
```

### R5.4 Verify README on npm

Go to `https://www.npmjs.com/package/open-vision-mcp` and verify:
- [ ] README renders correctly
- [ ] Provider table is visible
- [ ] Validation status is visible
- [ ] No broken badges
- [ ] No "placeholder" language

---

## Phase R6 — Post-Release (After Publish)

### R6.1 Release announcement

Announce the release in appropriate channels:

| Channel | Content |
|---|---|
| GitHub Discussions (Announcements) | Release announcement post with summary + link |
| GitHub Release | Already created in R4.2 |
| npm | Already published in R4.1 |
| Social media (optional) | Brief announcement with `npx open-vision-mcp` |

**GitHub Discussions announcement template:**

```markdown
# 🎉 open-vision-mcp v2.1.0 released

**open-vision-mcp** is a provider-neutral Vision MCP server that gives AI agents the ability to see and understand images using any of 10 inference providers.

## What it does

A Model Context Protocol (MCP) server for image analysis. Configure one provider, run the server, and your AI agent (Claude Code, Cursor, Cline, etc.) can analyze screenshots, photos, diagrams, webpages, and mobile app UIs.

## Supported providers

OpenRouter | OpenAI | Together | DeepInfra | Fireworks | Groq | Chutes | Cerebras | Azure OpenAI | Ollama

## Quick start

```bash
export PROVIDER=openrouter
export API_KEY=your-key
export MODEL=google/gemini-2.0-flash-exp:free
npx open-vision-mcp
```

## Install

```bash
npm install -g open-vision-mcp
```

## Links

- [npm](https://www.npmjs.com/package/open-vision-mcp)
- [GitHub](https://github.com/abyssbugg/open-vision-mcp)
- [README](https://github.com/abyssbugg/open-vision-mcp#readme)

## Validation

- 182/182 tests pass
- Ollama Cloud live-validated
- 9 other providers engineering-validated (live validation pending)
```

### R6.2 Maintenance checklist

Ongoing maintenance tasks:

| Task | Frequency | Priority |
|---|---|---|
| Monitor `npm audit` for new vulnerabilities | Monthly | Medium |
| Upgrade `vitest` to v4 (breaking — dev-only) | When stable | Low |
| Execute Stage 2 live validation when keys available | Opportunistic | Medium |
| Monitor GitHub Issues for bug reports | Weekly | High |
| Review PRs from contributors | As received | High |
| Update provider default URLs if APIs change | As needed | Medium |
| Update CHANGELOG for each release | Per release | High |
| Tag releases with semver | Per release | High |
| Monitor MCP SDK for breaking changes | Per SDK release | Medium |

### R6.3 Long-term support recommendations

| Recommendation | Rationale |
|---|---|
| Maintain `main` as the stable branch; use feature branches for development | Standard Git workflow |
| Tag every release (`vMAJOR.MINOR.PATCH`) | Enables `npm install open-vision-mcp@2.1.0` |
| Keep the phase reports in the repo | Engineering provenance; future contributors can understand the decisions |
| Do not delete `baseline/` | The immutable upstream reference; useful for diffing |
| Add CI (GitHub Actions) when a second contributor joins | Automates build+lint+test on PRs |
| Consider a `renovate.json` or `dependabot.yml` for dependency updates | Automates security patches |
| Document the "npm test exit code 1" issue in CONTRIBUTING.md | Prevents contributor confusion |
| Consider a `CODE_OF_CONDUCT.md` if the project grows beyond solo maintenance | Standard for community projects |
| Keep `OpenRouterConfig` interface removed (retired in V1) | Don't re-add; use `ProviderConfig` |
| Keep the ownership-boundary invariant documented in CONTRIBUTING.md | Prevents protocol leakage into shared infrastructure |

### R6.4 Semantic versioning strategy

| Change type | Version bump | Example |
|---|---|---|
| New provider (non-breaking) | Minor (2.x.0) | Adding Ollama → 2.1.0 |
| Bug fix | Patch (2.1.x) | Fixing a response-parsing edge case |
| Breaking change | Major (x.0.0) | Changing the env var schema (no legacy fallback) |
| New tool (MCP schema change) | Major (x.0.0) | Adding a 4th tool changes the MCP contract |
| Dependency upgrade (non-breaking) | Patch | axios 1.18.1 → 1.18.2 |
| Dependency upgrade (breaking) | Minor or Major | MCP SDK 1.29 → 2.0 |

**Rule:** if the MCP tool names or inputSchemas change, it's a major version bump. If a new provider is added (config-only or dedicated adapter), it's a minor bump. Everything else is a patch.

### R6.5 Future hardening (not Version 2, just maintenance)

| Item | Debt ID | Priority |
|---|---|---|
| Implement `RETRY_ATTEMPTS` | D8 | Low |
| Consolidate double timeout in `analyze-image.ts` | D9 | Low |
| Fix invalid base64 handling | D15 | Low |
| Upgrade `vitest` to v4 | — | Low (dev-only) |
| Upgrade `eslint` to v9 (flat config) | — | Low (dev-only) |
| Add GitHub Actions CI | — | Medium (when contributors join) |
| Add Dependabot/Renovate | — | Medium |

---

## Mandatory vs. Post-Release Summary

| Task | Phase | Mandatory before first publish? |
|---|---|---|
| Apply final package name + URLs | R1.1 | ✅ Yes |
| Remove key prefix from proposal doc | R1.2 | ✅ Yes |
| README polish | R1.3 | ✅ Yes |
| Create CHANGELOG.md | R1.4 | ✅ Yes |
| Verify LICENSE | R1.5 | ✅ Yes |
| Create CONTRIBUTING.md | R1.6 | ✅ Yes |
| Create SECURITY.md | R1.7 | ✅ Yes |
| Create GitHub repository | R2.1 | ✅ Yes |
| Push codebase + tags | R2.2 | ✅ Yes |
| Configure repository settings | R2.3 | ✅ Yes |
| Configure branch protection | R2.4 | ✅ Yes (if contributors) |
| Verify required files | R2.5 | ✅ Yes |
| Create issue templates | R2.6 | ✅ Yes |
| Create PR template | R2.7 | ✅ Yes |
| Enable Discussions | R2.8 | ❌ After |
| Final validation gate | R3.1 | ✅ Yes |
| npm publish dry-run | R3.2 | ✅ Yes |
| npm login | R3.3 | ✅ Yes |
| Create git tag v2.1.0 | R3.4 | ✅ Yes |
| npm publish | R4.1 | ✅ Yes |
| Create GitHub Release | R4.2 | ✅ Yes |
| Verify published package | R5.1 | ✅ Yes |
| Verify npm registry | R5.2 | ✅ Yes |
| Verify GitHub Release | R5.3 | ✅ Yes |
| Verify README on npm | R5.4 | ✅ Yes |
| Release announcement | R6.1 | ❌ After |
| Maintenance checklist | R6.2 | ❌ Ongoing |
| LTS recommendations | R6.3 | ❌ Ongoing |
| Semver strategy | R6.4 | ❌ Ongoing |
| Future hardening | R6.5 | ❌ Future |

---

## Execution Sequence

```
R1.1 Apply final name + URLs           ─┐
R1.2 Remove key prefix from proposal    │  Commits (can squash)
R1.3 README polish                      │
R1.4 Create CHANGELOG.md                │
R1.5 Verify LICENSE                     │
R1.6 Create CONTRIBUTING.md             │
R1.7 Create SECURITY.md                ─┘
         │
         ▼
R2.1 Create GitHub repo (gh repo create)
R2.2 Push code + tags (git push)
R2.3 Configure settings (web UI / gh api)
R2.4 Branch protection (web UI / gh api)
R2.5 Verify required files (ls)
R2.6 Create issue templates (mkdir .github/ISSUE_TEMPLATE)
R2.7 Create PR template (touch .github/PULL_REQUEST_TEMPLATE.md)
R2.8 Enable Discussions (web UI)
         │
         ▼
R3.1 Final validation gate (build + lint + tests + sentinel + schema + secrets + pack)
R3.2 npm publish --dry-run
R3.3 npm login
R3.4 git tag v2.1.0 + push tag
         │
         ▼
R4.1 npm publish
R4.2 gh release create v2.1.0
         │
         ▼
R5.1 Verify published package (npx in clean dir)
R5.2 Verify npm registry (npm view)
R5.3 Verify GitHub Release (gh release view)
R5.4 Verify README on npm (web check)
         │
         ▼
R6.1 Release announcement (GitHub Discussions)
R6.2+ Ongoing maintenance
```

---

## Pre-Release Checklist (Final Gate)

Before executing `npm publish`:

- [ ] Final name `open-vision-mcp` applied to `package.json` (name, bin, repository, bugs, homepage)
- [ ] Key prefix `<redacted-key-prefix>` removed from all docs
- [ ] README has no "placeholder" language; all URLs point to `abyssbugg/open-vision-mcp`
- [ ] CHANGELOG.md created with v2.1.0 entry
- [ ] LICENSE verified (MIT, correct year/name)
- [ ] CONTRIBUTING.md created
- [ ] SECURITY.md created
- [ ] GitHub repository `abyssbugg/open-vision-mcp` created
- [ ] Code pushed to GitHub (`git push -u origin main` + `git push --tags`)
- [ ] Repository settings configured (issues, discussions, releases enabled)
- [ ] Branch protection configured (if applicable)
- [ ] Issue templates created (`.github/ISSUE_TEMPLATE/`)
- [ ] PR template created (`.github/PULL_REQUEST_TEMPLATE.md`)
- [ ] `npm run build` exit 0
- [ ] `npm run lint` exit 0 (0 errors)
- [ ] Tests pass (JSON reporter: 182/182, 0 failures)
- [ ] Sentinel 8/8
- [ ] MCP tool names + schemas byte-identical to baseline
- [ ] No secrets in any tracked file
- [ ] `npm publish --dry-run` succeeds; package contains only dist/ + README + LICENSE + .env.example
- [ ] `npm whoami` shows the correct npm account
- [ ] Git tag `v2.1.0` created and pushed
- [ ] Ready to publish

---

**This is a release execution plan, not an engineering plan. No code changes beyond the naming/doc cleanup in R1. After R5 verification, the project is publicly released.**