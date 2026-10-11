// Engineer's notes: a crib sheet for the grown-up.
import { h, esc } from './dom.js';
import { icon } from './icons.js';
import { store, crew } from './store.js';
import { confirmBox, toast } from './ui.js';
import { KIT_SLOTS } from './song.js';

const MISSIONS = [
  ['m1', 'The Silent Game', 'What chiptune is; the four sound shapes as four robots; listening', '—', 'The Bump sound'],
  ['m2', 'Sound Shapes', 'How waveforms shape sound: square, triangle, saw, noise; pulse width; draw a wave (like the Game Boy)', '—', 'Our Bot (a drawn wave)'],
  ['m3', 'High and Low', 'Pitch: fast wiggles sound high; up and down; the Lift game', '—', 'The Star sound'],
  ['m4', 'Beat and Rhythm', 'Pulse, rhythm and tempo; drums from noise; marching and freeze dance', 'The Speed Problem', 'The Beat, and the game speed'],
  ['m5', 'Make a Tune', 'Melody from pitch plus rhythm; call and response; the five magic (pentatonic) notes', 'The Sharing Problem', 'The Win tune'],
  ['m6', 'Game Sounds Lab', 'Sound-effect recipes; effects (wobble, echo, slide, sparkle); channels', 'The Channel Problem', 'The Jump sound'],
  ['m7', 'Happy and Sad Chords', 'Chords; major and minor; arpeggios; a four-chord progression', 'The Ending', 'The Chords'],
  ['m8', 'Our Game, Our Song', 'Composing on four channels; the tracker; a rule change halfway', '—', 'The Music, then the whole game'],
];

const GLOSSARY = [
  ['Chiptune', 'Music made with the sound chip of an old console or computer, or made to sound like one.'],
  ['Channel', 'One voice the chip can play at a time. The NES had two pulse, one triangle, one noise and one sample channel; the Game Boy two pulse, one wave and one noise.'],
  ['Square / pulse wave', 'Bleep. A hollow, beepy sound. The pulse width (12.5%, 25%, 50%) makes it thinner or fuller.'],
  ['Triangle wave', 'Hoot. Softer and sweeter. The NES triangle has 32 steps, so it sounds slightly stepped; it was often the bass.'],
  ['Sawtooth wave', 'Buzz. Full and buzzy, with every harmonic. The Commodore 64’s SID chip had one.'],
  ['Noise', 'Fizz. A hiss used for drums and crashes, made by a shift register (LFSR).'],
  ['Wave channel', 'The Game Boy’s drawable wave: 32 steps, each one of 16 heights. Our Wave Drawer copies it.'],
  ['Pitch', 'How high or low a note is. Faster wiggles (a higher frequency) sound higher. Concert A is 440 wiggles (hertz) a second.'],
  ['Pulse, rhythm, tempo', 'The pulse is the steady beat; the rhythm is the pattern of long and short sounds on top; the tempo is how fast the beat goes.'],
  ['Pentatonic', 'A five-note scale (here C, D, E, G and A). Any of its notes sound fine together, so it is used for "no wrong notes" improvising.'],
  ['Chord, major, minor', 'Notes played together. Major chords (Home, Sunny, Ready) are often heard as bright; minor chords (Rainy, Dreamy, Cloudy) as darker.'],
  ['Arpeggio ("sparkle")', 'A chord’s notes played one after another very fast. Chiptune composers used it to suggest chords on one channel.'],
  ['Vibrato ("wobble")', 'A quick wobble in pitch.'],
  ['Tracker', 'Music software where the song runs down the screen, one row per step. Little Sound DJ is a tracker for the Game Boy.'],
  ['Chord progression', 'A sequence of chords, such as Home, Rainy, Sunny, Ready (C, Am, F, G).'],
];

const VIDEOS = [
  ['3-xKZKxXuu0', 'What is Sound?', 'SciShow Kids', 'How sound is made and reaches our ears. Missions 2 and 3.'],
  ['r1XMR-vxGes', 'High, Low, Freeze and Go!', 'Music Fun with Julia!', 'A pitch and movement song the Co-pilot can join in with. Mission 3.'],
  ['la3coK5pq5w', 'NES Audio: Brief Explanation of Sound Channels', 'explod2A03', 'Square, triangle and noise on a real NES, for a grown-up to narrate. Missions 1 and 8.'],
  ['8Y7Mo1EVva8', 'Chiptune Music: Little Sound DJ Tracker on a Classic Game Boy', 'F32.0', 'A whole tune made on a real Game Boy. Mission 8.'],
];

