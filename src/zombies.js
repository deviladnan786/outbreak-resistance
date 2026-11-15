/**
 * Outbreak: Resistance — Zombie Swarm + Waves (v3 — runtime FBX)
 * FSM per zombie: chase / attack / hit / stumble / dying, plus a CRAWL mode
 * driven by leg damage. Wave spawner mixes types, separation, XP vials,
 * kills/level HUD, game-over + extraction.
 *
 * CHARACTERS + ANIMATIONS load at runtime via THREE.FBXLoader (the same
 * pipeline Leon uses — it retargets Mixamo clips correctly). Baking Mixamo
 * clips into a GLB in Blender corrupts the pose (bone rest-orientation
 * mismatch stretches limbs into spikes), so the GLB route is abandoned.
 * The character FBX files are decimated + texture-downscaled in Blender and
 * exported as FBX (which preserves the Mixamo skeleton); the animation FBX
 * files are loaded as clips and .position tracks are stripped (like Leon).
 *
 * 5 zombie types: walker / prisoner (one-hand) / zombiegirl / parasite
 * (fast) / skeleton (boss). The old sprinter + brute are REMOVED.
 * Three.js r128, classic script (global THREE).
 *
 * LEG DAMAGE (the cripple system):
 * Each zombie has a separate legHp pool. A bullet that strikes below hip
 * height (~0.9m) damages the legs as well as the body. legDamagePct is the
 * % of legHp lost. Thresholds depend on the WAVE the zombie spawned in —
 * later waves are tougher and keep standing longer:
 *   Wave 1: 30% leg damage -> stumble, then CRAWL (permanent)
 *   Wave 2: 30% -> stumble then stand back up; 60% -> stumble, then CRAWL
 *   Wave 3+: 30%/60% -> stumble then stand back up; 90% -> stumble, then CRAWL
 * Crawling zombies are slower (40% speed) and lower (shorter hitbox) but
 * still chase and attack — leg shots slow the horde, they don't delete it.
 * Leg shots do only 25% BODY damage (see player.js) but FULL leg damage.
 */

const ZOMBIE_TYPES = {
  // --- shamblers (slow, mixed in every wave) ---
  // walker = the RAGGED REVENANT (his own Meshy look, Mixamo-rigged).
  // His skeleton is auto-rigged, so the shared Mixamo clips collapse him
  // (bone rest orientations don't match). He uses his own Mixamo-retargeted
  // clips (walk/attack/hit/death/crawl_revenant) — verified walking, attacking,
  // dying and crawling in the isolated test before wiring in.
  // v3.21: the 7 missed animations (hit reactions, zone falls, second
  // death, crawl bite, crawl death) were retargeted in Blender onto his
  // rig (retarget_revenant.py) — he never plays a shared clip. After a
  // zone fall he resumes his chase clip (NO kip_up — kip_up is boss-only).
  // BALANCE v3.19 — HP tiers so types feel different (bullet damage
  // UNCHANGED: body 34 / head 68 / leg 9 body + 34 leg). Parasite has
  // MORE HP than zombiegirl (80 vs 60) — his call. Note: parasite is
  // also the fastest (3.4 m/s), so it is now the toughest regular
  // zombie after Romero; if it feels too hard, tune it down. The 70%
  // zone-fall rule now actually triggers on walker/parasite/prisoner/
  // romero/boss because they survive 2+ shots to one zone.
  walker: {
    file: 'assets/zombies/fbx/revenant.fbx',
    speed: 1.3, hp: 70, dmg: 10, range: 1.5, radius: 0.45, xp: 10, legHp: 120,
    chase: 'walk_revenant', attack: 'attack_revenant', hit: 'hit_revenant', death: 'death_revenant', crawl: 'crawl_revenant',
    attackWindup: 0.45, attackDur: 0.9
  },
  prisoner: { // the ONE-HAND zombie (right hand is a stump, no fingers)
    file: 'assets/zombies/fbx/prisoner.fbx',
    speed: 1.25, hp: 90, dmg: 10, range: 1.5, radius: 0.45, xp: 10, legHp: 120,
    chase: 'walk_zombie', attack: 'attack', hit: 'hit_shambler', death: 'death_shambler', crawl: 'crawl',
    attackWindup: 0.45, attackDur: 0.9
  },
  zombiegirl: {
    file: 'assets/zombies/fbx/zombiegirl.fbx',
    speed: 1.6, hp: 60, dmg: 8, range: 1.4, radius: 0.4, xp: 10, legHp: 100,
    chase: 'walk_creeping', attack: 'attack', hit: 'hit_shambler', death: 'death_shambler', crawl: 'crawl',
    attackWindup: 0.4, attackDur: 0.85
  },
  // --- fast (sprinter role) ---
  parasite: {
    file: 'assets/zombies/fbx/parasite.fbx',
    speed: 3.4, hp: 80, dmg: 8, range: 1.4, radius: 0.45, xp: 10, legHp: 90,
    chase: 'run', attack: 'lunge', hit: 'hit_feral', death: 'death_feral', crawl: 'crawl',
    attackWindup: 0.3, attackDur: 0.7
  },
  // --- boss (brute role, replaced) ---
  skeleton: {
    file: 'assets/zombies/fbx/skeleton.fbx',
    speed: 0.95, hp: 400, dmg: 25, range: 1.9, radius: 0.7, xp: 30, legHp: 250,
    chase: 'stomp', attack: 'slam', hit: 'hit_feral', death: 'death_brute', crawl: 'crawl',
    attackWindup: 0.6, attackDur: 1.2
  },
  // --- Romero (Mixamo stock zombie, bare-chested, bloody) — joins wave 2 ---
  // NOTE: Mixamo ships his bones as mixamorig5:* — the "5" was stripped to
  // mixamorig:* in Blender so the shared clips bind (else he vanishes).
  romero: {
    file: 'assets/zombies/fbx/romero.fbx',
    speed: 1.45, hp: 120, dmg: 12, range: 1.5, radius: 0.45, xp: 15, legHp: 130,
    chase: 'walk', attack: 'attack', hit: 'hit_shambler', death: 'death_shambler', crawl: 'crawl',
    attackWindup: 0.45, attackDur: 0.9
  }
};

// READABILITY LIFT: the night scene's lights are dim, and most zombie
// materials ship with emissive black (or white at intensity 0), so the
// zombies render nearly pitch-black — only their bright green health bar
// shows, which reads as a "floating bar with no zombie". The earlier fix
// was a dim emissive lift, but that washes the texture out (whitish) and
// the user wants the ORIGINAL texture/color. So: NO emissive lift here —
// the zombies keep their true colours, and visibility comes from the scene
// lighting (ambient brightened in environment.js) instead.
const ZOMBIE_BASE_EMISSIVE = 0x000000;

