# Astra Finn: a space academy for Finn (6) and Dad

**Status:** build-ready plan. Written 10 Oct 2026 for a session with Finn on 11 Oct 2026.
**Builder:** Opus 5.5 as orchestrator, Haiku 5.5 subagents for parallel content, images and QA. See section 9.
**Source material:** `research/*.md`, five research briefs with URLs. Those files are authoritative for numbers, dates and links. Where this plan and a research file disagree, the research file wins.

---

## 1. The brief in one paragraph

A tablet web app that Finn and Dad use together, side by side, for 30 to 40 minutes at a time. It teaches space the Astra Nova way: start from a real open problem, make a guess before the answer, vote on a conundrum with no right answer and defend it, then build or fly something. Finn asked for: asteroids and how big they are, how big Mars is, how people will get to and live on Mars, the proposed Moon base, SpaceX Starship (a spinnable 3D model with a cutaway, how it takes off and lands, a launch button, a game to get it back on the pad), links to real launch and landing videos, and how long metal lasts on different planets. Visual style: cinematic and grown-up (dark, photographic, big type), not cartoony. It installs on a Samsung tablet from a link as a home-screen app.

Hard constraints found on this PC: **no Node.js**, so no build step. Python 3.12 with Pillow is available, git with Git Credential Manager is available, there is no `gh` CLI, and git has no user name or email configured yet. The app must be plain HTML, CSS and JavaScript with libraries loaded from a CDN.

---

## 2. Teaching method: Astra Nova, translated for a 6-year-old and his dad

What Astra Nova actually does (sources in `research/01-astra-nova-method.md`): one-minute **Conundrum** videos that pose a dilemma with three to five options and no right answer, ending on a question that starts a discussion. The best conundrums split the audience evenly. They avoid violence and suffering. The school's stated aims are curiosity, problem-solving, intellectual courage and "constructive disagreement". Josh Dahn's north star is a generation of "super collaborators". Synthesis, the spin-off, runs team simulations with resource trade-offs, changes a rule mid-game, and ends every session with a reflection on what worked, what failed and why. Mistakes are expected. No grades, no tests. Synthesis Tutor reads every word aloud for children under seven.

### 2a. Age first: what is right for a six-year-old (revised 10 Oct, after Dad's feedback)

Astra Nova's own Conundrums are aimed at 9 to 14-year-olds. At six, most learning comes from looking, wondering, pressing, guessing and doing. So the app is **mostly informative and playful**, with the Astra Nova ideas kept light:

- **Look and listen first.** Most steps are big-picture story cards, one or two short sentences each, read aloud by the app. Every number is compared to something Finn knows: Dad, a bus, our house, a football pitch, Big Ben.
- **Guessing games, not tests.** "Is it bigger than the Eiffel Tower?" with two or three picture answers. Wrong guesses get "Ooh, good guess! Let's see..." and never a red cross.
- **Lots of hands-on.** Spin the rocket, press LAUNCH, catch the booster, drag asteroids next to the house, jump on Mars, pack the ship.
- **Big Questions in only four missions** (Starship, Asteroids, Mars living, Moon base). Each is a picture choice with two or three options, phrased "What would you do?", answered by both crew members and talked about. No essays. The "why" is said out loud; Dad can type one line if he likes.
- **Try it at home.** Each mission ends with a real kitchen-table experiment: flour craters, a balloon rocket, the Mars jump test, a rusty-nail jar, a torch-and-ball Moon day.
- **Short chunks.** Each mission is 8 to 15 minutes. Any step can be skipped with Next.

The Astra Nova rhythm below still shapes the missions, but beat 3 (Conundrum) is optional and appears only where the question genuinely suits a six-year-old. `BUILD.md` is the exact step list.

The app encodes that as a rhythm most missions follow, so Finn knows the ritual by the second mission.

