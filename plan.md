# Desktopper — Plan

A 3D interactive portfolio showcase: a cozy night-study desk scene with a retro laptop, scattered papers linking to real scientific papers, and a Linux Mint-style OS you can actually poke around in. Config-driven from day one so it doubles as a reusable template.

**Status: plan approved pending user go — no code until express instruction.**

## Vision

- **Mood:** cozy night study — dark room, warm desk lamp, glowing laptop screen, deep soft shadows, steam curling off a mug of tea, faint sounds drifting in from an open window.
- **Audience:** academics/collaborators, recruiters, and general visitors alike — must be both stunning *and* genuinely usable to reach the papers in seconds.
- **Success bar (all four):**
  1. Screenshot-worthy beauty (lighting + post-processing first-class)
  2. Delightful interactions (everything plausible responds to hover/click)
  3. Actually usable portfolio (papers reachable in seconds)
  4. Deployed at a shareable URL by end of session

## Matrix homage (user suggestion, adopted as flavour — not a hard demand)

Inspired by Neo asleep at his desk (The Matrix opening): book stack on the desk topped by *Simulacra and Simulation* (candidate hollowed-book easter egg), headphones resting by the laptop, a "Wake up…" typed moment / green code-rain screensaver on the screen, faint green cast mixed into the warm palette. Music note: *Dissolved Girl* is copyrighted — user will supply tracks; flag licensing before shipping any track in the public repo (options: keep tracks out of repo, or CC alternative).

## The scene

On a wooden desk in a dark room, lit by a warm lamp:

| Object | Content it carries | Interaction |
|---|---|---|
| Retro laptop (open) | Everything, via Mint-style OS | Click → camera zooms to screen → usable GUI |
| Scattered papers | Scientific papers from config | Hover: lift/glow. Click: camera flies in, styled first page (title/authors/abstract) + "Read →" opens DOI/PDF in new tab |
| Framed photo / notebook | About me / bio | Click → zoom + bio panel |
| Sticky note / card holder | Contact links (email, GitHub, LinkedIn, Scholar) | Click → zoom + links |
| Floppy disks / small shelf | Projects (VECTRIS etc.) | Click → project cards with links |
| Clipboard / folder | CV | Click → download PDF |
| Mug of tea | Atmosphere | Steaming particle wisp; clink on click |
| Speakers (wired to laptop) | Music | Click to play/pause user-supplied tracks; subtle woofer pulse while playing |
| Window (background) | Atmosphere | Night outside; source of faint open-window soundscape |

## Laptop: Mint-style GUI

- Green/grey Linux Mint aesthetic: boot splash → desktop with taskbar, menu, clock.
- Draggable windows: **file manager** (papers/, projects/, about.txt, contact.txt, cv.pdf) and a **terminal app** (retro touch; `ls`, `cat`, `open` work on the same virtual filesystem).
- Rendered as live HTML on the screen plane (CSS3D or html-to-texture), driven by the same `portfolio.json` — the OS is a convincing prop, not an emulator, but files genuinely open.
- Doubles as the accessible/keyboard fallback path to all content.

## Audio

- **Music:** user-supplied tracks (to be provided later — placeholder silence/one CC0 lo-fi loop until then), toggled via the speakers, never autoplay.
- **Soundscape layer:** faint open-window ambience (distant street/night air/rain option), starts after first user interaction; independent volume, subtle.

## Camera & controls

- Gentle idle orbit/parallax around a composed hero shot.
- Click-to-focus: smooth camera flight to any interactive object; `Esc` / back button / click-away returns.
- Works with touch (tap to focus); pointer hover states on desktop.

## Customisation (template story)

- Single **`portfolio.json`**: `name`, `bio`, `links{}`, `papers[]` (title, authors, year, venue, doi/url, abstract), `projects[]` (name, blurb, url), `cvUrl`, `tracks[]`.
- Object count on the desk adapts to config (n papers → n sheets scattered).
- Ship with tasteful realistic placeholders; user swaps in real content after first deploy.

## Tech

- **Stack:** vanilla three.js + Vite (same patterns as VECTRIS). Post-processing: bloom, vignette, maybe SSAO/DoF if perf allows.
- **Assets:** CC0/CC-BY models (laptop, lamp, mug, speakers…) from Sketchfab/Poly Haven, procedural for simple items (papers, sticky notes). Attribute all CC-BY in README. Compress via glTF/draco; lazy-load.
- **Deploy:** new GitHub repo (authored as mangofillet, "Assisted by Claude Code" in README, no Claude co-author on commits) + GitHub Pages via Actions on push.

## Non-goals

- No CMS/backend — pure static site, content = config file.
- No accounts/social features — no comments, counters, likes.
- (Mobile: must load and be usable on phones; showcase experience targets desktop.)
- (Laptop OS: convincing scripted apps, not a real VM.)

## Verification plan

- **Iterative visual review:** headless Chromium screenshots (verify.mjs pattern from VECTRIS) shown to the user at each visual milestone — scene blockout → lighting pass → interactions → OS — with design questions each step, never one-shot to final.
- **Functional checks:** headless script drives the core flows (click paper → focus → link present; laptop boots; Esc returns; audio toggles) and captures console errors.
- **Perf bar:** 60 fps on desktop, initial load < ~5 MB gzipped, no long main-thread stalls.
- **Ship gate:** production build succeeds, Pages deploy verified live by fetching the URL, all config-driven content renders from `portfolio.json`.

## Milestones

1. Scaffold (Vite + three.js), scene blockout with placeholder geometry, camera rig — *screenshot review*
2. Lighting + materials + post-processing, real/CC assets in — *screenshot review*
3. Interactions: hover states, click-to-focus flights, paper pages — *screenshot + flow review*
4. Mint OS on the laptop screen (file manager + terminal) — *review*
5. Audio (tracks + window ambience), steam/particles, final polish
6. `portfolio.json` wiring end-to-end, placeholders in
7. Repo + GitHub Pages deploy, README with asset attributions, live verify
