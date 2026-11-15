import bpy
import os
import re
import sys

SRC = "/home/hatch/workspace/browser_downloads/sess-966624835"
OUT = "/home/hatch/workspace/your_files/zombie-pack-demo/anim"

# (source index in browser-download filename, output clip name)
JOBS = [
    # SCARY ZOMBIE PACK (12) - indices 4..15
    (4,  "s01-punch-right-hand.fbx"),
    (5,  "s02-kick-snap-rear.fbx"),
    (6,  "s03-kick-thrust-rear.fbx"),
    (7,  "s04-headbutt-hand-grab.fbx"),
    (8,  "s05-attack-overhead-two-hand.fbx"),
    (9,  "s06-biting-victim-ground.fbx"),
    (10, "s07-biting-standing-to-ground.fbx"),
    (11, "s08-neck-bite.fbx"),
    (12, "s09-dying-hit-falling-forward.fbx"),
    (13, "s10-death-falling-onto-back.fbx"),
    (14, "s11-punch-jab-right-arm.fbx"),
    (15, "s12-crawl-forward.fbx"),
    # NOT SO SCARY ZOMBIE PACK (24) - indices 16..39
    (16, "n01-attack-swipe.fbx"),
    (17, "n02-scream.fbx"),
    (18, "n03-idle-alert.fbx"),
    (19, "n04-agonizing.fbx"),
    (20, "n05-idle-looking-around.fbx"),
    (21, "n06-stand-up-stomach.fbx"),
    (22, "n07-running.fbx"),
    (23, "n08-stand-up-side.fbx"),
    (24, "n09-run.fbx"),
    (25, "n10-walk.fbx"),
    (26, "n11-idle-twitching.fbx"),
    (27, "n12-idle-standing.fbx"),
    (28, "n13-transition-ready-to-alert.fbx"),
    (29, "n14-scratch-idle.fbx"),
    (30, "n15-idle-upright-twitching.fbx"),
    (31, "n16-turn.fbx"),
    (32, "n17-transition-alert-to-ready.fbx"),
    (33, "n18-reaction-hit-flinch.fbx"),
    (34, "n19-reaction-hit-stumble-back.fbx"),
    (35, "n20-stumbling.fbx"),
    (36, "n21-stand-up-back.fbx"),
    (37, "n22-walking-zombie.fbx"),
    (38, "n23-walking-creeping.fbx"),
    (39, "n24-crawl.fbx"),
]

# Optional argv: single index to process (test mode), e.g. "4"
only = None
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if argv:
    only = int(argv[0])

os.makedirs(OUT, exist_ok=True)

# map source index -> file
src_by_idx = {}
for f in os.listdir(SRC):
    m = re.search(r"-(\d+)-[^/]+\.fbx$", f)
    if m:
        src_by_idx[int(m.group(1))] = os.path.join(SRC, f)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for coll in (bpy.data.actions, bpy.data.meshes, bpy.data.materials,
                 bpy.data.images, bpy.data.armatures, bpy.data.cameras,
                 bpy.data.lights):
        for block in list(coll):
            try:
                coll.remove(block)
            except Exception:
                pass


results = []
for idx, out_name in JOBS:
    if only is not None and idx != only:
        continue
    out_path = os.path.join(OUT, out_name)
    if os.path.exists(out_path):
        print(f"SKIP exists {out_name}", flush=True)
        results.append((idx, out_name, "skip"))
        continue
    src = src_by_idx.get(idx)
    if not src:
        print(f"FAIL no source file for index {idx}", flush=True)
        results.append((idx, out_name, "no-source"))
        continue
    try:
        clear_scene()
        bpy.ops.import_scene.fbx(filepath=src)
        # delete all mesh objects; keep the armature (carries the animation)
        for o in list(bpy.context.scene.objects):
            if o.type == "MESH":
                bpy.data.objects.remove(o, do_unlink=True)
        arm = next((o for o in bpy.context.scene.objects if o.type == "ARMATURE"), None)
        if arm is None:
            print(f"FAIL no armature in index {idx}", flush=True)
            results.append((idx, out_name, "no-armature"))
            continue
        # MIXAMO DUAL-TAKE GOTCHA: the file holds TWO actions.
        # 'Armature|Take 001|BaseLayer' is an IDENTICAL generic take in
        # every file (260 fcurves, 1-273.4 frames) — NOT the animation.
        # The REAL animation is 'Armature|mixamo.com|Layer0' (520 fcurves,
        # per-clip frame range). Pick the action with the most fcurves
        # that is not the Take 001 placeholder, and make it active.
        cands = [a for a in bpy.data.actions if "Take 001" not in a.name]
        if not cands:
            cands = list(bpy.data.actions)
        action = max(cands, key=lambda a: len(a.fcurves))
        if arm.animation_data is None:
            arm.animation_data_create()
        arm.animation_data.action = action
        # Drop every other action + clear NLA tracks, or the FBX exporter
        # bakes the placeholder Take 001 into the file alongside the real
        # clip and three.js may pick animations[0] = the wrong one.
        for a in list(bpy.data.actions):
            if a is not action:
                try:
                    bpy.data.actions.remove(a)
                except Exception:
                    pass
        if arm.animation_data:
            for track in list(arm.animation_data.nla_tracks):
                arm.animation_data.nla_tracks.remove(track)
        if action is None:
            print(f"FAIL no action in index {idx}", flush=True)
            results.append((idx, out_name, "no-action"))
            continue
        f0, f1 = action.frame_range
        # Trim to the ACTION range (Mixamo scene range is 1-250 regardless;
        # baking the full range appends a frozen tail) and force 30fps.
        bpy.context.scene.render.fps = 30
        bpy.context.scene.frame_start = int(round(f0))
        bpy.context.scene.frame_end = int(round(f1))
        bpy.ops.object.select_all(action="DESELECT")
        arm.select_set(True)
        bpy.context.view_layer.objects.active = arm
        bpy.ops.export_scene.fbx(
            filepath=out_path,
            use_selection=True,
            bake_anim=True,
            bake_anim_use_all_bones=True,
            bake_anim_force_startend_keying=True,
            embed_textures=False,
            path_mode="COPY",
            use_mesh_modifiers=False,
            add_leaf_bones=False,
        )
        size = os.path.getsize(out_path)
        print(f"OK {out_name} frames {int(round(f0))}-{int(round(f1))} size {size}",
              flush=True)
        results.append((idx, out_name, f"ok {size}"))
    except Exception as e:
        print(f"FAIL {out_name}: {e}", flush=True)
        results.append((idx, out_name, f"error {e}"))

print("SUMMARY:", flush=True)
for r in results:
    print("  ", r, flush=True)
