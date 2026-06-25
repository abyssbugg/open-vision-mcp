# PHASE 2B.5 — Multi-Provider Validation Plan

**Status:** Draft — awaiting approval
**Phase type:** Operational validation (not implementation, not architecture)
**Predecessor:** Phase 2B Completion Report (approved)
**Codebase under test:** Fork HEAD `2a3b5f9` (Phase 2B final)
**Providers in scope:** The six Phase 2B providers — `openrouter`, `openai`, `together`, `deepinfra`, `fireworks`, `groq`

---

## 0. Honest Scope Statement

A complete live validation requires valid API keys for each provider, which are not available in the current execution environment. This plan is therefore structured in **three tiers**:

- **Tier 1 — Keyless validation:** Executable immediately, without any API keys. Validates configuration resolution, request construction, MCP protocol behavior, error paths, legacy fallback, env-var handling, logging, and timeout behavior. Uses dummy keys and either observes the server's startup behavior or mocks HTTP at the axios layer.

- **Tier 2 — Single-key validation:** Executable with one real API key for any one provider. Validates the full end-to-end vision-analysis path (image → request → response → MCP tool output) for that one provider. Can be repeated per provider as keys become available.

- **Tier 3 — Full matrix validation:** Executable with real API keys for all six providers. Validates that the shared adapter produces correct vision analysis across the entire Phase 2B provider set under realistic conditions.

**Tier 1 is mandatory before Phase 2C.** Tier 2 is strongly recommended. Tier 3 is ideal but not blocking — it can be executed opportunistically as keys become available, and its results feed back into Phase 2C planning.

---

## 1. Validation Objectives

Validate that the Phase 2B provider-neutral architecture behaves correctly across every supported provider, collecting evidence that the abstraction works in real-world conditions before expanding the provider matrix.

Specifically:

1. **Configuration resolution is correct** for every `ProviderId` — new env vars, legacy env vars, per-provider defaults, and precedence all behave as specified.
2. **Request construction is provider-correct** — the HTTP body sent to `/chat/completions` is the OpenAI multimodal shape, with the right `baseURL`, `Authorization` header, and per-provider `extraHeaders`.
3. **MCP protocol behavior is preserved** — tool names, schemas, dispatch, and output shape are byte-identical to baseline regardless of provider.
4. **Legacy OpenRouter users experience zero behavior change** — the existing env-var path produces identical runtime behavior to Phase 1.
5. **Error paths are provider-aware** — errors identify the provider, not a hardcoded "OpenRouter".
6. **Timeout behavior is consistent** — the 120s axios timeout and the 120s `Promise.race` timeout in `analyze-image.ts` behave identically across providers.
7. **Image processing is provider-neutral** — the `ImageProcessor` path (base64, file, URL) works identically regardless of provider.
8. **Capability declaration is consistent** — all six providers report `{ jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' }`.
9. **Per-provider default `baseUrl` values are correct** — each default matches the provider's documented endpoint.
10. **Live vision analysis works** (Tier 2/3) — at least one provider returns a correct analysis of a test image end-to-end through the MCP `analyze_image` tool.

---

## 2. Test Environment

### 2.1 Codebase

- Fork root: `/Users/datamatics/desktop/open-image-mcp`
- Git HEAD: `2a3b5f9` (Phase 2B final commit)
- `baseline/` reference clone at upstream `c9c28d7` (immutable, for diffing)
- Build artifacts: `dist/` (produced by `npm run build`)
- Node: `v25.9.0` (the runtime used throughout the project)

### 2.2 Test fixtures

- **Test image:** a small PNG (~1KB) — the 1×1 red pixel PNG already used in the test suite:
  ```
  data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==
  ```
  For Tier 2/3 live tests, a more substantive image is used (see §4).

- **Test prompt:** `"What do you see in this image? Answer in one sentence."`

- **Dummy API key (Tier 1):** `dummy-key-xxxx` (any string; providers will reject with 401, which is the behavior under test)

### 2.3 API keys (Tier 2/3)

- Stored in environment variables per the Phase 2B `.env.example` schema.
- Never committed to git, never logged (the server already avoids logging keys — verify in §16).
- One key per provider being validated.
- Keys are the user's responsibility to obtain; this plan does not provide them.

### 2.4 Tools

- `node` (run the server)
- `python3` (parse JSON-RPC responses over stdio)
- `curl` (direct provider API calls for Tier 2/3 portability spikes)
- `npx vitest` (sentinel + any new validation tests)
- `jq` (env var / config inspection)
- `grep`, `diff` (static verification)

---

## 3. Test Matrix

