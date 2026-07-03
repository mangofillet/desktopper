# Desktopper — Progress

See plan.md for the full spec. Dev: `npm run dev` · verify: `node verify.mjs <port>` (screenshots → `.verify/`) · probe: `node probe.mjs <port>` · lamp pose sweep: `node lamp-sweep.mjs <port>` · CV regen: `node make-cv.mjs`.

- [x] M1 Blockout + camera rig — approved
- [x] M2 Lighting/materials/post — Poly Haven CC0 textures, canvas-generated content textures, bloom+vignette+grain. Evening/dusk ambience per user (was night); treeline horizon, no buildings.
- [x] M3 Interactions — hover lift+glow, 1.2s cinematic flights, Esc/click-away home, lamp dims on focus (close-ups blow out otherwise). Papers→abstract card+DOI, floppy→arcs into front drive slot (probe-tuned position), headphones→wear animation + Dissolved Girl + toast (fade on take-off), mug→steam wisp + caption on click only.
- [x] M4 DESKTOPPER OS (src/os.js) — sleep→boot→Mint-ish desktop on a 640×480 canvas (real VGA res). Icons, papers/projects windows, doc viewer with open↗, working terminal (help/ls/cat/open/papers/clear/exit), "Wake up…" wallpaper easter egg → matrix rain. Clicks raycast to screen UV; keys forwarded while laptop focused.
- [x] M5 Audio — user tracks in Assets/ → public/audio/ (gitignored, copyright). Headphones channel + speakers playlist cycle (toast controls), WebAudio brown-noise window ambience after first gesture.
- [x] M6 Config — everything reads portfolio.json; asset() resolves paths against BASE_URL; placeholder cv.pdf generated (make-cv.mjs).
- [x] M7 Real CC0 models — Poly Haven classic_laptop (screen node rotated to ~93°, display plane parented into screen mesh local space, 4:3) + desk_lamp_arm_01 (yaw -2.0; head is local -z — found via lamp-sweep.mjs).
- [x] Deploy — https://github.com/mangofillet/desktopper → https://mangofillet.github.io/desktopper/ (Pages via Actions; verified live, no console errors). Music gitignored (copyright) so the deployed site plays no tracks until rights-cleared files are added.

- [x] V2 golden-hour revamp (user-directed; v1 preserved as git tag `v1-dusk-study`) — late-afternoon light: sun directional 3.4 from side window + RectArea spill 3.0 + hemi 1.6, exposure 1.2, lamp barely-on (1.3). Window moved to left wall, closed, curtains + rod; poster (now "golden hour") on back wall; potted_plant_04 (CC0) floor right; brighter floor/desk/wall tints; camera maxDistance 2.1 (desk-locked); top book configurable via portfolio.json `book` (default GEB); Matrix reduced to ONE egg (boot line "wake up…") — wallpaper egg + matrix rain removed, sleep screen says "click to wake".

- [x] V3 Nordic revamp (user-directed) — near-white plaster walls + pale laminate floor (laminate_floor_02) + whitewashed oak desk (oak_veneer_01 on RoundedBoxGeometry, splayed cream cylinder legs); walls pulled in close to the desk (back z -0.62, left x -1.15) instead of moving the desk (keeps all interaction anchors); double-hung sash window (no cross mullion), white frame, linen curtains; shelf removed; plant shrunk to 0.2m onto the desk by the lamp; poster lower/larger and customisable (portfolio.json `poster`: {title, subtitle} or {image}); camera maxDistance 1.9 (hero = max zoom-out); grain 0.009.

Notes:
- Playwright pixel-clicks are brittle (papers under headphones); use window.__dt dev hooks (focus/home/wearPhones/os).
- Lighting balance point: lamp 5.5, RectArea screen 1.0, bloom threshold 0.85, exposure 1.0, hemi 0.85 evening.
- User feedback log lives in plan.md + this file; look-verdict re-ask still owed after live demo.