// Unique animation clips (shared across types). Key = clip name used in
// ZOMBIE_TYPES, value = FBX file under assets/zombies/fbx/anim/.
const ZOMBIE_CLIPS = {
  walk: 'walk.fbx',
  attack: 'attack.fbx',
  hit_shambler: 'hit_shambler.fbx',
  death_shambler: 'death_shambler.fbx',
  crawl: 'crawl.fbx',
  run: 'run.fbx',
  lunge: 'lunge.fbx',
  hit_feral: 'hit_feral.fbx',
  death_feral: 'death_feral.fbx',
  stomp: 'stomp.fbx',
  slam: 'slam.fbx',
  death_brute: 'death_brute.fbx',
  // v3.18 — Mixamo hit/death/bite clips (animation-only FBX, extracted
  // from the pack-demo downloads). Different walks per zombie: the
  // prisoner shambles with 'walk_zombie' (Zombie Walking), the
  // zombiegirl creeps with 'walk_creeping' (Creeping Zombie Walk) —
  // 'charge' was REMOVED (never asked for, explicitly rejected).
  hit_reaction: 'hit_reaction.fbx',
  head_hit: 'head_hit.fbx',
  shoulder_hit_fall: 'shoulder_hit_fall.fbx',
  groin_hit: 'groin_hit.fbx',
  zombie_dying: 'zombie_dying.fbx',
  zombie_biting: 'zombie_biting.fbx',
  dying_lying: 'dying_lying.fbx',
  kip_up: 'kip_up.fbx',
  walk_zombie: 'walk_zombie.fbx',
  walk_creeping: 'walk_creeping.fbx',
  // Ragged Revenant's own retargeted clips (auto-rigged skeleton — the
  // shared clips collapse him). Extracted from the Mixamo FBX downloads.
  walk_revenant: 'walk_revenant.fbx',
  attack_revenant: 'attack_revenant.fbx',
  hit_revenant: 'hit_revenant.fbx',
  death_revenant: 'death_revenant.fbx',
  crawl_revenant: 'crawl_revenant.fbx',
  // v3.21 — the 7 missed animations retargeted IN BLENDER from the shared
  // clips onto the Revenant rig (retarget_revenant.py). Walker ONLY —
  // never give a shared clip to the walker. NO kip_up for the walker
  // (kip_up is boss-only, skeleton only); after a fall he resumes his
  // chase clip like the other non-boss zombies.
  hit_reaction_revenant: 'hit_reaction_revenant.fbx',
  head_hit_revenant: 'head_hit_revenant.fbx',
  shoulder_hit_fall_revenant: 'shoulder_hit_fall_revenant.fbx',
  groin_hit_revenant: 'groin_hit_revenant.fbx',
  zombie_dying_revenant: 'zombie_dying_revenant.fbx',
  zombie_biting_revenant: 'zombie_biting_revenant.fbx',
  dying_lying_revenant: 'dying_lying_revenant.fbx'
};

// Mixed waves — never a single type. Shamblers from wave 1, the fast
// parasite joins wave 2, the skeleton boss joins wave 3.
function waveComp(n) {
  return {
    walker: 2 + Math.floor(n / 2),
    prisoner: 1 + Math.floor((n - 1) / 2),
    zombiegirl: 1 + Math.floor((n - 1) / 2),
    parasite: n >= 2 ? 1 + Math.floor(n / 2) : 0,
    skeleton: n >= 3 ? Math.floor((n - 1) / 2) : 0,
    romero: n >= 2 ? 1 + Math.floor((n - 1) / 2) : 0
  };
}

// Leg-damage thresholds per wave: returns 'crawl', 'stumble' or null.
function legThresholdResult(wave, pct) {
  if (wave <= 1) {
    // One clean leg shot = 34/120 = 28.3% — the threshold sits just under
    // that so a single leg hit visibly drops the zombie to a crawl.
    if (pct >= 25) return 'crawl';
    return null;
  }
  if (wave === 2) {
    if (pct >= 60) return 'crawl';
    if (pct >= 30) return 'stumble';
    return null;
  }
  // wave 3+
  if (pct >= 90) return 'crawl';
  if (pct >= 60) return 'stumble';
  if (pct >= 30) return 'stumble';
  return null;
}