| Test ID | Tier | Provider | Path | Gate |
|---|---|---|---|---|
| TM-01 | 1 | all 6 | Configuration resolution | Mandatory |
| TM-02 | 1 | all 6 | Request construction (dummy key, observe startup + first request) | Mandatory |
| TM-03 | 1 | all 6 | MCP `tools/list` returns 3 tools with correct schemas | Mandatory |
| TM-04 | 1 | openrouter | Legacy env-var fallback | Mandatory |
| TM-05 | 1 | openrouter | New env-var path | Mandatory |
| TM-06 | 1 | openai, together, deepinfra, fireworks, groq | New env-var path | Mandatory |
| TM-07 | 1 | all 6 | Error path: dummy key → provider-aware error message | Mandatory |
| TM-08 | 1 | all 6 | Timeout behavior: 120s axios + 120s Promise.race | Mandatory |
| TM-09 | 1 | all 6 | Image processing: base64, file, URL inputs | Mandatory |
| TM-10 | 1 | all 6 | Capability declaration consistency | Mandatory |
| TM-11 | 1 | all 6 | Per-provider default `baseUrl` correctness | Mandatory |
| TM-12 | 1 | all 6 | Logging validation (no key leakage, provider-aware) | Mandatory |
| TM-13 | 1 | openrouter | OpenRouter default `extraHeaders` sent | Mandatory |
| TM-14 | 1 | non-openrouter | No `HTTP-Referer`/`X-Title` sent | Mandatory |
| TM-15 | 1 | invalid id | Startup error lists valid providers | Mandatory |
| TM-16 | 1 | together, deepinfra, fireworks | Missing `MODEL` → clear error | Mandatory |
| TM-17 | 2 | any 1 | Full end-to-end vision analysis with real key | Recommended |
| TM-18 | 3 | all 6 | Full end-to-end vision analysis with real keys | Ideal |
| TM-19 | 1 | all 6 | Sentinel (`mcp-server.test.ts`) stays 8/8 | Mandatory |
| TM-20 | 1 | openrouter | Payload portability: OpenRouter body byte-identical to Phase 1 | Mandatory |

**20 test cases total.** 16 mandatory Tier-1 (keyless), 1 recommended Tier-2, 1 ideal Tier-3, 2 mandatory protocol/sentinel.

---

## 4. Provider-by-Provider Validation

For each of the six Phase 2B providers, the following table defines the per-provider test profile. Tier-1 columns are executable immediately; Tier-2/3 columns require a real key.

| Provider | Required config (Tier 1) | Required config (Tier 2/3) | Test image | Test prompt | Expected behavior (Tier 1) | Expected response (Tier 2/3) |
|---|---|---|---|---|---|---|
| `openrouter` | `PROVIDER=openrouter` `API_KEY=dummy` `MODEL=google/gemini-2.0-flash-exp:free` | + real `OPENROUTER_API_KEY` | 1×1 PNG (T1); substantive image (T2/3) | "What do you see…?" | Server starts; `tools/list` returns 3 tools; `analyze_image` call fails with provider-aware 401 error | 200 with `choices[0].message.content` describing the image |
| `openai` | `PROVIDER=openai` `API_KEY=dummy` `MODEL=gpt-4o` | + real `OPENAI_API_KEY` | same | same | same | same |
| `together` | `PROVIDER=together` `API_KEY=dummy` `MODEL=<required>` | + real `TOGETHER_API_KEY` + a vision model id | same | same | same; also: missing `MODEL` → clear startup error | same |
| `deepinfra` | `PROVIDER=deepinfra` `API_KEY=dummy` `MODEL=<required>` | + real `DEEPINFRA_API_KEY` + a vision model id | same | same | same; also: missing `MODEL` → clear startup error | same |
| `fireworks` | `PROVIDER=fireworks` `API_KEY=dummy` `MODEL=<required>` | + real `FIREWORKS_API_KEY` + a vision model id | same | same | same; also: missing `MODEL` → clear startup error | same |
| `groq` | `PROVIDER=groq` `API_KEY=dummy` `MODEL=llama-3.2-90b-vision-preview` | + real `GROQ_API_KEY` | same | same | same | same |

**Substantive test image (Tier 2/3):** a real photograph or screenshot, ~100–500KB, JPEG or PNG. The 1×1 PNG is too trivial for a meaningful vision-analysis validation. Suggested: a screenshot of a simple webpage with clear text and a button, so the vision model has something concrete to describe.

---

## 5. Configuration Validation

### 5.1 Per-provider default resolution (TM-01)

For each provider, set only `PROVIDER=<id>` and `API_KEY=dummy` (and `MODEL` where required), then start the server and inspect the resolved config via the startup log.

