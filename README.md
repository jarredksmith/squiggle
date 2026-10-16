# Squiggle

A daily word game. Each squiggle is the line a finger draws when it swipe-types a word on a phone keyboard. Three to read every day (4, 6 and 8 letters, four guesses each), then one word to draw from memory, scored against the real trace. Solving earns ink; ink buys hints and extra guesses.

The whole game is one HTML file. It runs as a web page, as a home-screen app, and inside a native iPhone wrapper, from the same source.

## What's in here

| Path | What it does |
| --- | --- |
| `src/squiggle.template.html` | The game. **Edit this**, never `index.html`. |
| `src/words.txt` | The guess dictionary (32,000 common English words, one per line) |
| `scripts/build.mjs` | Builds `index.html` (web + app) and `dist/artifact.html` (for a Claude artifact) from `src/` |
| `index.html` | The built game. GitHub Pages serves it; the iPhone app bundles it |
| `manifest.webmanifest`, `sw.js`, `icons/` | Make the web copy installable and playable offline |
| `privacy.html` | Privacy policy page (App Store Connect asks for a URL) |
| `brand/` | App icon and splash sources |
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

## 3. Later

- **Universal links** so "Send a squiggle" links open the app when it's installed: host an `apple-app-site-association` file at the root of a domain you control (GitHub Pages project sites can't serve it at the root), add the Associated Domains capability, and handle `appUrlOpen` with `@capacitor/app` (already installed).
- **Daily reminder** at a time the player picks: `@capacitor/local-notifications`, same as Sparkle House.
- **Game Center** leaderboards for weekly ink and best draw accuracy: a community Capacitor plugin, plus the Game Center capability on the App ID.
- **Image share cards**: draw the squiggle and the result to a canvas and share the PNG through the native share sheet (the Share plugin accepts files).
