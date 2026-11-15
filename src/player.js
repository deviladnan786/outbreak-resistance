/**
 * 3D Realistic Player Operator (Three.js)
 * Master AAA Tactical Third-Person Controller:
 * - High-Detail Professional Procedural Humanoid Operator (FAST Helmet, NVG Visor, Plate Carrier, Belt, Holster, Cargo Pants, Boots)
 * - Fluid TPS Movement:
 *   - Free-Roam Locomotion (Not aiming): Player smoothly turns into movement direction (A turns left, D turns right, S runs back, W runs forward)
 *   - Combat Strafe Mode (Aiming / Firing): Body locks to crosshair, A/D strafes with weapon raised
 * - Two-Handed Forward Weapon Grip:
 *   - M4A1 Tactical Carbine held firmly forward in FRONT of player's chest in plain sight
 *   - Right hand on pistol grip with trigger finger, left hand wrapped around front handguard/AFG
 *   - Stock tucked against right shoulder, barrel dynamically locks onto crosshair
 * - True Max Payne Bullet-Time Shootdodge Dive:
 *   - High airborne launch (elevates 1.8m into air!)
 *   - 100% Horizontal mid-air glide with both arms forward aiming at crosshair in bullet-time (timeScale = 0.25)
 *   - Mid-air firing allowed throughout the glide
 *   - Authentic touchdown, stomach slide along pavement, hand push-up and knee tuck recovery to feet!
 * - Prince of Persia Wall Mechanics:
 *   - Wall proximity priority (never triggers shootdodge near walls!)
 *   - Front Wall Climb & 360° Backflip: Runs up vertical wall face, kicks off backward, full 360° mid-air tuck backflip
 *   - Side Wall Run: Runs along wall face at 7.8 m/s, body tilted against wall, real-time length tracking (drops off when wall ends, zero clipping!)
 * - Prince of Persia Crouch Roll (C / Ctrl + WASD):
 *   - Drops low, executes athletic forward shoulder roll on ground, springs to feet
 * - Martial Arts Flying Kick (WASD + K):
 *   - Leaps into air, extends powerful flying side kick, lands gracefully
 */

class PlayerOperator {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    // Movement & Physics
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.velocityY = 0;
    this.isGrounded = true;
    this.currentGroundY = 0;
    this.radius = 0.42;

    this.walkSpeed = 2.4;
    this.sprintSpeed = 5.8;
    this.adsSpeed = 1.6;

    this.acceleration = 48.0;
    this.friction = 16.0;
    this.gravity = 25.0;
    this.jumpForce = 7.2;

    // Vitals & Stamina
    this.maxHp = 100;
    this.hp = 100;
    this.maxStamina = 100;
    this.stamina = 100;
    this.staminaDrain = 24.0;
    this.staminaRecover = 32.0;
    this.staminaDepleted = false;

    // State Flags
    this.isSprinting = false;
    this.isAiming = false;
    this.isCrouching = false;
    this.isInvulnerable = false;
    this.moveState = 'COMBAT READY';
    this.cameraMode = 'THIRD_PERSON';
    this.isMoving = false;
    this.moveDir = new THREE.Vector3();

    // Weapon & Ammo
    this.maxClip = 30;
    this.ammoClip = 30;
    this.ammoReserve = 180;
    this.fireRate = 0.11;
    this.fireTimer = 0;
    this.isReloading = false;
    this.recoilOffset = 0;
    this.recoilRot = 0;

    this.footstepTimer = 0;
    this.breathTimer = 0;
    this.walkTimer = 0;
    this.aimTarget = new THREE.Vector3(0, 0, 0);
    this.aimAngle = 0;
    this.laserColor = 0x00ff66;

    // Active projectiles & casings
    this.activeTracers = [];
    this.activeCasings = [];
    this.activeSparks = [];
    this._shotRaycaster = new THREE.Raycaster();
    this._shotRaycaster.far = 80;

    // Weapon Location: 'HAND' or 'BACK'
    this.weaponLocation = 'HAND';
    this.userWeaponPreference = 'HAND';
    this.isHolstering = false;
    this.holsterTimer = 0.0;
    this.holsterDuration = 0.44;
    this.holsterAction = 'HOLSTER'; // 'HOLSTER' (to back) or 'DRAW' (to hand)
    this.holsterSwapped = false;

    // Combat & Stunts System
    this.timeScale = 1.0;

    // 1. Directional Max Payne Shootdodge Dive
    this.isShootdodging = false;
    this.shootdodgeTimer = 0.0;
    this.shootdodgeDuration = 1.65;
    this.shootdodgeDir = new THREE.Vector3();
    this.shootdodgeType = 'FORWARD'; // 'LEFT', 'RIGHT', 'FORWARD', 'BACKWARD'

    // 2. Prince of Persia Crouch Roll
    this.isRolling = false;
    this.rollTimer = 0.0;
    this.rollDuration = 0.65;
    this.rollDir = new THREE.Vector3();

    // 3. Martial Arts Kick (Stationary K)
    this.isKicking = false;
    this.kickTimer = 0.0;
    this.kickDuration = 0.52;

    // 4. Directional Flying Dropkick (WASD + K)
    this.isDropkicking = false;
    this.dropkickTimer = 0.0;
    this.dropkickDuration = 0.78;
    this.dropkickDir = new THREE.Vector3();

    // 5. Prince of Persia Side Wall Run (WASD + Space near wall)
    this.isWallRunning = false;
    this.wallRunTimer = 0.0;
    this.wallRunDuration = 1.65;
    this.wallRunSide = 'LEFT'; // 'LEFT' or 'RIGHT'
    this.wallRunDir = new THREE.Vector3();
    this.activeWallObs = null;

    // 6. Prince of Persia Front Wall Run & Backflip (Facing wall + Space)
    this.isWallBackflipping = false;
    this.wallFlipTimer = 0.0;
    this.wallFlipDuration = 1.35;
    this.wallNormal = new THREE.Vector3();

    // Single-Fire Edge Trigger Flags
    this._kickConsumed = false;
    this._spaceConsumed = false;
    this._rollConsumed = false;
    this._altConsumed = false;
    this._qConsumed = false;
    this._eConsumed = false;

    // Idle & Melee Combat
    this.idleTimer = 0.0;
    this.isPunching = false;
    this.punchTimer = 0.0;
    this.punchDuration = 0.28;
    this.punchCombo = 0;
    this.boxingCombatTimer = 0.0; // 5s timer for boxing guard after punch
    this.kickCombo = 0; // 0 = Push snap kick, 1 = High neck roundhouse
    this.dropkickType = 'FORWARD'; // 'FORWARD', 'SIDE', 'BACKWARD'