const SOURCES = [
  ['Game Boy dates', 'https://en.wikipedia.org/wiki/Game_Boy'],
  ['Game Boy sound channels and the 32-step wave', 'https://gbdev.io/pandocs/Audio.html'],
  ['NES sound channels, the 32-step triangle, noise', 'https://www.nesdev.org/wiki/APU'],
  ['Commodore 64 SID chip: 3 voices, 4 waveforms', 'https://en.wikipedia.org/wiki/MOS_Technology_6581'],
  ['Space Invaders: four-note loop that speeds up', 'https://en.wikipedia.org/wiki/Space_Invaders'],
  ['Super Mario Bros. music: four channels, noise for rhythm', 'https://en.wikipedia.org/wiki/Super_Mario_Bros._theme'],
  ['Sound effects taking over a music channel on the NES', 'https://elite.bbcelite.com/deep_dives/sound_effects_in_nes_elite.html'],
  ['Arpeggios on chips with few voices', 'https://www.ludomusicology.org/2015/07/16/compositional-strategies-for-programmable-sound-generators-with-limited-polyphony/'],
  ['Little Sound DJ', 'https://www.littlesounddj.com/'],
  ['Concert A is 440 Hz', 'https://en.wikipedia.org/wiki/A440_(pitch_standard)'],
  ['Kitchen experiments', 'https://www.science-sparks.com/how-can-you-see-sound'],
];

