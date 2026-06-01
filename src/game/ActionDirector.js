// ============================================================
// ActionDirector — Cinematic sequencer for Nightfall 3D scenes
// Handles camera moves, effects, temp models, and animation timelines
// ============================================================
import * as THREE from 'three';

const DEFAULT_LOOK = new THREE.Vector3(0, 0, 0);
const HOME_CAM = new THREE.Vector3(15, 14, 18);

export default class ActionDirector {
  constructor({ scene, camera, controls, renderer, labelRenderer }) {
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.renderer = renderer;
    this.labelRenderer = labelRenderer;

    this.tempObjects = new Map(); // name -> THREE.Object3D
    this.highlights = new Map();  // socketId -> { ring, spotlight }
    this.sequenceRunning = false;
    this.orbitLocked = false;
    this.shakeSpring = { x: 0, y: 0, velocityX: 0, velocityY: 0 };
    this.onSequenceEnd = null;
  }

  // --- UTILITY ---
  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  _lerpVec3(from, to, t) {
    return new THREE.Vector3().lerpVectors(from, to, t);
  }

  // --- CAMERA ---

  /** Smoothly move camera to a target position and lookAt over duration (ms) */
  async cameraMove(position, lookAt = DEFAULT_LOOK, duration = 1800) {
    const startPos = this.camera.position.clone();
    const targetPos = new THREE.Vector3(position.x, position.y, position.z);
    const startTarget = this.controls.target.clone();
    const endTarget = new THREE.Vector3(lookAt.x, lookAt.y, lookAt.z);
    const startTime = performance.now();

    return new Promise(resolve => {
      const animate = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        // Ease-out quart (HD-2D cinematic smooth)
        const ease = 1 - Math.pow(1 - t, 4);

        this.camera.position.lerpVectors(startPos, targetPos, ease);
        this.controls.target.lerpVectors(startTarget, endTarget, ease);
        this.controls.update();

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      animate();
    });
  }

