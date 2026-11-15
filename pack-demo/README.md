# Zombie Pack Animation Demo — Outbreak: Resistance

One zombie (the Prisoner), every animation from both Mixamo packs, so you can
test each one and tell us which to use in the game.

## How to open it

**Option A — unzip and double-click won't work directly** (browsers block
local file loading). Serve the folder with any static server, e.g.:

```
cd zombie-pack-demo
python3 -m http.server 8932
```

then open http://localhost:8932/pack-demo.html

**Option B — VS Code:** right-click `pack-demo.html` → "Open with Live Server".

## How to test

- Left panel lists all 36 animations: **Scary Zombie Pack (12)** and
  **Not So Scary Zombie Pack (24)**, each with its length in seconds.
- Click any animation — it plays on the zombie. The "NOW PLAYING" box shows
  the name, pack and length.
- **Pause** button (or Spacebar) freezes the pose. **Loop** toggles repeat
  vs play-once (deaths / stand-ups make most sense with Loop OFF).
- Drag to orbit the camera, scroll to zoom.

## What's inside

- `pack-demo.html` — the demo page (three.js r128, same FBXLoader pipeline
  as the game, so clips behave exactly like they would in-game).
- `anim/` — 36 animation-only FBX clips (~470 KB each, 18 MB total),
  extracted from the Mixamo downloads. Textures/skins stripped.
- `zombie/prisoner.fbx` — the demo zombie (Prisoner, shared Mixamo skeleton).
- `libs/` — three.js r128 + FBXLoader + fflate + SkeletonUtils.
- `extract_pack_clips.py` — the Blender script that extracted the clips.

## Notes for the dev (not the user)

- The 11 individual animations (Hit Reaction, Head Hit, Shoulder Hit And
  Fall, Kick To The Groin, Zombie Dying, Dying kneeling, Zombie Biting
  ground, Kip Up, Dying lying flat, Walking x2) are NOT in this demo —
  they go into the game later.
- Two loader gotchas are documented in pack-demo.html comments:
  1. Mixamo FBX files carry TWO actions; the real animation is
     `mixamo.com|Layer0`, the `Take 001` take is an identical placeholder
     in every file. The extractor picks the action with the most fcurves.
  2. three.js r128 PropertyBinding falls back to the mixer ROOT for any
     track whose bone is missing on the character (the Prisoner's right
     hand is a stump — ~20 finger bones missing), which overwrites the
     whole zombie's transform. The demo filters clips to bones the
     zombie actually has, and puts the 0.01 unit scale on a wrapper group.
     **If any of these clips are ever copied into the game, zombies.js
     needs the same bone filter** — its current loader only strips
     .position tracks.
