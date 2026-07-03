import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  paperTexture,
  bookCoverTexture,
  posterTexture,
  stickyTexture,
  skyTexture,
  forestLayerTexture,
  frostTexture,
  steamTexture,
} from "./textures.js";
import { createOS } from "./os.js";
import { asset } from "./assets.js";
import { config, getLayout } from "./store.js";

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
  // Soft plain white carpet: no busy diffuse pattern, just subtle fibre depth
  // from the wool normal map so it reads as clean pile.
  const carpetNormal = pbr("/textures/wool_boucle_nor_gl_1k.jpg", { repeat: 10 });
  const floorMat = new THREE.MeshStandardMaterial({
    normalMap: carpetNormal,
    normalScale: new THREE.Vector2(0.4, 0.4),
    color: 0xa89a7c, // dark beige carpet
    roughness: 0.98,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({
    map: pbr("/textures/painted_plaster_wall_diff_1k.jpg", { repeat: 2, srgb: true }),
    color: 0xa89a7c, // warm olive-tan plaster, lofi room tone (lifted)
    roughness: 0.95,
  });
  // Back wall built around a window opening (x∈[-0.7,0.8], y∈[1.05,2.0]) so
  // the forest diorama behind it reads with real parallax depth.
  const WZ = -0.62;
  const wallSeg = (w, h, x, y) => {
    const m = box(w, h, 0.04, wallMat.clone());
    m.position.set(x, y, WZ);
    m.receiveShadow = true;
    root.add(m);
  };
  // Opening: x∈[-0.7, 0.58], y∈[1.05, 2.0] (trimmed on the right).
  wallSeg(8, 2.0, 0, 3.0);          // above the window
  wallSeg(8, 1.05, 0, 0.525);       // below the window
  wallSeg(3.3, 0.95, -2.35, 1.52);  // left of the window
  wallSeg(3.42, 0.95, 2.29, 1.52);  // right of the window (pulled in)
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), wallMat.clone());
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-1.15, 2, 0);
  leftWall.receiveShadow = true;
  root.add(leftWall);

  // Skirting board along both walls — crisp white, Nordic
  const skirtMat = mat(0x6a5138, { roughness: 0.65 });
  const skirtB = box(8, 0.09, 0.02, skirtMat);
  skirtB.position.set(0, 0.045, -0.61);
  const skirtL = box(0.02, 0.09, 8, skirtMat);
  skirtL.position.set(-1.14, 0.045, 0);
  root.add(skirtB, skirtL);

  // ================= Window: wide, behind the desk, full of stars =================
  // Recessed diorama behind the opening: star backdrop farthest, then three
  // pine layers receding toward the glass. Different depths → parallax as the
  // camera moves. All unlit (MeshBasic) so they glow like a real night sky.
  const diorama = new THREE.Group();
  diorama.position.set(0.05, 1.52, 0);
  const starBackdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 3.6),
    new THREE.MeshBasicMaterial({ map: skyTexture() })
  );
  starBackdrop.position.set(0, 0.03, -1.75);
  diorama.add(starBackdrop);
  // Shorter pines sitting low in the opening; three depths for parallax.
  // Warm dusk-toned silhouettes: far layer catches a little sunset haze, near
  // layers fall to near-black. Very wide (texture tiled) so no edge shows.
  const forestLayers = [
    { z: -1.35, w: 11, h: 0.95, y: -0.34, color: "#4a3a42", base: 350, spread: 42, step: 34, seed: 3 },
    { z: -1.05, w: 9.5, h: 0.9, y: -0.36, color: "#2a2029", base: 350, spread: 52, step: 28, seed: 7 },
    { z: -0.8, w: 8, h: 0.85, y: -0.38, color: "#150f16", base: 350, spread: 64, step: 24, seed: 12 },
  ];
  for (const L of forestLayers) {
    const map = forestLayerTexture(L);
    map.wrapS = THREE.RepeatWrapping;
    map.repeat.x = L.w / 3.4; // keep pine size consistent as the plane widens
    const layer = new THREE.Mesh(
      new THREE.PlaneGeometry(L.w, L.h),
      new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false })
    );
    layer.position.set(0, L.y, L.z);
    diorama.add(layer);
  }
  root.add(diorama);

  // Frame matches the trimmed opening: local x∈[-0.75, 0.53], centred at -0.11.
  const windowGroup = new THREE.Group();
  windowGroup.position.set(0.05, 1.52, -0.615);
  const frameMat = mat(0x7a5c3e, { roughness: 0.6 }); // warm timber
  const fT = box(1.4, 0.06, 0.07, frameMat);
  fT.position.set(-0.11, 0.5, 0);
  const fB = box(1.4, 0.06, 0.07, frameMat);
  fB.position.set(-0.11, -0.5, 0);
  const fL = box(0.06, 1.06, 0.07, frameMat);
  fL.position.x = -0.75;
  const fR = box(0.06, 1.06, 0.07, frameMat);
  fR.position.x = 0.53;
  const mullion = box(0.04, 0.95, 0.055, frameMat); // single centre divider
  mullion.position.x = -0.11;
  const sill = box(1.46, 0.035, 0.14, frameMat);
  sill.position.set(-0.11, -0.545, 0.05);
  windowGroup.add(fT, fB, fL, fR, mullion, sill);
  // Left pane frosted (the openable one) — milky glass over that half.
  const frostPane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.95),
    new THREE.MeshBasicMaterial({
      map: frostTexture(), transparent: true, opacity: 0.3, depthWrite: false,
    })
  );
  frostPane.position.set(-0.43, 0, 0.02);
  windowGroup.add(frostPane);
  // a little latch on the frosted (opening) sash
  const latch = box(0.03, 0.012, 0.02, mat(0xb8b2a6, { metalness: 0.4, roughness: 0.4 }));
  latch.position.set(-0.13, 0, 0.05);
  windowGroup.add(latch);
  root.add(windowGroup);

  // ---- Curtains flanking the window (soft linen drapes) ----
  const curtainMat = new THREE.MeshStandardMaterial({
    color: 0xc7b79a, roughness: 0.9, side: THREE.DoubleSide,
  });
  function curtainPanel(wx, flip) {
    const g = new THREE.PlaneGeometry(0.42, 1.16, 14, 20);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const fold = Math.sin(px * 20 + (flip ? 1.5 : 0)) * 0.03 + Math.sin(px * 44) * 0.01;
      pos.setZ(i, fold);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, curtainMat);
    m.position.set(wx, 1.56, -0.45); // in front of the sill, not through it
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
  }
  curtainPanel(-0.92, false);
  curtainPanel(0.78, true);
  const crod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.013, 2.05, 12),
    mat(0x3a2c1e, { metalness: 0.3, roughness: 0.5 })
  );
  crod.rotation.z = Math.PI / 2;
  crod.position.set(-0.07, 2.16, -0.44);
  root.add(crod);
  for (const fx of [-1.09, 0.95]) {
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), mat(0x3a2c1e, { metalness: 0.3, roughness: 0.5 }));
    finial.position.set(fx, 2.16, -0.44);
    root.add(finial);
  }

  // Faint cool starlight spilling in over the desk from behind.
  const windowGlow = new THREE.RectAreaLight(0xd6a878, 0.7, 1.5, 0.95); // warm dusk spill
  windowGlow.position.set(0.05, 1.5, -0.6);
  windowGlow.lookAt(0.05, 0.7, 1.2);
  root.add(windowGlow);
  const starDir = new THREE.DirectionalLight(0xc09878, 0.35);
  starDir.position.set(0.1, 1.9, -2.4);
  starDir.target.position.set(0.05, DESK_H, 0.3);
  root.add(starDir, starDir.target);

  // Greens shared by the trailing vines below.
  const greenA = mat(0x3f6a42, { roughness: 0.85 });
  const greenB = mat(0x557a48, { roughness: 0.85 });

  // ---- Trailing vines: from the window's top corners, drooping leaves ----
  function vine(x0, y0, z0, strands, len) {
    const vg = new THREE.Group();
    for (let s = 0; s < strands; s++) {
      const sway = (s / strands - 0.5) * 0.3;
      const pts = [];
      for (let k = 0; k <= 4; k++) {
        const t = k / 4;
        pts.push(new THREE.Vector3(
          x0 + sway * t + Math.sin(s * 7 + k) * 0.02,
          y0 - len * t * t,
          z0 + 0.03 * t + Math.cos(s * 5 + k) * 0.015
        ));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.0022, 5), greenA);
      vg.add(stem);
      for (let k = 1; k <= 7; k++) {
        const p = curve.getPoint(k / 7);
        const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.016, 8), k % 2 ? greenA : greenB);
        leaf.geometry.scale?.(1, 1.4, 1);
        leaf.position.copy(p);
        leaf.rotation.set(Math.sin(k * 3 + s) * 0.8, Math.cos(k * 2) * 0.8, 0);
        leaf.material.side = THREE.DoubleSide;
        vg.add(leaf);
      }
    }
    root.add(vg);
  }
  vine(-0.72, 2.02, -0.58, 4, 0.55);
  vine(0.82, 2.02, -0.58, 3, 0.4);

  // Small potted plant (Poly Haven potted_plant_04, CC0) on the desk corner.
  gltfLoader.load(asset("/models/potted_plant_04/potted_plant_04_1k.gltf"), (g) => {
    const plant = g.scene;
    let pb = new THREE.Box3().setFromObject(plant);
    const ps = pb.getSize(new THREE.Vector3());
    plant.scale.setScalar(0.2 / ps.y);
    pb = new THREE.Box3().setFromObject(plant);
    const pc = pb.getCenter(new THREE.Vector3());
    plant.position.set(-0.74 - pc.x, TOP - pb.min.y, -0.3 - pc.z);
    plant.rotation.y = -0.6;
    plant.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    root.add(plant);
  });

  // ================= Desk =================
  // Nordic desk: pale oak slab with softly rounded edges, light tapered legs.
  const deskMat = new THREE.MeshStandardMaterial({
    map: pbr("/textures/oak_veneer_01_diff_1k.jpg", { srgb: true }),
    normalMap: pbr("/textures/oak_veneer_01_nor_gl_1k.jpg"),
    roughnessMap: pbr("/textures/oak_veneer_01_rough_1k.jpg"),
    color: 0xd9b184, // honey oak under lamplight
    roughness: 1,
  });
  const deskTop = new THREE.Mesh(
    new RoundedBoxGeometry(1.7, 0.042, 0.85, 3, 0.012),
    deskMat
  );
  deskTop.castShadow = true;
  deskTop.receiveShadow = true;
  deskTop.position.set(0, DESK_H, 0);
  root.add(deskTop);
  const legMat = mat(0x9a7a54, { roughness: 0.6 });
  for (const [x, z] of [[-0.74, -0.34], [0.74, -0.34], [-0.74, 0.34], [0.74, 0.34]]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.027, DESK_H - 0.02, 20),
      legMat
    );
    leg.position.set(x, (DESK_H - 0.02) / 2, z);
    leg.rotation.z = x < 0 ? 0.05 : -0.05; // gentle mid-century splay
    leg.rotation.x = z < 0 ? -0.05 : 0.05;
    leg.castShadow = true;
    leg.receiveShadow = true;
    root.add(leg);
  }
  const apron = box(1.45, 0.06, 0.02, legMat);
  apron.position.set(0, DESK_H - 0.06, -0.34);
  root.add(apron);

  // ================= Laptop (Poly Haven classic_laptop, CC0) =================
  const laptop = new THREE.Group();
  laptop.position.set(0.05, TOP, -0.12);
  laptop.rotation.y = -0.1;
  // The screen is a live canvas: DESKTOPPER OS draws to it every frame it
  // changes, and interactions forwards clicks/keys into it.
  const os = createOS({ config });
  os.setHandlers({ openUrl: (u) => window.open(asset(u), "_blank", "noopener") });
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
      if (o.isMesh) {
        o.castShadow = o.receiveShadow = true;
        // The re-parented screen plane throws off auto bounding spheres, which
        // frustum-culls the whole laptop at some angles. It's tiny — just skip.
        o.frustumCulled = false;
      }
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
  screen.frustumCulled = false;
  laptop.add(screen);
  root.add(laptop);
  interactables.push({
    id: "laptop",
    kind: "laptop",
    object: laptop,
    focus: { pos: [0.07, TOP + 0.25, 0.18], look: [0.05, TOP + 0.17, -0.24] },
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

  // ================= Desk lamp: classic anglepoise, proper flat base =================
  const lampG = new THREE.Group();
  lampG.position.set(-0.62, TOP, -0.24);
  const lampMetal = mat(0x2e3d33, { roughness: 0.38, metalness: 0.5 }); // deep green enamel
  const lampBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.08, 0.014, 32),
    lampMetal
  );
  lampBase.position.y = 0.007;
  lampBase.castShadow = true;
  lampBase.receiveShadow = true;
  lampG.add(lampBase);
  const joint1 = new THREE.Mesh(new THREE.SphereGeometry(0.017, 16, 16), lampMetal);
  joint1.position.set(0, 0.022, 0);
  lampG.add(joint1);
  const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.32, 12), lampMetal);
  arm1.position.set(0.05, 0.17, 0.02);
  arm1.rotation.z = -0.32;
  arm1.rotation.x = 0.06;
  arm1.castShadow = true;
  lampG.add(arm1);
  const joint2 = new THREE.Mesh(new THREE.SphereGeometry(0.015, 16, 16), lampMetal);
  joint2.position.set(0.1, 0.32, 0.04);
  lampG.add(joint2);
  const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.28, 12), lampMetal);
  arm2.position.set(0.21, 0.36, 0.06);
  arm2.rotation.z = -1.18;
  arm2.castShadow = true;
  lampG.add(arm2);
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.075, 0.12, 32, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x2e3d33, roughness: 0.38, metalness: 0.5, side: THREE.DoubleSide,
    })
  );
  shade.position.set(0.32, 0.38, 0.08);
  // Point the shade mouth down at the desk pool; the bulb stays recessed up
  // inside so no naked glare faces the viewer.
  const beamDir = new THREE.Vector3(0.22, -0.72, 0.16).normalize();
  shade.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), beamDir);
  shade.castShadow = true;
  lampG.add(shade);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff2d8 })
  );
  bulb.position.copy(shade.position).addScaledVector(beamDir, 0.02);
  lampG.add(bulb);
  root.add(lampG);

  // The lamp is the key light again — it's night out there.
  // Narrower cone: a wide (114°) cone wrecks the shadow-map precision, letting
  // the lamp bleed through the desk onto the floor. 0.62 rad keeps a warm pool
  // on the desk while the desk cleanly shadows everything below.
  const lampLight = new THREE.SpotLight(0xffa95c, 4.2, 3.2, 0.62, 0.7, 1.4);
  lampLight.position.set(-0.28, TOP + 0.36, -0.15); // at the shade mouth
  lampLight.target.position.set(0.02, TOP, 0.14);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(2048, 2048);
  lampLight.shadow.bias = -0.002;
  lampLight.shadow.radius = 6;
  root.add(lampLight, lampLight.target);

  // The whole lamp is clickable to toggle its light (handled in interactions).
  interactables.push({ id: "lamp", kind: "lamp", object: lampG });

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

  // ================= Speakers (a prop you can power on/off) =================
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
    interactables.push({ id: `speaker-${x < 0 ? "l" : "r"}`, kind: "speaker", object: spk });
  }
  let speakersOn = true; // powered on by default
  const setSpeakersOn = (on) => { speakersOn = on; };

  // ================= Framed photo =================
  const frame = new THREE.Group();
  frame.position.set(0.68, TOP, -0.2);
  frame.rotation.y = -0.5;
  const frameBorder = box(0.11, 0.14, 0.012, mat(0xd8d4cc, { roughness: 0.5 }));
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
  // Owner-supplied photo (edit mode) overrides the generated silhouette, and
  // the frame resizes to the uploaded image's aspect ratio.
  const photoTex0 = new THREE.CanvasTexture(photoCanvas);
  photoTex0.colorSpace = THREE.SRGBColorSpace;
  if (config.photoImage) {
    const img = new Image();
    img.onload = () => {
      const a = img.width / img.height;
      const t = new THREE.CanvasTexture(img);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      photo.material.map = t;
      photo.material.needsUpdate = true;
      const h = 0.13, w = h * a;
      photo.geometry.dispose();
      photo.geometry = new THREE.PlaneGeometry(w, h);
      frameBorder.geometry.dispose();
      frameBorder.geometry = new THREE.BoxGeometry(w + 0.024, h + 0.028, 0.012);
    };
    img.src = asset(config.photoImage);
  }
  const photo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.085, 0.11),
    new THREE.MeshStandardMaterial({ map: photoTex0, roughness: 0.5 })
  );
  photo.position.set(0, 0, 0.007);
  frameBorder.add(photo);
  const strut = box(0.02, 0.1, 0.008, mat(0x3a2b1e));
  strut.position.set(0, 0.05, -0.03);
  strut.rotation.x = 0.35;
  frame.add(frameBorder, strut);
  root.add(frame);
  interactables.push({
    id: "photo",
    kind: "photo",
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
  cvSheet.rotation.x = -Math.PI / 2; // portrait, aligned with the board (no extra spin)
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
  // Top book comes from portfolio.json (`book`) — deep maroon with gold type
  // (the Bardo Thodol by default), readable from the hero shot.
  const topBook = config.book ?? { title: "Bardo Thodol", author: "The Tibetan Book of the Dead" };
  const topCover = bookCoverTexture({
    title: topBook.title,
    author: topBook.author,
    bg: "#4a2018",
    fg: "#d8b46a",
  });
  const topBookMats = [
    mat(0x4a2018), mat(0x4a2018),
    new THREE.MeshStandardMaterial({ map: topCover, roughness: 0.6 }), // top face
    mat(0x4a2018),
    mat(0xd8cfb8, { roughness: 0.95 }), mat(0x4a2018),
  ];
  const topBookMesh = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.025, 0.205), topBookMats);
  topBookMesh.castShadow = true;
  topBookMesh.receiveShadow = true;
  topBookMesh.position.set(0.01, stackY + 0.0125, 0.01);
  topBookMesh.rotation.y = 0.35;
  bookStack.add(topBookMesh);
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
  const strip = box(0.28, 0.035, 0.08, mat(0x35353a, { roughness: 0.7 }));
  strip.position.set(0.18, 0.02, -0.5); // sat in front of the wall, not in it
  strip.rotation.y = 0.15;
  const stripLed = new THREE.Mesh(
    new THREE.CircleGeometry(0.005, 10),
    new THREE.MeshBasicMaterial({ color: 0xff5533 })
  );
  stripLed.position.set(-0.11, 0.019, 0.028);
  stripLed.rotation.x = -Math.PI / 2 + 0.5;
  strip.add(stripLed);
  root.add(strip);

  // ================= Poster (back wall, customisable) =================
  // portfolio.json `poster` supports { image } (a URL/path to your own art)
  // or { title, subtitle } for the generated print.
  const poster = new THREE.Group();
  poster.position.set(-1.14, 1.32, 0.45); // left wall — the window owns the back
  poster.rotation.y = Math.PI / 2;
  const posterMat = new THREE.MeshStandardMaterial({
    map: posterTexture(config.poster ?? {}),
    roughness: 0.85,
  });
  const posterSheet = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.735), posterMat);
  posterSheet.receiveShadow = true;
  const pFrame = box(0.56, 0.775, 0.015, mat(0x3a352e, { roughness: 0.5 }));
  pFrame.position.z = -0.009;
  poster.add(pFrame, posterSheet);
  root.add(poster);
  // Uploaded poster art: composite the title/subtitle over the image and
  // resize the frame to the image's aspect ratio.
  if (config.poster?.image) {
    const img = new Image();
    img.onload = () => {
      const a = img.width / img.height;
      const cw = 512, ch = Math.round(512 / a);
      const cvs = document.createElement("canvas");
      cvs.width = cw;
      cvs.height = ch;
      const x = cvs.getContext("2d");
      x.drawImage(img, 0, 0, cw, ch);
      const title = config.poster.title, sub = config.poster.subtitle;
      if (title || sub) {
        const g = x.createLinearGradient(0, ch * 0.55, 0, ch);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,0.7)");
        x.fillStyle = g;
        x.fillRect(0, ch * 0.55, cw, ch * 0.45);
        x.textAlign = "left";
        if (title) {
          x.fillStyle = "#fdf6e8";
          x.font = `bold ${Math.round(cw * 0.062)}px Georgia, serif`;
          x.fillText(title, cw * 0.06, ch - (sub ? ch * 0.075 : ch * 0.05));
        }
        if (sub) {
          x.fillStyle = "#e0d6c4";
          x.font = `${Math.round(cw * 0.034)}px monospace`;
          x.fillText(sub, cw * 0.06, ch - ch * 0.03);
        }
      }
      const t = new THREE.CanvasTexture(cvs);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      posterMat.map = t;
      posterMat.needsUpdate = true;
      const h = 0.75, w = Math.min(0.66, h * a);
      posterSheet.geometry.dispose();
      posterSheet.geometry = new THREE.PlaneGeometry(w, h);
      pFrame.geometry.dispose();
      pFrame.geometry = new THREE.BoxGeometry(w + 0.04, h + 0.04, 0.015);
    };
    img.src = asset(config.poster.image);
  }

  // ================= Bookshelf (left wall) with trailing vine =================
  const shelfG = new THREE.Group();
  shelfG.position.set(-1.11, 0, -0.3);
  shelfG.rotation.y = Math.PI / 2;
  const shelfWood = mat(0x6a5138, { roughness: 0.65 });
  for (const sy of [0.95, 1.3, 1.65]) {
    const plank = box(0.72, 0.022, 0.16, shelfWood);
    plank.position.y = sy;
    shelfG.add(plank);
  }
  for (const sx of [-0.35, 0.35]) {
    const side = box(0.022, 0.82, 0.16, shelfWood);
    side.position.set(sx, 1.3, 0);
    shelfG.add(side);
  }
  const shelfBookColors = [0x6e4a3a, 0x3a4a58, 0x8a7440, 0x4a5a43, 0x5a3a52, 0x7a5a38, 0x44584a];
  for (const [sy, count, lean] of [[0.95, 7, true], [1.3, 5, false]]) {
    let bx = -0.31;
    for (let i = 0; i < count; i++) {
      const h = 0.16 + ((i * 7) % 3) * 0.02;
      const b = box(0.03, h, 0.11 + ((i * 3) % 2) * 0.02, mat(shelfBookColors[(i + sy * 10) % 7 | 0], { roughness: 0.8 }));
      b.position.set(bx, sy + 0.011 + h / 2, 0);
      if (lean && i === count - 1) b.rotation.z = -0.22;
      shelfG.add(b);
      bx += 0.042;
    }
  }
  // storage box on the middle shelf's free end
  const shelfBox = box(0.14, 0.1, 0.13, mat(0x8a6c4a, { roughness: 0.85 }));
  shelfBox.position.set(0.24, 1.3 + 0.061, 0);
  shelfG.add(shelfBox);
  root.add(shelfG);
  // vine trailing off the top shelf
  vine(-1.09, 1.68, -0.12, 3, 0.5);

  // ================= Ambient / fill =================
  // Room tone lifted so the palette (wood, walls, book spines) actually reads
  // while the night mood holds.
  const hemi = new THREE.HemisphereLight(0x74806a, 0x2c2820, 1.55);
  root.add(hemi);
  // A soft moonlit ambient wash from the window side, fills the darker corners.
  // It casts shadows so the desk properly blocks it from the floor (otherwise
  // the fill leaks through and lights an odd pool under the table).
  const roomFill = new THREE.DirectionalLight(0x9db3c4, 0.82);
  roomFill.position.set(0.4, 1.6, 2.2);
  roomFill.target.position.set(-0.4, DESK_H, -0.2);
  roomFill.castShadow = true;
  roomFill.shadow.mapSize.set(1024, 1024);
  roomFill.shadow.camera.near = 0.5;
  roomFill.shadow.camera.far = 8;
  roomFill.shadow.camera.left = -3;
  roomFill.shadow.camera.right = 3;
  roomFill.shadow.camera.top = 3;
  roomFill.shadow.camera.bottom = -3;
  roomFill.shadow.bias = -0.0015;
  root.add(roomFill, roomFill.target);
  // Second gentle fill from the left so the bookshelf side isn't crushed.
  const leftFill = new THREE.DirectionalLight(0xb0a488, 0.36);
  leftFill.position.set(-2.0, 1.5, 1.0);
  leftFill.target.position.set(0, DESK_H, 0);
  root.add(leftFill, leftFill.target);

  // ================= OS screen refresh =================
  // (folded into animate below so it shares the clock)

  // ================= Life =================
  // While an object is focused, the lamp eases down — close-ups otherwise
  // blow out inside its hotspot, and the dim reads like eyes adjusting.
  let dim = 0;
  let dimTarget = 0;
  let lampOn = true;
  function animate(t) {
    dim += (dimTarget - dim) * 0.05;
    const base = 4.6 + Math.sin(t * 1.7) * 0.12 + Math.sin(t * 7.3) * 0.04;
    lampLight.intensity = lampOn ? base * (1 - dim * 0.55) : 0;
    // The screen only floods the desk when it's actually on. A sleeping laptop
    // (the "click to wake" screen) barely glows, so switching the lamp off
    // doesn't leave a bright pool of screen-light on the desk.
    const screenLit = os.mode === "on" ? 1 : 0.22;
    screenGlow.intensity = (0.25 + Math.sin(t * 11) * 0.015) * screenLit;
    screenLight.intensity = screenLit;
    // Speaker LEDs: steady green with a faint breathe when on, dim red when off.
    if (speakersOn) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
      leds.forEach((l) => l.color.setHSL(0.38, 1, 0.4 + pulse * 0.15));
    } else {
      leds.forEach((l) => l.color.setHSL(0.02, 0.9, 0.12));
    }
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

  // Click the lamp to switch the bulb on/off. When off, the room falls back to
  // the ambient/fill lights and the bulb mesh goes dark.
  const setLampOn = (on) => {
    lampOn = on;
    bulb.material.color.setHex(on ? 0xfff2d8 : 0x2a2620);
  };

  // ================= Editable object registry + saved layout =================
  // Movable in edit mode. Interactables carry a `focus`, which we shift by the
  // same delta when the object is repositioned so click-to-focus still lands.
  const editables = [];
  for (const it of interactables) {
    if (it.id === "laptop") continue; // centrepiece stays put
    editables.push({ id: it.id, object: it.object, item: it });
  }
  editables.push({ id: "books", object: bookStack });
  editables.push({ id: "pencup", object: cupG });
  editables.push({ id: "photo", object: frame });
  editables.push({ id: "poster", object: poster });

  const layout = getLayout();
  for (const e of editables) {
    e.orig = {
      pos: e.object.position.toArray(),
      rot: e.object.rotation.toArray().slice(0, 3),
    };
    const L = layout[e.id];
    if (!L) continue;
    const before = e.object.position.clone();
    e.object.position.set(...L.pos);
    e.object.rotation.set(...L.rot);
    e.baseY = e.object.position.y;
    if (e.item) {
      e.item.baseY = e.object.position.y;
      if (e.item.focus) {
        const d = e.object.position.clone().sub(before);
        e.item.focus.pos = e.item.focus.pos.map((v, i) => v + d.getComponent(i));
        e.item.focus.look = e.item.focus.look.map((v, i) => v + d.getComponent(i));
      }
    }
  }

  return { animate, interactables, editables, setFocusDim, setSpeakersOn, setLampOn, os, screen };
}
