# Desearch Search for Obsidian

Search the web from Obsidian and open titled source links. Desktop Obsidian **1.15.1 or later**; plugin version **0.1.0**, MIT license.

## Build and install manually

1. Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` using Node 24.
2. Create `<vault>/.obsidian/plugins/desearch-search/` in a disposable test vault. Copy `main.js`, `manifest.json`, and `LICENSE` into it.
3. Restart Obsidian, enable community plugins, then enable **Desearch Search**.
4. In Settings → Desearch Search, enter your Desearch API key. Run **Desearch Search: Search web** from the command palette, enter a query, and press Search. Results open in your default browser.

## Privacy and service access

A Desearch account, API key and internet connection are required. Obtain your own key from [Desearch Console](https://console.desearch.ai). API usage may consume paid credits; see [current pricing](https://www.desearch.ai/pricing). This plugin does not grant free service or manage billing.

The key is held in memory only. Re-enter it after Obsidian reloads; use **Clear** to remove it during the session. It is sent only to `https://mcp.desearch.ai/mcp` as an authentication header. The explicit search query and MCP client metadata are sent to that endpoint. No notes, filenames, selected text, or vault content are read or automatically transmitted. The plugin has no background searches, client-side telemetry, remote scripts, or note edits. For information about data handled by the Desearch service, see the [Desearch Privacy Policy](https://www.desearch.ai/privacy).

The key is never saved by the plugin; in-flight requests may finish after you clear it. Results are external web links; opening one sends a normal browser request to that source.

Missing keys prevent network calls. Rejected keys, rate limits, connectivity failures, and malformed responses show sanitized errors. A timed-out request can still complete on the service: the plugin suppresses late UI updates and never automatically retries a search. Close the modal to discard pending display updates.

The wrapper uses the MCP `search` tool with `{query}` and accepts structured results or equivalent JSON text containing `{results:[{title,url}]}`. It handles JSON and completed SSE POST responses; it does not subscribe to server notifications.

## Development and verification

`npm test` tests protocol handling and a DOM-based Obsidian API shim, including command/settings/modal behavior. That shim is not the native Obsidian host. `npm run live` reads `DESEARCH_QA_API_KEY` from the environment, checks missing/invalid credentials, and performs one real search. It prints only safe statuses and result titles/URLs. Never store a key in this repository or fixtures.

`npm run package` creates `artifacts/desearch-search-0.1.0.zip` and a SHA256 inventory.

For desktop testing, use a disposable vault, install the package, enable the plugin, enter a test key in settings, search a public query and open a titled result. Clear the key and verify missing-key behavior, then try an invalid fixture key. Reload and verify the key is empty. Check that no `data.json` or credential file is created. Older Obsidian versions and mobile are untested.

The native harness is `node scripts/desktop-smoke.mjs <fresh-directory> <official-Obsidian-binary>`. Supply its test key through the environment. It creates a disposable profile and vault; do not run it while another Obsidian instance is open.

## Support

For help, use [Desearch support](https://www.desearch.ai/contact) or email support@desearch.ai. The plugin is licensed under [MIT](LICENSE).
