# CORE KNOWLEDGE BASE

## OVERVIEW

Shared compatibility layer for content scripts and extension pages: mutable runtime state, browser storage, localization, identity, provider contracts, and constants.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Runtime song and UI lifecycle | `appState.ts` | One mutable singleton shared by lyric, observer, and UI flows. |
| Settings, cache, and expiry | `storage.ts` | Separates sync settings from local cache and durable values. |
| Identity, export, and request signatures | `keyIdentity.ts` | Browser WebCrypto P-256 identity and server-facing payload format. |
| Provider catalog and source keys | `constants.ts` | Ordered source registry used by settings and provider initialization. |
| Locale selection and translation | `i18n.ts` | Loads an optional catalog override before callers translate. |
| Generated locale-code union | `generated/locales.ts` | Output from `tooling/generate-locales.ts`. |

## CONVENTIONS

- Treat `AppState` as lifecycle state, not a persistence layer. Reset song-specific fields when `lastLoadedVideoId` changes.
- Abort stale fetch and injection work through `lyricAbortController`; create a new controller for each lyric lifecycle.
- Increment and compare `currentInjectionId` around async injection work. A result from an older ID must not mutate current lyrics.
- Keep `lastVideoId`, `lastLoadedVideoId`, `currentProviderKey`, `manualProviderKey`, and `availableProviderKeys` internally consistent.
- Put small user settings in `chrome.storage.sync`. Store caches, identity material, theme data, and durable per-song state in local storage.
- Cache keys use the `blyrics_` namespace. Transient values are `{ type: "transient", value, expiry }`, with expiry in epoch milliseconds.
- Use `setTransientStorage()` for expiring cache data and `setPersistentStorage()` for local values with `expiry: 0`. Both compress strings.
- Preserve `userIdentity`, `identityRegistered`, `userThemeRatings`, and `keyCertificate` in all cache or migration cleanup paths.
- Identity is an ECDSA P-256 key pair. `keyId` derives from the normalized public JWK, so changing normalization changes identity.
- Sign server payloads only through the canonical JSON serializer. It sorts object keys and omits `undefined`, matching server verification.
- Keep identity export version validation and the adjective, noun, action word lists stable. Pet names are deterministic from `keyId` and may be user-visible.
- `PROVIDER_CONFIGS` is the source-key registry. Keys, sync types, and numeric order are persisted user preferences and provider wiring contracts.
- Add providers by extending the typed key union and registry together. Priorities must remain contiguous and match the intended fallback order.
- Call `loadLocaleOverride()` during startup and after `uiLanguage` changes. `t()` first resolves that catalog, then falls back to `chrome.i18n` and finally the key.
- Locale overrides load from shipped `_locales/<locale>/messages.json`; unsupported or failed loads must clear the override.
- Regenerate `generated/locales.ts` from locale catalogs. It supplies `LOCALE_CODES` and must stay aligned with shipped directories.

## ANTI-PATTERNS

- Don't replace `AppState` with copied snapshots or bypass abort and injection-ID guards for asynchronous lyric work.
- Don't remove all local storage, all `blyrics_` keys, or expired items without retaining protected identity and rating keys.
- Don't treat `expiry: 0` as expired. It marks persistent local storage.
- Don't rename provider keys, reorder priorities, or change sync types without migration and downstream provider checks.
- Don't sign ordinary `JSON.stringify()` output or alter canonicalization, key hashing, P-256 parameters, or export version casually.
- Don't hand-edit `generated/locales.ts`, hardcode a locale list elsewhere, or translate before locale override initialization.