export function renderNotes(app, DATA, topbar) {
  const c = crew();
  const s = store.state;
  const v = h(`<section class="view"></section>`);
  v.appendChild(topbar({ title: "Engineer's notes" }));
  const body = h(`<div class="scroll" style="flex:1"><div class="notes">
    <div class="card col gap">
      <h2>How a session works</h2>
      <p>Each mission takes 8 to 15 minutes. ${esc(c.commander)} (Commander) makes the final calls and does the trickier steps. ${esc(c.copilot)} (Co-pilot) has the big-button steps, marked with a pink badge at the bottom of the screen. You, ${esc(c.engineer)}, run the movement games, read aloud if the voice is off, and ask questions.</p>
      <p>Every mission follows the same rhythm: <b>a problem</b> (usually something missing from Moon Run), <b>a guess first</b> (Commander, then Co-pilot, then you), <b>hands-on play</b>, a <b>Big Question</b> in four missions, then the crew <b>makes something</b> for the game, and a <b>debrief and a patch</b>. Any step can be skipped with Next. If the Co-pilot wanders off, carry on and call them back for their badge steps.</p>
      <p>Your three rules: the children have a go first and you never give the answer away; ask "What does it sound like?" and "Why?" more than you explain; there are no wrong notes, and changing your mind earns a star.</p>
    </div>
    <div class="card col gap">
      <h2>The Astra Nova bits</h2>
      <p><b>Problem first.</b> Moon Run starts silent; each mission fills one of its sound slots, so there is always a reason to learn the next thing.</p>
      <p><b>Big Questions</b> (Missions 4 to 7) have no right answer. Everyone votes, says why out loud, hears the others, and may change their mind for a star. The reveal says what real game makers did, which is usually "all of these". The Commander's choice changes the game: its speed, how the crew share the tune, whether sound effects borrow a music channel, and how the ending feels.</p>
      <p><b>A rule change.</b> In Mission 8 the "game designer" asks for faster music halfway through writing the song. Let the crew argue it out, then the Commander decides.</p>
      <p><b>Reflection.</b> Every mission ends with "What was your favourite part?" plus one question. Type a line in the Crew Log if you like.</p>
    </div>
    <div class="card col gap">
      <h2>What each mission teaches</h2>
      <table><tr><th>Mission</th><th>Teaches</th><th>Big Question</th><th>The crew makes</th></tr>
      ${MISSIONS.map(([id, t, what, q, make], i) => `<tr><td><b>${i + 1}. ${esc(t)}</b>${store.isDone(id) ? ' ✓' : ''}</td><td>${esc(what)}</td><td>${esc(q)}</td><td>${esc(make)}</td></tr>`).join('')}
      </table>
      <p class="muted" style="font-size:17px">The original course goals this follows: understand how waveforms shape sound (M1, M2, M6); write melodies using pitch and rhythm (M3, M4, M5); explore chord progressions (M7); design game sound effects (M6) and compose in a tracker (M8).</p>
    </div>
    <div class="card col gap">
      <h2>School words</h2>
      <p><b>Key Stage 1 music</b> (the National Curriculum, gov.uk): pupils should be taught to "play tuned and untuned instruments musically", "listen with concentration and understanding to a range of high-quality live and recorded music" and "experiment with, create, select and combine sounds using the interrelated dimensions of music" (pitch, duration, dynamics, tempo, timbre, texture, structure).</p>
      <p><b>Model Music Curriculum, Years 1 and 2:</b> "Walk, move or clap a steady beat with others" (Mission 4), "comparing high and low sounds" (Mission 3), "Understand that the speed of the beat can change" (Mission 4), call-and-response and "a musical conversation" (the Echo game, Mission 5), "Include pentatonic songs" (the magic notes), and dot notation matched to short tunes (the Song Maker grid is a kind of dot notation).</p>
      <p><b>Early years</b> (Development Matters, ages 3 and 4): "listen with increased attention to sounds", "respond to what they have heard, expressing their thoughts and feelings", "play instruments with increasing control to express their feelings and ideas". Adults are asked to "clap or tap to the pulse" with children.</p>
      <p class="muted" style="font-size:17px">Quoted from gov.uk; full references in the app's research notes. UK guidance for 2 to 5-year-olds (Best Start in Life, 2026) suggests about an hour of screen time a day at most, ideally shared. Missions are short and full of moving about for that reason.</p>
    </div>
    <div class="card col gap">
      <h2>Glossary</h2>
      <table>${GLOSSARY.map(([w, d]) => `<tr><td style="width:220px"><b>${esc(w)}</b></td><td>${esc(d)}</td></tr>`).join('')}</table>
    </div>
    <div class="card col gap">
      <h2>Watch together</h2>
      <p class="muted">These open in YouTube and need the internet. They were checked to exist but not watched: please preview the first minute yourself first.</p>
      <table>${VIDEOS.map(([id, t, ch, why]) => `<tr><td><a href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener">${esc(t)}</a><br><span class="faint" style="font-size:15px">${esc(ch)}</span></td><td>${esc(why)}</td></tr>`).join('')}</table>
    </div>
    <div class="card col gap">
      <h2>Where the facts come from</h2>
      <ul>${SOURCES.map(([t, u]) => `<li>${esc(t)}: <a href="${u}" target="_blank" rel="noopener">${esc(u.replace(/^https:\/\//, ''))}</a></li>`).join('')}</ul>
    </div>
    <div class="card col gap">
      <h2>Settings</h2>
      <p>Moon Run sound kit: ${KIT_SLOTS.map(sl => `${esc(sl.name)} ${s.kit?.[sl.id] ? '✓' : '·'}`).join(', ')}. Saved songs: ${(s.songs || []).filter(x => !String(x.id).startsWith('demo-')).length}. Changed-mind stars: ${s.stars || 0}.</p>
      <div class="row gap wrap">
        <a class="btn" href="#/log">${icon('log')} Crew Log</a>
        <a class="btn" href="#/setup">${icon('edit')} Crew names</a>
        <button class="btn" type="button" data-a="kit">${icon('refresh')} Empty the Moon Run kit</button>
        <button class="btn" type="button" data-a="reset">${icon('trash')} Start everything again</button>
      </div>
      <p class="faint" style="font-size:15px">Everything is stored on this tablet only (no accounts, no tracking). Astra Bleeps works offline after one visit.</p>
    </div>
  </div></div>`);
  body.querySelector('[data-a=kit]').addEventListener('click', async () => {
    if (await confirmBox('Empty the Moon Run kit?', 'The game goes silent again, ready to fill from Mission 1. Saved songs stay in the Jukebox.', 'Empty it', 'Keep it')) {
      store.set({ kit: {}, choices: {} });
      toast('Moon Run is silent again.');
      renderNotes(app, DATA, topbar);
    }
  });
  body.querySelector('[data-a=reset]').addEventListener('click', async () => {
    if (await confirmBox('Start everything again?', 'Patches, stars, the Crew Log, the Moon Run kit and saved songs will all be cleared. Crew names stay.', 'Clear everything', 'Keep it')) {
      store.reset();
      toast('All clear. A fresh start!');
      location.hash = '#/';
    }
  });
  v.appendChild(body);
  app.replaceChildren(v);
}
