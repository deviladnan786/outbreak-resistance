/**
 * Audio Engine (Web Audio API) — REAL recorded sounds + procedural fallback.
 * Real MP3 samples live in assets/audio/ (SoundBible CC-BY 3.0 + one public
 * domain groan; see assets/audio/AUDIO_CREDITS.txt). Samples are fetched
 * and decoded into buffers on first user interaction (autoplay policy).
 * If a sample fails to load, the method falls back to the old synth so the
 * game never goes silent.
 */
const AUDIO_SAMPLES = {
  gunshot: 'assets/audio/gunshot.mp3',
  hitTick: 'assets/audio/hit_tick.mp3',
  hurt: 'assets/audio/player_hurt.mp3',
  zombieAttack: 'assets/audio/zombie_attack.mp3',
  zombieDeath: 'assets/audio/zombie_death.mp3',
  groan1: 'assets/audio/zombie_groan1.mp3',
  groan2: 'assets/audio/zombie_groan2.mp3',
  groan3: 'assets/audio/zombie_groan3.mp3',
  punch: 'assets/audio/melee_punch.mp3',
  ambient: 'assets/audio/ambient_drone.mp3'
};

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterGain = null;
    this.buffers = {}; // name -> AudioBuffer (decoded real samples)
    this._ambientStarted = false;
    this._groanNames = ['groan1', 'groan2', 'groan3'];
    // v3.22 — home-screen theme music (synthesized, no audio file).
    this._menuMusic = null;
    this._menuMusicEnabled = true;
    this.initOnInteraction();
  }

  // Create the AudioContext on first user interaction (autoplay policy).
  // Split out so the match-start path can ensure audio exists too.
  ensureContext() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
    this.loadSamples();
    return this.ctx;
  }

  initOnInteraction() {
    const unlock = () => {
      if (!this.ctx) {
        this.ensureContext();
        // v3.22: on the menu, start the theme music (not the in-game
        // ambient drone — that starts when the match starts).
        if (!window.game || !window.game._matchStarted) this.startMenuMusic();
        else this.startAmbient();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  // Fetch + decode every real sample. Failures are silent (synth fallback).
  loadSamples() {
    for (const [name, url] of Object.entries(AUDIO_SAMPLES)) {
      fetch(url)
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then((buf) => this.ctx.decodeAudioData(buf))
        .then((audioBuf) => { this.buffers[name] = audioBuf; })
        .catch(() => { /* keep synth fallback */ });
    }
  }

  // Play a decoded real sample through the master gain. Returns true if played.
  playSample(name, volume = 1) {
    if (!this.ctx || !this.enabled) return false;
    const buf = this.buffers[name];
    if (!buf) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), this.ctx.currentTime);
    src.connect(g);
    g.connect(this.masterGain);
    src.start();
    return true;
  }

  // Dark horror ambient drone, looped quietly underneath everything.
  startAmbient() {
    if (this._ambientStarted || !this.ctx) return;
    this._ambientStarted = true;
    const tryStart = () => {
      const buf = this.buffers['ambient'];
      if (!buf) { setTimeout(tryStart, 500); return; }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.22, this.ctx.currentTime);
      src.connect(g);
      g.connect(this.masterGain);
      src.start();
    };
    tryStart();
  }

  // ================================================================
  // v3.22 — HOME SCREEN THEME MUSIC (fully synthesized, no audio file,
  // no licensing risk). Mood: zombie-apocalypse — dark, atmospheric,
  // tense but beautiful. Slow minor-key pad chords (Am – F – Dm – E,
  // 4s each), a sparse haunting A-minor-pentatonic melody through a
  // feedback delay, and a low sub pulse. A 16s loop driven by a
  // lookahead scheduler, so it loops seamlessly. Quiet (tasteful).
  // Starts on first user interaction (autoplay policy); fades out when
  // the match starts (stopMenuMusic) and the ambient drone takes over.
  // ================================================================
  startMenuMusic() {
    if (!this.ctx || this._menuMusic || !this._menuMusicEnabled) return;
    const ctx = this.ctx;
    const musicGain = ctx.createGain();
    musicGain.gain.setValueAtTime(this.enabled ? 0.12 : 0, ctx.currentTime);
    musicGain.connect(this.masterGain);
    // Feedback delay for the melody — space and haunt.
    const delay = ctx.createDelay(1.0);
    delay.delayTime.setValueAtTime(0.42, ctx.currentTime);
    const fb = ctx.createGain();
    fb.gain.setValueAtTime(0.35, ctx.currentTime);
    const wet = ctx.createGain();
    wet.gain.setValueAtTime(0.5, ctx.currentTime);
    delay.connect(fb); fb.connect(delay);
    delay.connect(wet); wet.connect(musicGain);
    this._menuMusic = {
      gain: musicGain, delay, fb, wet,
      timer: null, step: 0, nextTime: ctx.currentTime + 0.1, padNodes: []
    };
    this._menuMusic.timer = setInterval(() => this._menuMusicTick(), 200);
    console.log('[Audio] Menu theme started.');
  }

  _menuMusicTick() {
    const m = this._menuMusic;
    if (!m || !this.ctx) return;
    const ctx = this.ctx;
    // Respect the mute toggle live (the settings checkbox assigns
    // soundEngine.enabled directly).
    m.gain.gain.setTargetAtTime(this.enabled ? 0.12 : 0, ctx.currentTime, 0.1);
    // If the tab was throttled, skip missed steps instead of bursting.
    if (m.nextTime < ctx.currentTime - 0.1) m.nextTime = ctx.currentTime + 0.1;
    // Schedule ahead so the loop never gaps.
    while (m.nextTime < ctx.currentTime + 0.6) {
      this._menuMusicScheduleStep(m.step, m.nextTime);
      m.step = (m.step + 1) % 32;
      m.nextTime += 0.5;
    }
  }

  _menuMusicScheduleStep(step, t) {
    const m = this._menuMusic;
    if (!m) return;
    const ctx = this.ctx;
    // Chord progression: Am – F – Dm – E, one chord per 8 steps (4s).
    const CHORDS = [
      [110.00, 130.81, 164.81], // Am
      [87.31, 110.00, 130.81],  // F
      [73.42, 87.31, 110.00],   // Dm
      [82.41, 103.83, 123.47]   // E (harmonic-minor tension)
    ];
    if (step % 8 === 0) {
      // Release the previous chord's nodes (their 4.6s life is nearly
      // over; the new chord's attack masks the cut) — keeps the node
      // list bounded on a long menu session.
      for (const n of m.padNodes) { try { if (n.disconnect) n.disconnect(); } catch (_) { /* noop */ } }
      m.padNodes = [];
      const chord = CHORDS[(step / 8) | 0];
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(750, t);
      filt.connect(m.gain);
      m.padNodes.push(filt);
      for (let i = 0; i < chord.length; i++) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(chord[i], t);
        osc.detune.setValueAtTime(i % 2 === 0 ? -4 : 4, t);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.14, t + 1.5);
        g.gain.setValueAtTime(0.14, t + 2.5);
        g.gain.linearRampToValueAtTime(0, t + 4.5);
        osc.connect(g); g.connect(filt);
        osc.start(t); osc.stop(t + 4.6);
        m.padNodes.push(osc, g);
      }
    }
    // Sparse haunting melody (A minor pentatonic) — one note per phrase.
    const MELODY = [0, 0, 659.25, 0, 0, 0, 523.25, 0, 0, 0, 440.00, 0, 0, 0, 392.00, 0, 0, 0, 659.25, 0, 0, 0, 587.33, 0, 0, 0, 523.25, 0, 0, 0, 440.00, 0];
    const note = MELODY[step];
    if (note) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
      osc.connect(g); g.connect(m.gain); g.connect(m.delay);
      osc.start(t); osc.stop(t + 1.5);
    }
    // Low sub pulse every 4s (offset by half a bar from the chord).
    if (step % 8 === 4) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.3, t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      osc.connect(g); g.connect(m.gain);
      osc.start(t); osc.stop(t + 1.0);
    }
  }

  // Fade the theme out (match start) and tear the scheduler down.
  stopMenuMusic(fadeSec = 1.5) {
    const m = this._menuMusic;
    if (!m) return;
    this._menuMusic = null;
    if (m.timer) clearInterval(m.timer);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    m.gain.gain.setTargetAtTime(0, t, Math.max(0.1, fadeSec / 3));
    const nodes = m.padNodes.slice();
    const delay = m.delay;
    const gain = m.gain;
    setTimeout(() => {
      try {
        for (const n of nodes) { try { if (n.stop) n.stop(); } catch (_) { /* already stopped */ } if (n.disconnect) n.disconnect(); }
        if (delay) delay.disconnect();
        if (gain) gain.disconnect();
      } catch (_) { /* teardown best-effort */ }
    }, fadeSec * 1000 + 300);
  }

  // Menu-music mute toggle (Settings). Off stops the theme; on restarts
  // it if the menu is still showing.
  setMenuMusicEnabled(on) {
    this._menuMusicEnabled = !!on;
    if (!on) {
      this.stopMenuMusic(0.5);
    } else if (this.ctx && (!window.game || !window.game._matchStarted)) {
      this.startMenuMusic();
    }
  }

  // A zombie groan from the nearest zombie; volume scales with closeness
  // (1 = right next to the player, 0 = too far to hear). Picks a random
  // groan variant so it doesn't repeat the same file every time.
  playGroan(volume) {
    if (!this.ctx || !this.enabled) return;
    const v = Math.max(0, Math.min(1, volume));
    if (v < 0.05) return;
    const name = this._groanNames[Math.floor(Math.random() * this._groanNames.length)];
    this.playSample(name, v * 0.9);
  }

  // Player hurt grunt (real recording) when a zombie's attack lands.
  playHurt() {
    if (!this.playSample('hurt', 0.9)) {
      // synth fallback: low pained thud
      if (!this.ctx || !this.enabled) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.2);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain); gain.connect(this.masterGain);
      osc.start(now); osc.stop(now + 0.25);
    }
  }

  // Zombie attack snarl when a zombie starts its swing.
  playZombieAttack() {
    this.playSample('zombieAttack', 0.8);
  }

  // Zombie death groan when a zombie is killed.
  playZombieDeath() {
    this.playSample('zombieDeath', 0.85);
  }

  playFootstep(isSprint = false) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    const baseFreq = isSprint ? 90 : 70;
    osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.08);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, this.ctx.currentTime);

    gain.gain.setValueAtTime(isSprint ? 0.25 : 0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playJump() {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  playLand() {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playSlide() {
    if (!this.ctx || !this.enabled) return;
    // White noise buffer for ground friction slide
    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(250, this.ctx.currentTime + 0.25);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start();
    noise.stop(this.ctx.currentTime + 0.26);
  }

  playScope(scopedIn) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    if (scopedIn) {
      osc.frequency.setValueAtTime(450, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08);
    } else {
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(350, this.ctx.currentTime + 0.08);
    }

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  // Gunshot: real M4A1 recording. (The game calls playShoot(); playGunfire
  // is the old name — both now play the real sample.)
  playShoot() {
    if (this.playSample('gunshot', 0.9)) return;
    this.playGunfireSynth();
  }
  playGunfire() {
    this.playShoot();
  }
  playGunfireSynth() {
    if (!this.ctx || !this.enabled) return;
    // Punchy gunshot noise burst + low-end thud (synth fallback)
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.08);
    oscGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.09);

    const bufferSize = this.ctx.sampleRate * 0.12;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.03));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    nGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
    noise.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start();
  }

  // Realistic Multi-Stage Weapon Reload Foley
  // Hit marker tick: real click sample; headshot gets a second tick.
  playHit(headshot = false) {
    if (!this.enabled || !this.ctx) return;
    if (this.playSample('hitTick', 0.9)) {
      if (headshot) setTimeout(() => this.playSample('hitTick', 0.9), 70);
      return;
    }
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(headshot ? 1900 : 1400, now);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain); gain.connect(this.masterGain);
    osc.start(now); osc.stop(now + 0.08);
    if (headshot) {
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(2400, now + 0.07);
      gain2.gain.setValueAtTime(0.22, now + 0.07);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc2.connect(gain2); gain2.connect(this.masterGain);
      osc2.start(now + 0.07); osc2.stop(now + 0.16);
    }
  }

  playReload() {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;

    // Helper: Short metallic click/snap
    const playClick = (time, freq, gainVal = 0.25) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(120, time + 0.04);
      gain.gain.setValueAtTime(gainVal, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(time);
      osc.stop(time + 0.05);
    };

    // Helper: Metal friction scrape/slide
    const playScrape = (time, duration, startFreq, endFreq, gainVal = 0.15) => {
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.7;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(startFreq, time);
      filter.frequency.exponentialRampToValueAtTime(endFreq, time + duration);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(gainVal, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(time);
      noise.stop(time + duration);
    };

    // Stage 1 (0.0s): Magazine Release Catch & Ejection Slide Out
    playClick(now, 1400, 0.35);
    playScrape(now + 0.04, 0.22, 1200, 450, 0.18);

    // Stage 2 (0.35s): Tactical pouch rustle & fresh magazine handling
    playScrape(now + 0.35, 0.18, 550, 850, 0.12);

    // Stage 3 (0.65s): Magazine Insert & Heavy Mechanical Lock Clank
    setTimeout(() => {
      if (!this.ctx) return;
      const t3 = this.ctx.currentTime;
      playClick(t3, 1100, 0.35);
      playClick(t3 + 0.04, 520, 0.4); // Solid deep latch thud
      playScrape(t3, 0.1, 900, 1600, 0.2);
    }, 650);

    // Stage 4 (1.05s): Charging Handle Bolt Rack & Spring Snap Forward
    setTimeout(() => {
      if (!this.ctx) return;
      const t4 = this.ctx.currentTime;
      playScrape(t4, 0.12, 1600, 800, 0.25); // Pull back
      playClick(t4 + 0.12, 1800, 0.45);      // Heavy bolt slam
      playClick(t4 + 0.14, 380, 0.4);       // Steel chamber lock
    }, 1050);
  }

  playSlowMo(entering = true) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    const now = this.ctx.currentTime;
    if (entering) {
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.4);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(180, now + 0.4);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    } else {
      osc.frequency.setValueAtTime(45, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.25);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    }
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(now + 0.5);
  }

  playKick() {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    // Whoosh
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(now + 0.2);
  }

  playFlyingDropkick() {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.35);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(now + 0.38);
  }

  playPunch() {
    if (this.playSample('punch', 0.9)) return;
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    // Fast boxing whoosh + thud impact (synth fallback)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(now + 0.15);
  }

  playWeaponSling() {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(950, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(now + 0.1);
  }

  playWallRun() {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    // Athletic wall shoe scuff friction
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.14);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.05));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.Q.setValueAtTime(2.5, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.13);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
  }

  playWallBackflip() {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    // Powerful wall spring push + whoosh
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.12);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.35);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.38);
  }
}

window.soundEngine = new SoundEngine();