| Beat | What happens | Astra Nova principle |
|---|---|---|
| **1. Wonder** | One stunning image, video clip or the 3D model, plus one big question. Thirty seconds. | Problem first. Curiosity before content. |
| **2. Commander's Guess** | A predict-before-reveal estimate. Finn guesses first (a slider or picking a picture), Dad guesses second, then the reveal with a comparison Finn can picture: a car, a house, a football pitch. | Commit to a position before the answer. Being wrong is expected. |
| **3. Conundrum** | A dilemma with three or four options, written so a crew could split either way. Each crew member votes secretly on their own half of the screen, then votes are revealed. The app asks "Why?" and Dad types one line of Finn's reasoning into the Crew Log. Then a **"What really happened / what engineers argue about"** card, written so it does not crown a winner. Either player can tap **"I changed my mind"** and the app celebrates it. Some conundrums give each player a different clue card, so they have to talk. | No right answer. Defend your reasoning, hear the other view, revise. Being persuaded is a win. |
| **4. Build / Fly, then Debrief** | A hands-on piece: 3D Starship, catch-the-booster game, pack-the-ship, Moon base builder, time machine. In the trade-off games one rule changes mid-round. Then the fixed debrief on screen: "What worked? What didn't? Why?", plus one mission-specific question. The crew earns a patch. | Synthesis-style simulation under constraints, then reflection. |

Crew roles (collaborative, never competitive): **Finn is Commander** (makes final calls, guesses first), **Dad is Flight Engineer** (reads aloud, types the log, asks "what do you think?"). The app never shows a score between them. The only winning is the crew earning a patch together.

Dad's three rules, shown once on the crew setup screen and again behind an "Engineer's notes" button:
1. Finn guesses first. Dad never gives the answer before the reveal.
2. Ask "why?" and "what would change your mind?" more than you explain.
3. Changed minds get a cheer.

Reading level: Finn is six. Every card is one to three short sentences, and every card has a **Read aloud** speaker button (browser speech synthesis, UK English voice). Dad reads the rest.

---

## 3. App map

**Mission Control** (home): starfield, crew names and avatars, the patch wall, and seven mission tiles with a photograph each. Nothing is locked. Order is free.

### Mission 1: How big is an asteroid?
- **Wonder:** Bennu photographed by OSIRIS-REx. "Is this bigger than our house?"
- **Guess:** "Is Bennu bigger than the Eiffel Tower?" Bennu is about 490 m across, the tower 330 m: yes, about one and a half towers.
- **Play, Scale Explorer:** pick an asteroid (Chelyabinsk ~20 m, 2024 YR4 ~60 m, Dimorphos ~160 m, Apophis ~340 m, Bennu ~490 m, Ryugu ~900 m, Eros ~34 km, Vesta ~525 km, Ceres ~940 km, the dinosaur-killer ~10 km) and drag it next to a comparison object (Finn 1.2 m, a car, a house, a football pitch, the Eiffel Tower, Everest, the whole of the UK). Rendered to true relative scale with a smooth zoom.
- **Conundrum, "The Moon Rock Problem":** a true story, played as the decision it was in 2025. Asteroid 2024 YR4, as tall as a 15-storey building, had about a 1-in-25 chance of hitting the Moon in December 2032, when Finn would be 12. Nobody lives there yet, but the splash of rock (a crater a kilometre wide) could damage satellites and a future Moon base. You run Earth's space agency and the asteroid is now too far away to see with normal telescopes. A) Start building a spacecraft to nudge it away: costs billions, might miss, we would learn a lot. B) Point the biggest telescope in space at it and wait for a better answer: cheap, but if it is coming you have lost a year. C) Do nothing: a fresh Moon crater would be amazing to study. Reveal: the world chose B. The Webb telescope measured it again in February 2026 and showed it will miss the Moon by about 21,000 km. Watching was enough this time. Different clue cards: Finn's card says a nudge mission costs more than a thousand school buildings, Dad's card says there are thousands of satellites in orbit. Follow-up: "Would you have chosen differently if a Moon base was already built?" and "Was B the right call, or just lucky?"
- **Extra cards:** DART really crashed into an asteroid in 2022 and changed its orbit by about 33 minutes. Apophis, about 375 m across, flies by on 13 April 2029, closer than TV satellites and visible to the naked eye from Europe. Rubin Observatory found 2,104 new asteroids in its first ten hours. Rocks the size of a car hit Earth's air a few times a year and burn up.
- **Debrief:** what worked, what didn't, why. Then: "How would you push a rock the size of a stadium?"

