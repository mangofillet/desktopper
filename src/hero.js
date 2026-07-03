// A soft welcome panel covering the left ~40% of the screen on load. Purely
// visual (pointer-events: none) so the room stays interactive — it fades away
// the moment the visitor clicks anywhere in the room.
const css = /* css */ `
  #dt-hero {
    position: fixed; inset: 0 60% 0 0; z-index: 25; pointer-events: none;
    display: flex; align-items: center; padding: 0 5vw;
    background: linear-gradient(100deg, rgba(10,8,6,0.78) 40%, rgba(10,8,6,0) 100%);
    transition: opacity 0.7s ease, transform 0.7s ease;
    font-family: Georgia, "Times New Roman", serif; color: #f2e9d8;
  }
  #dt-hero.gone { opacity: 0; transform: translateX(-24px); }
  #dt-hero .panel { max-width: 420px; }
  #dt-hero h1 { font-size: clamp(26px, 3.4vw, 40px); line-height: 1.15; margin: 0 0 16px; font-weight: 700; }
  #dt-hero p { font-size: clamp(14px, 1.3vw, 17px); line-height: 1.6; color: #d8ccb8; margin: 0 0 22px; }
  #dt-hero .hint { font-family: system-ui, sans-serif; font-size: 12.5px; letter-spacing: 0.5px;
    color: #b6a988; text-transform: uppercase; opacity: 0.85;
    animation: dt-hero-pulse 2.4s ease-in-out infinite; }
  @keyframes dt-hero-pulse { 0%,100% { opacity: 0.5 } 50% { opacity: 0.95 } }
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
