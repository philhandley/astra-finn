# Astra Finn: build contract

This file is the exact contract between the core app and every module. `PLAN.md` explains why; this file says what. All numbers come from `research/*.md`.

## 1. File layout

```
index.html                 shell, import map, fonts, SW registration
manifest.webmanifest
sw.js
css/app.css                tokens + shared components (core, written by orchestrator)
js/app.js                  router, state, home, crew setup, mission runner (core)
js/core/*.js               speak.js, store.js, patch.js, ui.js (core)
js/games/<module>.js       one file per interactive module (agents)
content/missions.json      ordered list of mission ids
content/<id>.json          one file per mission (content agents)
assets/img/*.jpg           photos (image agent), credits in assets/img/CREDITS.md
assets/icons/*.png         PWA icons (image agent)
```

No build step. ES modules only. Three.js through the import map:

```html
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
} }
</script>
```

Module code imports `import * as THREE from 'three'` and `import { OrbitControls } from 'three/addons/controls/OrbitControls.js'`.

## 2. Design tokens (defined in css/app.css, use these, never hard-code other colours)

```
--bg #05070d        page background (near-black navy)
--bg-2 #0b1020      raised background
--panel rgba(14,20,38,.78)   glass card background (use with backdrop-filter: blur(12px))
--panel-solid #111a2e
--line rgba(255,255,255,.12)
--ink #f3efe6       main text (warm ivory)
--ink-2 #b9c0cf     secondary text
--ink-3 #7d869a     tertiary text
--gold #f2b544      primary action, Commander colour
--gold-2 #ffd27a
--cyan #5fd4ff      data / Engineer colour
--red #ff6b57       hot / danger (use gently)
--green #6fe3a5     success
--oxygen #7cc4ff    liquid oxygen
--methane #9be8b0   liquid methane
--steel #c9ced6     stainless steel
--radius 18px
--font-display 'Space Grotesk', system-ui, sans-serif
--font-body 'Inter', system-ui, sans-serif
--tap 56px          minimum button height
```

Typography rules: body text 20 px minimum on the tablet, headings in `--font-display`. Buttons at least 56 px tall, touch targets at least 48 px.

Shared classes available from app.css: `.btn` (gold filled), `.btn.ghost` (outline), `.btn.cyan`, `.btn.big` (72 px tall, 26 px text), `.card` (glass panel with padding and radius), `.chip`, `.muted`, `.display` (display font). Modules may use them but must scope any of their own CSS under a unique root class, e.g. `.g-catch`, injected once with a `<style data-module="catch">` tag.

## 3. Interactive module interface

Every file in `js/games/` exports one function:

```js
export async function mount(el, ctx) {
  // el: an empty <div> that fills the stage. position: relative; overflow: hidden.
  //     Size varies (about 1280x620 on the tablet in landscape; must also work 360-1600 wide, 480-1100 tall).
  //     Use a ResizeObserver on el. Never use window size directly.
  // ctx: {
  //   data,        // the step's "data" object from the mission JSON (may be {} - modules must have sensible built-in defaults)
  //   speak(text), // reads text aloud (UK voice). Call on important moments, sparingly.
  //   stopSpeaking(),
  //   log(text),   // adds a line to the Crew Log, e.g. "Caught the booster at 2.1 m/s!"
  //   complete(),  // tells the runner the activity has been done at least once (Next button glows). Safe to call repeatedly.
  //   crew,        // { commander: 'Finn', engineer: 'Dad' }
  //   sound,       // boolean, true if sound is switched on
  //   save(key, value), load(key) // per-module persistent storage (JSON-serialisable)
  // }
  return { destroy() { /* cancel rAF, remove listeners, dispose WebGL, remove injected DOM */ } };
}
```

Rules for every module:
- Pointer events (`pointerdown`, `pointermove`, `pointerup`), `touch-action: none` on interactive canvases. Works with finger and mouse.
- No text smaller than 18 px. Short sentences a six-year-old can follow when read aloud.
- Never show a score that compares the two players. Personal bests (e.g. softest landing) are fine.
- Images: reference `assets/img/<name>.jpg` from the list in section 6. They may not exist yet; fall back gracefully (e.g. a gradient circle) if an image fails to load.
- Sound: if `ctx.sound` is true you may use WebAudio-synthesised sounds (no audio files). Keep them soft.
- Respect `prefers-reduced-motion` where cheap to do so.
- Must not throw if destroyed mid-animation. Must pause rendering when `document.hidden`.
- Self-contained: no imports other than `three` and `three/addons/...`, and no other network calls.