### Mission 2: How big is Mars?
- **Wonder:** the Mars full globe. "Could you walk round it in a day?"
- **Guess:** "How many Marses fit across Earth?" (about two). Then the hand-size model: Earth is a football, Mars a grapefruit, the Moon a tennis ball.
- **Play, Planet Lineup:** Earth, Mars and the Moon side by side to scale. Then "Jump on Mars": enter Finn's jump height on Earth and see the Mars jump (38% gravity) and the Moon jump (17%) with a small figure.
- **Facts carousel:** a Mars day is 40 minutes longer than ours. A Mars year is almost two Earth years. Olympus Mons is nearly three Everests tall. The sky is butterscotch and sunsets are blue. Two tiny potato moons, Phobos and Deimos.
- **Conundrum, "The Pet Problem":** the first Mars crew of six may bring ONE animal. Every kilogram costs a fortune to launch, and animals need food, water, air and make mess. A) A dog. B) A goldfish (the water is heavy). C) A chicken (eggs, but noisy and needs space). D) No animal: take extra water instead. Reveal: real plans have no pets. Space stations have carried mice, fish and spiders for experiments. Astronauts grew and ate lettuce on the space station in 2015.
- **Debrief:** what worked, what didn't, why. Then: "What would you miss most from Earth?"

### Mission 3: Getting to Mars and living there
- **Wonder:** the real Perseverance landing video. "How do you land a car-sized robot on another planet?"
- **Guess:** "How long does the trip take?" (six to nine months: roughly from Finn's birthday to Christmas). "How long until Mars hears you say hello?" (3 to 22 minutes each way).
- **Play, Pack the Ship:** a Synthesis-style trade-off. A mass budget bar and a tray of cargo tiles: solar panels, water, food, oxygen maker, greenhouse, 3D printer, rover, medicine, spare parts, toys, a piano. The crew must agree on a load under the limit. Halfway through, a rule change: "A tank sprang a leak. Your budget just dropped by a fifth. Re-pack." The app gives consequences, not scores: "No spare parts: when the air pump breaks you can't fix it."
- **Play, The Delay:** Finn taps "Say hello to Mars". The reply arrives after a scaled wait with a live counter. Teaches why Mars crews must solve their own problems.
- **Explainer cards:** launch windows every 26 months. Starship refuels in orbit from tanker ships, a petrol station in space (not yet demonstrated as of October 2026). Making oxygen from Mars air (MOXIE really did it). Water from ice. Radiation means living under soil or in a lava tube. Dust storms. In February 2026 SpaceX put Mars on the back burner and is aiming for the Moon first.
- **Conundrum, "Moon first or Mars first?":** a real 2026 decision. You have one giant rocket and enough money for one big adventure at a time. A) The Moon first: three days away, so you can practise landing, living and rescuing people close to home. B) Mars first: the big dream, six to nine months away, where nobody has ever been. C) Split the money and try both slowly. Reveal: in early 2026 SpaceX chose the Moon first, aiming to land an empty Starship there as early as 2027, and NASA plans to land astronauts near the south pole in 2028. Many Mars fans were disappointed. Follow-up: "What would you need to practise on the Moon before trusting Mars?"
- **Bonus conundrum, "Where do we build the first house?":** A) In a lava tube: dark, cold, no windows, very safe from radiation. B) A dome on the surface: sunshine and views, but thick walls and radiation risk. C) Bury the landed Starship under soil: fast, no new building. Reveal: engineers propose all three. The first crews will probably live in their Starship and build later.
- **Debrief:** what worked, what didn't, why. Then: "Who fixes the toilet on Mars?"