**Validation command pattern:**
```bash
PROVIDER=<id> API_KEY=dummy MODEL=<model-or-omit> LOG_LEVEL=debug \
  timeout 3 node dist/index.js 2>&1 | grep -E "Using model|baseUrl|provider"
```

**Pass criteria:**
- The resolved `baseUrl` matches `PROVIDER_DEFAULTS[<id>].baseUrl` exactly.
- The resolved `model` matches `PROVIDER_DEFAULTS[<id>].model` when defined, or the user-supplied `MODEL` otherwise.
- No startup errors for valid configs.

**Failure conditions:**
- Resolved `baseUrl` differs from the documented default.
- Server fails to start with a valid config.
- Default `model` is used when the user explicitly set `MODEL` (precedence violation).

### 5.2 Env-var precedence (TM-04, TM-05, TM-06)

**Test:** set both new and legacy env vars to distinguishable values; verify new wins.

```bash
OPENROUTER_API_KEY=legacy-key API_KEY=new-key PROVIDER=openrouter MODEL=legacy-model \
  timeout 3 node dist/index.js 2>&1 | grep -E "model|key"
```

**Pass criteria:**
- `API_KEY` takes precedence over `OPENROUTER_API_KEY`.
- `MODEL` takes precedence over `OPENROUTER_MODEL`.
- `BASE_URL` takes precedence over `OPENROUTER_BASE_URL`.
- Per-provider default is used only when both new and legacy are unset.

### 5.3 Invalid provider id (TM-15)

```bash
PROVIDER=invalid API_KEY=dummy timeout 3 node dist/index.js 2>&1 | grep -i "unknown provider"
```

**Pass criteria:**
- Server exits with a clear error.
- Error message lists the valid provider ids: `openrouter, openai, together, deepinfra, fireworks, groq`.

### 5.4 Missing required model (TM-16)

```bash
PROVIDER=together API_KEY=dummy timeout 3 node dist/index.js 2>&1 | grep -i "MODEL.*required"
```

**Pass criteria:**
- Server exits with: `MODEL environment variable is required for provider 'together'`.
- Same for `deepinfra` and `fireworks`.

### 5.5 Missing API key (TM-07 partial)

```bash
unset API_KEY OPENROUTER_API_KEY; PROVIDER=openai timeout 3 node dist/index.js 2>&1 | grep -i "API_KEY.*required"
```

**Pass criteria:**
- Server exits with: `API_KEY environment variable is required (or the legacy OPENROUTER_API_KEY).`

---

## 6. Authentication Validation

### 6.1 Authorization header (TM-02, TM-13, TM-14)

The adapter constructs the axios client with `'Authorization': \`Bearer ${config.apiKey}\``. Validate that the header is sent correctly by intercepting the outgoing request.

**Tier-1 method:** use a network capture or a mock axios instance. The simplest keyless approach is to point `BASE_URL` at a local capture server that logs incoming headers:

```bash
# Start a tiny header-capture server on port 8899
python3 -c "
from http.server import BaseHTTPRequestHandler, HTTPServer
import json, sys
class H(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)
        print('HEADERS:', dict(self.headers), file=sys.stderr)
        print('BODY:', body.decode()[:500], file=sys.stderr)
        self.send_response(401); self.send_header('Content-Type','application/json'); self.end_headers()
        self.wfile.write(b'{\"error\":{\"message\":\"dummy 401\"}}')
    def log_message(self, *a): pass
HTTPServer(('localhost', 8899), H).serve_forever()
" 2>/tmp/captured-headers.log &
CAPTURE_PID=$!

# Run the server pointed at the capture server
PROVIDER=openrouter API_KEY=dummy MODEL=google/gemini-2.0-flash-exp:free \
  BASE_URL=http://localhost:8899/v1 LOG_LEVEL=debug \
  timeout 5 node dist/index.js 2>&1 | grep -E "Analyzing|Sending|API Error"

# Inspect captured headers
cat /tmp/captured-headers.log | grep -E "Authorization|HTTP-Referer|X-Title"
kill $CAPTURE_PID
```

**Pass criteria:**
- `Authorization: Bearer dummy` is present.
- For `PROVIDER=openrouter`: `HTTP-Referer: https://github.com/openrouter-image-mcp` and `X-Title: OpenRouter Image MCP` are present.
- For `PROVIDER=openai|together|deepinfra|fireworks|groq`: `HTTP-Referer` and `X-Title` are **absent**.

### 6.2 Per-provider default `baseUrl` correctness (TM-11)

Static validation — cross-check each default against the Phase 2A evidence table:

```bash
grep -A 2 "openrouter:\|openai:\|together:\|deepinfra:\|fireworks:\|groq:" src/config/index.ts | grep baseUrl
```

