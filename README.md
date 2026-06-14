# Jimaku extension for Hayase

Hayase extension that connects to [jimaku.cc](https://jimaku.cc) and fetches files matched by AniList ID.

## Install

1. Get a free API key: log in at jimaku.cc → **Account** → **Generate API key**.
2. In Hayase: **Settings → Extensions → Repositories**, paste:
   ```
   https://raw.githubusercontent.com/anzaldoignacio/jimaku-extension/refs/heads/main/index.json
   ```
   and click **Import Extensions**.
3. Open the Jimaku extension settings (gear icon) and paste your API key.

## Options

- **apiKey** — your jimaku.cc API key (required).
- **maxFiles** — max files loaded per episode (default 5).

## Development

```sh
node test/run.mjs
JIMAKU_API_KEY=... node test/run.mjs
```

## License

MIT © 2026 Ignacio Anzaldo — see [LICENSE](LICENSE).
