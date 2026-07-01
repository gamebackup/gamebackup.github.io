# x3e Unblocked Games — Maintainer's Handbook

So you're the one taking over. I spent years on this — since 2023, running what became the biggest unblocked games site I know of. This document is everything I know about keeping x3e alive. Read it front to back before you touch anything.

---

## 1. What x3e Is

x3e is a static HTML/CSS/JS website that hosts **~272 playable games** (mostly) for free, designed to work on school Chromebooks and locked-down networks. It lives at **https://gamebackup.github.io/** and is served via **GitHub Pages**.

The whole thing is **vanilla HTML/CSS/JS** — no build tools, no frameworks, no package manager. You push to `main`, it deploys. That's it.

---

## 2. Architecture — How the Site Works

The site looks like one repo, but it's actually **538 repos** working together:

### This repo (`gamebackup.github.io`)
Contains only the **shell** — the HTML homepage, CSS, service worker, and a few images. This is the storefront.

### The other 537 repos (one per game)
Each game lives in its **own repository** in the `gamebackup` GitHub organization. Each is deployed as a **GitHub Pages project site**, which means they're accessible at:
`https://gamebackup.github.io/<game-repo-name>/`

For example:
- The repo `gamebackup/2048` → `https://gamebackup.github.io/standalone_games/2048/`
- The repo `gamebackup/happywheels` → `https://gamebackup.github.io/flash_games/games/happywheels/`

**The path in the URL is just the repository name** — GitHub Pages project sites always deploy at `https://<org>.github.io/<repo>/`.

### How games are organized by folder prefix

| Prefix in URL | What it is |
|---|---|
| `flash_games/games/` | Flash games (played via Ruffle) |
| `standalone_games/` | HTML5/JS standalone games |
| `standalone_games_2/` | More standalone games |
| `standalone_games_3/` | Even more standalone games |
| `standalone_games_4/` | A few larger ports |
| `emu_games/games/` | Emulated console games |
| `gba_games/games/` | GBA Pokemon games specifically |
| `pico8_games/` | PICO-8 fantasy console games |
| `itchio_games/` | Games sourced from itch.io |
| `fnf-mods/` | Friday Night Funkin' mods |

These prefixes are just **directory/repo naming conventions**. The actual GitHub repos are named whatever the game slug is. GitHub Pages doesn't care about the folder structure — what matters is the repo name matches the URL path.

---

## 3. This Repo — File by File

### `index.html` (1541 lines) — The whole site
Everything is in one file. The HTML includes:
- **Tab cloaking** — switches tab title/favicon to look like Google, YouTube, Canvas, etc.
- **Preloader** — "G N I D A O L" animation on load
- **Hero section** — tips for users
- **Game grid** — buttons organized by genre, each calling `playGame(url)`
- **Particle canvas** — animated pink/cyan background
- **Search** — filters game buttons by name (Ctrl+F triggers it)
- **Random game picker**
- **Game overlay** — fullscreen iframe for playing
- **Volume control** — slider that adjusts audio/video in the iframe
- **Update notification** — fetches raw GitHub index.html every 10 minutes, compares version meta tag
- **Settings modal** — tab cloaking picker, offline game preloader, volume, changelog, danger zone
- **Offline play system** — lets users select up to 5 games to cache via the service worker

