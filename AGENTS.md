# PROJECT KNOWLEDGE BASE

**Generated:** 2026-07-20
**Commit:** fbaa41f
**Branch:** master

## OVERVIEW

Better Lyrics is a Manifest V3 extension for Chrome, Edge, and Firefox. Extension.js bundles strict TypeScript, main-world JavaScript bridges, browser pages, CSS, and locale catalogs into platform builds.

## STRUCTURE

```text
better-lyrics/
├── manifest.json          # Canonical entrypoint, permission, CSP, and resource map
├── src/
│   ├── index.ts           # Isolated-world YouTube Music content-script bootstrap
│   ├── core/              # Shared state, storage, i18n, identity, constants
│   ├── modules/           # Lyrics, injected UI, settings, auth, Unison domains
│   └── options/           # Popup, background worker, editor, store, standalone-page logic
├── public/                # Main-world scripts and shipped runtime CSS/assets
├── pages/                 # Standalone auth, editor, marketplace, and Unison HTML entries
├── _locales/              # Browser locale catalogs; English is Crowdin source
├── tooling/               # Separate NodeNext build, release, publish, and generation scripts
└── .github/workflows/     # Build, auto-fix, release, and platform republish pipelines
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Change extension entrypoints or permissions | `manifest.json` | Paths point directly at TS/JS/HTML build inputs |
| Change content-script startup | `src/index.ts` | `modify()` composes runtime initialization |
| Change page-world interception/player bridge | `public/earlyInject.js`, `public/script.js` | Communicates with isolated code through `blyrics-*` DOM events |
| Change shared contracts | `src/core/` | Constants, storage schemas, i18n, identity signing, mutable app state |
| Add/fix lyric sources or parsing | `src/modules/lyrics/` | Provider registry, normalized timing, cache, translation, request sniffing |
| Change injected YouTube Music UI | `src/modules/ui/` | DOM lifecycle, animation engine, observers, dock, style injection |
| Change popup/settings | `src/options/options.html`, `src/options/options.ts` | Popup and options UI share one document |
| Change standalone extension pages | `pages/`, `src/options/` | HTML lives at root; controllers live under `src/options/` |
| Change themes/editor/marketplace | `src/options/editor/`, `src/options/store/` | Bidirectional integration through editor storage/application contracts |
| Change translations | `_locales/en/messages.json`, `crowdin.yml` | Non-English catalogs are Crowdin-managed |
| Change build/release behavior | `extension.config.cjs`, `tooling/`, `.github/workflows/` | Tooling has its own `tooling/tsconfig.json` |
| Change public theme CSS contracts | `STYLING.md`, `STYLING-SKILL.md`, `public/css/` | Docs define selectors, attributes, and theme variables |

## CODE MAP

| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|
| `modify` | function | `src/index.ts` | bootstrap | Initializes content-side services on `DOMContentLoaded` |
| `AppState` | mutable singleton | `src/core/appState.ts` | 11 modules | Current song, abort lifecycle, provider and UI state |
| `PROVIDER_CONFIGS` | registry | `src/core/constants.ts` | cross-domain | Provider identity, labels, ordering, and capabilities |
| `createLyrics` | function | `src/modules/lyrics/lyrics.ts` | runtime path | Metadata, cache, provider selection, rendering handoff |
| `processLyrics` | function | `src/modules/lyrics/injectLyrics.ts` | runtime path | Normalized lyric validation and DOM injection |
| `initProviders` | function | `src/modules/lyrics/providers/shared.ts` | startup | Loads priority and binds source keys to providers |
| `initializeLyrics` | function | `src/modules/ui/observer.ts` | startup | Consumes player events and coordinates song changes |
| `initStoreUI` / `initMarketplaceUI` | functions | `src/options/store/store.ts` | two pages | Compact theme UI and full marketplace bootstrap |
| `initUnisonPage` | function | `src/options/unison/unisonPage.ts` | page entry | Unison feed, search, detail, voting, and submission UI |

TypeScript LSP/reference tooling is unavailable in this workspace; reference counts above come from indexed import analysis where stated.

## CONVENTIONS

- Use npm and keep `package-lock.json`; local baseline is Node 18+, CI uses Node 20.
- Use named imports and established aliases: `@core/*`, `@constants`, `@utils`, `@modules/*`, `@options/*`.
- TypeScript is strict with bundler resolution and verbatim module syntax.
- Biome owns TS/JS formatting: 2 spaces, LF, 120 columns, double quotes, semicolons, ES5 trailing commas.
- `npm run lint` writes fixes. CI may auto-commit Biome and Knip fixes on trusted branches.
- Content scripts log through `log()` plus constants; extension/options pages use prefixed console logging.
- Build, dev, preview, and typecheck scripts regenerate `src/core/generated/locales.ts` first.
- Keep inline comments rare; section dividers use `// -- Section Name --------------------------`.

## ANTI-PATTERNS (THIS PROJECT)

- Never import from `@/index`; doing so executes the content-script composition root in the wrong context.
- Never use `innerHTML`; construct DOM with `createElement`, `textContent`, and `replaceChildren`.
- Never leave empty `catch` blocks; log failures with enough context for the active execution world.
- Never hand-edit `src/core/generated/locales.ts` or remove generated `extension-env.d.ts` from TypeScript inputs.
- Never bulk-delete protected identity, certificate, rating, or install storage keys.
- Do not move logic across isolated-world/main-world boundaries without preserving the DOM-event bridge.
- Do not reformat Biome-excluded generated/legacy documentation opportunistically.
- Do not modify All Contributors managed blocks in `README.md`.

## UNIQUE STYLES

- The same feature may span `manifest.json`, top-level `pages/`, `src/options/`, and `public/`; trace the declared entry before moving files.
- `chrome.storage.sync` is quota-limited settings state; large CSS, installed themes, caches, and identity material use local/chunked storage contracts.
- Main-world scripts intentionally avoid TS imports because they execute in the YouTube Music page context.
- Base options CSS is reused by standalone editor, marketplace, and Unison pages; domain CSS layers after it.

## COMMANDS

```bash
npm install
npm run dev                 # Chrome watch mode; persistent profile under dist/chrome-profile
npm run dev:firefox         # Firefox watch mode
npm run typecheck           # Generates locales, then tsc --noEmit
npm run lint                # Mutates files: Biome lint --write + format --write
npm run knip                # Entry-aware dead-code/export analysis
npm run build               # dist/chrome, dist/edge, dist/firefox
npm run build:release       # Versioned ZIPs; removes unpacked platform directories afterward
npx tsx src/options/store/themeBuildResolver.selfcheck.ts
```

## NOTES

- There is no test runner or test directory. The theme build resolver self-check is the only executable behavioral check.
- Standard production builds disable source maps; canary/CI paths retain, patch, and optionally upload them.
- `EXTENSION_PUBLIC_ENABLE_TEST_THEMES=true` enables synthetic marketplace themes locally.
- Stable releases use `X.Y.Z`; canaries begin `X.Y.Z.N`. Release workflows synchronize version fields, tag, publish stores, and create a draft GitHub release.
