# x3e unblocked games. successor guide

so youre the one taking over (or group of you). ive been running this thing since 2023, and its quickly grown way bigger than i ever thought it would. this document should be a guide for keeping x3e alive. read it front to back before you touch anything. **please keep this updated if you ever decide to quit or pass the torch to someone else**

---

## 1. x3e explained

x3e is a static HTML/CSS/JS website that hosts **~370 playable games** (at the time of making this) for free, designed to work on school chromebooks and bypass web filters (think securly, fortiguard, etc). it lives at **https://gamebackup.github.io/** and is served via **GitHub Pages**. important disctinction: x3e is both served through https://gamebackup.github.io. but the main method of access (and better method) is through the local file named finalproduct-v2.html. give that to people, not the https://gamebackup.github.io link.

the whole thing is **vanilla HTML/CSS/JS**. no framework, no packages. you push to `main`, it deploys. that's it.

---

## 2. Architecture — How the Site Works

The site is split across ~10 repos (at the time of writing this) working together:

### This repo (`gamebackup.github.io`)
Contains the **shell** — the HTML homepage, CSS, service worker, manifest, and images. think of it as a storefront.

### The game repos
Games are organized into **category repos**, each deployed as a GitHub Pages project site at `https://gamebackup.github.io/<repo-name>/`. Each repo contains many games as subdirectories.

| Repo | URL prefix | Contents |
|---|---|---|
| `standalone_games` | `/standalone_games/` | HTML5/JS standalone games |
| `standalone_games_2` | `/standalone_games_2/` | More standalone games |
| `standalone_games_3` | `/standalone_games_3/` | Even more standalone games |
| `standalone_games_4` | `/standalone_games_4/` | take a wild guess|
| `flash_games` | `/flash_games/games/` | Flash games played via Ruffle (Fireboy & Watergirl, jelly truck, etc.) |
| `emu_games` | `/emu_games/games/` | Emulated console games |
| `gba_games` | `/gba_games/games/` | GBA Pokemon games |
| `pico8_games` | `/pico8_games/` | PICO-8 fantasy console games |
| `itchio_games` | `/itchio_games/` | Games sourced from itch.io |
| `fnf-mods` | `/fnf-mods/` | Friday Night Funkin' mods |

Some games are in their own single-game repos (like `chord/`, `webOS/`, etc), those are ones that i consistently updated and didnt feel like waiting 10 minutes for a whole games repo to upload for a simple change in those specific projects

So when you see a url like `https://gamebackup.github.io/standalone_games/2048/`, that means:
- its the repo called **`standalone_games`** in the `gamebackup` organization
- inside that repo, theres a directory called **`2048/`** with an `index.html` and game assets inside that.

GitHub Pages deploys each repo's `main` branch to `https://gamebackup.github.io/<repo-name>/`.

---

## 3. x3e file by file breakdown

### `index.html` (buncha lines of code). thats where the site is built
The HTML includes:
- **tab cloaking** — switches tab title/favicon to look like Google, YouTube, Canvas, etc.
- **preloader** — "L O A D I N G" animation on load
- **game grid** — buttons organized by genre, each calling `playGame(url)`
- **particle canvas** — animated pink/cyan background
- **search** — filters game buttons by name (Ctrl+F triggers it)
- **random game picker**
- **game overlay** — fullscreen iframe for playing
- **volume control** — slider that adjusts audio/video in the iframe
- **update notification** — fetches raw GitHub index.html every 10 minutes, compares version meta tag (the meta tag is near the top of the index.html code)
- **settings modal** — tab cloaking picker, offline game preloader, volume, changelog, danger zone stuff
- **offline play system** — lets users select up to 5 games at a time to cache via the service worker