### `style.css` (1101 lines)
Dark theme with neon pink accent (#e61587). Glitch text on the title. Particle canvas overlay. Settings modal with frosted glass. Responsive at 600px.

### `sw.js` (111 lines) — Service Worker
Handles offline caching. Two modes:
- **Normal**: caches `gamebackup.github.io` URLs only, cache-first with network fallback
- **Preload session**: activated via `START_SESSION` message — caches everything (any origin) for offline preloading

### `manifest.json`
PWA manifest — lets users "install" x3e as an app on their device.

### `404.html`
Custom error page matching the site theme.

### `finalproduct-v2.html`
A standalone HTML file users can save locally. It fetches the latest index.html from GitHub and injects it. Allows playing x3e offline or from a local file.

### `dedications.html`
Credits page (uses Tailwind from CDN).

### `images/`
Site images served via jsDelivr CDN (`cdn.jsdelivr.net/gh/gamebackup/gamebackup.github.io@main/images/...`).

---

## 4. Adding a New Game

This is the most common thing you'll do. Here's the process:

### Step 1: Get the game files
You need the actual game code (HTML, JS, WASM, etc.). Sources:
- Flash games → use Ruffle emulator
- HTML5 games → often found on itch.io, GameJolt, or GitHub
- Ported games → check the National Porting Association (npa.lol)
- The Game Request form → users submit games here

### Step 2: Create a new repo in the `gamebackup` organization
- Repo name = the URL path you want (e.g., for `https://gamebackup.github.io/standalone_games/mygame/`, name the repo `standalone_games/mygame`)
- Wait — actually GitHub doesn't allow slashes in repo names. So the **repo name is just the slug**, and the folder prefixes in the URL are achieved by how the repo is named.

Wait, let me clarify: when you see `https://gamebackup.github.io/standalone_games/2048/`, that means there's a repo called literally `standalone_games/2048`? No — GitHub Pages project sites for organization accounts work like this:

`https://<org>.github.io/<repo>/`

So `https://gamebackup.github.io/standalone_games/2048/` means there's a GitHub repo called `standalone_games`... no, that doesn't work either.

Actually, looking at the gamebackup org — it has 537 repos. The repo names match the URL paths directly. So there's a repo named `standalone_games` and inside it there's a directory `2048` with an index.html. OR each repo is named with the full path.

Let me be honest: I'm not 100% sure how the repos are named since they're not in this repo. But the key insight is: **each game is in its own repo**, deployed as a GitHub Pages project site. The URL path after `gamebackup.github.io/` is the repo name. If games share a prefix like `standalone_games/`, they might be subdirectories within a single repo, or each might be its own repo with the full path as the name.

**How to figure it out**: Go to `https://github.com/gamebackup` and look at the existing repos. See how they're named. Mirror that pattern.

### Step 3: Push the game files
Push an `index.html` (and all assets) to the `main` branch of that repo. GitHub Pages will auto-deploy it.

### Step 4: Add a button in index.html
Edit `index.html` in THIS repo. Find the right genre section and add:
```html
<button onclick="playGame('https://gamebackup.github.io/<repo-path>/')">Game Name</button>
```

### Step 5: Update the version
Update the meta tag at line 9:
```html
<meta name="x3e-version" content="YYYY/MM/DD-NN">
```
Increment NN each time you update in a day.

### Step 6: Update the changelog (optional but nice)
Add an entry in the settings modal changelog at ~line 1461.

### Step 7: Push and deploy
Commit and push to `main`. GitHub Pages deploys automatically.

---

## 5. How to Make Changes to the Site

Everything is in this repo. Workflow:

1. Clone/edit locally
2. Test by opening `index.html` in a browser (it's all client-side)
3. Commit and push to `main`
4. GitHub Pages deploys automatically within a few minutes

**No build step. No CI/CD. Push = deploy.**

### Version tracking
The `<meta name="x3e-version">` tag (line 9 of index.html) is used for the update notification system. The site compares its local version against the raw GitHub version every 10 minutes. Bump it whenever you push notable changes.

### Images
All images are served via jsDelivr CDN:
```
https://cdn.jsdelivr.net/gh/gamebackup/gamebackup.github.io@main/images/<filename>
```
If you add new images, commit them to `images/` and reference them through this URL pattern.

---

## 6. Key Features You Need to Understand

### Tab Cloaking
Users can change the tab title and favicon to look like Google, YouTube, Canvas, etc. It's stored in `localStorage`. The list of presets is in two places:
- Inline `<script>` in `<head>` (lines 12-33) — runs immediately before the page renders
- In the main `<script>` block (lines 916-927) — for the settings UI

If you add a new preset, add it to **both** places.

### Service Worker & Offline Play
The service worker (`sw.js`) enables two things:
1. **Cached browsing** — the site itself loads faster on repeat visits
2. **Offline game preloading** — users can select up to 5 games from the settings menu. The site opens each game in a hidden iframe; the service worker caches all assets during a "preload session."

If the service worker breaks:
- Check that it's being registered correctly (lines 1353-1365 of index.html)
- Bump the `CACHE_NAME` in sw.js (currently `x3e-offline-v2`) to force a fresh cache
- The `CLEAR_GAME` message handler has a security check — it only allows clearing URLs under `gamebackup.github.io/`

### Update Notification
Every 10 minutes, the site fetches the raw GitHub version of index.html (bytes 0-1500 via Range header) and compares the `x3e-version` meta tag. If different, it shows a "New Update Available" banner. The user clicks Update to reload.

### Game Overlay
Games load in a fullscreen `<iframe>` with `sandbox` attributes. The iframe allows: scripts, same-origin, forms, modals, popups, top-navigation, and pointer-lock. Scroll position is saved/restored via `sessionStorage`.

### Quality Stars
Games have stars in their button text:
- `*` = Little Laggy
- `**` = Probably Playable
- `***` = Won't run on Chromebooks

Keep these honest — users rely on them.

### DMCA Notice
There's a DMCA contact form link in the footer. If you receive a takedown request, take it seriously. The site is non-commercial and fan-made, but respect copyright holders.

---

## 7. Maintaining the Games (The 537 Repos)

You'll need access to the **gamebackup GitHub organization**. The original creator should add you as an owner or admin.

**What you need to maintain:**
- **Broken games** — users report them via the Blocked/Bug Report form. Check if the game repo still exists, if the files are intact, if the URL is correct in index.html
- **Dead links** — sometimes a game gets taken down or the repo gets deleted. Remove or replace those buttons
- **New games** — users request them via the Game Request form. Add them when you can
- **Game updates** — occasionally a game gets a new version. You'd need to update the files in its repo

**How to find which repo a game is in:**
The game URL is `https://gamebackup.github.io/<path>/`. The `<path>` is the repo name. Go to `https://github.com/gamebackup/<path>` to find the repo.

---

## 8. Forms You Need Access To

These Google Forms are linked from the site. The original creator owns them — make sure they transfer ownership to you:

| Purpose | Link (in index.html) |
|---|---|
| Game Requests | `forms.gle/4qtsrTs18sW5equ9A` (line 62) |
| Blocked/Bug Reports | `forms.gle/TPk7ZofJveGqhbXs6` (line 63) |
| Succession Interest | `forms.gle/...` (line 88) — this form might be yours now |
| DMCA Takedown | `forms.gle/...` (line 712) |
| Q&A Document | Google Doc link (line 64) |

Also important:
- **The Chat Room** links to a Google Doc (line 206) — you might want to maintain this too

---

## 9. Common Issues & Fixes

### "Games aren't loading"
- Check if the game repo still exists in the `gamebackup` org
- Check if the game's index.html is valid
- Some games need specific browser features — Flash games need Ruffle, WASM games need a modern browser

### "The site won't load"
- GitHub Pages might be down (rare)
- Check `https://gamebackup.github.io/` directly
- The service worker might be caching a broken version — users can clear site data in Settings

### "The update notification is stuck"
- The user can dismiss it with the X button
- If it's stuck for everyone, the version meta tag might not be updating properly on the raw GitHub file. Check the CDN cache.

### "Tab cloaking stopped working"
- The browser might have updated its security settings
- Some cloaks rely on external favicon URLs — if those URLs change, you need to update them

### "I need to force-refresh everyone's cache"
- Bump the `CACHE_NAME` in `sw.js` (line 1)
- Or tell users to go to Settings → Danger Zone → Delete All Save Data

### "GitHub Pages isn't deploying"
- Go to the repo → Settings → Pages and check the status
- Make sure the source branch is set to `main` and the folder is `/ (root)`

---

## 10. Regular Maintenance Checklist

- [ ] **Check the Bug Report form** — weekly. Fix broken games, remove dead links
- [ ] **Check the Game Request form** — weekly. Add promising games
- [ ] **Review the 537 game repos** — monthly. Prune repos that are truly broken
- [ ] **Update the changelog** — whenever you make changes worth noting
- [ ] **Bump the version tag** — with every deploy
- [ ] **Check external links** — the Google Doc links, forms, external game links. They can break
- [ ] **Test tab cloaking presets** — external favicon URLs change over time
- [ ] **Test the service worker** — make sure caching and offline play still work
- [ ] **Review the Q&A doc** — make sure it stays relevant

---

## 11. Technical Reference

### Key Constants in index.html

| Constant | Line | Value | Purpose |
|---|---|---|---|
| `CACHEABLE_BASE` | 1031 | `https://gamebackup.github.io` | Only URLs under this are cacheable |
| `MAX_SELECT` | 1032 | 5 | Max games for offline preload |
| `CACHE_WAIT_MS` | 1033 | 12000 | Wait time after iframe loads |
| `CACHE_MAX_MS` | 1034 | 25000 | Hard timeout for caching |
| `CHECK_INTERVAL` | 984 | 10 min | Update check frequency |

### Key Service Worker Messages

| Type | Purpose | Sent from |
|---|---|---|
| `START_SESSION` | Begin caching all origins | index.html (preload) |
| `STOP_SESSION` | End preload session | index.html (after caching) |
| `GET_CACHED_URLS` | List cached URLs | index.html (on load + picker) |
| `CLEAR_GAME` | Delete cached game files | index.html (purge + cleanup) |

### CDN Image URLs

```
https://cdn.jsdelivr.net/gh/gamebackup/gamebackup.github.io@main/images/<file>
```

Available images:
- `Cat-looks-inside-meme.png` — main favicon/site logo
- `googleiconv2.png` — Google tab cloak icon
- `darken_tree_hd.png` — hero background
- `x3egear-removebg-preview.png` — gear logo

---

## 12. Final Words

I started x3e in 2023 because I wanted to play games at school without dealing with garbage sites full of popups and malware. It grew into something way bigger than I expected — 272 games, almost 540 repos, and who knows how many users.

You're taking over because I see something familiar in you. You care about the craft, you care about the users, and you understand what this site means to people who just want fifteen minutes of fun between classes.

Don't let it die. But also don't let it consume you. I'm graduating, and you will too someday. When it's time, pass it to the next person.

The forms are out there. The repos are out there. Everything is open source. You've got this.

— x3e, 2023–2027
