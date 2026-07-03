// A soft welcome panel covering the left ~40% of the screen on load. Purely
// visual (pointer-events: none) so the room stays interactive — it fades away
// the moment the visitor clicks anywhere in the room.
const css = /* css */ `
  #dt-hero {
    position: fixed; inset: 0 60% 0 0; z-index: 25; pointer-events: none;
    display: flex; align-items: center; padding: 0 5vw;
    background: linear-gradient(100deg, rgba(230,219,196,1) 82%, rgba(230,219,196,0) 100%);
    transition: opacity 0.7s ease, transform 0.7s ease;
    font-family: Georgia, "Times New Roman", serif; color: #3a3226;
  }
  #dt-hero.gone { opacity: 0; transform: translateX(-24px); }
  #dt-hero .panel { max-width: 420px; }
  #dt-hero h1 { font-size: clamp(26px, 3.4vw, 40px); line-height: 1.15; margin: 0 0 16px; font-weight: 700; color: #2e281e; }
  #dt-hero p { font-size: clamp(14px, 1.3vw, 17px); line-height: 1.6; color: #574d3c; margin: 0 0 22px; }
  #dt-hero .hint { font-family: system-ui, sans-serif; font-size: 12.5px; letter-spacing: 0.5px;
    color: #8a7a58; text-transform: uppercase; opacity: 0.9;
    animation: dt-hero-pulse 2.4s ease-in-out infinite; }
  @keyframes dt-hero-pulse { 0%,100% { opacity: 0.55 } 50% { opacity: 1 } }
`;

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function createHero(config) {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const h = config.hero || {};
  const el = document.createElement("div");
  el.id = "dt-hero";
  el.innerHTML = `<div class="panel">
    <h1>${esc(h.title || "Welcome")}</h1>
    <p>${esc(h.body || "")}</p>
    <div class="hint">click anywhere to enter →</div>
  </div>`;
  document.body.appendChild(el);

  let dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    el.classList.add("gone");
    setTimeout(() => el.remove(), 800);
  }
  return { dismiss, el };
}
