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

// ---- open-window ambience: filtered noise, very quiet, starts on first
// user gesture (browser autoplay rules make that the natural moment anyway).
let ambience = null;

export function startAmbience() {
  if (ambience) return;
  const ac = new (window.AudioContext ?? window.webkitAudioContext)();
  const len = ac.sampleRate * 4;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    // brown-ish noise: integrate white noise, keep it bounded
    last = (last + (Math.random() * 2 - 1) * 0.02) * 0.998;
    data[i] = last * 3.5;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 420;
  const gain = ac.createGain();
  gain.gain.value = 0.0;
  src.connect(lp).connect(gain).connect(ac.destination);
  src.start();
  // fade in over ~4s, then a slow drift like wind at a cracked window
  const t = ac.currentTime;
  gain.gain.linearRampToValueAtTime(0.05, t + 4);
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 0.018;
  lfo.connect(lfoGain).connect(gain.gain);
  lfo.start();
  ambience = { ac };
}
