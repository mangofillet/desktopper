import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  paperTexture,
  bookCoverTexture,
  posterTexture,
  stickyTexture,
  nightSkyTexture,
  steamTexture,
} from "./textures.js";
import { createOS } from "./os.js";
import { asset } from "./assets.js";
import config from "../portfolio.json";

const DESK_H = 0.75;
const TOP = DESK_H + 0.021;

const texLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
function pbr(path, { repeat = 1, srgb = false } = {}) {
  const t = texLoader.load(asset(path));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts });
}

function box(w, h, d, material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildScene(scene) {
  RectAreaLightUniformsLib.init();
  const root = new THREE.Group();
  scene.add(root);
  const interactables = [];

  // ================= Room =================
  const floorMat = new THREE.MeshStandardMaterial({
    map: pbr("/textures/old_wood_floor_diff_1k.jpg", { repeat: 3, srgb: true }),
    roughnessMap: pbr("/textures/old_wood_floor_rough_1k.jpg", { repeat: 3 }),
    color: 0x8a7a68, // darken the CC0 diffuse toward night
    roughness: 1,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({
    map: pbr("/textures/painted_plaster_wall_diff_1k.jpg", { repeat: 2, srgb: true }),
    color: 0x4a4550,
    roughness: 0.95,
  });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), wallMat);
  backWall.position.set(0, 2, -0.95);
  backWall.receiveShadow = true;
  root.add(backWall);
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), wallMat.clone());
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-1.6, 2, 0);
  leftWall.receiveShadow = true;
  root.add(leftWall);

  // Skirting board along both walls
  const skirtMat = mat(0x2c2620, { roughness: 0.7 });
  const skirtB = box(8, 0.09, 0.02, skirtMat);
  skirtB.position.set(0, 0.045, -0.94);
  const skirtL = box(0.02, 0.09, 8, skirtMat);
  skirtL.position.set(-1.59, 0.045, 0);
  root.add(skirtB, skirtL);

  // ================= Window (night city + moon) =================
  const windowGroup = new THREE.Group();
  windowGroup.position.set(-0.45, 1.62, -0.93);
  const night = new THREE.Mesh(
    new THREE.PlaneGeometry(0.82, 1.0),
    new THREE.MeshBasicMaterial({ map: nightSkyTexture() })
  );
  windowGroup.add(night);
  const frameMat = mat(0x241b13, { roughness: 0.6 });
  const fT = box(0.92, 0.06, 0.07, frameMat);
  fT.position.y = 0.53;
  const fB = box(0.92, 0.06, 0.07, frameMat);
  fB.position.y = -0.53;
  const fL = box(0.06, 1.12, 0.07, frameMat);
  fL.position.x = -0.44;
  const fR = fL.clone();
  fR.position.x = 0.44;
  const fMH = box(0.86, 0.035, 0.05, frameMat);
  const fMV = box(0.035, 1.0, 0.05, frameMat);
  const sill = box(1.0, 0.035, 0.12, frameMat);
  sill.position.set(0, -0.575, 0.04);
  windowGroup.add(fT, fB, fL, fR, fMH, fMV, sill);
  root.add(windowGroup);

  // ================= Desk =================
  const deskMat = new THREE.MeshStandardMaterial({
    map: pbr("/textures/wood_table_001_diff_1k.jpg", { srgb: true }),
    normalMap: pbr("/textures/wood_table_001_nor_gl_1k.jpg"),
    roughnessMap: pbr("/textures/wood_table_001_rough_1k.jpg"),
    color: 0xb59a7d,
    roughness: 1,
  });
  const deskTop = box(1.7, 0.042, 0.85, deskMat);
  deskTop.position.set(0, DESK_H, 0);
  root.add(deskTop);
  const legMat = mat(0x2e2118, { roughness: 0.65 });
  for (const [x, z] of [[-0.78, -0.36], [0.78, -0.36], [-0.78, 0.36], [0.78, 0.36]]) {
    const leg = box(0.055, DESK_H - 0.02, 0.055, legMat);
    leg.position.set(x, (DESK_H - 0.02) / 2, z);
    root.add(leg);
  }
  const apron = box(1.55, 0.07, 0.02, legMat);
  apron.position.set(0, DESK_H - 0.07, -0.38);
  root.add(apron);

  // ================= Laptop (Poly Haven classic_laptop, CC0) =================
  const laptop = new THREE.Group();
  laptop.position.set(0.05, TOP, -0.12);
  laptop.rotation.y = -0.1;
  // The screen is a live canvas: DESKTOPPER OS draws to it every frame it
  // changes, and interactions forwards clicks/keys into it.
  const os = createOS({
    config,
    openUrl: (u) => window.open(asset(u), "_blank", "noopener"),
  });
  const screenTex = new THREE.CanvasTexture(os.canvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = 8;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    // polygonOffset wins the depth test against the model's own display
    // surface while sitting flush inside the bezel.
    new THREE.MeshBasicMaterial({
      map: screenTex,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    })
  );
  screen.visible = false;
  gltfLoader.load(asset("/models/classic_laptop/classic_laptop_1k.gltf"), (g) => {
    const model = g.scene;
    let bb = new THREE.Box3().setFromObject(model);
    const size = bb.getSize(new THREE.Vector3());
    model.scale.setScalar(0.36 / size.x);
    bb = new THREE.Box3().setFromObject(model);
    const c = bb.getCenter(new THREE.Vector3());
    model.position.set(-c.x, -bb.min.y, -c.z);
    model.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    laptop.add(model);
    const sn = model.getObjectByName("classic_laptop_screen");
    const sm = sn?.isMesh ? sn : sn?.children.find((ch) => ch.isMesh);
    if (sm) {
      // Parent the live display plane into the screen mesh's local space so
      // it inherits the lid's exact lean; place it from the local bbox.
      sm.geometry.computeBoundingBox();
      const lb = sm.geometry.boundingBox;
      const ls = lb.getSize(new THREE.Vector3());
      console.log(
        "[dt] screen local bb", lb.min.toArray().map((v) => v.toFixed(3)).join(","),
        "→", lb.max.toArray().map((v) => v.toFixed(3)).join(","),
        "size", ls.toArray().map((v) => v.toFixed(3)).join(","),
        "meshscale", sm.getWorldScale(new THREE.Vector3()).toArray().map((v) => v.toFixed(3)).join(",")
      );
      sm.add(screen);
      // The node pivots at its hinge — ease it upright from ~103° to ~93°.
      sn.rotation.x -= 0.17;
      const lc = lb.getCenter(new THREE.Vector3());
      // Display recess measured against the node bbox (probe-tuned); the
      // panel is 4:3 like the VGA screens these machines shipped with.
      const dw = ls.x * 0.8;
      screen.scale.set(dw, dw * 0.75, 1);
      screen.position.set(lc.x - 0.02, lc.y + 0.012, lb.max.z - ls.z * 0.3);
      screen.visible = true;
    }
  });
  laptop.add(screen);
  root.add(laptop);
  interactables.push({
    id: "laptop",
    kind: "laptop",
    object: laptop,
    focus: { pos: [0.1, TOP + 0.3, 0.42], look: [0.05, TOP + 0.16, -0.24] },
  });

  // Screen light: a mint RectAreaLight matching the panel, plus a soft point.
  const screenLight = new THREE.RectAreaLight(0xa8e8c4, 1.0, 0.31, 0.2);
  screenLight.position.set(0.05, TOP + 0.15, -0.2);
  screenLight.rotation.y = Math.PI - 0.1; // face the keyboard/viewer
  screenLight.rotation.x = -0.09;
  root.add(screenLight);
  const screenGlow = new THREE.PointLight(0xbfffd8, 0.25, 0.7, 2);
  screenGlow.position.set(0.05, TOP + 0.16, 0.0);
  root.add(screenGlow);

  // ================= Desk lamp (Poly Haven desk_lamp_arm_01, CC0) =================
  const lampG = new THREE.Group();
  lampG.position.set(-0.62, TOP, -0.24);
  lampG.rotation.y = -2.0; // head extends local -z — swing it over the desk
  // Warm glow sphere sits inside the model's shade mouth.
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.016, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff6e0 })
  );
  bulb.position.set(0, 0.375, -0.115);
  lampG.add(bulb);
  gltfLoader.load(asset("/models/desk_lamp_arm_01/desk_lamp_arm_01_1k.gltf"), (g) => {
    const model = g.scene;
    let bb = new THREE.Box3().setFromObject(model);
    const size = bb.getSize(new THREE.Vector3());
    model.scale.setScalar(0.45 / size.y);
    bb = new THREE.Box3().setFromObject(model);
    const c = bb.getCenter(new THREE.Vector3());
    model.position.set(-c.x, -bb.min.y, -c.z);
    model.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    lampG.add(model);
    if (import.meta.env?.DEV) window.__lamp = { lampG, bulb };
  });
  root.add(lampG);

  const lampLight = new THREE.SpotLight(0xffa95c, 5.5, 3.5, 1.0, 0.75, 1.2);
  lampLight.position.set(-0.51, TOP + 0.37, -0.19); // at the model's shade mouth
  lampLight.target.position.set(-0.1, TOP, 0.18);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(2048, 2048);
  lampLight.shadow.bias = -0.002;
  lampLight.shadow.radius = 6;
  root.add(lampLight, lampLight.target);

  // ================= Papers (one sheet per config paper, up to 6) =================
  const paperGeo = new THREE.PlaneGeometry(0.21, 0.297);
  const paperSpots = [
    [-0.35, 0.16, 0.4],
    [-0.18, 0.3, -0.5],
    [0.6, 0.18, 0.9],
    [-0.44, 0.32, 1.8],
    [0.05, 0.33, 0.35],
    [-0.6, 0.05, -1.1],
  ];
  config.papers.slice(0, paperSpots.length).forEach((p, i) => {
    const m = new THREE.Mesh(
      paperGeo,
      new THREE.MeshStandardMaterial({
        map: paperTexture({
          title: p.title,
          authors: `${p.authors} — ${p.venue} ${p.year}`,
          seed: i + 1,
        }),
        roughness: 0.92,
      })
    );
    const [x, z, rot] = paperSpots[i];
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rot;
    m.position.set(x, TOP + 0.001 + i * 0.0015, z);
    m.receiveShadow = true;
    root.add(m);
    interactables.push({
      id: `paper-${i}`,
      kind: "paper",
      data: p,
      object: m,
      focus: { pos: [x + 0.02, TOP + 0.36, z + 0.2], look: [x, TOP, z] },
    });
  });

  // ================= Mug of tea =================
  const mug = new THREE.Group();
  mug.position.set(0.38, TOP, 0.1);
  const glaze = new THREE.MeshStandardMaterial({
    color: 0xa63d2f, roughness: 0.24, side: THREE.DoubleSide,
  });
  // Lathe profile: gentle belly, thinned lip — reads ceramic, not machined.
  const profile = [
    [0, 0], [0.03, 0], [0.038, 0.004], [0.043, 0.014], [0.047, 0.05],
    [0.046, 0.078], [0.043, 0.098], [0.0415, 0.1], [0.04, 0.096], [0.039, 0.05],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), glaze);
  cup.castShadow = true;
  mug.add(cup);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0075, 14, 28), glaze);
  handle.position.set(0.05, 0.055, 0);
  mug.add(handle);
  const tea = new THREE.Mesh(
    new THREE.CircleGeometry(0.0392, 32),
    mat(0x4e2e14, { roughness: 0.1, metalness: 0.1 })
  );
  tea.rotation.x = -Math.PI / 2;
  tea.position.y = 0.09;
  mug.add(tea);
  // Steam: three soft sprites rising on offset phases, fading in and out.
  const steamTex = steamTexture();
  const steamSprites = [];
  for (let i = 0; i < 3; i++) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: steamTex, transparent: true, opacity: 0, depthWrite: false,
      })
    );
    sp.position.set(0, 0.12, 0);
    sp.scale.setScalar(0.03);
    mug.add(sp);
    steamSprites.push({ sp, phase: i / 3, sway: 0.6 + i * 0.35 });
  }
  root.add(mug);
  // A wisp only escapes when the mug is poked.
  let steamT0 = -Infinity;
  let nowT = 0;
  interactables.push({
    id: "mug", kind: "prop", object: mug,
    caption: "ready for long projects",
    poke: () => { steamT0 = nowT; },
  });

  // ================= Speakers (LED pulses with "music") =================
  const spkMat = mat(0x26262b, { roughness: 0.7 });
  const grillMat = mat(0x141417, { roughness: 0.95 });
  const leds = [];
  for (const x of [-0.38, 0.55]) {
    const spk = box(0.1, 0.17, 0.09, spkMat);
    spk.position.set(x, TOP + 0.085, -0.3);
    spk.rotation.y = x < 0 ? 0.28 : -0.28;
    const grill = new THREE.Mesh(new THREE.CircleGeometry(0.033, 24), grillMat);
    grill.position.set(0, -0.025, 0.046);
    spk.add(grill);
    const tweet = new THREE.Mesh(new THREE.CircleGeometry(0.015, 20), grillMat);
    tweet.position.set(0, 0.045, 0.046);
    spk.add(tweet);
    const led = new THREE.Mesh(
      new THREE.CircleGeometry(0.004, 12),
      new THREE.MeshBasicMaterial({ color: 0x66ffaa })
    );
    led.position.set(0.032, 0.068, 0.046);
    spk.add(led);
    leds.push(led.material);
    root.add(spk);
    interactables.push({ id: `speaker-${x < 0 ? "l" : "r"}`, kind: "prop", object: spk });
  }

  // ================= Framed photo =================
  const frame = new THREE.Group();
  frame.position.set(0.68, TOP, -0.2);
  frame.rotation.y = -0.5;
  const frameBorder = box(0.11, 0.14, 0.012, mat(0x3a2b1e, { roughness: 0.5 }));
  frameBorder.position.y = 0.07;
  frameBorder.rotation.x = -0.12;
  const photoCanvas = document.createElement("canvas");
  photoCanvas.width = 128;
  photoCanvas.height = 160;
  const pctx = photoCanvas.getContext("2d");
  const pg = pctx.createLinearGradient(0, 0, 0, 160);
  pg.addColorStop(0, "#d9a05e");
  pg.addColorStop(1, "#7a4a2e");
  pctx.fillStyle = pg;
  pctx.fillRect(0, 0, 128, 160);
  pctx.fillStyle = "#3a2418";
  pctx.beginPath();
  pctx.arc(64, 70, 26, 0, Math.PI * 2); // head silhouette
  pctx.fill();
  pctx.fillRect(30, 96, 68, 64); // shoulders
  const photoTex = new THREE.CanvasTexture(photoCanvas);
  photoTex.colorSpace = THREE.SRGBColorSpace;
  const photo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.085, 0.11),
    new THREE.MeshStandardMaterial({ map: photoTex, roughness: 0.5 })
  );
  photo.position.set(0, 0, 0.007);
  frameBorder.add(photo);
  const strut = box(0.02, 0.1, 0.008, mat(0x3a2b1e));
  strut.position.set(0, 0.05, -0.03);
  strut.rotation.x = 0.35;
  frame.add(frameBorder, strut);
  root.add(frame);
  interactables.push({
    id: "bio",
    kind: "bio",
    object: frame,
    focus: { pos: [0.45, TOP + 0.16, 0.16], look: [0.68, TOP + 0.08, -0.2] },
  });

  // ================= Sticky notes =================
  const emailLabel = (config.links.email || "hello").split("@")[0];
  const stickies = [
    { color: 0xf2d16b, lines: ["email:", emailLabel + "@…"], pos: [0.18, 0.28], rot: 0.3 },
    { color: 0x9fd8a8, lines: ["github ↗", "scholar ↗"], pos: [0.27, 0.31], rot: -0.4 },
  ];
  const stickyGroup = new THREE.Group();
  for (const s of stickies) {
    const note = new THREE.Mesh(
      new THREE.PlaneGeometry(0.07, 0.07),
      new THREE.MeshStandardMaterial({ color: s.color, roughness: 0.9 })
    );
    const scribble = new THREE.Mesh(
      new THREE.PlaneGeometry(0.066, 0.066),
      new THREE.MeshBasicMaterial({ map: stickyTexture(s.lines), transparent: true })
    );
    scribble.position.z = 0.0005;
    note.add(scribble);
    note.rotation.x = -Math.PI / 2;
    note.rotation.z = s.rot;
    note.position.set(s.pos[0], TOP + 0.0025, s.pos[1]);
    note.receiveShadow = true;
    stickyGroup.add(note);
  }
  root.add(stickyGroup);
  interactables.push({
    id: "contact",
    kind: "contact",
    object: stickyGroup,
    focus: { pos: [0.24, TOP + 0.3, 0.48], look: [0.22, TOP, 0.3] },
  });

  // ================= Floppy disks =================
  const floppyGroup = new THREE.Group();
  const floppyColors = [0x3d4d94, 0x94493d, 0x3d945a];
  floppyColors.forEach((c, i) => {
    const f = box(0.09, 0.0035, 0.093, mat(c, { roughness: 0.55 }));
    const shutter = box(0.028, 0.0037, 0.032, mat(0xb8bcc4, { metalness: 0.7, roughness: 0.3 }));
    shutter.position.set(0.012, 0.0002, -0.028);
    f.add(shutter);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.055, 0.04),
      mat(0xe8e2d2, { roughness: 0.9 })
    );
    label.rotation.x = -Math.PI / 2;
    label.position.set(0, 0.002, 0.02);
    f.add(label);
    f.position.set(-0.5, TOP + 0.004 + i * 0.0045, 0.12);
    f.rotation.y = i * 0.28 - 0.2;
    floppyGroup.add(f);
  });
  root.add(floppyGroup);
  interactables.push({
    id: "projects",
    kind: "projects",
    object: floppyGroup,
    // Straight to the screen; the disk arcs into the front drive en route.
    focus: { pos: [0.2, TOP + 0.27, 0.44], look: [0.07, TOP + 0.13, -0.16] },
    floppy: floppyGroup.children[floppyGroup.children.length - 1],
    slotPath: [
      [-0.48, TOP + 0.16, 0.14],
      [-0.05, TOP + 0.14, 0.3],
      [0.165, TOP + 0.035, 0.17],
      [0.152, TOP + 0.0145, -0.018], // nose proud of the slot, like a real drive
    ],
  });

  // ================= Clipboard (CV) =================
  const clip = new THREE.Group();
  clip.position.set(0.28, TOP, 0.3);
  clip.rotation.y = -1.2;
  const board = box(0.16, 0.008, 0.22, mat(0x6e5335, { roughness: 0.65 }));
  board.position.y = 0.004;
  clip.add(board);
  const cvSheet = new THREE.Mesh(
    new THREE.PlaneGeometry(0.14, 0.2),
    new THREE.MeshStandardMaterial({
      map: paperTexture({ title: "Curriculum Vitae", authors: "J. Doe", seed: 9 }),
      roughness: 0.92,
    })
  );
  cvSheet.rotation.x = -Math.PI / 2;
  cvSheet.rotation.z = Math.PI / 2;
  cvSheet.position.y = 0.009;
  cvSheet.receiveShadow = true;
  clip.add(cvSheet);
  const clasp = box(0.05, 0.014, 0.02, mat(0xb0b4bc, { metalness: 0.7, roughness: 0.25 }));
  clasp.position.set(0, 0.013, -0.09);
  clip.add(clasp);
  root.add(clip);
  interactables.push({
    id: "cv",
    kind: "cv",
    object: clip,
    focus: { pos: [0.3, TOP + 0.34, 0.5], look: [0.28, TOP, 0.3] },
  });

  // ================= Books (Simulacra on top) =================
  const bookStack = new THREE.Group();
  bookStack.position.set(-0.68, TOP, 0.18);
  const baseBooks = [
    { c: 0x3d4a3a, s: [0.16, 0.035, 0.23] },
    { c: 0x54423a, s: [0.15, 0.03, 0.21] },
    { c: 0x2f3a4d, s: [0.14, 0.028, 0.2] },
  ];
  let stackY = 0;
  baseBooks.forEach((b, i) => {
    const book = box(...b.s, mat(b.c, { roughness: 0.75 }));
    // pages: lighter band on the exposed sides
    const pages = box(b.s[0] * 0.96, b.s[1] * 0.7, b.s[2] * 0.97, mat(0xd8cfb8, { roughness: 0.95 }));
    pages.position.y = 0;
    book.add(pages);
    book.position.set(0, stackY + b.s[1] / 2, 0);
    book.rotation.y = i * 0.22 - 0.15;
    bookStack.add(book);
    stackY += b.s[1];
  });
  // Top book: the Bardo Thodol, deep maroon with gold type. (Simulacra and
  // Simulation is the green one beneath it.)
  const bardoCover = bookCoverTexture({
    title: "Bardo Thodol",
    author: "The Tibetan Book of the Dead",
    bg: "#4a2018",
    fg: "#d8b46a",
  });
  const bardoMats = [
    mat(0x4a2018), mat(0x4a2018),
    new THREE.MeshStandardMaterial({ map: bardoCover, roughness: 0.6 }), // top face
    mat(0x4a2018),
    mat(0xd8cfb8, { roughness: 0.95 }), mat(0x4a2018),
  ];
  const bardo = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.025, 0.205), bardoMats);
  bardo.castShadow = true;
  bardo.receiveShadow = true;
  bardo.position.set(0.01, stackY + 0.0125, 0.01);
  bardo.rotation.y = 0.35;
  bookStack.add(bardo);
  root.add(bookStack);

  // ================= Headphones =================
  const phones = new THREE.Group();
  // Rest on top of the paper pile — cups are 33mm across, so the band sits
  // high enough that nothing pokes through the sheets.
  phones.position.set(-0.22, TOP + 0.036, 0.24);
  phones.rotation.set(-Math.PI / 2 + 0.12, 0, 0.7);
  const hpMat = mat(0x1c1c22, { roughness: 0.45 });
  const padMat = mat(0x35353d, { roughness: 0.8 });
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.0075, 12, 32, Math.PI), hpMat);
  band.castShadow = true;
  phones.add(band);
  for (const s of [-1, 1]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.028, 0.028, 24), hpMat);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(s * 0.075, -0.005, 0);
    cup.castShadow = true;
    const pad = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.009, 10, 20), padMat);
    pad.rotation.y = Math.PI / 2;
    pad.position.set(s * 0.075 - s * 0.016, -0.005, 0);
    phones.add(cup, pad);
  }
  root.add(phones);
  interactables.push({ id: "headphones", kind: "headphones", object: phones });

  // ================= Pencil cup =================
  const cupG = new THREE.Group();
  cupG.position.set(0.72, TOP, 0.05);
  const holder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.032, 0.09, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x44507a, roughness: 0.5, side: THREE.DoubleSide })
  );
  holder.position.y = 0.045;
  holder.castShadow = true;
  cupG.add(holder);
  const penColors = [0xd8b04a, 0xc4483a, 0x3a70c4, 0x555555];
  penColors.forEach((c, i) => {
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.13, 8), mat(c, { roughness: 0.5 }));
    const a = (i / penColors.length) * Math.PI * 2;
    pen.position.set(Math.cos(a) * 0.017, 0.075, Math.sin(a) * 0.017);
    pen.rotation.z = Math.cos(a) * 0.18;
    pen.rotation.x = Math.sin(a) * 0.18;
    cupG.add(pen);
  });
  root.add(cupG);

  // ================= Cables & power strip =================
  const cableMat = mat(0x191920, { roughness: 0.6 });
  function cable(points, r = 0.004) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, r, 8), cableMat);
    m.castShadow = true;
    root.add(m);
  }
  // Laptop → behind desk → floor power strip
  cable([
    [0.18, TOP + 0.01, -0.2],
    [0.35, TOP + 0.005, -0.35],
    [0.5, TOP - 0.05, -0.42],
    [0.55, 0.3, -0.5],
    [0.5, 0.02, -0.55],
    [0.2, 0.015, -0.6],
  ]);
  // Speaker wires to laptop
  cable([
    [-0.33, TOP + 0.02, -0.32],
    [-0.2, TOP + 0.005, -0.3],
    [-0.1, TOP + 0.005, -0.24],
  ], 0.0025);
  cable([
    [0.52, TOP + 0.02, -0.32],
    [0.35, TOP + 0.005, -0.28],
    [0.22, TOP + 0.005, -0.22],
  ], 0.0025);
  // Lamp cord dropping off the back edge
  cable([
    [-0.62, TOP + 0.005, -0.28],
    [-0.68, TOP - 0.02, -0.4],
    [-0.72, 0.35, -0.5],
    [-0.6, 0.02, -0.58],
    [0.0, 0.015, -0.62],
  ]);
  const strip = box(0.28, 0.035, 0.08, mat(0xe8e4da, { roughness: 0.6 }));
  strip.position.set(0.18, 0.02, -0.62);
  strip.rotation.y = 0.15;
  const stripLed = new THREE.Mesh(
    new THREE.CircleGeometry(0.005, 10),
    new THREE.MeshBasicMaterial({ color: 0xff5533 })
  );
  stripLed.position.set(-0.11, 0.019, 0.028);
  stripLed.rotation.x = -Math.PI / 2 + 0.5;
  strip.add(stripLed);
  root.add(strip);

  // ================= Poster & shelf (left wall) =================
  const poster = new THREE.Group();
  poster.position.set(-1.585, 1.55, 0.55);
  poster.rotation.y = Math.PI / 2;
  const posterSheet = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.594),
    new THREE.MeshStandardMaterial({ map: posterTexture(), roughness: 0.85 })
  );
  posterSheet.receiveShadow = true;
  const pFrame = box(0.46, 0.634, 0.015, mat(0x1e1a16, { roughness: 0.5 }));
  pFrame.position.z = -0.009;
  poster.add(pFrame, posterSheet);
  root.add(poster);

  const shelf = new THREE.Group();
  shelf.position.set(-1.57, 1.25, -0.35);
  shelf.rotation.y = Math.PI / 2;
  const plank = box(0.55, 0.022, 0.14, mat(0x4a3220, { roughness: 0.6 }));
  shelf.add(plank);
  // little row of books
  const shelfBookColors = [0x6e3b34, 0x2f4858, 0x8a7440, 0x4a5a43, 0x3a3a52];
  let bx = -0.2;
  shelfBookColors.forEach((c, i) => {
    const h = 0.11 + (i % 3) * 0.012;
    const b = box(0.022, h, 0.1, mat(c, { roughness: 0.8 }));
    b.position.set(bx, h / 2 + 0.011, 0);
    b.rotation.z = i === shelfBookColors.length - 1 ? -0.18 : 0;
    shelf.add(b);
    bx += 0.026;
  });
  // tiny plant
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.045, 16), mat(0xb56a4a, { roughness: 0.7 }));
  pot.position.set(0.16, 0.034, 0);
  pot.castShadow = true;
  shelf.add(pot);
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.07, 6), mat(0x3f6a3a, { roughness: 0.8 }));
    const a = (i / 5) * Math.PI * 2;
    leaf.position.set(0.16 + Math.cos(a) * 0.012, 0.09, Math.sin(a) * 0.012);
    leaf.rotation.z = Math.cos(a) * 0.5;
    leaf.rotation.x = Math.sin(a) * 0.5;
    shelf.add(leaf);
  }
  root.add(shelf);

  // ================= Ambient / fill =================
  const hemi = new THREE.HemisphereLight(0x4a4460, 0x201812, 0.85);
  root.add(hemi);
  // Dusk light through the window — mauve-blue, warmer than moonlight.
  const moonLight = new THREE.DirectionalLight(0x8a7a9c, 1.2);
  moonLight.position.set(-1.1, 2.5, 0.5);
  moonLight.target.position.set(0.4, DESK_H, -0.2);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(1024, 1024);
  moonLight.shadow.bias = -0.002;
  root.add(moonLight, moonLight.target);
  // Whisper of warm bounce from the lamp pool back up at the scene
  const bounce = new THREE.PointLight(0xcc8855, 0.25, 2.0, 2);
  bounce.position.set(0, TOP + 0.3, 0.4);
  root.add(bounce);

  // ================= OS screen refresh =================
  // (folded into animate below so it shares the clock)

  // ================= Life =================
  // While an object is focused, the lamp eases down — close-ups otherwise
  // blow out inside its hotspot, and the dim reads like eyes adjusting.
  let dim = 0;
  let dimTarget = 0;
  function animate(t) {
    dim += (dimTarget - dim) * 0.05;
    const base = 5.5 + Math.sin(t * 1.7) * 0.15 + Math.sin(t * 7.3) * 0.05;
    lampLight.intensity = base * (1 - dim * 0.55);
    screenGlow.intensity = 0.25 + Math.sin(t * 11) * 0.015;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
    leds.forEach((l) => l.color.setHSL(0.38, 1, 0.35 + pulse * 0.25));
    nowT = t;
    if (os.tick(t)) screenTex.needsUpdate = true;
    steamSprites.forEach(({ sp, phase, sway }, i) => {
      const k = (t - steamT0) * 0.45 - i * 0.28;
      if (k <= 0 || k >= 1) {
        sp.material.opacity = 0;
        return;
      }
      sp.position.y = 0.11 + k * 0.14;
      sp.position.x = Math.sin(t * sway + phase * 9) * 0.008 * k;
      sp.material.opacity = Math.sin(Math.PI * k) * 0.22;
      sp.scale.set(0.022 + k * 0.03, 0.045 + k * 0.05, 1);
    });
  }

  const setFocusDim = (on) => {
    dimTarget = on ? 1 : 0;
  };

  return { animate, interactables, setFocusDim, os, screen };
}
