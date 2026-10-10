# Images and scale facts (verified 10 Oct 2026)

Researched 10 Oct 2026 by a Haiku 5.5 agent.

**Key caveats**
- NASA's Starship HLS renders are credited to SpaceX, so they are not public domain.
- The SpaceX Flickr licence could not be confirmed (the page showed no photos or licence). Prefer the Wikimedia Commons Starship photos below, which carry explicit CC licences.
- Apophis's size, Ryugu's diameter and several Part B values conflict across sources. Flagged below.

## Part A: Images

Every NASA URL returned HTTP 200 as a JPEG. The Commons URLs were confirmed through the Commons API but the download was rate-limited, so spot-check those in a browser. Downloader: fetch with a normal browser User-Agent, resize to 1600 px max, save as JPEG quality 80, record credit and licence in `assets/img/CREDITS.md`.

| # | Subject | Direct URL | Credit | Licence |
|---|---|---|---|---|
| 1 | Starship on pad, Starbase | https://upload.wikimedia.org/wikipedia/commons/3/33/Starship_SN9_Launch_Pad.jpg | Jared Krahn | CC BY-SA 4.0 |
| 2 | Starship lift-off, IFT-5 | https://upload.wikimedia.org/wikipedia/commons/4/4a/SpaceX_Starship_ignition_during_IFT-5.jpg | Steve Jurvetson (Flickr) | CC BY 2.0 |
| 3 | Booster returning to tower, Flight 5 | https://upload.wikimedia.org/wikipedia/commons/e/e9/Starship_Booster_Return_on_Final_Approach_%2854063904149%29.jpg | Steve Jurvetson | CC BY 2.0 |
| 4 | SpaceX's own photos | https://www.flickr.com/photos/spacexphotos/ | "Official SpaceX Photos" | Not verified; avoid unless checked |
| 5 | NASA Starship HLS render | https://www.nasa.gov/wp-content/uploads/2024/11/11-03-24-artemis-3-on-surface.jpg | SpaceX | Not public domain; avoid |
| 6 | Mars full globe (Viking) | https://images-assets.nasa.gov/image/PIA02992/PIA02992~orig.jpg | NASA/USGS | NASA (public domain) |
| 7 | Olympus Mons | https://images-assets.nasa.gov/image/PIA26055/PIA26055~orig.jpg | NASA/JPL-Caltech/ASU | NASA |
| 8 | Valles Marineris | https://images-assets.nasa.gov/image/PIA00422/PIA00422~orig.jpg | NASA/JPL/USGS | NASA |
| 9 | Perseverance selfie, May 2025 | https://upload.wikimedia.org/wikipedia/commons/4/4d/PIA26574-Mars-PerseveranceRover-Selfie-20250510.jpg | NASA/JPL-Caltech/MSSS | NASA; Commons licence field blank |
| 10 | Ingenuity and Perseverance | https://upload.wikimedia.org/wikipedia/commons/c/c0/Mars_2020_selfie_containing_both_perseverance_rover_and_ingenuity.gif | NASA | Public domain |
| 11 | Mars sunset from rover (Spirit, 2005) | https://www.nasa.gov/wp-content/uploads/2025/05/pia07997.jpg | NASA/JPL-Caltech/Texas A&M/Cornell | NASA |
| 12 | Curiosity damaged wheel (sol 411) | https://upload.wikimedia.org/wikipedia/commons/b/ba/Curiosity_rover%27s_damaged_left_front_wheel%2C_sol_411.jpg | NASA/JPL-Caltech/MSSS | Public domain |
| 13 | Artemis Base Camp, south pole | https://www.nasa.gov/wp-content/uploads/2020/10/surface-1024x576-1.jpg | NASA | NASA |
| 14 | Shackleton crater | https://science.nasa.gov/wp-content/uploads/2024/01/faces-of-shackleton.jpg | NASA/GSFC/ASU/JHUAPL/MIT/SwRI | NASA |
| 15 | Apollo 17 lunar rover | https://upload.wikimedia.org/wikipedia/commons/4/4d/NASA_Apollo_17_Lunar_Roving_Vehicle.jpg | NASA / H. Schmitt | Public domain |
| 16 | Apollo 11 descent stage, LRO | https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/39000/39408/apollo11_lro_2009193_lrg.jpg | LROC/NASA GSFC/ASU | NASA |
| 17 | Earth from Orion (Artemis I) | https://images-assets.nasa.gov/image/art001e003003/art001e003003~orig.jpg | NASA | NASA; crescent Earth past the solar array |
| 18 | Bennu (2018 mosaic) | https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/b/bennu_dec10.png | NASA/Goddard/U. Arizona | NASA |
| 19 | Ryugu (Hayabusa2) | https://upload.wikimedia.org/wikipedia/commons/d/da/Asteroid_Ryugu_%28ann19006a%29.jpg | JAXA et al. | CC BY 4.0 |
| 20 | Dimorphos (DART final image) | https://upload.wikimedia.org/wikipedia/commons/0/07/Dart_0401930049_43695_Final_image.png | NASA/JHU APL | Public domain |
| 21 | Vesta (Dawn) | https://images-assets.nasa.gov/image/PIA14317/PIA14317~orig.jpg | NASA/JPL | NASA |
| 22 | Ceres (Dawn, Occator) | https://images-assets.nasa.gov/image/PIA20350/PIA20350~orig.jpg | NASA/JPL | NASA |
| 23 | Eros (NEAR) | https://images-assets.nasa.gov/image/PIA03141/PIA03141~orig.jpg | NASA/JPL/JHUAPL | NASA |
| 24 | Chelyabinsk dashcam still | https://www.esa.int/var/esa/storage/images/esa_multimedia/images/2014/06/chelyabinsk_fireball/14573452-1-eng-GB/Chelyabinsk_fireball_pillars.png | englishrussiatv, via ESA | ESA Standard Licence; avoid |
| 25 | Chelyabinsk trail (not dashcam) | https://upload.wikimedia.org/wikipedia/commons/d/d4/2013_Chelyabinsk_meteor_trace.jpg | Alex Alishevskikh | CC BY-SA 2.0 |
| 26 | Itokawa (Hayabusa) | https://upload.wikimedia.org/wikipedia/commons/4/48/Itokawa06_hayabusa.jpg | ISAS/JAXA | CC BY 4.0 |
| 27 | Venera 13 surface, colour | https://upload.wikimedia.org/wikipedia/commons/a/a0/V13_vg261_262.tif | USSR/NASA (NSSDC archive) | Public domain per Commons; see caveat |

