https://docs.crazygames.com/(bro check this website,everything,every page of developer portal as i want to make a professional game to earn money... so check everything and tell me everything and how can i create game and list ideas for creating an addictive gaame)
12:59 PM
Here is the complete, end-to-end master breakdown of CrazyGames, its developer portal, monetization system, SDK integration, quality & technical rules, and a blueprint for building an addictive, profitable web game.

1. Understanding CrazyGames: How the Platform Works
   CrazyGames is one of the world's premier browser game platforms, serving over 30+ million active players monthly.

The 2-Phase Launch System
CrazyGames does not approve games for immediate full monetization. Instead, they use a data-driven model:

mermaid
graph LR
A["1. Submission & QA"] --> B["2. Basic Launch (7-21 Days)"]
B -->|Hit KPIs: 500+ plays, Playtime 10m+, D1 10%+| C["3. Full Launch (Approved)"]
C --> D["Monetization Unlocked: Ads + Revenue Share"]
Basic Launch (Testing Phase):
Duration: Lasts until the game has been live for at least 7 days AND reached 500 plays (auto-ends at 21 days if 500 plays isn't reached).
Monetization is disabled during this test. No ads are shown to players.
CrazyGames measures your core KPIs: Conversion Rate, Average Playtime, and Day 1 Retention.
You can push game updates anytime without re-review.
Full Launch (Monetized Phase):
If your KPIs hit the target thresholds, CrazyGames invites you to Full Launch.
Ads (Midgame, Rewarded, Banners) are enabled, and you start earning revenue share. 2. Monetization & Payouts: How You Earn Money
Revenue Model
Video Ads: The primary earner. Consists of Midgame ads (interstitials between levels) and Rewarded ads (optional video watched in exchange for in-game perks).
In-Game Banners: Displayed on menus, shops, or garage screens (never during active gameplay).
In-Game Purchases (IAP): Available for top-tier games via Xsolla (invite-only).
Payout Terms & Thresholds
Parameter CrazyGames Policy
Payment Provider Tipalti (global payment automation)
Payment Methods Wire Transfer, Direct Deposit (ACH), eCheck, PayPal
Minimum Payout €100 (earnings accumulate until you hit €100)
Invoicing Threshold €10 (amounts under €10 roll over to next month)
Payment Cycle Contractually NET 60, but typically processed around the 10th of every month (effectively NET 10)
Tax & Verification Complete Steps 1–4 under Developer Portal Account -> Billing (W-8BEN / local tax form). You can select "Hold Payments" if you want to bundle earnings and minimize bank transfer fees. 3. Technical & Submission Requirements
CrazyGames has strict QA checks to ensure games load quickly and don't lag on lower-spec hardware (such as 4GB RAM Chromebooks).

Strict File Limits
Initial Download Size: ≤ 50 MB (or ≤ 20 MB if you want to be featured on the Mobile Homepage!). Measured from load start until the player triggers the first gameplayStart event.
Total File Size: ≤ 250 MB maximum.
File Count: Maximum 1,500 files in your zip bundle.
Paths: You MUST use relative file paths (./assets/bike.png), never absolute paths (/assets/...).
Device & Browser Compatibility
Browsers: Chrome, Edge, Safari, Firefox.
Chromebooks: Games must run smoothly on 4GB RAM Chromium OS laptops.
Mobile & Touch: If mobile is enabled, include touch controls and add this CSS to index.html to prevent accidental magnification or context menus:
css
body, canvas {
-webkit-user-select: none;
-moz-user-select: none;
-ms-user-select: none;
user-select: none;
touch-action: none;
}
iOS Web Audio Fix: iOS suspends the Web Audio API if the user switches tabs or takes a call. You must resume the audio context on user interaction (touchend or pointerdown):
javascript
document.addEventListener('touchend', () => {
if (audioContext && audioContext.state === 'suspended') {
audioContext.resume();
}
}, { passive: true }); 4. CrazyGames SDK v3 Integration (HTML5 / JavaScript)
The CrazyGames SDK is loaded via CDN and initialized asynchronously.

1. Installation (index.html)
html
<head>
  <!-- Load the CrazyGames v3 SDK before your game script -->
  <script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
</head>
2. Initialization (game.js)
   javascript
   async function initCrazyGames() {
   try {
   await window.CrazyGames.SDK.init();
   console.log("CrazyGames SDK initialized. Env:", window.CrazyGames.SDK.environment);
   } catch (err) {
   console.error("SDK Init Error:", err);
   }
   }
3. Gameplay Start & Stop Tracking (Mandatory for QA)
   CrazyGames uses these events to measure your true loading size and stop resource-heavy background processes while players are playing:

javascript
// Call when actual playable gameplay starts or resumes:
window.CrazyGames.SDK.game.gameplayStart();
// Call when player dies, enters pause menu, or level ends:
window.CrazyGames.SDK.game.gameplayStop(); 4. Midgame Video Ads
Show between levels, after round finishes, or on restart.
Never show mid-race or when clicking UI navigation buttons (like settings or shop).
Must pause game and mute audio when adStarted fires; resume and unmute on adFinished OR adError.
Midgame ads have an automatic ~3-minute cooldown managed by the SDK.
javascript
function showMidgameAd(onComplete) {
window.CrazyGames.SDK.ad.requestAd("midgame", {
adStarted: () => {
pauseGame();
muteAudio();
},
adFinished: () => {
unmuteAudio();
resumeGame();
if (onComplete) onComplete();
},
adError: (error) => {
console.warn("Midgame ad error/unfilled:", error);
unmuteAudio();
resumeGame();
if (onComplete) onComplete();
}
});
} 5. Rewarded Video Ads
Player actively clicks to receive a reward (e.g. 2x Coins, Free Stunt Bike, Second Chance Revive).
Never grant the reward if adError occurs! Only grant inside adFinished.
javascript
function showRewardedAd(onSuccess) {
window.CrazyGames.SDK.ad.requestAd("rewarded", {
adStarted: () => {
pauseGame();
muteAudio();
},
adFinished: () => {
unmuteAudio();
resumeGame();
onSuccess(); // Give 2x Coins or perk
},
adError: (error) => {
console.warn("Rewarded ad not completed:", error);
unmuteAudio();
resumeGame();
// Inform player gracefully without penalizing
}
});
} 6. Cloud Save (Data Module)
Acts identically to localStorage, but automatically syncs across the player’s devices when logged into CrazyGames (and falls back to local storage for guests):

javascript
// Save progression
window.CrazyGames.SDK.data.setItem("highScore", "12500");
window.CrazyGames.SDK.data.setItem("unlockedBikes", JSON.stringify(["cycle_1", "cycle_2"]));
// Load progression
const savedScore = window.CrazyGames.SDK.data.getItem("highScore"); 7. Happy Time Celebrations
Trigger confetti and platform celebrations for major milestones (boss defeat, new world unlocked):

javascript
window.CrazyGames.SDK.game.happytime(); 5. The Metrics That Decide Your Success
To pass Basic Launch and get into Full Launch, CrazyGames evaluates three key KPIs:

KPI Top Target How to Achieve It
Conversion Rate 80%+ Keep initial download < 20 MB. Skip 20-second logo sequences; drop players into action in under 5 seconds.
Average Playtime 10+ minutes Satisfying core mechanics, bite-sized replayable loops, gradual difficulty scaling, upgrade tree.
Day 1 Retention 10% – 15% Cloud save (never lose progress!), daily rewards, milestone unlocks, upgrade progression. 6. High-Retention, Addictive Game Concepts for CrazyGames
Based on CrazyGames’ genre performance reports, Driving/Stunt Games, Roguelite Survivors, Idle Tycoons, and Physics Sandbox Arenas yield the highest playtimes and ad conversion rates.

Here are 5 battle-tested concepts designed specifically for the CrazyGames ecosystem:

1. Stunt Flip Master (Physics 2D Bike Runner – e.g., your Flip Cycle game)
   Core Loop: Fast 30-to-60 second runs over procedural neon hills, loop-de-loops, and death-defying cliffs.
   Addictive Hook:
   Risk vs. Reward Air Time: Each mid-air flip charges a Nitro Boost gauge. Triple flip = super supersonic speed.
   Juicy Ragdoll Physics: Hilarious, dramatic crash physics when landing on the rider’s head (satisfying failure state).
   Monetization Fit:
   Post-Run 3x Coin Multiplier (Rewarded Ad).
   One-Chance Crash Shield / Revive (Rewarded Ad).
   Garage Banners: Passive revenue while players tune tires, suspension, and color schemes.
   Test Drive: Drive an insane locked hyper-bike for 1 run (Rewarded Ad).
2. Junkyard Survivor: Demolition Roguelike
   Core Loop: Drive a reinforced beat-up car in an enclosed arena where enemy zombie trucks swarm you. Survive for 10 minutes.
   Addictive Hook:
   Every level-up grants randomized power-ups (roof-mounted circular saws, spiked bumpers, oil slicks, magnetic coin pullers).
   Thousands of chaotic synergies (Vampire Survivors meets Mad Max).
   Monetization Fit:
   Rewarded ad for rerolling perk choices or reviving at the 9-minute mark.
3. Idle Stunt Park Tycoon
   Core Loop: Build mega ramps, loops, and coin rings. AI riders constantly hit the ramps and generate passive cash per trick.
   Addictive Hook:
   Watch riders launch hundreds of feet into giant dartboards, pinball bumpers, and explosive barrels.
   Upgrade ramp height, launch speed, and bike tiers.
   Monetization Fit:
   Double Offline Earnings (Rewarded Ad when returning).
   2-Minute Golden Rush (Rewarded Ad for 5x ramp payouts).
4. Micro Drift Arena (.io Bot Battles)
   Core Loop: Top-down or isometric micro-drifter cars in a shrinking demolition derby ring.
   Addictive Hook:
   Instant matchmaking against snappy, convincing bots with real-looking player names.
   Drifting charges an EMP blast that knocks rivals off the edge.
   Rounds take 90 seconds, encouraging "just one more match".
5. Ragdoll Dismount: Gravity Pit
   Core Loop: Launch stickmen or stunt cycles down endless obstacle courses filled with giant spinning hammers, trampoline pads, and laser grids.
   Addictive Hook:
   Pure visual ASMR and stress relief. Sound design with crunchy bone breaks and coi

n fountain effects.
High score leaderboards for most flips and total damage. 7. Action Plan & Next Steps
Keep Your Core Engine Lightweight: Build on Vanilla Canvas/WebGL or lightweight frameworks (e.g. PixiJS or Phaser) so your bundle stays under 10–15 MB.
First 10 Seconds Matter Most: Drop the player straight onto the track with a 3-second countdown. No complicated text tutorials.
Set Up Developer Portal Account: Sign up on CrazyGames Developer Portal, complete your Tipalti billing info (or select "Hold Payments").
Instrument the SDK v3: Add crazygames-sdk-v3.js, call gameplayStart() as soon as the bike rolls, and connect setItem for high scores.
Submit to Basic Launch: Test your game on the QA preview tool, upload your zip bundle, and monitor your 7-day KPIs on the live dashboard.

---

# 8. SELECTED PROJECT: *OUTBREAK - RESISTANCE* (3D Top-Down Zombie Survival Shooter)
### Official Game Design Document & CrazyGames Specification

---

## A. High Concept & Core Gameplay Loop

* **Title**: *Outbreak: Resistance* (or *Biohazard: 10-Minute Extraction*)
* **Genre**: 3D Top-Down Twin-Stick Action Survival Shooter
* **Platform**: Web (CrazyGames HTML5 / WebGL, 60 FPS in browser on PC and Mobile)
* **Perspective**: 3D Top-Down / Isometric perspective (angled at 50° with smooth camera follow)
* **The 2-Second Hook**: You are a lone mercenary trapped in a dark, quarantined city sector. Move with `WASD`, aim with your mouse crosshair, and pull the trigger. Hundreds of zombies surge through the barricades. Collect bio-luminescent XP gems, unlock perk synergies, defeat mutating bio-horrors, and survive 10 minutes until the evacuation chopper touches down.

```
┌──────────────┐      ┌────────────────────────┐      ┌─────────────────────────┐
│  MAIN MENU   │ ───> │  SURVIVAL ARENA (3D)   │ ───> │ LEVEL-UP PERK SELECTION │
│ (Base Camp & │      │ - WASD Movement        │      │ - Choose 1 of 3 Upgrades│
│  Guns Store) │      │ - Mouse Aim & Trigger  │      │ - Synergize Build       │
└──────────────┘      │ - Timed Wave Spawns    │      └────────────┬────────────┘
       ▲              └───────────┬────────────┘                   │
       │                          │ (Defeat / 10m Extraction)      │
       └──────────────────────────┴────────────────────────────────┘
```

---

## B. Controls, Aiming & Gunplay ("The Feel & Juice")

### Twin-Stick Manual Control Scheme
* **Movement & Locomotion**: 
  * `W`, `A`, `S`, `D`: 8-directional physics-based movement.
  * `Left Shift` (Hold): **Tactical Sprint**:
    * +50% movement speed boost to reposition or escape tight horde pinches.
    * Governed by a visual **Stamina Bar** beneath your health bar (regenerates automatically when jogging or standing still).
  * `Spacebar`: **Jump & Obstacle Vault / Platform Landing**:
    * Full 3D vertical jump physics.
    * Allows jumping onto and **standing directly on top of concrete barriers, sandbags, and crates** to shoot from elevated ground, or leaping over boss shockwaves!
  * `Left Ctrl` or `C`: **Combat Dive Roll / Slide**:
    * Tapping while sprinting initiates a smooth tactical slide.
    * Tapping from normal movement executes a 360° dive roll with 0.4s invulnerability frames.
  * `V`: **Switch Camera Mode**:
    * Cycles between **Top-Down (50° Isometric)**, **3rd Person Over-The-Shoulder (GTA style)**, and **1st Person (FPS)**!
* **Aiming**: 
  * Direct 360° mouse-aim following the cursor with **zero input lag** (custom single tactical reticle; default OS cursor hidden).
  * **Tactical Laser Sight**: Subtle red/green laser projector ray extending from the weapon barrel to the reticle for laser precision.
  * **Custom Sensitivity Settings**: Options menu slider allowing you to adjust mouse DPI scaling and camera responsiveness to your exact comfort.
* **Shooting & Actions**:
  * `Left Mouse Button`: Fire weapon (tap for semi-auto; hold for full-auto spray with recoil spread).
  * `Right Mouse Button` (Hold): **Tactical Scope / ADS Mode (Aim Down Sights)**:
    * **Camera Shift & Zoom**: Camera zooms in smoothly and extends forward toward the cursor, letting you scout and shoot zombies further away in the dark.
    * **Pinpoint Accuracy**: Bullet spread tightens significantly (higher headshot critical hit chance).
    * **Dynamic Reticle / Scope View**: Iron sights/red-dot for rifles/pistols, and a high-tech illuminated sniper scope overlay for scoped weapons.
    * **Tactical Balance**: Move speed slows by 40% while aiming down sights (rewards strategic holding vs. run-and-gun hipfiring).
  * `R`: **Manual Tactical Reload**: Multi-stage realistic firearm foley (mag release click, slide out, fresh mag insert snap, and bolt carrier rack slam).

### Kill Effects, Impact & Screen Feel
* **Dynamic Muzzle Flash Lighting**: Every shot flashes a real-time 3D point-light for 0.05s, illuminating your character model, muzzle smoke, and approaching zombies in the dark.
* **Kinetic Hit Reaction**: Zombies flash white for 60ms on bullet hit and stagger backward with momentum based on weapon caliber.
* **Gore & Decal Stamping**:
  * Critical headshots explode into dark red blood particle bursts and flying skull fragments.
  * Decal system permanently stamps blood pools onto the asphalt texture during the match.
  * Shotguns and explosives produce dismemberment / gibbing effects.
* **Screen Juice**: Subtle camera recoil kick, directional screen shake on heavy shots/explosions, and floating damage numbers (gold for critical hits).

---

## C. The 3D Visual Pipeline (How 3D Web Graphics Work)

To achieve commercial-grade 3D graphics that run at **60 FPS directly in the browser** without heavy loading times:

### 1. Technology & Engine
* **Rendering Engine**: **Three.js** (WebGL 2.0 / WebGPU ready).
* **Bundle Size**: Under 15 MB total download, well below CrazyGames' 50 MB threshold.

### 2. 3D Models & PBR Materials
* **Format**: Low-to-mid poly **GLTF/GLB files** with compressed Draco geometry.
* **Player Model**: SWAT / Mercenary in tactical gear with bone rigging:
  * *Upper Body*: Smoothly rotates 360° following the mouse aim vector.
  * *Lower Body*: Plays 8-way strafe animations matching `WASD` keys.
* **Weapons**: Dedicated 3D gun meshes (Pistol, Shotgun, M4A1, Minigun) parented directly to the player's right-hand bone socket.
* **Zombies**: Varied clothing and skin tones via lightweight vertex color shaders, allowing 100+ active zombies on screen simultaneously without frame drops.

### 3. Atmosphere & Lighting
* **Environment**: Dark quarantine city square—rain-slicked asphalt, broken concrete barricades, flickering amber streetlamps, and burning military barrels.
* **Puddle Reflections**: PBR roughness maps on the ground to reflect streetlights in puddles.
* **Atmospheric Night Fog**: Low-altitude volumetric fog creates high-tension zombie horror atmosphere.

---

## D. Enemy Waves & The Stage 4 Fused Abomination

### Stage 1 (Minute 0–2): The Shamblers
* **Slow Walkers**: Classic shambling infected; teaches player movement, kiting, and early aiming.

### Stage 2 (Minute 2–4): The Sprint
* **Feral Crawlers**: Fast, low-profile zombies running on all fours; forces player to prioritize targets.
* **Mini-Boss (Min 3)**: *Riot Cop Zombie*—carries bulletproof shield; player must flank or use explosives.

### Stage 3 (Minute 4–6): Chemical Biohazard
* **Acid Spitters**: Bloated green zombies that vomit corrosive acid pools you must avoid stepping into.
* **Shadow Stalkers**: Camouflaged zombies that sprint out of dark alleys.

### Stage 4 (Minute 6–8): ⭐ THE AMALGAMATION (*Resident Evil* Fused Nightmare)
* **Visual Appearance**:
  * Towering **3x the player's height**.
  * A horrifying grotesque bio-mass formed of **15+ corpses melted and fused together**.
  * Distorted tangled arms and legs protruding from a massive pulsating torso trunk.
  * 3 screaming, mutated heads embedded into its shoulders and chest.
  * One colossal club-arm formed of fused bone and sinew that drags along the asphalt.
* **Boss Attacks & Player Mechanics Interaction**:
  1. **Ground Shockwave Slam ➔ Countered by JUMP (`Spacebar`)**:
     * Boss raises its giant bone club-arm and slams it into the street, sending an expanding ground-crack shockwave outwards in all directions.
     * **Interaction**: If you are on the ground, you get launched and take heavy damage. Timing a **`Spacebar` Jump** lets you leap over the shockwave completely unharmed!
  2. **Colossal Tentacle Cleave Sweep ➔ Countered by DIVE ROLL (`Ctrl` / `C`)**:
     * Boss sweeps its cluster of fused mutated arms across a wide 180° frontal arc.
     * **Interaction**: The sweep covers too much width to outrun on foot. Timing a **`Ctrl` / `C` Combat Dive Roll** grants 0.4s of invulnerability frames (I-frames) to roll right through the flailing limbs without taking a scratch.
  3. **Rage Charge & Stomp ➔ Countered by TACTICAL SPRINT (`Left Shift`)**:
     * Boss screams from all 3 heads and charges forward in an unstoppable bull-rush to ram the player into barricades.
     * **Interaction**: Normal walk speed is too slow; holding **`Left Shift` (Tactical Sprint)** gives you the burst speed needed to sprint sideways and evade the charge line, causing the boss to crash into a wall and self-stun for 2 seconds.
  4. **Pulsating Bio-Core Weakspots ➔ Countered by SCOPE / ADS (`Right Click`)**:
     * The fused behemoth has **3 glowing orange mutated eyeballs / bio-cores** embedded across its shoulders and torso (*Resident Evil* style).
     * **Interaction**: Normal hipfire spreads bullets against its thick, armored fused-flesh plates (dealing only 25% normal damage). Holding **`Right Click` (Scope / ADS Mode)** zooms the camera in with pinpoint laser accuracy, allowing you to snipe the glowing eyeballs for **massive 300% Critical Damage**, staggering the beast!
  5. **Parasite Detachment (Swarm Threat)**:
     * When damaged, clusters of fused mini-crawlers tear off the boss's back and rush you, forcing you to balance distance, jumping over puddles, and managing ammo.

### Stage 5 (Minute 8–10): The Final Extraction
* Total outbreak—all enemy types pour in from every breach.
* At **10:00**, an evacuation helicopter arrives. A spotlight illuminates a green LZ zone on the ground. Hold the zone for 15 seconds to escape.

---

## E. Weapon Arsenal & 3-Card Level Up System

Defeated zombies drop glowing green pathogen vials (XP). Collecting them fills the XP gauge. Each level-up pauses action and presents **3 tactical perk cards**:

### Weapons (Can equip up to 2 primary guns)
1. **Tactical 9mm Pistol**: High accuracy, fast reload, piercing upgrades.
2. **Combat Shotgun**: Wide spread, devastating close-range stopping power and knockback.
3. **M4A1 Assault Rifle**: Rapid-fire military rifle, laser accuracy at mid-range.
4. **Heavy Minigun**: High fire rate, slight movement penalty, melts bosses.
5. **Grenade Launcher**: Arc projectile causing massive explosive area-of-effect gibs.

### Passive Equipment & Support
* **Claymore Mines**: Placed automatically behind you; detonates when zombies step near.
* **Automated Sentry Turret**: Placed on the floor to cover rear angles.
* **Shock Drone**: Hovering drone that electrocutes the nearest 2 enemies every 3 seconds.
* **Laser Sight Upgrade**: +15% Critical hit chance.
* **Adrenaline Surge**: +25% Move speed and +30% reload speed when below 30% health.

---

## F. CrazyGames SDK v3 Integration Matrix

| Game Event | SDK Method | CrazyGames Rule |
| :--- | :--- | :--- |
| **Drop Into Arena** | `window.CrazyGames.SDK.game.gameplayStart()` | Called immediately when gameplay begins |
| **Player Dies / Wins** | `window.CrazyGames.SDK.game.gameplayStop()` | Called immediately when game loop pauses/ends |
| **Post-Game Transition** | `window.CrazyGames.SDK.ad.requestAd("midgame")` | Runs only between runs (respects 3-minute cooldown) |
| **1-Time Revive Offer** | `window.CrazyGames.SDK.ad.requestAd("rewarded")` | Grants **1 Second Chance Revive** (50% HP + 3s shield) |
| **Double Run Gold** | `window.CrazyGames.SDK.ad.requestAd("rewarded")` | Multiplies run cash x2 on the victory/game-over screen |
| **Cloud Progression** | `window.CrazyGames.SDK.data.setItem()` | Saves high score time, permanent base camp unlocks, and kills |

---

## G. Complete Milestone Roadmap (Build in Order)

* **Milestone 1 (3D Foundation & Movement)**: Set up Three.js scene, top-down isometric camera, ground grid/street shader, player character with smooth WASD physics and mouse-look rotation.
* **Milestone 2 (Manual Aiming, Laser Sight & Gunplay)**: Custom crosshair cursor, laser sight ray, projectile pooling, dynamic muzzle flashes, and realistic recoil.
* **Milestone 3 (Zombie Swarm AI & Horde Spawner)**: Spawner system, pathfinding toward player, hit detection, health system, and blood decal projection.
* **Milestone 4 (Gore, Kill FX & Juice)**: Headshot gib particles, floating damage numbers, camera shake, and spatial sound effects.
* **Milestone 5 (Stage 4 Resident Evil Fused Boss)**: Model/rig the multi-limbed Amalgamation boss, boss health bar, slam shockwaves, and minion detachment.
* **Milestone 6 (XP Gems & 3-Card Level-Up Draft)**: Pathogen vials drop on kill, vacuum magnet pickup, XP bar, modal perk draft screen.
* **Milestone 7 (CrazyGames SDK & Cloud Save)**: Full SDK lifecycle implementation, rewarded ad hooks, audio muting during ads, and save persistence.