### Mission 4: The Moon base
- **Wonder:** Artemis Base Camp concept art at the lunar south pole. "Why would you build a house where it's dark?"
- **Guess:** "How long is a Moon day?" (about two Earth weeks of light, then two weeks of night). "How heavy would Finn be on the Moon?" (one sixth).
- **Play, Build the Base:** a map of the south-pole crater rim. Place modules: solar towers (must go on the sunlit rim), ice miner (must go in the dark crater), habitat, landing pad (must be far from the habitat, because rocket exhaust sandblasts everything), rover garage, radiation shelter. The app explains each misplacement gently instead of failing you. Mid-round rule change: "Lunar night in two days. Where does the power come from?"
- **Explainer cards:** Artemis I flew round the Moon in 2022 with no crew. Artemis II flew four astronauts round the Moon and back in nine days in April 2026 (Reid Wiseman, Victor Glover, Christina Koch and Jeremy Hansen). Artemis III in 2027 is a practice mission in Earth orbit, docking with two test landers. Artemis IV in 2028 is planned as the first landing near the south pole. NASA paused the Gateway station in March 2026 to focus on the surface. NASA's Moon Base plan: robots first until 2029, then short stays. 3D-printing bricks from Moon dust. Lava tubes. China aims to land its own astronauts around 2030 and build a base in the 2030s.
- **Conundrum, "The Ice Decision":** you find ice in a dark crater. A) Drink it and grow food. B) Split it into rocket fuel so ships can fly home. C) Leave it: it is four billion years old and scientists want to study it before anyone touches it. Reveal: NASA plans all three, and scientists openly argue that mining will destroy the science. No settled answer.
- **Debrief:** what worked, what didn't, why. Then: "Should the Moon belong to anyone?"

### Mission 5: Starship (the centrepiece)
- **Wonder:** the 3D model, slowly rotating. "This is the biggest rocket ever flown. Spin it."
- **Play, The Model:** Three.js, touch to rotate, pinch to zoom, auto-rotate when idle. About twelve tappable hotspots: the 33 Raptor engines on the booster, the 6 on the ship (three for sea level, three big-belled for space), grid fins, hot-stage ring, booster methane tank, booster oxygen tank, ship tanks and the header tanks in the nose, payload bay, forward and aft flaps, heat-shield tiles, the launch tower and its chopstick arms. Each hotspot opens a card with one or two sentences and one wow number, with Read aloud. A **Cutaway** toggle slices away the near half of the skin so the tanks (pale blue liquid oxygen, pale green liquid methane) and engines are visible inside.
- **Guess:** "Is it taller than Big Ben?" (Yes: about 124 m against Big Ben's 96 m, and taller than the Statue of Liberty with its base.) "How many engines light at liftoff?" (33.)
- **Now card:** the current rocket is version 3. On 28 September 2026 it reached orbit for the first time and let out 26 Starlink satellites. The booster has been caught by the tower three times (Flights 5, 7 and 8). The ship has never been caught. SpaceX may try the first ship catch on Flight 15, possibly this month; the builder should check the news on the day and update this card. If a ship catch happens before or after the session, it is the perfect "what happened next" moment.
- **Play, Launch:** a big LAUNCH button. Finn counts down. A scripted animated timeline of about sixty seconds with a pause at each beat and a one-line card: ignition, liftoff, Max-Q ("the air pushes hardest here"), hot staging (the ship's engines light while still attached), booster flip and boostback burn, booster landing burn and the **tower catch**, ship coasting in space, belly-flop re-entry ("it falls like a skydiver"), the landing flip, landing burn. The camera follows. Stylised flames and plasma glow, nothing photoreal.
- **Play, Catch the Booster:** a 2D side-view game. The booster is falling toward the tower. Hold THRUST to fire three engines, tap LEFT or RIGHT (or tilt the tablet) to steer against a gentle wind, watch the fuel bar. Land between the chopsticks slowly enough and the arms close with a satisfying clunk: "CAUGHT". Too fast: "Boom. That's why we test." Missed: "Splash. The booster is lost but everyone is safe." After any outcome a card shows the real flight history (fourteen flights so far, three booster catches, the first orbit in September 2026): most early flights blew up, and that is how the rocket got good. No score, just a count of catches and the softest landing speed. Stretch: a "Catch the Ship" mode, where the ship falls belly-first and must flip upright before the burn, which nobody has done for real yet.
- **Conundrum, "The Catch":** it is October 2024, Flight 5. The booster is 71 metres tall and falling back toward your only launch tower. If the catch fails, the tower could be wrecked and you can't launch for a year. If you don't try, the booster splashes in the sea, safe but lost, and you learn nothing about catching. A) Try the catch. B) Splash it in the sea. C) Try the catch only if every engine and sensor passes a check in the last seconds; otherwise divert to the sea. Reveal: SpaceX chose something like C. The booster had to pass thousands of health checks on the way down, and it was caught on the first attempt. Follow-up: "Is a rule like C brave or careful? Can it be both?"
- **Videos:** the real Flight 5 catch, the latest flight highlights, the SN10 or SN15 belly-flop and flip landing, the Falcon Heavy twin booster landing. Verified links and timestamps in `research/03-videos.md`. Embedded with start times so the good bit plays immediately.
- **Debrief:** what worked, what didn't, why. Then: "Why catch it instead of landing on legs?"

