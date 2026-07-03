// Owner-only edit mode. Unlocked with ?edit (remembered thereafter). Lets you:
//  · drag desk objects around and rotate the selected one (live, persisted)
//  · edit all text content, swap the poster/photo images, add/remove papers
//    & projects — saved to localStorage, applied to the 3D scene on "Apply".
//  · export the merged portfolio.json to commit into the repo.
import * as THREE from "three";
import { config, saveConfig, setLayout, resetAll, exportConfig, editorUnlocked, lockEditor } from "./store.js";

const css = /* css */ `
  #dt-edit-toggle {
    position: fixed; left: 16px; bottom: 16px; z-index: 30;
    width: 44px; height: 44px; border-radius: 50%; cursor: pointer;
    background: rgba(20,17,13,0.82); border: 1px solid rgba(255,200,140,0.3);
    color: #f0e6d4; font-size: 19px; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 22px rgba(0,0,0,0.5);
  }
  #dt-edit-toggle:hover { background: rgba(40,32,22,0.92); }
  #dt-edit-hint {
    position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 31;
    background: rgba(20,17,13,0.85); color: #ece0cc; border: 1px solid rgba(255,200,140,0.3);
    padding: 7px 16px; border-radius: 999px; font: 13px system-ui, sans-serif; display: none;
  }
  #dt-edit-hint.show { display: block; }
  #dt-edit-panel {
    position: fixed; top: 0; right: 0; height: 100%; width: 340px; z-index: 32;
    background: #1c1915; color: #e8ddca; font: 13px system-ui, sans-serif;
    display: none; flex-direction: column; box-shadow: -8px 0 40px rgba(0,0,0,0.5);
  }
  #dt-edit-panel.show { display: flex; }
  #dt-edit-panel header { display: flex; align-items: center; gap: 8px; padding: 12px 14px; background: #141210; }
  #dt-edit-panel header b { margin-right: auto; font-size: 14px; }
  #dt-edit-tabs { display: flex; gap: 4px; padding: 8px 10px 0; background: #141210; }
  #dt-edit-tabs button { flex: 1; padding: 7px 4px; border-radius: 6px 6px 0 0; cursor: pointer;
    background: #221e19; color: #b7ac97; border: none; font: 12px system-ui, sans-serif; }
  #dt-edit-tabs button.active { background: #2c2720; color: #f0e6d4; }
  #dt-edit-body { flex: 1; overflow-y: auto; padding: 14px; }
  #dt-edit-body h4 { margin: 14px 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: #9c9280; }
  #dt-edit-body label { display: block; margin: 8px 0 3px; color: #b7ac97; font-size: 11.5px; }
  #dt-edit-body input, #dt-edit-body textarea {
    width: 100%; box-sizing: border-box; background: #100e0b; color: #ece0cc;
    border: 1px solid #3a342b; border-radius: 5px; padding: 6px 8px; font: 12.5px system-ui, sans-serif;
  }
  #dt-edit-body textarea { resize: vertical; min-height: 60px; line-height: 1.4; }
  #dt-edit-body .row { border: 1px solid #322c24; border-radius: 7px; padding: 10px; margin-bottom: 10px; background: #201c17; }
  #dt-edit-body .row .rowhead { display: flex; align-items: center; gap: 6px; }
  #dt-edit-body .row .rowhead b { flex: 1; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #dt-edit-body button.mini { background: #322c24; color: #e8ddca; border: none; border-radius: 5px; padding: 4px 9px; cursor: pointer; font-size: 12px; }
  #dt-edit-body button.mini:hover { background: #423a2f; }
  #dt-edit-body button.add { width: 100%; padding: 8px; margin-top: 4px; background: #2b3a2e; color: #cfe6d4; }
  #dt-edit-body button.del { background: #3d2422; color: #e6b8b0; }
  #dt-edit-sel { background: #26302a; border: 1px solid #3a4a3e; border-radius: 7px; padding: 10px; margin-bottom: 12px; display: none; }
  #dt-edit-sel.show { display: block; }
  #dt-edit-sel .name { font-weight: 600; margin-bottom: 6px; }
  #dt-edit-sel input[type=range] { width: 100%; }
  #dt-edit-panel footer { padding: 10px 12px; background: #141210; display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
  #dt-edit-panel footer button { padding: 8px; border-radius: 6px; cursor: pointer; border: none; font: 12.5px system-ui, sans-serif; }
  #dt-edit-panel footer .apply { grid-column: 1 / 3; background: #2e7d4f; color: #eafff2; font-weight: 600; }
  #dt-edit-panel footer .apply:hover { background: #3aa66a; }
  #dt-edit-panel footer .exp { background: #33302a; color: #e8ddca; }
  #dt-edit-panel footer .reset { background: #3d2422; color: #e6b8b0; }
  #dt-edit-panel footer .note { grid-column: 1/3; color: #8c8575; font-size: 11px; text-align: center; }
`;

