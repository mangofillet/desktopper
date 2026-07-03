import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { buildScene } from "./scene.js";
import { setupPost } from "./post.js";
import { setupInteractions } from "./interactions.js";
import config from "../portfolio.json";

const app = document.getElementById("app");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x241c15);
scene.fog = new THREE.Fog(0x241c15, 4, 12);

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.05,
  50
);
// Hero shot: slightly above and to the right of dead-center, looking at the desk.
camera.position.set(0.55, 1.35, 1.55);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.82, -0.1);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 0.6;
controls.maxDistance = 1.9; // desk-locked: the hero shot IS max zoom-out
controls.minPolarAngle = 0.9;
controls.maxPolarAngle = 1.45;
controls.minAzimuthAngle = -0.9;
controls.maxAzimuthAngle = 0.9;
controls.enablePan = false;

const { animate: animateScene, interactables, setFocusDim, os, screen } =
  buildScene(scene);
const post = setupPost(renderer, scene, camera);
const interactions = setupInteractions({
  renderer, camera, controls, interactables, config, setFocusDim,
  os, screenMesh: screen,
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  post.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.getElapsedTime();
  animateScene(t);
  interactions.tick(t, dt);
  if (controls.enabled) controls.update();
  post.tick(t);
  post.composer.render();
});