### Mission 6: How long does metal last?
- **Wonder:** a Lunar Reconnaissance Orbiter photo of an Apollo landing site, the lander's legs still standing after fifty years. "Why hasn't it rusted?"
- **Guess:** "Which bike lasts longest: on a beach, on the Moon, or on Venus?" Finn ranks them.
- **Play, The Time Machine:** choose a place (a beach on Earth, the Moon, Mars, Venus, deep space) and a thing (a steel spoon, a bike, a rover, a Starship). Drag the time slider: 1 day, 1 year, 100 years, 1,000 years, 1 million years. The picture changes and a one-line "why" appears. Beach: rust needs water and air, so iron browns in months. Moon: no air, no water, no rust, but micrometeorite sandblasting and 250-degree day-night swings slowly pit the surface; the Apollo landers are still there. Mars: thin air, hardly any oxygen, dust abrasion, cold; Opportunity was built for 90 days and worked for nearly 15 years; Curiosity's aluminium wheels got holes from sharp rocks. Venus: 465 °C and acid clouds; the toughest probe ever lasted about two hours. Deep space: metal can even cold-weld to itself; Voyager 1 has been working since 1977. Exact figures in `research/04-images-facts.md`.
- **Conundrum, "The Message":** we want to leave a message still readable in a million years. A) A steel plaque on the Moon. B) A gold record on a spacecraft leaving the Solar System, like Voyager. C) Carved into a mountain on Earth. D) Glass etched with a laser, buried on Mars. Reveal: Voyager's golden record should last billions of years in space. The Apollo plaques are still legible. Carvings on Earth wear away in thousands of years. Then talk about what to write.
- **Debrief:** what worked, what didn't, why. Then: "Why did SpaceX choose steel for Starship?"

### Mission 7: The Big Zoom (closer)
A single continuous zoom slider from Finn (1.2 m) out through a house, a Starship, Bennu, Everest, Ceres, the Moon, Mars, Earth, Jupiter and the Sun, each shown to scale next to the previous one. No conundrum. Awe, and a final patch.

---

## 4. Gamification that stays collaborative

- **Mission patches:** an SVG emblem per mission in navy, ivory and gold, earned when the crew finishes the debrief. They sit on the patch wall in Mission Control, designed like real NASA mission patches, with both names on each.
- **Crew Log:** a timeline of every guess, vote and "why" line, with the date. Dad can export it as a text file. Nothing in the log is ever marked right or wrong.
- **Changed Minds:** every tap of "I changed my mind" earns a small star on the patch wall. This is the only counter the app celebrates out loud.
- **Catch game:** a count of catches and the softest landing speed. No leaderboard.
- **No locks, timers, streaks or points.**

