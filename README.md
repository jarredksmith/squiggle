# Squiggle

A daily word game. Each squiggle is the line a finger draws when it swipe-types a word on a phone keyboard. Three to read every day (4, 6 and 8 letters, four guesses each), then one word to draw from memory, scored against the real trace. Solving earns ink; ink buys hints and extra guesses. Reading rounds are timed (active time only: the clock stops when you leave the round or the app), and the times ride along on the result sheet, the share text and the share card so friends can race. Only the daily game pays ink: practice, friend squiggles and duels are unlimited, so they are free to play and pay nothing.

The whole game is one HTML file. It runs as a web page, as a home-screen app, and inside a native iPhone wrapper, from the same source.

## What's in here

| Path | What it does |
| --- | --- |
| `src/squiggle.template.html` | The game. **Edit this**, never `index.html`. |
| `src/words.txt`, `src/words-es.txt`, `src/words-pt.txt` | Guess dictionaries: 32,000 English, 20,000 Spanish and 20,000 Brazilian Portuguese words, one per line, from the hermitdave/FrequencyWords lists |
| `scripts/build.mjs` | Builds `index.html` (web + app) and `dist/artifact.html` (for a Claude artifact) from `src/` |
| `index.html` | The built game. GitHub Pages serves it; the iPhone app bundles it |
| `manifest.webmanifest`, `sw.js`, `icons/` | Make the web copy installable and playable offline |
| `privacy.html` | Privacy policy page (App Store Connect asks for a URL) |
| `brand/` | `logo.svg` (the wordmark), app icon and splash sources |
| `fonts/` | IBM Plex Sans (SIL OFL), bundled so the app needs no font service and works offline |
| `ios-app/` | Capacitor 8 wrapper. The Xcode project is committed; the web files are copied in at build time |
| `.github/workflows/ios.yml` | Builds the app on a GitHub Mac and uploads it to TestFlight |

## Editing the game

```
node scripts/build.mjs
```

That rewrites `index.html` and `dist/artifact.html`. Commit both `src/` and `index.html`. Pushing to `main` publishes the web copy (Pages) and kicks off an iPhone build.

Bump `VERSION` in `sw.js` when you change the game so installed web copies refresh.

## 1. Web copy on GitHub Pages

Repo **Settings > Pages**: Source "Deploy from a branch", branch `main`, folder `/ (root)`. The game is then at `https://jarredksmith.github.io/squiggle/`.

That address is also what "Send a squiggle" links point to (`window.SQUIGGLE_SHARE_URL` near the top of the template). If the repo gets a different name or a custom domain, change it there.

## 2. iPhone app on TestFlight

Same setup as Sparkle House, so the secrets are the same three values.

