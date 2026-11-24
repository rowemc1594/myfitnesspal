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
| 6 | Today should hold everything for the day, including meals | Today had week strip, workout and supplements/water; meals were only on the Meals tab | Today's meal checklist now sits on Today, between the workout and supplements/water. It's the same code as the Meals tab, so ticks show in both. The Meals tab keeps Reorder and the diet notes. | None |
| 7 | Meals take over Today; collapse them behind the progress card | All 5 meal cards always open on Today | On Today, meals show as one tappable card: "2 of 5 eaten · Up next: Meal 3" plus the progress bar and a chevron. Tap to open the list, tap again to close. Stays open while you tick; collapsed again next launch. The Meals tab is always open. | None |
| 8 | Show amounts in the daily checklist | Just "Fish oil", "Protein powder", "2 dill pickles" | Each item shows its amount underneath, matching the day type: fish oil 1 tsp (Meal 5); protein 45 g (Meal 4) on training days, 65 g (45 g Meal 2 + 20 g Meal 5) otherwise; 2 pickles. Amounts live in `plan.js` next to the meals. | None. Ticks keyed the same. |
| 9 | Today's Plan follows the weekday; missed workouts offered as catch-ups | No fixed schedule; "Start" suggested the first workout not yet done this week (so a missed Day 1 kept being suggested). **Changes a rule in the original brief.** | Weekly schedule Mon Day 1, Tue Day 2, Wed Dumbbell Complex, Thu Day 3, Fri Day 4, Sat/Sun Rest (`PLAN.schedule`). The big button starts today's scheduled workout. Earlier scheduled workouts not done this week appear under "Missed this week" with "Do Day X instead". "Pick a different workout ›" allows anything. If today's workout was already done earlier in the week, the first missed one becomes the default. Upcoming days show their scheduled workout in italics on the week strip. | None. Uses existing `workoutLogs`. |
| 10 | Week strip: green check for completed, red line through missed | Completed days had a green tint; missed days just showed "—" | Completed workout days get a green check under the label. Missed days get a red diagonal line and "Missed". Missed = a past day with nothing logged whose scheduled workout wasn't made up later that week. Today is never marked missed; rest days never are. | None |
| 11 | Describe each workout in the day picker | Picker listed just "Day 1", "Day 2"… | Each option has a one-line description underneath (e.g. Day 4: "Arms · biceps & triceps"). Same in the History editor and the Workouts dropdown, which also stopped repeating "Day 1 — Day 1 – Legs". Descriptions live in `PLAN.focus`. | None |

## Planned

_(empty)_

## Ideas (not yet planned)

- Let the weekly schedule be edited in the app (currently fixed in `plan.js`). Would need a `settings.schedule` migration.
- Do the workout on Today too (log sets inline instead of switching to the Workouts tab). Suggested earlier; fits #6.