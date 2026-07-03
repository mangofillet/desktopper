// Minimal audio manager. Track files are user-supplied via portfolio.json —
// nothing autoplays; everything starts from an explicit click.
import { asset } from "./assets.js";

const channels = {}; // name → HTMLAudioElement

export function playTrack(track, channel = "main") {
  stopTrack({ fade: 0, channel });
  if (!track?.url) return false;
  const el = new Audio(asset(track.url));
  el.loop = true;
  el.volume = 0.75;
  el.play().catch(() => {});
  channels[channel] = el;
  return true;
}

export function stopTrack({ fade = 1.2, channel = "main" } = {}) {
  const el = channels[channel];
  channels[channel] = null;
  if (!el) return;
  if (!fade) {
    el.pause();
    return;
  }
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

export function anyPlaying() {
  return Object.values(channels).some((el) => el && !el.paused);
}

// ---- open-window ambience: quiet birdsong drifting in, starts on the first
// user gesture (browser autoplay rules make that the natural moment anyway).
let ambience = null;

export function startAmbience() {
  if (ambience) return;
  const el = new Audio(asset("/audio/birdsong.mp3"));
  el.loop = true;
  el.volume = 0;
  el.play().catch(() => {});
  ambience = el;
  // fade in gently to a quiet level
  const target = 0.16;
  const t0 = performance.now();
  const step = () => {
    const k = (performance.now() - t0) / 4000;
    if (k >= 1) { el.volume = target; return; }
    el.volume = target * k;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