### `style.css` (makes the site pretty)
Dark theme with neon pink accent (#e61587). Glitch text on the title. Particle canvas overlay. Settings modal with frosted glass. Responsive at 600px.

### `sw.js` (literally all for the offline caching) — Service Worker
Handles offline caching. Two modes:
- **Normal**: caches `gamebackup.github.io` URLs only, cache-first with network fallback
- **Preload session**: activated via `START_SESSION` message — caches everything (any origin) for offline preloading

### `404.html`
Custom error page, nothing else to say

### `finalproduct-v2.html`
**THIS ONE IS IMPORTANT!!!** This is the one that you send to people. it fetches the index.html, compares versions with gamebackup.github.io (to make sure its up to date), and everything else. this is how x3e avoids being blocked. IF YOU DONT UPDATE THE VERSION TAG IN THE META (line 9 of index.html) THIS WILL NOT UPDATE

### `dedications.html`
exactly what it says on the tin. currently not attached to the main site, just a file floating in space

### `images/`
site images served via jsdelivr cdn (`cdn.jsdelivr.net/gh/gamebackup/gamebackup.github.io@main/images/...`).

---

## 4. Adding a New Game

this is probably what youll do the most. heres how:

### Step 1: Get the game files
You need the actual game code (HTML, JS, WASM, etc.). Sources:
- Flash games → use internet archive and ruffle 
- HTML5 games → check itch.io, gamejolt, github, or gamedistribution.com
- Ported games → check the National Porting Association (npa.lol)
- The Game Request form → users submit games here

### Step 2: Add the game to the right category repo
Find which category the game belongs to (standalone_games, flash_games, pico8_games, etc.) and clone that repo to your github desktop. Create a new directory for your game inside it (e.g., `standalone_games/newgame/`) with an `index.html` and all the assets. the index.html has to be in the root of the new directory: `standalone_games/newgame/index.html`

### Step 3: Push the game files
Commit the new directory and push to `main` of that category repo. gitHub pages will do the rest.

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
Increment NN each time you update in a day. most ive done in a day is like 26 or smth 

### Step 6: Update the changelog (optional but nice)
Add an entry in the settings modal changelog, look for "div class="setting-section-label">Changelog</div". tbh i havent done this in a while

### Step 7: Push and deploy
Commit and push to `main`. github does the rest.

---

## 5. How to Make Changes to the Site

everything you need to edit the **looks** of the site are in this repo

1. clone/edit locally
2. test by opening `index.html` in a browser (all of it's clientside)
3. commit and push to `main`
4. once pushed, github pages will update x3e automatically and the finalproduct-v2 will update soon after.

### Version tracking
The `<meta name="x3e-version">` tag (line 9 of index.html) is used for the update notification system. The site compares its local version against the raw GitHub version every 10 minutes. Bump it whenever you push notable changes.

### Images
all images are served using jsdlivr
```
https://cdn.jsdelivr.net/gh/gamebackup/gamebackup.github.io@main/images/<filename>
```
If you add new images, commit them to `images/` and reference them using the url template in the line above.

-------------------------------

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

## 7. Maintaining the Games

You'll need access to the **gamebackup GitHub organization** as an owner or admin.

**What you need to maintain:**
- **Broken games** — users report them via the Blocked/Bug Report form. Check the game's files in the category repo, fix or remove the button
- **Dead links** — if a game directory was deleted or moved, remove or update its button in index.html
- **New games** — users request them via the Game Request form. Add them to the right category repo
- **Game updates** — occasionally a game gets a new version. Update the files in its directory

**How to find which repo a game is in:**
Look at the game's URL path. The first path segment tells you the repo. For example:
- `https://gamebackup.github.io/standalone_games/2048/` → repo is `standalone_games`, game is in the `2048/` directory
- `https://gamebackup.github.io/flash_games/games/btd1/` → repo is `flash_games`, game is in `games/btd1/`
- `https://gamebackup.github.io/balz/` → repo is `balz` (single-game repo)

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
- [ ] **Review the category repos** — monthly. Prune game directories that are truly broken
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

I started x3e in 2023 because I wanted to play games at school without dealing with garbage sites full of popups and malware. It grew into something way bigger than I expected — 272 games across about 7 category repos, and who knows how many users.

You're taking over because I see something familiar in you. You care about the craft, you care about the users, and you understand what this site means to people who just want fifteen minutes of fun between classes.

Don't let it die. But also don't let it consume you. I'm graduating, and you will too someday. When it's time, pass it to the next person.

The forms are out there. The repos are out there. Everything is open source. You've got this.

— x3e, 2023–2027