**Pass criteria (from Phase 2A §2):**
- `openrouter`: `https://openrouter.ai/api/v1`
- `openai`: `https://api.openai.com/v1`
- `together`: `https://api.together.xyz/v1`
- `deepinfra`: `https://api.deepinfra.com/v1/openai`
- `fireworks`: `https://api.fireworks.ai/inference/v1`
- `groq`: `https://api.groq.com/openai/v1`

---

## 7. Request Validation

### 7.1 Request body shape (TM-02, TM-20)

The request body sent to `/chat/completions` must be the OpenAI multimodal shape, byte-identical for OpenRouter vs Phase 1 (TM-20) and structurally identical across all six providers (TM-02).

**Tier-1 method:** use the local capture server from §6.1 and inspect the POST body.

**Expected body (from `src/providers/openai-compatible.ts:135-156`):**
```json
{
  "model": "<configured model>",
  "messages": [{
    "role": "user",
    "content": [
      {"type": "text", "text": "<prompt>"},
      {"type": "image_url", "image_url": {"url": "data:image/png;base64,<data>"}}
    ]
  }],
  "max_tokens": 4000,
  "temperature": 0.1,
  "response_format": {"type": "json_object"}  // only when format=json
}
```

**Pass criteria:**
- Body matches the expected shape for every provider.
- `model` field matches the configured `MODEL`.
- `max_tokens` is 4000 (default) or the user-supplied value (capped at 8000).
- `temperature` is 0.1 (default) or the user-supplied value.
- `response_format` is present only when `format=json`; absent otherwise.
- The `data:image/png;base64,…` URL is correctly formed.

**TM-20 (OpenRouter byte-identical to Phase 1):** diff the captured body (with `PROVIDER=openrouter`) against the body the Phase 1 `OpenRouterClient` would have sent. Since the method bodies were moved verbatim, they should be byte-identical. Verify by:
```bash
diff <(sed -n "/const requestBody = /,/};/p" baseline/src/utils/openrouter-client.ts) \
     <(sed -n "/const requestBody = /,/};/p" src/providers/openai-compatible.ts)
```
**Pass criteria:** zero diff in the `requestBody` construction block.

### 7.2 Endpoint path (TM-02)

The adapter posts to `/chat/completions` (relative to `baseURL`). Verify:
```bash
grep "this.client.post" src/providers/openai-compatible.ts
```
**Pass criteria:** the path is `'/chat/completions'` — no provider-specific path manipulation.

---

## 8. Response Validation

### 8.1 Response parsing (Tier 2/3 — TM-17, TM-18)

With a real API key, call `analyze_image` and verify the response shape.

**Validation command (Tier 2, single provider):**
```bash
export PROVIDER=openai API_KEY=<real-key> MODEL=gpt-4o LOG_LEVEL=info
# Encode a test image
B64=$(base64 < test-image.png | tr -d '\n')
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"v","version":"1"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"analyze_image\",\"arguments\":{\"type\":\"base64\",\"data\":\"$B64\",\"mimeType\":\"image/png\",\"prompt\":\"What do you see? Answer in one sentence.\"}}}" \
  | timeout 30 node dist/index.js 2>/dev/null | python3 -c "
import sys, json
for line in sys.stdin:
    try: m=json.loads(line)
    except: continue
    if m.get('id')==2:
        r=m.get('result',{})
        print('isError:', r.get('isError', False))
        c=r.get('content',[])
        if c: print('content[0].text:', c[0].get('text','')[:200])
"
```

**Pass criteria:**
- `isError` is `false` or absent.
- `content[0].text` is a non-empty string that plausibly describes the image.
- For `format=json` mode, the text is valid JSON (or falls back to text with a `structuredData.analysis` wrapper — verify the fallback path).

### 8.2 Empty / malformed response handling (TM-07)

Using the local capture server, return a response with empty `choices` and verify the error path:
```python
self.wfile.write(b'{"choices":[]}')  # capture server returns this
```
**Pass criteria:** `analyze_image` returns `isError: true` with `"No response from model"`.

---

## 9. Error Handling Validation

### 9.1 Provider-aware error messages (TM-07)

The adapter's `extractErrorMessage` produces `"<provider> API Error: <message>"`. Verify for each provider:

```bash
# For each provider, point at the capture server returning a 401
for P in openrouter openai together deepinfra fireworks groq; do
  PROVIDER=$P API_KEY=dummy MODEL=google/gemini-2.0-flash-exp:free \
    BASE_URL=http://localhost:8899/v1 LOG_LEVEL=error \
    printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"v","version":"1"}}}' \
    '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
    "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"analyze_image\",\"arguments\":{\"type\":\"base64\",\"data\":\"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==\",\"mimeType\":\"image/png\"}}}" \
    | timeout 5 node dist/index.js 2>/dev/null | python3 -c "
import sys, json
for line in sys.stdin:
    try: m=json.loads(line)
    except: continue
    if m.get('id')==2:
        r=m.get('result',{})
        c=r.get('content',[{}])[0].get('text','')
        print(f'$P:', c[:120])
"
done
```

