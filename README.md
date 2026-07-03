# Desktopper

A cozy 3D desk at dusk that *is* a portfolio. A retro laptop running a little
Mint-flavoured OS, scientific papers scattered where you left them, tea still
steaming, headphones that play your song when you put them on.

**Live:** https://mangofillet.github.io/desktopper/

## What's on the desk

- **Papers** — click one, the camera leans in, read the abstract, open the DOI
- **Laptop** — boots DESKTOPPER OS: desktop icons, file manager, a real
  (enough) terminal — `ls`, `cat about.txt`, `open <paper>` — and one easter
  egg on the wallpaper for those who know to *wake up*
- **Floppy disks** — click and the top disk arcs across the desk into the
  laptop's front drive; projects open on screen
- **Headphones** — put them on and a certain track plays; take them off and it
  fades away
- **Speakers** — cycle the playlist through them
- **Mug** — poke it; it steams, ready for long projects
- Framed photo → bio · sticky notes → contact links · clipboard → CV

## Make it yours

Everything is driven by one file — [`portfolio.json`](portfolio.json): name,
bio, links, `papers[]` (title/authors/venue/year/url/abstract), `projects[]`,
CV, and tracks. The desk adapts: one sheet of paper per publication (up to 6).
Fork, swap the JSON, deploy.

Music: drop mp3 files in `public/audio/` and point `tracks[]` /
`headphonesTrack` at them. Audio files are not committed to this repo —
supply tracks you have the rights to.

## Run it

```bash
npm install
npm run dev       # dev server
npm run verify    # headless smoke test + screenshots into .verify/
npm run build     # production build to dist/
```

Deploys to GitHub Pages automatically on push to `main`.

## Assets

- [classic_laptop](https://polyhaven.com/a/classic_laptop),
  [desk_lamp_arm_01](https://polyhaven.com/a/desk_lamp_arm_01),
  [wood_table_001](https://polyhaven.com/a/wood_table_001),
  [old_wood_floor](https://polyhaven.com/a/old_wood_floor),
  [painted_plaster_wall](https://polyhaven.com/a/painted_plaster_wall)
  — Poly Haven, CC0
- Everything else (papers, book covers, poster, night sky, the OS) is drawn
  procedurally on canvases at runtime

Built with [three.js](https://threejs.org/) and Vite. Assisted by Claude Code.