1. **Apple Developer > Identifiers**: register an App ID with bundle ID `com.jarredsmith.squiggle` (no capabilities needed).
2. **App Store Connect > Apps > +**: new iOS app, name "Squiggle", that bundle ID, SKU `squiggle`.
3. **Repo Settings > Secrets and variables > Actions**: add `ASC_KEY_ID`, `ASC_ISSUER_ID` and `ASC_KEY_P8` (copy them from the Sparkle House repo's secrets, or from the same key in App Store Connect > Users and Access > Integrations). The Team ID `SVYYTM3LTN` is already in the workflow.
4. Push to `main`, or run the **iPhone app** workflow by hand. Without the secrets, a run only checks that the project compiles; with them, it signs and uploads. Apple processes the build in 5 to 15 minutes, then it appears under TestFlight in App Store Connect and in the TestFlight app on your phone.

Each run's build number is the GitHub run number, so uploads never collide. The marketing version (1.0) lives in `ios-app/ios/App/App.xcodeproj/project.pbxproj` as `MARKETING_VERSION`.

### If the first signed run fails

- "No profiles for 'com.jarredsmith.squiggle'": the App ID from step 1 doesn't exist yet, or the bundle ID differs. Automatic signing creates the profile but not the App ID.
- "The provided entity includes an attribute with a value that has already been used" on upload: the build number was reused. Re-run the workflow; a new run number fixes it.
- Anything about a missing distribution certificate: the key needs the **Admin** role (or App Manager with access to certificates) in App Store Connect so Xcode can create one.

## Brand

The look is the slate-blue style guide: navy text `#0F2749` on `#F5F8FC`, primary blues `#295CBD` / `#5B8DEF`, coral `#FF6B5B` for the player's own marks (the start dot, the live trace), gold for ink. Dark mode is `#0B1426` / `#141F3A` with `#7C9DFF` / `#A78BFA`. Green and amber are reserved for feedback (on the key, one key away) and never used for decoration. All of it lives in the `:root` tokens at the top of the template.

The wordmark is `brand/logo.svg`, inlined once as SVG `<defs>` and reused by `<use href="#sq-logo">` (home) and `#sq-swoosh` (the in-game header mark); the share card draws the same paths on canvas. The brush strokes behind the home screen are two SVG paths roughened by the `#sq-brush` filter (turbulence displacement for the edges, a streaky alpha mask for the dry-brush texture); their colour and opacity are the `--brush` / `--brushop` tokens. The app icon is `brand/icon.svg`: the wordmark's own script S in white on navy with the coral dot (rendered to `brand/icon-1024.png`); the splash is the wordmark on `#F5F8FC`.

Type is IBM Plex Sans, one family at four weights, with tabular figures where numbers line up; nothing is set in a monospace. The web and app copies load the woff2 files from `fonts/`; the Claude artifact copy loads the same face from Google Fonts. Interface icons are Squiggle's own: every action glyph is drawn with the game's trace (a round-capped curve, the coral dot where the finger lands, the arrowhead where it lifts), so Play, Practice, Challenge, Packs, Send, Review, Share, the draw tab and the four hints read as one family. They live in `ICONS` in the template and render through `sq(name)`. Universal glyphs with no Squiggle meaning (home, help, stats, close, copy, delete, timer, streak) stay Lucide (ISC), inlined at the same 2px stroke.

## 3. Later

- **Universal links** so "Send a squiggle" links open the app when it's installed: host an `apple-app-site-association` file at the root of a domain you control (GitHub Pages project sites can't serve it at the root), add the Associated Domains capability, and handle `appUrlOpen` with `@capacitor/app` (already installed).
- **Daily reminder** at a time the player picks: `@capacitor/local-notifications`, same as Sparkle House.
- **Game Center** leaderboards for weekly ink and best draw accuracy: a community Capacitor plugin, plus the Game Center capability on the App ID.
- **Image share cards**: draw the squiggle and the result to a canvas and share the PNG through the native share sheet (the Share plugin accepts files).

## Phase 2: making money without breaking the loop

The game's growth engine is the share card and the friend links, so nothing may sit between a player and today's puzzle, and nothing may sell an advantage that shows on the share. Within that:

1. **Squiggle+ (one-time unlock or yearly)**: the archive of past days, alternate inks and themes, detailed stats and streak repair. Sold through StoreKit via a Capacitor purchases plugin (RevenueCat's `@revenuecat/purchases-capacitor` is the least work; it also handles receipts and restores). The web copy stays free and ad-free.
2. **Ink packs (consumable IAP)**: ink is already the only currency, and hints already cost ink. Selling ink is honest because hints are flagged on the share, so bought ink can't fake a result. Price so a pack covers a week of hints, not a day.
3. **Ads, rewarded only**: a "watch for 20 ink" button in the hints sheet when a player is short, and an interstitial at most once per day after the day is complete, never before or between rounds. `@capacitor-community/admob` with App Tracking Transparency declined by default (contextual ads only). Squiggle+ removes all of them.
4. **Never**: pay for extra daily rounds, pay to skip the draw round, or sell anything that changes the day's share line.

Code hooks to add when this starts: an `economy` object in the template holding prices and a `premium` flag read from the store; `hintsSheet` gets a "Get ink" row; `recordDay` becomes the one place an interstitial may fire.

## Languages

English, Spanish and Portuguese ship today. Each language in `LANGS` (top of the template) is a keyboard layout (rows and row offsets, as the iOS keyboard lays them out: Spanish has Ñ on a ten-key middle row), an alphabet, word pools for the daily ladder, a two-word tutorial and a dictionary. Words are stored in their written form and traced through their base keys, so CAFÉ traces C-A-F-E and the reveal still shows the accent; ñ is its own key in Spanish, ç traces through C in Portuguese. UI strings live in `STR`. Friend and duel links carry a language tag (`#c-es-…`) so a Spanish squiggle opens on the Spanish keyboard wherever it lands. The first run picks the device language when it is one of the three; Settings changes it any time, and each language keeps its own daily state.

To add a language: a layout, an alphabet, pools (100 to 300 words each of 4, 6 and 8 letters), two tutorial words, a strings block, and a `words-xx.txt` wired into `scripts/build.mjs`.

## Challenge modes

**Beat a trace** draws one word and turns it into a duel link. **Draw a sentence** shows a three-to-five-word sentence and takes one stroke per word, blind: each word is scored as the finger lifts, nothing is shown until the last one, then the average and each word's accuracy appear and any word can be tapped to compare traces. Sentences live in `LANGS[lang].sentences` (no one-letter words, since a single key can't be traced; no punctuation) and deal from their own saved deck like the word pools. Neither mode pays ink.