---

## 5. Look and feel

- **Landscape tablet first.** A Samsung tablet is roughly 1280 by 800 CSS pixels. Design for 1024 to 1600 wide. Portrait works but the manifest asks for landscape.
- **Cinematic, not cartoony:** near-black navy background with a faint starfield, ivory text, one warm accent (amber or gold) for actions and one cool accent (cyan) for data. Real NASA and SpaceX photographs as hero images. Thin rules, generous whitespace, subtle 200 ms transitions.
- **Type:** a geometric display face (Space Grotesk or Sora from Google Fonts) for headings, Inter for body. Body text no smaller than 20 px. Buttons at least 56 px tall. Hotspots at least 44 px.
- **Every text card has a Read aloud button.** Short sentences. One idea per card.
- **Sound:** optional, off by default. A soft click, an engine rumble on launch, a clunk on catch.

---

## 6. Technical architecture (zero build step)

Plain static site. No bundler, no framework, no npm. Libraries from a CDN, pinned to exact versions and cached by the service worker for offline use.

```
/index.html                 app shell, import map, service-worker registration
/manifest.webmanifest       name, icons, display: standalone, orientation: landscape, theme_color
/sw.js                      cache-first for shell, assets and CDN libs; network-first for everything else
/css/app.css                design tokens, layout, components
/js/app.js                  hash router (#/mission/starship), state store, crew setup, patches, Crew Log
/js/ui/*.js                 WonderCard, GuessCard, Reveal, ConundrumCard, MediaCard, Patch, ReadAloud
/js/missions/<id>.js        one module per mission wiring the four beats to content
/js/three/starship.js       procedural 3D model, hotspots, cutaway, launch timeline
/js/games/catch.js          2D booster catch (canvas)
/js/games/pack.js           pack-the-ship mass budget
/js/games/moonbase.js       Moon base placement
/js/games/timemachine.js    metal durability explorer
/js/games/scale.js          asteroid and planet scale explorer, Big Zoom
/content/<mission>.json     all copy, numbers, conundrums, media links and credits
/assets/img/                public-domain and CC images, resized to 1600 px and 300 KB max (Pillow)
/assets/img/CREDITS.md      source and licence for every image
/assets/icons/              PWA icons 192, 512 and maskable (generated with Pillow)
/assets/patches/            SVG mission patches
/research/                  the five research briefs
```

Key choices:
- **Three.js** via an import map, for example `three@0.170.0` from jsdelivr, both `build/three.module.js` and `examples/jsm/` for OrbitControls. Any newer release out for at least two weeks is fine. Pin it exactly.
- **The Starship model is procedural** (cylinders, cones, rings, boxes), so there is no model file, no licence question, and it loads instantly. One unit is one metre. Full stack about 124 m (version 3). Booster: cylinder radius 4.5, height about 72, a ring of 33 engine bells (20 outer fixed, 13 inner), 4 grid fins, hot-stage ring. Ship: cylinder radius 4.5 plus an ogive nose, 2 forward and 2 aft flaps, 6 engines (3 small, 3 large), a black tile material on the windward half, internal tank meshes with translucent coloured liquid, header tanks in the nose. Tower: about 146 m with two chopstick arms and the launch mount. Keep the scene under about 60k triangles, cap the pixel ratio at 1.5, and stop rendering when the tab is hidden. Dimensions and the parts list for the current flying version are in `research/02-starship-artemis.md`.
- **Hotspots:** small glowing sprites. Tap means raycast. The selected hotspot opens a side card. **Cutaway** uses a clipping plane on the skin meshes (`renderer.localClippingEnabled = true`), with an opacity fallback if a device struggles.
- **Launch timeline:** keyframes in plain JavaScript, or GSAP from cdnjs. Pause and step controls. The cards for each beat come from `content/starship.json`.
- **Games are canvas 2D**, simple physics, touch buttons plus optional tilt via DeviceOrientation.
- **State:** `localStorage` only (crew names, patches, log, catch stats). No backend, no accounts, no analytics.
- **Videos:** embedded `youtube-nocookie.com` iframes with `start=` timestamps, shown behind a poster card so nothing autoplays, plus a "watch on YouTube" link as a fallback for the tablet's YouTube app.
- **Read aloud:** `speechSynthesis`, preferring an `en-GB` voice, with a stop button.
- **Offline:** the service worker precaches the shell, CSS, JS, content JSON, images, icons and the pinned Three.js files. Videos stay online-only.
- **Local testing:** `python -m http.server 8000` in the project folder. Open on the PC, and on the tablet over Wi-Fi at the PC's IP address. The service worker needs HTTPS, so that is for layout checks only.

