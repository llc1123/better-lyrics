# UI INJECTION KNOWLEDGE BASE

## OVERVIEW

This subtree owns the isolated-world UI layer inside YouTube Music: injected lyrics DOM, player observers, animation state, dock controls, and live custom CSS.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Render, clear, or clean lyrics DOM | `dom.ts` | Wrapper, loader, footer, artwork, Unison card, and song attributes. |
| Track player, tab, or fullscreen state | `observer.ts` | Long-lived YouTube Music listeners and lifecycle coordination. |
| Change lyric timing or scroll behavior | `animationEngine.ts` | Active state, CSS duration cache, rich sync, and passive scroll RAF. |
| Change the floating dock shell | `dom.ts` | Mounts in `#side-panel`; preserves its shell across ordinary re-injections. |
| Change dock controls or offsets | `lyricsDock/` | Controls compose UI; `offset.ts` owns delayed persistence and reticking. |
| Load or react to user and store CSS | `styleInjector.ts` | Resolves sync, local, and chunked storage, then updates one style element. |
| Verify public theme selectors | `STYLING.md`, `STYLING-SKILL.md`, `public/css/` | DOM classes, attributes, variables, and timing knobs are user contracts. |

## CONVENTIONS

- `observer.ts` establishes page-lifetime listeners once. Gate repeat setup with its existing initialization flags.
- Treat `AppState` as the cross-module lifecycle source. Reset UI state on song switch and reject stale async metadata by video ID or abort signal.
- `dom.cleanup()` owns per-song teardown: reset animation state, disconnect lyric observers, release lyric element references, restore native lyrics, and remove injected song UI.
- Disconnect every owned `MutationObserver` or `ResizeObserver`; remove document listeners and cancel RAFs or timers when their owning surface unmounts.
- `animationEngine.ts` owns selected and animating state, CSS timing variables, scroll queues, duration cache, and the passive scroll loop. Use its reset functions rather than partial DOM-only cleanup.
- The dock is split deliberately: `dom.ts` owns mounting, visibility, hover and proximity behavior; `lyricsDock/controls.ts` owns the replaceable controls segment.
- Keep the dock shell through provider switches and ordinary lyric re-injection. Unmount it only for disabled or unavailable dock states.
- `applyCustomStyles()` writes only `#blyrics-custom-style`, parses behavior knobs, and clears cached CSS durations. Keep storage decoding and theme-change handling in `styleInjector.ts`.
- Classes, IDs, data attributes, CSS variables, and DOM nesting used by themes are public. Update styling docs and shipped CSS with intentional contract changes.
- Style active lyric lines and words with `.blyrics--animating`. It is applied early and paired with timing variables. Reserve `.blyrics--active` for `:has()` queries, not direct visual styling.
- Preserve `.blyrics--pre-animating`, `.blyrics--paused`, `data-sync`, loader attributes, word timing attributes, and dock position modifiers when changing render paths.
- YouTube Music selectors and page attributes are fragile upstream dependencies. Centralize existing selectors, check nulls, and avoid broad DOM assumptions.

## ANTI-PATTERNS

- Don't remove native or injected nodes without undoing owned observers, listeners, timers, RAFs, and retained `AppState` element references.
- Don't recreate the dock for a provider switch or control refresh. Replace its controls segment in place so hover and expansion state survive.
- Don't attach duplicate page listeners, fullscreen callbacks, or storage subscriptions during reinjection.
- Don't set active visual CSS from `.blyrics--active`, rename documented selectors, or remove state attributes as an internal cleanup.
- Don't couple animation timing changes to CSS alone. Theme knobs and runtime timing caches must remain consistent.
- Don't rely on a YouTube Music selector without a missing-element path. Page layouts and attributes change independently of extension releases.
