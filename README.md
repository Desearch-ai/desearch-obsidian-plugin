# Desearch Search for Obsidian

Search the web from Obsidian and open titled source links. Desktop Obsidian **1.15.1 or later**; plugin version **0.1.0**, MIT license.

## Install a local reviewed build

This repository is a local review candidate; no community listing or public release is claimed.

1. Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` using Node 24.
2. Create `<vault>/.obsidian/plugins/desearch-search/` in a disposable test vault. Copy `main.js`, `manifest.json`, and `LICENSE` into it (the package command includes these plus this README).
3. Restart Obsidian, enable community plugins, then enable **Desearch Search**.
4. In Settings → Desearch Search, enter your Desearch API key. Run **Desearch Search: Search web** from the command palette, enter a query, and press Search. Results open in your default browser.

## Privacy and service access

A Desearch API key and internet connection are required. Obtain your own key from [Desearch](https://console.desearch.ai). [Service details and pricing](https://desearch.ai) apply; this plugin does not grant free service or manage billing.

The key is held in memory only. Re-enter it after Obsidian reloads; use **Clear** to remove it during the session. It is sent only to `https://mcp.desearch.ai/mcp` as an authentication header. The explicit search query and MCP client metadata are sent to that endpoint. API usage may consume paid credits; see [pricing](https://desearch.ai/pricing). No notes, filenames, selected text, or vault content are read or automatically transmitted. There are no background searches, telemetry, remote scripts, or note edits. The key is never saved by the plugin; in-flight requests may finish after you clear it. Results are external web links; opening one sends a normal browser request to that source.

Missing keys prevent network calls. Rejected keys, rate limits, connectivity failures, and malformed responses show sanitized errors. A timed-out request can still complete on the service: the plugin suppresses late UI updates and never automatically retries a search. Close the modal to discard pending display updates.

The wrapper uses the released MCP `search` tool with `{query}` and accepts structured results or equivalent JSON text containing `{results:[{title,url}]}`. It handles JSON and completed SSE POST responses; it does not subscribe to server notifications. No core API or MCP service changes are included.

## Verification

`npm test` tests protocol handling and a DOM-based Obsidian API shim, including command/settings/modal behavior. That shim is not the native Obsidian host; native host verification is reported separately. `npm run live` reads `DESEARCH_QA_API_KEY` from the environment, checks missing/invalid credentials, and performs one real search. It prints only safe statuses and result titles/URLs. Never store a key in this repository or fixtures.

`npm run package` creates the local `artifacts/desearch-search-0.1.0.zip` package and SHA256 inventory. Use the exact commit and hashes in the review handover. Publishing, visibility changes, remote pushes, and PR creation require their separately recorded approval.

For independent desktop review, use a disposable vault, install the exact hashed package, enable the plugin, enter a review key in settings, search a public query and open a titled result. Clear the key and verify missing-key behavior, then try an invalid fixture key. Reload and verify the key is empty. Check that no `data.json` or credential file is created. Older Obsidian versions and mobile are untested.

The local native harness is `node scripts/desktop-smoke.mjs <fresh-directory> <official-Obsidian-binary>`. Supply its test key only through the credential runner. It creates a disposable profile and vault; do not run it while another Obsidian instance is open. Native smoke results are recorded separately from shim tests.
