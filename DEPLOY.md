# Getting Astra Finn onto the tablet

There are two ways to open the app on the Samsung tablet.

## Option A: GitHub Pages (recommended, about 10 minutes, free)

This gives a permanent public web address. The app installs like a real app, opens full screen, and works offline after the first visit.

1. Sign in or sign up at https://github.com.
2. Create a new repository at https://github.com/new. Name it `astra-finn`, choose **Public**, and leave every "Initialize" box unticked. Click **Create repository**.
3. On this PC, open a terminal in `C:\1 Astra Nova - Finn` and run these two commands, replacing `YOUR-USERNAME`:

```bash
git remote add origin https://github.com/YOUR-USERNAME/astra-finn.git
```

```bash
git push -u origin main
```

   A browser window opens to sign in to GitHub the first time. That is Git Credential Manager, and it is safe.
4. On GitHub, open the repository, then **Settings**, then **Pages**. Under "Build and deployment", set **Source** to "Deploy from a branch", **Branch** to `main` and folder `/ (root)`. Click **Save**.
5. Wait about a minute. The address is `https://YOUR-USERNAME.github.io/astra-finn/`.

### Updating later

After any change, regenerate the offline file list, commit and push:

```bash
python tools/build_sw.py
```

```bash
git add -A && git commit -m "Update Astra Finn" && git push
```

## Option B: the Claude Artifact link (instant, already done)

The Artifact link opens straight away in any browser where you are signed in to claude.ai. Inside an Artifact:
- Videos open in the YouTube app instead of playing inside the page.
- It doesn't work offline, and "Add to Home screen" makes a shortcut rather than a full app.
- Progress (patches, Crew Log) is stored separately from the GitHub Pages version.

## Installing on the Samsung tablet

**Samsung Internet:** open the address, tap the menu (three lines, bottom right), then **Add page to**, then **Home screen**. If an **Install** or download-arrow icon appears in the address bar, tap that instead.

**Chrome:** open the address, tap the three-dot menu, then **Add to Home screen**, then **Install**.

Then:
- Open the app once while on Wi-Fi and tap into the Starship mission, so everything is saved for offline use.
- Turn the tablet sideways. The app is designed for landscape.
- Turn the volume up: the app reads every card aloud. The speaker button at the top switches automatic reading off if you'd rather read yourself.
- Game sounds are off by default. The music-note button at the top turns them on.

## Before the session

- Check the Starship news card: SpaceX may attempt the first ship catch on Flight 15, possibly in late October 2026.
- Have the balloon rocket kit ready (balloon, about 4 m of string, a straw, tape, two chairs).
- For the asteroid mission's crater tray: flour, cocoa powder, a baking tray, some marbles.
