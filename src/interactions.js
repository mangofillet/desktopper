import * as THREE from "three";
import { playTrack, stopTrack, startAmbience } from "./audio.js";
import { asset } from "./assets.js";
import { createReader } from "./reader.js";
import { getPdf } from "./store.js";

// Hover (lift + warm emissive glow) and click-to-focus camera flights.
// Interactables are registered by scene.js as:
//   { id, kind, object, data?, focus?: { pos:[x,y,z], look:[x,y,z] } }
// Kinds with overlays: paper, bio, contact, projects, cv. Kind "prop" just
// wobbles (mug, headphones, speakers — audio hooks arrive in M5).

const FLIGHT_S = 1.2;
const HOME = {
  pos: new THREE.Vector3(0.55, 1.35, 1.55),
  look: new THREE.Vector3(0, 0.82, -0.1),
};

const css = /* css */ `
  #dt-overlay {
    position: fixed; top: 0; right: 0; height: 100%; width: min(420px, 92vw);
    display: flex; align-items: center; padding: 24px; box-sizing: border-box;
    pointer-events: none; z-index: 10;
    font-family: Georgia, 'Times New Roman', serif;
  }
  #dt-card {
    pointer-events: auto; width: 100%;
    background: rgba(16, 13, 10, 0.82); backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 190, 120, 0.18); border-radius: 10px;
    padding: 26px 28px; color: #e8ddcc;
    box-shadow: 0 12px 60px rgba(0,0,0,0.6);
    opacity: 0; transform: translateX(24px);
    transition: opacity 0.45s ease, transform 0.45s ease;
  }
  #dt-overlay.show #dt-card { opacity: 1; transform: translateX(0); }
  #dt-card h2 { margin: 0 0 6px; font-size: 21px; line-height: 1.3; color: #f6ead2; font-weight: bold; }
  #dt-card .meta { font-style: italic; color: #b8a988; font-size: 14px; margin-bottom: 14px; }
  #dt-card p { font-size: 14.5px; line-height: 1.55; color: #cfc4b0; margin: 0 0 16px; }
  #dt-card a.btn {
    display: inline-block; padding: 9px 16px; border-radius: 6px;
    background: #2e7d4f; color: #eafff2; text-decoration: none;
    font-family: monospace; font-size: 13.5px; letter-spacing: 0.4px;
  }
  #dt-card a.btn:hover { background: #3aa66a; }
  #dt-card ul { list-style: none; padding: 0; margin: 0; }
  #dt-card li { margin-bottom: 12px; }
  #dt-card li a { color: #9fd8a8; text-decoration: none; font-size: 15px; }
  #dt-card li a:hover { text-decoration: underline; }
  #dt-card li .blurb { font-size: 13.5px; color: #b0a590; }
  #dt-back {
    position: fixed; top: 18px; left: 18px; z-index: 11;
    padding: 8px 14px; border-radius: 999px; cursor: pointer;
    background: rgba(16, 13, 10, 0.75); border: 1px solid rgba(255,190,120,0.25);
    color: #e8ddcc; font-family: monospace; font-size: 13px;
    opacity: 0; pointer-events: none; transition: opacity 0.4s ease;
  }
  #dt-back.show { opacity: 1; pointer-events: auto; }
  #dt-back:hover { background: rgba(40, 32, 22, 0.9); }
  #dt-toast {
    position: fixed; bottom: 26px; left: 50%; z-index: 11; cursor: pointer;
    transform: translate(-50%, 14px); padding: 11px 20px; border-radius: 999px;
    background: rgba(16, 13, 10, 0.85); border: 1px solid rgba(255,190,120,0.25);
    color: #e8ddcc; font-family: monospace; font-size: 13px;
    opacity: 0; pointer-events: none; transition: opacity 0.5s ease, transform 0.5s ease;
  }
  #dt-toast.show { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
  #dt-toast .hint { color: #8a7f6e; }
  #dt-caption {
    position: fixed; bottom: 76px; left: 50%; z-index: 11;
    transform: translate(-50%, 10px); padding: 8px 16px; border-radius: 999px;
    background: rgba(16, 13, 10, 0.8); border: 1px solid rgba(255,190,120,0.2);
    color: #d8cbb4; font-family: Georgia, serif; font-style: italic; font-size: 13.5px;
    opacity: 0; pointer-events: none; transition: opacity 0.45s ease, transform 0.45s ease;
  }
  #dt-caption.show { opacity: 1; transform: translate(-50%, 0); }
`;

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function setupInteractions({
  renderer, camera, controls, interactables, config, setFocusDim, setSpeakersOn, setLampOn, os, screenMesh,
  editState,
}) {
  // ---------- DOM ----------
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  const overlay = document.createElement("div");
  overlay.id = "dt-overlay";
  overlay.innerHTML = `<div id="dt-card"></div>`;
  document.body.appendChild(overlay);
  const card = overlay.querySelector("#dt-card");
  const back = document.createElement("div");
  back.id = "dt-back";
  back.textContent = "⟵ back · esc";
  document.body.appendChild(back);
  const toast = document.createElement("div");
  toast.id = "dt-toast";
  document.body.appendChild(toast);
  // Short-lived caption pill (e.g. poking the mug) — reuses the toast look.
  const caption = document.createElement("div");
  caption.id = "dt-caption";
  document.body.appendChild(caption);
  let captionTimer = 0;
  function showCaption(text) {
    caption.textContent = text;
    caption.classList.add("show");
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => caption.classList.remove("show"), 2200);
  }

  // ---------- state ----------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = null;
  let focused = null;
  let flight = null; // { t0, from{pos,look}, to{pos,look}, then }
  const look = HOME.look.clone(); // current camera lookAt proxy (= controls.target)

  // Map every descendant mesh back to its interactable for fast hit lookup.
  const meshToItem = new Map();
  for (const item of interactables) {
    item.object.traverse((o) => {
      if (o.isMesh) meshToItem.set(o, item);
    });
    item.baseY = item.object.position.y;
    item.liftT = 0;
    item.wobbleT = -1;
  }
  const hitMeshes = [...meshToItem.keys()];

  // ---------- hover glow ----------
  function setGlow(item, on) {
    item.object.traverse((o) => {
      if (o.isMesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m.isMeshStandardMaterial) continue;
          if (on) {
            if (m.userData.baseEmissive === undefined) {
              m.userData.baseEmissive = m.emissive.getHex();
            }
            m.emissive.setHex(0x51341a);
          } else if (m.userData.baseEmissive !== undefined) {
            m.emissive.setHex(m.userData.baseEmissive);
          }
        }
      }
    });
  }

  // ---------- document reader (papers open here) ----------
  const reader = createReader({ onClose: () => goHome() });

  // ---------- simple media player for the laptop's audio/video files ----------
  const mediaOverlay = document.createElement("div");
  mediaOverlay.id = "dt-media";
  mediaOverlay.style.cssText =
    "position:fixed;inset:0;z-index:42;display:none;align-items:center;justify-content:center;" +
    "background:rgba(6,5,4,0.82);backdrop-filter:blur(6px)";
  mediaOverlay.innerHTML =
    `<div style="position:relative;max-width:88vw;max-height:86vh">` +
    `<button id="dt-media-x" style="position:absolute;top:-34px;right:0;background:#2b2620;color:#ece3d2;` +
    `border:1px solid #554b3d;border-radius:6px;padding:5px 11px;cursor:pointer;font:13px system-ui">close ✕</button>` +
    `<div id="dt-media-slot"></div></div>`;
  document.body.appendChild(mediaOverlay);
  const mediaSlot = mediaOverlay.querySelector("#dt-media-slot");
  function closeMedia() {
    mediaSlot.innerHTML = "";
    mediaOverlay.style.display = "none";
  }
  mediaOverlay.querySelector("#dt-media-x").addEventListener("click", closeMedia);
  mediaOverlay.addEventListener("click", (e) => { if (e.target === mediaOverlay) closeMedia(); });
  async function playMedia(m) {
    let src = m?.url ? asset(m.url) : m?.dataUrl || null;
    if (!src && m?.mediaKey) {
      const blob = await getPdf(m.mediaKey); // IndexedDB stores media blobs too
      if (blob) src = URL.createObjectURL(blob);
    }
    if (!src) return;
    if (m.type === "video") {
      mediaSlot.innerHTML = `<video src="${src}" controls autoplay style="max-width:88vw;max-height:82vh;border-radius:8px"></video>`;
      mediaOverlay.style.display = "flex";
    } else {
      mediaSlot.innerHTML =
        `<div style="background:#1c1915;color:#e8ddca;padding:26px 30px;border-radius:10px;font:14px system-ui;min-width:280px">` +
        `<div style="margin-bottom:12px">♪ ${m.name || "audio"}</div>` +
        `<audio src="${src}" controls autoplay style="width:100%"></audio></div>`;
      mediaOverlay.style.display = "flex";
    }
  }

  os?.setHandlers({ openReader: (item) => reader.open(item), playMedia });

  // ---------- overlay content ----------
  function showCard(item) {
    const d = item.data;
    let html = "";
    if (item.kind === "paper") {
      // The paper is picked up into the full-screen reader — no side card.
      reader.open(d);
      return;
    } else if (item.kind === "cv") {
      // Opens the actual CV PDF in the reader, not an external site.
      reader.open({ title: "Curriculum Vitae", pdfUrl: config.cvUrl, pdfName: "cv.pdf" });
      return;
    } else if (item.kind === "photo") {
      // The photo is its own small identity card — the full bio lives on the
      // computer (about.txt), not on the desk.
      html = `<h2>${config.name}</h2>
        <div class="meta">${config.tagline || ""}</div>`;
    } else if (item.kind === "contact") {
      const l = config.links;
      html = `<h2>say hello</h2><ul>
        ${l.email ? `<li><a href="mailto:${l.email}">${l.email}</a></li>` : ""}
        ${l.github ? `<li><a href="${l.github}" target="_blank" rel="noopener">github</a></li>` : ""}
        ${l.scholar ? `<li><a href="${l.scholar}" target="_blank" rel="noopener">scholar</a></li>` : ""}
        ${l.linkedin ? `<li><a href="${l.linkedin}" target="_blank" rel="noopener">linkedin</a></li>` : ""}
      </ul>`;
    }
    // projects and cv have no side card — they live on the computer.
    if (!html) return; // e.g. laptop — its screen is the content, no card
    card.innerHTML = html;
    overlay.classList.add("show");
  }
  function hideCard() {
    overlay.classList.remove("show");
  }

  // ---------- headphones: put them on ----------
  // Click → they fly up from the desk and settle just under the camera, as if
  // slipped over your ears; the configured track plays and a toast names it.
  const phonesItem = interactables.find((i) => i.kind === "headphones");
  let phonesT = 0; // 0 = on desk, 1 = worn
  let phonesDir = 0; // ±1 while animating
  let deskPose = null;
  const _wv = new THREE.Vector3();

  function wearPhones() {
    const o = phonesItem.object;
    if (!deskPose) {
      deskPose = { pos: o.position.clone(), quat: o.quaternion.clone() };
    }
    phonesDir = 1;
    setGlow(phonesItem, false);
    hovered = null;
    stopTrack({ channel: "speakers", fade: 0.6 });
    const tr = config.headphonesTrack ?? { title: "silence", artist: "" };
    const playing = playTrack(tr, "phones");
    toast.innerHTML =
      `♪ ${tr.title}${tr.artist ? " — " + tr.artist : ""}` +
      (playing ? "" : ` <span class="hint">(no track file yet)</span>`) +
      ` <span class="hint">· click to take off</span>`;
    toast.classList.add("show");
  }

  function takeOffPhones() {
    if (phonesT === 0 && phonesDir === 0) return;
    phonesDir = -1;
    stopTrack({ channel: "phones" });
    toast.classList.remove("show");
  }

  // ---------- speakers: an on/off prop (drives laptop media audio later) ----------
  let speakersOn = false;
  function toggleSpeakers() {
    speakersOn = !speakersOn;
    setSpeakersOn?.(speakersOn);
    showCaption(speakersOn ? "speakers on" : "speakers off");
  }

  // ---------- desk lamp: click to switch the light on/off ----------
  let lampOn = true;
  function toggleLamp() {
    lampOn = !lampOn;
    setLampOn?.(lampOn);
    showCaption(lampOn ? "lamp on" : "lamp off");
  }

  toast.addEventListener("click", () => {
    takeOffPhones();
    toast.classList.remove("show");
  });

  // ---------- floppy → drive slot ----------
  // Focusing "projects" sends the top floppy arcing across the desk and into
  // the laptop's side drive; leaving ejects it back onto the stack.
  const projItem = interactables.find((i) => i.kind === "projects");
  let floppyT = 0;
  let floppyDir = 0;
  let floppyCurve = null;
  let floppyHome = null;
  const slotQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.1, 0));

  let floppyInserted = false;
  function startFloppy(dir) {
    const f = projItem?.floppy;
    if (!f) return;
    if (!floppyHome) {
      floppyHome = { pos: f.position.clone(), quat: f.quaternion.clone() };
      floppyCurve = new THREE.CatmullRomCurve3([
        floppyHome.pos.clone(),
        ...projItem.slotPath.map((p) => new THREE.Vector3(...p)),
      ]);
    }
    floppyDir = dir;
    floppyInserted = dir > 0;
    os?.setFloppy(floppyInserted); // mount/unmount the projects folder in the OS
  }

  // ---------- camera flights ----------
  function flyTo(to, then) {
    flight = {
      t0: performance.now(),
      from: { pos: camera.position.clone(), look: look.clone() },
      to: {
        pos: new THREE.Vector3(...to.pos),
        look: new THREE.Vector3(...to.look),
      },
      then,
    };
    controls.enabled = false;
    hideCard();
  }

  function focusItem(item) {
    focused = item;
    setFocusDim?.(true);
    setGlow(item, false);
    hovered = null;
    renderer.domElement.style.cursor = "default";
    back.classList.add("show");
    if (item === projItem && !floppyInserted) startFloppy(1);
    if (item.kind === "laptop") os?.wake();
    flyTo(item.focus, () => showCard(item));
  }

  function goHome() {
    if (!focused) return;
    // the floppy stays inserted after viewing projects — eject it by clicking
    // the disk again, not by leaving.
    focused = null;
    setFocusDim?.(false);
    back.classList.remove("show");
    flyTo({ pos: HOME.pos.toArray(), look: HOME.look.toArray() }, () => {
      controls.enabled = true;
    });
  }

  // ---------- events ----------
  renderer.domElement.addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  renderer.domElement.addEventListener("click", () => {
    if (flight || editState?.active) return; // editor owns clicks in edit mode
    if (hovered === phonesItem) {
      if (phonesT < 0.5 && phonesDir <= 0) wearPhones();
      else takeOffPhones();
      return;
    }
    if (hovered?.id.startsWith("speaker")) {
      hovered.wobbleT = 0;
      toggleSpeakers();
      return;
    }
    if (hovered?.kind === "lamp") {
      hovered.wobbleT = 0;
      toggleLamp();
      return;
    }
    // Clicking the floppy while it's already in the drive ejects it (and
    // unmounts the projects folder from the OS).
    if (hovered === projItem && floppyInserted && focused !== projItem) {
      startFloppy(-1);
      showCaption("floppy ejected");
      return;
    }
    // While on the laptop, clicks land on the OS screen.
    if (focused?.kind === "laptop" && screenMesh) {
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(screenMesh, false)[0];
      if (hit?.uv) {
        os.pointer(hit.uv.x * 640, (1 - hit.uv.y) * 480);
        return;
      }
    }
    if (hovered && hovered !== focused) {
      if (hovered.focus) focusItem(hovered);
      else {
        hovered.wobbleT = 0; // props nudge…
        hovered.poke?.(); // …and may puff (mug steam)
        if (hovered.caption) showCaption(hovered.caption);
      }
    } else if (focused && !hovered) {
      goHome();
    }
  });
  back.addEventListener("click", goHome);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (focused) goHome();
      else takeOffPhones();
      return;
    }
    // Terminal typing while the laptop is focused.
    if (focused?.kind === "laptop" && os?.key(e)) e.preventDefault();
  });
  window.addEventListener("pointerdown", () => startAmbience(), { once: true });

  // Mouse wheel over the laptop screen scrolls the focused OS window.
  renderer.domElement.addEventListener("wheel", (e) => {
    if (focused?.kind !== "laptop" || !screenMesh || !os) return;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(screenMesh, false)[0];
    if (hit?.uv && os.wheel(hit.uv.x * 640, (1 - hit.uv.y) * 480, e.deltaY)) {
      e.preventDefault();
    }
  }, { passive: false });

  if (import.meta.env?.DEV) {
    // deterministic hooks for verify.mjs — not shipped in production builds
    window.__dt = {
      wearPhones,
      takeOffPhones,
      toggleLamp,
      os,
      focus: (id) => {
        const it = interactables.find((i) => i.id === id);
        if (it?.focus) focusItem(it);
      },
      home: goHome,
    };
  }

  // ---------- per-frame ----------
  function tick(t, dt) {
    // raycast hover (skip mid-flight, while the reader is up, or in edit mode)
    if (!flight && !reader.isOpen() && !editState?.active) {
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitMeshes, false);
      const item = hits.length ? meshToItem.get(hits[0].object) : null;
      if (item !== hovered) {
        if (hovered) setGlow(hovered, false);
        hovered = item;
        if (hovered) setGlow(hovered, true);
        renderer.domElement.style.cursor = hovered ? "pointer" : "default";
      }
    }

    // headphones wear/remove tween (owns the phones transform entirely)
    if (phonesDir !== 0) {
      phonesT = THREE.MathUtils.clamp(phonesT + (dt / 1.1) * phonesDir, 0, 1);
      if (phonesT === 1 || phonesT === 0) phonesDir = 0;
    }
    if (deskPose && (phonesT > 0 || phonesDir !== 0)) {
      const o = phonesItem.object;
      const e = easeInOutCubic(phonesT);
      _wv.set(0, -0.34, -0.22).applyMatrix4(camera.matrixWorld);
      o.position.lerpVectors(deskPose.pos, _wv, e);
      o.quaternion.slerpQuaternions(deskPose.quat, camera.quaternion, e);
      o.scale.setScalar(1 + e * 1.2);
    }

    // floppy insert/eject along its arc
    if (floppyDir !== 0) {
      floppyT = THREE.MathUtils.clamp(floppyT + (dt / 1.25) * floppyDir, 0, 1);
      if (floppyT === 1 || floppyT === 0) floppyDir = 0;
      const f = projItem.floppy;
      const e = easeInOutCubic(floppyT);
      floppyCurve.getPoint(e, f.position);
      f.quaternion.slerpQuaternions(floppyHome.quat, slotQuat, e);
    }

    // lift + wobble animation
    for (const it of interactables) {
      if (it === phonesItem && (phonesT > 0 || phonesDir !== 0)) continue;
      if (it === projItem && (floppyT > 0 || floppyDir !== 0)) continue;
      const target = it === hovered && !focused ? 1 : 0;
      it.liftT += (target - it.liftT) * Math.min(1, dt * 10);
      it.object.position.y = it.baseY + it.liftT * 0.008;
      if (it.wobbleT >= 0) {
        it.wobbleT += dt;
        const w = it.wobbleT;
        if (w > 0.6) it.wobbleT = -1;
        else it.object.rotation.z = Math.sin(w * 24) * 0.04 * (1 - w / 0.6);
      }
    }

    // flight
    if (flight) {
      const k = Math.min(1, (performance.now() - flight.t0) / (FLIGHT_S * 1000));
      const e = easeInOutCubic(k);
      camera.position.lerpVectors(flight.from.pos, flight.to.pos, e);
      camera.position.y += Math.sin(e * Math.PI) * 0.06; // gentle arc
      look.lerpVectors(flight.from.look, flight.to.look, e);
      camera.lookAt(look);
      controls.target.copy(look);
      if (k >= 1) {
        const then = flight.then;
        flight = null;
        then?.();
      }
    }
  }

  return { tick };
}