**Pass criteria:**
- Each error message contains the provider id: `"openrouter API Error: …"`, `"openai API Error: …"`, etc.
- No message says "OpenRouter API Error" when `PROVIDER != openrouter`.

### 9.2 Network error (TM-07)

Point `BASE_URL` at an unreachable host and verify a clean error:
```bash
PROVIDER=openai API_KEY=dummy MODEL=gpt-4o BASE_URL=http://nonexistent.invalid/v1 \
  timeout 5 node dist/index.js 2>/dev/null | python3 -c "..."
```
**Pass criteria:** `analyze_image` returns `isError: true` with a network-related error message (not a crash, not a stack trace to the user).

---

## 10. Timeout Behavior (TM-08)

### 10.1 Static verification

The adapter sets `timeout: 120000` (120s) on the axios instance. The tool handler in `src/tools/analyze-image.ts` wraps the call in `Promise.race` with a 120s timeout.

**Validation:**
```bash
grep "timeout:" src/providers/openai-compatible.ts
grep "Promise.race\|setTimeout" src/tools/analyze-image.ts
```
**Pass criteria:**
- axios timeout is 120000ms.
- `Promise.race` timeout is 120000ms.
- Both are consistent across providers (the adapter and tool handler are provider-agnostic).

### 10.2 Live timeout (Tier 2 — optional)

Point `BASE_URL` at a server that accepts the connection but never responds. Verify the request times out at ~120s (not sooner, not later).

**Pass criteria:** the error message mentions timeout; the elapsed time is ~120s ± 5s.

---

## 11. Image Upload Validation (TM-09)

### 11.1 Input types

The `ImageProcessor` supports `base64`, `file`, and `url` inputs. Validate each:

**base64:**
```bash
# as in §8.1
```

**file:**
```bash
# Save the test PNG to a temp file
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" | base64 -d > /tmp/test.png
# Pass type=file, data=/tmp/test.png
```

**url:**
```bash
# Host the test image on a local server, pass type=url, data=http://localhost:PORT/test.png
```

**Pass criteria:**
- All three input types produce the same `data:image/png;base64,…` URL in the request body (after `ImageProcessor` normalization).
- Invalid base64 → clear error.
- Non-existent file → clear error.
- Unreachable URL → clear error (within 30s — the `ImageProcessor` URL-fetch timeout).

### 11.2 MIME detection

`ImageProcessor` uses signature-based detection (no native deps). Verify:
```bash
grep -A 20 "detectFromSignature" src/utils/image-processor.ts | grep -E "jpeg|png|gif|webp"
```
**Pass criteria:** JPEG, PNG, GIF, WebP signatures are detected. Provider-agnostic (no provider-specific MIME handling).

---

## 12. MCP Compatibility Validation (TM-03, TM-19)

### 12.1 Tool list (TM-03)

For each provider, verify `tools/list` returns the same 3 tools with the same schemas:
```bash
for P in openrouter openai together deepinfra fireworks groq; do
  PROVIDER=$P API_KEY=dummy MODEL=google/gemini-2.0-flash-exp:free LOG_LEVEL=error \
    printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"v","version":"1"}}}' \
    '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
    '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
    | timeout 5 node dist/index.js 2>/dev/null | python3 -c "
import sys, json
for line in sys.stdin:
    try: m=json.loads(line)
    except: continue
    if m.get('id')==2:
        tools=m['result']['tools']
        print(f'$P:', [t['name'] for t in tools])
"
done
```

**Pass criteria:**
- Every provider returns `['analyze_image', 'analyze_webpage_screenshot', 'analyze_mobile_app_screenshot']`.
- Tool schemas are byte-identical across providers (diff the `inputSchema` of each tool across runs).

### 12.2 Sentinel (TM-19)

```bash
/tmp/sentinel-check.sh
```
**Pass criteria:** `SENTINEL: 8/8 pass, 0 fail`. The sentinel uses legacy env vars, so this also re-confirms TM-04.

### 12.3 Schema byte-identity vs baseline (TM-03)

```bash
diff <(sed -n "/const tools: Tool\[\]/,/return { tools };/p" baseline/src/index.ts) \
     <(sed -n "/const tools: Tool\[\]/,/return { tools };/p" src/index.ts)
```
**Pass criteria:** zero diff.

---

## 13. Legacy Environment Variable Validation (TM-04)

### 13.1 Pure legacy path

