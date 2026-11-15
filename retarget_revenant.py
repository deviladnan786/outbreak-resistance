#!/usr/bin/env python3
"""Retarget a shared Mixamo animation clip onto the Ragged Revenant rig
using Blender's constraint solver (no hand-rolled quaternion math).

Usage (inside Blender):
  blender -b --python retarget_revenant.py -- <src_clip.fbx> <out_clip.fbx>

Method:
  - Import the Revenant rig (target armature), delete its mesh.
  - Import the source clip FBX (source armature + action). NO rescaling:
    Blender's FBX importer already puts the clip at ~1.8m world height and
    the rig at ~0.021m; constraints work in WORLD space, so rotations copy
    correctly regardless, and the Hips Copy Location bakes to local values
    consistent with the existing Revenant clips (which were exported from
    the same as-imported scale).
  - Copy Rotation (World Space, Replace) on every target bone from the
    same-named source bone.
  - Hips location: copy the SOURCE action's Hips location offset fcurve
    directly (do NOT solve it from matrices). The source clip's Hips
    location is an OFFSET from its rest pose (rest Y = hip height in cm,
    offset Y goes 0 -> about -77 as the character falls). The matrix
    solve returned an ABSOLUTE position instead; keyframing that as the
    location made the exporter double-count the rest pose and the Hips
    ended up at -77m in-game (shoulder_hit_fall / groin_hit rendered
    underground). Both rigs are Mixamo skeletons with the same Hips
    bone conventions, so the source offset transfers directly.
  - Bake with visual keying over the source action's frame range, clear
    constraints, export clip-only FBX (FPS 30, frame range = action range).
"""
import bpy
import os
import sys

RIG = "/home/hatch/workspace/user/files/Ragged_Revenant_for_mixamo.fbx"


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