class Zombie {
  constructor(manager, typeKey, x, z, wave) {
    this.manager = manager;
    this.typeKey = typeKey;
    this.cfg = ZOMBIE_TYPES[typeKey];
    this.wave = wave || 1;
    this.hp = this.cfg.hp;
    this.maxHp = this.cfg.hp;
    this.legHp = this.cfg.legHp;
    this.legHpMax = this.cfg.legHp;
    this.crawling = false;   // permanent once the crawl threshold is crossed
    this.stumbled = false;   // set while a stumble is resolving (avoid re-trigger)
    this.alive = true;
    this.state = 'chase';
    this.stateT = 0;
    this.damageDealt = false;
    this.attackCooldown = 0; // seconds before this zombie may swing again
    this.flash = 0;
    this.deathT = 0;
    // v3.18 — 70% ZONE DAMAGE: hits to the upper body (shoulder) and the
    // stomach/groin accumulate separately. When a zone has taken 70% of
    // maxHp, the zombie plays that zone's fall animation and stands back
    // up (the boss kip-ups instead). Thresholds re-arm after each fall.
    this.upperDmg = 0;
    this.groinDmg = 0;
    this.nextUpperFallAt = 0.7 * this.maxHp;
    this.nextGroinFallAt = 0.7 * this.maxHp;
    this._hitAlt = 0; // alternates hit_reaction / cfg.hit so hits vary

    // Clone the template character. NOTE: plain scene.clone() SHARES the
    // skeleton with the template in three r128 (SkinnedMesh.copy just
    // assigns the same skeleton object), so the clone's bones point at the
    // template's bones. SkeletonUtils.clone() re-binds a fresh skeleton to
    // the clone's own bones.
    this.scene = THREE.SkeletonUtils.clone(manager.templates[typeKey]);
    this.scene.position.set(x, 0, z);
    this.scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        // Clone materials per instance so the hit flash is per-zombie.
        // A mesh may carry an ARRAY of materials (multi-material FBX) —
        // clone each entry, not the array itself.
        if (Array.isArray(o.material)) {
          o.material = o.material.map((m) => m.clone());
        } else if (o.material) {
          o.material = o.material.clone();
        }
        o.userData.zombie = this;
        // NOTE: do NOT register the skinned mesh for bullet raycast. In three
        // r128 Mesh.raycast applies boneTransform (CPU skinning) to every
        // vertex, and it returns no hits even when the ray passes through
        // the body. Use a simple hitbox instead.
      }
    });
    // HITBOX: invisible cylinder the bullets actually raycast against.
    // Robust (plain non-skinned mesh), generous, and matches the zombie's
    // body. Headshot test still uses the hit point height (above 1.5m);
    // leg hits are hits below hip height (~0.9m).
    // SCALE FIX: Mixamo character FBX are in CM, so the template root is
    // scaled x0.01 — and the hitbox + health bar are children of that root,
    // so they inherit the 0.01 scale and shrink to 1% (hitbox 4.5mm wide,
    // bar 9mm wide at 2cm high) — invisible and unhittable. Counter-scale
    // them by the inverse so their WORLD size is the intended one.
    const invS = 1 / this.scene.scale.x;
    this._invScale = invS;
    const hitGeo = new THREE.CylinderGeometry(this.cfg.radius, this.cfg.radius, 1.9, 8);
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    this.hitbox = new THREE.Mesh(hitGeo, hitMat);
    this.hitbox.scale.set(invS, invS, invS);
    this.hitbox.position.set(0, 0.95 * invS, 0);
    this.hitbox.userData.zombie = this;
    this.scene.add(this.hitbox);
    this.manager.registerHitMesh(this.hitbox);

    // HEALTH BAR: small sprite above the head, green -> yellow -> red.
    // Canvas texture redrawn only when HP changes (cheap).
    // (Counter-scaled like the hitbox — see SCALE FIX above.)
    this._hpCanvas = document.createElement('canvas');
    this._hpCanvas.width = 64; this._hpCanvas.height = 8;
    this._hpCtx = this._hpCanvas.getContext('2d');
    this._hpTex = new THREE.CanvasTexture(this._hpCanvas);
    this._hpMat = new THREE.SpriteMaterial({ map: this._hpTex, transparent: true, depthWrite: false });
    this._hpSprite = new THREE.Sprite(this._hpMat);
    this._hpSprite.scale.set(0.9 * invS, 0.1125 * invS, 1);
    this._hpSprite.position.set(0, 2.15 * invS, 0);
    this.scene.add(this._hpSprite);
    this._drawHpBar();

    // GROUND RING: a bright flat ring on the floor under the zombie, so its
    // position is unmistakable from ANY angle — especially top-down, where
    // a dark zombie on dark asphalt is nearly invisible and only its
    // health bar shows, which reads as a "floating bar with no zombie".
    // The ring is a plain (non-skinned) mesh, counter-scaled like the
    // hitbox/bar. It fades out with the corpse when the zombie dies.
    const ringGeo = new THREE.RingGeometry(0.45, 0.62, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    this._groundRing = new THREE.Mesh(ringGeo, ringMat);
    this._groundRing.rotation.x = -Math.PI / 2;
    this._groundRing.scale.set(invS, invS, invS);
    this._groundRing.position.set(0, 0.06 * invS, 0);
    this.scene.add(this._groundRing);

    manager.scene.add(this.scene);

    // Animation mixer on the clone; clips are the FBX-loaded clips shared
    // across all zombies of every type (stripped of .position tracks).
    this.mixer = new THREE.AnimationMixer(this.scene);
    this.actions = {};
    // 'lunge' is loaded too — it is the low crawl-attack clip (a crawling
    // zombie lunges forward while staying on the ground).
    // v3.18: shared-skeleton zombies also build actions for the Mixamo
    // hit/death/bite clips. The walker (Revenant) gets his OWN retargeted
    // versions (v3.21) — shared clips collapse his auto-rigged skeleton,
    // so he only ever plays his own retargeted clips. NO kip_up for the
    // walker (boss-only); after a fall he resumes his chase clip.
    const sharedExtra = this.typeKey === 'walker' ?
      ['hit_reaction_revenant', 'head_hit_revenant', 'shoulder_hit_fall_revenant', 'groin_hit_revenant', 'zombie_dying_revenant', 'zombie_biting_revenant', 'dying_lying_revenant'] :
      ['hit_reaction', 'head_hit', 'shoulder_hit_fall', 'groin_hit', 'zombie_dying', 'zombie_biting', 'dying_lying', 'kip_up'];
    for (const clipName of [this.cfg.chase, this.cfg.attack, this.cfg.hit, this.cfg.death, this.cfg.crawl, 'lunge', ...sharedExtra]) {
      const clip = manager.clips[clipName];
      if (clip) this.actions[clipName] = this.mixer.clipAction(clip);
    }
    this.activeAction = null;
    this.playClip(this.cfg.chase, 0.1);
    // WALK VARIETY: each zombie animates at a slightly different rhythm
    // (0.92–1.12x) so same-clip zombies never march in lockstep.
    this.mixer.timeScale = 0.92 + Math.random() * 0.2;
    this._tmpVel = new THREE.Vector3();
    this._tmpDir = new THREE.Vector3();
  }

  // Current chase clip + speed: crawl clip at 40% speed once crippled.
  chaseClip() {
    return this.crawling ? this.cfg.crawl : this.cfg.chase;
  }
  speedNow() {
    return this.crawling ? this.cfg.speed * 0.4 : this.cfg.speed;
  }

  playClip(name, fade = 0.15) {
    const next = this.actions[name];
    if (!next) return;
    if (this.activeAction === next) {
      // SELF-HEAL: an action can end up faded to weight 0 (a fadeOut that
      // completed) while still being the "active" one — then the zombie
      // renders in bind pose and floats toward the player with no walk
      // animation. If the weight dropped or it stopped, restart it at
      // full weight immediately (no fade ramp — it must be visible now).
      if (next.weight < 0.99 || !next.isRunning()) {
        next.reset().setLoop(THREE.LoopRepeat);
        next.weight = 1;
        next.play();
      }
      return;
    }
    if (this.activeAction) this.activeAction.fadeOut(fade);
    next.reset().setLoop(THREE.LoopRepeat).fadeIn(fade).play();
    this.activeAction = next;
  }

  playOnce(name, fade = 0.1) {
    const next = this.actions[name];
    if (!next) return;
    if (this.activeAction) this.activeAction.fadeOut(fade);
    next.reset().setLoop(THREE.LoopOnce).clampWhenFinished = true;
    next.fadeIn(fade).play();
    this.activeAction = next;
  }

  // Enter crawl mode permanently: low profile, slow, crawl animation.
  enterCrawl() {
    if (this.crawling) return;
    this.crawling = true;
    // Lower + shorten the hitbox so body shots still land on a low target
    // (counter-scaled — see SCALE FIX in the constructor).
    this.hitbox.scale.y = 0.5 * this._invScale;
    this.hitbox.position.y = 0.45 * this._invScale;
    if (this.state === 'chase') this.playClip(this.cfg.crawl, 0.15);
  }

  // A stumble: brief knock-down, then either stand back up (recover) or
  // drop into crawl (when the crawl threshold was crossed).
  startStumble(toCrawl) {
    if (this.state === 'dying' || this.state === 'stumble') return;
    this.state = 'stumble';
    this.stateT = 0.6;
    this._stumbleToCrawl = !!toCrawl;
    this.playClip(this.cfg.hit, 0.06);
  }

  // A zone fall: the zombie is knocked down by accumulated damage to one
  // body zone, then stands back up. Mirrors startStumble: a timed state
  // the update() loop resolves. The boss (skeleton) kip-ups instead of
  // just standing up (see the 'zonefall'/'kipup' branches in update()).
  startZoneFall(kind) {
    if (this.state === 'dying' || this.state === 'zonefall' || this.state === 'kipup' || this.state === 'stumble' || this.crawling) return false;
    // v3.21: the walker uses his own retargeted fall clips — never a
    // shared clip (it collapses him). After the fall he resumes his
    // chase clip (see update() 'zonefall' branch) — NO kip_up, which is
    // boss-only.
    const clipName = this.typeKey === 'walker'
      ? (kind === 'groin' ? 'groin_hit_revenant' : 'shoulder_hit_fall_revenant')
      : (kind === 'groin' ? 'groin_hit' : 'shoulder_hit_fall');
    const act = this.actions[clipName];
    if (!act) return false; // clip missing: fall back to a plain hit reaction
    this.state = 'zonefall';
    this._zoneFallKind = kind;
    this._kipUpDone = false;
    const clip = act.getClip();
    this.stateT = clip ? clip.duration : 1.5;
    this.playOnce(clipName, 0.06);
    return true;
  }

  takeDamage(amount, isLegHit, legAmount, hitY) {
    if (!this.alive || this.state === 'dying') return;
    this.hp -= amount;
    this._drawHpBar();
    this.flash = 0.3;
    this.setFlash(true);
    const isWalker = this.typeKey === 'walker';
    if (this.hp <= 0) {
      this.state = 'dying';
      // Hide the health bar + ground ring on death (both branches below).
      this._hpSprite.visible = false;
      if (this._groundRing) this._groundRing.visible = false;
      const wasCrawling = this.crawling;
      // DEATH DURATION = the full clip length, so the whole death animation
      // plays (the zombie falls and lies on the ground) + a short linger,
      // THEN it fades and is removed. Cap at 4s: Mixamo death clips include
      // a long "lying still" tail — the fall itself is ~2-3s.
      const deathDur = (clipName) => {
        const act = this.actions[clipName];
        const dur = (act && act.getClip()) ? act.getClip().duration : 1.4;
        return Math.min(dur + 0.8, 4.0);
      };
      if (wasCrawling) {
        // CRAWL DEATH: killed while crawling, the zombie dies LYING DOWN
        // with the flat 'dying_lying' clip — it does NOT stand up to play
        // a standing death, and it does NOT just vanish in crawl pose.
        // v3.21: the walker uses his own retargeted 'dying_lying_revenant'
        // (shared clips collapse him).
        const cdClip = isWalker ? 'dying_lying_revenant' : 'dying_lying';
        if (this.actions[cdClip]) {
          this.deathT = deathDur(cdClip);
          this.playOnce(cdClip, 0.08);
        } else {
          // Fallback (clip missing): stay in crawl pose, fade in place.
          this.deathT = 1.6;
          this.playClip(this.cfg.crawl, 0.08);
        }
      } else if (this.actions[isWalker ? 'zombie_dying_revenant' : 'zombie_dying'] && Math.random() < 0.5) {
        // STANDING DEATH VARIETY (v3.18, walker added v3.21): 50/50
        // between the zombie's configured death and the extra 'zombie_dying'
        // (falling forward), so standing zombies have BOTH death animations.
        const sdClip = isWalker ? 'zombie_dying_revenant' : 'zombie_dying';
        this.deathT = deathDur(sdClip);
        this.playOnce(sdClip, 0.08);
      } else {
        // Standing death: the configured death clip.
        const deathClip = this.actions[this.cfg.death];
        const clipDur = (deathClip && deathClip.getClip()) ? deathClip.getClip().duration : 1.4;
        this.deathT = Math.min(clipDur + 0.8, 4.0);
        this.playOnce(this.cfg.death, 0.08);
      }
      if (window.soundEngine && window.soundEngine.playZombieDeath) window.soundEngine.playZombieDeath();
      this.manager.onZombieKilled(this);
      return;
    }
    // Leg damage: a hit below hip height also hurts the legs. Crossing a
    // wave threshold stumbles the zombie, and at the crawl threshold it
    // drops into crawl mode for good. legAmount is the full weapon damage
    // (leg shots do 25% BODY damage so the zombie survives long enough
    // to be crippled instead of just dying).
    if (isLegHit && !this.crawling) {
      const legDmg = (legAmount !== undefined && legAmount !== null) ? legAmount : amount;
      this.legHp = Math.max(0, this.legHp - legDmg);
      const pct = (this.legHpMax - this.legHp) / this.legHpMax * 100;
      const res = legThresholdResult(this.wave, pct);
      if (res === 'crawl') {
        this.startStumble(true);
        return;
      }
      if (res === 'stumble' && !this.stumbled) {
        this.stumbled = true;
        this.startStumble(false);
        return;
      }
    }
    // HIT-LOCATION REACTIONS (v3.18, walker added v3.21): the zombie plays
    // a DIFFERENT hit animation depending on WHERE the bullet landed —
    // head, upper body, stomach/groin — instead of one hit animation for
    // every hit. The walker uses his own retargeted clips (shared clips
    // collapse him). relY is the hit height above the zombie's feet
    // (default 1.2 = chest when the caller has no ray hit point, e.g. melee).
    this.state = 'hit';
    this.stateT = 0.4;
    const relY = (hitY !== undefined && hitY !== null) ? hitY - this.scene.position.y : 1.2;
    const headClip = isWalker ? 'head_hit_revenant' : 'head_hit';
    const reactClip = isWalker ? 'hit_reaction_revenant' : 'hit_reaction';
    if (relY > 1.5) {
      // HEAD: the 'head_hit' reaction (hands to the head, staggers back).
      if (this.actions[headClip]) this.playClip(headClip, 0.06);
      else this.playClip(this.cfg.hit, 0.06);
      return;
    }
    if (relY >= 1.0) {
      // UPPER BODY / SHOULDER: accumulate toward the 70% fall. At the
      // threshold the zombie plays the shoulder fall and stands back up.
      this.upperDmg += amount;
      if (this.upperDmg >= this.nextUpperFallAt && !this.crawling) {
        this.nextUpperFallAt += 0.7 * this.maxHp;
        if (this.startZoneFall('shoulder')) return;
      }
    } else if (relY >= 0.5) {
      // STOMACH / GROIN: accumulate toward the 70% fall (doubled over).
      this.groinDmg += amount;
      if (this.groinDmg >= this.nextGroinFallAt && !this.crawling) {
        this.nextGroinFallAt += 0.7 * this.maxHp;
        if (this.startZoneFall('groin')) return;
      }
    }
    // PLAIN BODY HIT: alternate 'hit_reaction' and the type's own hit
    // clip so two hits in a row never look identical.
    this._hitAlt++;
    if (this._hitAlt % 2 === 1 && this.actions[reactClip]) {
      this.playClip(reactClip, 0.06);
    } else {
      this.playClip(this.cfg.hit, 0.06);
    }
  }

  // Redraw the health bar sprite. Green > 50%, yellow 25-50%, red < 25%.
  _drawHpBar() {
    const ctx = this._hpCtx;
    const w = this._hpCanvas.width, h = this._hpCanvas.height;
    const frac = Math.max(0, this.hp / this.maxHp);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = frac > 0.5 ? '#39d353' : (frac > 0.25 ? '#e3b341' : '#f85149');
    ctx.fillRect(1, 1, (w - 2) * frac, h - 2);
    this._hpTex.needsUpdate = true;
  }

  setFlash(on) {
    this.scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m.emissive) continue;
        if (on) {
          m.emissive.setHex(0xff2222);
          m.emissiveIntensity = 1.6;
        } else {
          // Restore the base emissive (black = original colours, no lift).
          m.emissive.setHex(ZOMBIE_BASE_EMISSIVE);
          m.emissiveIntensity = 1.0;
        }
      }
    });
  }

  update(dt, player, zombies, environment) {
    if (!this.alive) return false;
    this.mixer.update(dt);

    // ROOT-TILT FIX: the walk clip rotates the character root for the
    // prisoner/zombiegirl rigs (measured ~0.75 rad / 43 deg pitch). The
    // mixer can re-tilt it every frame, so force x/z back to 0 here in
    // every state — yaw is set below when chasing. Zombie stays upright.
    this.scene.rotation.x = 0;
    this.scene.rotation.z = 0;

    // Attack cooldown ticks down so swings have a readable gap.
    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    // Hit flash decay
    if (this.flash > 0) {
      this.flash -= dt;
      if (this.flash <= 0) this.setFlash(false);
    }

    if (this.state === 'dying') {
      this.deathT -= dt;
      // Fade the corpse out over the last 0.5s so it doesn't pop away.
      // SKIP the hitbox: it is an invisible raycast cylinder (opacity 0),
      // and setting its opacity to the fade value would make it render as
      // a solid WHITISH rectangle/cylinder after death.
      if (this.deathT < 0.5) {
        const op = Math.max(0, this.deathT / 0.5);
        this.scene.traverse((o) => {
          if (o.isMesh && o.material && o !== this.hitbox) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) { m.transparent = true; m.opacity = op; }
          }
        });
      }
      if (this.deathT <= 0) {
        this.alive = false;
        this.manager.scene.remove(this.scene);
        return false;
      }
      return true;
    }

    if (this.state === 'hit') {
      this.stateT -= dt;
      if (this.stateT <= 0) {
        this.state = 'chase';
        this.playClip(this.chaseClip(), 0.12);
      }
      return true;
    }

    if (this.state === 'stumble') {
      this.stateT -= dt;
      if (this.stateT <= 0) {
        if (this._stumbleToCrawl) {
          this.enterCrawl();
        } else {
          // Stood back up — allow a later stumble at the next threshold
          this.stumbled = false;
        }
        this.state = 'chase';
        this.playClip(this.chaseClip(), 0.12);
      }
      return true;
    }

    // ZONE FALL (v3.18): knocked down by 70% damage to one body zone.
    // The fall clip plays out, then the zombie stands back up — EXCEPT
    // the boss (skeleton), who kip-ups to his feet instead.
    if (this.state === 'zonefall') {
      this.stateT -= dt;
      if (this.stateT <= 0) {
        if (this.typeKey === 'skeleton' && !this._kipUpDone && this.actions['kip_up']) {
          this._kipUpDone = true;
          this.state = 'kipup';
          const kc = this.actions['kip_up'];
          this.stateT = kc.getClip() ? kc.getClip().duration : 1.0;
          this.playOnce('kip_up', 0.08);
        } else {
          this.state = 'chase';
          this.playClip(this.chaseClip(), 0.12);
        }
      }
      return true;
    }

    // KIP-UP (v3.18): boss only — after the fall, springs back to his
    // feet, then resumes the chase.
    if (this.state === 'kipup') {
      this.stateT -= dt;
      if (this.stateT <= 0) {
        this.state = 'chase';
        this.playClip(this.chaseClip(), 0.12);
      }
      return true;
    }

    if (this.state === 'attack') {
      this.stateT -= dt;
      // Damage lands mid-windup ONLY if the swing really connects: the
      // player must still be in range AND in front of the zombie (facing
      // check), so dodging behind it or sprinting past avoids the hit.
      if (!this.damageDealt && this.stateT <= this.cfg.attackDur - this.cfg.attackWindup) {
        this.damageDealt = true;
        const d = this.scene.position.distanceTo(player.position);
        const fx = Math.sin(this.scene.rotation.y), fz = Math.cos(this.scene.rotation.y);
        const tx = (player.position.x - this.scene.position.x) / Math.max(d, 0.001);
        const tz = (player.position.z - this.scene.position.z) / Math.max(d, 0.001);
        const facing = fx * tx + fz * tz; // 1 = dead ahead, 0 = side, -1 = behind
        if (d <= this.cfg.range + 0.2 && facing > 0.3) {
          this.manager.damagePlayer(this.cfg.dmg);
        }
      }
      if (this.stateT <= 0) {
        this.state = 'chase';
        this.attackCooldown = 1.0; // a beat before the next swing
        this.playClip(this.chaseClip(), 0.12);
      }
      return true;
    }

    // chase: seek the player, slide along obstacles, separate from other zombies
    // Keep the chase clip asserted every frame — if the walk/crawl action
    // ever dies (weight 0 after a fade), playClip self-heals it instead of
    // the zombie floating in bind pose with no leg animation.
    this.playClip(this.chaseClip(), 0.1);
    const px = player.position.x, pz = player.position.z;
    const dx = px - this.scene.position.x;
    const dz = pz - this.scene.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 0.001) {
      this._tmpDir.set(dx / dist, 0, dz / dist);
      // Face the player (model faces +Z at rotation 0). rotation.set
      // keeps x/z at 0 so the root-tilt bug can never return.
      this.scene.rotation.set(0, Math.atan2(dx, dz), 0);
      this._tmpVel.copy(this._tmpDir).multiplyScalar(this.speedNow());
      this.scene.position.addScaledVector(this._tmpVel, dt);
      // Slide along walls/barriers (mutates position + velocity)
      if (environment && environment.resolveCollisions) {
        environment.resolveCollisions(this.scene.position, this._tmpVel, this.cfg.radius, 0);
      }
      // Separation: push apart from nearby zombies so they don't stack
      for (const other of zombies) {
        if (other === this || !other.alive || other.state === 'dying') continue;
        const ox = this.scene.position.x - other.scene.position.x;
        const oz = this.scene.position.z - other.scene.position.z;
        const od = Math.sqrt(ox * ox + oz * oz);
        const minD = this.cfg.radius + other.cfg.radius + 0.15;
        if (od > 0.001 && od < minD) {
          const push = (minD - od) * 0.5;
          this.scene.position.x += (ox / od) * push;
          this.scene.position.z += (oz / od) * push;
        }
      }
    }

    // In attack range -> start the attack (only when the cooldown has expired)
    // CRAWL ATTACK (v3.18, walker bite added v3.21): a crawling zombie
    // attacks LOW while staying on the ground — it does NOT stand up to
    // hit. Shared skeletons bite at the player's legs with the
    // ground-level 'zombie_biting' clip (on all fours, confirmed a ground
    // animation). The Revenant now uses his own retargeted
    // 'zombie_biting_revenant' (his own crawl clip is no longer the
    // attack); falls back to the crawl clip if the retarget is missing.
    if (dist <= this.cfg.range && this.attackCooldown <= 0) {
      this.state = 'attack';
      this.stateT = this.cfg.attackDur;
      this.damageDealt = false;
      if (this.crawling) {
        const biteClip = this.typeKey === 'walker' ? 'zombie_biting_revenant' : 'zombie_biting';
        this.playClip(this.actions[biteClip] ? biteClip : this.cfg.crawl, 0.08);
      } else {
        this.playClip(this.cfg.attack, 0.08);
      }
      if (window.soundEngine && window.soundEngine.playZombieAttack) window.soundEngine.playZombieAttack();
    }
    return true;
  }
}