Set only `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` (no new vars). Verify the server starts and behaves identically to Phase 1.

```bash
unset PROVIDER API_KEY MODEL BASE_URL EXTRA_HEADERS
OPENROUTER_API_KEY=dummy OPENROUTER_MODEL=google/gemini-2.0-flash-exp:free LOG_LEVEL=error \
  printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"v","version":"1"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | timeout 5 node dist/index.js 2>/dev/null | python3 -c "
import sys, json
for line in sys.stdin:
    try: m=json.loads(line)
    except: continue
    if m.get('id')==2:
        print('legacy path tools:', [t['name'] for t in m['result']['tools']])
"
```

**Pass criteria:**
- Server starts without error.
- `PROVIDER` resolves to `openrouter` (the default).
- 3 tools listed.
- The OpenRouter default `extraHeaders` are applied (verify via the capture server in §6.1).

### 13.2 OpenRouter default `baseUrl` applied

When `OPENROUTER_BASE_URL` is unset and `BASE_URL` is unset, the server uses `https://openrouter.ai/api/v1`. Verify via the startup log or by inspecting the resolved config.

### 13.3 OpenRouter default `extraHeaders` applied (TM-13)

Via the capture server (§6.1) with `PROVIDER=openrouter` and only legacy env vars set, verify `HTTP-Referer` and `X-Title` are present with the exact values from `PROVIDER_DEFAULTS.openrouter.extraHeaders`.

---

## 14. New Environment Variable Validation (TM-05, TM-06)

### 14.1 Each provider via new env vars

For each provider, set only the new env vars (no legacy) and verify startup + `tools/list`:
```bash
for P in openrouter openai together deepinfra fireworks groq; do
  PROVIDER=$P API_KEY=dummy MODEL=google/gemini-2.0-flash-exp:free LOG_LEVEL=error \
    printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"v","version":"1"}}}' \
    '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
    '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
    | timeout 5 node dist/index.js 2>/dev/null | python3 -c "
import sys, json
for line in sys.stdin:
    try: m=json.loads(line)
    except: continue
    if m.get('id')==2:
        print(f'$P:', [t['name'] for t in m['result']['tools']])
"
done
```

**Pass criteria:** every provider lists 3 tools.

### 14.2 `EXTRA_HEADERS` override

```bash
PROVIDER=openai API_KEY=dummy MODEL=gpt-4o \
  EXTRA_HEADERS='{"X-Custom":"test-value"}' \
  # run via capture server, verify X-Custom header is present
```

**Pass criteria:** the custom header is sent; `HTTP-Referer`/`X-Title` are absent (OpenAI has no default `extraHeaders`).

### 14.3 `EXTRA_HEADERS` malformed JSON

```bash
PROVIDER=openai API_KEY=dummy MODEL=gpt-4o EXTRA_HEADERS='{not-json}' \
  timeout 3 node dist/index.js 2>&1 | grep -i "EXTRA_HEADERS.*not valid JSON"
```

**Pass criteria:** clear startup error mentioning `EXTRA_HEADERS` and "not valid JSON".

---

## 15. Performance Observations

Performance is not a gate, but observations are collected for Phase 2C planning context.

### 15.1 Startup time (Tier 1)

```bash
for P in openrouter openai together deepinfra fireworks groq; do
  T=$( { time PROVIDER=$P API_KEY=dummy MODEL=google/gemini-2.0-flash-exp:free LOG_LEVEL=error \
    timeout 3 node dist/index.js >/dev/null 2>&1; } 2>&1 | grep real )
  echo "$P: $T"
done
```

**Observation target:** startup time per provider. Expected: <2s for all (no provider-specific startup work — the adapter is uniform).

### 15.2 Request latency (Tier 2/3)

For each provider with a real key, measure `analyze_image` latency on the same test image and prompt:
```bash
T=$( { time <run TM-17 command>; } 2>&1 | grep real )
```

**Observation target:** record latency per provider. No pass/fail — informational for Phase 2C.

### 15.3 Image processing throughput (Tier 1)

```bash
# Process the same image 100 times via ImageProcessor
# (would require a small benchmark harness — out of scope for the plan;
# record as an automated validation opportunity in §18)
```

---

## 16. Logging Validation (TM-12)

### 16.1 No API key leakage

Run the server with `LOG_LEVEL=debug` and grep all log output for the API key:
```bash
export PROVIDER=openai API_KEY=sk-test-SECRET-KEY MODEL=gpt-4o LOG_LEVEL=debug
timeout 5 node dist/index.js 2>&1 | grep -i "sk-test-SECRET-KEY" && echo "FAIL: key leaked" || echo "PASS: no key leakage"
```

**Pass criteria:** zero occurrences of the API key in log output.