---

## 7. Content format (so content can be written in parallel)

Each `content/<mission>.json` has the same shape, which lets four Haiku agents write four missions at once while Opus builds the engine:

```json
{
  "id": "starship",
  "title": "Starship",
  "tagline": "The biggest rocket ever flown",
  "hero": { "img": "assets/img/starship-pad.jpg", "credit": "SpaceX, CC BY-NC 2.0" },
  "wonder": { "text": "...", "question": "..." },
  "guesses": [
    { "prompt": "...", "type": "slider|choice|rank", "options": [], "answer": "...", "reveal": "...", "comparison": "...", "source": "https://..." }
  ],
  "cards": [ { "title": "...", "text": "...", "wow": "...", "img": "...", "source": "https://..." } ],
  "conundrum": {
    "title": "...", "scenario": "...",
    "clues": { "commander": "...", "engineer": "..." },
    "options": [ { "key": "A", "text": "...", "tradeoff": "..." } ],
    "reveal": "...", "followUp": "..."
  },
  "videos": [ { "title": "...", "youtubeId": "...", "start": 0, "channel": "...", "why": "..." } ],
  "debrief": [ "What worked? What didn't? Why?", "..." ],
  "patch": { "svg": "assets/patches/starship.svg", "name": "..." }
}
```

Copy rules for the writers: one to three sentences per card, words a six-year-old can follow when read aloud, one number per card and always with a comparison, never a bare statistic. Every number carries a `source` URL from the research files. Conundrum reveals must not say which option is correct. No violence or suffering in scenarios: early test flights "blew up" with nobody aboard is fine; anything with people in danger is not.

---

## 8. Deployment and the tablet

**Recommended: GitHub Pages.** Free, HTTPS, permanent URL, proper PWA install.
1. Create a GitHub account if there isn't one. In the project folder run `git init`, set `user.name` and `user.email`, and commit.
2. Create an empty repository on github.com (there is no `gh` CLI here; the website is fine, or `winget install GitHub.cli`). Push with `git push`. Git Credential Manager opens a browser login.
3. Settings, Pages, deploy from branch `main`, folder `/`. The URL is `https://<username>.github.io/<repo>/`. Use relative paths everywhere so the sub-path works.
4. Changes go live about a minute after each push.

**Fallback if time is short:** publish the folder as a Claude Artifact with supporting files. Instant link, no account, but the home-screen icon is a bookmark rather than a true installed app, and the size limit is 16 MB. Or drag the folder onto Netlify Drop.

**On the Samsung tablet:** open the link in Samsung Internet, then menu (three dots), *Add page to*, *Home screen*. With a valid manifest it offers *Install*. In Chrome: menu, *Add to Home screen* or *Install app*. It then opens full-screen in landscape with the icon on the home page. Open it once while online so the service worker caches everything for offline.

---

## 9. Build plan: Opus 5.5 orchestrating, Haiku 5.5 in parallel

Start a fresh session in this folder with Opus 5.5 and the prompt: *"Read CLAUDE.md, PLAN.md and research/, then build Astra Finn as specified. Use Haiku 5.5 subagents for the parallel tasks in PLAN.md section 9."* This session on Fable 5.1 can also build it directly on request.

