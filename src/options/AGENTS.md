# OPTIONS AND EXTENSION PAGES

## OVERVIEW

`src/options/` owns the extension popup, options document, standalone page controllers, and the background worker.

## STRUCTURE

```text
src/options/
├── options.html / options.ts  # Shared popup and options UI
├── editor.ts                  # Standalone editor entry wrapper
├── marketplace.ts             # Marketplace entry wrapper
├── background.ts              # Manifest-declared worker and alarms
├── auth/                      # Extension auth-consent page
├── editor/                    # Child guide owns editor internals
├── store/                     # Child guide owns marketplace and theme store internals
└── unison/                    # Child guide owns Unison page internals
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Popup and options settings | `options.html`, `options.ts` | One document serves both extension action popup and `options_ui`. |
| Fullscreen editor shell | `pages/standalone-editor.html`, `editor.ts` | Wrapper starts the editor module. |
| Marketplace shell | `pages/marketplace.html`, `marketplace.ts` | Load base CSS, then store CSS. |
| Unison shell | `pages/unison.html`, `unison/unison.ts` | Load base CSS, then Unison CSS. |
| External auth consent | `pages/auth.html`, `auth/auth.ts` | Page renders consent, background owns auth sessions. |
| Background tasks and routing | `background.ts` | Theme alarms, migration, tab messages, background auth startup. |
| Declared browser paths | `manifest.json` | Source paths are manifest contracts, not arbitrary build outputs. |

## CONVENTIONS

* Keep `manifest.json`, page HTML, and controller paths aligned. A renamed or moved page needs every declared reference updated.
* `options.html` is both `action.default_popup` and `options_ui.page`. Its scripts compose settings, editor integration, and compact store UI.
* Standalone HTML owns markup and stylesheet order. Controllers own DOM initialization.
* Load `options.css` before domain CSS, such as `store/store.css` or `unison/unison.css`.
* On standalone pages, await `loadLocaleOverride()`, call `initI18n()`, then render. Keep the `i18n-ready` visibility gate intact.
* Keep small user settings in `chrome.storage.sync`. Put large CSS, installed themes, caches, and identity material in local or chunked storage, with sync metadata where required.
* Debounce settings writes when controls can change rapidly, since sync storage is quota limited.
* Options, pages, and workers log with their matching `LOG_PREFIX_*` constant through `console`.
* `auth/auth.ts` owns consent UI and its runtime port. `@modules/auth/backgroundAuth` owns session creation, validation, and background lifecycle.

## ANTI-PATTERNS

* Don't split popup and options behavior into separate documents without updating both manifest roles.
* Don't reverse shared and domain CSS order, or bypass the i18n bootstrap before rendering visible text.
* Don't store large theme CSS or identity data directly in sync storage.
* Don't put interactive consent or auth session state solely in the auth page. Preserve the page to worker ownership split.
* Don't bypass the worker for style application. It routes messages to eligible YouTube Music tabs.
* Don't add a standalone page without its HTML to controller script mapping and manifest resource review.
