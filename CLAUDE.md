# Astra Finn: build instructions

Read `PLAN.md` first. It is the specification. The five briefs in `research/` are the source of truth for every number, date and link; the plan defers to them.

## Who this is for
A six-year-old (Finn, the Commander) and his dad (the Flight Engineer) using a Samsung tablet together. The session is tomorrow, so ship Phase 1 of `PLAN.md` section 9 before anything else.

## Hard constraints of this machine
- No Node.js and no npm. Do not add a build step, a bundler or a framework that needs one.
- Python 3.12 with Pillow is installed. Use it for image resizing, PWA icon generation and `python -m http.server 8000` for local testing.
- git is installed with Git Credential Manager. `gh` is not. git has no `user.name` or `user.email` set yet.
- Chrome and Edge are installed. Use the built-in browser pane to test at 1280 by 800.

## Technical rules
- Plain HTML, CSS and ES-module JavaScript. Libraries only from a CDN, pinned to an exact version at least two weeks old, loaded through an import map, and precached by the service worker.
- Relative paths everywhere, so the site works under a GitHub Pages sub-path.
- `localStorage` only. No backend, accounts, analytics or third-party scripts beyond Three.js, optional GSAP, Google Fonts and YouTube embeds.
- Videos are embedded from `youtube-nocookie.com` behind a poster card, never autoplayed, with a start timestamp. Check each ID in `research/03-videos.md` before use.
- Images: public domain or Creative Commons only, credited in `assets/img/CREDITS.md`, resized to 1600 px and 300 KB max. Leave out anything with an unclear licence.
- Keep the Three.js scene under about 60k triangles, cap `devicePixelRatio` at 1.5, pause the render loop when hidden.

## Content rules (Astra Nova style)
- Every mission follows the four beats: Wonder, Commander's Guess, Conundrum, Build or Fly then Debrief.
- Conundrums have three or four options, no right answer, and a reveal that never says which option was correct. Write them so a crew could split either way.
- No violence or suffering in scenarios. Empty test rockets blowing up is fine. People in danger is not.
- One to three sentences per card. One number per card, always with a comparison a six-year-old can picture. Every number has a `source` URL from `research/`.
- Every text card has a Read aloud button.
- Never show a score between the two players. Patches, the Crew Log and Changed-Mind stars are the only rewards.

## Delegation
Use Haiku 5.5 subagents in parallel for the seven tasks listed in `PLAN.md` section 9. Each prompt must be self-contained and each agent writes only its own files. Build the engine, the Three.js Starship, the catch game and the PWA plumbing yourself.

## Done means
Installed from the public link on the tablet, Mission 5 finished end to end with no console errors, and the app still opens with Wi-Fi off after one online visit.