export function setupEditor({ renderer, camera, controls, editables, editState }) {
  if (!editorUnlocked()) return { active: false };

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ---- DOM ----
  const toggle = document.createElement("div");
  toggle.id = "dt-edit-toggle";
  toggle.textContent = "✎";
  toggle.title = "Edit mode";
  document.body.appendChild(toggle);

  const hint = document.createElement("div");
  hint.id = "dt-edit-hint";
  hint.textContent = "EDIT MODE · drag to move · click to select · scroll wheel over an object to rotate";
  document.body.appendChild(hint);

  const panel = document.createElement("div");
  panel.id = "dt-edit-panel";
  panel.innerHTML = `
    <header><b>Edit</b>
      <button class="mini" data-a="lock" title="Lock (hide editor)">🔒</button>
      <button class="mini" data-a="exit">Done</button>
    </header>
    <div id="dt-edit-tabs">
      <button data-tab="look" class="active">Look</button>
      <button data-tab="profile">Profile</button>
      <button data-tab="papers">Papers</button>
      <button data-tab="projects">Projects</button>
    </div>
    <div id="dt-edit-body">
      <div id="dt-edit-sel"></div>
      <div id="dt-edit-tabbody"></div>
    </div>
    <footer>
      <button class="apply" data-a="apply">Apply changes</button>
      <button class="exp" data-a="export">Export JSON</button>
      <button class="reset" data-a="reset">Revert to original</button>
      <div class="note">Move/rotate is live · text &amp; images apply on “Apply”.</div>
    </footer>`;
  document.body.appendChild(panel);

  const selBox = panel.querySelector("#dt-edit-sel");
  const tabBody = panel.querySelector("#dt-edit-tabbody");

  // ---- selection glow ----
  function setGlow(obj, on) {
    obj?.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m?.isMeshStandardMaterial) continue;
        if (on) {
          if (m.userData._e === undefined) m.userData._e = m.emissive.getHex();
          m.emissive.setHex(0x1c3a55);
        } else if (m.userData._e !== undefined) {
          m.emissive.setHex(m.userData._e);
        }
      }
    });
  }

  // ---- mesh → editable map for picking ----
  const meshToEd = new Map();
  for (const e of editables) {
    e.object.traverse((o) => { if (o.isMesh) meshToEd.set(o, e); });
    // Fixed offset from the object to its focus targets, so click-to-focus
    // follows the object when it's dragged.
    if (e.item?.focus) {
      const p = e.object.position;
      e.item._foff = {
        pos: e.item.focus.pos.map((v, i) => v - p.getComponent(i)),
        look: e.item.focus.look.map((v, i) => v - p.getComponent(i)),
      };
    }
  }
  const pickMeshes = [...meshToEd.keys()];

  const raycaster = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  const plane = new THREE.Plane();
  const hitPt = new THREE.Vector3();
  const grab = new THREE.Vector3();
  let selected = null;
  let dragging = false;

  function selectObj(e) {
    if (selected === e) return;
    if (selected) setGlow(selected.object, false);
    selected = e;
    if (selected) setGlow(selected.object, true);
    renderSel();
  }

  function persist(e) {
    setLayout(e.id, e.object.position.toArray(), e.object.rotation.toArray().slice(0, 3));
    // keep click-to-focus aligned with the moved object
    if (e.item?.focus && e.item._foff) {
      const p = e.object.position;
      e.item.focus.pos = e.item._foff.pos.map((v, i) => v + p.getComponent(i));
      e.item.focus.look = e.item._foff.look.map((v, i) => v + p.getComponent(i));
      e.item.baseY = p.y;
    }
  }

  function renderSel() {
    if (!selected) { selBox.classList.remove("show"); return; }
    selBox.classList.add("show");
    const deg = Math.round((selected.object.rotation.y * 180) / Math.PI);
    selBox.innerHTML = `
      <div class="name">Selected: ${selected.id}</div>
      <label>Rotate: <span class="rv">${deg}°</span></label>
      <input type="range" min="-180" max="180" value="${deg}" />
      <div style="margin-top:8px; display:flex; gap:6px;">
        <button class="mini" data-a="reset-pos">Reset position</button>
      </div>`;
    const range = selBox.querySelector("input");
    range.addEventListener("input", () => {
      selected.object.rotation.y = (range.value * Math.PI) / 180;
      selBox.querySelector(".rv").textContent = range.value + "°";
      persist(selected);
    });
    selBox.querySelector('[data-a="reset-pos"]').addEventListener("click", () => {
      if (!selected.orig) return;
      selected.object.position.fromArray(selected.orig.pos);
      selected.object.rotation.fromArray(selected.orig.rot);
      persist(selected);
      renderSel();
    });
  }

  // ---- pointer drag ----
  function toPtr(ev) {
    ptr.x = (ev.clientX / window.innerWidth) * 2 - 1;
    ptr.y = -(ev.clientY / window.innerHeight) * 2 + 1;
  }
  renderer.domElement.addEventListener("pointerdown", (ev) => {
    if (!editState.active || ev.button !== 0) return;
    toPtr(ev);
    raycaster.setFromCamera(ptr, camera);
    const hit = raycaster.intersectObjects(pickMeshes, false)[0];
    if (!hit) return; // empty space → let orbit handle it
    const e = meshToEd.get(hit.object);
    selectObj(e);
    dragging = true;
    controls.enabled = false;
    // horizontal drag plane through the object's current height
    plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), e.object.position);
    raycaster.ray.intersectPlane(plane, hitPt);
    grab.copy(hitPt).sub(e.object.position);
  });
  window.addEventListener("pointermove", (ev) => {
    if (!dragging || !selected) return;
    toPtr(ev);
    raycaster.setFromCamera(ptr, camera);
    if (raycaster.ray.intersectPlane(plane, hitPt)) {
      selected.object.position.x = hitPt.x - grab.x;
      selected.object.position.z = hitPt.z - grab.z;
    }
  });
  window.addEventListener("pointerup", () => {
    if (dragging && selected) persist(selected);
    dragging = false;
    if (editState.active) controls.enabled = true;
  });
  // scroll wheel over the selected object → rotate
  renderer.domElement.addEventListener("wheel", (ev) => {
    if (!editState.active || !selected) return;
    toPtr(ev);
    raycaster.setFromCamera(ptr, camera);
    if (!raycaster.intersectObjects(pickMeshes, false).length) return;
    ev.preventDefault();
    selected.object.rotation.y += (ev.deltaY > 0 ? 1 : -1) * 0.1;
    persist(selected);
    renderSel();
  }, { passive: false });

  // ---- content panel ----
  const field = (label, val, on, ph = "") =>
    `<label>${label}</label><input value="${(val ?? "").toString().replace(/"/g, "&quot;")}" placeholder="${ph}" data-bind>`;
  function bindInputs(container, getters) {
    [...container.querySelectorAll("[data-bind]")].forEach((el, i) => {
      el.addEventListener("input", () => { getters[i](el.value); saveConfig(); });
    });
  }

  function renderTab(tab) {
    let html = "", binders = [];
    if (tab === "look") {
      html = `
        <h4>Poster</h4>
        ${field("Title", config.poster?.title)}
        ${field("Subtitle", config.poster?.subtitle)}
        <label>Poster image</label><input type="file" accept="image/*" data-img="poster">
        <h4>Framed photo</h4>
        <label>Photo image</label><input type="file" accept="image/*" data-img="photo">
        <h4>Top book</h4>
        ${field("Title", config.book?.title)}
        ${field("Author", config.book?.author)}`;
      binders = [
        (v) => ((config.poster ??= {}).title = v),
        (v) => ((config.poster ??= {}).subtitle = v),
        (v) => ((config.book ??= {}).title = v),
        (v) => ((config.book ??= {}).author = v),
      ];
    } else if (tab === "profile") {
      html = `
        ${field("Name", config.name)}
        ${field("Tagline", config.tagline)}
        <label>Bio</label><textarea data-bind>${config.bio ?? ""}</textarea>
        <h4>Links</h4>
        ${field("Email", config.links?.email)}
        ${field("GitHub", config.links?.github)}
        ${field("Scholar", config.links?.scholar)}
        ${field("LinkedIn", config.links?.linkedin)}
        ${field("CV URL", config.cvUrl)}`;
      binders = [
        (v) => (config.name = v),
        (v) => (config.tagline = v),
        (v) => (config.bio = v),
        (v) => ((config.links ??= {}).email = v),
        (v) => ((config.links ??= {}).github = v),
        (v) => ((config.links ??= {}).scholar = v),
        (v) => ((config.links ??= {}).linkedin = v),
        (v) => (config.cvUrl = v),
      ];
    } else if (tab === "papers") {
      html = (config.papers || [])
        .map(
          (p, i) => `<div class="row" data-i="${i}">
            <div class="rowhead"><b>${p.title || "untitled"}</b>
              <button class="mini del" data-del="${i}">✕</button></div>
            ${field("Title", p.title)}
            ${field("Authors", p.authors)}
            ${field("Venue", p.venue)}
            ${field("Year", p.year)}
            <label>Abstract</label><textarea data-bind>${p.abstract ?? ""}</textarea>
            ${field("URL", p.url)}
          </div>`
        )
        .join("");
      html += `<button class="mini add" data-add="paper">+ add paper</button>`;
      binders = [];
      (config.papers || []).forEach((p) => {
        binders.push((v) => (p.title = v), (v) => (p.authors = v), (v) => (p.venue = v),
          (v) => (p.year = v), (v) => (p.abstract = v), (v) => (p.url = v));
      });
    } else if (tab === "projects") {
      html = (config.projects || [])
        .map(
          (p, i) => `<div class="row" data-i="${i}">
            <div class="rowhead"><b>${p.name || "untitled"}</b>
              <button class="mini del" data-del="${i}">✕</button></div>
            ${field("Name", p.name)}
            <label>Blurb</label><textarea data-bind>${p.blurb ?? ""}</textarea>
            ${field("URL", p.url)}
          </div>`
        )
        .join("");
      html += `<button class="mini add" data-add="project">+ add project</button>`;
      binders = [];
      (config.projects || []).forEach((p) => {
        binders.push((v) => (p.name = v), (v) => (p.blurb = v), (v) => (p.url = v));
      });
    }
    tabBody.innerHTML = html;
    bindInputs(tabBody, binders);
    wireStructural(tab);
  }

  function resizeImage(file, max, cb) {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL("image/jpeg", 0.85));
    };
    img.src = URL.createObjectURL(file);
  }

  function wireStructural(tab) {
    tabBody.querySelectorAll("[data-img]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const f = inp.files[0];
        if (!f) return;
        resizeImage(f, 640, (data) => {
          if (inp.dataset.img === "poster") (config.poster ??= {}).image = data;
          else config.photoImage = data;
          saveConfig();
        });
      });
    });
    tabBody.querySelectorAll("[data-del]").forEach((b) => {
      b.addEventListener("click", () => {
        const i = +b.dataset.del;
        (tab === "papers" ? config.papers : config.projects).splice(i, 1);
        saveConfig();
        renderTab(tab);
      });
    });
    const add = tabBody.querySelector("[data-add]");
    if (add) add.addEventListener("click", () => {
      if (add.dataset.add === "paper")
        (config.papers ??= []).push({ title: "New paper", authors: "", venue: "", year: "", abstract: "", url: "" });
      else (config.projects ??= []).push({ name: "New project", blurb: "", url: "" });
      saveConfig();
      renderTab(tab);
    });
  }

  let curTab = "look";
  renderTab(curTab);
  panel.querySelectorAll("#dt-edit-tabs button").forEach((b) => {
    b.addEventListener("click", () => {
      panel.querySelectorAll("#dt-edit-tabs button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      curTab = b.dataset.tab;
      renderTab(curTab);
    });
  });

  // ---- mode toggle + footer actions ----
  function setActive(on) {
    editState.active = on;
    panel.classList.toggle("show", on);
    hint.classList.toggle("show", on);
    toggle.style.display = on ? "none" : "flex";
    controls.enabled = true;
    if (!on && selected) { setGlow(selected.object, false); selected = null; renderSel(); }
  }
  toggle.addEventListener("click", () => setActive(true));
  panel.addEventListener("click", (ev) => {
    const a = ev.target.closest("[data-a]")?.dataset.a;
    if (!a) return;
    if (a === "exit") setActive(false);
    else if (a === "lock") { lockEditor(); setActive(false); toggle.style.display = "none"; }
    else if (a === "apply") location.reload();
    else if (a === "export") exportConfig();
    else if (a === "reset") {
      if (confirm("Revert everything (content + object positions) back to the original? This clears all your edits.")) {
        resetAll();
        location.reload();
      }
    }
  });

  return { get active() { return editState.active; }, setActive };
}
