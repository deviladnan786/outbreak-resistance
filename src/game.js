/**
 * Outbreak: Resistance - Core Game Controller (Three.js)
 * Master loop handling scene, multi-mode camera (Top-Down, 3rd Person GTA, 1st Person FPS),
 * ADS zoom, input capture, UI sync & CrazyGames SDK.
 */

class OutbreakGame {
  constructor() {
    this.container = document.getElementById('game-container');
    this.input = {
      keys: {},
      mouseNDC: new THREE.Vector2(),
      mouseScreen: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      mouseLeftHeld: false,
      mouseRightHeld: false,
      sensitivity: 1.0,
      // Mobile joystick (v3.8): -1..1, up = joyY -1. Set by touch controls.
      joyX: 0,
      joyY: 0,
      joyActive: false
    };
    // True only on a real touch-FIRST device (phone/tablet). A touchscreen
    // laptop still has a mouse as its primary pointer, so it must NOT get
    // the mobile layout — check pointer: coarse (plus a mobile UA fallback),
    // not just touch support. (v3.8 used touch support alone, which wrongly
    // put the joystick + auto-fullscreen on desktop touchscreen laptops.)
    const hasTouchCap = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const mobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    this.isTouch = hasTouchCap && (coarsePointer || mobileUA);

    this.clock = new THREE.Clock();
    this.fpsTimer = 0;
    this.framesCount = 0;
    this.missionSeconds = 600; // 10:00 Extraction Countdown
    this.isPaused = false;

    // Multi-Mode Camera Settings (Toggle with 'V')
    this.cameraModes = ['THIRD_PERSON', 'TOP_DOWN', 'FIRST_PERSON'];
    this.cameraModeIndex = 0;

    // Free mouse-look yaw/pitch angles for 3rd & 1st person modes
    this.cameraYaw = 0;
    this.cameraPitch = 0.05;

    // Trauma-based camera shake (game-feel). addTrauma() raises it;
    // applyCameraShake() decays it and offsets the camera after it is
    // positioned each frame, so it never desyncs aim or collision.
    this.trauma = 0;
    this._shakeT = 0;

    // Top-down camera parameters
    this.camBaseHeight = 18.0;
    this.camBaseOffsetZ = 13.5;
    this.camCurrentHeight = 18.0;
    this.camCurrentOffsetZ = 13.5;

    this.initThree();
    this.initEnvironment();
    this.initPlayer();
    this.initZombies();
    this.initInputListeners();
    this.initTouchControls();
    this.initSettingsModal();
    this.initCrazyGamesSDK();
    this.initLoadingScreen();

    window.addEventListener('resize', () => this.onWindowResize());
    this.notify('MISSION START: DEFEND QUARANTINE SECTOR 04');

    this.animate();
  }