### 16.2 Provider-aware log strings

The adapter logs `Sending request to ${provider} API` and `Failed to connect to ${provider} API`. Verify:
```bash
PROVIDER=openai API_KEY=dummy MODEL=gpt-4o LOG_LEVEL=debug timeout 3 node dist/index.js 2>&1 | grep -E "Sending request|Failed to connect" | head -5
```

**Pass criteria:** log lines mention the actual provider (`openai`), not `OpenRouter`.

### 16.3 Caveat — startup log strings still say "OpenRouter"

The startup logs in `index.ts` (lines 22, 241, 247, 250, 252) still say "Starting OpenRouter Image MCP Server", "OpenRouter Image MCP Server started successfully", "Testing OpenRouter API connection…", etc. This is **known deferred debt** (Phase 2B commit 5 intentionally left these; §9 of the Phase 2B completion report documents it).

**Validation behavior:** record these as observations, not failures. They will be addressed in Phase 2C per the recommended adjustments.

---

## 17. Manual Test Procedures

### 17.1 Tier-1 full sweep (no keys, ~30 min)

Execute in order:
1. TM-19: sentinel
2. TM-01: per-provider default resolution (6 providers × startup log inspection)
3. TM-15: invalid provider id
4. TM-16: missing required model (3 providers)
5. TM-07 partial: missing API key
6. TM-11: per-provider default `baseUrl` static check
7. TM-13/TM-14: `extraHeaders` via capture server (openrouter present, others absent)
8. TM-02/TM-20: request body capture + OpenRouter byte-identity diff
9. TM-03: `tools/list` for each provider
10. TM-04: legacy env-var path
11. TM-05/TM-06: new env-var path per provider
12. TM-07: provider-aware error messages (6 providers)
13. TM-08: timeout static check
14. TM-09: image input types (base64, file, url)
15. TM-10: capability declaration static check
16. TM-12: logging — no key leakage, provider-aware log strings
7–9 require the local capture server running in a separate terminal.

### 17.2 Tier-2 single-provider live (one key, ~15 min)

1. Obtain a real API key for one provider.
2. Choose a substantive test image.
3. Execute the TM-17 command.
4. Record: `isError`, `content[0].text`, latency.
5. Repeat with `format=json` and verify JSON parsing.
6. Repeat with `analyze_webpage_screenshot` and `analyze_mobile_app_screenshot` tools.

### 17.3 Tier-3 full matrix (six keys, ~90 min)

Repeat §17.2 for each of the six providers. Record results in a matrix table.

---

## 18. Automated Validation Opportunities

The plan is manual-first, but several tests could be automated in Phase 3:

1. **Config resolution tests** — unit tests that set env vars and assert `Config.getProviderConfig()` returns the expected shape for each provider.
2. **Factory dispatch tests** — unit tests that call `ProviderFactory.create` with each `ProviderId` and assert the returned instance is an `OpenAICompatibleProvider` with the expected `capabilities`.
3. **Request body shape tests** — unit tests with a mocked axios that capture the request body and assert it matches the expected OpenAI multimodal shape for each provider.
4. **`extraHeaders` tests** — unit tests that assert OpenRouter gets its default headers and other providers don't.
5. **Error message tests** — unit tests that trigger each error path and assert the provider id appears in the message.
6. **Legacy fallback tests** — unit tests that set only legacy env vars and assert the resolved config matches the new-var path.
7. **Image processor tests** — already exist (`test/unit/image-processor.test.ts` passes at baseline); extend with URL-input tests.

**Recommendation:** defer all of these to Phase 3 (test repair). Phase 2B.5 is manual validation; automating it would blur the phase boundary.

---

## 19. Pass/Fail Criteria

### 19.1 Mandatory gates (Tier 1)

Phase 2B.5 passes if ALL of the following hold:

| Gate | Test IDs | Criterion |
|---|---|---|
| G1 — Configuration | TM-01, TM-04, TM-05, TM-06, TM-15, TM-16 | All config resolution, precedence, fallback, and error cases behave per spec |
| G2 — Request | TM-02, TM-20 | Request body is the OpenAI multimodal shape for every provider; OpenRouter body byte-identical to Phase 1 |
| G3 — MCP protocol | TM-03, TM-19 | 3 tools listed with byte-identical schemas for every provider; sentinel 8/8 |
| G4 — Auth/headers | TM-13, TM-14 | OpenRouter gets `HTTP-Referer`/`X-Title`; others don't |
| G5 — Error handling | TM-07 | Errors are provider-aware (no "OpenRouter" in non-OpenRouter errors); no key leakage |
| G6 — Image processing | TM-09 | base64, file, URL inputs all work; MIME detection provider-agnostic |
| G7 — Timeouts | TM-08 | 120s axios + 120s Promise.race consistent across providers |
| G8 — Capabilities | TM-10 | All 6 providers report `{jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens'}` |
| G9 — Base URLs | TM-11 | Each default `baseUrl` matches Phase 2A evidence table |
| G10 — Logging | TM-12 | No API key in logs; provider-aware log strings in the adapter |