  /** Quick zoom-in to a 3D position (dolly) */
  async cameraZoomIn(worldPos, distance = 5, duration = 1200) {
    const pos = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);
    const direction = new THREE.Vector3(1, 0.6, 1).normalize();
    const targetCameraPos = pos.clone().add(direction.multiplyScalar(distance));
    targetCameraPos.y = Math.max(targetCameraPos.y, distance * 0.5);
    return this.cameraMove(targetCameraPos, pos, duration);
  }

  /** Return camera to home position */
  async cameraHome(duration = 1500) {
    this.controls.target.set(0, 0, 0);
    return this.cameraMove(HOME_CAM, DEFAULT_LOOK, duration);
  }

  // --- SCREEN SHAKE ---

  /** Screen shake (uses camera offset, restored by cameraHome) */
  async shake(intensity = 0.4, duration = 600) {
    const startTime = performance.now();
    const origPos = this.camera.position.clone();

    return new Promise(resolve => {
      const shake = () => {
        const elapsed = performance.now() - startTime;
        if (elapsed > duration) {
          this.camera.position.copy(origPos);
          resolve();
          return;
        }
        const decay = 1 - elapsed / duration;
        const dx = (Math.random() - 0.5) * intensity * decay;
        const dy = (Math.random() - 0.5) * intensity * decay;
        const dz = (Math.random() - 0.5) * intensity * decay * 0.5;
        this.camera.position.copy(origPos).add(new THREE.Vector3(dx, dy, dz));
        this.camera.lookAt(this.controls.target);
        requestAnimationFrame(shake);
      };
      shake();
    });
  }

  // --- SCREEN FLASH ---

  /** Create a full-screen colour flash overlay (auto-removed) */
  async flash(color = 0xff0000, opacity = 0.6, fadeOutMs = 800) {
    const geo = new THREE.PlaneGeometry(80, 80);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 2, 0);
    mesh.lookAt(this.camera.position);
    // Attach to camera so it follows
    this.camera.add(mesh);

    const startTime = performance.now();
    return new Promise(resolve => {
      const fade = () => {
        const elapsed = performance.now() - startTime;
        if (elapsed > fadeOutMs) {
          this.camera.remove(mesh);
          geo.dispose();
          mat.dispose();
          resolve();
          return;
        }
        mat.opacity = opacity * (1 - elapsed / fadeOutMs);
        mesh.lookAt(this.camera.position);
        requestAnimationFrame(fade);
      };
      fade();
    });
  }

  // --- ORBIT LOCK ---

  lockOrbit() {
    if (this.controls) {
      this.controls.enabled = false;
      this.orbitLocked = true;
    }
  }

  unlockOrbit() {
    if (this.controls) {
      this.controls.enabled = true;
      this.orbitLocked = false;
    }
  }

  // --- TEMPORARY MODELS ---

  /** Spawn a temporary 3D object */
  spawnModel(name, mesh) {
    if (this.tempObjects.has(name)) {
      this.removeModel(name);
    }
    this.scene.add(mesh);
    this.tempObjects.set(name, mesh);
  }

  /** Remove a temporary 3D object by name */
  removeModel(name) {
    const mesh = this.tempObjects.get(name);
    if (mesh) {
      this.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
      this.tempObjects.delete(name);
    }
  }

  /** Remove all temp models */
  clearTempModels() {
    for (const [name] of this.tempObjects) {
      this.removeModel(name);
    }
  }

  // --- HIGHLIGHT ---

  /** Add a glowing ring + spotlight under a player */
  addHighlight(socketId, position, color = 0xff4444, radius = 1.0) {
    this.removeHighlight(socketId);

    // Glow ring
    const ringGeo = new THREE.RingGeometry(radius * 0.6, radius * 1.0, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(position.x, 0.02, position.z);
    this.scene.add(ring);

    // Spotlight
    const spot = new THREE.SpotLight(color, 1.5, 6, Math.PI / 4, 0.3, 1);
    spot.position.set(position.x, 8, position.z);
    spot.target.position.set(position.x, 0, position.z);
    this.scene.add(spot);
    this.scene.add(spot.target);

    this.highlights.set(socketId, { ring, spot });
  }

  removeHighlight(socketId) {
    const h = this.highlights.get(socketId);
    if (h) {
      this.scene.remove(h.ring);
      h.ring.geometry.dispose();
      h.ring.material.dispose();
      this.scene.remove(h.spot);
      this.scene.remove(h.spot.target);
      this.highlights.delete(socketId);
    }
  }

  clearHighlights() {
    for (const [sid] of this.highlights) {
      this.removeHighlight(sid);
    }
  }

  // --- PARTICLES (simple burst) ---

  /** Spawn a burst of particles at a position */
  spawnParticles(position, count = 30, color = 0xff6600, spread = 2, lifetime = 1500) {
    const particles = [];
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x + (Math.random() - 0.5) * 0.2;
      positions[i * 3 + 1] = position.y + Math.random() * 0.3;
      positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.2;
      velocities.push({
        x: (Math.random() - 0.5) * spread,
        y: Math.random() * spread + 0.5,
        z: (Math.random() - 0.5) * spread,
      });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color,
      size: 0.25,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);

    const startTime = performance.now();
    const animate = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed > lifetime) {
        this.scene.remove(points);
        geo.dispose();
        mat.dispose();
        return;
      }
      const t = elapsed / lifetime;
      const pos = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        pos[i * 3] += velocities[i].x * 0.03;
        pos[i * 3 + 1] += velocities[i].y * 0.03;
        pos[i * 3 + 2] += velocities[i].z * 0.03;
        velocities[i].y -= 0.005; // gravity
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = 1 - t;
      requestAnimationFrame(animate);
    };
    animate();
  }

  // --- BLOOD SPLATTER (ground decal) ---

  /** Create a blood splatter decal on the ground */
  spawnBloodSplatter(position, size = 1.2) {
    const geo = new THREE.CircleGeometry(size * (0.5 + Math.random() * 0.5), 12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x7f1d1d,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(position.x, 0.01, position.z);
    // Random rotation for organic look
    mesh.rotation.z = Math.random() * Math.PI * 2;
    this.scene.add(mesh);
    // Keep for cleanup later
    const name = `blood_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    this.tempObjects.set(name, mesh);
    return name;
  }

  // --- PRESET SEQUENCES ---

  /** Night begins — slow pan across the village, fog roll-in */
  async playNightStart() {
    this.lockOrbit();
    this.controls.target.set(0, 0, 0);

    // Slow camera arc
    const startPos = new THREE.Vector3(20, 12, 20);
    const endPos = new THREE.Vector3(-18, 10, 20);
    const lookAt = new THREE.Vector3(0, 0, 0);

    this.camera.position.copy(startPos);
    this.controls.update();

    const duration = 4000;
    const startTime = performance.now();
    return new Promise(resolve => {
      const arc = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - t, 4);
        this.camera.position.lerpVectors(startPos, endPos, ease);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
        if (t < 1) {
          requestAnimationFrame(arc);
        } else {
          this.unlockOrbit();
          resolve();
        }
      };
      arc();
    });
  }

  /** Werewolf kill — zoom to victim, shake, flash red, blood splatter */
  async playWerewolfKill(victimPosition, victimSocketId) {
    this.lockOrbit();
    this.clearHighlights();

    const pos = new THREE.Vector3(victimPosition.x, 0, victimPosition.z);

    // 1. Slow zoom-in
    await this.cameraZoomIn(pos, 4, 1200);

    // 2. Red flash + shake simultaneously
    await Promise.all([
      this.flash(0xff0000, 0.7, 1000),
      this.shake(0.6, 800),
    ]);

    // 3. Blood splatter + particles
    this.spawnBloodSplatter(victimPosition);
    this.spawnParticles(victimPosition, 40, 0xcc0000, 3, 2000);

    // 4. Highlight victim with red glow
    this.addHighlight(victimSocketId, victimPosition, 0xff4444);

    // 5. Hold for dramatic pause
    await this._sleep(1500);

    // 6. Return camera home
    await this.cameraHome(1500);
    this.unlockOrbit();
  }

  /** Execution (treo cổ) — zoom to defendant, flash gold, add noose effect */
  async playExecution(executedPosition, executedSocketId) {
    this.lockOrbit();
    this.clearHighlights();

    const pos = new THREE.Vector3(executedPosition.x, 0, executedPosition.z);

    await this.cameraZoomIn(pos, 3, 1000);
    await Promise.all([
      this.flash(0xf59e0b, 0.5, 800), // Gold flash
      this.shake(0.3, 700),
    ]);

    this.addHighlight(executedSocketId, executedPosition, 0xf59e0b);
    this.spawnParticles(executedPosition, 20, 0xfbbf24, 2, 1500);

    await this._sleep(1200);
    await this.cameraHome(1500);
    this.unlockOrbit();
  }

  /** Spared — zoom to defendant, flash green */
  async playSpared(sparedPosition, sparedSocketId) {
    this.lockOrbit();
    this.clearHighlights();

    const pos = new THREE.Vector3(sparedPosition.x, 0, sparedPosition.z);

    await this.cameraZoomIn(pos, 4, 1000);
    await this.flash(0x10b981, 0.4, 1000);

    this.addHighlight(sparedSocketId, sparedPosition, 0x10b981);
    await this._sleep(1000);
    await this.cameraHome(1500);
    this.unlockOrbit();
  }

  /** Witch heal — green flash at position */
  async playWitchHeal(playerPosition, playerSocketId) {
    this.lockOrbit();
    this.clearHighlights();

    const pos = new THREE.Vector3(playerPosition.x, 0, playerPosition.z);
    await this.cameraZoomIn(pos, 4, 800);
    await Promise.all([
      this.flash(0x22c55e, 0.45, 900),
      this.shake(0.15, 500),
    ]);
    this.spawnParticles(playerPosition, 25, 0x22c55e, 2, 1200);
    this.addHighlight(playerSocketId, playerPosition, 0x22c55e);
    await this._sleep(800);
    await this.cameraHome(1200);
    this.unlockOrbit();
  }

  /** Game over — dramatic zoom out, pulsing highlight on survivors/winners */
  async playGameOver(winnerPositions, winnerColor = 0xf59e0b) {
    this.lockOrbit();
    this.clearHighlights();
    this.clearTempModels();

    // Highlight all winners
    if (winnerPositions) {
      winnerPositions.forEach((pos, i) => {
        const sid = `winner_${i}`;
        this.addHighlight(sid, pos, winnerColor);
      });
    }

    // Slow zoom out
    const startPos = this.camera.position.clone();
    const endPos = new THREE.Vector3(0, 25, 35);
    const duration = 3000;
    const startTime = performance.now();

    return new Promise(resolve => {
      const arc = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - t, 4);
        this.camera.position.lerpVectors(startPos, endPos, ease);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
        if (t < 1) {
          requestAnimationFrame(arc);
        } else {
          this.unlockOrbit();
          resolve();
        }
      };
      arc();
    });
  }

  /** Seer inspection — zoom, flash blue, then back */
  async playSeerInspect(playerPosition) {
    const pos = new THREE.Vector3(playerPosition.x, 0, playerPosition.z);
    await this.cameraZoomIn(pos, 3.5, 800);
    await this.flash(0x3b82f6, 0.4, 800);
    this.spawnParticles(playerPosition, 15, 0x3b82f6, 1.5, 1000);
    await this._sleep(600);
    await this.cameraHome(1200);
  }

  // --- CLEANUP ---

  cleanup() {
    this.clearTempModels();
    this.clearHighlights();
    this.unlockOrbit();
  }
}
