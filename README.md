# myfitnesspal

Personal 4-day lifting + diet tracker. Installable, fully offline PWA. Vanilla HTML/CSS/JS, no build step, no backend. All data lives in your browser's localStorage.

## Files

- `plan.js` — all plan data (workouts, warm-ups, meals, diet notes). Edit this to change the program.
- `app.js` — storage, migrations, date/week logic, rest timer, app shell.
- `screens/` — Today, Workouts, Meals, History, bodyweight chart.
- `sw.js` — cache-first service worker (app files only).
- `gen-icons.js` — regenerates `icons/*.png` (`node gen-icons.js`, no dependencies).

## Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Repo **Settings → Pages**.
3. **Source:** "Deploy from a branch". **Branch:** `main`, folder `/ (root)`. Save.
4. Wait a minute, then open `https://<your-username>.github.io/<repo-name>/`.
5. On your phone: open that URL, then **Add to Home Screen** (iOS Safari: Share → Add to Home Screen; Android Chrome: menu → Install app).

All paths are relative, so it works from the `/<repo-name>/` subpath.

## ⚠️ Never change the URL

Browser storage is tied to the site's origin. **Once you're using the app, never rename the repo, change the GitHub username, or move it to a custom domain.** Doing so gives the app a new address with empty storage, and your history will appear to be gone (it's still at the old URL until the browser clears it). If you must move, export a backup first, then import it at the new URL.

## Backups

History screen → **Export** downloads a JSON file. **Import** restores one (your current data is saved to a restore slot first). The app reminds you if you haven't exported in 14 days. iOS can evict storage for sites you don't use for a while, so export regularly.

## Updating the app

After changing any app file, bump `CACHE_NAME` in `sw.js` (e.g. `tracker-v47`) **and** `BUILD` in `app.js` to the same number, so phones fetch the new version and the header shows it (e.g. "b47"). The service worker only manages cached app files; it never touches your data.

## Changing the data format

User data is stored under one key (`trackerData_v1`) with a `schemaVersion`. To change the format:

1. Increase `SCHEMA_VERSION` in `app.js`.
2. Append a function to `migrations` that upgrades the previous version's data. Never remove or reorder existing migrations.
3. Never rename or delete storage keys without a migration.

The pre-migration data is copied to `trackerData_backup` automatically before any migration runs.

## Run locally

```powershell
npx http-server -p 8080 -c-1 .
```

Then open http://localhost:8080.
