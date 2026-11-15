import bpy
import os
import re
import sys

SRC = "/home/hatch/workspace/browser_downloads/sess-966624835"
OUT = "/home/hatch/workspace/games/crazygame5/crazygame/assets/zombies/fbx/anim"

# Individual animations named by the user (his Mixamo screenshots), by source index.
# Index -> output clip name. Indices from the browser-download filenames.
#  1 = Hit Reaction (flinch back)          2 = Head Hit
#  3 = Shoulder Hit And Fall               40 = Zombie Dying (falling forward)
# 41 = Zombie Biting (victim on ground)   42 = Kick To The Groin
# 43 = Dying kneeling (player death)      44 = Dying lying flat (crawl death)
# 45 = Kip Up (boss stand-back-up)
# Walks are NOT re-extracted here: the demo already has n22 (Zombie Walking)
# and n23 (Creeping Zombie Walk) as animation-only clips.
JOBS = [
    (1,  "hit_reaction.fbx"),
    (2,  "head_hit.fbx"),
    (3,  "shoulder_hit_fall.fbx"),
    (40, "zombie_dying.fbx"),
    (41, "zombie_biting.fbx"),
    (42, "groin_hit.fbx"),
    (43, "dying_kneel.fbx"),
    (44, "dying_lying.fbx"),
    (45, "kip_up.fbx"),
]

only = None
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if argv:
    only = int(argv[0])

os.makedirs(OUT, exist_ok=True)

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


for idx, out_name in JOBS:
    if only is not None and idx != only:
        continue
    out_path = os.path.join(OUT, out_name)
    if os.path.exists(out_path):
        print(f"SKIP exists {out_name}", flush=True)
        continue
    src = src_by_idx.get(idx)
    if not src:
        print(f"FAIL no source file for index {idx}", flush=True)
        continue
    clear_scene()
    bpy.ops.import_scene.fbx(filepath=src)
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    arm = next((o for o in bpy.context.scene.objects if o.type == "ARMATURE"), None)
    if arm is None:
        print(f"FAIL no armature in index {idx}", flush=True)
        continue
    # Mixamo dual-take: pick the real 'mixamo.com' action (most fcurves,
    # not the generic Take 001 placeholder). See the demo extractor.
    cands = [a for a in bpy.data.actions if "Take 001" not in a.name]
    if not cands:
        cands = list(bpy.data.actions)
    action = max(cands, key=lambda a: len(a.fcurves))
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = action
    for a in list(bpy.data.actions):
        if a is not action:
            try:
                bpy.data.actions.remove(a)
            except Exception:
                pass
    if arm.animation_data:
        for track in list(arm.animation_data.nla_tracks):
            arm.animation_data.nla_tracks.remove(track)
    f0, f1 = action.frame_range
    bpy.context.scene.render.fps = 30
    bpy.context.scene.frame_start = int(round(f0))
    bpy.context.scene.frame_end = int(round(f1))
    bpy.ops.export_scene.fbx(
        filepath=out_path,
        bake_anim=True,
        bake_anim_use_all_bones=True,
        bake_anim_force_startend_keying=True,
        bake_anim_step=1.0,
        embed_textures=False,
        path_mode="COPY",
        use_selection=False,
        add_leaf_bones=False,
    )
    print(f"OK idx {idx} -> {out_name} frames {int(round(f0))}-{int(round(f1))} size {os.path.getsize(out_path)}", flush=True)
print("DONE", flush=True)