  // LOADING SCREEN: the game is paused behind it until the player taps
  // START. That tap is the user gesture browsers require for fullscreen +
  // orientation lock on mobile, so mobile goes fullscreen + landscape on
  // the very first tap. The ring + bar track zombie template/clip loads.
  // START appears only AFTER the ring/bar hit 100% (with a beat so the
  // player actually sees 100% first).
  initLoadingScreen() {
    // Pause gameplay until START (the world still renders behind the screen).
    this.isPaused = true;
    this._loadingDone = false;
    const screen = document.getElementById('loading-screen');
    const fill = document.getElementById('load-fill');
    const ring = document.getElementById('load-ring-fg');
    const pct = document.getElementById('load-pct');
    const tip = document.getElementById('load-tip');
    const startBtn = document.getElementById('load-start');
    if (!screen) { this.isPaused = false; return; }
    const RING_LEN = 326.7; // 2 * PI * 52
    const tips = ['SECTOR 04 — NIGHT PATROL', 'HORDE INBOUND — STAY SHARP', 'CHECK YOUR AMMO', 'THE DEAD DON\u2019T REST'];
    let tipIdx = 0;
    const setProgress = (p) => {
      const pc = Math.round(p * 100);
      if (fill) fill.style.width = pc + '%';
      if (ring) ring.style.strokeDashoffset = (RING_LEN * (1 - p)).toFixed(1);
      if (pct) pct.textContent = pc + '%';
    };
    const tick = () => {
      if (this._loadingDone) return;
      const zm = this.zombieManager;
      // Progress: zombie templates + clips loaded so far (0..1), plus Leon.
      let p = 0.08;
      if (zm) {
        const total = Object.keys(ZOMBIE_TYPES).length + Object.keys(ZOMBIE_CLIPS).length;
        const got = Object.keys(zm.templates).length + Object.keys(zm.clips).length;
        p = 0.08 + 0.82 * (total ? got / total : 0);
      }
      if (this.player && this.player.isSurvivorLoaded) p = Math.max(p, 0.92);
      setProgress(p);
      const ready = zm && zm.loaded && (!this.player || this.player.isSurvivorLoaded);
      if (ready) {
        // Fill to 100% first, THEN reveal START after a beat.
        setProgress(1);
        this._loadingDone = true;
        setTimeout(() => {
          if (tip) tip.textContent = 'ALL SYSTEMS READY';
          if (startBtn) startBtn.classList.remove('hidden');
        }, 650);
        return;
      }
      setTimeout(tick, 200);
    };
    tick();
    // Rotate the flavour tip while loading.
    const tipTimer = setInterval(() => {
      if (this._loadingDone || !tip) { clearInterval(tipTimer); return; }
      tipIdx = (tipIdx + 1) % tips.length;
      tip.textContent = tips[tipIdx];
    }, 2600);
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        // Mobile: fullscreen + landscape on this tap (a real user gesture).
        if (this.isTouch) {
          this.toggleFullscreen();
        }
        screen.classList.add('fading');
        setTimeout(() => screen.classList.add('gone'), 650);
        this.isPaused = false;
        this.notify('MISSION START: DEFEND QUARANTINE SECTOR 04');
      });
    }
    // Failsafe: if loading somehow never completes, let the player in anyway.
    setTimeout(() => {
      if (!this._loadingDone && startBtn) {
        this._loadingDone = true;
        setProgress(1);
        if (tip) tip.textContent = 'ALL SYSTEMS READY';
        startBtn.classList.remove('hidden');
      }
    }, 30000);
  }

  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x06080c);
    this.scene.fog = new THREE.FogExp2(0x06080c, 0.024);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.2, 140);
    this.camera.position.set(0, this.camBaseHeight, this.camBaseOffsetZ);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(this.camera); // Critical: ensures camera children (FPS weapon rig) render in scene!

    // PERFORMANCE: the game was running at 10-11 FPS on a laptop and on
    // mobile. The big costs are (1) pixel ratio — a phone with DPR 2 renders
    // 4x the pixels; (2) antialiasing — very expensive on mobile GPUs;
    // (3) shadows. The REAL killer was the 4 street-lamp point lights each
    // casting shadows (a point-light shadow renders the scene 6x — 24 extra
    // renders/frame); those are now shadow-free in environment.js. So the
    // pixel ratio can be a bit higher without killing FPS: mobile 1.5
    // (sharper than 1, still 2.25x pixels not 4x), desktop capped at 1.5.
    // v3.13 used 1.0 on mobile and it looked blurry — 1.5 is the balance.
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.isTouch, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(this.isTouch ? 1.5 : Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.isTouch ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);
  }

  initEnvironment() {
    this.environment = new CityEnvironment(this.scene);
  }

  initPlayer() {
    this.player = new PlayerOperator(this.scene, this.camera);
  }

  initZombies() {
    // Zombie swarm + waves. game.zombies is the live array (shared reference —
    // the manager mutates it with push/splice, never reassigns it).
    this.zombieManager = new ZombieManager(this.scene, this.environment, this.player, this);
    this.zombies = this.zombieManager.zombies;
    this.extracted = false;
  }

  // Player died: stop the swarm, show the game-over overlay with run stats
  onPlayerDeath() {
    this.isPaused = true;
    const over = document.getElementById('gameover-overlay');
    if (over) {
      const stats = document.getElementById('gameover-stats');
      if (stats) {
        const mins = Math.floor((600 - this.missionSeconds) / 60);
        const secs = Math.floor((600 - this.missionSeconds) % 60);
        stats.textContent = `SURVIVED ${mins}:${secs.toString().padStart(2, '0')} · WAVE ${Math.max(1, this.zombieManager.wave)} · ${this.zombieManager.kills} KILLS · LEVEL ${this.zombieManager.level}`;
      }
      over.classList.remove('hidden');
    }
    if (document.exitPointerLock) document.exitPointerLock();
  }

  // Timer hit zero and the player is still alive: extraction win
  onExtraction() {
    if (this.extracted || this.zombieManager.gameOver) return;
    this.extracted = true;
    this.isPaused = true;
    const over = document.getElementById('gameover-overlay');
    if (over) {
      const title = document.getElementById('gameover-title');
      if (title) title.textContent = 'EXTRACTION COMPLETE';
      const stats = document.getElementById('gameover-stats');
      if (stats) {
        stats.textContent = `YOU SURVIVED THE FULL 10 MINUTES · WAVE ${Math.max(1, this.zombieManager.wave)} · ${this.zombieManager.kills} KILLS · LEVEL ${this.zombieManager.level}`;
      }
      over.classList.remove('hidden');
    }
    if (document.exitPointerLock) document.exitPointerLock();
  }

  initInputListeners() {
    // Keyboard Input
    window.addEventListener('keydown', (e) => {
      this.input.keys[e.code] = true;
      if (e.key === 'Alt') this.input.keys['Alt'] = true;

      if (e.code === 'Space' || e.code === 'AltLeft' || e.code === 'AltRight' || e.key === 'Alt') {
        e.preventDefault();
      }

      // [V] Switch Camera Mode
      if (e.code === 'KeyV') {
        this.cycleCameraMode();
      }

      if (e.code === 'Escape') {
        this.toggleSettingsModal();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.input.keys[e.code] = false;
      if (e.key === 'Alt') {
        this.input.keys['Alt'] = false;
        this.input.keys['AltLeft'] = false;
        this.input.keys['AltRight'] = false;
      }
    });

    // Prevent stuck keys on tab switch, window blur, or modal open
    window.addEventListener('blur', () => {
      this.input.keys = {};
      this.input.mouseLeftHeld = false;
      this.input.mouseRightHeld = false;
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.input.keys = {};
        this.input.mouseLeftHeld = false;
        this.input.mouseRightHeld = false;
      }
    });

    // Mouse Movement & Crosshair
    const crosshairEl = document.getElementById('custom-crosshair');

    window.addEventListener('mousemove', (e) => {
      this.input.mouseScreen.x = e.clientX;
      this.input.mouseScreen.y = e.clientY;

      // Update Custom Reticle Position
      if (crosshairEl) {
        if (this.cameraModes[this.cameraModeIndex] === 'TOP_DOWN') {
          crosshairEl.style.left = `${e.clientX}px`;
          crosshairEl.style.top = `${e.clientY}px`;
        } else {
          crosshairEl.style.left = `50%`;
          crosshairEl.style.top = `50%`;
        }
      }

      this.input.mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.input.mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;

      // In 3rd person / 1st person, mouse movements directly control yaw & pitch!
      if (this.cameraModes[this.cameraModeIndex] !== 'TOP_DOWN' && !this.isPaused) {
        const sens = 0.0022 * this.input.sensitivity;
        const movementX = e.movementX || 0;
        const movementY = e.movementY || 0;

        // Natural mouse look: move mouse left -> camera turns left!
        this.cameraYaw -= movementX * sens;
        this.cameraPitch -= movementY * sens;

        // Clamp pitch so camera doesn't flip upside down
        this.cameraPitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.cameraPitch));
      }
    });

    // Pointer lock for immersive 3rd/1st person modes (desktop only — touch
    // devices use drag-to-look and have no pointer lock).
    this.container.addEventListener('click', () => {
      if (this.isTouch) return;
      if (this.cameraModes[this.cameraModeIndex] !== 'TOP_DOWN' && !this.isPaused) {
        if (this.container.requestPointerLock) {
          this.container.requestPointerLock();
        }
      }
    });

    // Mouse Buttons (desktop only — on touch the Fire/ADS buttons set these
    // flags directly; a synthetic mousedown from a camera-drag touch must
    // never fire the gun).
    window.addEventListener('mousedown', (e) => {
      if (this.isPaused || this.isTouch) return;
      if (e.button === 0) this.input.mouseLeftHeld = true;
      if (e.button === 2) {
        // Hold Right-Click to Aim (Combat Strafe Mode / ADS)
        this.player.isAiming = true;
        this.input.mouseRightHeld = true;
        if (window.soundEngine && window.soundEngine.playScope) window.soundEngine.playScope(true);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isTouch) return;
      if (e.button === 0) this.input.mouseLeftHeld = false;
      if (e.button === 2) {
        // Releasing Right-Click returns immediately to Free-Roam Turning!
        this.player.isAiming = false;
        this.input.mouseRightHeld = false;
        if (window.soundEngine && window.soundEngine.playScope) window.soundEngine.playScope(false);
      }
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // --- MOBILE TOUCH CONTROLS (v3.8, PUBG-style) ---
  // Left thumb: floating virtual joystick (movement). Right thumb: drag the
  // game area to look around, plus icon buttons for every keyboard action.
  // All of it drives the SAME window.input object the keyboard/mouse use,
  // so no player logic is duplicated. Desktop (no touch) never sees this.
  initTouchControls() {
    if (!this.isTouch) return;
    document.body.classList.add('touch');
    const touchUI = document.getElementById('touch-ui');
    if (touchUI) touchUI.setAttribute('aria-hidden', 'false');
    // Short camera label from the start (the HTML ships the long desktop one).
    const camTextEl = document.getElementById('camera-mode-text');
    if (camTextEl) camTextEl.textContent = '3RD';
    const input = this.input;
    const self = this;

    // Keep the touch state in one place so a lost finger never sticks a key.
    const clearTouchInput = () => {
      input.joyX = 0; input.joyY = 0; input.joyActive = false;
      input.keys['ShiftLeft'] = false;
      input.mouseLeftHeld = false;
      input.mouseRightHeld = false;
      ['Space', 'KeyR', 'KeyE', 'AltLeft', 'KeyC', 'KeyK', 'KeyQ'].forEach((k) => { input.keys[k] = false; });
    };
    window.addEventListener('blur', clearTouchInput);
    document.addEventListener('visibilitychange', () => { if (document.hidden) clearTouchInput(); });

    // ---- Virtual joystick (floating: appears where the left thumb lands) ----
    const zone = document.getElementById('joystick-zone');
    const base = document.getElementById('joystick-base');
    const knob = document.getElementById('joystick-knob');
    if (zone && base && knob) {
      const R = 40; // knob travel radius (px) — base is 96px wide
      let joyId = null;
      let cx = 0, cy = 0; // base centre in screen px
      const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px, ${dy}px)`; };
      const endJoy = () => {
        joyId = null;
        setKnob(0, 0);
        input.joyX = 0; input.joyY = 0; input.joyActive = false;
        input.keys['ShiftLeft'] = false;
        // Park the base back at its home spot (clear top so bottom wins)
        base.style.left = '20px'; base.style.top = 'auto'; base.style.bottom = '20px';
      };
      zone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (joyId !== null) return;
        const t = e.changedTouches[0];
        joyId = t.identifier;
        // Float the base to the thumb (clamped inside the zone)
        const zr = zone.getBoundingClientRect();
        cx = Math.max(zr.left + 48, Math.min(t.clientX, zr.right - 48));
        cy = Math.max(zr.top + 48, Math.min(t.clientY, zr.bottom - 48));
        base.style.left = (cx - zr.left - 48) + 'px';
        base.style.top = (cy - zr.top - 48) + 'px';
        base.style.bottom = 'auto';
        input.joyActive = true;
      }, { passive: false });
      zone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          if (t.identifier !== joyId) continue;
          let dx = t.clientX - cx;
          let dy = t.clientY - cy;
          const len = Math.hypot(dx, dy);
          if (len > R) { dx = dx / len * R; dy = dy / len * R; }
          setKnob(dx, dy);
          input.joyX = dx / R;
          input.joyY = dy / R;
          input.joyActive = true;
          // Push the stick to the edge = sprint (PUBG auto-sprint)
          input.keys['ShiftLeft'] = len >= R * 0.92;
        }
      }, { passive: false });
      const joyEnd = (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === joyId) endJoy();
        }
      };
      zone.addEventListener('touchend', joyEnd);
      zone.addEventListener('touchcancel', joyEnd);
    }

    // ---- Camera drag: drag the game area (right side) to look ----
    // Touches on buttons/joystick never reach the container (separate DOM),
    // so this is only the bare game area. Also feeds mouseNDC so top-down
    // aiming follows the last touch point, and moves the crosshair with the
    // finger in TOP_DOWN (like the desktop mouse does).
    let camId = null;
    let lastX = 0, lastY = 0;
    const crosshairEl = document.getElementById('custom-crosshair');
    const moveCrosshair = (x, y) => {
      if (!crosshairEl) return;
      if (this.cameraModes[this.cameraModeIndex] === 'TOP_DOWN') {
        crosshairEl.style.left = x + 'px';
        crosshairEl.style.top = y + 'px';
      } else {
        crosshairEl.style.left = '50%';
        crosshairEl.style.top = '50%';
      }
    };
    const onCamStart = (e) => {
      const t = e.changedTouches[0];
      camId = t.identifier;
      lastX = t.clientX; lastY = t.clientY;
      input.mouseScreen.x = t.clientX;
      input.mouseScreen.y = t.clientY;
      input.mouseNDC.x = (t.clientX / window.innerWidth) * 2 - 1;
      input.mouseNDC.y = -(t.clientY / window.innerHeight) * 2 + 1;
      moveCrosshair(t.clientX, t.clientY);
    };
    const onCamMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== camId) continue;
        e.preventDefault();
        const dx = t.clientX - lastX;
        const dy = t.clientY - lastY;
        lastX = t.clientX; lastY = t.clientY;
        input.mouseScreen.x = t.clientX;
        input.mouseScreen.y = t.clientY;
        input.mouseNDC.x = (t.clientX / window.innerWidth) * 2 - 1;
        input.mouseNDC.y = -(t.clientY / window.innerHeight) * 2 + 1;
        moveCrosshair(t.clientX, t.clientY);
        if (this.cameraModes[this.cameraModeIndex] !== 'TOP_DOWN' && !this.isPaused) {
          const sens = 0.0022 * input.sensitivity * 2.2; // touch needs a bigger gain than a mouse
          this.cameraYaw -= dx * sens;
          this.cameraPitch -= dy * sens;
          this.cameraPitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.cameraPitch));
        }
      }
    };
    const onCamEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === camId) camId = null;
      }
    };
    this.container.addEventListener('touchstart', (e) => {
      e.preventDefault();
      onCamStart(e);
    }, { passive: false });
    this.container.addEventListener('touchmove', onCamMove, { passive: false });
    this.container.addEventListener('touchend', onCamEnd);
    this.container.addEventListener('touchcancel', onCamEnd);

    // ---- Action buttons ----
    // Hold actions set state while the finger is down; tap actions pulse a
    // key once (the player code edge-triggers on those, same as a keypress).
    const pulseKey = (code, ms = 160) => {
      input.keys[code] = true;
      setTimeout(() => { input.keys[code] = false; }, ms);
    };
    const bindBtn = (action, down, up) => {
      const btn = document.querySelector(`#touch-buttons [data-action="${action}"]`);
      if (!btn) return;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { btn.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
        btn.classList.add('active');
        down();
      });
      const release = (e) => {
        if (!btn.classList.contains('active')) return;
        btn.classList.remove('active');
        if (up) up();
      };
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('lostpointercapture', release);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    bindBtn('fire',
      () => { input.mouseLeftHeld = true; },
      () => { input.mouseLeftHeld = false; });
    bindBtn('aim',
      () => { input.mouseRightHeld = true; },
      () => { input.mouseRightHeld = false; });
    bindBtn('jump', () => pulseKey('Space'));
    bindBtn('crouch', () => pulseKey('ControlLeft')); // Ctrl is a toggle in player.js
    bindBtn('reload', () => pulseKey('KeyR'));
    bindBtn('punch', () => pulseKey('KeyE'));
    bindBtn('sprint',
      () => { input.keys['ShiftLeft'] = true; },
      () => { input.keys['ShiftLeft'] = false; });
    bindBtn('dodge', () => pulseKey('AltLeft'));
    bindBtn('roll', () => pulseKey('KeyC'));
    bindBtn('kick', () => pulseKey('KeyK'));
    bindBtn('holster', () => pulseKey('KeyQ'));
    bindBtn('view', () => self.cycleCameraMode());
    bindBtn('fullscreen', () => self.toggleFullscreen());

    // Auto-fullscreen on the FIRST tap anywhere (a user gesture, so the
    // browser allows it). After that the fullscreen button toggles it.
    // (Skips taps on the fullscreen button itself — its own handler toggles —
    // and on the loading screen / START button, which handles fullscreen
    // itself; otherwise START would toggle fullscreen twice.)
    // BUG FIX: the listener was NOT removed when it skipped the START tap,
    // so the player's first gameplay tap (2-3s after START) toggled
    // fullscreen OFF again. Now: if fullscreen is already on, just remove
    // the listener and do nothing.
    const goFullscreenOnce = (e) => {
      if (document.fullscreenElement) {
        document.removeEventListener('touchstart', goFullscreenOnce);
        document.removeEventListener('pointerdown', goFullscreenOnce);
        return;
      }
      if (e.target && e.target.closest && (e.target.closest('[data-action="fullscreen"]') || e.target.closest('#loading-screen'))) return;
      self.toggleFullscreen();
      document.removeEventListener('touchstart', goFullscreenOnce);
      document.removeEventListener('pointerdown', goFullscreenOnce);
    };
    document.addEventListener('touchstart', goFullscreenOnce, { passive: true });
    document.addEventListener('pointerdown', goFullscreenOnce, { passive: true });

    // Top-bar camera box is also tappable on touch (same as the View button).
    const camBox = document.getElementById('camera-mode-box');
    if (camBox) {
      camBox.style.pointerEvents = 'auto';
      camBox.addEventListener('click', () => self.cycleCameraMode());
    }
  }

  // --- Fullscreen (mobile) ---
  // Browsers only allow fullscreen from a user gesture, so we request it on
  // the first tap and also offer the fullscreen button to toggle it back.
  // On entering fullscreen we also try to lock landscape (Android Chrome
  // only — iOS Safari does not support it; wrapped so it never breaks).
  toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen();
      } else {
        const el = document.documentElement;
        const p = el.requestFullscreen ? el.requestFullscreen()
          : (el.webkitRequestFullscreen ? el.webkitRequestFullscreen() : null);
        if (p && p.then) {
          p.then(() => { this.lockLandscape(); }).catch(() => {});
        } else {
          this.lockLandscape();
        }
      }
    } catch (_) { /* fullscreen unavailable — the game still fills the viewport */ }
  }

  lockLandscape() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (_) { /* orientation lock unsupported — user rotates manually */ }
  }

  cycleCameraMode() {
    this.cameraModeIndex = (this.cameraModeIndex + 1) % this.cameraModes.length;
    const mode = this.cameraModes[this.cameraModeIndex];

    const modeTextEl = document.getElementById('camera-mode-text');
    // Touch HUD is icon-first: short 3-letter codes instead of the long label.
    const short = this.isTouch;
    let label = short ? '3RD' : '3RD PERSON (GTA)';
    if (mode === 'TOP_DOWN') label = short ? 'TOP' : 'TOP-DOWN (50°)';
    else if (mode === 'FIRST_PERSON') label = short ? '1ST' : '1ST PERSON (FPS)';

    if (modeTextEl) modeTextEl.textContent = label;
    this.notify(`CAMERA VIEW: ${label}`);

    // If switching to 3rd or 1st person, initialize yaw to player's current facing direction
    if (mode !== 'TOP_DOWN') {
      this.cameraYaw = this.player.mesh.rotation.y;
      this.cameraPitch = 0.05;
      if (!this.isTouch && this.container.requestPointerLock) {
        this.container.requestPointerLock();
      }
    } else {
      if (document.exitPointerLock) {
        document.exitPointerLock();
      }
    }
  }

  initSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const closeBtn = document.getElementById('close-settings-btn');
    const resumeBtn = document.getElementById('resume-game-btn');
    const sensSlider = document.getElementById('sensitivity-slider');
    const sensVal = document.getElementById('sensitivity-val');
    const camSlider = document.getElementById('camera-height-slider');
    const camVal = document.getElementById('cam-height-val');
    const laserSelect = document.getElementById('laser-color-select');
    const sfxToggle = document.getElementById('sfx-toggle');

    if (closeBtn) closeBtn.addEventListener('click', () => this.toggleSettingsModal(false));
    if (resumeBtn) resumeBtn.addEventListener('click', () => this.toggleSettingsModal(false));

    if (sensSlider) {
      sensSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.input.sensitivity = val;
        sensVal.textContent = `${val.toFixed(1)}x`;
      });
    }

    if (camSlider) {
      camSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.camBaseHeight = val;
        this.camBaseOffsetZ = val * 0.75;
        camVal.textContent = `${val}m`;
      });
    }

    if (laserSelect) {
      laserSelect.addEventListener('change', (e) => {
        this.player.setLaserColor(parseInt(e.target.value.replace('#', '0x')));
      });
    }

    if (sfxToggle) {
      sfxToggle.addEventListener('change', (e) => {
        window.soundEngine.enabled = e.target.checked;
      });
    }
  }

  toggleSettingsModal(forceState) {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    if (forceState !== undefined) {
      this.isPaused = forceState;
    } else {
      this.isPaused = !this.isPaused;
    }

    modal.classList.toggle('hidden', !this.isPaused);
    if (this.isPaused) {
      this.input.mouseLeftHeld = false;
      this.input.mouseRightHeld = false;
      if (document.exitPointerLock) document.exitPointerLock();
    }
  }

  async initCrazyGamesSDK() {
    try {
      if (window.CrazyGames && window.CrazyGames.SDK) {
        await window.CrazyGames.SDK.init();
        console.log('[CrazyGames] SDK v3 Initialized successfully.');
        window.CrazyGames.SDK.game.gameplayStart();
      }
    } catch (err) {
      console.warn('[CrazyGames] SDK Init skipped (running in local sandbox):', err);
    }
  }

  notify(text) {
    const container = document.getElementById('game-notifications');
    if (!container) return;
    const item = document.createElement('div');
    item.className = 'tactical-notify';
    item.textContent = text;
    container.appendChild(item);
    setTimeout(() => {
      if (item.parentNode) item.parentNode.removeChild(item);
    }, 2600);
  }

  updateCamera(delta) {
    const isADS = this.player.isAiming;
    const mode = this.cameraModes[this.cameraModeIndex];

    const scopeOverlay = document.getElementById('scope-overlay');
    const crosshairEl = document.getElementById('custom-crosshair');
    const scopeDistEl = document.getElementById('scope-dist');

    if (scopeOverlay) scopeOverlay.classList.toggle('hidden', !isADS);
    if (crosshairEl) crosshairEl.classList.toggle('scoped', isADS);
    if (scopeDistEl) {
      scopeDistEl.textContent = this.player.position.distanceTo(this.player.aimTarget).toFixed(1);
    }

    // ==========================================
    // CAMERA MODE 0: TOP-DOWN (50° Isometric)
    // ==========================================
    if (mode === 'TOP_DOWN') {
      let targetHeight = this.camBaseHeight;
      let targetOffsetZ = this.camBaseOffsetZ;

      const aimDir = new THREE.Vector3().subVectors(this.player.aimTarget, this.player.position);
      aimDir.y = 0;
      const aimDist = aimDir.length();
      if (aimDist > 0.1) aimDir.normalize();

      let targetLookAt = this.player.position.clone();

      if (isADS) {
        // ADS zooms in (lower + closer) but the camera NEVER shifts toward the
        // aim point — the lookAt stays exactly on the player, so the view
        // cannot rotate or drift while walking.
        targetHeight = this.camBaseHeight * 0.65;
        targetOffsetZ = this.camBaseOffsetZ * 0.65;
      }

      this.camCurrentHeight += (targetHeight - this.camCurrentHeight) * Math.min(1, 6.0 * delta);
      this.camCurrentOffsetZ += (targetOffsetZ - this.camCurrentOffsetZ) * Math.min(1, 6.0 * delta);

      const desiredPos = new THREE.Vector3(
        targetLookAt.x,
        this.player.position.y + this.camCurrentHeight,
        targetLookAt.z + this.camCurrentOffsetZ
      );

      this.camera.position.lerp(desiredPos, Math.min(1, 10.0 * delta));
      this.camera.lookAt(targetLookAt.x, this.player.position.y + 0.6, targetLookAt.z);
    }

    // ==========================================
    // CAMERA MODE 1: 3RD PERSON (GTA / Resident Evil 4 Style)
    // ==========================================
    else if (mode === 'THIRD_PERSON') {
      // Smooth dynamic FOV (50° normal -> 30° when scoped)
      const targetFov = isADS ? 30 : 50;

      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, 10.0 * delta);
      this.camera.updateProjectionMatrix();

      // PUBG TPP Over-the-Right-Shoulder Aim View:
      // Steady, fluid camera framing during all stunts (Roll, Shootdodge Dive, Jumps) with zero camera jarring or swapping!
      const distance = isADS ? 2.2 : 3.2;
      const shoulderOffset = isADS ? 0.82 : 0.55;
      const eyeHeight = isADS ? 1.55 : 1.65;

      const cosPitch = Math.cos(this.cameraPitch);
      const sinPitch = Math.sin(this.cameraPitch);
      const cosYaw = Math.cos(this.cameraYaw);
      const sinYaw = Math.sin(this.cameraYaw);

      const forward = new THREE.Vector3(sinYaw * cosPitch, sinPitch, cosYaw * cosPitch).normalize();
      const right = new THREE.Vector3(cosYaw, 0, -sinYaw).normalize();

      const playerFocusPos = new THREE.Vector3(
        this.player.position.x,
        this.player.position.y + eyeHeight,
        this.player.position.z
      );

      const camPos = playerFocusPos.clone()
        .add(right.clone().multiplyScalar(shoulderOffset))
        .sub(forward.clone().multiplyScalar(distance));

      if (camPos.y < this.player.currentGroundY + 0.3) {
        camPos.y = this.player.currentGroundY + 0.3;
      }

      const camLerpRate = 18.0;
      this.camera.position.lerp(camPos, Math.min(1, camLerpRate * delta));
      const lookTarget = this.camera.position.clone().add(forward.clone().multiplyScalar(20));
      this.camera.lookAt(lookTarget);
    }

    // ==========================================
    // CAMERA MODE 2: 1ST PERSON (True FPS View)
    // ==========================================
    else if (mode === 'FIRST_PERSON') {
      const targetFov = isADS ? 38 : 65;
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, 12.0 * delta);
      this.camera.updateProjectionMatrix();

      const cosPitch = Math.cos(this.cameraPitch);
      const sinPitch = Math.sin(this.cameraPitch);
      const cosYaw = Math.cos(this.cameraYaw);
      const sinYaw = Math.sin(this.cameraYaw);

      const forward = new THREE.Vector3(sinYaw * cosPitch, sinPitch, cosYaw * cosPitch).normalize();

      const eyeHeight = 1.62;
      const camPos = new THREE.Vector3(
        this.player.position.x,
        this.player.position.y + eyeHeight,
        this.player.position.z
      );

      this.camera.position.copy(camPos);
      const lookTarget = camPos.clone().add(forward.clone().multiplyScalar(20));
      this.camera.lookAt(lookTarget);
    }
  }

  updateMissionTimer(delta) {
    if (this.missionSeconds > 0) {
      this.missionSeconds -= delta;
      if (this.missionSeconds < 0) this.missionSeconds = 0;

      const mins = Math.floor(this.missionSeconds / 60);
      const secs = Math.floor(this.missionSeconds % 60);
      const ms = Math.floor((this.missionSeconds % 1) * 100);

      const timerEl = document.getElementById('mission-timer');
      if (timerEl) {
        timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
      }
      if (this.missionSeconds <= 0 && !this.extracted) {
        this.onExtraction();
      }
    }
  }

  updateFPS(delta) {
    this.framesCount++;
    this.fpsTimer += delta;
    if (this.fpsTimer >= 0.5) {
      const fps = Math.round((this.framesCount / this.fpsTimer));
      const fpsEl = document.getElementById('fps-display');
      if (fpsEl) fpsEl.textContent = `${fps} FPS`;
      this.framesCount = 0;
      this.fpsTimer = 0;
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Trauma-based camera shake (game-feel): shake = trauma^2, summed sines
  // (smooth, never a per-frame random buzz), decays in real time so it
  // never freezes off-centre. Called AFTER the camera is positioned.
  addTrauma(amount) {
    this.trauma = Math.min(1, (this.trauma || 0) + amount);
  }
  applyCameraShake(realDt) {
    if (!this.trauma || this.trauma <= 0) return;
    this.trauma = Math.max(0, this.trauma - 1.2 * realDt);
    const s = this.trauma * this.trauma;
    this._shakeT = (this._shakeT || 0) + realDt * 30;
    const t = this._shakeT;
    this.camera.position.x += 0.25 * s * Math.sin(t * 1.7);
    this.camera.position.y += 0.18 * s * Math.sin(t * 2.3);
    this.camera.rotation.z += 0.02 * s * Math.sin(t * 1.1);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const rawDelta = Math.min(this.clock.getDelta(), 0.1);
    const timeScale = (this.player && typeof this.player.timeScale === 'number') ? this.player.timeScale : 1.0;
    const delta = rawDelta * timeScale;
    const time = this.clock.getElapsedTime();
    const activeCameraMode = this.cameraModes[this.cameraModeIndex];

    if (!this.isPaused) {
      this.player.update(delta, this.input, this.environment, activeCameraMode);
      if (this.zombieManager) this.zombieManager.update(delta);
      this.environment.update(delta, time);
      this.updateCamera(rawDelta); // Keep camera smooth even during bullet time
      this.applyCameraShake(rawDelta);
      this.updateMissionTimer(rawDelta);
    }

    this.updateFPS(delta);
    this.renderer.render(this.scene, this.camera);
  }
}

// --- Hit feedback helpers (global so player.js / zombies.js can call them) ---
// Hit marker: white X on a hit, gold on a headshot, red on a kill.
window.showHitMarker = function (headshot, isKill) {
  const el = document.getElementById('hitmarker');
  if (!el) return;
  el.classList.toggle('kill', !!isKill);
  el.classList.toggle('headshot', !!headshot && !isKill);
  el.classList.remove('show');
  void el.offsetWidth; // restart the animation
  el.classList.add('show');
};
// Damage vignette: red flash at the screen edges when the player is hit.
window.showDamageVignette = function () {
  const el = document.getElementById('damage-vignette');
  if (!el) return;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
};

window.addEventListener('DOMContentLoaded', () => {
  window.game = new OutbreakGame();
});
