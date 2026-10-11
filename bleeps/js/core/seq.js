// Look-ahead sequencer ("A Tale of Two Clocks"): a 25 ms timer schedules steps about 120 ms ahead
// on the audio clock, and requestAnimationFrame reports each step to the screen as it sounds.
import { ensure, now, stopAll } from './chip.js';

const AHEAD = 0.12;

export class Sequencer {
  // opts: { steps: () => number, stepDur: step => seconds, schedule: (step, time, dur) => void,
  //         onStep: step => void, onEnd: () => void, loop: true }
  constructor(opts) {
    this.o = { loop: true, ...opts };
    this.playing = false;
    this.timer = null;
    this.raf = 0;
    this.queue = [];
    this.endAt = null;
  }

  get steps() { const s = this.o.steps; return typeof s === 'function' ? s() : s; }

  start(fromStep = 0) {
    const a = ensure();
    if (!a) return false;
    this.stop(false);
    this.playing = true;
    this.step = fromStep;
    this.next = a.currentTime + 0.06;
    this.endAt = null;
    this.queue = [];
    this.timer = setInterval(() => { this.tick(); this.flush(); }, 25);
    this.tick();
    // Screen updates ride on animation frames for smoothness, and on the timer as a fallback
    // (some tablets and hidden panes pause animation frames).
    const draw = () => {
      if (!this.flush()) return;
      this.raf = requestAnimationFrame(draw);
    };
    this.raf = requestAnimationFrame(draw);
    return true;
  }

  // Report steps that have sounded. Returns false once the sequence has finished.
  flush() {
    if (!this.playing && this.endAt === null) return false;
    const t = now();
    while (this.queue.length && this.queue[0].t <= t + 0.01) {
      const q = this.queue.shift();
      try { this.o.onStep && this.o.onStep(q.step, q.t); } catch (e) { console.error(e); }
    }
    if (this.endAt !== null && t >= this.endAt) {
      this.endAt = null;
      this.playing = false;
      clearInterval(this.timer);
      this.timer = null;
      try { this.o.onEnd && this.o.onEnd(); } catch (e) { console.error(e); }
      return false;
    }
    return true;
  }

  tick() {
    if (!this.playing || this.endAt !== null) return;
    const t = now();
    // After the tab was hidden the timer falls behind: skip ahead instead of firing a burst of notes.
    if (this.next < t - 0.05) this.next = t + 0.05;
    while (this.next < t + AHEAD) {
      const n = this.steps;
      if (this.step >= n) {
        if (this.o.loop && n > 0) this.step = 0;
        else { this.endAt = this.next; return; }
      }
      const dur = this.o.stepDur(this.step);
      try { this.o.schedule(this.step, this.next, dur); } catch (e) { console.error(e); }
      this.queue.push({ step: this.step, t: this.next });
      this.next += dur;
      this.step++;
    }
  }

  // Jump to a step on the next tick (used when the crew taps a page while playing).
  seek(step) { this.step = step; }

  stop(silence = true) {
    const was = this.playing || this.endAt !== null;
    this.playing = false;
    this.endAt = null;
    clearInterval(this.timer);
    this.timer = null;
    cancelAnimationFrame(this.raf);
    this.queue = [];
    if (silence && was) stopAll();
  }
}
