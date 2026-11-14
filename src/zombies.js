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
  walker: {
    file: 'assets/zombies/fbx/walker.fbx',
    speed: 1.3, hp: 50, dmg: 10, range: 1.5, radius: 0.45, xp: 10, legHp: 120,
    chase: 'walk', attack: 'attack', hit: 'hit_shambler', death: 'death_shambler', crawl: 'crawl',
    attackWindup: 0.45, attackDur: 0.9
  },
  prisoner: { // the ONE-HAND zombie (right hand is a stump, no fingers)
    file: 'assets/zombies/fbx/prisoner.fbx',
    speed: 1.25, hp: 55, dmg: 10, range: 1.5, radius: 0.45, xp: 10, legHp: 120,
    chase: 'walk', attack: 'attack', hit: 'hit_shambler', death: 'death_shambler', crawl: 'crawl',
    attackWindup: 0.45, attackDur: 0.9
  },
  zombiegirl: {
    file: 'assets/zombies/fbx/zombiegirl.fbx',
    speed: 1.6, hp: 45, dmg: 8, range: 1.4, radius: 0.4, xp: 10, legHp: 100,
    chase: 'walk', attack: 'attack', hit: 'hit_shambler', death: 'death_shambler', crawl: 'crawl',
    attackWindup: 0.4, attackDur: 0.85
  },
  // --- fast (sprinter role) ---
  parasite: {
    file: 'assets/zombies/fbx/parasite.fbx',
    speed: 3.4, hp: 40, dmg: 8, range: 1.4, radius: 0.45, xp: 10, legHp: 90,
    chase: 'run', attack: 'lunge', hit: 'hit_feral', death: 'death_feral', crawl: 'crawl',
    attackWindup: 0.3, attackDur: 0.7
  },
  // --- boss (brute role, replaced) ---
  skeleton: {
    file: 'assets/zombies/fbx/skeleton.fbx',
    speed: 0.95, hp: 300, dmg: 25, range: 1.9, radius: 0.7, xp: 30, legHp: 250,
    chase: 'stomp', attack: 'slam', hit: 'hit_feral', death: 'death_brute', crawl: 'crawl',
    attackWindup: 0.6, attackDur: 1.2
  }
};

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
  death_brute: 'death_brute.fbx'
};

// Mixed waves — never a single type. Shamblers from wave 1, the fast
// parasite joins wave 2, the skeleton boss joins wave 3.
function waveComp(n) {
  return {
    walker: 2 + Math.floor(n / 2),
    prisoner: 1 + Math.floor((n - 1) / 2),
    zombiegirl: 1 + Math.floor((n - 1) / 2),
    parasite: n >= 2 ? 1 + Math.floor(n / 2) : 0,
    skeleton: n >= 3 ? Math.floor((n - 1) / 2) : 0
  };
}

// Leg-damage thresholds per wave: returns 'crawl', 'stumble' or null.
function legThresholdResult(wave, pct) {
  if (wave <= 1) {
    if (pct >= 30) return 'crawl';
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
    this.flash = 0;
    this.deathT = 0;

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
    const hitGeo = new THREE.CylinderGeometry(this.cfg.radius, this.cfg.radius, 1.9, 8);
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    this.hitbox = new THREE.Mesh(hitGeo, hitMat);
    this.hitbox.position.set(0, 0.95, 0);
    this.hitbox.userData.zombie = this;
    this.scene.add(this.hitbox);
    this.manager.registerHitMesh(this.hitbox);
    manager.scene.add(this.scene);

    // Animation mixer on the clone; clips are the FBX-loaded clips shared
    // across all zombies of every type (stripped of .position tracks).
    this.mixer = new THREE.AnimationMixer(this.scene);
    this.actions = {};
    for (const clipName of [this.cfg.chase, this.cfg.attack, this.cfg.hit, this.cfg.death, this.cfg.crawl]) {
      const clip = manager.clips[clipName];
      if (clip) this.actions[clipName] = this.mixer.clipAction(clip);
    }
    this.activeAction = null;
    this.playClip(this.cfg.chase, 0.1);
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
    if (this.activeAction === next) return;
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
    this.hitbox.scale.y = 0.5;
    this.hitbox.position.y = 0.45;
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

  takeDamage(amount, isLegHit, legAmount) {
    if (!this.alive || this.state === 'dying') return;
    this.hp -= amount;
    this.flash = 0.25;
    this.setFlash(true);
    if (this.hp <= 0) {
      this.state = 'dying';
      this.deathT = 1.4;
      this.playOnce(this.cfg.death, 0.08);
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
    this.state = 'hit';
    this.stateT = 0.4;
    this.playClip(this.cfg.hit, 0.06);
  }

  setFlash(on) {
    this.scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m.emissive) continue;
        if (on) {
          m.emissive.setHex(0xff2222);
          m.emissiveIntensity = 1.0;
        } else {
          m.emissive.setHex(0x000000);
          m.emissiveIntensity = 1.0;
        }
      }
    });
  }

  update(dt, player, zombies, environment) {
    if (!this.alive) return false;
    this.mixer.update(dt);

    // Hit flash decay
    if (this.flash > 0) {
      this.flash -= dt;
      if (this.flash <= 0) this.setFlash(false);
    }

    if (this.state === 'dying') {
      this.deathT -= dt;
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

    if (this.state === 'attack') {
      this.stateT -= dt;
      // Damage lands mid-windup if the player is still in range
      if (!this.damageDealt && this.stateT <= this.cfg.attackDur - this.cfg.attackWindup) {
        this.damageDealt = true;
        const d = this.scene.position.distanceTo(player.position);
        if (d <= this.cfg.range + 0.4) {
          this.manager.damagePlayer(this.cfg.dmg);
        }
      }
      if (this.stateT <= 0) {
        this.state = 'chase';
        this.playClip(this.chaseClip(), 0.12);
      }
      return true;
    }

    // chase: seek the player, slide along obstacles, separate from other zombies
    const px = player.position.x, pz = player.position.z;
    const dx = px - this.scene.position.x;
    const dz = pz - this.scene.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 0.001) {
      this._tmpDir.set(dx / dist, 0, dz / dist);
      // Face the player (model faces +Z at rotation 0)
      this.scene.rotation.y = Math.atan2(dx, dz);
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

    // In attack range -> start the attack
    if (dist <= this.cfg.range) {
      this.state = 'attack';
      this.stateT = this.cfg.attackDur;
      this.damageDealt = false;
      this.playClip(this.cfg.attack, 0.08);
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
          // Strip ALL .position tracks (like Leon): the game moves the
          // zombie, and Mixamo root/bone translations are in cm and would
          // sink or fling the character. Rotations alone drive the pose.
          clip.tracks = clip.tracks.filter((t) => !t.name.endsWith('.position'));
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
    if (p.hp <= 0 && !this.gameOver) {
      this.gameOver = true;
      if (this.game && this.game.onPlayerDeath) this.game.onPlayerDeath();
    }
  }

  updateWaveHUD() {
    const el = document.getElementById('wave-info');
    if (el) {
      const left = this.zombies.filter((z) => z.alive).length + this.toSpawn.length;
      el.textContent = `WAVE ${Math.max(1, this.wave)} · ${left} LEFT · KILLS ${this.kills} · LV ${this.level}`;
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