class ZombieManager {
  constructor(scene, environment, player, game) {
    this.scene = scene;
    this.environment = environment;
    this.player = player;
    this.game = game;
    this.templates = {};      // typeKey -> loaded FBX character Object3D
    this.clips = {};          // clipName -> THREE.AnimationClip (FBX-loaded, .position stripped)
    this.zombies = [];        // live Zombie instances
    this.hitMeshes = [];      // meshes for bullet raycast (userData.zombie set)
    this.markers = [];        // spawn ring markers
    this.xpVials = [];        // { mesh, value }
    this.wave = 0;
    this.toSpawn = [];        // queue of typeKeys
    this.spawnTimer = 0;
    this.breakTimer = 3.0;    // first wave after 3s
    this.breakActive = true;
    this.kills = 0;
    this.totalXP = 0;
    this.level = 1;
    this.gameOver = false;
    this.loaded = false;
    this._markerGeo = new THREE.RingGeometry(0.4, 0.62, 24);
    this._markerMat = new THREE.MeshBasicMaterial({ color: 0xff2233, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    this._xpGeo = new THREE.SphereGeometry(0.14, 10, 10);
    this._xpMat = new THREE.MeshBasicMaterial({ color: 0x39ff6a });
    this.loadTemplates();
  }

  loadTemplates() {
    if (typeof THREE.FBXLoader === 'undefined') {
      console.error('[Zombies] FBXLoader unavailable — zombies cannot load.');
      return;
    }
    const loader = new THREE.FBXLoader();
    const typeKeys = Object.keys(ZOMBIE_TYPES);
    const clipNames = Object.keys(ZOMBIE_CLIPS);
    let pending = typeKeys.length + clipNames.length;
    const doneOne = () => {
      pending--;
      if (pending === 0) {
        this.loaded = true;
        console.log('[Zombies] All 5 zombie characters + ' + clipNames.length + ' clips loaded (FBX runtime).');
        // BONE FILTER (v3.18, pack-demo lesson): three r128 PropertyBinding
        // falls back to the mixer ROOT for tracks whose bone doesn't exist
        // on that zombie — the Prisoner's one-bone stump hand leaves ~20
        // right-finger tracks unbound, which bound to root and made a 190m
        // giant. Filter BEFORE pre-warming so no bad track ever plays.
        this._filterClipBones();
        this._preWarm();
      }
    };
    // --- characters ---
    for (const key of typeKeys) {
      loader.load(ZOMBIE_TYPES[key].file, (fbxObj) => {
        // UNIT NORMALIZE: Mixamo character FBX files are in cm (~200 tall),
        // the Meshy-rigged walker FBX is in meters (~1.89). FBXLoader does
        // not convert units, so scale cm rigs down to meters by bbox height.
        const bb = new THREE.Box3().setFromObject(fbxObj);
        const h = bb.max.y - bb.min.y;
        if (h > 10) {
          fbxObj.scale.setScalar(0.01);
          // re-center so feet sit on the ground after scaling
          const bb2 = new THREE.Box3().setFromObject(fbxObj);
          fbxObj.position.y -= bb2.min.y;
        }
        // MATTE FIX: FBXLoader makes MeshPhongMaterial whose specular
        // highlight reads as polished gold under the warm night lights.
        // Kill the shine so skin/cloth read as matte, not metal.
        // (The emissive stays at ZOMBIE_BASE_EMISSIVE = black so the
        // zombie keeps its ORIGINAL texture colours; visibility comes
        // from the brightened ambient light, not a self-glow.)
        fbxObj.traverse((o) => {
          if (o.isMesh && o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) {
              if (m.isMeshPhongMaterial) {
                if (m.specular) m.specular.setHex(0x000000);
                m.shininess = 0;
                if (m.emissive) m.emissive.setHex(ZOMBIE_BASE_EMISSIVE);
                m.emissiveIntensity = 1;
              }
            }
          }
        });
        this.templates[key] = fbxObj;
        doneOne();
      }, undefined, (err) => {
        console.error('[Zombies] Failed to load', ZOMBIE_TYPES[key].file, err);
        doneOne();
      });
    }
    // --- animation clips (shared across types) ---
    for (const name of clipNames) {
      loader.load('assets/zombies/fbx/anim/' + ZOMBIE_CLIPS[name], (fbxObj) => {
        if (fbxObj.animations && fbxObj.animations.length > 0) {
          const clip = fbxObj.animations[0].clone();
          clip.name = name;
          // Position tracks: the game moves the zombie, and Mixamo bone
          // translations are in cm and would sink/fling the character.
          // EXCEPTION — the Hips Y (vertical bob): without it the feet
          // never plant and the walk reads as floating. Keep Hips Y,
          // freeze Hips X/Z at their rest values (no forward drift).
          clip.tracks = clip.tracks.filter((t) => {
            if (!t.name.endsWith('.position')) return true;
            const node = t.name.slice(0, -'.position'.length);
            if (node === 'mixamorigHips' || node === 'mixamorig:Hips') {
              const v = t.values;
              const x0 = v[0], z0 = v[2];
              for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
              return true;
            }
            return false; // drop every other bone's .position track
          });
          this.clips[name] = clip;
        } else {
          console.warn('[Zombies] No animation in', ZOMBIE_CLIPS[name]);
        }
        doneOne();
      }, undefined, (err) => {
        console.error('[Zombies] Failed to load clip', ZOMBIE_CLIPS[name], err);
        doneOne();
      });
    }
  }

  // BONE FILTER (v3.18): drop every clip track whose bone does not exist
  // on the zombies that will play it, plus any 'Armature.*' root tracks
  // (the game positions zombies itself — a root track would move/scale
  // the whole zombie). Shared clips must survive on ALL FIVE shared
  // templates (prisoner / zombiegirl / parasite / skeleton / romero), so
  // a track is kept only if its node is in the intersection of their
  // bone sets — that removes the finger tracks the Prisoner's stump hand
  // lacks, and any type-specific bone. The Revenant's 5 clips are
  // filtered against HIS template only (his auto-rigged skeleton differs).
  // Track node name = everything before the last '.' (e.g. 'mixamorigHips'
  // from 'mixamorigHips.quaternion'). The Hips-Y position filtering above
  // already ran at load time; this pass only removes whole tracks.
  _filterClipBones() {
    const namesByType = {};
    for (const key of Object.keys(this.templates)) {
      const set = new Set();
      const tpl = this.templates[key];
      if (tpl) tpl.traverse((o) => { if (o.name) set.add(o.name); });
      namesByType[key] = set;
    }
    const sharedKeys = ['prisoner', 'zombiegirl', 'parasite', 'skeleton', 'romero'];
    const loadedShared = sharedKeys.filter((k) => namesByType[k] && namesByType[k].size > 0);
    if (loadedShared.length < 3) {
      console.warn('[Zombies] Bone filter skipped — too few shared templates loaded (' + loadedShared.length + ').');
      return;
    }
    // Intersection of all loaded shared templates' bone sets.
    let sharedNames = new Set(namesByType[loadedShared[0]]);
    for (let i = 1; i < loadedShared.length; i++) {
      const s = namesByType[loadedShared[i]];
      sharedNames = new Set([...sharedNames].filter((n) => s.has(n)));
    }
    const revenantNames = namesByType['walker'] || new Set();
    const revenantClips = new Set(['walk_revenant', 'attack_revenant', 'hit_revenant', 'death_revenant', 'crawl_revenant']);
    let dropped = 0, kept = 0;
    for (const [name, clip] of Object.entries(this.clips)) {
      const allowed = revenantClips.has(name) ? revenantNames : sharedNames;
      clip.tracks = clip.tracks.filter((t) => {
        const dot = t.name.lastIndexOf('.');
        const node = dot >= 0 ? t.name.slice(0, dot) : t.name;
        if (node.startsWith('Armature')) { dropped++; return false; }
        if (!allowed.has(node)) { dropped++; return false; }
        kept++;
        return true;
      });
    }
    console.log('[Zombies] Bone filter: kept ' + kept + ' tracks, dropped ' + dropped + ' unbound/root tracks.');
  }

  // SHADER PRE-WARM (fixes the 2-3s freeze when a wave starts): the first
  // time a new zombie type renders, three.js compiles its shaders and uploads
  // its textures to the GPU — that compile stalls the game for seconds. Wave 1
  // froze at ~5s (first zombies), wave 2 froze (parasite + Romero first
  // appear), wave 3 froze (skeleton first appears). So once everything is
  // loaded, we render one of EACH type (hidden far below the ground) and
  // force a compile + render, so every shader + texture is ready BEFORE
  // gameplay. No more freeze when a new type spawns.
  _preWarm() {
    const game = this.game;
    if (!game || !game.renderer || !game.camera) return;
    const warmed = [];
    try {
      for (const key of Object.keys(ZOMBIE_TYPES)) {
        const tpl = this.templates[key];
        if (!tpl) continue;
        const clone = THREE.SkeletonUtils.clone(tpl);
        clone.position.set(0, -60, 0); // far below ground, invisible
        // Play its chase clip so the skinned-mesh shader path compiles.
        const clipName = ZOMBIE_TYPES[key].chase;
        const clip = this.clips[clipName];
        if (clip) {
          const mixer = new THREE.AnimationMixer(clone);
          mixer.clipAction(clip).play();
          mixer.update(0.1);
        }
        this.scene.add(clone);
        warmed.push(clone);
      }
      game.renderer.compile(game.scene, game.camera);
      game.renderer.render(game.scene, game.camera);
    } catch (e) {
      console.warn('[Zombies] Pre-warm failed (non-fatal):', e);
    }
    for (const c of warmed) this.scene.remove(c);
    console.log('[Zombies] Pre-warmed all zombie shaders/textures.');
  }

  registerHitMesh(mesh) {
    this.hitMeshes.push(mesh);
  }

  getZombieMeshes() {
    // Only meshes of zombies that are still alive and not dying
    return this.hitMeshes.filter((m) => m.userData.zombie && m.userData.zombie.alive && m.userData.zombie.state !== 'dying');
  }

  startWave(n) {
    this.wave = n;
    const comp = waveComp(n);
    this.toSpawn = [];
    for (const key of Object.keys(comp)) {
      for (let i = 0; i < comp[key]; i++) this.toSpawn.push(key);
    }
    // Shuffle so types mix
    for (let i = this.toSpawn.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = this.toSpawn[i]; this.toSpawn[i] = this.toSpawn[j]; this.toSpawn[j] = t;
    }
    this.spawnTimer = 0;
    this.breakActive = false;
    if (this.game && this.game.notify) {
      this.game.notify(`WAVE ${n} INCOMING — ${this.toSpawn.length} HOSTILES`);
    }
    this.updateWaveHUD();
  }

  spawnOne(typeKey) {
    if (!this.templates[typeKey]) return;
    // Spawn 12-17m from the player so they are visible immediately, clamped to the arena
    const angle = Math.random() * Math.PI * 2;
    const dist = 12 + Math.random() * 5;
    let x = this.player.position.x + Math.cos(angle) * dist;
    let z = this.player.position.z + Math.sin(angle) * dist;
    x = Math.max(-30, Math.min(30, x));
    z = Math.max(-30, Math.min(30, z));
    const zombie = new Zombie(this, typeKey, x, z, this.wave);
    this.zombies.push(zombie);
    this.spawnMarker(x, z);
  }

  spawnMarker(x, z) {
    const m = new THREE.Mesh(this._markerGeo, this._markerMat.clone());
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.06, z);
    this.scene.add(m);
    this.markers.push({ mesh: m, t: 0.9 });
  }

