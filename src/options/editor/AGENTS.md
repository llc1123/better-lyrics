# EDITOR DOMAIN GUIDE

## OVERVIEW

The theme editor owns RICS source editing, compilation, persistence, provenance, and live application.
It runs embedded in options and as `pages/standalone-editor.html`; both surfaces share this controller.

## STRUCTURE

```text
editor/
├── index.ts                 # DOM bootstrap and embedded/standalone detection
├── core/
│   ├── editor.ts            # CodeMirror state, extensions, debounce limits
│   └── state.ts             # Serialized async editor operation queue
├── features/
│   ├── compiler.ts          # RICS compilation cache and diagnostics
│   ├── storage.ts           # CSS persistence, recovery, apply broadcast
│   ├── themes.ts            # Theme selection, edits, and provenance changes
│   ├── import.ts            # `.rics` import/export and downloads permission
│   └── syntax.ts            # CodeMirror-only RICS presentation extensions
└── ui/                      # Cached DOM handles, dialogs, toast feedback
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Bootstrap either editor surface | `index.ts` | Standalone enables search; embedded does not. |
| Change operation ordering | `core/state.ts` | Route import, content replacement, and related async work through `queueOperation()`. |
| Change CodeMirror behavior | `core/editor.ts`, `features/syntax.ts` | Keep RICS lexer, linter, color, and bracket logic inside CodeMirror. |
| Change compile semantics | `features/compiler.ts` | The compiler owns time limits, diagnostics, valid-state caching, and raw-source fallback. |
| Change CSS storage | `features/storage.ts` | Preserve sync, local, chunked, compression, metadata, and recovery together. |
| Change editor theme lifecycle | `features/themes.ts` | Built-in, custom, marketplace, and URL provenance have distinct transitions. |
| Change file interchange | `features/import.ts` | `.rics` is the editor interchange format; downloads permission stays optional. |

## CONVENTIONS

- Preserve one `EditorStateManager` instance. Its FIFO queue prevents import, save, and programmatic content changes from racing.
- Use `setEditorContent()` for replacements so programmatic updates don't become user edits and cursor behavior stays explicit.
- Compile RICS at the compiler boundary only. Reuse a matching valid compilation, retain diagnostics, and fall back to source CSS when invalid.
- Save source RICS, not only compiled output. Invalid source can still be broadcast so the runtime has a graceful CSS fallback.
- Select storage from final payload size: direct sync, local with sync metadata, or sync chunking. Keep `cssStorageType`, `cssCompressed`, chunks, and stale copies consistent.
- Compress large payloads before strategy selection. On quota failure, retry with chunked storage before reporting failure.
- Loading must honor recorded strategy, then recover through chunked, local, and sync paths; decompress when the flag or payload requires it.
- After a successful write, broadcast `{ action: "applyStyles", ricsSource, storageType }` to the background worker.
- A manual edit clears built-in and store theme names. Editing a custom theme debounces its theme save; don't collapse these provenance transitions.
- Map store provenance as `marketplace` or `github` only for editor badges. Keep source badges synchronized with selection state.
- Export requests `downloads` only at click time. If declined or unavailable, keep the Blob-anchor fallback.
- Put syntax additions in `features/syntax.ts` and wire them through `createEditorState()`, never into runtime style application.

## ANTI-PATTERNS

- Don't bypass the state queue for imports, theme clears, or content replacement.
- Don't treat embedded and standalone DOM contracts as interchangeable; optional controls must remain optional.
- Don't persist one storage copy while leaving stale chunks, flags, or alternate copies authoritative.
- Don't reject an edit solely because RICS diagnostics exist; preserve source and retain the compiler's CSS fallback behavior.
- Don't request `downloads` during startup or import.
- Don't add RICS syntax parsing or lint decisions outside CodeMirror extensions.
