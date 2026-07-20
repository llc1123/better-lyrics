# UNISON PAGE GUIDE

## OVERVIEW

Standalone community lyrics page. `unison.ts` is intentionally thin: locale override, i18n, then `initUnisonPage()` after `DOMContentLoaded`.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Page shell and stable element IDs | `pages/unison.html` | Loads base options CSS, then `unison.css`, then the module entrypoint. |
| Page routing, state, events, and rendering | `unisonPage.ts` | Owns feed, search, detail, submit, previews, and DOM updates. |
| Page styling | `unison.css` | Domain layer for `.unison-*` classes, after `../options.css`. |
| API operations and request signing | `@modules/unison/unisonApi` | Owns public API calls, identity signing, registration retry, and error results. |
| Shared wire types and filters | `@modules/unison/types` | Change API-facing shapes here, not in the page controller. |
| Server error-code mirror | `@modules/unison/errorCodes` | Keep aligned manually with the Unison server. |
| Local request-demand cache | `@modules/unison/lyricsRequestTracker` | Local storage only, pruned to 500 entries. |

## CONVENTIONS

- Route from `URLSearchParams`: `submit=true`, `id`, `v`, `q`, then `tab=mine|recent`.
- Use `navigateTo()` plus `popstate`, never ad hoc view changes that leave the URL stale.
- Feed state is per tab: document fragment, cursor, filters, loaded/loading flags, scroll position, and request ID.
- Save the active tab before switching; restore its fragment and scroll state after switching.
- Pagination is cursor based. `#unison-feed-more` is the sentinel and may load when within 200px of the viewport.
- Protect async feed updates with the tab request ID. Don't append stale results after filters or tabs change.
- `unisonPage.ts` renders and coordinates. `src/modules/unison/` owns transport, signing, identity registration, shared types, and domain errors.
- Public feeds personalize with `X-Key-ID` when identity exists. My submissions requires it. Mutations use signed requests.
- Vote clicks toggle the same vote off. Preserve `userVote` UI state only after a successful result.
- Delete is a two-click, four-second confirmation. Treat `NOT_FOUND` as completed deletion; show `NOT_OWNER` distinctly.
- Reports use the fixed `ReportReason` set and disable the action after a successful submission.
- Build all UI with DOM nodes, `textContent`, `append`, and `replaceChildren`. Keep lyrics and metadata out of `innerHTML`.
- Preview LRC, plain text, and TTML safely. Strip LRC timestamps, parse TTML to text, and cap previews at 100 lines.
- Auto-detect `lrc`, `ttml`, or `plain` only when format remains `auto`; submission validates song, artist, video ID, and lyrics.
- Submission accepts dropped `.lrc`, `.ttml`, `.xml`, and `.txt` files, then refreshes preview, format, and language detection.
- Keep `IS_DEV`, `DEV_STUB_BASE`, and stub entries local development scaffolding. Never make shipped behavior depend on them.

## ANTI-PATTERNS

- Don't put API URLs, signing, registration recovery, or server error decoding in `unisonPage.ts`.
- Don't share one feed cache across Recent and My submissions, or reset a tab's fragment and scroll on a harmless tab switch.
- Don't replace URL-query routing with hash state, or bypass `routeFromParams()` when history changes.
- Don't paginate with offsets or add duplicate load triggers outside the sentinel path.
- Don't optimistically mutate vote, report, or delete UI before the signed API result succeeds.
- Don't weaken `target="_blank"` links by omitting `rel="noreferrer noopener"`.
- Don't reverse CSS order in `pages/unison.html`; base options rules must load before Unison overrides.
