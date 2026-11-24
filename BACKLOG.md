# Backlog

Ideas from use, compared to the current app, then planned and shipped in small steps.

**Safety rules for every change:** don't lose stored data (schema changes go through a migration in `app.js`, with a backup taken first); bump `CACHE_NAME` in `sw.js` on every release; check old data still loads before pushing; never change the repo name or URL.

## Done

| # | Idea | Before | Change | Data impact |
|---|------|--------|--------|-------------|
| 1 | Only ask for weight on first launch; add a Weight button at the top | The prompt reappeared every launch unless you tapped Save. Closing it with ✕ didn't clear the first-run flag. | First-run flag clears as soon as the prompt shows. A **⚖️ Weight** button at the top right opens weight entry anytime (one entry per day; a second entry replaces the first). | None. Uses existing fields. |
| 2 | Modern monochrome icons, just shapes | Coloured emoji in the nav, Weight button and water counter | Inline SVG line icons in one colour, no image files. The water drops fill solid when ticked. | None |
| 2a | _(found while testing 2)_ Rest-timer bar covered the bottom nav | The hidden timer bar slid down over the nav, hiding the tabs | When hidden, the bar is now fully invisible and shows only while a timer is running | None |

## Planned

_(empty)_

## Ideas (not yet planned)

_(empty)_
