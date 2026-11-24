# Backlog

Ideas from use, compared to the current app, then planned and shipped in small steps.

**Safety rules for every change:** don't lose stored data (schema changes go through a migration in `app.js`, with a backup taken first); bump `CACHE_NAME` in `sw.js` on every release; check old data still loads before pushing; never change the repo name or URL.

## Done

| # | Idea | Before | Change | Data impact |
|---|------|--------|--------|-------------|
| 1 | Only ask for weight on first launch; add a Weight button at the top | The prompt reappeared every launch unless you tapped Save. Closing it with ✕ didn't clear the first-run flag. | First-run flag clears as soon as the prompt shows. A **⚖️ Weight** button at the top right opens weight entry anytime (one entry per day; a second entry replaces the first). | None. Uses existing fields. |
| 2 | Modern monochrome icons, just shapes | Coloured emoji in the nav, Weight button and water counter | Inline SVG line icons in one colour, no image files. The water drops fill solid when ticked. | None |
| 2a | _(found while testing 2)_ Rest-timer bar covered the bottom nav | The hidden timer bar slid down over the nav, hiding the tabs | When hidden, the bar is now fully invisible and shows only while a timer is running | None |
| 3 | Pick water unit: litres or cups | Water always shown in litres (16 ticks of 250 ml = 4 L) | A Litres/Cups dropdown next to "Water" on Today. It only changes the label ("1.50 / 4 L" vs "6 / 16 cups"); each tick is still 250 ml ≈ 1 cup. Also fixed taps after the first one reading a stale count. | Schema v2 → v3: adds `settings.waterUnit` (default `L`). Water logs are unchanged. Pre-migration data is backed up automatically. |
| 3b | No litres: cups or ounces instead | Litres/Cups dropdown | Dropdown is now **Cups / Ounces** (default Cups). 1 drop = 1 cup = 8 oz; goal 16 cups / 128 oz. Diet note updated to match. | Schema v3 → v4: any saved unit other than cups/oz becomes `cups`. Water logs unchanged. |
| 4 | Set your own water goal; drops match the goal; + to go over | Fixed 16 drops (from `PLAN.waterGoalLitres`) | Tap the goal (e.g. "16 cups ✎") to edit it in your current unit (oz rounds to whole cups). One drop per cup of goal. Once you reach the goal: "Goal reached" plus a **+** button; extra cups show as dashed drops and can be tapped off. | Schema v4 → v5: adds `settings.waterGoalCups` (default 16). `PLAN.waterGoalLitres` removed. Water logs unchanged. |
| 5 | Make the meal checklist easier to tick off | Meals collapsed; tap to open, then tick 3–5 ingredients one by one. "Optional veg" had to be ticked for a meal to count. Reorder arrows on every meal. | One big circle per meal ticks the whole meal (tap again to undo). Ingredients always visible and still tickable one by one. Optional items don't block "done". "X of 5 eaten" with a progress bar, and the next meal highlighted. Reorder arrows only appear after tapping **Reorder**. | None. Same `mealLogs` format. |

## Planned

_(empty)_

## Ideas (not yet planned)

_(empty)_
