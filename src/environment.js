/**
 * 3D Quarantine City Environment (Three.js)
 * Implements street grid, asphalt textures, lighting, fog, concrete jersey barriers, sandbags, and collision bounds.
 */
class CityEnvironment {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = []; // Array of collision boxes: { x, z, width, depth, height, mesh }
    this.lights = [];
    this.initLighting();
    this.initGround();
    this.initBarricades();
    this.initDecorations();
    this.initAtmosphereParticles();
    this.collectShootables();
  }

  // Meshes bullets can hit (walls, barriers, crates, lamps, ground).
  // Collected right after the environment is built — the player and zombies
  // are added later, so they are never in this list.
  collectShootables() {
    this.shootables = [];
    this.scene.traverse((o) => {
      if (o.isMesh && !o.isPoints) {
        this.shootables.push(o);
      }
    });
  }

  initLighting() {
    // Night ambient fill — brightened so zombies show their TRUE texture
    // colours (the emissive lift was washing them whitish, so it was
    // removed; visibility now comes from the light, not a self-glow).
    const ambientLight = new THREE.AmbientLight(0x2a3648, 1.2);
    this.scene.add(ambientLight);

    // Directional moonlight with soft shadows
    const moonLight = new THREE.DirectionalLight(0x5588cc, 1.2);
    moonLight.position.set(25, 40, 20);
    moonLight.castShadow = true;
    // PERFORMANCE: shadow map was 2048 (4M pixels, re-rendered every frame).
    // 1024 is plenty for a 64m arena and 4x cheaper — a big FPS win.
    moonLight.shadow.mapSize.width = 1024;
    moonLight.shadow.mapSize.height = 1024;
    moonLight.shadow.camera.near = 0.5;
    moonLight.shadow.camera.far = 100;
    const d = 30;
    moonLight.shadow.camera.left = -d;
    moonLight.shadow.camera.right = d;
    moonLight.shadow.camera.top = d;
    moonLight.shadow.camera.bottom = -d;
    moonLight.shadow.bias = -0.0005;
    this.scene.add(moonLight);

    // Street Lamps with warm sodium amber glows
    this.createStreetLamp(-14, 0, -10, 0xffaa33);
    this.createStreetLamp(14, 0, -10, 0xffaa33);
    this.createStreetLamp(-14, 0, 14, 0xffaa33);
    this.createStreetLamp(14, 0, 14, 0xffaa33);

    // Emergency Flashing Red/Cyan beacon
    this.emergencyLight = new THREE.PointLight(0xff0044, 1.8, 18);
    this.emergencyLight.position.set(0, 3.5, 0);
    this.scene.add(this.emergencyLight);
  }

  createStreetLamp(x, y, z, color) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Metal Pole
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 5.5, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x1c2128, roughness: 0.6, metalness: 0.8 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 2.75;
    pole.castShadow = true;
    group.add(pole);

    // Lamp Arm & Housing
    const armGeo = new THREE.BoxGeometry(1.2, 0.15, 0.25);
    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.position.set(x > 0 ? -0.5 : 0.5, 5.4, 0);
    group.add(arm);

    // Glowing Bulb
    const bulbGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const bulbMat = new THREE.MeshBasicMaterial({ color: color });
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(x > 0 ? -1.0 : 1.0, 5.25, 0);
    group.add(bulb);

    // Real-time Point Light — NO shadow. A shadow-casting point light renders
    // the whole scene 6 times (cube map) every frame; 4 lamps = 24 extra
    // scene renders, which is why the game ran at 10-13 FPS. The moonlight
    // directional still casts the main shadows; the lamps just light.
    const pointLight = new THREE.PointLight(color, 2.2, 22);
    pointLight.position.copy(bulb.position);
    pointLight.castShadow = false;
    pointLight.shadow.bias = -0.002;
    group.add(pointLight);

    this.scene.add(group);

    // Add pole to obstacles (cylinder radius 0.16m -> collision box 0.35m)
    this.obstacles.push({
      x: x,
      z: z,
      width: 0.35,
      depth: 0.35,
      height: 6.0,
      rotY: 0,
      isVaultable: false
    });
  }

  initGround() {
    // Generate high-resolution procedural canvas asphalt texture with road markings
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Dark gritty asphalt base
    ctx.fillStyle = '#10141a';
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle asphalt noise
    for (let i = 0; i < 20000; i++) {
      const v = Math.floor(Math.random() * 25 + 16);
      ctx.fillStyle = `rgb(${v}, ${v + 4}, ${v + 8})`;
      ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
    }

    // Yellow Double Center Line
    ctx.strokeStyle = '#e6af2e';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(508, 0); ctx.lineTo(508, 1024);
    ctx.moveTo(524, 0); ctx.lineTo(524, 1024);
    ctx.stroke();

    // Crosswalk Zebra Stripes
    ctx.fillStyle = '#cfd8dc';
    for (let y = 120; y < 420; y += 40) {
      ctx.fillRect(360, y, 310, 24);
    }

    // Hazard Stripes Near Perimeter
    ctx.fillStyle = '#ffb703';
    for (let i = 0; i < 1024; i += 60) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 30, 0);
      ctx.lineTo(i - 20, 50);
      ctx.lineTo(i - 50, 50);
      ctx.fill();
    }

    // Sewer Grate
    ctx.fillStyle = '#0a0d12';
    ctx.fillRect(200, 700, 80, 80);
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3;
    for (let gx = 208; gx < 280; gx += 8) {
      ctx.beginPath();
      ctx.moveTo(gx, 705);
      ctx.lineTo(gx, 775);
      ctx.stroke();
    }

    const groundTexture = new THREE.CanvasTexture(canvas);
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(4, 4);

    // Ground Plane with PBR Material (reflective wet look)
    const groundGeo = new THREE.PlaneGeometry(80, 80);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTexture,
      roughness: 0.45,
      metalness: 0.25
    });

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  initBarricades() {
    // Concrete Jersey Barriers (Low vaultable barricades: height 1.1m)
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x485563, roughness: 0.85 });

    const createJerseyBarrier = (x, z, rotY = 0) => {
      const width = 3.2;
      const height = 1.1;
      const depth = 0.8;

      const group = new THREE.Group();
      group.position.set(x, height / 2, z);
      group.rotation.y = rotY;

      const geo = new THREE.BoxGeometry(width, height, depth);
      const mesh = new THREE.Mesh(geo, barrierMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      // Warning stripes on barrier
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffb703 });
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.15, depth + 0.02), stripeMat);
      stripe.position.y = 0.15;
      group.add(stripe);

      this.scene.add(group);

      // Add to obstacle registry with exact local dimensions and rotation (OBB)
      this.obstacles.push({
        x: x,
        z: z,
        width: width,
        depth: depth,
        height: height,
        rotY: rotY,
        isVaultable: true // Player can jump over this!
      });
    };

    // Strategic tactical layout
    createJerseyBarrier(-6, -4, 0);
    createJerseyBarrier(6, -4, 0);
    createJerseyBarrier(-5.2, 7.5, Math.PI / 4);
    createJerseyBarrier(5.2, 7.5, -Math.PI / 4);
    createJerseyBarrier(0, -12, Math.PI / 2);

    // Sandbag Fortifications (Low height: 0.8m)
    const createSandbagWall = (x, z, rotY = 0) => {
      const sandbagMat = new THREE.MeshStandardMaterial({ color: 0x7a6b52, roughness: 0.95 });
      const width = 2.4;
      const height = 0.8;
      const depth = 0.9;

      const group = new THREE.Group();
      group.position.set(x, height / 2, z);
      group.rotation.y = rotY;

      for (let row = 0; row < 3; row++) {
        for (let col = -1; col <= 1; col++) {
          const bagGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.75, 8);
          const bag = new THREE.Mesh(bagGeo, sandbagMat);
          bag.rotation.z = Math.PI / 2;
          bag.position.set(col * 0.75, (row - 1) * 0.25, 0);
          bag.castShadow = true;
          bag.receiveShadow = true;
          group.add(bag);
        }
      }

      this.scene.add(group);

      this.obstacles.push({
        x: x,
        z: z,
        width: width,
        depth: depth,
        height: height,
        rotY: rotY,
        isVaultable: true
      });
    };

    createSandbagWall(-4, 4, -Math.PI / 6);
    createSandbagWall(4, 4, Math.PI / 6);

    // Military Supply Crates (High obstacle: 1.5m, non-vaultable without high jump)
    const createCrate = (x, z) => {
      const crateMat = new THREE.MeshStandardMaterial({ color: 0x2e3d30, roughness: 0.7 });
      const geo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
      const mesh = new THREE.Mesh(geo, crateMat);
      mesh.position.set(x, 0.7, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      this.obstacles.push({
        x: x,
        z: z,
        width: 1.4,
        depth: 1.4,
        height: 1.4,
        isVaultable: false
      });
    };

    createCrate(-10, -8);
    createCrate(-11.5, -8);
    createCrate(11, -7);

    // High Tactical Quarantine Blast Walls (Height 4.5m - Perfect for Wall Runs & Wall Flips)
    const createBlastWall = (x, z, length, rotY = 0) => {
      const wallH = 4.5;
      const wallD = 0.8;
      const group = new THREE.Group();
      group.position.set(x, wallH / 2, z);
      group.rotation.y = rotY;

      // Reinforced blast concrete
      const wallMesh = new THREE.Mesh(
        new THREE.BoxGeometry(wallD, wallH, length),
        new THREE.MeshStandardMaterial({ color: 0x1f2732, roughness: 0.85, metalness: 0.3 })
      );
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      group.add(wallMesh);

      // Warning hazard stripes along middle
      const hazardMesh = new THREE.Mesh(
        new THREE.BoxGeometry(wallD + 0.02, 0.35, length * 0.95),
        new THREE.MeshBasicMaterial({ color: 0xffaa00 })
      );
      hazardMesh.position.y = 0.2;
      group.add(hazardMesh);

      // Glowing Cyan Run-Guide Rail
      const railMesh = new THREE.Mesh(
        new THREE.BoxGeometry(wallD + 0.04, 0.10, length * 0.95),
        new THREE.MeshBasicMaterial({ color: 0x00f0ff })
      );
      railMesh.position.y = 1.0;
      group.add(railMesh);

      this.scene.add(group);

      // Add blast wall to registry with exact local dimensions and rotation (OBB)
      this.obstacles.push({
        x: x,
        z: z,
        width: wallD,
        depth: length,
        height: wallH,
        rotY: rotY,
        isVaultable: false,
        isHighWall: true
      });
    };

    // Place high blast walls on runway flanks (easily accessible for testing)
    createBlastWall(-8.5, 0, 16, 0); // West Blast Wall
    createBlastWall(8.5, 0, 16, 0);  // East Blast Wall
  }

  initDecorations() {
    // Perimeter Quarantine Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x151b22, roughness: 0.9 });
    const wallThickness = 1.5;
    const wallHeight = 5.0;
    const boundary = 32;

    const walls = [
      { x: 0, z: -boundary, w: boundary * 2, d: wallThickness },
      { x: 0, z: boundary, w: boundary * 2, d: wallThickness },
      { x: -boundary, z: 0, w: wallThickness, d: boundary * 2 },
      { x: boundary, z: 0, w: wallThickness, d: boundary * 2 }
    ];

    walls.forEach(w => {
      const geo = new THREE.BoxGeometry(w.w, wallHeight, w.d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(w.x, wallHeight / 2, w.z);
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      this.obstacles.push({
        x: w.x,
        z: w.z,
        width: w.w,
        depth: w.d,
        height: wallHeight,
        isVaultable: false
      });
    });

    // Biohazard Quarantine Warning Billboard
    const signGroup = new THREE.Group();
    signGroup.position.set(0, 4.2, -31);

    const boardGeo = new THREE.BoxGeometry(12, 2.2, 0.4);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x0f141c });
    const board = new THREE.Mesh(boardGeo, boardMat);
    signGroup.add(board);

    // Glowing Neon Text Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f141c';
    ctx.fillRect(0, 0, 512, 128);
    ctx.font = 'bold 28px Orbitron, sans-serif';
    ctx.fillStyle = '#ff0055';
    ctx.textAlign = 'center';
    ctx.fillText('QUARANTINE SECTOR 04', 256, 52);
    ctx.font = '600 20px Rajdhani, sans-serif';
    ctx.fillStyle = '#ffb703';
    ctx.fillText('BIOHAZARD LEVEL 5 // LETHAL FORCE AUTHORIZED', 256, 92);

    const signTexture = new THREE.CanvasTexture(canvas);
    const textPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(11.8, 2.0),
      new THREE.MeshBasicMaterial({ map: signTexture })
    );
    textPlane.position.z = 0.22;
    signGroup.add(textPlane);

    this.scene.add(signGroup);
  }

  initAtmosphereParticles() {
    // Subtle night ash/rain embers floating in the spotlight
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 60;
      positions[i + 1] = Math.random() * 12;
      positions[i + 2] = (Math.random() - 0.5) * 60;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x00e5ff,
      size: 0.1,
      transparent: true,
      opacity: 0.45
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  update(delta, time) {
    // Pulse emergency beacon
    if (this.emergencyLight) {
      this.emergencyLight.intensity = 1.0 + Math.sin(time * 6) * 0.8;
      this.emergencyLight.position.x = Math.sin(time * 3) * 0.5;
    }

    // Drift particles downward
    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] -= delta * 0.8;
        if (positions[i] < 0) positions[i] = 12;
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }
  }

  // Returns the ground/platform altitude at (x, z)
  getGroundHeightAt(x, z, playerRadius = 0.35) {
    let highestGround = 0.0;
    for (const obs of this.obstacles) {
      if (!obs.isWalkablePlatform) continue; // Barriers, sandbags, and perimeter walls are solid covers, not platforms!
      const halfW = obs.width / 2;
      const halfD = obs.depth / 2;
      const rot = obs.rotY || 0;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);

      const dx = x - obs.x;
      const dz = z - obs.z;
      const localX = dx * cos - dz * sin;
      const localZ = dx * sin + dz * cos;

      if (Math.abs(localX) <= halfW && Math.abs(localZ) <= halfD) {
        if (obs.height > highestGround) {
          highestGround = obs.height;
        }
      }
    }
    return highestGround;
  }

  // Continuous Sliding Collision Resolution with Depenetration
  // Prevents player from EVER getting stuck inside or penetrating obstacles!
  resolveCollisions(playerPos, playerVelocity, playerRadius, playerY, ignoreObs = null) {
    const effectiveRadius = playerRadius;

    // Up to 4 relaxation passes to resolve corner pinches and multiple adjacent obstacles
    for (let pass = 0; pass < 4; pass++) {
      let resolvedAny = false;

      for (const obs of this.obstacles) {
        if (ignoreObs && obs === ignoreObs) {
          continue;
        }

        // If player has jumped completely on top or over the obstacle, skip horizontal collision
        if (playerY >= obs.height - 0.05) {
          continue;
        }

        const halfW = obs.width / 2;
        const halfD = obs.depth / 2;
        const rot = obs.rotY || 0;
        const dx = playerPos.x - obs.x;
        const dz = playerPos.z - obs.z;
        const cos = Math.cos(rot);
        const sin = Math.sin(rot);
        const localX = dx * cos - dz * sin;
        const localZ = dx * sin + dz * cos;

        // Clamp to find nearest point on local OBB
        const nearestLocalX = Math.max(-halfW, Math.min(localX, halfW));
        const nearestLocalZ = Math.max(-halfD, Math.min(localZ, halfD));

        const diffX = localX - nearestLocalX;
        const diffZ = localZ - nearestLocalZ;
        const distSq = diffX * diffX + diffZ * diffZ;

        // Check if player is penetrating or within effective radius
        const isInside = Math.abs(localX) < halfW && Math.abs(localZ) < halfD;

        if (isInside || distSq < effectiveRadius * effectiveRadius) {
          resolvedAny = true;
          let localNormX = 0;
          let localNormZ = 0;
          let penetration = 0;

          if (isInside) {
            // Player center is INSIDE obstacle box: calculate shortest exit distance
            const overlapX = halfW - Math.abs(localX);
            const overlapZ = halfD - Math.abs(localZ);

            if (overlapX < overlapZ) {
              localNormX = localX >= 0 ? 1 : -1;
              localNormZ = 0;
              penetration = overlapX + effectiveRadius;
            } else {
              localNormX = 0;
              localNormZ = localZ >= 0 ? 1 : -1;
              penetration = overlapZ + effectiveRadius;
            }
          } else {
            // Player is outside but within effective radius
            const dist = Math.sqrt(distSq);
            if (dist > 0.0001) {
              localNormX = diffX / dist;
              localNormZ = diffZ / dist;
            } else {
              localNormX = 1;
              localNormZ = 0;
            }
            penetration = effectiveRadius - dist;
          }

          // Convert local normal to world space (Three.js Y-rotation)
          const worldNormX = localNormX * cos + localNormZ * sin;
          const worldNormZ = -localNormX * sin + localNormZ * cos;

          // 1. Immediate Depenetration: Push player completely out to obstacle exterior!
          if (penetration > 0) {
            playerPos.x += worldNormX * (penetration + 0.01);
            playerPos.z += worldNormZ * (penetration + 0.01);
          }

          // 2. Velocity Deflection (Wall Sliding): Remove velocity component directed into obstacle
          const velDot = playerVelocity.x * worldNormX + playerVelocity.z * worldNormZ;
          if (velDot < 0) {
            playerVelocity.x -= worldNormX * velDot;
            playerVelocity.z -= worldNormZ * velDot;
          }
        }
      }

      if (!resolvedAny) break;
    }
  }

  // Check horizontal collision for player capsule using exact Oriented Bounding Boxes (OBB)
  checkCollision(newX, newZ, playerRadius, playerY) {
    for (const obs of this.obstacles) {
      if (playerY >= obs.height - 0.05) {
        continue;
      }

      const halfW = obs.width / 2;
      const halfD = obs.depth / 2;
      const rot = obs.rotY || 0;

      const dx = newX - obs.x;
      const dz = newZ - obs.z;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const localX = dx * cos - dz * sin;
      const localZ = dx * sin + dz * cos;

      const nearestLocalX = Math.max(-halfW, Math.min(localX, halfW));
      const nearestLocalZ = Math.max(-halfD, Math.min(localZ, halfD));

      const diffX = localX - nearestLocalX;
      const diffZ = localZ - nearestLocalZ;
      const distSq = diffX * diffX + diffZ * diffZ;

      if (distSq < playerRadius * playerRadius) {
        return { collided: true, obs: obs };
      }
    }
    return { collided: false };
  }

  // Check if player position is still along the wall span (checks length axis accurately in local space)
  isStillOnWall(playerPos, obs, endMargin = 1.0) {
    if (!obs) return false;
    const rot = obs.rotY || 0;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const dx = playerPos.x - obs.x;
    const dz = playerPos.z - obs.z;
    const localX = dx * cos - dz * sin;
    const localZ = dx * sin + dz * cos;

    const isXLong = obs.width >= obs.depth;
    if (isXLong) {
      const halfW = obs.width / 2 + endMargin;
      const halfD = obs.depth / 2 + 1.2;
      return Math.abs(localX) <= halfW && Math.abs(localZ) <= halfD;
    } else {
      const halfW = obs.width / 2 + 1.2;
      const halfD = obs.depth / 2 + endMargin;
      return Math.abs(localX) <= halfW && Math.abs(localZ) <= halfD;
    }
  }

  // Query walls nearby for Prince of Persia wall run & backflip (Calculates true closest-point distance on tall walls)
  checkWallProximity(playerPos, forwardDir, maxDist = 1.05, minWallHeight = 3.5) {
    const result = {
      frontWall: null,
      leftWall: null,
      rightWall: null
    };

    let closestDist = maxDist + 1;

    for (const obs of this.obstacles) {
      const wallLength = Math.max(obs.width, obs.depth);
      if (wallLength < 4.0 || obs.height < minWallHeight) continue;

      const halfW = obs.width / 2;
      const halfD = obs.depth / 2;
      const rot = obs.rotY || 0;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);

      // Player in wall local coordinates
      const dx = playerPos.x - obs.x;
      const dz = playerPos.z - obs.z;
      const localX = dx * cos - dz * sin;
      const localZ = dx * sin + dz * cos;

      // Nearest point on wall local box
      const nearestLocalX = Math.max(-halfW, Math.min(localX, halfW));
      const nearestLocalZ = Math.max(-halfD, Math.min(localZ, halfD));

      const diffLocalX = localX - nearestLocalX;
      const diffLocalZ = localZ - nearestLocalZ;
      const dist = Math.hypot(diffLocalX, diffLocalZ);

      if (dist <= maxDist && dist < closestDist) {
        let localNormal = new THREE.Vector3(diffLocalX, 0, diffLocalZ);
        if (localNormal.lengthSq() > 0.0001) {
          localNormal.normalize();
        } else {
          if (halfW > halfD) localNormal.set(0, 0, Math.sign(diffLocalZ) || 1);
          else localNormal.set(Math.sign(diffLocalX) || 1, 0, 0);
        }

        // Convert local nearest point and local normal back to world coordinates
        const closestX = obs.x + (nearestLocalX * cos + nearestLocalZ * sin);
        const closestZ = obs.z + (-nearestLocalX * sin + nearestLocalZ * cos);

        const normal = new THREE.Vector3(
          localNormal.x * cos + localNormal.z * sin,
          0,
          -localNormal.x * sin + localNormal.z * cos
        ).normalize();

        const approachDot = forwardDir.dot(normal);

        // 1. Strict Front Wall: player must be directly facing the wall face (approachDot < -0.75) and touching it (dist <= 0.95m)
        if (approachDot < -0.75 && dist <= 0.95) {
          result.frontWall = { obs, normal, closestX, closestZ, dist };
          closestDist = dist;
        }
        // 2. Strict Side Wall: player must be moving ALONGSIDE the wall (flank/diagonal, approachDot between -0.75 and 0.25)
        // Never trigger if moving away from wall (approachDot > 0.25)!
        else if (approachDot >= -0.75 && approachDot <= 0.25 && dist <= 0.95) {
          const crossY = forwardDir.x * normal.z - forwardDir.z * normal.x;
          if (crossY > 0) {
            result.leftWall = { obs, side: 'LEFT', normal, closestX, closestZ, dist };
            closestDist = dist;
          } else {
            result.rightWall = { obs, side: 'RIGHT', normal, closestX, closestZ, dist };
            closestDist = dist;
          }
        }
      }
    }

    return result;
  }
}