## 4. Module specs

### starship3d.js (Opus)
Procedural Three.js model of Starship version 3 on the launch tower at Starbase. 1 unit = 1 m. Full stack about 124 m: Super Heavy booster about 72 m, Ship about 52 m, both 9 m diameter, brushed stainless steel. Booster: 33 Raptor engine bells (20 outer ring, 13 inner), 4 grid fins near the top, a vented hot-stage ring on top. Ship: ogive nose, 2 small forward flaps and 2 large aft flaps, black hexagonal heat-shield tiles on one side (a dark material on the windward half is fine), 6 engines (3 small sea-level bells in the middle, 3 big vacuum bells around them). Tower: about 146 m lattice tower beside the rocket with two "chopstick" arms and the orbital launch mount (ring on legs) under the booster. Ground plane, subtle fog, a starry or dusk sky gradient, good lighting so the steel reads as steel.

Features:
1. **Explore:** OrbitControls with touch rotate and pinch zoom, gentle auto-rotate when idle. Camera framed so the whole stack fits at start.
2. **Hotspots:** glowing numbered dots attached to parts. Tap one: camera eases toward it, a side card shows the title, one or two sentences, one "wow" line, and a speaker button that calls `ctx.speak`. Hotspot content comes from `ctx.data.hotspots` (array of `{id, title, text, wow}`) with these built-in defaults if missing: `booster-engines`, `ship-engines`, `grid-fins`, `hot-stage`, `lox-tank`, `methane-tank`, `ship-tanks`, `header-tanks`, `payload`, `flaps`, `tiles`, `tower`. Each id maps to a part of the model.
3. **Cutaway:** a toggle button. Slices away the front half of the skin (clipping plane, `renderer.localClippingEnabled = true`) to show inside: big tanks with translucent liquid (oxygen `--oxygen` light blue, methane `--methane` light green; in each stage the oxygen tank is above the methane tank in the booster and in the ship the oxygen tank is below... keep it simple: oxygen on top, methane below, in both stages), the small header tanks in the nose, the payload bay with stacked flat satellites, plumbing lines, and the engines.
4. **Launch:** a big gold LAUNCH button. Runs a 10-second on-screen countdown (numbers large in the middle, spoken via ctx.speak for "3, 2, 1, liftoff"), then a cinematic sequence of about 60 to 90 seconds with a caption card at each beat. Beats, in order, each with a short caption: Ignition (33 engines light), Liftoff (clears the tower), Max-Q ("the air pushes hardest here"), Hot staging (ship engines light while still attached, then they separate), Booster flips and boosts back, Booster comes home and the tower's chopstick arms **catch** it, Ship goes to space (Earth's curve and black sky), Ship falls back belly first like a skydiver with orange plasma glow, Ship flips upright and lights its engines to land (on a second tower or a gentle splashdown, either is fine). Stylised flame (additive-blended cone or particles), smoke/steam cloud at liftoff, camera that follows. Pause and Skip buttons. At the end, a "Fly again" button. Captions come from `ctx.data.launchBeats` if present (array of `{id, caption}` with ids `ignition, liftoff, maxq, hotstage, boostback, catch, space, reentry, flip`), else built-in defaults.
5. Call `ctx.complete()` after the first launch finishes or after three hotspots have been opened.
6. Performance: under about 60k triangles, `renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))`, antialias on, dispose everything on destroy. Target a mid-range Samsung tablet.

UI inside the module (overlaid HTML, not in WebGL): top-right toggle "Cutaway", bottom-centre big "LAUNCH", hotspot card on the right, "Reset view" button.