**Opus does the integrated, hard parts itself:** the app shell, router, state, the conundrum and guess engines, the Three.js Starship with hotspots, cutaway and launch timeline, the catch game, the PWA plumbing, and deployment.

**Haiku subagents run in parallel.** Each prompt is self-contained and each agent writes only its own files:
1. `content/asteroids.json` from `research/04-images-facts.md` and `research/05-asteroids.md`.
2. `content/mars.json` and `content/mars-living.json` from the facts brief and the Starship and Artemis brief.
3. `content/moonbase.json` and `content/metal.json`.
4. `content/starship.json` from `research/02-starship-artemis.md` and `research/03-videos.md`, including the launch-timeline cards and hotspot copy.
5. Images: download the chosen public-domain and CC images listed in `research/04-images-facts.md` into `assets/img/`, resize with Pillow to 1600 px and 300 KB max, write `CREDITS.md`. Leave out anything whose licence is unclear and say so.
6. Icons and patches: generate PWA icons with Pillow. Draw seven SVG mission patches in the navy, ivory and gold style.
7. QA, after the first integrated build: open the site in the built-in browser at 1280 by 800, tap through every mission, record console errors, text under 20 px, tap targets under 56 px and broken images, and report.

**Phases with acceptance checks:**
- **Phase 1, the MVP that must ship tomorrow:** Mission Control, crew setup, the four-beat engine, Mission 5 Starship complete (model, cutaway, launch, catch game, conundrum, videos), Mission 1 asteroid scale explorer and conundrum, patches and Crew Log, PWA installable, deployed, tested on the tablet. Check: install from the link on the tablet, finish Mission 5 end to end with no console errors, and confirm it works offline after one online visit.
- **Phase 2:** Missions 2, 3, 4 and 6 with their games. Check: every number is traceable to a research URL.
- **Phase 3:** Mission 7 Big Zoom, sound, tilt controls, Crew Log export, polish.

Phase 1 should fit in one Opus session. If time is tight, cut in this order: Big Zoom, Moon base builder, Pack the Ship, Time Machine, tilt controls. Never cut the conundrums, the guesses, the Starship model or the catch game.

---

## 10. Tomorrow's session with Finn (35 minutes)

1. **Crew setup, 2 minutes.** Finn types his name or Dad does. Pick avatars. Read the three rules together.
2. **Mission 5, Starship, 20 minutes.** Spin it. Tap three or four hotspots. Toggle the cutaway and ask "what's in the big tanks?". Guess the height against Big Ben. Press LAUNCH and narrate each beat. Vote on "The Catch", say why, change minds if persuaded. Play Catch the Booster three or four times. Watch the real catch video. Earn the patch.
3. **Mission 1, Asteroids, 10 minutes if attention holds.** Scale Explorer: drag Bennu next to the house, then next to the Eiffel Tower. Vote on "The Moon Rock Problem". Patch.
4. **Debrief in the kitchen, 3 minutes.** "What worked? What didn't? Why?" Dad writes one line in the Crew Log.

Dad's crib sheet lives behind the "Engineer's notes" button on Mission Control: the key numbers for each mission with their comparisons, so nobody has to look anything up mid-session.

---

## 11. Decisions made by assumption

- Finn's age and the one-day deadline drove the choice of a static no-build app over a framework project.
- Collaborative crew roles rather than a two-player contest, following Astra Nova's collaboration-over-competition stance.
- A procedural Starship instead of a downloaded 3D model: no licence risk, no load time, and enough fidelity for a cutaway.
- GitHub Pages as the host because git is already installed. The Artifact route is the fallback.
- Videos are embedded with timestamps rather than downloaded, to respect YouTube terms and keep the app small.
- Sound off by default so the session stays calm.
- Where a fact in this plan is approximate, the content writers must take the exact figure and its URL from the research files.