**Venera caveat:** Don Mitchell's processed versions are copyrighted (APOD credit: "Donald Mitchell and Michael Carroll for processing and copyright", https://www.astronet.ru/db/xware/msg/1730387). Use the raw NSSDC TIFF (https://nssdc.gsfc.nasa.gov/imgcat/html/object_page/v13_vg261_262.html) converted to JPEG with Pillow.

## Part B: Facts

**1. Diameters (km unless noted)**
- Earth 12,756 (equatorial): https://starchild.gsfc.nasa.gov/docs/StarChild/solar_system_level1/earth_facts.html
- Mars ~6,792 (equatorial radius 3,396.2 doubled): https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
- Moon ~3,475 (mean radius 1,737.4 doubled): https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html
- Ceres ~950 (NASA radius 476 km): https://science.nasa.gov/dwarf-planets/ceres/facts/
- Vesta ~525–530 (not NASA-verified): https://spectrum.ieee.org/nasas-dawn-makes-history-by-orbiting-a-dwarf-planet
- Eros 33 long, 33×13×13 (NASA PIA03141): https://pds-rings.seti.org/press_releases/pages/PIA03xxx/PIA03141.html
- Ryugu ~850–900 m: https://en.wikipedia.org/wiki/162173_Ryugu
- Bennu ~492 m mean: https://arcnav.psi.edu/urn:nasa:pds:context:target:asteroid.101955_bennu
- Apophis, conflicting: ESA uses 375 m (see `05-asteroids.md`), Herschel gave 325±15 m, radar 340–450 m. Use "about 375 m" with the ESA source.
- Dimorphos ~160 m long; Didymos ~780 m: https://www.lpl.arizona.edu/index.php/missions/dart
- Itokawa 535 × 294 × 209 m: https://en.wikipedia.org/wiki/25143_Itokawa
- Chelyabinsk ~17–20 m: https://www.jpl.nasa.gov/news/additional-details-on-the-large-feb-15-fireball-over-russia/
- Chicxulub ~10 km (7–15 km range; NASA not confirmed): https://space.com/dinosaur-impactor-origin
- 2024 YR4 60 ± 7 m (JWST, Mar 2025): https://aasnova.org/2025/04/01/an-update-on-asteroid-2024-yr4-from-jwst/

**Hand-size model (derived):** Earth 12,756 km as a 22 cm football gives Mars 11.7 cm (a grapefruit) and the Moon 6 cm (a tennis ball is 6.7 cm). Starship 124 m next to Finn at 1.2 m is about 100 Finns tall.