    this.initRootGroup();
    this.buildFirstPersonWeaponRig();
    this.initLaserSight();
    this.buildProfessionalOperator();
    this.loadSurvivorCharacter();
  }

  initRootGroup() {
    this.mesh = new THREE.Group();
    this.scene.add(this.mesh);
    this.hitFlinchT = 0; // seconds left on the damage flinch lean
    // NOTE: the old fake "blob shadow" (a black CircleGeometry decal under
    // Leon) is REMOVED — it read as a flat black disc, not a real shadow,
    // and it cost a draw call. The real shadow now comes from the moonlight
    // directional shadow map (the model's own cast shadow).
  }

  // =========================================================================
  // HIGH-DETAIL PROFESSIONAL PROCEDURAL HUMANOID OPERATOR
  // =========================================================================
  buildProfessionalOperator() {
    this.operatorGroup = new THREE.Group();
    this.operatorGroup.name = 'ProfessionalOperator';

    // Rich, professional military PBR materials
    const matSuit = new THREE.MeshStandardMaterial({ color: 0x1f242c, roughness: 0.68, metalness: 0.12 });
    const matArmor = new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.40, metalness: 0.28 });
    const matPouches = new THREE.MeshStandardMaterial({ color: 0x6e5e48, roughness: 0.80, metalness: 0.05 });
    const matHelmet = new THREE.MeshStandardMaterial({ color: 0x16191f, roughness: 0.35, metalness: 0.30 });
    const matVisor = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00b4cc, emissiveIntensity: 0.85, roughness: 0.18, metalness: 0.85 });
    const matChemlight = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 1.5, roughness: 0.2 });
    const matBalaclava = new THREE.MeshStandardMaterial({ color: 0x181a1f, roughness: 0.75 });
    const matSkin = new THREE.MeshStandardMaterial({ color: 0xc28d6c, roughness: 0.60 });
    const matBoots = new THREE.MeshStandardMaterial({ color: 0x121417, roughness: 0.70, metalness: 0.15 });
    const matGloves = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.55, metalness: 0.25 });
    const matGlovePalm = new THREE.MeshStandardMaterial({ color: 0x584a38, roughness: 0.85 });
    const matSteel = new THREE.MeshStandardMaterial({ color: 0x5a6472, roughness: 0.28, metalness: 0.88 });
    const matGold = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.25, metalness: 0.85 });
    const matKnife = new THREE.MeshStandardMaterial({ color: 0x8a95a5, roughness: 0.20, metalness: 0.95 });
    const matScreen = new THREE.MeshBasicMaterial({ color: 0x00ff88 });

    // 1. ROOT JOINT: Pelvis / Hips (y = 0.95m above ground)
    this.hips = new THREE.Group();
    this.hips.position.set(0, 0.95, 0);
    this.operatorGroup.add(this.hips);

    // Anatomical Pelvis & Pants Waist (tall, overlapping into abdomen - ZERO GAP!)
    const pelvisGeo = new THREE.CylinderGeometry(0.175, 0.150, 0.28, 16);
    const pelvisMesh = new THREE.Mesh(pelvisGeo, matSuit);
    pelvisMesh.position.set(0, 0.02, 0);
    pelvisMesh.castShadow = true;
    this.hips.add(pelvisMesh);

    // High Inner Uniform Core (Rises up from hips deep into ribcage - Physically prevents any gap!)
    const innerTorsoGeo = new THREE.CylinderGeometry(0.188, 0.176, 0.32, 16);
    const innerTorsoMesh = new THREE.Mesh(innerTorsoGeo, matSuit);
    innerTorsoMesh.position.set(0, 0.09, 0);
    this.hips.add(innerTorsoMesh);

    // Flexible Waist Cummerbund / Inner Armor Layer (completely envelopes hip-to-spine transition)
    const waistGeo = new THREE.CylinderGeometry(0.190, 0.180, 0.28, 16);
    const waistMesh = new THREE.Mesh(waistGeo, matArmor);
    waistMesh.position.set(0, 0.06, 0);
    this.hips.add(waistMesh);

    // Heavy Tactical Combat Belt
    const beltGeo = new THREE.CylinderGeometry(0.192, 0.192, 0.10, 16);
    const beltMesh = new THREE.Mesh(beltGeo, matArmor);
    beltMesh.position.set(0, 0.05, 0);
    this.hips.add(beltMesh);

    // Rear Lumbar Protective Armor Guard on Belt (Covers lower back above belt - Zero gap in rear!)
    const lumbarPlate = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.065), matArmor);
    lumbarPlate.position.set(0, 0.09, -0.132);
    lumbarPlate.castShadow = true;
    this.hips.add(lumbarPlate);

    // AustriAlpin Cobra Metal Quick-Release Buckle
    const buckleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.046, 0.038), matSteel);
    buckleMesh.position.set(0, 0.05, 0.142);
    this.hips.add(buckleMesh);

    // Right Hip: Safariland Drop-Leg Holster with Glock 19 Sidearm
    const holsterGroup = new THREE.Group();
    holsterGroup.position.set(0.19, -0.05, 0.02);
    holsterGroup.rotation.z = -0.10;

    const holsterMesh = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.17, 0.090), matArmor);
    holsterMesh.castShadow = true;
    holsterGroup.add(holsterMesh);

    // Glock 19: Machined slide with front/rear serrations, polymer frame & magazine floorplate
    const sidearmSlide = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.042, 0.14), matSteel);
    sidearmSlide.position.set(0, 0.065, 0.01);
    const sidearmGrip = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.082, 0.045), matArmor);
    sidearmGrip.position.set(0, 0.02, -0.04);
    sidearmGrip.rotation.x = -0.28;
    const sidearmMagPlate = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.015, 0.048), matSteel);
    sidearmMagPlate.position.set(0, -0.025, -0.055);
    sidearmMagPlate.rotation.x = -0.28;
    holsterGroup.add(sidearmSlide, sidearmGrip, sidearmMagPlate);
    this.hips.add(holsterGroup);

    // Left Hip: Double 9mm Pistol Mag Pouches & Tactical IFAK Trauma Medical Kit
    const pistolMagPouch = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.10, 0.075), matPouches);
    pistolMagPouch.position.set(-0.185, 0.05, 0.04);
    const ifakPouch = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.12, 0.090), matPouches);
    ifakPouch.position.set(-0.19, 0.03, -0.04);
    const ifakTab = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.035, 0.015), matChemlight);
    ifakTab.position.set(-0.21, 0.04, -0.04);
    this.hips.add(pistolMagPouch, ifakPouch, ifakTab);

    // Rear Hip: Roll-Up Cordura Dump Pouch
    const dumpPouch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.065), matPouches);
    dumpPouch.position.set(0, 0.02, -0.165);
    this.hips.add(dumpPouch);

    // 2. LOWER SPINE JOINT (Abdomen)
    this.spine = new THREE.Group();
    this.spine.position.set(0, 0.05, 0);
    this.hips.add(this.spine);

    // Deep Abdomen Cylinder starting well below the belt line and extending into ribcage
    const abdoGeo = new THREE.CylinderGeometry(0.208, 0.188, 0.32, 16);
    const abdoMesh = new THREE.Mesh(abdoGeo, matSuit);
    abdoMesh.position.set(0, 0.06, 0);
    abdoMesh.castShadow = true;
    this.spine.add(abdoMesh);

    // 3. UPPER CHEST JOINT (Ribcage & Plate Carrier)
    this.chest = new THREE.Group();
    this.chest.position.set(0, 0.15, 0);
    this.spine.add(this.chest);

    // Dedicated Two-Handed Forward Weapon Socket Rig on Chest (Holds M4A1 in front of chest!)
    this.tpRifleRig = new THREE.Group();
    this.tpRifleRig.name = 'ChestRifleRig';
    this.tpRifleRig.position.set(0.09, 0.04, 0.24);
    this.chest.add(this.tpRifleRig);

    // Athletic V-Taper Torso
    const chestGeo = new THREE.CylinderGeometry(0.230, 0.195, 0.26, 16);
    const chestMesh = new THREE.Mesh(chestGeo, matSuit);
    chestMesh.position.set(0, 0.125, 0);
    chestMesh.castShadow = true;
    this.chest.add(chestMesh);

    // Crye Precision JPC 2.0 Tactical Plate Carrier (Front & Back Multi-Curve Ballistic Plates)
    const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.34, 0.070), matArmor);
    frontPlate.position.set(0, 0.10, 0.115);
    frontPlate.castShadow = true;

    // Extended Back Plate reaching deeply down over lower back (overlaps lumbar plate & belt - ZERO GAP!)
    const backPlate = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.38, 0.065), matArmor);
    backPlate.position.set(0, 0.07, -0.115);
    backPlate.castShadow = true;
    this.chest.add(frontPlate, backPlate);

    // Left and Right Elastic Cummerbund Panels with MOLLE Webbing
    for (let side of [-0.155, 0.155]) {
      const cummerbund = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.18, 0.22), matArmor);
      cummerbund.position.set(side, 0.05, 0);
      this.chest.add(cummerbund);
    }

    // Emergency Evacuation Drag Handle on Upper Rear Plate Carrier
    const dragHandle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.035), matPouches);
    dragHandle.position.set(0, 0.27, -0.13);
    this.chest.add(dragHandle);

    // 3x 5.56 PMAG Magazine Pouches on Front Plate with Visible Brass Cartridge Tips!
    for (let p = -1; p <= 1; p++) {
      const pmagPouch = new THREE.Mesh(new THREE.BoxGeometry(0.080, 0.15, 0.052), matPouches);
      pmagPouch.position.set(p * 0.090, 0.10, 0.155);
      pmagPouch.castShadow = true;

      // Realistic 5.56 PMAG Magazine Body
      const magBase = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.040, 0.045), matArmor);
      magBase.position.set(p * 0.090, 0.18, 0.155);

      // Visible Golden Brass Cartridge Tip
      const brassTip = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.028, 8), matGold);
      brassTip.position.set(p * 0.090, 0.205, 0.155);
      this.chest.add(pmagPouch, magBase, brassTip);
    }

    // Glowing Neon-Green Tactical Chemlight Stick Clipped to Front MOLLE Loop
    const chemlight = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 8), matChemlight);
    chemlight.position.set(0.11, 0.18, 0.16);
    chemlight.rotation.set(0, 0, 0.22);
    this.chest.add(chemlight);

    // Inverted Tactical Combat Dagger in Kydex Sheath on Upper Left Shoulder Strap
    const daggerSheath = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.14, 0.025), matArmor);
    daggerSheath.position.set(-0.115, 0.22, 0.14);
    daggerSheath.rotation.z = 0.15;
    const daggerHilt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.010, 0.08, 6), matArmor);
    daggerHilt.position.set(-0.125, 0.13, 0.15);
    daggerHilt.rotation.z = 0.15;
    this.chest.add(daggerSheath, daggerHilt);

    // Left Chest: Tactical Admin Zipper Pouch with Velcro Unit Badge
    const adminPouch = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.070, 0.032), matArmor);
    adminPouch.position.set(-0.085, 0.21, 0.15);
    this.chest.add(adminPouch);

    // Upper Back: Military Harris Radio with Flexible Whip Antenna
    const radioMesh = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.16, 0.058), matArmor);
    radioMesh.position.set(-0.095, 0.16, -0.155);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.003, 0.44, 6), matSteel);
    antenna.position.set(-0.115, 0.39, -0.165);
    antenna.rotation.z = -0.14;
    this.chest.add(radioMesh, antenna);

    // Back Sling Socket (Mounted diagonally across upper back armor plate - clearly & prominently visible in 3rd person!)
    this.backSlingSocket = new THREE.Group();
    this.backSlingSocket.name = 'ProBackSlingSocket';
    this.backSlingSocket.position.set(0.04, 0.10, -0.19);
    this.backSlingSocket.rotation.set(-1.63, -0.47, 1.48);
    this.chest.add(this.backSlingSocket);

    // 4. NECK & HEAD JOINTS
    this.neck = new THREE.Group();
    this.neck.position.set(0, 0.26, 0.02);
    this.chest.add(this.neck);

    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.070, 0.080, 0.095, 12), matSkin);
    neckMesh.position.set(0, 0.045, 0);
    this.neck.add(neckMesh);

    this.head = new THREE.Group();
    this.head.position.set(0, 0.095, 0);
    this.neck.add(this.head);

    // Sculpted Head Core with Balaclava Hood
    const headCore = new THREE.Mesh(new THREE.SphereGeometry(0.118, 16, 14), matBalaclava);
    headCore.scale.set(0.92, 1.15, 1.05);
    headCore.position.set(0, 0.10, 0);
    headCore.castShadow = true;
    this.head.add(headCore);

    // Balaclava Eye Opening Revealing Skin & Focused Brow
    const eyeOpening = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.038, 0.06), matSkin);
    eyeOpening.position.set(0, 0.11, 0.09);
    this.head.add(eyeOpening);

    // Ops-Core FAST High-Cut Maritime Ballistic Combat Helmet
    const helmetGroup = new THREE.Group();
    helmetGroup.position.set(0, 0.125, 0.0);

    const helmetDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.128, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
      matHelmet
    );
    helmetDome.position.set(0, 0.02, -0.01);
    helmetDome.castShadow = true;
    helmetGroup.add(helmetDome);

    // Wilcox L4 G24 Night Vision Shroud on Helmet Forehead
    const nvgMount = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.048, 0.020), matSteel);
    nvgMount.position.set(0, 0.045, 0.120);
    helmetGroup.add(nvgMount);

    // ARC Accessory Side Rails on Left & Right Temples
    for (let side of [-0.122, 0.122]) {
      const arcRail = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.025, 0.12), matArmor);
      arcRail.position.set(side, 0.02, 0.02);
      helmetGroup.add(arcRail);
    }

    // Tactical LED Mini-Flashlight Mounted on Right Helmet Rail
    const helmetLight = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.055, 8), matSteel);
    helmetLight.rotation.x = Math.PI / 2;
    helmetLight.position.set(0.135, 0.025, 0.06);
    helmetGroup.add(helmetLight);

    // Counterweight / Battery Pack Pouch on Rear of Helmet
    const batteryPouch = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.045, 0.035), matPouches);
    batteryPouch.position.set(0, 0.03, -0.125);
    helmetGroup.add(batteryPouch);

    // Luminescent Panoramic Tactical HUD Visor Goggles
    const visorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.048, 0.040), matArmor);
    visorFrame.position.set(0, -0.015, 0.118);
    const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.152, 0.038, 0.042), matVisor);
    visorMesh.position.set(0, -0.015, 0.120);
    helmetGroup.add(visorFrame, visorMesh);

    // Comms Headset: Peltor ComTac Ear Defenders with Boom Mic
    for (let side of [-0.120, 0.120]) {
      const earCup = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.030, 10), matArmor);
      earCup.rotation.z = Math.PI / 2;
      earCup.position.set(side, -0.02, -0.01);
      helmetGroup.add(earCup);
    }
    const boomMic = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.13, 6), matSteel);
    boomMic.position.set(-0.085, -0.045, 0.085);
    boomMic.rotation.set(0.6, 0.4, 0);
    helmetGroup.add(boomMic);

    this.head.add(helmetGroup);

    // 5. RIGHT ARM & TWO-HANDED RIFLE SOCKET
    this.rightClavicle = new THREE.Group();
    this.rightClavicle.position.set(0.20, 0.18, 0.0);
    this.chest.add(this.rightClavicle);

    this.rightShoulder = new THREE.Group();
    this.rightClavicle.add(this.rightShoulder);

    // Deltoid Shoulder Pad with Tactical Flag Velcro Patch
    const rShoulderMesh = new THREE.Mesh(new THREE.SphereGeometry(0.076, 12, 10), matSuit);
    rShoulderMesh.position.set(0.02, -0.02, 0);
    const rPatch = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.045, 0.065), matPouches);
    rPatch.position.set(0.085, -0.02, 0);
    this.rightShoulder.add(rShoulderMesh, rPatch);

    const rUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.049, 0.24, 12), matSuit);
    rUpperArm.position.set(0.02, -0.14, 0);
    rUpperArm.castShadow = true;
    this.rightShoulder.add(rUpperArm);

    this.rightElbow = new THREE.Group();
    this.rightElbow.position.set(0.02, -0.26, 0);
    this.rightShoulder.add(this.rightElbow);

    // Molded Hard-Shell Tactical Elbow Guard
    const rElbowPad = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.085, 0.045), matArmor);
    rElbowPad.position.set(0, -0.02, -0.035);
    this.rightElbow.add(rElbowPad);

    const rForearmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.041, 0.22, 12), matSuit);
    rForearmMesh.position.set(0, -0.11, 0);
    rForearmMesh.castShadow = true;
    this.rightElbow.add(rForearmMesh);

    this.rightWrist = new THREE.Group();
    this.rightWrist.position.set(0, -0.22, 0);
    this.rightElbow.add(this.rightWrist);

    // Articulated Right Tactical Assault Glove with 5 Defined Fingers & Knuckles
    const rGlovePalm = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.075, 0.048), matGloves);
    rGlovePalm.position.set(0, -0.035, 0.01);

    // Hard-Shell Carbon-Fiber Knuckle Guard
    const rKnuckleGuard = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.022, 0.024), matArmor);
    rKnuckleGuard.position.set(0, -0.022, 0.034);

    // 1. Articulated Thumb (2 segments, opposes fingers around pistol grip)
    const rThumbGroup = new THREE.Group();
    rThumbGroup.position.set(-0.032, -0.028, 0.018);
    rThumbGroup.rotation.set(0.2, 0.4, -0.4);
    const rThumbBase = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.032, 0.022), matGlovePalm);
    rThumbBase.position.set(0, -0.014, 0);
    const rThumbTip = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.026, 0.020), matGloves);
    rThumbTip.position.set(0, -0.036, 0.005);
    rThumbTip.rotation.x = -0.35;
    rThumbGroup.add(rThumbBase, rThumbTip);

    // 2. Index Finger (Trigger Finger curled into trigger guard around trigger!)
    const rIndexGroup = new THREE.Group();
    rIndexGroup.position.set(-0.022, -0.065, 0.015);
    const rIndexPhalanx = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.028, 0.018), matGloves);
    rIndexPhalanx.position.set(0, -0.012, 0);
    const rIndexTip = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.024, 0.016), matGlovePalm);
    rIndexTip.position.set(0, -0.028, 0.008);
    rIndexTip.rotation.x = -0.65; // Curled around trigger!
    rIndexGroup.add(rIndexPhalanx, rIndexTip);

    // 3. Middle Finger (Curled tightly around front of pistol grip)
    const rMiddleGroup = new THREE.Group();
    rMiddleGroup.position.set(-0.007, -0.068, 0.014);
    const rMidPhalanx = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.030, 0.018), matGloves);
    rMidPhalanx.position.set(0, -0.013, 0);
    const rMidTip = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.024, 0.016), matGlovePalm);
    rMidTip.position.set(0, -0.030, 0.008);
    rMidTip.rotation.x = -0.85; // Tightly gripping
    rMiddleGroup.add(rMidPhalanx, rMidTip);

    // 4. Ring Finger (Wrapped around pistol grip)
    const rRingGroup = new THREE.Group();
    rRingGroup.position.set(0.008, -0.066, 0.013);
    const rRingPhalanx = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.028, 0.018), matGloves);
    rRingPhalanx.position.set(0, -0.012, 0);
    const rRingTip = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.022, 0.016), matGlovePalm);
    rRingTip.position.set(0, -0.028, 0.008);
    rRingTip.rotation.x = -0.85;
    rRingGroup.add(rRingPhalanx, rRingTip);

    // 5. Pinky Finger (Wrapped around lower pistol grip)
    const rPinkyGroup = new THREE.Group();
    rPinkyGroup.position.set(0.022, -0.062, 0.012);
    const rPinkyPhalanx = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.024, 0.016), matGloves);
    rPinkyPhalanx.position.set(0, -0.010, 0);
    const rPinkyTip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.020, 0.014), matGlovePalm);
    rPinkyTip.position.set(0, -0.024, 0.007);
    rPinkyTip.rotation.x = -0.85;
    rPinkyGroup.add(rPinkyPhalanx, rPinkyTip);

    this.rightWrist.add(rGlovePalm, rKnuckleGuard, rThumbGroup, rIndexGroup, rMiddleGroup, rRingGroup, rPinkyGroup);
    this.rFingers = [rThumbGroup, rIndexGroup, rMiddleGroup, rRingGroup, rPinkyGroup];

    // Primary Hand Weapon Socket attached directly into Right Palm (PHYSICALLY ATTACHED - ZERO FLOAT!)
    this.rightHandSocket = new THREE.Group();
    this.rightHandSocket.name = 'ProRifleHandSocket';
    this.rightHandSocket.position.set(-0.01, -0.045, 0.02);
    this.rightHandSocket.rotation.set(1.54, -0.05, -0.15);
    this.rightWrist.add(this.rightHandSocket);

    // 6. LEFT ARM & FORWARD HANDGUARD GRIP
    this.leftClavicle = new THREE.Group();
    this.leftClavicle.position.set(-0.20, 0.18, 0.0);
    this.chest.add(this.leftClavicle);

    this.leftShoulder = new THREE.Group();
    this.leftClavicle.add(this.leftShoulder);

    const lShoulderMesh = new THREE.Mesh(new THREE.SphereGeometry(0.076, 12, 10), matSuit);
    lShoulderMesh.position.set(-0.02, -0.02, 0);
    const lPatch = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.045, 0.065), matPouches);
    lPatch.position.set(-0.085, -0.02, 0);
    this.leftShoulder.add(lShoulderMesh, lPatch);

    const lUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.049, 0.24, 12), matSuit);
    lUpperArm.position.set(-0.02, -0.14, 0);
    lUpperArm.castShadow = true;
    this.leftShoulder.add(lUpperArm);

    this.leftElbow = new THREE.Group();
    this.leftElbow.position.set(-0.02, -0.26, 0);
    this.leftShoulder.add(this.leftElbow);

    const lElbowPad = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.085, 0.045), matArmor);
    lElbowPad.position.set(0, -0.02, -0.035);
    this.leftElbow.add(lElbowPad);

    const lForearmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.041, 0.22, 12), matSuit);
    lForearmMesh.position.set(0, -0.11, 0);
    lForearmMesh.castShadow = true;
    this.leftElbow.add(lForearmMesh);

    // Tactical GPS Smartwatch on Left Forearm with Illuminated Green Display
    const smartWatchBody = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.038, 0.056), matArmor);
    smartWatchBody.position.set(0, -0.16, 0.032);
    const smartWatchScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.026, 0.026), matScreen);
    smartWatchScreen.position.set(0, -0.16, 0.061);
    this.leftElbow.add(smartWatchBody, smartWatchScreen);

    this.leftWrist = new THREE.Group();
    this.leftWrist.position.set(0, -0.22, 0);
    this.leftElbow.add(this.leftWrist);

    // Articulated Left Tactical Assault Glove with 5 Defined Fingers wrapped around Foregrip
    const lGlovePalm = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.075, 0.048), matGloves);
    lGlovePalm.position.set(0, -0.035, 0.01);

    const lKnuckleGuard = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.022, 0.024), matArmor);
    lKnuckleGuard.position.set(0, -0.022, 0.034);

    // Left Thumb (Wrapped over top of handguard / rail)
    const lThumbGroup = new THREE.Group();
    lThumbGroup.position.set(0.032, -0.028, 0.018);
    lThumbGroup.rotation.set(0.2, -0.4, 0.4);
    const lThumbBase = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.032, 0.022), matGlovePalm);
    lThumbBase.position.set(0, -0.014, 0);
    const lThumbTip = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.026, 0.020), matGloves);
    lThumbTip.position.set(0, -0.036, 0.005);
    lThumbTip.rotation.x = -0.35;
    lThumbGroup.add(lThumbBase, lThumbTip);

    // Left 4 Fingers (Curled firmly around the front handguard / angled foregrip)
    const lFingerList = [lThumbGroup];
    for (let f = 0; f < 4; f++) {
      const fX = -0.022 + f * 0.0145;
      const fingerGroup = new THREE.Group();
      fingerGroup.position.set(fX, -0.065, 0.014);
      const phalanx = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.028, 0.017), matGloves);
      phalanx.position.set(0, -0.012, 0);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.024, 0.015), matGlovePalm);
      tip.position.set(0, -0.028, 0.008);
      tip.rotation.x = -0.90; // Wrapped tightly around handguard!
      fingerGroup.add(phalanx, tip);
      this.leftWrist.add(fingerGroup);
      lFingerList.push(fingerGroup);
    }
    this.lFingers = lFingerList;

    this.leftWrist.add(lGlovePalm, lKnuckleGuard, lThumbGroup);

    // 7. RIGHT LEG (Crye G3 Tactical Cargo Pants, Knee Pad & Salomon Assault Boots)
    this.rightHip = new THREE.Group();
    this.rightHip.position.set(0.115, -0.05, 0.0);
    this.hips.add(this.rightHip);

    this.rightThigh = new THREE.Group();
    this.rightHip.add(this.rightThigh);

    const rThighMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.084, 0.070, 0.38, 14), matSuit);
    rThighMesh.position.set(0, -0.19, 0);
    rThighMesh.castShadow = true;
    this.rightThigh.add(rThighMesh);

    // Cargo Pocket on Outside of Right Thigh
    const rCargoPocket = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.12, 0.095), matPouches);
    rCargoPocket.position.set(0.085, -0.18, 0);
    this.rightThigh.add(rCargoPocket);

    this.rightKnee = new THREE.Group();
    this.rightKnee.position.set(0, -0.38, 0);
    this.rightThigh.add(this.rightKnee);

    // AirFlex Anatomical Hard-Shell Knee Pad with Dual Retention Straps
    const rKneePad = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.13, 0.065), matArmor);
    rKneePad.position.set(0, -0.02, 0.070);
    const rKneePlate = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.020), matSteel);
    rKneePlate.position.set(0, -0.02, 0.105);
    this.rightKnee.add(rKneePad, rKneePlate);

    const rShinMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.056, 0.36, 14), matSuit);
    rShinMesh.position.set(0, -0.18, 0);
    rShinMesh.castShadow = true;
    this.rightKnee.add(rShinMesh);

    this.rightAnkle = new THREE.Group();
    this.rightAnkle.position.set(0, -0.36, 0);
    this.rightKnee.add(this.rightAnkle);

    // Salomon Quest 4D GTX High-Top Assault Boots with Deep-Lugged Vibram Soles
    const rBootFoot = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.095, 0.22), matBoots);
    rBootFoot.position.set(0, -0.045, 0.05);
    rBootFoot.castShadow = true;
    const rBootSole = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.032, 0.24), matArmor);
    rBootSole.position.set(0, -0.095, 0.05);
    const rToeCap = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.045, 0.065), matArmor);
    rToeCap.position.set(0, -0.065, 0.145);
    this.rightAnkle.add(rBootFoot, rBootSole, rToeCap);

    // 8. LEFT LEG
    this.leftHip = new THREE.Group();
    this.leftHip.position.set(-0.115, -0.05, 0.0);
    this.hips.add(this.leftHip);

    this.leftThigh = new THREE.Group();
    this.leftHip.add(this.leftThigh);

    const lThighMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.084, 0.070, 0.38, 14), matSuit);
    lThighMesh.position.set(0, -0.19, 0);
    lThighMesh.castShadow = true;
    this.leftThigh.add(lThighMesh);

    const lCargoPocket = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.12, 0.095), matPouches);
    lCargoPocket.position.set(-0.085, -0.18, 0);
    this.leftThigh.add(lCargoPocket);

    this.leftKnee = new THREE.Group();
    this.leftKnee.position.set(0, -0.38, 0);
    this.leftThigh.add(this.leftKnee);

    const lKneePad = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.13, 0.065), matArmor);
    lKneePad.position.set(0, -0.02, 0.070);
    const lKneePlate = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.020), matSteel);
    lKneePlate.position.set(0, -0.02, 0.105);
    this.leftKnee.add(lKneePad, lKneePlate);

    const lShinMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.056, 0.36, 14), matSuit);
    lShinMesh.position.set(0, -0.18, 0);
    lShinMesh.castShadow = true;
    this.leftKnee.add(lShinMesh);

    this.leftAnkle = new THREE.Group();
    this.leftAnkle.position.set(0, -0.36, 0);
    this.leftKnee.add(this.leftAnkle);

    const lBootFoot = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.095, 0.22), matBoots);
    lBootFoot.position.set(0, -0.045, 0.05);
    lBootFoot.castShadow = true;
    const lBootSole = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.032, 0.24), matArmor);
    lBootSole.position.set(0, -0.095, 0.05);
    const lToeCap = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.045, 0.065), matArmor);
    lToeCap.position.set(0, -0.065, 0.145);
    this.leftAnkle.add(lBootFoot, lBootSole, lToeCap);

    // Build Detailed 3D M4A1 Tactical Carbine & Socket in Hand
    this.tpRifle = this.createDetailedM4A1(false);
    this.setWeaponLocation('HAND');

    this.mesh.add(this.operatorGroup);
  }

  // Switch weapon between Hand Socket and Back Sling Socket dynamically
  setWeaponLocation(location) {
    this.weaponLocation = location;
    if (!this.tpRifle) return;

    if (this.tpRifle.parent) {
      this.tpRifle.parent.remove(this.tpRifle);
    }

    // vanguard.fbx root has scale 0.01, so a child gun requires scale 76.0 to render at true 0.76m tactical scale.
    // Procedural operator root has scale 1.0, so gun scale is 0.68.
    const gunScale = this.isSurvivorLoaded ? 76.0 : 0.68;

    if (location === 'BACK') {
      const targetSocket = (this.isSurvivorLoaded && this.survivorBackSocket) ? this.survivorBackSocket : this.backSlingSocket;
      if (targetSocket) {
        targetSocket.add(this.tpRifle);
        this.tpRifle.position.set(0, 0, 0);
        this.tpRifle.rotation.set(0, 0, 0);
        this.tpRifle.scale.set(gunScale, gunScale, gunScale);
        this.tpRifle.visible = true;
      }
      if (window.soundEngine && window.soundEngine.playWeaponSling) {
        window.soundEngine.playWeaponSling();
      }
    } else { // 'HAND'
      const targetSocket = (this.isSurvivorLoaded && this.survivorHandSocket) ? this.survivorHandSocket : this.rightHandSocket;
      if (targetSocket) {
        targetSocket.add(this.tpRifle);
        this.tpRifle.position.set(0, 0, 0);
        this.tpRifle.rotation.set(0, 0, 0);
        this.tpRifle.scale.set(gunScale, gunScale, gunScale);
        this.tpRifle.visible = true;
      }
    }
  }

  // =========================================================================
  // OFFICIAL MIXAMO CHARACTER & MOCAP FBX ANIMATION ENGINE (LEON S. KENNEDY)
  // =========================================================================
  loadSurvivorCharacter() {
    this.isSurvivorLoaded = false;
    this.actions = {};
    this.activeAction = null;
    this.currentActionName = 'rifleIdle';
    this.survivorBaseY = 0.95;

    if (typeof THREE.FBXLoader === 'undefined') {
      console.warn('[Player] FBXLoader unavailable, keeping procedural operator active.');
      return;
    }

    const fbxLoader = new THREE.FBXLoader();
    const gltfLoader = (typeof THREE.GLTFLoader !== 'undefined') ? new THREE.GLTFLoader() : null;

    // Load ultra-optimized WebP PBR textures (Reduced from 10.8 MB to only 878 KB!)
    const texLoader = new THREE.TextureLoader();
    const diffMap = texLoader.load('assets/leon_diffuse.webp');
    if (diffMap.colorSpace !== undefined) diffMap.colorSpace = THREE.SRGBColorSpace;
    const normMap = texLoader.load('assets/leon_normal.webp');
    const roughMap = texLoader.load('assets/leon_roughness.webp');
    const metalMap = texLoader.load('assets/leon_metallic.webp');

    const leonMaterial = new THREE.MeshStandardMaterial({
      map: diffMap,
      normalMap: normMap,
      roughnessMap: roughMap,
      metalnessMap: metalMap,
      roughness: 0.75,
      metalness: 0.15
    });
    leonMaterial.skinning = true;

    const setupLeonCharacter = (character) => {
      character.name = 'LeonSKennedy';
      character.scale.set(0.01, 0.01, 0.01);
      character.position.set(0, this.survivorBaseY, 0);
      character.rotation.set(0, 0, 0);

      character.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.material = leonMaterial;
        }
      });

      // Resolve Mixamo skeleton bones
      this.survivorModel = character;
      this.survivorRightHand = character.getObjectByName('mixamorigRightHand');
      this.survivorRightArm = character.getObjectByName('mixamorigRightArm');
      this.survivorRightForeArm = character.getObjectByName('mixamorigRightForeArm');
      this.survivorLeftHand = character.getObjectByName('mixamorigLeftHand');
      this.survivorLeftArm = character.getObjectByName('mixamorigLeftArm');
      this.survivorLeftForeArm = character.getObjectByName('mixamorigLeftForeArm');
      this.survivorSpine = character.getObjectByName('mixamorigSpine');
      this.survivorSpine1 = character.getObjectByName('mixamorigSpine1');
      this.survivorSpine2 = character.getObjectByName('mixamorigSpine2');
      this.survivorHips = character.getObjectByName('mixamorigHips');
      this.survivorLeftUpLeg = character.getObjectByName('mixamorigLeftUpLeg');
      this.survivorRightUpLeg = character.getObjectByName('mixamorigRightUpLeg');
      this.survivorLeftLeg = character.getObjectByName('mixamorigLeftLeg');
      this.survivorRightLeg = character.getObjectByName('mixamorigRightLeg');
      this.survivorLeftFoot = character.getObjectByName('mixamorigLeftFoot');
      this.survivorRightFoot = character.getObjectByName('mixamorigRightFoot');

      // Authentic Tactical Cargo Pants Scale (Balances heavy shearling jacket silhouette)
      if (this.survivorLeftUpLeg) this.survivorLeftUpLeg.scale.set(1.15, 1.0, 1.18);
      if (this.survivorRightUpLeg) this.survivorRightUpLeg.scale.set(1.15, 1.0, 1.18);
      if (this.survivorLeftLeg) this.survivorLeftLeg.scale.set(1.12, 1.0, 1.15);
      if (this.survivorRightLeg) this.survivorRightLeg.scale.set(1.12, 1.0, 1.15);

      // Create Hand Socket on Right Hand (Placed inside palm center)
      if (this.survivorRightHand) {
        this.survivorHandSocket = new THREE.Group();
        this.survivorHandSocket.name = 'SurvivorHandSocket';
        // True palm center inside mixamorigRightHand bone (matches rifle grip exactly)
        this.survivorHandSocket.position.set(0.5, 6.0, 0.5);
        this.survivorRightHand.add(this.survivorHandSocket);
      }

      // Create Back Sling Socket on Spine2 (Diagonally across upper back)
      if (this.survivorSpine2) {
        this.survivorBackSocket = new THREE.Group();
        this.survivorBackSocket.name = 'SurvivorBackSocket';
        this.survivorBackSocket.position.set(8.0, 5.0, -14.0);
        this.survivorBackSocket.rotation.set(0.35, Math.PI, 0.75);
        this.survivorSpine2.add(this.survivorBackSocket);
      }

      this.mixer = new THREE.AnimationMixer(character);

      // Load all Mixamo Mocap FBX Animations
      this.loadMixamoFBXAnimations();

      // Seamless activation:
      // Hide procedural primitives, add Leon into operator group
      if (this.hips) this.hips.visible = false;
      this.operatorGroup.add(character);
      this.isSurvivorLoaded = true;

      // Re-attach weapon to the Mixamo hand socket with 76.0 scale
      this.setWeaponLocation(this.weaponLocation || 'HAND');
      console.log('[Player] Leon S. Kennedy Loaded & Activated (Optimized GLB + WebP Textures)!');
    };

    // Load optimized GLB (3.5 MB instead of 13.8 MB FBX) with fallback to FBX
    if (gltfLoader) {
      gltfLoader.load(
        'assets/leon_welded.glb',
        (gltf) => setupLeonCharacter(gltf.scene),
        undefined,
        (err) => {
          console.warn('[Player] Could not load leon_welded.glb, falling back to leon.fbx:', err);
          fbxLoader.load('assets/leon.fbx', setupLeonCharacter, undefined, (e) => console.error('[Player] Failed to load Leon:', e));
        }
      );
    } else {
      fbxLoader.load('assets/leon.fbx', setupLeonCharacter, undefined, (e) => console.error('[Player] Failed to load Leon:', e));
    }
  }

  loadMixamoFBXAnimations() {
    if (typeof THREE.FBXLoader === 'undefined') return;
    const fbxLoader = new THREE.FBXLoader();

    const animMap = {
      // --- Mixamo Rifle 8-Way Locomotion Pack (Leon S. Kennedy) ---
      // Idles:
      idleAiming: 'assets/Rifle 8-Way Locomotion Pack/idle aiming.fbx',
      idle: 'assets/Rifle 8-Way Locomotion Pack/idle.fbx',
      crouchIdle: 'assets/Rifle 8-Way Locomotion Pack/idle crouching.fbx',
      crouchIdleAim: 'assets/Rifle 8-Way Locomotion Pack/idle crouching aiming.fbx',

      // 8-Way Run (Combat Jog / Free-roam Run):
      runFwd: 'assets/Rifle 8-Way Locomotion Pack/run forward.fbx',
      runBwd: 'assets/Rifle 8-Way Locomotion Pack/run backward.fbx',
      runLeft: 'assets/Rifle 8-Way Locomotion Pack/run left.fbx',
      runRight: 'assets/Rifle 8-Way Locomotion Pack/run right.fbx',
      runFwdLeft: 'assets/Rifle 8-Way Locomotion Pack/run forward left.fbx',
      runFwdRight: 'assets/Rifle 8-Way Locomotion Pack/run forward right.fbx',
      runBwdLeft: 'assets/Rifle 8-Way Locomotion Pack/run backward left.fbx',
      runBwdRight: 'assets/Rifle 8-Way Locomotion Pack/run backward right.fbx',

      // 8-Way Walk (ADS Strafe / Tactical Walk):
      walkFwd: 'assets/Rifle 8-Way Locomotion Pack/walk forward.fbx',
      walkBwd: 'assets/Rifle 8-Way Locomotion Pack/walk backward.fbx',
      walkLeft: 'assets/Rifle 8-Way Locomotion Pack/walk left.fbx',
      walkRight: 'assets/Rifle 8-Way Locomotion Pack/walk right.fbx',
      walkFwdLeft: 'assets/Rifle 8-Way Locomotion Pack/walk forward left.fbx',
      walkFwdRight: 'assets/Rifle 8-Way Locomotion Pack/walk forward right.fbx',
      walkBwdLeft: 'assets/Rifle 8-Way Locomotion Pack/walk backward left.fbx',
      walkBwdRight: 'assets/Rifle 8-Way Locomotion Pack/walk backward right.fbx',

      // 8-Way Sprint (Shift + Movement):
      sprintFwd: 'assets/Rifle 8-Way Locomotion Pack/sprint forward.fbx',
      sprintBwd: 'assets/Rifle 8-Way Locomotion Pack/sprint backward.fbx',
      sprintLeft: 'assets/Rifle 8-Way Locomotion Pack/sprint left.fbx',
      sprintRight: 'assets/Rifle 8-Way Locomotion Pack/sprint right.fbx',
      sprintFwdLeft: 'assets/Rifle 8-Way Locomotion Pack/sprint forward left.fbx',
      sprintFwdRight: 'assets/Rifle 8-Way Locomotion Pack/sprint forward right.fbx',
      sprintBwdLeft: 'assets/Rifle 8-Way Locomotion Pack/sprint backward left.fbx',
      sprintBwdRight: 'assets/Rifle 8-Way Locomotion Pack/sprint backward right.fbx',

      // 8-Way Crouch Walk:
      crouchWalkFwd: 'assets/Rifle 8-Way Locomotion Pack/walk crouching forward.fbx',
      crouchWalkBwd: 'assets/Rifle 8-Way Locomotion Pack/walk crouching backward.fbx',
      crouchWalkLeft: 'assets/Rifle 8-Way Locomotion Pack/walk crouching left.fbx',
      crouchWalkRight: 'assets/Rifle 8-Way Locomotion Pack/walk crouching right.fbx',
      crouchWalkFwdLeft: 'assets/Rifle 8-Way Locomotion Pack/walk crouching forward left.fbx',
      crouchWalkFwdRight: 'assets/Rifle 8-Way Locomotion Pack/walk crouching forward right.fbx',
      crouchWalkBwdLeft: 'assets/Rifle 8-Way Locomotion Pack/walk crouching backward left.fbx',
      crouchWalkBwdRight: 'assets/Rifle 8-Way Locomotion Pack/walk crouching backward right.fbx',

      // Stationary Pivots & Crouch Pivots:
      turn90Left: 'assets/Rifle 8-Way Locomotion Pack/turn 90 left.fbx',
      turn90Right: 'assets/Rifle 8-Way Locomotion Pack/turn 90 right.fbx',
      crouchTurn90Left: 'assets/Rifle 8-Way Locomotion Pack/crouching turn 90 left.fbx',
      crouchTurn90Right: 'assets/Rifle 8-Way Locomotion Pack/crouching turn 90 right.fbx',

      // Airborne & Jumping:
      jumpUp: 'assets/Rifle 8-Way Locomotion Pack/jump up.fbx',
      jumpLoop: 'assets/Rifle 8-Way Locomotion Pack/jump loop.fbx',
      jumpDown: 'assets/Rifle 8-Way Locomotion Pack/jump down.fbx',

      // Deaths:
      deathFront: 'assets/Rifle 8-Way Locomotion Pack/death from the front.fbx',
      deathBack: 'assets/Rifle 8-Way Locomotion Pack/death from the back.fbx',
      deathRight: 'assets/Rifle 8-Way Locomotion Pack/death from right.fbx',
      deathFrontHeadshot: 'assets/Rifle 8-Way Locomotion Pack/death from front headshot.fbx',
      deathBackHeadshot: 'assets/Rifle 8-Way Locomotion Pack/death from back headshot.fbx',
      deathCrouchHeadshot: 'assets/Rifle 8-Way Locomotion Pack/death crouching headshot front.fbx',

      // Stunts & Actions:
      rifleFire: 'assets/Shooter Pack/firing rifle.fbx',
      jumpForward: 'assets/Shooter Pack/jump forward.fbx',
      jumpBackward: 'assets/Shooter Pack/jump backward.fbx',
      wallRunLeft: 'assets/left Wall Run.fbx',
      wallRunRight: 'assets/right Wall Run.fbx',
      wallFlip: 'assets/Run To Flip.fbx',
      flyingKick: 'assets/Flying Kick.fbx'
    };

    const singleShotActions = new Set([
      'wallFlip', 'flyingKick', 'rifleFire',
      'jumpUp', 'jumpDown',
      'turn90Left', 'turn90Right', 'crouchTurn90Left', 'crouchTurn90Right',
      'deathFront', 'deathBack', 'deathRight', 'deathFrontHeadshot', 'deathBackHeadshot', 'deathCrouchHeadshot'
    ]);

    for (const [key, path] of Object.entries(animMap)) {
      fbxLoader.load(
        path,
        (fbx) => {
          if (fbx.animations && fbx.animations.length > 0) {
            const clip = fbx.animations[0].clone();
            clip.name = key;

            // Strip root translation track to ensure game physics manages player position & collisions cleanly
            clip.tracks = clip.tracks.filter(t => !t.name.endsWith('.position'));

            const action = this.mixer.clipAction(clip);
            if (singleShotActions.has(key)) {
              action.setLoop(THREE.LoopOnce);
              action.clampWhenFinished = true;
            } else {
              action.setLoop(THREE.LoopRepeat);
            }

            this.actions[key] = action;

            // Maintain aliases so all existing references work seamlessly
            if (key === 'idleAiming') this.actions['rifleIdle'] = action;
            if (key === 'runFwd') this.actions['rifleRun'] = action;
            if (key === 'walkFwd') this.actions['rifleWalk'] = action;
            if (key === 'runBwd') this.actions['runBackward'] = action;
            if (key === 'runRight') this.actions['strafe'] = action;

            // Start playing idle aiming immediately once available
            if ((key === 'idleAiming' || key === 'rifleIdle') && !this.activeAction) {
              this.fadeToAction('idleAiming', 0.25);
            }
          }
        },
        undefined,
        (err) => {
          console.warn(`[Player] Failed to load anim ${key} from ${path}:`, err);
        }
      );
    }
  }

  fadeToAction(name, duration = 0.2) {
    if (!this.actions) return;
    let target = name;
    if (!this.actions[target]) {
      // Graceful fallback while directional clips finish streaming
      if (target.includes('sprint') && this.actions['runFwd']) target = 'runFwd';
      else if (target.includes('walk') && this.actions['walkFwd']) target = 'walkFwd';
      else if (target.includes('Fwd') && this.actions['runFwd']) target = 'runFwd';
      else if (target.includes('Bwd') && this.actions['runBwd']) target = 'runBwd';
      else if ((target.includes('Left') || target.includes('Right')) && this.actions['runRight']) target = 'runRight';
      else if (target.includes('crouch') && this.actions['crouchIdle']) target = 'crouchIdle';
      else if (target.includes('jump') && this.actions['jumpLoop']) target = 'jumpLoop';
      else if (this.actions['rifleRun'] && target.includes('run')) target = 'rifleRun';
      else target = this.actions['idleAiming'] ? 'idleAiming' : 'rifleIdle';
    }
    if (!this.actions[target]) return;

    const nextAction = this.actions[target];
    if (this.activeAction === nextAction) return;

    if (this.activeAction) {
      this.activeAction.fadeOut(duration);
    }

    nextAction
      .reset()
      .setEffectiveTimeScale(1)
      .setEffectiveWeight(1)
      .fadeIn(duration)
      .play();

    this.activeAction = nextAction;
    this.currentActionName = target;
  }

  // Hit reaction: called when a zombie's attack actually lands (see
  // ZombieManager.damagePlayer). Camera trauma shake + a brief backward
  // lean of the model, so the hit reads on screen and not just in the HP
  // bar. The flinch decays in update(); the shake decays in game.js.
  playHitReaction() {
    this.hitFlinchT = 0.25;
    if (window.game && window.game.addTrauma) window.game.addTrauma(0.45);
  }

  updateSurvivorKinematics(delta, isMoving, input, aimPitch) {
    if (this.mixer) {
      this.mixer.update(delta);
      if (this.survivorModel) {
        // Dampen excessive mocap spine sway so upper torso stays rock-solid locked onto crosshair
        if (this.survivorSpine) {
          this.survivorSpine.rotation.z *= 0.35;
          this.survivorSpine.rotation.y *= 0.35;
        }
        if (this.survivorSpine1) {
          this.survivorSpine1.rotation.z *= 0.35;
          this.survivorSpine1.rotation.y *= 0.35;
        }
        if (this.survivorSpine2) {
          this.survivorSpine2.rotation.z *= 0.35;
          this.survivorSpine2.rotation.y *= 0.35;
        }
        this.survivorModel.updateMatrixWorld(true);
      }
    }

    // Death animation handler
    if (this.hp <= 0 || this.isDead) {
      if (!this._deathTriggered) {
        this._deathTriggered = true;
        this.isDead = true;
        const deathClips = ['deathFront', 'deathBack', 'deathRight', 'deathFrontHeadshot', 'deathBackHeadshot'];
        const chosen = deathClips[Math.floor(Math.random() * deathClips.length)];
        this.fadeToAction(chosen, 0.15);
      }
      return;
    }

    const isFiring = Boolean(input && input.mouseLeftHeld);
    const isAiming = Boolean(input && input.mouseRightHeld);

    // 1. Dynamic Animation Transitions with Mocap Clips & Procedural Stunts
    if (this.isWallRunning) {
      // Procedural Prince of Persia Side Wall Run kinematics directly on Leon's skeleton!
      // Legs angle and stick firmly to the vertical wall face with 22° athletic tilt
      if (this.activeAction) {
        this.activeAction.fadeOut(0.12);
        this.activeAction = null;
      }
      this.animateSurvivorWallRun();
    } else {
      if (this.survivorModel && (this.survivorModel.rotation.z !== 0 || this.survivorModel.rotation.x !== 0)) {
        this.survivorModel.rotation.z = 0;
        this.survivorModel.rotation.x = 0;
      }
      if (this.isWallBackflipping) {
        this.fadeToAction('wallFlip', 0.12);
      } else if (this.isDropkicking || this.isKicking) {
        this.fadeToAction('flyingKick', 0.10);
      } else if (this.isPunching) {
        this.fadeToAction('flyingKick', 0.10);
      } else if (this.isRolling) {
        this.fadeToAction('wallFlip', 0.12);
      } else if (this.isShootdodging) {
        // Multi-Directional Max Payne Shootdodge Kinematics using authentic Mocap Jump Clips
        if (this.survivorModel) {
          const diveP = 1.0 - (this.shootdodgeTimer / this.shootdodgeDuration);
          const baseY = this.survivorBaseY !== undefined ? this.survivorBaseY : 0.95;
          if (diveP < 0.70) {
            if (this.shootdodgeType === 'BACKWARD') {
              this.survivorModel.position.y = 0.40;
              this.survivorModel.rotation.set(-0.75, 0, 0);
              this.fadeToAction('jumpBackward', 0.10);
            } else if (this.shootdodgeType === 'LEFT') {
              this.survivorModel.position.y = 0.48;
              this.survivorModel.rotation.set(0.20, 0, -0.65);
              this.fadeToAction('sprintLeft', 0.10);
            } else if (this.shootdodgeType === 'RIGHT') {
              this.survivorModel.position.y = 0.48;
              this.survivorModel.rotation.set(0.20, 0, 0.65);
              this.fadeToAction('sprintRight', 0.10);
            } else { // FORWARD (Superman Leap)
              this.survivorModel.position.y = 0.50;
              this.survivorModel.rotation.set(0.70, 0, 0);
              this.fadeToAction('jumpForward', 0.10);
            }
          } else {
            // Touchdown & athletic recovery back to feet
            const blend = (diveP - 0.70) / 0.30;
            this.survivorModel.position.y = THREE.MathUtils.lerp(0.45, baseY, blend);
            this.survivorModel.rotation.set(0, 0, 0);
            this.fadeToAction('idleAiming', 0.20);
          }
        }
      } else if (!this.isGrounded) {
        // Tactical Airborne Jumping (Mixamo jump up / loop / down)
        if (this.velocityY > 1.2) {
          this.fadeToAction('jumpUp', 0.10);
        } else if (this.velocityY < -2.2) {
          this.fadeToAction('jumpDown', 0.12);
        } else {
          this.fadeToAction('jumpLoop', 0.12);
        }
      } else if (isMoving) {
        if (this.survivorModel) {
          this.survivorModel.rotation.set(0, 0, 0);
          this.survivorModel.position.y = this.survivorBaseY !== undefined ? this.survivorBaseY : 0.95;
        }

        const isAimingOrFiring = Boolean(this.isAiming || isFiring);

        if (isAimingOrFiring) {
          // COMBAT 8-WAY STRAFE MODE (Holding Right-Click ADS or Left-Click Fire):
          // Body stays locked to crosshair/camera direction, feet execute genuine 8-way mocap strafing
          const sKey = Boolean(input && (input.keys['KeyS'] || input.keys['ArrowDown']));
          const wKey = Boolean(input && (input.keys['KeyW'] || input.keys['ArrowUp']));
          const aKey = Boolean(input && (input.keys['KeyA'] || input.keys['ArrowLeft']));
          const dKey = Boolean(input && (input.keys['KeyD'] || input.keys['ArrowRight']));

          let dir = 'Fwd';
          if (wKey && aKey) dir = 'FwdLeft';
          else if (wKey && dKey) dir = 'FwdRight';
          else if (sKey && aKey) dir = 'BwdLeft';
          else if (sKey && dKey) dir = 'BwdRight';
          else if (sKey) dir = 'Bwd';
          else if (aKey) dir = 'Left';
          else if (dKey) dir = 'Right';
          else if (wKey) dir = 'Fwd';

          let actionName = 'run' + dir;
          if (this.isCrouching) {
            actionName = 'crouchWalk' + dir;
          } else if (this.isSprinting) {
            actionName = 'sprint' + dir;
          } else if (this.isAiming) {
            // ADS Aim-Walk: Tactical steady footing mocap
            actionName = 'walk' + dir;
          } else {
            // Combat run strafe
            actionName = 'run' + dir;
          }

          this.fadeToAction(actionName, 0.15);
        } else {
          // GTA V / UNCHARTED FREE-ROAM LOCOMOTION (Not Aiming):
          // Character body smoothly turns into WASD direction of travel and jogs forward naturally!
          let actionName = 'runFwd';
          if (this.isSprinting) {
            actionName = 'sprintFwd';
          } else if (this.isCrouching) {
            actionName = 'crouchWalkFwd';
          } else {
            actionName = 'runFwd';
          }

          this.fadeToAction(actionName, 0.15);
        }
      } else {
        // STATIONARY / IDLE MODE:
        if (this.survivorModel) {
          this.survivorModel.rotation.set(0, 0, 0);
          this.survivorModel.position.y = this.survivorBaseY !== undefined ? this.survivorBaseY : 0.95;
        }

        if (isFiring) {
          this.fadeToAction('rifleFire', 0.08);
        } else if (this.isCrouching) {
          this.fadeToAction(this.isAiming ? 'crouchIdleAim' : 'crouchIdle', 0.20);
        } else if (this.isAiming) {
          this.fadeToAction('idleAiming', 0.20);
        } else {
          // Free-roam idle:
          // Alert combat-ready stance for first 4.0s, relaxed environmental scan thereafter
          if (this.idleTimer >= 4.0) {
            this.fadeToAction('idle', 0.35);
          } else {
            this.fadeToAction('idleAiming', 0.20);
          }
        }
      }
    }

    // 2. Mathematical Two-Hand Gun Orientation Solver:
    // Locks rifle's barrel forward onto crosshair target in world space with aim pitch.
    // Places socket at palm center and scale at 76.0 so the handguard lands directly in the left hand!
    if (this.weaponLocation === 'HAND') {
      if (this.survivorHandSocket && this.survivorRightHand) {
        const targetGunQuat = this.mesh.quaternion.clone();
        if (aimPitch) {
          targetGunQuat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), aimPitch));
        }

        const handWorldQuat = new THREE.Quaternion();
        this.survivorRightHand.getWorldQuaternion(handWorldQuat);
        this.survivorHandSocket.quaternion.copy(handWorldQuat.clone().invert().multiply(targetGunQuat));
      }
    }
  }

  // Prince of Persia Side Wall Run for Leon S. Kennedy / Mixamo Skeleton
  // Exact procedural kinematics: legs plant and stick firmly to the vertical wall face with 22° athletic tilt
  animateSurvivorWallRun() {
    if (!this.survivorModel) return;

    let isLeftWall = this.wallRunSide === 'LEFT';
    if (this.wallNormal) {
      const toWallLocal = this.wallNormal.clone().negate().applyQuaternion(this.mesh.quaternion.clone().invert());
      isLeftWall = toWallLocal.x < 0;
      this.wallRunSide = isLeftWall ? 'LEFT' : 'RIGHT';
    }

    // 22° athletic body lean into the wall with forward running pitch
    const tiltZ = isLeftWall ? -0.38 : 0.38;
    this.survivorModel.rotation.z = tiltZ;
    this.survivorModel.rotation.x = 0.12;

    const runCycle = Math.sin(this.wallRunTimer * 16);

    if (isLeftWall) {
      // Wall is on player's LEFT:
      // Both legs angle towards the wall face with alternating stride cadence
      if (this.survivorLeftUpLeg) this.survivorLeftUpLeg.rotation.set(runCycle * 0.75, 0.05, Math.PI - 0.38);
      if (this.survivorLeftLeg) this.survivorLeftLeg.rotation.set(Math.max(0.20, runCycle * 0.90 + 0.35), 0, 0);

      if (this.survivorRightUpLeg) this.survivorRightUpLeg.rotation.set(-runCycle * 0.75, 0.05, Math.PI - 0.42);
      if (this.survivorRightLeg) this.survivorRightLeg.rotation.set(Math.max(0.20, -runCycle * 0.90 + 0.35), 0, 0);

      // Left arm (wall-side) reaches out towards wall for parkour stabilization
      if (this.survivorLeftArm) this.survivorLeftArm.rotation.set(0.40, 0.20, 0.80);
      if (this.survivorLeftForeArm) this.survivorLeftForeArm.rotation.set(0.30, 0, 0);

      // Right arm (outside) pumps dynamically with running cadence
      if (this.survivorRightArm) this.survivorRightArm.rotation.set(runCycle * 0.60 - 0.30, 0, -0.90);
      if (this.survivorRightForeArm) this.survivorRightForeArm.rotation.set(-0.80, 0, 0);
    } else {
      // Wall is on player's RIGHT:
      // Both legs angle towards the wall face with alternating stride cadence
      if (this.survivorRightUpLeg) this.survivorRightUpLeg.rotation.set(runCycle * 0.75, -0.05, -Math.PI + 0.38);
      if (this.survivorRightLeg) this.survivorRightLeg.rotation.set(Math.max(0.20, runCycle * 0.90 + 0.35), 0, 0);

      if (this.survivorLeftUpLeg) this.survivorLeftUpLeg.rotation.set(-runCycle * 0.75, -0.05, -Math.PI + 0.42);
      if (this.survivorLeftLeg) this.survivorLeftLeg.rotation.set(Math.max(0.20, -runCycle * 0.90 + 0.35), 0, 0);

      // Right arm (wall-side) reaches out towards wall
      if (this.survivorRightArm) this.survivorRightArm.rotation.set(0.40, -0.20, -0.80);
      if (this.survivorRightForeArm) this.survivorRightForeArm.rotation.set(0.30, 0, 0);

      // Left arm (outside) pumps dynamically
      if (this.survivorLeftArm) this.survivorLeftArm.rotation.set(runCycle * 0.60 - 0.30, 0, 0.90);
      if (this.survivorLeftForeArm) this.survivorLeftForeArm.rotation.set(-0.80, 0, 0);
    }

    if (this.survivorSpine2) {
      this.survivorSpine2.rotation.set(0.06, isLeftWall ? -0.12 : 0.12, 0);
    }
  }

  // Create High-Detail 3D Tactical M4A1 Carbine
  createDetailedM4A1(isFirstPerson = false) {
    const gunGroup = new THREE.Group();
    const rifleOffsetGroup = new THREE.Group();
    rifleOffsetGroup.position.set(0, 0.125, 0.09);
    gunGroup.add(rifleOffsetGroup);

    // Military PBR materials
    const rifleDark = new THREE.MeshStandardMaterial({ color: 0x242830, roughness: 0.52, metalness: 0.58 });
    const rifleTan = new THREE.MeshStandardMaterial({ color: 0x8c785b, roughness: 0.70, metalness: 0.15 });
    const steelMetal = new THREE.MeshStandardMaterial({ color: 0x667080, roughness: 0.35, metalness: 0.85 });
    const opticGlass = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.55 });
    const reticleRed = new THREE.MeshBasicMaterial({ color: 0xff1133 });

    // 1. Upper Receiver & Picatinny Rail
    const upperRec = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.085, 0.38), rifleDark);
    upperRec.position.set(0, 0.02, 0);
    upperRec.castShadow = true;

    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.018, 0.38), rifleDark);
    topRail.position.set(0, 0.068, 0);

    const brassDeflector = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.035, 0.045), rifleDark);
    brassDeflector.position.set(0.042, 0.025, 0.02);
    const forwardAssist = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.009, 0.040, 6), steelMetal);
    forwardAssist.position.set(0.040, 0.030, -0.06);
    forwardAssist.rotation.set(0, 0, -Math.PI / 4);

    const boltCarrier = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.026, 0.08), steelMetal);
    boltCarrier.position.set(0.035, 0.022, 0.04);

    const chargingHandle = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.015, 0.024), steelMetal);
    chargingHandle.position.set(0, 0.055, -0.19);

    rifleOffsetGroup.add(upperRec, topRail, brassDeflector, forwardAssist, boltCarrier, chargingHandle);

    // 2. Lower Receiver, Trigger & Ergonomic Pistol Grip
    const lowerRec = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.080, 0.28), rifleDark);
    lowerRec.position.set(0, -0.045, 0.02);
    lowerRec.castShadow = true;

    const magwell = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.085, 0.11), rifleDark);
    magwell.position.set(0, -0.080, 0.10);

    const triggerGuard = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.032, 0.080), steelMetal);
    triggerGuard.position.set(0, -0.092, -0.02);
    const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.028, 0.012), steelMetal);
    trigger.position.set(0, -0.082, -0.01);
    trigger.rotation.x = -0.18;

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.155, 0.075), rifleTan);
    grip.position.set(0, -0.125, -0.09);
    grip.rotation.x = -0.38;
    grip.castShadow = true;

    rifleOffsetGroup.add(lowerRec, magwell, triggerGuard, trigger, grip);

    // 3. Curved 30-Round PMAG Magazine
    const magGroup = new THREE.Group();
    magGroup.position.set(0, -0.17, 0.09);
    magGroup.rotation.x = -0.26;

    const magBody = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.22, 0.095), rifleDark);
    magBody.castShadow = true;
    magGroup.add(magBody);

    for (let r = -1.5; r <= 1.5; r++) {
      const magRib = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.012, 0.098), rifleTan);
      magRib.position.set(0, r * 0.045, 0);
      magGroup.add(magRib);
    }

    const floorplate = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.020, 0.105), rifleTan);
    floorplate.position.set(0, -0.115, 0);
    magGroup.add(floorplate);
    rifleOffsetGroup.add(magGroup);

    // 4. Free-Float Quad-Rail Handguard & Angled Foregrip (AFG)
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.072, 0.32), rifleDark);
    handguard.position.set(0, 0.015, 0.35);
    handguard.castShadow = true;

    for (let s of [-0.038, 0.038]) {
      const railCover = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.045, 0.22), rifleTan);
      railCover.position.set(s, 0.015, 0.35);
      rifleOffsetGroup.add(railCover);
    }

    const afg = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.052, 0.14), rifleTan);
    afg.position.set(0, -0.052, 0.32);
    afg.rotation.x = -0.22;
    afg.castShadow = true;

    const afgStop = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.030, 0.022), rifleDark);
    afgStop.position.set(0, -0.070, 0.38);
    rifleOffsetGroup.add(handguard, afg, afgStop);

    // 5. Tactical Holographic Optic Sight & PEQ-15 Laser Box
    const holoHood = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.065, 0.13), rifleDark);
    holoHood.position.set(0, 0.082, 0.06);
    const holoBase = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.020, 0.12), rifleDark);
    holoBase.position.set(0, 0.050, 0.06);
    const holoGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.042, 0.042), opticGlass);
    holoGlass.position.set(0, 0.082, 0.122);
    const holoReticle = new THREE.Mesh(new THREE.CircleGeometry(0.006, 8), reticleRed);
    holoReticle.position.set(0, 0.082, 0.123);
    rifleOffsetGroup.add(holoHood, holoBase, holoGlass, holoReticle);

    const peqBox = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.038, 0.11), rifleTan);
    peqBox.position.set(0, 0.068, 0.36);
    const peqLens = new THREE.Mesh(new THREE.CircleGeometry(0.008, 8), reticleRed);
    peqLens.position.set(0.015, 0.068, 0.416);
    rifleOffsetGroup.add(peqBox, peqLens);

    // 6. Barrel, Gas Block & Flash Hider
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.38, 8), steelMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.015, 0.64);
    barrel.castShadow = true;

    const compensator = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.085, 8), steelMetal);
    compensator.rotation.x = Math.PI / 2;
    compensator.position.set(0, 0.015, 0.84);
    rifleOffsetGroup.add(barrel, compensator);

    // 7. Retractable SOPMOD Stock
    const bufferTube = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.18, 8), steelMetal);
    bufferTube.rotation.x = Math.PI / 2;
    bufferTube.position.set(0, 0.022, -0.24);

    const stockBody = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.125, 0.22), rifleTan);
    stockBody.position.set(0, 0.015, -0.32);
    stockBody.castShadow = true;

    const rubberPad = new THREE.Mesh(new THREE.BoxGeometry(0.070, 0.130, 0.025), rifleDark);
    rubberPad.position.set(0, 0.015, -0.43);
    rifleOffsetGroup.add(bufferTube, stockBody, rubberPad);

    // Physical Muzzle Point Anchor
    const muzzlePoint = new THREE.Object3D();
    muzzlePoint.position.set(0, 0.14, 0.99);
    gunGroup.add(muzzlePoint);
    gunGroup.muzzlePoint = muzzlePoint;

    // 3D Fiery Muzzle Flash Mesh
    const muzzleFlash = this.createMuzzleFlashMesh();
    muzzleFlash.position.copy(muzzlePoint.position);
    muzzleFlash.visible = false;
    gunGroup.add(muzzleFlash);
    gunGroup.muzzleFlash = muzzleFlash;

    // Muzzle Point Light
    const muzzleLight = new THREE.PointLight(0xffaa22, 0, 16);
    muzzleLight.position.copy(muzzlePoint.position);
    gunGroup.add(muzzleLight);
    gunGroup.muzzleLight = muzzleLight;

    if (isFirstPerson) {
      this.fpMuzzlePoint = muzzlePoint;
      this.fpMuzzleFlash = muzzleFlash;
      this.fpMuzzleLight = muzzleLight;
    } else {
      this.tpMuzzlePoint = muzzlePoint;
      this.tpMuzzleFlash = muzzleFlash;
      this.tpMuzzleLight = muzzleLight;
    }

    return gunGroup;
  }

  createProceduralFireTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0.0, 'rgba(255, 255, 240, 1.0)');
    grad.addColorStop(0.2, 'rgba(255, 210, 60, 0.95)');
    grad.addColorStop(0.5, 'rgba(255, 100, 10, 0.70)');
    grad.addColorStop(0.8, 'rgba(200, 30, 0, 0.25)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(64, 64, 64, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 250, 200, 0.85)';
    ctx.beginPath();
    ctx.moveTo(64, 6);
    ctx.lineTo(68, 60);
    ctx.lineTo(122, 64);
    ctx.lineTo(68, 68);
    ctx.lineTo(64, 122);
    ctx.lineTo(60, 68);
    ctx.lineTo(6, 64);
    ctx.lineTo(60, 60);
    ctx.closePath();
    ctx.fill();

    return new THREE.CanvasTexture(canvas);
  }

  createMuzzleFlashMesh() {
    const flashGroup = new THREE.Group();
    const fireTex = this.createProceduralFireTexture();

    const spriteMat = new THREE.SpriteMaterial({
      map: fireTex,
      color: 0xffcc44,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.7, 0.7, 0.7);
    flashGroup.add(sprite);

    const planeMat = new THREE.MeshBasicMaterial({
      map: fireTex,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.65), planeMat);
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.65), planeMat);
    p2.rotation.y = Math.PI / 2;
    flashGroup.add(p1, p2);

    return flashGroup;
  }

  buildFirstPersonWeaponRig() {
    this.fpRig = new THREE.Group();
    this.fpRifle = this.createDetailedM4A1(true);
    this.fpRifle.position.set(0.24, -0.22, -0.48);
    this.fpRifle.scale.set(0.75, 0.75, 0.75);
    this.fpRig.add(this.fpRifle);

    this.camera.add(this.fpRig);
    this.fpRig.visible = false;
  }

  initLaserSight() {
    const laserMat = new THREE.LineBasicMaterial({
      color: this.laserColor,
      transparent: true,
      opacity: 0.9,
      linewidth: 2
    });

    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 1)
    ]);

    this.laserLine = new THREE.Line(laserGeo, laserMat);
    this.scene.add(this.laserLine);

    const dotGeo = new THREE.CircleGeometry(0.08, 12);
    const dotMat = new THREE.MeshBasicMaterial({ color: this.laserColor, transparent: true, opacity: 0.9 });
    this.laserDot = new THREE.Mesh(dotGeo, dotMat);
    this.laserDot.rotation.x = -Math.PI / 2;
    this.laserDot.position.y = 0.03;
    this.scene.add(this.laserDot);
  }

  setLaserColor(hex) {
    this.laserColor = hex;
    this.laserLine.material.color.set(hex);
    this.laserDot.material.color.set(hex);
  }

  setFingersClenched(isClenched) {
    if (this.rFingers) {
      for (let i = 1; i < this.rFingers.length; i++) {
        this.rFingers[i].rotation.x = isClenched ? -0.95 : 0.0;
      }
      this.rFingers[0].rotation.set(isClenched ? 0.35 : 0.2, isClenched ? 0.8 : 0.4, isClenched ? -0.7 : -0.4);
    }
    if (this.lFingers) {
      for (let i = 1; i < this.lFingers.length; i++) {
        this.lFingers[i].rotation.x = isClenched ? -0.95 : 0.0;
      }
      this.lFingers[0].rotation.set(isClenched ? 0.35 : 0.2, isClenched ? -0.8 : -0.4, isClenched ? 0.7 : 0.4);
    }
  }

  // =========================================================================
  // CORE UPDATE LOOP
  // =========================================================================
  update(delta, input, environment, cameraMode) {
    this.cameraMode = cameraMode;
    this.handleLocomotion(delta, input, environment);
    this.handleAiming(delta, input);
    this.handleWeapon(delta, input);
    this.updateOperatorKinematics(delta, input);
    this.updateLaserSight(); // Always runs after kinematics so bone transforms & muzzle world pos are 100% updated!
    this.updateProjectilesAndCasings(delta);
    this.updateVisibilityForCameraMode();
    this.updateHUD();
  }

  handleLocomotion(delta, input, environment) {
    const moveDir = new THREE.Vector3(0, 0, 0);

    // Stunts that take full control over locomotion physics
    const fullBodyStuntActive = this.isRolling || this.isKicking || this.isDropkicking || this.isWallRunning || this.isWallBackflipping;

    // MOBILE JOYSTICK (v3.8): analog stick drives movement when active.
    // joyX/joyY are -1..1 (up = joyY -1). Deadzone 0.12.
    const joyActive = Boolean(input.joyActive && (Math.abs(input.joyX || 0) > 0.12 || Math.abs(input.joyY || 0) > 0.12));
    if (!fullBodyStuntActive) {
      if (joyActive) {
        const jx = input.joyX, jy = input.joyY;
        if (this.cameraMode === 'TOP_DOWN') {
          moveDir.set(jx, 0, jy);
        } else {
          const forward = new THREE.Vector3();
          this.camera.getWorldDirection(forward);
          forward.y = 0;
          forward.normalize();
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
          right.y = 0;
          right.normalize();
          moveDir.addScaledVector(forward, -jy).addScaledVector(right, jx);
        }
      } else if (this.cameraMode === 'TOP_DOWN') {
        if (input.keys['KeyW'] || input.keys['ArrowUp']) moveDir.z -= 1;
        if (input.keys['KeyS'] || input.keys['ArrowDown']) moveDir.z += 1;
        if (input.keys['KeyA'] || input.keys['ArrowLeft']) moveDir.x -= 1;
        if (input.keys['KeyD'] || input.keys['ArrowRight']) moveDir.x += 1;
      } else {
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        // True Screen-Right vector: Local +X of camera is ALWAYS true screen right in all quadrants!
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        right.y = 0;
        right.normalize();

        if (input.keys['KeyW'] || input.keys['ArrowUp']) moveDir.add(forward);
        if (input.keys['KeyS'] || input.keys['ArrowDown']) moveDir.sub(forward);
        if (input.keys['KeyA'] || input.keys['ArrowLeft']) moveDir.sub(right);
        if (input.keys['KeyD'] || input.keys['ArrowRight']) moveDir.add(right);
      }
    }

    const isMoving = moveDir.lengthSq() > 0.01;
    if (isMoving) {
      // Keyboard: normalize to unit length. Joystick: keep analog magnitude
      // (a half-push is a walk, a full push is a run); only clamp above 1.
      if (!joyActive) moveDir.normalize();
      else if (moveDir.length() > 1) moveDir.normalize();
    }
    this.moveDir = moveDir;
    this.isMoving = isMoving;

    // Sprint & Stamina
    const shiftHeld = input.keys['ShiftLeft'] || input.keys['ShiftRight'];
    if (shiftHeld && isMoving && !this.isAiming && !this.staminaDepleted && this.stamina > 5 && !fullBodyStuntActive) {
      this.isSprinting = true;
      this.stamina -= this.staminaDrain * delta;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.staminaDepleted = true;
      }
    } else {
      this.isSprinting = false;
      this.stamina += this.staminaRecover * delta;
      if (this.stamina >= 100) {
        this.stamina = 100;
        this.staminaDepleted = false;
      } else if (this.stamina > 25) {
        this.staminaDepleted = false;
      }
    }

    // --- ADVANCED PARKOUR & COMBAT STUNT SYSTEM ---

    // 0. Q Trigger: Toggle Holster Rifle on Back / Draw Rifle into Hands with Authentic Animation!
    const qDown = input.keys['KeyQ'];
    if (qDown && !this._qConsumed && !fullBodyStuntActive && !this.isShootdodging && !this.isHolstering) {
      this._qConsumed = true;
      const targetPref = this.userWeaponPreference === 'HAND' ? 'BACK' : 'HAND';
      this.userWeaponPreference = targetPref;
      this.isHolstering = true;
      this.holsterTimer = this.holsterDuration;
      this.holsterAction = targetPref === 'BACK' ? 'HOLSTER' : 'DRAW';
      this.holsterSwapped = false;
      if (window.soundEngine && window.soundEngine.playWeaponSling) {
        window.soundEngine.playWeaponSling();
      }
      if (window.game && window.game.notify) {
        window.game.notify(targetPref === 'BACK' ? 'HOLSTERING RIFLE // MELEE BOXING READY' : 'DRAWING M4A1 // COMBAT READY');
      }
    }
    if (!qDown) this._qConsumed = false;

    // 1. Tactical Crouch (CTRL or C while stationary) vs 360° Combat Roll (C while moving)
    const ctrlDown = Boolean(input.keys['ControlLeft'] || input.keys['ControlRight']);
    const cKeyDown = Boolean(input.keys['KeyC']);

    // Left/Right Control toggles crouch stance:
    if (ctrlDown && !this._ctrlConsumed && !fullBodyStuntActive && !this.isShootdodging && this.isGrounded) {
      this._ctrlConsumed = true;
      this.isCrouching = !this.isCrouching;
    }
    if (!ctrlDown) this._ctrlConsumed = false;

    // C Key: If running/moving -> dynamic 360° Combat Roll! If stationary -> toggle tactical crouch!
    if (cKeyDown && !this._cConsumed && !fullBodyStuntActive && !this.isShootdodging && this.isGrounded) {
      this._cConsumed = true;
      if (isMoving) {
        this.isRolling = true;
        this.isCrouching = false;
        this.rollTimer = this.rollDuration;
        this.isInvulnerable = true;

        const camFwd = new THREE.Vector3();
        this.camera.getWorldDirection(camFwd);
        camFwd.y = 0;
        camFwd.normalize();
        this.rollDir.copy(moveDir.lengthSq() > 0 ? moveDir : camFwd);

        this.setWeaponLocation('BACK');
        if (window.soundEngine && window.soundEngine.playSlide) window.soundEngine.playSlide();
      } else {
        this.isCrouching = !this.isCrouching;
      }
    }
    if (!cKeyDown) this._cConsumed = false;

    // Automatic crouch cancel when sprinting, jumping, shootdodging, or rolling
    if (this.isSprinting || !this.isGrounded || this.isRolling || this.isShootdodging) {
      this.isCrouching = false;
    }

    if (this.isRolling) {
      this.rollTimer -= delta;
      if (this.rollTimer <= 0) {
        this.isRolling = false;
        this.isInvulnerable = false;
        this.setWeaponLocation(this.userWeaponPreference);
      }
    }

    // 2. Space Trigger: Prince of Persia Wall Stunts (near wall) OR Normal Tactical Jump (open ground)
    const spaceDown = input.keys['Space'];
    if (spaceDown && !this._spaceConsumed && !fullBodyStuntActive && !this.isShootdodging && this.isGrounded) {
      this._spaceConsumed = true;

      const camForward = new THREE.Vector3();
      this.camera.getWorldDirection(camForward);
      camForward.y = 0;
      camForward.normalize();

      const fwd = isMoving ? moveDir : camForward;

      // Query walls nearby in environment for Prince of Persia wall stunts (Strict 3.5m tall walls only, max 1.05m away!)
      let wallQuery = null;
      if (environment && environment.checkWallProximity) {
        wallQuery = environment.checkWallProximity(this.position, fwd, 1.05, 3.5);
      }

      if (wallQuery && wallQuery.frontWall) {
        // [Prince of Persia]: FRONT WALL CLIMB & 360° BACKFLIP!
        this.isWallBackflipping = true;
        this.wallFlipDuration = 1.35;
        this.wallFlipTimer = this.wallFlipDuration;
        this.wallNormal.copy(wallQuery.frontWall.normal);

        // Snap player directly to wall face line so no air-backflips occur
        const snapX = wallQuery.frontWall.closestX !== undefined ? wallQuery.frontWall.closestX : this.position.x;
        const snapZ = wallQuery.frontWall.closestZ !== undefined ? wallQuery.frontWall.closestZ : this.position.z;
        this.position.x = snapX + this.wallNormal.x * 0.45;
        this.position.z = snapZ + this.wallNormal.z * 0.45;

        this.velocityY = 3.8;
        this.isGrounded = false;
        this.setWeaponLocation('BACK');
        if (window.soundEngine && window.soundEngine.playWallBackflip) window.soundEngine.playWallBackflip();
      } else if (isMoving && wallQuery && (wallQuery.leftWall || wallQuery.rightWall)) {
        // [Prince of Persia]: SIDE WALL RUN!
        this.isWallRunning = true;
        this.wallRunDuration = 1.65;
        this.wallRunTimer = this.wallRunDuration;
        const chosenWall = wallQuery.leftWall || wallQuery.rightWall;
        this.wallRunSide = chosenWall.side;
        this.activeWallObs = chosenWall.obs;
        // Project forward direction strictly onto the wall face tangent (zero wall collisions!)
        const normal = chosenWall.normal;
        this.wallNormal.copy(normal); // Save normal for dynamic outward tilt
        const tangent = new THREE.Vector3(-normal.z, 0, normal.x);
        if (tangent.dot(fwd) < 0) tangent.negate();
        this.wallRunDir.copy(tangent).normalize();

        // Snap player onto the wall surface line (at height 1.35m and 0.32m from wall face - both feet firmly touch wall!)
        const snapX = chosenWall.closestX !== undefined ? chosenWall.closestX : this.position.x;
        const snapZ = chosenWall.closestZ !== undefined ? chosenWall.closestZ : this.position.z;
        this.position.x = snapX + normal.x * 0.32;
        this.position.z = snapZ + normal.z * 0.32;
        this.position.y = Math.max(this.position.y, 1.35);
        this.velocityY = 0; // Defy gravity on wall surface
        this.isGrounded = false;
        this.setWeaponLocation('BACK');
        if (window.soundEngine && window.soundEngine.playWallRun) window.soundEngine.playWallRun();
      } else {
        // [Tactical Jump]: ATHLETIC JUMP (Space key)!
        // Springs into the air, knees tuck up naturally, lands on feet!
        this.velocityY = 7.5;
        this.isGrounded = false;
        if (window.soundEngine && window.soundEngine.playJump) window.soundEngine.playJump();
      }
    }
    if (!spaceDown) this._spaceConsumed = false;

    // 2B. Alt Trigger: Max Payne 3 Bullet-Time Shootdodge Dive (Alt key)!
    const altDown = input.keys['AltLeft'] || input.keys['AltRight'] || input.keys['Alt'];
    if (altDown && !this._altConsumed && !fullBodyStuntActive && !this.isShootdodging && this.isGrounded) {
      this._altConsumed = true;

      const camForward = new THREE.Vector3();
      this.camera.getWorldDirection(camForward);
      camForward.y = 0;
      camForward.normalize();

      // Camera Right vector in world space: positive X of camera quaternion (A dives LEFT, D dives RIGHT)
      const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      camRight.y = 0;
      camRight.normalize();

      const keyW = input.keys['KeyW'] || input.keys['ArrowUp'];
      const keyA = input.keys['KeyA'] || input.keys['ArrowLeft'];
      const keyD = input.keys['KeyD'] || input.keys['ArrowRight'];
      const keyS = input.keys['KeyS'] || input.keys['ArrowDown'];

      let diveDir = new THREE.Vector3();
      let diveType = 'FORWARD';

      if (keyS && !keyW) {
        diveType = 'BACKWARD';
        diveDir.copy(camForward).negate();
        if (keyA) diveDir.addScaledVector(camRight, -0.6).normalize();
        if (keyD) diveDir.addScaledVector(camRight, 0.6).normalize();
      } else if (keyA && !keyW && !keyD) {
        diveType = 'LEFT';
        diveDir.copy(camRight).negate();
      } else if (keyD && !keyW && !keyA) {
        diveType = 'RIGHT';
        diveDir.copy(camRight);
      } else {
        diveType = 'FORWARD';
        diveDir.copy(camForward);
        if (keyA) diveDir.addScaledVector(camRight, -0.6).normalize();
        if (keyD) diveDir.addScaledVector(camRight, 0.6).normalize();
      }

      this.isShootdodging = true;
      this.shootdodgeDuration = 1.65;
      this.shootdodgeTimer = this.shootdodgeDuration;
      this.shootdodgeDir.copy(diveDir.normalize());
      this.shootdodgeType = diveType;

      this.velocityY = 0; // Managed ballistically
      this.isGrounded = false;
      this.timeScale = 0.20; // Deep cinematic bullet-time!
      if (this.weaponLocation === 'HAND') {
        this.setWeaponLocation('HAND'); // Keep rifle in hand for mid-air slow-mo firing!
      }
      if (window.soundEngine && window.soundEngine.playSlowMo) window.soundEngine.playSlowMo(true);
    }
    if (!altDown) this._altConsumed = false;

    // Side Wall Run Execution with Real-Time Wall Length Tracking
    if (this.isWallRunning) {
      this.wallRunTimer -= delta;
      this.velocityY = 0;
      this.position.y = 1.35 + Math.sin(this.wallRunTimer * 12) * 0.04;

      // Real-time check: If player runs past the wall's physical end, drop off immediately!
      if (environment && environment.isStillOnWall && this.activeWallObs) {
        const stillOnWall = environment.isStillOnWall(this.position, this.activeWallObs, 0.85);
        if (!stillOnWall) {
          // Wall ended! Step off cleanly into air
          this.isWallRunning = false;
          this.velocityY = 1.5;
          this.activeWallObs = null;
          this.setWeaponLocation(this.userWeaponPreference);
        }
      }

      // Tap space during wall run to kick off wall in acrobatic leap
      if (input.keys['Space'] && !this._spaceConsumed) {
        this._spaceConsumed = true;
        this.isWallRunning = false;
        this.velocityY = 4.8;
        const pushAway = new THREE.Vector3(-this.wallRunDir.z, 0, this.wallRunDir.x);
        if (this.wallRunSide === 'LEFT') pushAway.negate();
        this.velocity.copy(this.wallRunDir).multiplyScalar(5.0).addScaledVector(pushAway, 4.0);
        this.activeWallObs = null;
        this.setWeaponLocation(this.userWeaponPreference);
      }

      if (this.wallRunTimer <= 0) {
        this.isWallRunning = false;
        this.activeWallObs = null;
        this.setWeaponLocation(this.userWeaponPreference);
      }
    }

    // Front Wall Run & Backflip Execution
    if (this.isWallBackflipping) {
      this.wallFlipTimer -= delta;
      const progress = 1.0 - (this.wallFlipTimer / this.wallFlipDuration);

      if (progress < 0.36) {
        this.position.y += 4.5 * delta;
        this.velocity.set(0, 0, 0);
      } else if (progress < 0.78) {
        this.velocity.copy(this.wallNormal).multiplyScalar(6.0);
      }

      if (this.wallFlipTimer <= 0) {
        this.isWallBackflipping = false;
        this.setWeaponLocation(this.userWeaponPreference);
      }
    }

    // Max Payne Shootdodge Dive Execution (Snappy horizontal dash leap, pavement slide, and push-up recovery)
    if (this.isShootdodging) {
      this.shootdodgeTimer -= delta / (this.timeScale || 1.0);
      const progress = 1.0 - (this.shootdodgeTimer / this.shootdodgeDuration);

      if (progress < 0.45) {
        // Snappy horizontal dash dive: low aggressive ballistic arc (apex 0.85m!)
        const airP = progress / 0.45;
        this.position.y = this.currentGroundY + Math.sin(airP * Math.PI) * 0.85;
        this.velocityY = 0;
        this.isGrounded = false;
      } else {
        // Touchdown on pavement: sliding on pavement, then pushing up to stand!
        this.position.y = this.currentGroundY;
        this.velocityY = 0;
        this.isGrounded = true;
      }

      if (this.shootdodgeTimer <= 0) {
        this.isShootdodging = false;
        this.timeScale = 1.0;
        this.setWeaponLocation(this.userWeaponPreference);
        if (window.soundEngine && window.soundEngine.playSlowMo) window.soundEngine.playSlowMo(false);
      }
    }

    // 3. Directional Martial Arts Kick & Flying Dropkick (K or F)
    const kickKeyDown = input.keys['KeyK'] || input.keys['KeyF'];
    if (kickKeyDown && !this._kickConsumed && !fullBodyStuntActive && !this.isShootdodging) {
      this._kickConsumed = true;
      const movingAny = isMoving;

      if (movingAny) {
        // [Martial Arts]: DIRECTIONAL FLYING DROPKICK LEAP!
        this.isDropkicking = true;
        this.dropkickTimer = this.dropkickDuration;
        this.dropkickDir.copy(moveDir);

        this.dropkickType = 'FORWARD';
        this.mesh.rotation.y = Math.atan2(this.dropkickDir.x, this.dropkickDir.z);

        this.velocityY = 5.6; // High airborne leap!
        this.isGrounded = false;
        this.setWeaponLocation('BACK');
        if (window.soundEngine && window.soundEngine.playFlyingDropkick) window.soundEngine.playFlyingDropkick();
      } else {
        // [Martial Arts]: 2-HIT MARTIAL KICK COMBO (Stationary K: Hit 1 = Snap Kick, Hit 2 = Action Hero High Neck Roundhouse)
        this.isKicking = true;
        this.kickCombo = (this.kickCombo + 1) % 2;
        this.kickDuration = this.kickCombo === 0 ? 0.48 : 0.75;
        this.kickTimer = this.kickDuration;
        this.setWeaponLocation('BACK');
        if (window.soundEngine && window.soundEngine.playKick) window.soundEngine.playKick();
      }
    }
    if (!kickKeyDown) this._kickConsumed = false;

    if (this.isDropkicking) {
      this.dropkickTimer -= delta;
      const kickP = 1.0 - (this.dropkickTimer / this.dropkickDuration);
      if (kickP < 0.75) {
        // High airborne flying side kick leap (Image 4)
        const airT = kickP / 0.75;
        this.position.y = this.currentGroundY + Math.sin(airT * Math.PI) * 1.65;
        this.velocityY = 0;
        this.isGrounded = false;
      } else {
        // Smooth landing onto feet
        this.position.y = this.currentGroundY;
        this.velocityY = 0;
        this.isGrounded = true;
      }

      if (this.dropkickTimer <= 0) {
        this.isDropkicking = false;
        this.setWeaponLocation(this.userWeaponPreference);
      }
    }

    if (this.isKicking) {
      this.kickTimer -= delta;
      if (this.kickTimer <= 0) {
        this.isKicking = false;
        this.setWeaponLocation(this.userWeaponPreference);
      }
    }

    // Idle Timer: resets immediately on any active player input or movement
    const hasActiveInput = isMoving || input.mouseLeftHeld || input.mouseRightHeld ||
                           input.keys['KeyW'] || input.keys['KeyA'] || input.keys['KeyS'] || input.keys['KeyD'] ||
                           input.keys['Space'] || input.keys['KeyC'] || input.keys['KeyK'] || input.keys['KeyF'] ||
                           input.keys['KeyQ'] || input.keys['KeyE'] || this.isShootdodging || fullBodyStuntActive || this.isPunching;
    if (hasActiveInput) {
      this.idleTimer = 0.0;
    } else {
      this.idleTimer += delta;
    }

    // Platform Landing Height
    const targetGround = environment ? environment.getGroundHeightAt(this.position.x, this.position.z, this.radius) : 0;
    this.currentGroundY = targetGround;

    // Gravity & Ground Snapping (Disabled during Shootdodge, Wall Runs, and Flying Dropkick to prevent premature landing aborts!)
    if (!this.isWallRunning && !this.isShootdodging && !this.isDropkicking && (!this.isWallBackflipping || (1.0 - (this.wallFlipTimer / this.wallFlipDuration)) >= 0.36)) {
      if (!this.isGrounded || this.position.y > this.currentGroundY) {
        this.velocityY -= this.gravity * delta;
        this.position.y += this.velocityY * delta;

        if (this.position.y <= this.currentGroundY) {
          this.position.y = this.currentGroundY;
          this.velocityY = 0;
          if (!this.isGrounded) {
            if (window.soundEngine && window.soundEngine.playLand) window.soundEngine.playLand();
          }
          this.isGrounded = true;
        }
      }
    }

    // Target Velocities
    let targetVelX = 0;
    let targetVelZ = 0;

    if (this.isWallRunning) {
      targetVelX = this.wallRunDir.x * 6.8;
      targetVelZ = this.wallRunDir.z * 6.8;
    } else if (this.isWallBackflipping) {
      const p = 1.0 - (this.wallFlipTimer / this.wallFlipDuration);
      if (p >= 0.36) {
        targetVelX = this.velocity.x;
        targetVelZ = this.velocity.z;
      }
    } else if (this.isDropkicking) {
      targetVelX = this.dropkickDir.x * 8.2;
      targetVelZ = this.dropkickDir.z * 8.2;
    } else if (this.isRolling) {
      targetVelX = this.rollDir.x * 6.5;
      targetVelZ = this.rollDir.z * 6.5;
    } else if (this.isShootdodging) {
      const progress = 1.0 - (this.shootdodgeTimer / this.shootdodgeDuration);
      let diveSpeed = 18.5; // Long, heroic Max Payne 3 leap distance!
      if (progress >= 0.45 && progress < 0.78) {
        // Sliding along pavement - decelerating smoothly from friction
        const slideT = (progress - 0.45) / 0.33;
        diveSpeed = 18.5 * (1.0 - slideT * 0.82);
      } else if (progress >= 0.78) {
        // Pushing up and standing - stationary
        diveSpeed = 0;
      }
      targetVelX = this.shootdodgeDir.x * diveSpeed;
      targetVelZ = this.shootdodgeDir.z * diveSpeed;
    } else if (isMoving) {
      let speed = this.walkSpeed;
      if (this.isCrouching) speed = this.walkSpeed * 0.58;
      else if (this.isSprinting) speed = this.sprintSpeed;
      else if (this.isAiming) speed = this.adsSpeed;
      targetVelX = moveDir.x * speed;
      targetVelZ = moveDir.z * speed;
    }

    // Velocity Interpolation
    const accelRate = isMoving || fullBodyStuntActive || this.isShootdodging ? this.acceleration : this.friction;
    this.velocity.x += (targetVelX - this.velocity.x) * Math.min(1, accelRate * delta);
    this.velocity.z += (targetVelZ - this.velocity.z) * Math.min(1, accelRate * delta);

    // Movement Position Integration with Sub-Stepping (Prevents Tunneling & Trapping at any FPS)
    const steps = (this.isShootdodging || fullBodyStuntActive) ? 3 : 2;
    const subDelta = delta / steps;
    for (let s = 0; s < steps; s++) {
      this.position.x += this.velocity.x * subDelta;
      this.position.z += this.velocity.z * subDelta;

      // Continuous Collision Resolution with Wall Sliding & Depenetration
      // Guarantees player glides smoothly along walls and NEVER gets stuck or penetrates obstacles!
      if (environment && environment.resolveCollisions) {
        environment.resolveCollisions(this.position, this.velocity, this.radius, this.position.y, this.isWallRunning ? this.activeWallObs : null);
      }
    }

    this.mesh.position.copy(this.position);
    // Hit flinch: brief backward lean when damaged (set by playHitReaction).
    // rotation.x is free here (only rotation.y is driven elsewhere), and it
    // decays to 0 so the model never stays tilted.
    if (this.hitFlinchT > 0) {
      this.hitFlinchT -= delta;
      this.mesh.rotation.x = -0.18 * Math.max(0, this.hitFlinchT / 0.25);
      if (this.hitFlinchT <= 0) this.mesh.rotation.x = 0;
    }
    // (Blob shadow decal removed — the moonlight shadow map is the shadow now.)

    // Footstep Foley
    if (isMoving && this.isGrounded && !fullBodyStuntActive && !this.isShootdodging) {
      this.footstepTimer += delta;
      const interval = this.isSprinting ? 0.30 : 0.52;
      if (this.footstepTimer >= interval) {
        this.footstepTimer = 0;
        if (window.soundEngine && window.soundEngine.playFootstep) window.soundEngine.playFootstep(this.isSprinting);
      }
    } else {
      this.footstepTimer = 0;
    }

    // Update Status Badge
    if (this.isWallBackflipping) this.moveState = 'WALL RUN BACKFLIP';
    else if (this.isWallRunning) this.moveState = `SIDE WALL RUN (${this.wallRunSide})`;
    else if (this.isDropkicking) this.moveState = 'FLYING DROPKICK';
    else if (this.isKicking) this.moveState = 'MARTIAL SNAP KICK';
    else if (this.isShootdodging) this.moveState = `SHOOTDODGE (${this.shootdodgeType})`;
    else if (this.isRolling) this.moveState = 'CROUCH ROLL';
    else if (this.isPunching) this.moveState = `BOXING (${this.punchCombo === 0 ? 'LEFT JAB' : this.punchCombo === 1 ? 'RIGHT CROSS' : 'LEFT HOOK'})`;
    else if (!this.isGrounded) this.moveState = 'AIRBORNE';
    else if (this.isCrouching) this.moveState = isMoving ? 'CROUCH WALKING' : 'CROUCHING';
    else if (this.isSprinting) this.moveState = 'SPRINTING';
    else if (isMoving) this.moveState = 'WALKING';
    else if (this.idleTimer >= 5.0) this.moveState = 'TACTICAL IDLE SCAN';
    else if (this.weaponLocation === 'BACK') this.moveState = this.boxingCombatTimer > 0 ? 'BOXING GUARD (UNARMED)' : 'UNARMED (RELAXED)';
    else this.moveState = 'COMBAT READY';
  }

  handleAiming(delta, input) {
    this.isAiming = Boolean(input && input.mouseRightHeld && !this.isSprinting);
    const isFiring = Boolean(input && (input.mouseLeftHeld || this.isAiming));

    if (this.cameraMode === 'TOP_DOWN') {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(input.mouseNDC, this.camera);
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.position.y);
      const hitPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(groundPlane, hitPoint);
      if (hitPoint) this.aimTarget.copy(hitPoint);

      const dx = this.aimTarget.x - this.position.x;
      const dz = this.aimTarget.z - this.position.z;
      this.aimAngle = Math.atan2(dx, dz);

      const stuntsActive = this.isRolling || this.isDropkicking || this.isWallRunning || this.isWallBackflipping;
      if (this.isShootdodging) {
        this.mesh.rotation.y = this.aimAngle;
      } else if (this.isWallRunning) {
        this.mesh.rotation.y = Math.atan2(this.wallRunDir.x, this.wallRunDir.z);
      } else if (this.isDropkicking) {
        this.mesh.rotation.y = Math.atan2(this.dropkickDir.x, this.dropkickDir.z);
      } else if (this.isRolling) {
        this.mesh.rotation.y = Math.atan2(this.rollDir.x, this.rollDir.z);
      } else if (!stuntsActive) {
        if (isFiring || this.isAiming) {
          // In combat / firing: snap to cursor aim angle
          this.mesh.rotation.y = this.aimAngle;
        } else if (this.isMoving) {
          // Free roam top-down movement: smoothly turn character into WASD movement direction!
          const targetMoveAngle = Math.atan2(this.moveDir.x, this.moveDir.z);
          const diff = THREE.MathUtils.euclideanModulo(targetMoveAngle - this.mesh.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
          this.mesh.rotation.y += diff * Math.min(1, 14.0 * delta);
        }
      }
    } else {
      // 3rd Person GTA & 1st Person FPS Modes:
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      camDir.y = 0;
      camDir.normalize();

      const camAimAngle = Math.atan2(camDir.x, camDir.z);
      this.aimAngle = camAimAngle;

      const fullCamDir = new THREE.Vector3();
      this.camera.getWorldDirection(fullCamDir);
      this.aimTarget.copy(this.camera.position).add(fullCamDir.multiplyScalar(40));

      const stuntsActive = this.isRolling || this.isDropkicking || this.isWallRunning || this.isWallBackflipping;
      if (this.isShootdodging) {
        // Keep torso and weapon dynamically locked onto crosshair / target (Max Payne 3 style!)
        this.mesh.rotation.y = camAimAngle;
      } else if (this.isWallRunning) {
        // Body faces forward along wall tangent sprint!
        this.mesh.rotation.y = Math.atan2(this.wallRunDir.x, this.wallRunDir.z);
      } else if (this.isDropkicking) {
        // Body faces forward along flying kick leap trajectory!
        this.mesh.rotation.y = Math.atan2(this.dropkickDir.x, this.dropkickDir.z);
      } else if (this.isRolling) {
        // Body faces rolling direction!
        this.mesh.rotation.y = Math.atan2(this.rollDir.x, this.rollDir.z);
      } else if (!stuntsActive) {
        if (isFiring || this.isAiming) {
          // COMBAT STRAFE MODE (Holding Right-Click ADS or Left-Click Fire):
          // Body locks to camera/crosshair direction, enabling clean, fluid WASD tactical strafing!
          this.mesh.rotation.y = camAimAngle;
        } else if (this.isMoving) {
          // GTA V / UNCHARTED FREE-ROAM MOVEMENT MODE (Jogging with rifle held):
          // Player smoothly turns into the direction of travel!
          // Pressing A turns left, D turns right, S turns toward camera, W turns forward!
          const targetMoveAngle = Math.atan2(this.moveDir.x, this.moveDir.z);
          const diff = THREE.MathUtils.euclideanModulo(targetMoveAngle - this.mesh.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
          this.mesh.rotation.y += diff * Math.min(1, 14.0 * delta);
        } else {
          // NOT moving, NOT firing: face the camera / crosshair direction.
          // So when the player drags to look around, Leon turns with the
          // camera and the gun points where the cursor points (PUBG-style),
          // instead of the gun and the cursor pointing different ways.
          const diff = THREE.MathUtils.euclideanModulo(camAimAngle - this.mesh.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
          this.mesh.rotation.y += diff * Math.min(1, 10.0 * delta);
        }
      }
    }
  }

  updateLaserSight() {
    if (!this.laserLine || !this.laserDot) return;

    // Laser sight is only active when rifle is in hand!
    if (this.weaponLocation === 'BACK' || this.isHolstering) {
      this.laserLine.visible = false;
      this.laserDot.visible = false;
      return;
    }

    this.laserLine.visible = true;
    this.laserDot.visible = true;

    const muzzleWorld = this.getActiveMuzzleWorldPos();
    let endPoint;

    const isFiringOrAiming = this.isAiming || (this.fireTimer > 0) || (window.input && window.input.mouseLeftHeld);

    if (isFiringOrAiming) {
      // When aiming or firing: laser points directly towards crosshair target!
      endPoint = this.aimTarget.clone();
    } else {
      // When free-roaming: laser shoots straight forward along the rifle's barrel!
      const gunForward = new THREE.Vector3(0, 0, 1);
      if (this.tpRifle) {
        gunForward.applyQuaternion(this.tpRifle.getWorldQuaternion(new THREE.Quaternion()));
      } else {
        gunForward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
      }
      endPoint = muzzleWorld.clone().addScaledVector(gunForward, 35.0);
    }

    const positions = this.laserLine.geometry.attributes.position.array;
    positions[0] = muzzleWorld.x;
    positions[1] = muzzleWorld.y;
    positions[2] = muzzleWorld.z;
    positions[3] = endPoint.x;
    positions[4] = endPoint.y;
    positions[5] = endPoint.z;
    this.laserLine.geometry.attributes.position.needsUpdate = true;

    this.laserDot.position.copy(endPoint);
  }

  getActiveMuzzleWorldPos() {
    const isFirstPerson = this.cameraMode === 'FIRST_PERSON';
    const muzzle = isFirstPerson ? this.fpMuzzlePoint : this.tpMuzzlePoint;
    const worldPos = new THREE.Vector3();
    if (muzzle) muzzle.getWorldPosition(worldPos);
    else worldPos.copy(this.position).add(new THREE.Vector3(0, 1.2, 0));
    return worldPos;
  }

  handleWeapon(delta, input) {
    if (this.fireTimer > 0) this.fireTimer -= delta;

    // Recoil recovery spring
    this.recoilOffset *= Math.exp(-24.0 * delta);
    this.recoilRot *= Math.exp(-20.0 * delta);

    if (this.weaponLocation === 'BACK') {
      // UNARMED MODE: Left-Click or E triggers GTA-style punches with both hands!
      const canPunch = !this.isRolling && !this.isKicking && !this.isDropkicking && !this.isWallRunning && !this.isWallBackflipping && !this.isShootdodging;
      const punchTrigger = (input.mouseLeftHeld || input.keys['KeyE']) && canPunch;

      if (punchTrigger && !this.isPunching) {
        this.isPunching = true;
        this.punchCombo = (this.punchCombo + 1) % 3; // 0 = Left Jab, 1 = Right Cross, 2 = Left Hook
        const comboDurations = [0.38, 0.44, 0.46];
        this.punchDuration = comboDurations[this.punchCombo];
        this.punchTimer = this.punchDuration;
        this.idleTimer = 0.0;
        this.boxingCombatTimer = 5.0; // Maintain boxing stance for 5 seconds

        if (window.soundEngine && window.soundEngine.playPunch) {
          window.soundEngine.playPunch();
        }

        this.performMeleeAttack();
      }
      return;
    } else {
      // ARMED MODE: Pressing E directly transitions to melee punch!
      const canQuickPunch = !this.isRolling && !this.isKicking && !this.isDropkicking && !this.isWallRunning && !this.isWallBackflipping && !this.isShootdodging;
      if (input.keys['KeyE'] && !this._eConsumed && canQuickPunch) {
        this._eConsumed = true;
        this.userWeaponPreference = 'BACK';
        this.setWeaponLocation('BACK');
        this.isPunching = true;
        this.punchCombo = (this.punchCombo + 1) % 3;
        const comboDurations = [0.38, 0.44, 0.46];
        this.punchDuration = comboDurations[this.punchCombo];
        this.punchTimer = this.punchDuration;
        this.idleTimer = 0.0;
        this.boxingCombatTimer = 5.0; // Maintain boxing stance for 5 seconds

        if (window.soundEngine && window.soundEngine.playPunch) {
          window.soundEngine.playPunch();
        }

        this.performMeleeAttack();
        if (window.game && window.game.notify) {
          window.game.notify('MELEE BOXING READY // E OR L-CLICK TO PUNCH');
        }
        return;
      }
      if (!input.keys['KeyE']) this._eConsumed = false;
    }

    // ARMED MODE: M4A1 Tactical Rifle Handling
    if (input.keys['KeyR'] && !this.isReloading && this.ammoClip < this.maxClip && this.ammoReserve > 0) {
      this.startReload();
    }

    // Firing enabled in normal stance OR mid-air during Max Payne shootdodge dive!
    const canFireStuntState = !this.isRolling && !this.isKicking && !this.isDropkicking && !this.isWallRunning && !this.isWallBackflipping;
    if (input.mouseLeftHeld && this.fireTimer <= 0 && !this.isReloading && canFireStuntState) {
      if (this.ammoClip > 0) {
        this.fire();
      } else {
        this.startReload();
      }
    }
  }

  performMeleeAttack() {
    if (!window.game || !window.game.zombies) return;
    const forward = new THREE.Vector3();
    this.mesh.getWorldDirection(forward);

    for (const zombie of window.game.zombies) {
      if (!zombie.alive) continue;
      const toZombie = new THREE.Vector3().subVectors(zombie.position, this.position);
      const dist = toZombie.length();
      if (dist <= 1.9) {
        toZombie.normalize();
        if (forward.dot(toZombie) > 0.35) {
          zombie.takeDamage(45);
          if (zombie.mesh) {
            zombie.position.addScaledVector(forward, 0.45);
          }
        }
      }
    }
  }

  animatePunch() {
    const progress = THREE.MathUtils.clamp(1.0 - (this.punchTimer / this.punchDuration), 0, 1);
    const t = Math.sin(progress * Math.PI);
    this.setFingersClenched(true);

    if (this.punchCombo === 0) {
      // COMBO 0: PROFESSIONAL BOXER LEAD JAB
      // Torso remains solid, compact, and aligned with orthodox boxing stance (zero wild torso rotation)
      this.hips.rotation.y = -0.32 + 0.05 * t;
      this.spine.rotation.set(0.04, -0.18, 0);
      this.chest.rotation.set(0, 0, 0);
      this.head.rotation.set(0.06, 0.16, 0);

      this.leftThigh.rotation.set(-0.16 - 0.06 * t, 0.05, -0.06);
      this.leftKnee.rotation.set(0.24 + 0.10 * t, 0, 0);
      this.rightKnee.rotation.set(0.28, 0, 0);
      this.rightAnkle.rotation.set(-0.16 + 0.06 * t, 0, 0);

      // Left arm fires dead straight forward from high chin guard:
      this.leftShoulder.rotation.set(-1.57, 0.06, 0.0);
      this.leftElbow.rotation.set(-1.65 * (1.0 - t), 0, 0);
      this.leftWrist.rotation.set(0, -0.75 * t, 0); // Quick corkscrew snap

      // Right arm: glued to right cheek/jaw in high boxing shield
      this.rightShoulder.rotation.set(-1.25, -0.20, 0.25);
      this.rightElbow.rotation.set(-1.95, 0.20, 0);
      this.rightWrist.rotation.set(0.18, 0.20, 0);

    } else if (this.punchCombo === 1) {
      // COMBO 1: PROFESSIONAL POWER CROSS
      // Compact kinetic rear hip pivot drives fist straight down centerline without wild torso spinning
      this.hips.rotation.y = -0.32 + 0.22 * t;
      this.spine.rotation.set(0.04, -0.18 + 0.10 * t, 0);
      this.chest.rotation.set(0, 0, 0);
      this.head.rotation.set(0.06, 0.16 - 0.10 * t, 0); // Head locked dead straight on opponent

      this.rightAnkle.rotation.set(0.18 * t, 0, 0); // Pivots on ball of rear right foot
      this.rightThigh.rotation.set(0.12 - 0.10 * t, -0.12, 0.08);
      this.rightKnee.rotation.set(0.28 + 0.12 * t, 0, 0);
      this.leftKnee.rotation.set(0.24, 0, 0);

      // Right fist shoots straight forward like an iron piston:
      this.rightShoulder.rotation.set(-1.57, -0.06, 0.0);
      this.rightElbow.rotation.set(-1.75 * (1.0 - t), 0, 0);
      this.rightWrist.rotation.set(0, 0.75 * t, 0); // Corkscrew snap

      // Left arm: tight guard at left jaw/temple
      this.leftShoulder.rotation.set(-1.25, 0.20, -0.25);
      this.leftElbow.rotation.set(-1.95, -0.20, 0);
      this.leftWrist.rotation.set(0.18, -0.20, 0);

    } else {
      // COMBO 2: CRISP LEAD HOOK
      // Compact core turn with locked 90° elbow whipping across jaw
      this.hips.rotation.y = -0.32 - 0.10 * t;
      this.spine.rotation.set(0.04, -0.18 - 0.06 * t, 0);
      this.chest.rotation.set(0, 0, 0);
      this.head.rotation.set(0.06, 0.16 + 0.06 * t, 0);

      this.leftAnkle.rotation.set(0.15 * t, 0, 0);
      this.leftKnee.rotation.set(0.24 + 0.10 * t, 0, 0);
      this.rightKnee.rotation.set(0.28, 0, 0);

      // Left arm horizontal hook with locked 90° elbow:
      this.leftShoulder.rotation.set(-1.55, 0.15 + 0.50 * t, 0);
      this.leftElbow.rotation.set(-1.57, 0, 0);
      this.leftWrist.rotation.set(0.15, -0.30, 0.30 * t);

      // Right arm: solid shield at right temple & jaw
      this.rightShoulder.rotation.set(-1.25, -0.20, 0.25);
      this.rightElbow.rotation.set(-1.95, 0.20, 0);
      this.rightWrist.rotation.set(0.18, 0.20, 0);
    }
  }

  // Authentic PUBG / GTA Over-the-Shoulder Rifle Slinging & Drawing Animation
  animateHolster(delta) {
    this.holsterTimer -= delta;
    const progress = THREE.MathUtils.clamp(1.0 - (this.holsterTimer / this.holsterDuration), 0, 1);

    if (this.holsterAction === 'HOLSTER') {
      // Transition from HAND to BACK
      if (progress < 0.5) {
        // Phase 1: Right hand lifts rifle up and reaches over right shoulder towards back plate
        const t = progress / 0.5;
        this.rightShoulder.rotation.set(-0.50 - 1.35 * t, -0.40 + 0.20 * t, -0.10 + 0.55 * t);
        this.rightElbow.rotation.set(-1.60 - 0.35 * t, 0.50 - 0.20 * t, 0);
        this.rightWrist.rotation.set(0.20, 0.20 * t, 0);

        // Left arm releases rifle handguard and moves naturally down into ready guard
        this.leftShoulder.rotation.set(-1.30 + 0.70 * t, 0.75 - 0.50 * t, 0.20 - 0.40 * t);
        this.leftElbow.rotation.set(-0.70 - 0.50 * t, -0.50 + 0.30 * t, 0);
        this.leftWrist.rotation.set(0.20, 0, 0);
      } else {
        // At midway point: swap weapon socket to BACK plate
        if (!this.holsterSwapped) {
          this.holsterSwapped = true;
          this.setWeaponLocation('BACK');
          if (window.soundEngine && window.soundEngine.playWeaponSling) window.soundEngine.playWeaponSling();
        }
        // Phase 2: Right hand finishes slinging rifle on back, pulls forward into boxing guard
        const t = (progress - 0.5) / 0.5;
        this.rightShoulder.rotation.set(-1.85 + 0.70 * t, -0.20 - 0.02 * t, 0.45 - 0.13 * t);
        this.rightElbow.rotation.set(-1.95 + 0.13 * t, 0.30 - 0.02 * t, 0);
        this.rightWrist.rotation.set(0.20 - 0.05 * t, 0.20, 0);

        this.leftShoulder.rotation.set(-0.60 - 0.65 * t, 0.25 - 0.03 * t, -0.20 - 0.12 * t);
        this.leftElbow.rotation.set(-1.20 - 0.42 * t, -0.20 - 0.08 * t, 0);
        this.leftWrist.rotation.set(0.20 - 0.05 * t, -0.20, 0);
      }
    } else {
      // Transition from BACK to HAND (Drawing rifle into front two-handed firing grip)
      if (progress < 0.5) {
        // Phase 1: Right hand reaches up and over shoulder to grab slung rifle from back plate
        const t = progress / 0.5;
        this.rightShoulder.rotation.set(-1.15 - 0.70 * t, -0.22 + 0.02 * t, 0.32 + 0.13 * t);
        this.rightElbow.rotation.set(-1.82 - 0.13 * t, 0.28 + 0.02 * t, 0);
        this.rightWrist.rotation.set(0.15 + 0.05 * t, 0.20, 0);

        this.leftShoulder.rotation.set(-1.25 + 0.65 * t, 0.22 + 0.03 * t, -0.32 + 0.12 * t);
        this.leftElbow.rotation.set(-1.62 + 0.42 * t, -0.28 + 0.08 * t, 0);
        this.leftWrist.rotation.set(0.15 + 0.05 * t, -0.20, 0);
      } else {
        // At midway point: swap weapon socket to HAND
        if (!this.holsterSwapped) {
          this.holsterSwapped = true;
          this.setWeaponLocation('HAND');
          if (window.soundEngine && window.soundEngine.playWeaponSling) window.soundEngine.playWeaponSling();
        }
        // Phase 2: Right hand swings rifle forward into two-handed front stance, left hand catches handguard
        const t = (progress - 0.5) / 0.5;
        this.rightShoulder.rotation.set(-1.85 + 1.35 * t, -0.20 - 0.20 * t, 0.45 - 0.55 * t);
        this.rightElbow.rotation.set(-1.95 + 0.35 * t, 0.30 + 0.20 * t, 0);
        this.rightWrist.rotation.set(0.20, -0.20 * t, 0);

        this.leftShoulder.rotation.set(-0.60 - 0.70 * t, 0.25 + 0.50 * t, -0.20 + 0.40 * t);
        this.leftElbow.rotation.set(-1.20 + 0.50 * t, -0.20 - 0.30 * t, 0);
        this.leftWrist.rotation.set(0.15 + 0.05 * t, -0.25 * t, 0.15 * t);
      }
    }

    if (this.holsterTimer <= 0) {
      this.isHolstering = false;
      this.setWeaponLocation(this.userWeaponPreference);
    }
  }

  fire() {
    this.ammoClip--;
    this.fireTimer = this.fireRate;

    // HITSCAN (fps-shooter skill: camera finds the aim point, then the bullet
    // travels muzzle -> aim point, so cover in front of the gun still blocks).
    // HIT RAY FIX: the hit-detection ray is cast from the CAMERA (what the
    // crosshair is on), not the muzzle. The muzzle sits ~1.4m high, lower
    // than the camera, so when aiming down at a close zombie's legs/shoes
    // the muzzle ray dipped below ground level and hit the DIRT just
    // before the zombie — the ground (a shootable) won the nearest-hit
    // race and the zombie took no damage at all. The camera ray is the
    // line the player is actually aiming along, so whatever pixel the
    // crosshair sits on is what gets hit. The visible tracer still
    // originates at the muzzle (spawnTracer), so the shot still looks
    // like it came from the gun.
    let hitDist = null;
    const muzzle = this.getActiveMuzzleWorldPos();
    if (muzzle && this.aimTarget) {
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      this._shotRaycaster.set(this.camera.position, camDir);
      {
        const targets = [];
        if (window.game && window.game.zombieManager) {
          targets.push(...window.game.zombieManager.getZombieMeshes());
        }
        if (window.game && window.game.environment && window.game.environment.shootables) {
          targets.push(...window.game.environment.shootables);
        }
        const hits = this._shotRaycaster.intersectObjects(targets, false);
        if (hits.length > 0) {
          const h = hits[0];
          hitDist = h.distance;
          const zb = h.object.userData ? h.object.userData.zombie : null;
          if (zb && zb.alive) {
            // Headshot: hit point above the zombie's shoulders (~1.5m up) = 2x damage
            const headshot = h.point.y > zb.scene.position.y + 1.5;
            // Leg hit: hit point below hip height (~0.9m) damages the legs too
            // (cripple system: enough leg damage -> stumble, then crawl).
            // A leg shot does only 25% BODY damage (you hit a leg, not the
            // chest) but FULL leg damage, so the zombie survives long enough
            // to be crippled instead of just dying from the body damage —
            // otherwise the wave-2/3 crawl thresholds (60%/90%) could never
            // be reached before the body HP ran out.
            const legHit = h.point.y < zb.scene.position.y + 0.9;
            const dmg = headshot ? 68 : 34;
            const bodyDmg = (legHit && !headshot) ? Math.round(dmg * 0.25) : dmg;
            zb.takeDamage(bodyDmg, legHit, dmg);
            if (window.showHitMarker) window.showHitMarker(headshot, zb.hp <= 0);
            if (window.soundEngine && window.soundEngine.playHit) window.soundEngine.playHit(headshot);
            this.spawnImpactSparks(h.point, 0xffcc44);
          } else {
            // Hit the environment: impact sparks where the bullet struck
            this.spawnImpactSparks(h.point, 0xffdd88);
          }
        }
      }
    }
    // Tracer dies exactly at the hit point (or at the aim point if nothing was hit)
    this._lastHitDist = hitDist;

    // Realistic weapon recoil kick
    this.recoilOffset = 0.085;
    this.recoilRot = 0.22;

    // Audio SFX
    if (window.soundEngine && window.soundEngine.playShoot) {
      window.soundEngine.playShoot();
    }

    // Trigger Visual Muzzle Flash & Point Light
    const isFirstPerson = this.cameraMode === 'FIRST_PERSON';
    const flash = isFirstPerson ? this.fpMuzzleFlash : this.tpMuzzleFlash;
    const light = isFirstPerson ? this.fpMuzzleLight : this.tpMuzzleLight;

    if (flash) {
      flash.visible = true;
      flash.rotation.z = Math.random() * Math.PI * 2;
      const s = 0.55 + Math.random() * 0.35;
      flash.scale.set(s, s, s);
    }
    if (light) light.intensity = 3.5;

    setTimeout(() => {
      if (flash) flash.visible = false;
      if (light) light.intensity = 0;
    }, 45);

    // Spawn 3D Tracer Ray & Physical Brass Casing
    this.spawnTracer();
    this.spawnBrassCasing();
  }

  spawnTracer() {
    const muzzle = this.getActiveMuzzleWorldPos();
    const dir = new THREE.Vector3().subVectors(this.aimTarget, muzzle);
    const aimLen = dir.length();
    if (aimLen < 0.01) return;
    dir.normalize();

    const tracerGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.75, 4);
    tracerGeo.rotateX(Math.PI / 2);
    const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe680 });
    const tracerMesh = new THREE.Mesh(tracerGeo, tracerMat);
    tracerMesh.userData.projectile = true;

    tracerMesh.position.copy(muzzle);
    tracerMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

    this.scene.add(tracerMesh);
    // Travel only to the hit point (or the aim point): life = distance / speed
    const travel = (this._lastHitDist !== null && this._lastHitDist !== undefined)
      ? Math.min(this._lastHitDist, aimLen) : aimLen;
    this.activeTracers.push({
      mesh: tracerMesh,
      velocity: dir.clone().multiplyScalar(140.0),
      life: Math.min(0.35, Math.max(0.02, travel / 140.0))
    });
  }

  // Small impact spark burst at a bullet hit point (tetrahedrons, gravity, fade)
  spawnImpactSparks(point, color) {
    for (let i = 0; i < 9; i++) {
      const geo = new THREE.TetrahedronGeometry(0.045);
      const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1 });
      const m = new THREE.Mesh(geo, mat);
      m.userData.projectile = true;
      m.position.copy(point);
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 3 + 1,
        (Math.random() - 0.5) * 4
      );
      this.scene.add(m);
      this.activeSparks.push({ mesh: m, velocity: v, life: 0.35 });
    }
  }

  spawnBrassCasing() {
    const muzzle = this.getActiveMuzzleWorldPos();

    const casingGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.04, 6);
    const casingMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.25, metalness: 0.95 });
    const casingMesh = new THREE.Mesh(casingGeo, casingMat);

    casingMesh.position.copy(muzzle);

    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.aimAngle);
    const vel = right.multiplyScalar(2.5 + Math.random() * 1.5);
    vel.y = 2.2 + Math.random() * 1.0;

    this.scene.add(casingMesh);
    this.activeCasings.push({
      mesh: casingMesh,
      velocity: vel,
      rotVel: new THREE.Vector3(Math.random() * 20, Math.random() * 20, Math.random() * 20),
      life: 1.2
    });
  }

  updateProjectilesAndCasings(delta) {
    for (let i = this.activeTracers.length - 1; i >= 0; i--) {
      const t = this.activeTracers[i];
      t.mesh.position.addScaledVector(t.velocity, delta);
      t.life -= delta;
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
        this.activeTracers.splice(i, 1);
      }
    }

    for (let i = this.activeSparks.length - 1; i >= 0; i--) {
      const sp = this.activeSparks[i];
      sp.velocity.y -= 12.0 * delta;
      sp.mesh.position.addScaledVector(sp.velocity, delta);
      sp.mesh.rotation.x += 9 * delta;
      sp.mesh.rotation.y += 7 * delta;
      sp.mesh.material.opacity = Math.max(0, sp.life / 0.35);
      sp.life -= delta;
      if (sp.life <= 0) {
        this.scene.remove(sp.mesh);
        sp.mesh.geometry.dispose();
        sp.mesh.material.dispose();
        this.activeSparks.splice(i, 1);
      }
    }

    for (let i = this.activeCasings.length - 1; i >= 0; i--) {
      const c = this.activeCasings[i];
      c.velocity.y -= 18.0 * delta;
      c.mesh.position.addScaledVector(c.velocity, delta);
      c.mesh.rotation.x += c.rotVel.x * delta;
      c.mesh.rotation.y += c.rotVel.y * delta;
      c.mesh.rotation.z += c.rotVel.z * delta;

      if (c.mesh.position.y <= this.currentGroundY + 0.02) {
        c.mesh.position.y = this.currentGroundY + 0.02;
        c.velocity.y *= -0.4;
        c.velocity.x *= 0.6;
        c.velocity.z *= 0.6;
        c.rotVel.multiplyScalar(0.5);
      }

      c.life -= delta;
      if (c.life <= 0) {
        this.scene.remove(c.mesh);
        c.mesh.geometry.dispose();
        c.mesh.material.dispose();
        this.activeCasings.splice(i, 1);
      }
    }
  }

  startReload() {
    this.isReloading = true;
    if (window.soundEngine && window.soundEngine.playReload) window.soundEngine.playReload();
    const ammoEl = document.getElementById('ammo-clip');
    if (ammoEl) ammoEl.textContent = '--';

    setTimeout(() => {
      const needed = this.maxClip - this.ammoClip;
      const transfer = Math.min(needed, this.ammoReserve);
      this.ammoClip += transfer;
      this.ammoReserve -= transfer;
      this.isReloading = false;
    }, 1300);
  }

  // =========================================================================
  // MASTER PROCEDURAL KINEMATICS ENGINE
  // =========================================================================
  updateOperatorKinematics(delta, input) {
    if (!this.operatorGroup) return;

    this.breathTimer += delta;
    const speed = this.velocity.length();
    const isMoving = speed > 0.15;

    // Calculate aim pitch for upper body (Deadzone around horizon prevents gun pointing down in idle)
    let aimPitch = 0;
    const isFiringOrAiming = Boolean(input && (input.mouseLeftHeld || this.isAiming));
    if (isFiringOrAiming && this.aimTarget) {
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);
      // Only pitch weapon vertically if player actively looks noticeably downwards or upwards!
      // Deadzone between -0.15 and 0.12 keeps gun 100% horizontal forward in normal combat
      if (camDir.y < -0.15) {
        aimPitch = (camDir.y - (-0.15)) * 0.75;
      } else if (camDir.y > 0.12) {
        aimPitch = (camDir.y - 0.12) * 0.75;
      }
      aimPitch = THREE.MathUtils.clamp(aimPitch, -0.42, 0.42);
    }
    this.aimPitch = aimPitch;

    // When 3D Survivor rigged character is loaded, update via its dedicated native engine
    if (this.isSurvivorLoaded) {
      this.updateSurvivorKinematics(delta, isMoving, input, aimPitch);
      return;
    }

    // Reset base transformations
    this.operatorGroup.position.set(0, 0, 0);
    this.operatorGroup.rotation.set(0, 0, 0);

    // Punch Timer: cleanly decrement and end punch state (Fixes permanent stuck boxing bug!)
    if (this.isPunching) {
      this.punchTimer -= delta;
      if (this.punchTimer <= 0) {
        this.punchTimer = 0;
        this.isPunching = false;
      }
    }

    // Boxing Stance Timer: decrements 5-second combat guard after throwing punches
    if (this.boxingCombatTimer > 0) {
      this.boxingCombatTimer -= delta;
      if (this.boxingCombatTimer < 0) this.boxingCombatTimer = 0;
    }

    // Full-body stunts that override both upper and lower body
    if (this.isRolling) {
      this.animateRoll();
    } else if (this.isKicking) {
      this.animateKick();
    } else if (this.isDropkicking) {
      this.animateDropkick();
    } else if (this.isWallBackflipping) {
      this.animateWallBackflip();
    } else if (this.isWallRunning) {
      this.animateWallRun();
    } else if (this.isShootdodging) {
      this.animateShootdodge(aimPitch);
    } else {
      // 1. Lower Body Locomotion: Legs ALWAYS walk, sprint, jump, or stand (never freeze during punch/holster!)
      this.updateLowerBody(delta, isMoving);

      // 2. Upper Body Posture: Tactical breathing, spine flex, and head tracking horizon & crosshair
      const breath = Math.sin(this.breathTimer * 2.2) * 0.005;
      this.spine.position.set(0, 0.05 + breath, 0);
      this.spine.rotation.set((this.isSprinting ? 0.14 : 0.0) - THREE.MathUtils.clamp(aimPitch * 0.12, -0.12, 0.12), 0, 0);
      this.chest.rotation.set(-THREE.MathUtils.clamp(aimPitch * 0.18, -0.18, 0.18), 0, 0);
      this.head.rotation.set(-THREE.MathUtils.clamp(aimPitch * 0.30, -0.22, 0.22), 0, 0);

      // 3. Combat & Weapon Upper Body Handling
      if (this.isHolstering) {
        this.animateHolster(delta);
      } else if (this.isPunching) {
        this.animatePunch();
      } else {
        this.animateNormalLocomotion(delta, isMoving, aimPitch, input);
      }
    }

    // Ensure weapon location respects user preference when not performing a forced-back stunt or active holster animation
    const isStuntForcingBack = this.isRolling || this.isKicking || this.isDropkicking || this.isWallRunning || this.isWallBackflipping;
    if (!isStuntForcingBack && !this.isHolstering && this.weaponLocation !== this.userWeaponPreference) {
      this.setWeaponLocation(this.userWeaponPreference);
    }

    // Dynamic Level Weapon Alignment (PUBG / GTA V Professional Straight Weapon Stance)
    // Eliminates all compound arm roll/yaw tilt: locks rifle 100% straight forward level with crosshair!
    if (this.tpRifle && this.weaponLocation === 'HAND') {
      if (!this.isHolstering) {
        const chestWorldQuat = new THREE.Quaternion();
        this.chest.getWorldQuaternion(chestWorldQuat);
        const pitchQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -aimPitch);
        const targetWorldQuat = chestWorldQuat.clone().multiply(pitchQuat);
        const socketWorldQuat = new THREE.Quaternion();
        this.rightHandSocket.getWorldQuaternion(socketWorldQuat);
        this.tpRifle.quaternion.copy(socketWorldQuat.clone().invert().multiply(targetWorldQuat));
      }
      this.tpRifle.position.set(0, 0, 0.05 - this.recoilOffset * 0.45);
    }

    this.mesh.updateMatrixWorld(true);
  }

  // Authentic Lower Body Locomotion: Strides, Sprints, Tactical Airborne Jump, and Grounded Ready
  updateLowerBody(delta, isMoving) {
    if (this.isGrounded && isMoving) {
      const walkRate = this.isSprinting ? 13.5 : 8.2;
      this.walkTimer += delta * walkRate;

      const stride = Math.sin(this.walkTimer);
      const cosStride = Math.cos(this.walkTimer);
      const strideAmp = this.isSprinting ? 0.95 : 0.60;
      const kneeAmp = this.isSprinting ? 1.35 : 0.85;

      this.rightThigh.rotation.x = stride * strideAmp;
      this.leftThigh.rotation.x = -stride * strideAmp;

      this.rightKnee.rotation.x = Math.max(0, -stride * kneeAmp);
      this.leftKnee.rotation.x = Math.max(0, stride * kneeAmp);

      this.rightAnkle.rotation.x = stride * 0.22;
      this.leftAnkle.rotation.x = -stride * 0.22;

      this.hips.position.y = 0.95 + Math.abs(cosStride) * (this.isSprinting ? 0.035 : 0.018);
      this.hips.rotation.y = -stride * 0.07;
      this.hips.rotation.z = stride * 0.02;
    } else if (!this.isGrounded) {
      // Airborne Athletic Tactical Jump Pose (Space key)
      this.rightThigh.rotation.set(-0.75, 0, 0.08);
      this.leftThigh.rotation.set(-0.65, 0, -0.08);
      this.rightKnee.rotation.set(1.35, 0, 0);
      this.leftKnee.rotation.set(1.25, 0, 0);
      this.rightAnkle.rotation.set(-0.25, 0, 0);
      this.leftAnkle.rotation.set(-0.25, 0, 0);
      this.hips.position.y = 0.95;
      this.hips.rotation.set(0, 0, 0);
    } else {
      // Solid Grounded Ready Stance
      this.walkTimer = 0;
      if (this.weaponLocation === 'BACK') {
        // AUTHENTIC PRO BOXING STANCE (Orthodox: Lead left foot slightly forward, rear right foot back, knees flexed, hips turned, subtle rhythm bounce)
        const bounce = Math.sin(this.breathTimer * 3.8) * 0.012;
        this.hips.position.y = 0.94 + bounce;
        this.hips.rotation.set(0, -0.32, 0);

        this.leftThigh.rotation.set(-0.16, 0.05, -0.06);
        this.leftKnee.rotation.set(0.24, 0, 0);
        this.leftAnkle.rotation.set(-0.08, 0, 0);

        this.rightThigh.rotation.set(0.12, -0.12, 0.08);
        this.rightKnee.rotation.set(0.28, 0, 0);
        this.rightAnkle.rotation.set(-0.16, 0, 0);
      } else {
        // Tactical Combat Ready Stance
        this.rightThigh.rotation.set(0.04, 0.05, 0.04);
        this.leftThigh.rotation.set(-0.04, -0.05, -0.04);
        this.rightKnee.rotation.set(0.05, 0, 0);
        this.leftKnee.rotation.set(0.05, 0, 0);
        this.rightAnkle.rotation.set(-0.04, 0, 0);
        this.leftAnkle.rotation.set(-0.04, 0, 0);
        this.hips.position.y = 0.95;
        this.hips.rotation.set(0, 0, 0);
      }
    }
  }

  // Authentic GTA V / PUBG Two-Handed Locomotion & Combat Arm Postures
  animateNormalLocomotion(delta, isMoving, aimPitch, input) {
    const isFiring = input && (input.mouseLeftHeld || this.isAiming);

    if (this.weaponLocation === 'BACK') {
      this.setFingersClenched(true);
      // [PRO BOXER COMBAT GUARD - FISTS AT JAWLINE, CHIN TUCKED]
      const bounceY = Math.sin(this.breathTimer * 3.8) * 0.015;
      const bobX = isMoving ? Math.sin(this.walkTimer) * 0.03 : 0;
      const bobY = isMoving ? Math.cos(this.walkTimer * 2) * 0.02 : bounceY;

      if (!isMoving) {
        this.spine.rotation.set(0.06, -0.18, 0);
        this.head.rotation.set(0.08, 0.16, 0);
      }

      // Right arm: rear fist glued to right jaw, elbow tight against liver/ribs
      this.rightShoulder.rotation.set(-1.18 + bobY, -0.25, 0.30 + bobX);
      this.rightElbow.rotation.set(-1.86, 0.28, 0);
      this.rightWrist.rotation.set(0.15, 0.20, 0);

      // Left arm: lead fist held high at eye/chin level protecting lead temple
      this.leftShoulder.rotation.set(-1.32 + bobY, 0.25, -0.28 - bobX);
      this.leftElbow.rotation.set(-1.68, -0.25, 0);
      this.leftWrist.rotation.set(0.15, -0.20, 0);
    } else if (this.weaponLocation === 'HAND') {
      this.setFingersClenched(false);
      if (isFiring) {
        // [HIGH-READY FIRING / ADS STANCE]
        // Weapon raised forward at chest level, stock tucked into shoulder, barrel pointing directly at crosshair!
        this.rightShoulder.rotation.set(-0.85 - aimPitch * 0.7, -0.35, -0.10);
        this.rightElbow.rotation.set(-1.50, 0.45, 0);
        this.rightWrist.rotation.set(0.25, -0.05, 0);

        if (this.recoilRot > 0) {
          this.rightShoulder.rotation.x -= this.recoilRot * 0.25;
        }

        // Left Arm: reaches forward across chest to firmly grip front handguard
        this.leftShoulder.rotation.set(-1.42 - aimPitch * 0.7, 0.65, 0.25);
        this.leftElbow.rotation.set(-0.55, -0.50, 0);
        this.leftWrist.rotation.set(0.18, -0.22, 0.12);

      } else if (this.idleTimer >= 5.0) {
        // [GTA V / MILITARY TACTICAL IDLE SCAN FIDGET (after 5 seconds of inactivity)]
        const fidgetTime = (this.idleTimer - 5.0) % 6.0;

        if (fidgetTime < 2.0) {
          // Phase 1 (0 to 2s): Scans left perimeter, right shoulder roll
          const p1 = Math.sin((fidgetTime / 2.0) * Math.PI);
          this.head.rotation.set(0, 0.55 * p1, 0);
          this.rightShoulder.rotation.set(-0.55 + 0.12 * p1, -0.35, -0.10);
          this.rightElbow.rotation.set(-1.55, 0.45, 0);
          this.rightWrist.rotation.set(0.22, 0, 0);

          this.leftShoulder.rotation.set(-1.35, 0.65, 0.22);
          this.leftElbow.rotation.set(-0.60, -0.45, 0);
          this.leftWrist.rotation.set(0.18, -0.20, 0.10);
        } else if (fidgetTime < 4.0) {
          // Phase 2 (2 to 4s): Left hand taps base of PMAG magazine (authentic military tap-rack check)
          const p2 = Math.sin(((fidgetTime - 2.0) / 2.0) * Math.PI);
          this.head.rotation.set(0.18 * p2, -0.25 * p2, 0);
          this.rightShoulder.rotation.set(-0.55, -0.35, -0.10);
          this.rightElbow.rotation.set(-1.55, 0.45, 0);
          this.rightWrist.rotation.set(0.22, 0, 0);

          this.leftShoulder.rotation.set(-1.05 + 0.35 * p2, 0.60 - 0.25 * p2, 0.10);
          this.leftElbow.rotation.set(-1.25 * p2 - 0.60 * (1.0 - p2), -0.30, 0);
          this.leftWrist.rotation.set(0.25 * p2, -0.10, 0.10);
        } else {
          // Phase 3 (4 to 6s): Deep breath, scans right, returns to combat ready
          const p3 = Math.sin(((fidgetTime - 4.0) / 2.0) * Math.PI);
          this.head.rotation.set(0, -0.35 * p3, 0);
          this.rightShoulder.rotation.set(-0.55, -0.35, -0.10);
          this.rightElbow.rotation.set(-1.55, 0.45, 0);
          this.rightWrist.rotation.set(0.22, 0, 0);

          this.leftShoulder.rotation.set(-1.35, 0.65, 0.22);
          this.leftElbow.rotation.set(-0.60, -0.45, 0);
          this.leftWrist.rotation.set(0.18, -0.20, 0.10);
        }

      } else {
        // [LOW-READY PATROL STANCE]
        // M4A1 held forward in front of chest level with horizon, both hands firmly gripping in plain sight!
        const bobX = isMoving ? Math.sin(this.walkTimer) * 0.02 : 0;
        const bobY = isMoving ? Math.cos(this.walkTimer * 2) * 0.015 : 0;

        // Right Arm: firmly holding pistol grip in front of chest
        this.rightShoulder.rotation.set(-0.55 + bobY, -0.35, -0.10 + bobX);
        this.rightElbow.rotation.set(-1.55, 0.45, 0);
        this.rightWrist.rotation.set(0.22, 0, 0);

        // Left Arm: firmly gripping forward handguard
        this.leftShoulder.rotation.set(-1.35 + bobY, 0.65, 0.22);
        this.leftElbow.rotation.set(-0.60, -0.45, 0);
        this.leftWrist.rotation.set(0.18, -0.20, 0.10);
      }
    }
  }

  // Max Payne 3 Shootdodge Dive: 4 Directional Variations Matching Image 1
  animateShootdodge(aimPitch) {
    const progress = 1.0 - (this.shootdodgeTimer / this.shootdodgeDuration);

    if (progress < 0.45) {
      // PHASE 1: SNAPPY HORIZONTAL DASH LEAP & GLIDE IN BULLET-TIME (0.0 -> 0.45)
      // Character is suspended in mid-air gliding in slow-mo while aiming/shooting downrange (Image 1)

      if (this.shootdodgeType === 'LEFT') {
        // [LEFT SIDE SHOOTDODGE DIVE - Image 1 bottom-left]
        // Body rolled 78° onto left side, torso tilted slightly back, elevated to 0.58m to prevent ground clipping
        this.operatorGroup.position.y = 0.58;
        this.operatorGroup.rotation.z = -1.35;
        this.operatorGroup.rotation.x = -0.15;
        this.operatorGroup.rotation.y = 0.10;

        this.head.rotation.set(-0.15 - aimPitch * 0.5, 0, 0.55);

        // Arms holding rifle forward towards target
        this.rightShoulder.rotation.set(-1.35 - aimPitch * 0.6, -0.15, 0.45);
        this.rightElbow.rotation.set(-0.20, 0, 0);
        this.rightWrist.rotation.set(0.10, 0, 0);

        this.leftShoulder.rotation.set(-1.15 - aimPitch * 0.6, 0.35, 0.20);
        this.leftElbow.rotation.set(-0.40, 0, 0);
        this.leftWrist.rotation.set(0.15, -0.25, 0.20);

        // Right leg extended straight horizontally; left leg tucked forward parallel to ground (ZERO ground penetration!)
        this.rightThigh.rotation.set(-0.10, 0, 0.20);
        this.rightKnee.rotation.set(0.05, 0, 0);
        this.leftThigh.rotation.set(-0.65, 0, 0.15);
        this.leftKnee.rotation.set(1.10, 0, 0);
        this.leftAnkle.rotation.set(0, 0, 0.10);

      } else if (this.shootdodgeType === 'RIGHT') {
        // [RIGHT SIDE SHOOTDODGE DIVE]
        // Body rolled 78° onto right side, torso tilted slightly back, elevated to 0.58m to prevent ground clipping
        this.operatorGroup.position.y = 0.58;
        this.operatorGroup.rotation.z = 1.35;
        this.operatorGroup.rotation.x = -0.15;
        this.operatorGroup.rotation.y = -0.10;

        this.head.rotation.set(-0.15 - aimPitch * 0.5, 0, -0.55);

        this.rightShoulder.rotation.set(-1.35 - aimPitch * 0.6, 0.15, -0.45);
        this.rightElbow.rotation.set(-0.20, 0, 0);
        this.rightWrist.rotation.set(0.10, 0, 0);

        this.leftShoulder.rotation.set(-1.15 - aimPitch * 0.6, -0.35, -0.20);
        this.leftElbow.rotation.set(-0.40, 0, 0);
        this.leftWrist.rotation.set(0.15, 0.25, -0.20);

        // Left leg extended straight; right leg tucked forward parallel to ground (ZERO ground penetration!)
        this.leftThigh.rotation.set(-0.10, 0, -0.20);
        this.leftKnee.rotation.set(0.05, 0, 0);
        this.rightThigh.rotation.set(-0.65, 0, -0.15);
        this.rightKnee.rotation.set(1.10, 0, 0);
        this.rightAnkle.rotation.set(0, 0, -0.10);

      } else if (this.shootdodgeType === 'BACKWARD') {
        // [BACKWARD SHOOTDODGE DIVE - Image 1 bottom-right]
        // Leaps backward into air, body tilted 78° onto back, feet forward/up, guns firing forward/up!
        this.operatorGroup.position.y = 0.35;
        this.operatorGroup.rotation.x = -1.35;
        this.operatorGroup.rotation.y = 0;
        this.operatorGroup.rotation.z = 0;

        this.head.rotation.set(0.55 - aimPitch * 0.4, 0, 0);

        this.rightShoulder.rotation.set(-1.45 - aimPitch * 0.7, -0.05, 0.10);
        this.rightElbow.rotation.set(-0.25, 0, 0);
        this.leftShoulder.rotation.set(-1.25 - aimPitch * 0.7, 0.35, -0.10);
        this.leftElbow.rotation.set(-0.50, 0, 0);

        // Legs kicking forward/upward in mid-air
        this.rightThigh.rotation.set(-1.15, 0, 0);
        this.rightKnee.rotation.set(0.55, 0, 0);
        this.leftThigh.rotation.set(-0.95, 0, 0);
        this.leftKnee.rotation.set(0.45, 0, 0);

      } else {
        // [FORWARD SUPERMAN DIVE - Image 1 top]
        // 100% Horizontal Superman glide forward in mid-air
        this.operatorGroup.position.y = 0.55;
        this.operatorGroup.rotation.x = 1.50;
        this.operatorGroup.rotation.y = 0;
        this.operatorGroup.rotation.z = 0;

        this.head.rotation.set(-0.40 - aimPitch * 0.4, 0, 0);

        if (this.weaponLocation === 'HAND') {
          // SHOOTING STANCE DIVE: Arms holding M4A1 rifle forward ready to shoot downrange
          this.rightShoulder.rotation.set(-1.50 - aimPitch * 0.5, -0.05, 0.08);
          this.rightElbow.rotation.set(-0.15, 0, 0);
          this.leftShoulder.rotation.set(-1.30 - aimPitch * 0.5, 0.35, -0.10);
          this.leftElbow.rotation.set(-0.30, 0, 0);
        } else {
          // UNARMED / MELEE STUNT DIVE: Athletic dive with arms forward and hands bracing
          this.rightShoulder.rotation.set(-1.10, 0.25, 0.45);
          this.rightElbow.rotation.set(-0.35, 0, 0);
          this.rightWrist.rotation.set(-0.25, 0, 0);
          this.leftShoulder.rotation.set(-1.10, -0.25, -0.45);
          this.leftElbow.rotation.set(-0.35, 0, 0);
          this.leftWrist.rotation.set(-0.25, 0, 0);
        }

        this.rightThigh.rotation.set(-0.20, 0, 0);
        this.leftThigh.rotation.set(-0.35, 0, 0);
        this.rightKnee.rotation.set(0.20, 0, 0);
        this.leftKnee.rotation.set(0.35, 0, 0);
      }

    } else if (progress < 0.78) {
      // PHASE 2: GROUND TOUCHDOWN & SLIDE ON PAVEMENT (0.45 -> 0.78)
      // Character slides flush along pavement surface without clipping into floor!

      if (this.shootdodgeType === 'LEFT') {
        // Slide on left hip and side - elevated to 0.58m so side of body, arms, and boots rest flush on pavement with ZERO ground clipping
        this.operatorGroup.position.y = 0.58;
        this.operatorGroup.rotation.z = -1.38;
        this.operatorGroup.rotation.x = -0.10;
        this.operatorGroup.rotation.y = 0;
        this.head.rotation.set(0, 0, 0.55);

        this.rightShoulder.rotation.set(-1.30, -0.10, 0.35);
        this.rightElbow.rotation.set(-0.30, 0, 0);
        this.leftShoulder.rotation.set(-1.10, 0.25, 0.25);
        this.leftElbow.rotation.set(-0.45, 0, 0);

        // Legs resting flat and parallel along pavement - ZERO ground penetration!
        this.leftThigh.rotation.set(-0.05, 0, 0.12);
        this.leftKnee.rotation.set(0.08, 0, 0);
        this.leftAnkle.rotation.set(0, 0, 0.10);

        this.rightThigh.rotation.set(-0.10, 0, 0.20);
        this.rightKnee.rotation.set(0.12, 0, 0);
        this.rightAnkle.rotation.set(0, 0, 0.05);

      } else if (this.shootdodgeType === 'RIGHT') {
        // Slide on right hip and side - elevated to 0.58m so side of body, arms, and boots rest flush on pavement with ZERO ground clipping
        this.operatorGroup.position.y = 0.58;
        this.operatorGroup.rotation.z = 1.38;
        this.operatorGroup.rotation.x = -0.10;
        this.operatorGroup.rotation.y = 0;
        this.head.rotation.set(0, 0, -0.55);

        this.rightShoulder.rotation.set(-1.10, -0.25, -0.25);
        this.rightElbow.rotation.set(-0.45, 0, 0);
        this.leftShoulder.rotation.set(-1.30, 0.10, -0.35);
        this.leftElbow.rotation.set(-0.30, 0, 0);

        // Legs resting flat and parallel along pavement - ZERO ground penetration!
        this.rightThigh.rotation.set(-0.05, 0, -0.12);
        this.rightKnee.rotation.set(0.08, 0, 0);
        this.rightAnkle.rotation.set(0, 0, -0.10);

        this.leftThigh.rotation.set(-0.10, 0, -0.20);
        this.leftKnee.rotation.set(0.12, 0, 0);
        this.leftAnkle.rotation.set(0, 0, -0.05);

      } else if (this.shootdodgeType === 'BACKWARD') {
        // Slide on upper back / shoulders
        this.operatorGroup.position.y = 0.35;
        this.operatorGroup.rotation.x = -1.48;
        this.operatorGroup.rotation.y = 0;
        this.operatorGroup.rotation.z = 0;
        this.head.rotation.set(0.65, 0, 0);

        this.rightShoulder.rotation.set(-1.35, -0.05, 0.10);
        this.leftShoulder.rotation.set(-1.15, 0.35, -0.10);

        this.rightThigh.rotation.set(-0.75, 0, 0);
        this.leftThigh.rotation.set(-0.75, 0, 0);
        this.rightKnee.rotation.set(0.20, 0, 0);
        this.leftKnee.rotation.set(0.20, 0, 0);

      } else {
        // Slide on stomach / chest
        this.operatorGroup.position.y = 0.35;
        this.operatorGroup.rotation.x = 1.54;
        this.operatorGroup.rotation.y = 0;
        this.operatorGroup.rotation.z = 0;
        this.head.rotation.set(-0.45, 0, 0);

        this.rightShoulder.rotation.set(-1.40, -0.10, 0.15);
        this.rightElbow.rotation.set(-0.30, 0, 0);
        this.leftShoulder.rotation.set(-1.20, 0.40, -0.15);
        this.leftElbow.rotation.set(-0.50, 0, 0);

        this.rightThigh.rotation.set(0.0, 0, 0);
        this.leftThigh.rotation.set(0.0, 0, 0);
        this.rightKnee.rotation.set(0.05, 0, 0);
        this.leftKnee.rotation.set(0.05, 0, 0);
        this.rightAnkle.rotation.set(-0.15, 0, 0);
        this.leftAnkle.rotation.set(-0.15, 0, 0);
      }

    } else {
      // PHASE 3: PUSH-UP / ROLL TO KNEES & STAND-UP RECOVERY (0.78 -> 1.0)
      const standT = (progress - 0.78) / 0.22;

      if (this.shootdodgeType === 'LEFT' || this.shootdodgeType === 'RIGHT') {
        // Roll from side onto knees and rise smoothly to feet
        const sideSign = this.shootdodgeType === 'LEFT' ? -1 : 1;
        const standAngle = Math.max(0, 1.0 - standT * 1.3);
        this.operatorGroup.position.y = 0.58 * standAngle;
        this.operatorGroup.rotation.z = sideSign * 1.38 * standAngle;
        this.operatorGroup.rotation.x = -0.10 * standAngle;
        this.operatorGroup.rotation.y = 0;
        this.head.rotation.set(0, 0, 0);

        const tuck = Math.sin(standT * Math.PI) * standAngle;
        this.leftThigh.rotation.set(-0.4 * tuck, 0, 0);
        this.rightThigh.rotation.set(-0.4 * tuck, 0, 0);
        this.leftKnee.rotation.set(0.5 * tuck, 0, 0);
        this.rightKnee.rotation.set(0.5 * tuck, 0, 0);

      } else if (this.shootdodgeType === 'BACKWARD') {
        // Momentum rolls body forward over hips and knees onto feet
        const standAngle = Math.max(0, 1.0 - standT * 1.3);
        this.operatorGroup.position.y = 0.35 * standAngle;
        this.operatorGroup.rotation.x = -1.48 * standAngle;
        this.operatorGroup.rotation.y = 0;
        this.operatorGroup.rotation.z = 0;
        this.head.rotation.set(0, 0, 0);

        const rollFwd = Math.sin(standT * Math.PI) * standAngle;
        this.rightThigh.rotation.set(-0.6 * rollFwd, 0, 0);
        this.leftThigh.rotation.set(-0.6 * rollFwd, 0, 0);
        this.rightKnee.rotation.set(0.7 * rollFwd, 0, 0);
        this.leftKnee.rotation.set(0.7 * rollFwd, 0, 0);

      } else {
        // Front Superman push-up and knee tuck stand
        const standAngle = Math.max(0, 1.0 - standT * 1.3);
        this.operatorGroup.position.y = 0.35 * standAngle;
        this.operatorGroup.rotation.x = 1.54 * Math.cos(standT * Math.PI * 0.5);
        this.operatorGroup.rotation.y = 0;
        this.operatorGroup.rotation.z = 0;
        this.head.rotation.set(0, 0, 0);

        const tuck = Math.sin(standT * Math.PI) * standAngle;
        this.rightThigh.rotation.set(-0.6 * tuck, 0, 0);
        this.leftThigh.rotation.set(-0.6 * tuck, 0, 0);
        this.rightKnee.rotation.set(0.7 * tuck, 0, 0);
        this.leftKnee.rotation.set(0.7 * tuck, 0, 0);
      }

      // Arms push down and return to weapon ready stance
      this.rightShoulder.rotation.set(-0.75 * (1.0 - standT) - 0.95 * standT, 0, 0.25 * (1.0 - standT));
      this.leftShoulder.rotation.set(-0.75 * (1.0 - standT) - 0.75 * standT, 0, -0.25 * (1.0 - standT));
      this.rightElbow.rotation.set(-0.55 * (1.0 - standT) - 0.35 * standT, 0, 0);
      this.leftElbow.rotation.set(-0.55 * (1.0 - standT) - 0.85 * standT, 0, 0);

      // Ramps bullet-time smoothly back to 1.0
      this.timeScale = 0.22 + 0.78 * standT;
    }
  }

  // Prince of Persia Crouch Roll (C / Ctrl + WASD)
  animateRoll() {
    const progress = 1.0 - (this.rollTimer / this.rollDuration);

    if (progress < 0.25) {
      // Phase 1: Crouch down low to the ground
      const t = progress / 0.25;
      this.operatorGroup.position.y = -0.45 * t;
      this.spine.rotation.x = 0.55 * t;
      this.rightThigh.rotation.x = -1.1 * t;
      this.leftThigh.rotation.x = -1.1 * t;
      this.rightKnee.rotation.x = 1.5 * t;
      this.leftKnee.rotation.x = 1.5 * t;
    } else if (progress < 0.80) {
      // Phase 2: Full 360° fluid ground somersault roll
      const rollP = (progress - 0.25) / 0.55;
      this.operatorGroup.position.y = -0.35 + Math.sin(rollP * Math.PI) * 0.20;
      this.operatorGroup.rotation.x = rollP * Math.PI * 2;

      this.spine.rotation.x = 0.85;
      this.head.rotation.x = 0.65;
      this.rightThigh.rotation.x = -1.45;
      this.leftThigh.rotation.x = -1.45;
      this.rightKnee.rotation.x = 1.85;
      this.leftKnee.rotation.x = 1.85;
      this.rightShoulder.rotation.set(-0.45, 0, 0.35);
      this.leftShoulder.rotation.set(-0.45, 0, -0.35);
    } else {
      // Phase 3: Spring back up to standing combat stance
      const standP = (progress - 0.80) / 0.20;
      this.operatorGroup.position.y = -0.35 * (1.0 - standP);
      this.operatorGroup.rotation.x = 0;
      this.spine.rotation.x = 0.35 * (1.0 - standP);
      this.rightThigh.rotation.x = -0.5 * (1.0 - standP);
      this.leftThigh.rotation.x = -0.5 * (1.0 - standP);
    }
  }

  // 2-Hit Martial Arts Kick Combo (Stationary K)
  animateKick() {
    const progress = 1.0 - (this.kickTimer / this.kickDuration);
    const t = Math.sin(progress * Math.PI);
    this.setFingersClenched(true);

    if (this.kickCombo === 0) {
      // HIT 1: FRONT SNAP PUSH KICK (Midsection strike)
      this.rightThigh.rotation.x = -1.85 * t;
      this.rightThigh.rotation.z = 0.08 * t;
      this.rightKnee.rotation.x = (progress < 0.35 ? 1.6 : 0.05) * t;
      this.rightAnkle.rotation.x = -0.45 * t;

      this.leftThigh.rotation.set(0.08, -0.05, -0.06);
      this.leftKnee.rotation.set(0.12, 0, 0);

      this.spine.rotation.x = -0.35 * t;
      this.rightShoulder.rotation.set(-0.45, 0.1, 0.45);
      this.rightElbow.rotation.set(-1.55, 0, 0);
      this.leftShoulder.rotation.set(-0.55, -0.1, -0.45);
      this.leftElbow.rotation.set(-1.65, 0, 0);
    } else {
      // HIT 2: ACTION HERO HIGH NECK ROUNDHOUSE KICK (Neck/Head Level Strike ~1.65m)
      // Professional action hero posture: athletic, upright torso with slight counterbalance lean,
      // hips drive horizontal whip, kicking leg strikes flat across neck level.

      this.operatorGroup.position.y = 0.0;
      this.operatorGroup.rotation.set(0, 0, 0);

      this.hips.rotation.set(0, -0.85 * t, 0);

      // Support left leg: athletic pivot on ball of foot
      this.leftThigh.rotation.set(0.05 * t, -0.75 * t, -0.05 * t);
      this.leftKnee.rotation.set(0.25 * t, 0, 0);
      this.leftAnkle.rotation.set(0.15 * t, -0.45 * t, 0);

      // Torso & head: athletic upright posture with slight back lean (NEVER 90 degrees sideways!)
      this.spine.rotation.set(-0.20 * t, 0.20 * t, -0.15 * t);
      this.chest.rotation.set(-0.10 * t, 0.15 * t, -0.10 * t);
      this.head.rotation.set(0.08 * t, -0.30 * t, 0);

      // Arms: tight high guard protecting face & chin
      this.leftShoulder.rotation.set(-0.95, 0.20, -0.35);
      this.leftElbow.rotation.set(-1.60, 0, 0);
      this.rightShoulder.rotation.set(-0.65 * t, -0.20, 0.45 * t);
      this.rightElbow.rotation.set(-1.20 * t, 0, 0);

      // Kicking right leg: whips horizontally across neck height (~1.65m)
      let kneeExtension = 0;
      if (progress < 0.28) {
        // Chamber: Knee lifts up towards chest
        const chamberP = progress / 0.28;
        this.rightThigh.rotation.set(-1.50 * chamberP, 0.15 * chamberP, 0.35 * chamberP);
        kneeExtension = 1.75 * (1.0 - Math.sin(chamberP * Math.PI * 0.5) * 0.2);
      } else if (progress < 0.65) {
        // High Neck Strike: Leg extends horizontally across neck height
        const snapP = Math.min(1.0, (progress - 0.28) / 0.18);
        this.rightThigh.rotation.set(-1.48 * t, 0.15 * t, 0.35 * t);
        kneeExtension = 1.40 * (1.0 - snapP) + 0.01 * snapP;
      } else {
        // Re-chamber & return
        const returnP = (progress - 0.65) / 0.35;
        this.rightThigh.rotation.set(-1.48 * (1.0 - returnP), 0.15 * (1.0 - returnP), 0.35 * (1.0 - returnP));
        kneeExtension = 1.20 * (1.0 - returnP);
      }

      this.rightKnee.rotation.set(kneeExtension, 0, 0);
      this.rightAnkle.rotation.set(-0.35 * t, 0, 0.15 * t); // Pointed martial arts instep
    }
  }

  // Cinematic Action Hero Flying Kick (WASD + K)
  animateDropkick() {
    const progress = 1.0 - (this.dropkickTimer / this.dropkickDuration);
    this.setFingersClenched(true);

    if (progress < 0.75) {
      // AIRBORNE PHASE (0.0 -> 0.75):
      const airT = progress / 0.75;

      if (airT < 0.32) {
        // [PHASE A: KINETIC COIL / CHAMBER]
        // Both knees pull up and tuck symmetrically to chest in mid-air (coiling explosive kinetic energy)
        const cT = Math.sin((airT / 0.32) * (Math.PI / 2));

        this.operatorGroup.rotation.set(0, 0, 0); // Strictly aligned with forward flight path!
        this.spine.rotation.set(-0.18 * cT, 0, 0);

        // BOTH legs tuck knees tightly to chest forward
        this.rightThigh.rotation.set(-1.65 * cT, 0, 0.04);
        this.rightKnee.rotation.set(2.20 * cT, 0, 0);
        this.rightAnkle.rotation.set(-0.20 * cT, 0, 0);

        this.leftThigh.rotation.set(-1.65 * cT, 0, -0.04);
        this.leftKnee.rotation.set(2.20 * cT, 0, 0);
        this.leftAnkle.rotation.set(-0.20 * cT, 0, 0);

        // Arms in tight protective aerial guard
        this.rightShoulder.rotation.set(-0.95 * cT, 0.15, 0.25 * cT);
        this.rightElbow.rotation.set(-1.75 * cT, 0, 0);
        this.leftShoulder.rotation.set(-0.95 * cT, -0.15, -0.25 * cT);
        this.leftElbow.rotation.set(-1.75 * cT, 0, 0);
        this.head.rotation.set(0.15 * cT, 0, 0);

      } else {
        // [PHASE B: EXPLOSIVE HEEL THRUST / EXTENSION]
        // Both legs explode 100% straight forward together, driving heels forward into target!
        const extP = Math.min(1.0, (airT - 0.32) / 0.20);

        this.operatorGroup.rotation.set(-0.18, 0, 0);
        this.spine.rotation.set(-0.15, 0, 0);

        this.rightThigh.rotation.set(-1.65, 0, 0.04);
        this.leftThigh.rotation.set(-1.65, 0, -0.04);
        this.rightKnee.rotation.set(2.20 * (1.0 - extP) + 0.01 * extP, 0, 0);
        this.leftKnee.rotation.set(2.20 * (1.0 - extP) + 0.01 * extP, 0, 0);
        this.rightAnkle.rotation.set(-0.35 * extP, 0, 0);
        this.leftAnkle.rotation.set(-0.35 * extP, 0, 0);

        this.rightShoulder.rotation.set(-1.25, 0.1, 0.35);
        this.leftShoulder.rotation.set(-1.25, -0.1, -0.35);
        this.rightElbow.rotation.set(-0.45, 0, 0);
        this.leftElbow.rotation.set(-0.45, 0, 0);
        this.head.rotation.set(0.18, 0, 0);
      }

    } else {
      // [PHASE C: TACTICAL LANDING & SHOCK ABSORPTION]
      const landP = (progress - 0.75) / 0.25;
      this.operatorGroup.rotation.set(0, 0, 0);
      this.spine.rotation.set(0, 0, 0);
      this.head.rotation.set(0, 0, 0);

      // Knees bend to absorb landing impact
      const absorb = Math.sin(landP * Math.PI);
      this.rightThigh.rotation.set(-0.55 * absorb, 0, 0);
      this.leftThigh.rotation.set(-0.55 * absorb, 0, 0);
      this.rightKnee.rotation.set(1.05 * absorb, 0, 0);
      this.leftKnee.rotation.set(1.05 * absorb, 0, 0);
    }
  }

  // Prince of Persia Side Wall Run (WASD + Space near wall)
  animateWallRun() {
    // 1. Determine wall side strictly relative to character's local coordinate system
    let isLeftWall = this.wallRunSide === 'LEFT';
    if (this.wallNormal) {
      // Vector pointing towards the wall:
      const toWallLocal = this.wallNormal.clone().negate().applyQuaternion(this.mesh.quaternion.clone().invert());
      isLeftWall = toWallLocal.x < 0;
      this.wallRunSide = isLeftWall ? 'LEFT' : 'RIGHT';
    }

    // 2. Athletic Prince of Persia Wall Run Posture:
    // Body tilts into the wall (22° lean) with slight forward athletic pitch
    const tiltZ = isLeftWall ? -0.38 : 0.38;
    this.operatorGroup.rotation.z = tiltZ;
    this.operatorGroup.rotation.x = 0.12;
    this.spine.rotation.set(0.06, isLeftWall ? -0.12 : 0.12, 0);

    // 3. Stride cadence along the vertical wall face
    const runCycle = Math.sin(this.wallRunTimer * 16);

    if (isLeftWall) {
      // Wall is on player's LEFT:
      // BOTH legs are angled sideways to attach and plant on the vertical wall face!
      // Left leg (wall-side): steps forward/back along the wall face
      this.leftThigh.rotation.set(runCycle * 0.75, 0.05, -0.35);
      this.leftKnee.rotation.set(Math.max(0.20, runCycle * 0.90 + 0.35), 0, 0);
      this.leftAnkle.rotation.set(0.10, 0, -0.36);

      // Right leg (outside leg): drives forward and plants firmly on the wall face too!
      this.rightThigh.rotation.set(-runCycle * 0.75, 0.05, -0.42);
      this.rightKnee.rotation.set(Math.max(0.20, -runCycle * 0.90 + 0.35), 0, 0);
      this.rightAnkle.rotation.set(0.10, 0, -0.40);

      // Left arm (wall-side): reaches towards and skims along the wall for parkour stabilization
      this.leftShoulder.rotation.set(-0.75, -0.22, -0.38);
      this.leftElbow.rotation.set(-0.35, 0, 0);
      this.leftWrist.rotation.set(0, 0, -0.20);

      // Right arm (outside): pumps dynamically with running cadence
      this.rightShoulder.rotation.set(runCycle * 0.60 - 0.25, 0, 0.28);
      this.rightElbow.rotation.set(-0.85, 0, 0);

    } else {
      // Wall is on player's RIGHT:
      // BOTH legs are angled sideways to attach and plant on the vertical wall face!
      // Right leg (wall-side): steps forward/back along the wall face
      this.rightThigh.rotation.set(runCycle * 0.75, -0.05, 0.35);
      this.rightKnee.rotation.set(Math.max(0.20, runCycle * 0.90 + 0.35), 0, 0);
      this.rightAnkle.rotation.set(0.10, 0, 0.36);

      // Left leg (outside leg): drives forward and plants firmly on the wall face too!
      this.leftThigh.rotation.set(-runCycle * 0.75, -0.05, 0.42);
      this.leftKnee.rotation.set(Math.max(0.20, -runCycle * 0.90 + 0.35), 0, 0);
      this.leftAnkle.rotation.set(0.10, 0, 0.40);

      // Right arm (wall-side): reaches towards and skims along wall
      this.rightShoulder.rotation.set(-0.75, 0.22, 0.38);
      this.rightElbow.rotation.set(-0.35, 0, 0);
      this.rightWrist.rotation.set(0, 0, 0.20);

      // Left arm (outside): pumps dynamically
      this.leftShoulder.rotation.set(runCycle * 0.60 - 0.25, 0, -0.28);
      this.leftElbow.rotation.set(-0.85, 0, 0);
    }
  }

  // Prince of Persia Front Wall Run & Full 360° Backflip
  animateWallBackflip() {
    const progress = 1.0 - (this.wallFlipTimer / this.wallFlipDuration);

    if (progress < 0.36) {
      // Step vertically up the wall face (2 strides up)
      const stepCycle = Math.sin((progress / 0.36) * Math.PI * 2);
      this.operatorGroup.rotation.x = -0.32;
      this.rightThigh.rotation.x = -stepCycle * 1.35;
      this.leftThigh.rotation.x = stepCycle * 1.35;
      this.rightKnee.rotation.x = 0.85;
      this.leftKnee.rotation.x = 0.85;
    } else if (progress < 0.78) {
      // Full 360° Aerial Backflip in mid-air
      const flipProgress = (progress - 0.36) / 0.42;
      this.operatorGroup.rotation.x = -flipProgress * Math.PI * 2;

      this.rightThigh.rotation.x = -1.45;
      this.leftThigh.rotation.x = -1.45;
      this.rightKnee.rotation.x = 1.65;
      this.leftKnee.rotation.x = 1.65;
      this.rightShoulder.rotation.set(-0.5, 0, 0.4);
      this.leftShoulder.rotation.set(-0.5, 0, -0.4);
    } else {
      // Landing squarely on feet
      this.operatorGroup.rotation.x = 0;
      this.rightThigh.rotation.set(0, 0, 0);
      this.leftThigh.rotation.set(0, 0, 0);
    }
  }

  updateVisibilityForCameraMode() {
    const isFirstPerson = this.cameraMode === 'FIRST_PERSON';
    if (isFirstPerson) {
      if (this.operatorGroup) this.operatorGroup.visible = false;
      if (this.fpRig) this.fpRig.visible = true;
    } else {
      if (this.operatorGroup) this.operatorGroup.visible = true;
      if (this.fpRig) this.fpRig.visible = false;
    }
  }

  updateHUD() {
    const hpFill = document.getElementById('hp-fill');
    const hpText = document.getElementById('hp-text');
    if (hpFill) hpFill.style.width = `${(this.hp / this.maxHp) * 100}%`;
    if (hpText) hpText.textContent = `${Math.ceil(this.hp)} / ${this.maxHp}`;

    const staminaFill = document.getElementById('stamina-fill');
    const staminaText = document.getElementById('stamina-text');
    if (staminaFill) staminaFill.style.width = `${(this.stamina / this.maxStamina) * 100}%`;
    if (staminaText) staminaText.textContent = `${Math.ceil(this.stamina)}%`;

    const ammoClipEl = document.getElementById('ammo-clip');
    const ammoResEl = document.getElementById('ammo-reserve');
    if (ammoClipEl && !this.isReloading) ammoClipEl.textContent = this.ammoClip;
    if (ammoResEl) ammoResEl.textContent = this.ammoReserve;

    const badge = document.getElementById('movement-state-badge');
    if (badge) {
      badge.textContent = this.moveState;
      badge.className = 'state-badge';
      if (this.isWallBackflipping || this.isWallRunning) badge.classList.add('parkour');
      else if (this.isShootdodging) badge.classList.add('shootdodge');
      else if (this.isRolling) badge.classList.add('rolling');
      else if (this.isDropkicking || this.isKicking) badge.classList.add('combat');
      else if (this.isSprinting) badge.classList.add('sprinting');
      else if (!this.isGrounded) badge.classList.add('airborne');
    }

    const adsInd = document.getElementById('ads-indicator');
    if (adsInd) {
      adsInd.textContent = this.isAiming ? 'OPTIC ADS' : 'HIP-FIRE';
      adsInd.classList.toggle('active', this.isAiming);
    }
  }
}