### catch.js (Opus)
2D canvas game, side view, "Catch the Booster". A Super Heavy booster (tall steel cylinder, grid fins, engines at the bottom) is falling toward the launch tower, which has two chopstick arms. Physics: gravity, three-engine thrust when THRUST is held, sideways steering with LEFT/RIGHT buttons (also arrow keys and space for the PC), gentle wind that changes slowly, a fuel bar. Scale so the tower is about two thirds of the screen height. Catch zone: booster centred between the arms and descending slower than a threshold when the grid fins reach arm height. Outcomes:
- Caught (slow and centred): arms close with a clunk, sparkles, "CAUGHT!", `ctx.speak('Caught it!')`.
- Too fast: a cartoon-free but gentle "pop" of flame and smoke, "Too fast! That's why we test."
- Missed sideways: it splashes beside the tower into the sea area, "Splash! Lost the booster, but everyone is safe."
- Out of fuel: as missed.
Three difficulty levels the Commander picks with big buttons: "Cadet" (slow fall, big catch zone, no wind), "Pilot", "Commander". Default Cadet. Show speed and fuel as big readable gauges, a "softest catch" personal best (save/load), and a catch counter. After each round, a big "Try again" button and a small card that rotates through real facts from `ctx.data.facts` (array of strings) or built-in defaults: Flight 5 in October 2024 was the first catch ever; the tower has caught a booster three times; most early test rockets blew up, and that's how they learned; the arms are nicknamed chopsticks; nobody has caught the Ship yet. `ctx.log` each catch with the speed. `ctx.complete()` after the first round of any outcome. Big on-screen buttons at least 96 px for small hands: THRUST bottom-right, LEFT and RIGHT bottom-left. Make it feel good: screen shake on landing, engine flame flicker, particles, smooth 60 fps.

### scale.js (Opus) - "Size Explorer"
Shows things to true relative scale side by side on a horizon line, with smooth zoom. Two modes chosen by `ctx.data.mode`:
- `"asteroids"` (default): a row of picker chips along the bottom for asteroids (Chelyabinsk rock about 18 m, 2024 YR4 about 60 m, Dimorphos about 160 m, Apophis about 375 m, Bennu about 490 m, Ryugu about 900 m, the dinosaur asteroid about 10 km, Eros about 33 km long, Vesta about 525 km, Ceres about 950 km) and a second row for "compare with" objects (Finn 1.2 m, a London bus 11 m, our house 9 m, Starship 124 m, Big Ben 96 m, a football pitch 105 m long, the Eiffel Tower 330 m, Mount Everest 8.8 km, the whole of Great Britain about 1,000 km long). Pick one of each: both appear side by side to scale, the view zooms smoothly so the bigger one fills about 70% of the height, and a big caption says e.g. "Bennu is as tall as one and a half Eiffel Towers!" (computed). Asteroids drawn as lumpy grey-brown rocks (procedural noisy polygons with a light gradient; use photos from section 6 as textures if they load: chelyabinsk-trail not suitable, use bennu, ryugu, dimorphos, eros, vesta, ceres; procedural for the rest). Comparison objects drawn as clean silhouettes in `--ink-2` with a gold outline (Finn as a simple child silhouette, bus, house, Starship, Big Ben, pitch seen side-on as a flat strip with goals, Eiffel Tower, Everest triangle, Great Britain outline approximate). Speak the caption when it changes.
- `"zoom"` - "The Big Zoom": a single big slider. Left end shows Finn (1.2 m). Sliding right zooms out continuously through: Finn, a house, Starship, the Eiffel Tower, Bennu, Everest, Ceres, the Moon (3,475 km), Mars (6,792 km), Earth (12,756 km), Jupiter (139,820 km), the Sun (1.39 million km). Each object is drawn to scale next to the previous one so as you zoom, the old one shrinks to a dot. A caption names the newest object and one comparison ("The Sun: 109 Earths fit across it!"). Planets use images `moon-full.jpg`, `mars-globe.jpg`, `earth.jpg`, `jupiter.jpg`, `sun.jpg` if present, else nicely shaded gradient circles. Log scale under the hood.
Call `ctx.complete()` after three comparisons (asteroids) or reaching the Sun (zoom).

### planets.js (Opus) - "Planet Lineup and Mars Jump"
Two panels with a toggle at the top:
1. **Lineup:** Earth, Mars and the Moon to scale on a starry background (diameters 12,756 / 6,792 / 3,475 km). Tap a planet for a card: Earth "Our home", Mars "About half as wide as Earth", Moon "About a quarter as wide as Earth". A "Hand-size" button morphs the planets into a football, a grapefruit and a tennis ball with labels.
2. **Jump:** a slider or +/- buttons for "How high can Finn jump on Earth?" (default 30 cm, range 10-80). Press JUMP: three side-by-side scenes (Earth, Mars, Moon) each with a small astronaut figure that jumps in real-time physics using that body's gravity (Earth 9.8, Mars 3.7, Moon 1.62 m/s²), with a ruler showing the height reached (Mars about 2.6 times higher, Moon about 6 times higher) and how long the jump lasted. Big caption: "On the Moon you'd jump as high as Dad is tall!" computed with comparisons (a cat 30 cm, a table 75 cm, Dad 1.8 m, a door 2 m, a bus 4.4 m tall).
`ctx.complete()` after one jump.