**2. Mars** (NASA fact sheet unless noted: https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)
- Gravity 38% of Earth (0.380).
- Day 24 h 39 min; year 687 Earth days.
- Average temperature about −59 °C (other sites say −63 °C).
- Pressure 6.36 mbar, about 0.6% of Earth.
- Distance 54.6 million km (closest) to 401.4 million km (farthest).
- Trip ~6–9 months with chemical rockets: https://www.popsci.com/science/how-long-does-it-take-to-get-to-mars/
- Olympus Mons 21.9 km (NASA PIA26055: https://science.nasa.gov/photojournal/pj-olympus-mons-26/). Older captions say 25 km. Everest is 8.8 km, so about two and a half Everests.
- Moons: Phobos and Deimos.
- Pinkish-tan sky from fine iron-oxide dust (secondary only): https://www.universetoday.com/articles/why-is-mars-red
- Blue sunset: recorded by Curiosity, per CBC: https://amp.cbc.ca/lite/story/1.2970932. NASA's Spirit page says the blue halo in that image is partly a filter artefact: https://www.nasa.gov/image-article/sunset-on-mars/
- Light delay Earth to Mars: 3 to 22 minutes one way (derived from distance range; verify with NASA).

**3. Moon**
- Distance 384,400 km (fact sheet).
- Gravity 1.62 m/s², 16.5% of Earth (fact sheet).
- Day and night each about 14.75 Earth days (synodic 29.53 days).
- Equator temperature range 95 K to 390 K, about −178 °C to +117 °C (fact sheet).
- Shadowed craters reach about 40 K (about −233 °C). Secondary source only.
- Water ice: LCROSS (2009) found water in impact debris: https://skyandtelescope.org/astronomy-news/direct-evidence-of-water-ice-at-the-moons-poles/ (snippet only)

**4. How long metal lasts**
- Moon: no rust, but micrometeorites hit at over 33,000 mph. Apollo hardware and tracks are still visible in LRO images. Timescale 10–100 million years: https://space.com/12846-apollo-moon-landing-sites-flags-footprints.html. Apollo retroreflectors lost about 10× efficiency from dust: https://ar5iv.arxiv.org/html/1003.0713
- Mars, Opportunity: designed for 90 sols, ran 5,352 sols (about 15 years), mission ended 13 Feb 2019: https://astrobiology.nasa.gov/news/opportunity-rover-mission-comes-to-an-end/
- Mars, Curiosity: aluminium wheels torn by embedded sharp rocks: https://robotics.jpl.nasa.gov/media/documents/Rimmed_Wheel_Performance_on_the_Mars_Science_Laboratory_Scarecrow_Rover.pdf. March 2026 photos show worse damage: https://petapixel.com/2026/03/25/theres-an-even-larger-hole-in-the-wheel-of-nasas-mars-curiosity-rover/
- Mars atmosphere is under 1% of Earth's pressure and mostly CO2 (secondary). Perchlorate claims not verified.
- Venus, Venera 13: 127 minutes (landed 1 Mar 1982), about 457–467 °C and about 90 bar: https://scienceblog.com/t-in-1982-soviet-venera-13-survived-127-minutes-on-venus/
- Other Venera records: Venera 12 110 min; Venera 14 57 min; Venera 10 at least 65; Venera 9 at least 53; Venera 7 about 23 on the surface: https://en.wikipedia.org/wiki/Venera_7
- Earth: iron rusts when water and oxygen are both present (common knowledge). Stainless 304 not verified.
- Starship material: Musk says carbon fibre is limited to about 300 °F and steel handles 1,500–1,600 °F. Stainless is cheaper, tough at cryogenic temperatures, and damaged parts can be re-welded: https://space.com/43101-elon-musk-explains-stainless-steel-starship.html
- Deep space: clean metal surfaces in vacuum can cold-weld. Galileo's antenna ribs stuck this way: https://www.livescience.com/chemistry/why-does-metal-stick-together-in-space
- Voyager 1 (2026): NASA lists it in the Extended Mission and reports an instrument shut off on 17 Apr 2026 to save power: https://science.nasa.gov/mission/voyager/. About 25.7 billion km away as of Feb 2026, with a 23.5-hour light delay: https://popsci.com/science/voyager-one-light-day-earth

**5. Rocket numbers**
- Starship stack about 124 m for version 3 (see `02-starship-artemis.md`); booster liftoff thrust about 74 MN (aggregator, flagged): https://orbitalradar.com/launch-vehicles/starship
- Big Ben (Elizabeth Tower) 96.3 m. Starship is about 25% taller: https://webtest.parliament.uk/about/living-heritage/building/palace/architecture/palacestructure/towers-of-parliament
- Statue of Liberty about 93 m, base of pedestal to torch. Starship is about 30% taller: https://en.wikipedia.org/wiki/Statue_of_Liberty
- Eiffel Tower 330 m to tip. Starship is about 37% of its height: https://lenz.io/c/eiffel-tower-height-330-meters-5c8ef639
- Raptor 3 sea-level thrust about 280 tonne-force per a SpaceX 2024 card; Wikipedia gives 250 tf sea level and 275 tf vacuum: https://en.wikipedia.org/wiki/SpaceX_Raptor
- Propellant mass: booster about 3,650 t, ship about 1,600 t per Wikipedia (see `02-starship-artemis.md`).

**Could not verify or sources conflict:** Apophis size; Ryugu; Vesta and Ceres NASA values; Chicxulub from NASA; Mars −59 vs −63 °C; Venera pressure; Raptor thrust; Statue of Liberty base; Moon shadowed-crater temperatures; SpaceX Flickr licence; Commons licence blank for item 9.