  onZombieKilled(zombie) {
    this.kills++;
    // Drop an XP vial at the corpse
    const vial = new THREE.Mesh(this._xpGeo, this._xpMat);
    vial.position.set(zombie.scene.position.x, 0.5, zombie.scene.position.z);
    this.scene.add(vial);
    this.xpVials.push({ mesh: vial, value: zombie.cfg.xp, bob: Math.random() * Math.PI * 2 });
    this.updateWaveHUD();
  }

  damagePlayer(dmg) {
    if (this.gameOver) return;
    const p = this.player;
    p.hp = Math.max(0, p.hp - dmg);
    if (p.updateHUD) p.updateHUD();
    // Feedback: red vignette + Leon hit reaction so the player can SEE
    // and FEEL that a real hit landed (not just proximity drain).
    if (window.showDamageVignette) window.showDamageVignette();
    if (p && p.playHitReaction && !p.isDying) p.playHitReaction();
    if (window.soundEngine && window.soundEngine.playHurt) window.soundEngine.playHurt();
    // PLAYER DEATH (v3.18): do NOT show the game-over popup the same frame
    // HP hits 0. Flag the player as dying — his update plays the full
    // 'dyingKneel' animation first, and only then calls onPlayerDeath()
    // (which pauses the game and shows the overlay). The popup must wait
    // for the animation.
    if (p.hp <= 0 && !p.isDying) {
      p.isDying = true;
    }
  }

