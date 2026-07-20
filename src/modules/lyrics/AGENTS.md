# LYRICS DOMAIN GUIDE

## OVERVIEW

Provider responses become one normalized, millisecond-timed lyric model before injection into the YouTube Music lyrics tab.

## STRUCTURE

```text
lyrics/
├── lyrics.ts             # Fetch lifecycle, fallback selection, metadata, cache warmup
├── injectLyrics.ts       # Validation, DOM injection, stale-safe translation and romanization
├── providers/            # Source registry, streaming providers, and TTML/LRC/QRC parsers
├── requestSniffer/       # Isolated-world consumer for page-world YouTube request events
└── translation.ts         # Batched translation and romanization caches
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Change fetch or fallback flow | `lyrics.ts` | Fetch metadata, start YT fallback, select a matching provider, then inject. |
| Change normalized result types or cache | `providers/shared.ts` | `Lyric`, `LyricSourceResult`, source map, cache version and TTL path. |
| Add a streamed source | `providers/unified.ts` | One stream per video ID, source-specific waiters, SSE event parsing. |
| Add Unison formats | `providers/unison.ts` | Populate rich, synced, and plain slots together. |
| Parse timed formats | `providers/ttmlUtils.ts`, `lrcUtils.ts`, `qrcUtils.ts` | Preserve timing and rich parts where format supports them. |
| Change injection or language extras | `injectLyrics.ts`, `translation.ts` | Guard asynchronous DOM writes against stale injection IDs and aborts. |
| Change YT fallback metadata | `requestSniffer/`, `public/earlyInject.js` | Coupled DOM-event bridge and fragile YouTube response paths. |

## CONVENTIONS

- Runtime flow: sniff player metadata, normalize it, query metadata and providers, choose a validated result, then call `processLyrics()`.
- `startTimeMs` and `durationMs` are milliseconds everywhere. Convert provider seconds only at the boundary.
- A `Lyric` holds line timing, text, optional word or syllable `parts`, agent, translation, romanization, and instrumental state.
- TTML carries line or word timing, agents, translations, and timed romanization. `fillTtml()` selects exactly one rich or synced result.
- LRC handles timestamped lines and enhanced word timestamps. Plain text is unsynced, zero-timed lines only.
- QRC is rich word timing with singer extraction and instrumental-gap insertion. Pass song duration in milliseconds.
- Provider source keys require dual registration: extend the typed key and `PROVIDER_CONFIGS`, then add the source-map filler in `providers/shared.ts`.
- Registry priorities are persisted fallback order. Keep them contiguous and preserve the declared sync type.
- A filler must set its terminal source-map slots to `filled = true`, even for no result or malformed input. Otherwise callers can wait forever.
- Cache only completed, cache-allowed results under `blyrics_<videoId>_<source>`. Include and validate `LYRIC_CACHE_VERSION`.
- Unified SSE shares one active stream per video ID. Register waiters per source key, resolve them after caching, and resolve all remaining waiters when the stream ends or fails.
- Respect the supplied `AbortSignal` through fetches and polling. Check staleness before async translation or romanization mutates the DOM.
- Instrumental lines skip translation and romanization. Prefer provider-supplied translations or romanization, then caches, then batched requests.
- Reject a provider result when its aggregate text has weak similarity to the YT fallback. This protects against mismatched songs.
- The request sniffer consumes `blyrics-send-response` from `public/earlyInject.js`. YouTube payload shapes, tab positions, and event detail remain fragile integration boundaries.

## ANTI-PATTERNS

- Don't introduce seconds into normalized lyric objects, segment maps, QRC, or duration arithmetic.
- Don't report a source as filled before assigning its intended sibling slots. TTML and Unison have rich, synced, and plain result boundaries.
- Don't leave SSE waiters unresolved on token failure, network failure, stream completion, or abort.
- Don't let an early YT fallback overwrite a selected synchronized result, or let stale requests inject after a song change.
- Don't treat current YouTube response paths as stable API contracts. Make defensive shape checks and preserve fallback behavior.
- Don't translate instrumental markers, duplicate source text, or disabled source languages.
