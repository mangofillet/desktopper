// Minimal audio manager. Track files are user-supplied via portfolio.json —
// nothing autoplays; everything starts from an explicit click.
import { asset } from "./assets.js";

const channels = {}; // name → HTMLAudioElement
const AMB_VOL = 0.16;

function fadeEl(el, to, dur) {
  // A new fade supersedes any in-progress one on the same element, so the
  // birdsong fade-in and the pause-fade can't fight and leave the birds on.
  const id = (el._fadeId = (el._fadeId || 0) + 1);
  const from = el.volume;
  const t0 = performance.now();
  const step = () => {
    if (el._fadeId !== id) return; // superseded by a newer fade
    const k = dur ? (performance.now() - t0) / (dur * 1000) : 1;
    if (k >= 1) {
      el.volume = to;
      return;
    }
    el.volume = Math.max(0, from + (to - from) * k);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function playTrack(track, channel = "main") {
  stopTrack({ fade: 0, channel });
  if (!track?.url) return false;
  const el = new Audio(asset(track.url));
  el.loop = true;
  el.volume = 0.75;
  el.play().catch(() => {});
  channels[channel] = el;
  pauseAmbience(); // the birds hush while music is on
  return true;
}

export function stopTrack({ fade = 1.2, channel = "main" } = {}) {
  const el = channels[channel];
  channels[channel] = null;
  if (el) {
    if (!fade) {
      el.pause();
    } else {
      const v0 = el.volume;
      const t0 = performance.now();
      const step = () => {
        const k = (performance.now() - t0) / (fade * 1000);
        if (k >= 1 || el.paused) {
          el.pause();
          return;
        }
        el.volume = v0 * (1 - k);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }
  resumeAmbience(); // birds return once nothing else is playing
}

export function anyPlaying() {
  return Object.values(channels).some((el) => el && !el.paused);
}

// ---- open-window ambience: quiet birdsong drifting in, starts on the first
// user gesture. Uses the Web Audio API with a looping buffer so the loop is
// gapless/seamless (HTMLAudio.loop leaves an audible seam).
let ambience = null; // { ctx, gain }

function rampGain(a, to, dur) {
  const g = a.gain.gain, t = a.ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(to, t + dur);
}

export async function startAmbience() {
  if (ambience) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    ambience = { ctx, gain };
    if (import.meta.env?.DEV) window.__ambVol = () => ambience?.gain.gain.value ?? -1;
    const buf = await fetch(asset("/audio/birdsong.mp3"))
      .then((r) => r.arrayBuffer())
      .then((a) => ctx.decodeAudioData(a));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true; // sample-accurate, gapless
    src.connect(gain);
    src.start();
    if (!anyPlaying()) rampGain(ambience, AMB_VOL, 4);
  } catch (e) {
    ambience = null;
  }
}

export function pauseAmbience() {
  if (ambience) rampGain(ambience, 0, 0.5);
}

export function resumeAmbience() {
  if (ambience && !anyPlaying()) rampGain(ambience, AMB_VOL, 1.4);
}