### pack.js (Opus) - "Pack the Ship"
A Synthesis-style trade-off game for a six-year-old. A Starship cargo hold with a weight bar (capacity 100 "tonnes" units). A tray of cargo cards with picture icons (drawn with simple SVG/emoji-free shapes or text labels with icons): Water (20), Food (15), Air maker (10), Solar panels (10), Greenhouse (15), Spare parts (10), Medicine (5), Rover (20), 3D printer (10), Toys and books (5), Piano (25), Bikes (10). Drag or tap a card to load it; it flies into the hold and the bar fills. Over capacity, the bar turns red and the LAUNCH button is disabled with "Too heavy! Take something out." When at or under capacity, LAUNCH is enabled. After launching, a "Six months later on Mars..." story screen shows 3 to 4 consequence cards based on what was packed, positive and gentle, e.g. "You brought the greenhouse. Fresh lettuce!", "No spare parts... when the air pump broke, you made a new part with the 3D printer!" or "...you had to wait for the next ship". Midway twist (Synthesis rule change): when the hold first reaches 60+, a radio message pops up: "Mission Control: a fuel tank is leaking. Your ship can now carry 85 tonnes." Capacity drops; the crew must rethink. No score. `ctx.log` the final cargo list. `ctx.complete()` after the first launch.

### delay.js (Opus) - "Say hello to Mars"
A big "Say hello to Mars" button. Earth on the left, Mars on the right with distance between them. Tapping sends a glowing radio pulse that travels across. A big timer counts up. Real delay is 3 to 22 minutes one way; compress it so 1 real minute = 1 second by default, show both "real time" and the "fast-forward" time. When it arrives, a little Mars-base reply comes back the same way: "Hello Finn! It's sunny and minus 60 degrees here." Total about 25 to 40 seconds. A distance switch: "Mars close" (about 3 min) / "Mars far" (about 22 min). End card: "That's why astronauts on Mars must fix things themselves. They can't wait for Earth to answer." Also a Moon comparison button: the Moon answers in about 1.3 seconds (real time, no fast-forward). `ctx.complete()` after one round trip.

### moonbase.js (Opus) - "Build the Moon Base"
A top-down map of the lunar south pole: a big dark crater (permanently shadowed, shows faint frost sparkle) with a bright sunlit rim crescent, grey regolith around it, a few small craters. A tray of six modules with simple icons: Solar tower, Ice miner, Home (habitat), Landing pad, Rover garage, Greenhouse. Drag modules onto the map. Gentle rules give friendly feedback when placed (not failures): Solar tower must be on the sunlit rim ("Sunny spot! Power on."), else "It's too dark here for solar panels. Try the bright rim!"; Ice miner must be inside the dark crater ("Found ice!"); Landing pad must be far from Home ("Good! Rocket dust won't sandblast your house."), else "Whoa, rocket exhaust blasts dust like sandpaper. Move it further away!"; Home near the solar tower. When all six are placed happily, a "Lights on!" moment: the base glows, a little rover drives between garage and miner, and the twist arrives: "Lunar night is coming: two weeks of dark! Where will the power come from?" with three picture choices (Big batteries / A tiny nuclear power plant / Solar towers on the always-sunny rim peaks) each with a one-line real answer (NASA is testing all of these). `ctx.complete()` when the base is lit.

### timemachine.js (Opus) - "The Metal Time Machine"
Pick a place (big picture buttons: Seaside on Earth, the Moon, Mars, Venus, Deep space) and an object (a steel bike, a robot rover). Drag a big time slider: 1 day, 1 year, 10 years, 100 years, 1,000 years, 1 million years. The object (drawn in SVG/canvas) visibly changes: rust patches spread and it crumbles at the seaside over 100+ years; on the Moon it stays shiny but gets tiny pits and a dusty coat and is still there after a million years; on Mars it gets dusty and sandblasted slowly, and paint fades; on Venus it glows hot and the rover stops working after about 2 hours (show "Venera 13 lasted 127 minutes!") and slowly corrodes in acid clouds; in deep space it barely changes at all (Voyager 1 still flying since 1977). A caption under the slider explains why in one sentence per place and time. Facts (sources in research/04): Apollo landers still visible on the Moon after 50+ years; micrometeorites; Opportunity rover built for 90 days lasted about 15 years; Curiosity's aluminium wheels have holes from sharp rocks; Venus about 465 °C; Venera 13 lasted 127 minutes; Voyager 1 still working since 1977; rust needs water and oxygen. `ctx.complete()` after trying three places.