### 19.2 Recommended gates (Tier 2)

| Gate | Test IDs | Criterion |
|---|---|---|
| G11 — Live vision (single) | TM-17 | At least one provider returns a correct vision analysis end-to-end through `analyze_image` |

### 19.3 Ideal gates (Tier 3)

| Gate | Test IDs | Criterion |
|---|---|---|
| G12 — Live vision (matrix) | TM-18 | All 6 providers return correct vision analyses |

### 19.4 Failure criteria

Phase 2B.5 fails if any mandatory gate (G1–G10) does not hold. In that case:
- Produce a failure report identifying the gate, the test case, the observed behavior, and the expected behavior.
- Do not proceed to Phase 2C planning until the failure is analyzed and resolved.
- If the failure indicates a Phase 2B regression, roll back to the last green commit and re-plan.

---

## 20. Evidence to Collect

For each test, collect:

1. **Command** — the exact shell command executed.
2. **Environment** — env vars set.
3. **Output** — stdout/stderr (relevant excerpts).
4. **Result** — pass/fail + observed behavior.
5. **Timestamp** — when executed.
6. **Codebase SHA** — `git rev-parse HEAD` (should be `2a3b5f9`).

**Evidence storage:** a `PHASE-2B.5-VALIDATION-RESULTS.md` file in the workspace root, structured as a table per gate. Each row is a test case with the five fields above.

**Specific artifacts to preserve:**
- Captured HTTP headers (from §6.1) for each provider.
- Captured request bodies (from §7.1) for each provider.
- The OpenRouter byte-identity diff output (TM-20).
- Sentinel output (TM-19).
- At least one successful Tier-2 vision analysis response (if executed).

---

## 21. Completion Criteria

Phase 2B.5 is complete when ALL of the following hold:

1. All mandatory gates (G1–G10) are verified pass, with evidence collected in `PHASE-2B.5-VALIDATION-RESULTS.md`.
2. Tier-2 (G11) is either verified pass OR explicitly marked "deferred — no key available" with a note for opportunistic execution.
3. Tier-3 (G12) is either verified pass OR explicitly marked "deferred — no keys available" with a note for opportunistic execution.
4. The `PHASE-2B.5-VALIDATION-RESULTS.md` file is committed (or staged) with all evidence.
5. A Phase 2B.5 Summary is produced answering:
   - Did the abstraction work in real-world conditions (Tier 1)?
   - Did it work end-to-end (Tier 2, if executed)?
   - Did it work across the full matrix (Tier 3, if executed)?
   - Are there any regressions vs Phase 2B?
   - Is Phase 2C still necessary, and are the Phase 2C recommended adjustments still valid?
6. No code was modified during Phase 2B.5 (enforced — this is a validation phase, not an implementation phase).
7. `baseline/` remains immutable.

---

## 22. Decision After Phase 2B.5

Upon completion, one of three decisions:

1. **Proceed to Phase 2C planning** — all mandatory gates pass; the abstraction is validated; Phase 2C scope (Chutes, Cerebras, Azure) remains as recommended.
2. **Proceed to Phase 2C planning with adjustments** — mandatory gates pass but evidence reveals a Phase 2C scope change (e.g., a provider behaves differently than Phase 2A predicted).
3. **Do not proceed — re-plan** — a mandatory gate failed, indicating a Phase 2B regression or an abstraction gap. Roll back, analyze, re-plan before any Phase 2C work.

---

## 23. Approval Checklist

Before execution begins, confirm:

- [ ] §1 Validation objectives match intent.
- [ ] §2 Test environment is correct (codebase at `2a3b5f9`).
- [ ] §3 Test matrix (20 cases, 16 mandatory Tier-1) is acceptable.
- [ ] §4 Provider-by-provider profiles are correct.
- [ ] §5–§16 validation procedures are executable and sufficient.
- [ ] §19 Pass/fail criteria (10 mandatory gates) are the correct bar.
- [ ] §20 Evidence collection is sufficient.
- [ ] §21 Completion criteria are correct.
- [ ] The three-tier structure (keyless / single-key / full-matrix) is acceptable given the key-availability constraint.
- [ ] Tier 2 (G11) and Tier 3 (G12) are correctly classified as recommended/ideal, not mandatory.

---

**Awaiting approval. No validation is executed and no code is modified until this plan is authorized.**