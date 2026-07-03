import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildScene } from "./scene.js";
import { setupPost } from "./post.js";
import { setupInteractions } from "./interactions.js";
import { config } from "./store.js";
import { setupEditor } from "./editor.js";
import { createHero } from "./hero.js";

const app = document.getElementById("app");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.14;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d100d);
scene.fog = new THREE.Fog(0x0d100d, 4, 12);

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.05,
  50
);
// Hero shot: slightly above and to the right of dead-center, looking at the
// desk. Starts closer — nearly at the desk.
camera.position.set(0.42, 1.16, 1.12);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.82, -0.1);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 0.42; // just shy of sitting at the desk
controls.maxDistance = 1.9; // desk-locked: the hero shot IS max zoom-out
controls.minPolarAngle = 0.9;
controls.maxPolarAngle = 1.45;
controls.minAzimuthAngle = -0.42; // don't swing far enough left to clip the wall
controls.maxAzimuthAngle = 0.78;
controls.enablePan = false;

const { animate: animateScene, interactables, editables, setFocusDim, setSpeakersOn, os, screen } =
  buildScene(scene);
const post = setupPost(renderer, scene, camera);
const editState = { active: false };
const interactions = setupInteractions({
  renderer, camera, controls, interactables, config, setFocusDim, setSpeakersOn,
  os, screenMesh: screen, editState,
});
setupEditor({ renderer, camera, controls, editables, editState });

// Welcome hero — fades away the moment the visitor clicks into the room.
const hero = createHero(config);
renderer.domElement.addEventListener("pointerdown", () => hero.dismiss(), { once: true });

if (import.meta.env?.DEV) window.__diag = { scene, camera, screen, interactables, THREE };

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  post.setSize(window.innerWidth, window.innerHeight);
});

// ---- effects / performance toggle (default ON) ----
// Off = skip post-processing (bloom/grain/vignette), shadows and hi-DPI, for a
// big speed-up on weak machines.
const fx = { on: (() => { try { return localStorage.getItem("desktopper.fx") !== "off"; } catch { return true; } })() };
function applyFx() {
  renderer.setPixelRatio(fx.on ? Math.min(window.devicePixelRatio, 2) : 1);
  renderer.shadowMap.enabled = fx.on;
  scene.traverse((o) => {
    if (o.isMesh && o.material) {
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true));
    }
  });
}
const fxBtn = document.createElement("button");
fxBtn.id = "dt-fx";
fxBtn.style.cssText =
  "position:fixed;right:16px;bottom:16px;z-index:30;padding:7px 13px;border-radius:999px;cursor:pointer;" +
  "background:rgba(20,17,13,0.8);border:1px solid rgba(255,200,140,0.28);color:#ece0cc;" +
  "font:12.5px system-ui,sans-serif";
const fxLabel = () => (fxBtn.textContent = fx.on ? "✦ effects: on" : "effects: off");
fxLabel();
document.body.appendChild(fxBtn);
fxBtn.addEventListener("click", () => {
  fx.on = !fx.on;
  try { localStorage.setItem("desktopper.fx", fx.on ? "on" : "off"); } catch {}
  applyFx();
  fxLabel();
});
applyFx();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.getElapsedTime();
  animateScene(t);
  interactions.tick(t, dt);
  if (controls.enabled) controls.update();
  if (fx.on) {
    post.tick(t);
    post.composer.render();
  } else {
    renderer.render(scene, camera);
  }
});