## 5. Mission content JSON (content/<id>.json)

```json
{
  "id": "starship",
  "title": "Starship",
  "tagline": "The biggest rocket ever flown",
  "accent": "gold",
  "hero": "assets/img/starship-liftoff.jpg",
  "minutes": 15,
  "patch": { "name": "Booster Catcher", "icon": "rocket" },
  "dadNotes": ["Key number with comparison...", "..."],
  "steps": [ ... ]
}
```

`accent` is one of gold, cyan, red, green. `patch.icon` is one of rocket, asteroid, planet, astronaut, moon, bolt, zoom.

Step types:

```json
{ "type": "story", "title": "Short title", "img": "assets/img/x.jpg", "credit": "NASA/JPL",
  "text": "One to three short sentences.", "wow": "Optional big number line, e.g. 33 engines!",
  "dad": "Optional prompt for Dad, e.g. Ask: what do you think is inside?", "source": "https://..." }

{ "type": "guess", "title": "Guess!", "prompt": "Is Bennu bigger than the Eiffel Tower?",
  "choices": [ { "label": "Smaller", "img": "optional" }, { "label": "About the same" }, { "label": "Bigger" } ],
  "answer": 2, "reveal": "Bigger! Bennu is about 490 m across...", "img": "optional reveal image", "source": "https://..." }

{ "type": "play", "module": "catch", "title": "Catch the Booster", "intro": "One sentence on what to do.", "data": { } }

{ "type": "question", "title": "Big Question", "scenario": "Two or three short sentences.",
  "img": "optional", "options": [ { "label": "Short choice", "detail": "One short line" } ],
  "reveal": "What really happened or what grown-ups argue about. Never says which is right.",
  "followUp": "One question for talking about." }

{ "type": "video", "title": "Watch the real catch", "youtubeId": "hI9HQfCAw64", "start": 0,
  "channel": "SpaceX", "why": "One line on what to look for.", "warning": "Optional, e.g. It's loud!" }

{ "type": "athome", "title": "Try it at home: Balloon rocket", "need": ["a balloon", "string", "a straw", "tape"],
  "steps": ["Short instruction", "..."], "why": "One sentence explaining the science." }

{ "type": "finish", "debrief": ["What was your favourite part?", "One mission-specific question"] }
```

Writing rules: one to three sentences per card, simple words a six-year-old understands when read aloud, one number per card, always with a comparison he can picture (Dad, a bus, our house, a football pitch, Big Ben, the Eiffel Tower). No violence or suffering. Gentle about explosions (rockets with nobody inside). Never say an option in a Big Question is wrong. Every story or guess with a number has a `source` URL from `research/`. British English (colour, metres, aluminium).

## 6. Image filenames (assets/img/)

From `research/04-images-facts.md` table (number in brackets):
starship-pad (1), starship-liftoff (2), booster-return (3), mars-globe (6), olympus-mons (7), valles-marineris (8), perseverance-selfie (9), ingenuity (10, first frame of the GIF), mars-sunset (11), curiosity-wheel (12), moon-basecamp (13), shackleton (14), apollo17-rover (15), apollo11-lro (16), earth-from-orion (17), bennu (18), ryugu (19), dimorphos (20), vesta (21), ceres (22), eros (23), chelyabinsk-trail (25), itokawa (26), venera13 (27).

Extra, found from NASA's image library (images-api.nasa.gov, public domain): earth (Apollo 17 Blue Marble, as17-148-22727), moon-full (a full Moon disc), jupiter (a full Jupiter disc, e.g. Juno or Cassini), sun (an SDO full-disc image), voyager (Voyager spacecraft), opportunity (Opportunity rover artist's concept or real image), artemis2-crew (Artemis II crew photo, NASA), artemis2-launch (Artemis II or Artemis I SLS launch photo), moxie (MOXIE instrument), iss-lettuce (Veggie lettuce on ISS).

All JPEG, longest side 1600 px max, under 300 KB where possible, planet discs on black background.

## 7. Mission list (content/missions.json order)

1. `starship` - Starship (centrepiece)
2. `asteroids` - How big are asteroids?
3. `mars` - How big is Mars?
4. `mars-life` - Getting to Mars and living there
5. `moon` - The Moon base
6. `metal` - How long does metal last?
7. `zoom` - The Big Zoom