## Friend links open the app (Universal Links)

`#c-…` (send a squiggle) and `#d-…` (beat a trace) links point at the web copy, `https://jarredksmith.github.io/squiggle/`. On an iPhone with the app installed, iOS opens the app instead; without it, the web page loads as before. Three parts make that work:

- `https://jarredksmith.github.io/.well-known/apple-app-site-association` — a JSON file at the root of the domain (so it lives in the `jarredksmith.github.io` repo, not here, next to a `.nojekyll` marker) saying links under `/squiggle/` whose hash starts with `c-` or `d-` belong to `SVYYTM3LTN.com.jarredsmith.squiggle`. Apple's CDN caches it for up to a day; `https://app-site-association.cdn-apple.com/a/v1/jarredksmith.github.io` shows what Apple currently has.
- `ios-app/ios/App/App/App.entitlements` — the Associated Domains entitlement, `applinks:jarredksmith.github.io`. The workflow signs the archive with the cloud-managed distribution certificate so the entitlement is embedded and the App ID gets the capability.
- `openAppUrl()` in the template — Capacitor's `appUrlOpen` event (and `getLaunchUrl()` for cold starts) hands the URL's hash to the same `openLink()` the web version uses.

The web copy also carries a Smart App Banner (`apple-itunes-app` meta, web build only), which Safari shows once the app is on the App Store.

## Packs, the store and reminders

**Packs** (`PACKS` in the template, English only so far) are a set of single words (4 to 10 letters, read and draw rounds), a set of titles (sentence mode), a price in ink, an App Store product id, and a look: the token overrides for light and dark (`--bg`, `--ink`, `--accent`, `--guess`, `--brush` and the rest). Owning a pack opens its own daily ladder (one short, one middle, one long word plus a draw, walking fixed shuffles so friends with the pack get the same four; saved under `sq.pack.<id>`; pays half ink; no streak), practice from its words, titles to draw, and the look, which the Packs sheet switches on and off (`data-pack` on the root). Pack words count as valid guesses while a pack is in play. A pack with a `season` window shows an "In season" tag. To add one: an entry in `PACKS` with the fields above, validated the same way as the pools (letters only, no one-letter words in titles).

**Store.** Ink (`squiggle.ink.100`, `.300`, `.1000`, consumables) and packs (`squiggle.pack.<id>`, non-consumables with a RevenueCat entitlement named after the pack id) are sold through StoreKit by way of RevenueCat's Capacitor plugin. The app ships complete without it: nothing store-related shows until `NP.Purchases` exists and `window.SQUIGGLE_RC_KEY` is set. To switch it on for a release:

1. App Store Connect → the app → In-App Purchases: create the six products with those ids, prices and display names; attach screenshots and submit them for review with the binary.
2. RevenueCat: a project with the App Store app, the products, one entitlement per pack (id = pack id), and a default offering that includes every product. Copy the public Apple API key.
3. `cd ios-app && npm i @revenuecat/purchases-capacitor && npx cap sync ios`, then set `window.SQUIGGLE_RC_KEY='appl_…'` next to `SQUIGGLE_SHARE_URL` in the template's standalone head.
4. App Privacy in App Store Connect changes from *Data Not Collected* to purchases and a device identifier, used for app functionality, not linked to identity (that is what the SDK collects). Keep 1.0 free of the plugin so its privacy answer stays true; make this 1.1.

**Reminders** use `@capacitor/local-notifications`: a daily notification at the hour chosen in Settings and an 8:30 pm nudge on days the ladder is still open (scheduled a week ahead on every open, today's cancelled when the day completes). The web copy hides the setting. Promotional pushes ("the Halloween pack is here") need a push service with a server behind it; OneSignal's Capacitor plugin is the least work when that day comes, and it would add another App Privacy line.

## Word pools

Daily words walk a fixed shuffle of each pool (`cycle()` in the template), so a word can't come back until every other word of that length has had its day: with today's English pools that is about 290 days for 4 letters, 250 for 6 and 210 for 8. Practice deals from a shuffled deck saved on the device, skips today's daily words, and only reshuffles once the whole pool has been played. Adding words to a pool changes the daily sequence from that day on, which is fine; removing or reordering words in the first week's `week` list is not, since those are already in people's history.
