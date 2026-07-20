# THEME MARKETPLACE

## OVERVIEW

Theme discovery, installation, updates, ratings, and compatibility live here. It serves both the compact Themes settings surface and the standalone marketplace page.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Bootstrap compact or full UI | `store.ts` | `initStoreUI()` initializes the settings panel. `initMarketplaceUI()` adds filters, URL permission UI, keyboard shortcuts, and infinite scroll. |
| Change installed-theme persistence | `themeStoreManager.ts` | Migrate the legacy array before reads. Per-theme records live in local storage, with a local index and a sync-stored active theme ID. |
| Fetch registry or GitHub themes | `themeStoreService.ts` | Resolve registry paths and builds, cache default branches, and validate URL repositories before installation. |
| Change ratings or install telemetry | `themeStoreApi.ts` | Validate IDs and ratings, sign requests, register identity keys when required, and retain returned certificates. |
| Change build compatibility | `themeBuildResolver.ts` | Select the highest build whose `minVersion` is met. No qualifying build returns `null`. |
| Update shared store shapes | `types.ts` | Keep registry metadata, resolved builds, installed themes, API results, and permission contracts aligned. |
| Bridge an applied theme to the editor | `../editor/features/themes.ts` | `store-theme-applied` maps URL themes to the editor's `github` source and marketplace themes to `marketplace`. |
| Adjust Turnstile verification | `turnstile.ts` | Owns the iframe lifecycle and pending token promise. |

## CONVENTIONS

- Treat `themeStoreManager.ts` as the persistence boundary. Call its public helpers instead of accessing storage keys directly.
- Preserve the migration gate. It runs once through a shared promise before installed-theme operations.
- Store large installed theme CSS and shader data in `chrome.storage.local`. Keep only the active store theme ID in sync storage.
- Registry installations resolve the authoritative build again at install time. Don't reuse listing-time file URLs.
- URL installs must parse the GitHub URL, check or request optional host access, validate required files, then fetch and install.
- Keep optional-host permission checks and the permission modal in the URL-install flow; browser manifests and platform enforcement can differ.
- `validateThemeRepo()` requires metadata, `style.rics` or `style.css`, description content, creators, version fields, shader flag, and a supported image or cover.
- Network failures in API and update paths are non-fatal. Log with `LOG_PREFIX_STORE`, return structured failures where defined, and leave the local theme usable.
- `trackInstall()` and `submitRating()` use signed identity payloads. Preserve public-key registration retries and certificate handling.
- On silent update, re-apply the active theme after its persisted record changes.
- Keep the compact and full flows behaviorally compatible. Full marketplace-only controls belong behind `initMarketplaceUI()`.
- `EXTENSION_PUBLIC_ENABLE_TEST_THEMES=true` enables deterministic synthetic cards for local marketplace UI work only.

## ANTI-PATTERNS

- Don't delete the legacy storage key before successful per-theme writes and index creation.
- Don't store full installed themes in sync storage or bypass quota errors during installation.
- Don't install a GitHub theme before repository validation or ignore a declined host-permission result.
- Don't treat an incompatible build as current. Render its compatibility state and require the existing confirmation flow.
- Don't send ratings or install events with unchecked IDs, ratings, signatures, certificates, or Turnstile tokens.
- Don't change version ordering assumptions. Resolver input can be unsorted and versions can have three or four parts.
- Don't sever `store-theme-applied`; the editor depends on its detail fields and source mapping.

## COMMANDS

```bash
npx tsx src/options/store/themeBuildResolver.selfcheck.ts
```

The self-check covers qualifying, boundary, unsorted, empty, and older-build resolver cases. It stubs `chrome.runtime` because the resolver imports extension constants.