  updateWaveHUD() {
    const left = this.zombies.filter((z) => z.alive).length + this.toSpawn.length;
    const wave = Math.max(1, this.wave);
    // Icon-chip HUD (v3.8): separate number spans; fall back to the legacy
    // single text if the chips are missing.
    const setNum = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setNum('stat-wave', wave);
    setNum('stat-left', left);
    setNum('stat-kills', this.kills);
    setNum('stat-level', this.level);
    const el = document.getElementById('wave-info');
    if (el && !document.getElementById('stat-wave')) {
      el.textContent = `WAVE ${wave} · ${left} LEFT · KILLS ${this.kills} · LV ${this.level}`;
    }
  }

  update(dt) {
    if (this.gameOver) return;

    // Spawn queue
    if (this.loaded && this.toSpawn.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 0.7;
        this.spawnOne(this.toSpawn.shift());
      }
    }

    // Wave flow: break -> next wave when the field is clear
    if (this.loaded && this.toSpawn.length === 0 && this.zombies.length === 0) {
      if (!this.breakActive) {
        this.breakActive = true;
        this.breakTimer = 5.0;
        if (this.game && this.game.notify) {
          this.game.notify(`WAVE ${this.wave} CLEARED — NEXT WAVE IN 5s`);
        }
      }
    }
    if (this.breakActive && this.loaded) {
      this.breakTimer -= dt;
      if (this.breakTimer <= 0) {
        this.startWave(this.wave + 1);
      }
    }

