# LOCALE CATALOG GUIDE

## OVERVIEW

Chrome extension message catalogs. `en/messages.json` is the 395-key English source.

The 21 non-English catalogs are Crowdin outputs. Translate through Crowdin, not by editing them locally.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add or revise source copy | `en/messages.json` | Add `message` and specific English `description`. |
| Translate the extension | Crowdin project | Repository sync writes language catalogs. |
| Configure source and output paths | `../crowdin.yml` | Maps English to `%two_letters_code%`; Chinese has explicit directory mappings. |
| Explain translation workflow | `../CONTRIBUTING.md` | Translation Guide defines UI-space and placeholder rules. |
| Regenerate available locale types | `../tooling/generate-locales.ts` | Scans locale directories and writes `src/core/generated/locales.ts`. |
| Consume locale code types | `../src/core/generated/locales.ts` | Generated output, never edit directly. |

## CONVENTIONS

- Each `messages.json` is a Chrome message dictionary: key to object with `message` and `description`.
- All current catalogs contain 395 keys; keep every catalog's key set and entry structure aligned with English.
- Preserve every placeholder token in `message`, including `$1`, `$2`, `$NAME$`, `$TYPE$`, and `$date$`.
- Preserve `placeholders` objects, their `content` values, names, and examples from the source.
- Read each English `description` before translating. It is the string's UI context.
- Name new keys `<area>_<component>_<element>`, for example `options_tab_general` or `marketplace_install`.
- Match established casing within an area when a component name already uses camelCase.
- Keep labels short. A one-word source should stay one word when the target language allows it.
- Prefer natural, concise native terms over literal wording. UI space is limited.
- Keep product names, provider names, protocol names, and code-like terms intact unless there is a clear local convention.
- Crowdin maps ordinary languages to two-letter directory names. Use `zh_CN`, `zh_TW`, and `zh_HK` for its mapped Chinese variants.
- After adding or removing a locale directory, run the locale generator through the normal build, dev, preview, or typecheck command.

## ANTI-PATTERNS

- Don't hand-edit Crowdin-managed non-English catalogs. Syncs overwrite local changes.
- Don't add a key to only one language, rename an existing key, or reorder the schema for style.
- Don't delete `description`, `placeholders`, placeholder `content`, or examples from the English source.
- Don't translate, omit, reorder, or alter placeholder tokens.
- Don't expand compact labels into phrases when a concise native label exists.
- Don't hand-edit `src/core/generated/locales.ts`; regenerate it from the locale directories.
