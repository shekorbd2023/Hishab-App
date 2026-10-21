# Hishab — Deploy to Web + Android APK + Windows .exe

The whole app is one Next.js codebase. The website is the source of truth; the Android
APK is a thin wrapper around the live URL, and the Windows .exe bundles the same app to
run offline on a PC.

## 0. Run it locally first (optional)
```bash
npm install
NODE_OPTIONS=--experimental-sqlite npm run dev      # Node 22 needs the flag
# open http://localhost:3000  → Sign up (tick "Load demo data")
```
Node 24+ does not need the `NODE_OPTIONS` flag (node:sqlite is stable there).

## 1. Push to GitHub
`gh` device-flow login (no browser prompt in a terminal):
```bash
curl -sS -X POST https://github.com/login/device/code -H 'Accept: application/json' \
  -d 'client_id=178c6fc778ccc68e1d6a' -d 'scope=repo workflow'
# enter the user_code at https://github.com/login/device, then poll:
# https://github.com/login/oauth/access_token  → export GH_TOKEN=...
gh auth setup-git
gh repo create hishab --private --source=. --push
```

## 2. Deploy the website on Railway (permanent URL)
1. railway.app → **New Project → Deploy from GitHub repo** → pick `hishab`.
2. Railway detects the `Dockerfile` and builds automatically.
3. **Add a Volume mounted at `/data`** (Settings → Volumes). *Critical* — the SQLite
   database lives here; without it data resets on every deploy.
4. Settings → Networking → **Generate Domain** (port 3000). That URL is your live site.

Railway redeploys on every push to `main`.

## 3. Android APK
1. Edit `capacitor-wrapper/capacitor.config.json` and `capacitor-wrapper/www/index.html`
   — replace `REPLACE-WITH-YOUR-RAILWAY-URL...` with your real Railway URL. Commit & push.
2. GitHub → Actions → **Build Android APK** → Run workflow.
3. Download from the `apk-latest` release:
   `https://github.com/<you>/hishab/releases/download/apk-latest/Hishab.apk`
4. Install on any Android phone (allow "unknown sources"). Because it loads the live
   site, UI changes appear on next app open — no reinstall.

> Tip: to keep source private but the installer shareable, move `capacitor-wrapper/` and
> `.github/workflows/build-apk.yml` into a separate **public** repo.

## 4. Windows .exe (auto-updating)
**First install:** download `Hishab-Setup.exe` from the `exe-latest` release
(`https://github.com/shekorbd2023/Hishab-App/releases/download/exe-latest/Hishab-Setup.exe`)
and run it. Data is stored in the Windows user profile, so it survives updates and reinstalls.

**Releasing an update (no reinstall on the PC):**
1. Bump `"version"` in `package.json` **and** `electron/package.json` (e.g. `0.3.1`), commit.
2. `git tag v0.3.1 && git push origin main v0.3.1`
3. The **Build Windows EXE** workflow builds the installer and publishes release `v0.3.1`
   (with `latest.yml`). Every installed copy (0.3.0 or newer) checks for it on start and every
   4 hours, downloads it in the background, and asks "Restart now / Later". "Later" installs it
   when the app is closed.

Notes: the repo must stay **public** (the updater reads GitHub Releases without a token), and
the versioned release must be the repo's "Latest" release — the `exe-latest`/`apk-latest`
releases are created with `--latest=false` for that reason. Update log: `%APPDATA%/Hishab/hishab.log`.

## Notes
- Secrets/keys never go in git (`.gitignore` covers `data/`, `.env`, build outputs).
- To back up a business: **Reports → Backup & Restore → Export full business (JSON)**.
- High-risk areas (money math, auth, restore) are covered by the derived-balance logic in
  `src/lib/domain.ts`; review before relying on it for real accounting.