    // Update zombies
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      const keep = z.update(dt, this.player, this.zombies, this.environment);
      if (!keep) {
        // Remove its meshes from the raycast list
        this.hitMeshes = this.hitMeshes.filter((m) => m.userData.zombie !== z);
        this.zombies.splice(i, 1);
      }
    }

    // Proximity groans: every few seconds the NEAREST zombie groans, and
    // the closer it is, the louder it gets — so the player hears the horde
    // closing in. (Volume 1 at 2m, fading to 0 past ~20m.)
    this._groanTimer = (this._groanTimer === undefined ? 2.0 : this._groanTimer) - dt;
    if (this._groanTimer <= 0) {
      this._groanTimer = 2.5 + Math.random() * 1.5;
      let nearest = null, nearestD = Infinity;
      for (const z of this.zombies) {
        if (!z.alive || z.state === 'dying') continue;
        const d = z.scene.position.distanceTo(this.player.position);
        if (d < nearestD) { nearestD = d; nearest = z; }
      }
      if (nearest && window.soundEngine && window.soundEngine.playGroan) {
        window.soundEngine.playGroan(Math.max(0, 1 - (nearestD - 2) / 18));
      }
    }

    // Spawn markers (expand + fade)
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const mk = this.markers[i];
      mk.t -= dt;
      const k = 1 + (0.9 - mk.t) * 2.5;
      mk.mesh.scale.set(k, k, k);
      mk.mesh.material.opacity = Math.max(0, mk.t / 0.9) * 0.9;
      if (mk.t <= 0) {
        this.scene.remove(mk.mesh);
        mk.mesh.material.dispose();
        this.markers.splice(i, 1);
      }
    }

    // XP vials: bob, magnet to the player, collect
    const pp = this.player.position;
    for (let i = this.xpVials.length - 1; i >= 0; i--) {
      const v = this.xpVials[i];
      v.bob += dt * 3;
      v.mesh.position.y = 0.5 + Math.sin(v.bob) * 0.12;
      const dx = pp.x - v.mesh.position.x;
      const dz = pp.z - v.mesh.position.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 3.5) {
        const pull = 7 * dt;
        v.mesh.position.x += (dx / d) * pull;
        v.mesh.position.z += (dz / d) * pull;
      }
      if (d < 0.8) {
        this.totalXP += v.value;
        this.level = Math.floor(this.totalXP / 100) + 1;
        this.scene.remove(v.mesh);
        this.xpVials.splice(i, 1);
        this.updateWaveHUD();
      }
    }
  }
}