def pick_source_action():
    # Mixamo FBX can carry a stub action (1-2 frames) alongside the real one.
    # Pick the action with the LONGEST frame range, tie-break by fcurve count.
    cands = [a for a in bpy.data.actions if "Take 001" not in a.name]
    if not cands:
        cands = list(bpy.data.actions)
    if not cands:
        return None
    def key(a):
        f0, f1 = a.frame_range
        return (f1 - f0, len(a.fcurves))
    return max(cands, key=key)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:]
    src_clip, out_path = argv[0], argv[1]
    print(f"RETARGET {src_clip} -> {out_path}", flush=True)
    clear_scene()

    # --- target: Revenant rig ---
    bpy.ops.import_scene.fbx(filepath=RIG)
    bpy.context.scene.render.fps = 30
    target = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    print(f"target armature: {target.name} bones={len(target.data.bones)}", flush=True)

    # --- source: clip FBX ---
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.fbx(filepath=src_clip)
    bpy.context.scene.render.fps = 30
    new_objs = [o for o in bpy.context.scene.objects if o not in before]
    source = next((o for o in new_objs if o.type == "ARMATURE"), None)
    if source is None:
        print("FAIL: no source armature in clip", flush=True)
        return 1
    for o in list(new_objs):
        if o.type == "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    print(f"source armature: {source.name} bones={len(source.data.bones)}", flush=True)

    action = pick_source_action()
    if action is None:
        print("FAIL: no action in clip", flush=True)
        return 1
    f0, f1 = [int(round(f)) for f in action.frame_range]
    print(f"source action: {action.name} frames {f0}-{f1} fcurves={len(action.fcurves)}", flush=True)
    if source.animation_data is None:
        source.animation_data_create()
    source.animation_data.action = action
    # Remove other actions so the bake/export can't pick the wrong one.
    for a in list(bpy.data.actions):
        if a is not action:
            try:
                bpy.data.actions.remove(a)
            except Exception:
                pass

    bpy.context.scene.frame_start = f0
    bpy.context.scene.frame_end = f1

    # --- constraints on the target ---
    src_bones = {b.name for b in source.data.bones}
    missing = []
    constrained = 0
    for pb in target.pose.bones:
        if pb.name not in src_bones:
            missing.append(pb.name)
            continue
        c = pb.constraints.new("COPY_ROTATION")
        c.target = source
        c.subtarget = pb.name
        c.target_space = "WORLD"
        c.owner_space = "WORLD"
        c.mix_mode = "REPLACE"
        constrained += 1
    if missing:
        print(f"WARN bones missing in source (skipped): {missing}", flush=True)
    hips = target.pose.bones.get("mixamorig:Hips")
    if hips is None:
        print("FAIL: no mixamorig:Hips on target", flush=True)
        return 1
    # Hips location: copy the SOURCE action's Hips location offset fcurve
    # directly (see header). The matrix-solved location came out as an
    # absolute position, which the exporter then double-counted with the
    # rest pose (Hips ended up at -77m in-game).
    src_hips_fcs = {}
    for fc in action.fcurves:
        if fc.data_path == 'pose.bones["mixamorig:Hips"].location':
            src_hips_fcs[fc.array_index] = fc
    if len(src_hips_fcs) != 3:
        print(f"FAIL: source Hips location fcurves found: {sorted(src_hips_fcs)}", flush=True)
        return 1
    print(f"constraints: rotation on {constrained} bones + Hips location copied from source action", flush=True)

    # --- bake with visual keying (MANUAL: nla.bake cancels in headless
    # mode; keyframing the evaluated constrained pose per frame is exact) ---
    if target.animation_data is None:
        target.animation_data_create()
    baked = bpy.data.actions.new("Retargeted_" + os.path.splitext(os.path.basename(out_path))[0])
    target.animation_data.action = baked
    for pb in target.pose.bones:
        pb.rotation_mode = "QUATERNION"
    from mathutils import Matrix as _Matrix
    for fr in range(f0, f1 + 1):
        bpy.context.scene.frame_set(fr)
        bpy.context.view_layer.update()
        # The constrained pose lives ONLY in each bone's evaluated `matrix`
        # (rotation_quaternion/location/matrix_basis all stay at rest values
        # under constraints). Solve the pose offset (matrix_basis) from the
        # matrices: basis = rest_rel^-1 * parent_mat^-1 * mat, where
        # rest_rel = parent_rest^-1 * bone_rest.
        eval_obj = target.evaluated_get(bpy.context.evaluated_depsgraph_get())
        for pb_eval, pb in zip(eval_obj.pose.bones, target.pose.bones):
            mat = pb_eval.matrix
            if pb_eval.parent:
                pmat = pb_eval.parent.matrix
                prest = pb_eval.parent.bone.matrix_local
            else:
                pmat = _Matrix.Identity(4)
                prest = _Matrix.Identity(4)
            rest_rel = prest.inverted() @ pb_eval.bone.matrix_local
            basis = rest_rel.inverted() @ pmat.inverted() @ mat
            _loc, rot, _s = basis.decompose()
            pb.rotation_quaternion = rot
            pb.keyframe_insert(data_path="rotation_quaternion", frame=fr)
        hips_eval = eval_obj.pose.bones["mixamorig:Hips"]
        # Hips location: copy the source action's offset directly (the
        # matrix-solved absolute position was double-counted by the
        # exporter). fcurve.evaluate(frame) gives the offset in the
        # source's (cm) units; the Revenant's skeleton is meter-scale
        # in-game (unlike the shared characters, which are cm rigs
        # inside a x0.01 group), so scale cm -> m here. Without the
        # x0.01 the Hips offset reads as -77 METERS in-game.
        hips.location = (
            src_hips_fcs[0].evaluate(fr) * 0.01,
            src_hips_fcs[1].evaluate(fr) * 0.01,
            src_hips_fcs[2].evaluate(fr) * 0.01,
        )
        hips.keyframe_insert(data_path="location", frame=fr)
    # Remove the constraints now that the pose is baked.
    for pb in target.pose.bones:
        for c in list(pb.constraints):
            pb.constraints.remove(c)
    bf0, bf1 = baked.frame_range
    print(f"baked action: {baked.name} frames {bf0}-{bf1} fcurves={len(baked.fcurves)}", flush=True)
    # Hips Y offset range (sanity: an OFFSET from rest, so ~0 at standing
    # and about -70..-80 at the bottom of a fall; must NOT be ~+90)
    hips_y = None
    for fc in baked.fcurves:
        if fc.data_path == 'pose.bones["mixamorig:Hips"].location' and fc.array_index == 1:
            vals = [kp.co.y for kp in fc.keyframe_points]
            hips_y = (min(vals), max(vals))
    print(f"baked Hips Y offset range: {hips_y}", flush=True)

    # --- remove source armature AND its action, export clip-only FBX ---
    # The source action must be deleted too: the FBX exporter writes every
    # action left in the file, and the source action's (cm-scale, unscaled)
    # Hips location was leaking into the export for some clips.
    bpy.data.objects.remove(source, do_unlink=True)
    try:
        bpy.data.actions.remove(action)
    except Exception:
        pass
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.scene.render.fps = 30
    bpy.context.scene.frame_start = int(round(bf0))
    bpy.context.scene.frame_end = int(round(bf1))
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
    print(f"OK {out_path} size={os.path.getsize(out_path)}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
