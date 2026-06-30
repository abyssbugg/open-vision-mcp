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
- **Tests must pass:** JSON reporter shows 0 failures. Note: `npm test` may exit 1 due to a known vitest+Node 25 interaction with the sentinel subprocess; the JSON reporter is authoritative. Run `CI=true npx vitest run --reporter=json` for pass/fail counts.
- **Sentinel must pass:** `test/integration/mcp-server.test.ts` 8/8
- **MCP contract preserved:** tool names and inputSchemas must not change
- **No new runtime dependencies** without explicit justification

## Adding a New Provider

1. Add the provider id to `ProviderId` in `src/types/index.ts`
2. Add defaults to `PROVIDER_DEFAULTS` in `src/config/index.ts`
3. Add capabilities to `PROVIDER_CAPABILITIES` in `src/providers/factory.ts`
4. Add a `case` to `ProviderFactory.create`
5. If the provider is OpenAI-compatible: reuse `OpenAICompatibleProvider` (config-only entry)
6. If the provider has a unique API: create a dedicated adapter implementing `VisionProvider`
7. Add unit tests for the adapter
8. Add factory dispatch + capability tests to `test/unit/provider-factory.test.ts`
9. Add config default-resolution tests to `test/unit/config.test.ts`
10. Update `.env.example` and `README.md`
11. Update `CHANGELOG.md`

## Ownership Boundary

Each dedicated adapter (e.g., `OllamaProvider`, `AzureOpenAIProvider`) is the **single ownership boundary** for its provider's native protocol. All provider-specific request/response translation belongs in the adapter file only. Shared infrastructure (`OpenAICompatibleProvider`, `ProviderFactory`, `Config`, `types`, tool handlers) must remain protocol-neutral.

This means:
- Native request translation belongs only in the provider's adapter file
- Native response translation belongs only in the provider's adapter file
- Future provider-native capabilities should extend the adapter, not shared infrastructure

## Pull Request Process

1. Create a branch from `main`
2. Make small, focused commits with descriptive messages
3. Ensure build + lint + tests + sentinel are green
4. Open a PR with a description referencing any related issues
5. Wait for review

## License

By contributing, you agree that your contributions are licensed under the MIT license.