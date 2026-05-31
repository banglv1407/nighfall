import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ============================================================
// COLORS
// ============================================================
const COLORS = {
  bg: 0x0d0d1a,
  ground: 0x1a2a1a,
  groundAccent: 0x2d3d2d,
  houseWall: 0x4a3a2a,
  houseRoof: 0x6b2a2a,
  houseTrim: 0x8B7355,
  treeTrunk: 0x4a3a2a,
  treeLeaves: 0x1a5a1a,
  path: 0x3a3a2a,
  fire: 0xff8844,
};

const BODY_COLORS = {
  male:    0x3b82f6,
  female:  0xec4899,
  neutral: 0x10b981,
};

const SKIN_COLOR = 0xf5d6c6;

const VILLAGE_CENTER = new THREE.Vector3(0, 0, 0);

// ============================================================
// Village3D Component
// ============================================================
const Village3D = forwardRef(({ players, mySocketId, onMoveTo, onInteract, phase }, ref) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  const labelRendererRef = useRef(null);
  const playerMeshesRef = useRef({});
  const animFrameRef = useRef(null);
  const fireParticlesRef = useRef([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const initializedRef = useRef(false);

  // --- Init Three.js scene ---
  const initScene = useCallback(() => {
    if (initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;

    const container = containerRef.current;
    const w = container.clientWidth;
    const h = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.bg);
    scene.fog = new THREE.Fog(COLORS.bg, 25, 45);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 60);
    camera.position.set(12, 10, 14);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // CSS2D Renderer (labels)
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(w, h);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);
    labelRendererRef.current = labelRenderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 4;
    controls.maxDistance = 30;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    // Lights
    const ambient = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0x4444aa, 0x222244, 0.6);
    scene.add(hemi);

    const moon = new THREE.DirectionalLight(0x8888ff, 1.2);
    moon.position.set(-8, 15, 5);
    moon.castShadow = true;
    moon.shadow.mapSize.width = 1024;
    moon.shadow.mapSize.height = 1024;
    moon.shadow.camera.near = 0.1;
    moon.shadow.camera.far = 30;
    moon.shadow.camera.left = -15;
    moon.shadow.camera.right = 15;
    moon.shadow.camera.top = 15;
    moon.shadow.camera.bottom = -15;
    scene.add(moon);

    const fill = new THREE.DirectionalLight(0x6666cc, 0.3);
    fill.position.set(5, 3, -8);
    scene.add(fill);

    // Warm accent lights
    const warmPositions = [[4, 3, 4], [-4, 3, -4], [4, 3, -4], [-4, 3, 4], [0, 3, 0]];
    warmPositions.forEach(([x, y, z]) => {
      const pl = new THREE.PointLight(0xff8844, 0.5, 10);
      pl.position.set(x, y, z);
      scene.add(pl);
    });

    // --- Build Village ---
    buildGround(scene);
    buildPath(scene);
    buildHouses(scene);
    buildTrees(scene);
    buildFence(scene);
    buildWell(scene);
    buildCampfire(scene, fireParticlesRef);
    buildLanterns(scene);

    // --- Click handler ---
    const handleClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      // Check ground intersection
      const groundObjects = [];
      scene.traverse((obj) => {
        if (obj.userData.isGround) groundObjects.push(obj);
      });
      const intersects = raycasterRef.current.intersectObjects(groundObjects);
      if (intersects.length > 0 && onMoveTo) {
        const pt = intersects[0].point;
        onMoveTo(pt.x, pt.z);
      }
    };
    renderer.domElement.addEventListener('click', handleClick);

    // --- Resize ---
    const handleResize = () => {
      const w2 = container.clientWidth;
      const h2 = container.clientHeight;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
      labelRenderer.setSize(w2, h2);
    };
    window.addEventListener('resize', handleResize);

    // --- Animation loop ---
    const clock = new THREE.Clock();
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Animate fire
      fireParticlesRef.current.forEach((p, i) => {
        const speed = p.userData.speed || 1;
        const drift = p.userData.drift || 0;
        p.position.y += 0.01 * speed;
        p.position.x += Math.sin(time * 2 + i) * 0.002;
        p.position.z += Math.cos(time * 2 + i * 0.7) * 0.002;
        p.material.opacity = Math.max(0, 1 - (p.position.y - 0.1) / 2.5);
        const s = 0.3 + Math.sin(time * 3 + i) * 0.15;
        p.scale.set(s, s, s);
        if (p.position.y > 2.5) {
          p.position.set(
            (Math.random() - 0.5) * 0.5,
            0.1,
            (Math.random() - 0.5) * 0.5,
          );
          p.material.opacity = 0.8;
        }
      });

      // Animate floating labels
      Object.values(playerMeshesRef.current).forEach((entry) => {
        if (entry.label) {
          entry.label.position.y = 1.6 + Math.sin(time * 0.8 + (entry.id || 0)) * 0.05;
        }
      });

      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleClick);
      renderer.dispose();
      labelRenderer.domElement.remove();
      container.innerHTML = '';
    };
  }, [onMoveTo]);

  // Init on mount
  useEffect(() => {
    const cleanup = initScene();
    return () => {
      if (typeof cleanup === 'function') cleanup();
      initializedRef.current = false;
    };
  }, [initScene]);

  // --- Update players ---
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const renderer = rendererRef.current;
    const labelRenderer = labelRendererRef.current;

    if (!players || !Object.keys(players).length) return;

    // Remove disconnected players
    const activeIds = new Set(Object.keys(players));
    Object.keys(playerMeshesRef.current).forEach((sid) => {
      if (!activeIds.has(sid)) {
        const entry = playerMeshesRef.current[sid];
        if (entry.group) scene.remove(entry.group);
        if (entry.label) scene.remove(entry.label);
        if (entry.group) {
          entry.group.traverse((child) => {
            if (child.isMesh) {
              child.geometry?.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach((m) => m.dispose());
              } else {
                child.material?.dispose();
              }
            }
          });
        }
        delete playerMeshesRef.current[sid];
      }
    });

    // Add/update players
    Object.entries(players).forEach(([sid, p]) => {
      if (!p.online) return;
      const isMe = sid === mySocketId;

      if (!playerMeshesRef.current[sid]) {
        // Create new character group
        const group = createVillager(p.gender, p.hairStyle, p.hairColor);
        group.userData.socketId = sid;
        group.userData.isPlayer = true;

        // Name label
        const div = document.createElement('div');
        div.style.color = isMe ? '#8b5cf6' : '#e2e8f0';
        div.style.fontFamily = "'Cinzel', serif";
        div.style.fontSize = '11px';
        div.style.fontWeight = 'bold';
        div.style.textShadow = '0 1px 4px rgba(0,0,0,0.8)';
        div.style.background = isMe ? 'rgba(139,92,246,0.2)' : 'rgba(0,0,0,0.5)';
        div.style.padding = '2px 8px';
        div.style.borderRadius = '8px';
        div.style.backdropFilter = 'blur(4px)';
        div.style.border = isMe ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.1)';
        div.style.whiteSpace = 'nowrap';
        div.textContent = `${isMe ? '👉 ' : ''}${p.username}${p.isAdmin ? ' 👑' : ''}`;

        const label = new CSS2DObject(div);
        label.position.set(0, 1.8, 0);

        group.add(label);

        group.position.set(p.x ?? 400, 0, p.y ?? 300);
        scene.add(group);
        playerMeshesRef.current[sid] = { group, label, id: sid };
      } else {
        // Update position
        const entry = playerMeshesRef.current[sid];
        const target = new THREE.Vector3(p.x ?? 400, 0, p.y ?? 300);
        entry.group.position.lerp(target, 0.15);
      }
    });
  }, [players, mySocketId, phase]);

  // Re-render on resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current || !labelRendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
      labelRendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Expose flyTo function
  useImperativeHandle(ref, () => ({
    flyTo: (x, z) => {
      if (controlsRef.current) {
        controlsRef.current.target.set(x, 0, z);
      }
    },
  }));

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ cursor: 'grab' }}
      onMouseDown={() => { if (containerRef.current) containerRef.current.style.cursor = 'grabbing'; }}
      onMouseUp={() => { if (containerRef.current) containerRef.current.style.cursor = 'grab'; }}
    />
  );
});

Village3D.displayName = 'Village3D';

// ============================================================
// BUILDING FUNCTIONS
// ============================================================

function buildGround(scene) {
  // Main ground
  const groundGeo = new THREE.CircleGeometry(22, 48);
  const groundMat = new THREE.MeshStandardMaterial({
    color: COLORS.ground,
    roughness: 0.9,
    metalness: 0.0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  ground.userData.isGround = true;
  scene.add(ground);

  // Grid overlay
  const grid = new THREE.GridHelper(40, 20, 0x444466, 0x333355);
  grid.position.y = 0.01;
  grid.material.opacity = 0.3;
  grid.material.transparent = true;
  scene.add(grid);
}

function buildPath(scene) {
  const pathMat = new THREE.MeshStandardMaterial({
    color: COLORS.path,
    roughness: 1,
    metalness: 0,
  });
  const positions = [
    { x: 0, z: 0, w: 2.4, h: 10, rot: 0 },
    { x: 0, z: -8, w: 2, h: 3, rot: 0 },
    { x: 0, z: 8, w: 2, h: 3, rot: 0 },
    { x: -8, z: 0, w: 2, h: 3, rot: Math.PI / 2 },
    { x: 8, z: 0, w: 2, h: 3, rot: Math.PI / 2 },
  ];
  positions.forEach((p) => {
    const geo = new THREE.PlaneGeometry(p.w, p.h);
    const mesh = new THREE.Mesh(geo, pathMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = p.rot;
    mesh.position.set(p.x, 0.01, p.z);
    mesh.receiveShadow = true;
    scene.add(mesh);
  });
}

function buildHouses(scene) {
  const houses = [
    { x: -7, z: -6, rot: 0, color: 0x5a4a3a, roofColor: 0x6b2a2a },
    { x: 7, z: -6, rot: Math.PI, color: 0x4a5a3a, roofColor: 0x8B4513 },
    { x: -7, z: 6, rot: 0, color: 0x3a4a3a, roofColor: 0x6b3a2a },
    { x: 7, z: 6, rot: Math.PI, color: 0x5a3a3a, roofColor: 0x4a2a2a },
  ];
  houses.forEach((h) => createHouse(scene, h.x, h.z, h.rot, h.color, h.roofColor));
}

function createHouse(scene, x, z, rot, wallColor, roofColor) {
  const group = new THREE.Group();

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 2.4), wallMat);
  body.position.y = 0.8;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Roof (pyramid)
  const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.9 });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.8, 4), roofMat);
  roof.position.y = 1.6;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  // Door
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.8), doorMat);
  door.position.set(0, 0.4, 1.21);
  group.add(door);

  // Window glow
  const winMat = new THREE.MeshStandardMaterial({
    color: 0xffddaa,
    emissive: 0xffaa44,
    emissiveIntensity: 0.3,
  });
  const winPos = [[-0.6, 0.7, 1.21], [0.6, 0.7, 1.21]];
  winPos.forEach(([wx, wy, wz]) => {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), winMat);
    win.position.set(wx, wy, wz);
    group.add(win);
  });

  group.position.set(x, 0, z);
  group.rotation.y = rot;
  scene.add(group);
}

function buildTrees(scene) {
  const treePositions = [
    [-10, -8], [-11, -3], [-9, 2], [-10, 7],
    [10, -8], [11, -3], [9, 2], [10, 7],
    [-5, -10], [5, -10], [-5, 10], [5, 10],
    [-2, -10], [2, -10], [-2, 10], [2, 10],
    [-12, -6], [12, -6], [-12, 6], [12, 6],
    [-6, -9], [6, -9], [-6, 9], [6, 9],
  ];
  treePositions.forEach(([x, z]) => createTree(scene, x, z));
}

function createTree(scene, x, z) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: COLORS.treeTrunk, roughness: 1 });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 6), trunkMat);
  trunk.position.y = 0.6;
  trunk.castShadow = true;
  group.add(trunk);

  const leafMat = new THREE.MeshStandardMaterial({ color: COLORS.treeLeaves, roughness: 0.9 });
  const leafCount = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < leafCount; i++) {
    const size = 0.6 + Math.random() * 0.4;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 6), leafMat);
    leaf.position.set(
      (Math.random() - 0.5) * 0.6,
      1.2 + i * 0.4 + Math.random() * 0.2,
      (Math.random() - 0.5) * 0.6,
    );
    leaf.castShadow = true;
    group.add(leaf);
  }
  group.position.set(x, 0, z);
  scene.add(group);
}

function buildFence(scene) {
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1 });
  const points = [];
  for (let i = 0; i <= 32; i++) {
    const angle = (i / 32) * Math.PI * 2;
    const r = 11.5;
    points.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  points.forEach(([x, z]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.8, 4), fenceMat);
    post.position.set(x, 0.4, z);
    post.castShadow = true;
    scene.add(post);
  });
}

function buildWell(scene) {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x666677, roughness: 0.9 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.3, 12), stoneMat);
  base.position.y = 0.15;
  group.add(base);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 8, 16), stoneMat);
  ring.position.y = 0.4;
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1 });
  const pole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 4), roofMat);
  pole1.position.set(-0.4, 0.6, 0);
  group.add(pole1);
  const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 4), roofMat);
  pole2.position.set(0.4, 0.6, 0);
  group.add(pole2);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 4), roofMat);
  beam.position.set(0, 0.9, 0);
  beam.rotation.z = Math.PI / 2;
  group.add(beam);

  group.position.set(0, 0, -8);
  scene.add(group);
}

function buildCampfire(scene, fireParticlesRef) {
  const group = new THREE.Group();

  // Logs
  const logMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1 });
  for (let i = 0; i < 6; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.3, 4), logMat);
    const angle = (i / 6) * Math.PI * 2;
    log.position.set(Math.cos(angle) * 0.2, 0.02, Math.sin(angle) * 0.2);
    log.rotation.z = 0.2;
    log.rotation.x = Math.random() * 0.3;
    group.add(log);
  }

  // Stone ring
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x555566, roughness: 1 });
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), stoneMat);
    stone.position.set(Math.cos(angle) * 0.3, 0.03, Math.sin(angle) * 0.3);
    stone.scale.y = 0.5;
    group.add(stone);
  }

  // Fire glow
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xff8844,
    emissive: 0xff4400,
    emissiveIntensity: 2,
    transparent: true,
    opacity: 0.4,
  });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8), glowMat);
  glow.position.y = 0.3;
  group.add(glow);

  // Fire particles
  const particleMat = new THREE.MeshBasicMaterial({
    color: 0xff8844,
    transparent: true,
    opacity: 0.8,
  });
  for (let i = 0; i < 20; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), particleMat.clone());
    p.position.set(
      (Math.random() - 0.5) * 0.5,
      0.1 + Math.random() * 0.5,
      (Math.random() - 0.5) * 0.5,
    );
    p.userData = { speed: 0.8 + Math.random() * 1.2, drift: Math.random() - 0.5 };
    group.add(p);
    fireParticlesRef.current = [...(fireParticlesRef.current || []), p];
  }

  // Point light at fire
  const fireLight = new THREE.PointLight(0xff6600, 1.5, 6);
  fireLight.position.set(0, 0.5, 0);
  group.add(fireLight);

  group.position.set(0, 0, 0);
  scene.add(group);
}

function buildLanterns(scene) {
  const lanternPositions = [
    [-4, -5], [-4, 5], [4, -5], [4, 5],
    [-5, -2], [5, -2], [-5, 2], [5, 2],
  ];
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3a2a, roughness: 0.9 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xffddaa,
    emissive: 0xffaa44,
    emissiveIntensity: 0.8,
  });

  lanternPositions.forEach(([x, z]) => {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.8, 4), poleMat);
    pole.position.y = 0.4;
    group.add(pole);

    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), lampMat);
    lamp.position.y = 0.8;
    group.add(lamp);

    const light = new THREE.PointLight(0xff8844, 0.4, 4);
    light.position.y = 0.8;
    group.add(light);

    group.position.set(x, 0, z);
    scene.add(group);
  });
}

// ============================================================
// 3D VILLAGER CHARACTER
// ============================================================
function createVillager(gender = 'male', hairStyle = 'short', hairColor = '#1a1a1a') {
  const group = new THREE.Group();
  const bodyColor = BODY_COLORS[gender] || BODY_COLORS.male;
  const hairHex = parseInt(hairColor.replace('#', ''), 16);

  const skinMat = new THREE.MeshStandardMaterial({ color: SKIN_COLOR, roughness: 0.8 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.7 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1a1a3a, roughness: 0.8 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairHex, roughness: 0.9 });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.2), bodyMat);
  body.position.y = 0.6;
  body.castShadow = true;
  group.add(body);

  // Pants/legs
  const pants = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.25, 0.18), pantsMat);
  pants.position.y = 0.27;
  group.add(pants);

  // Legs
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.9 });
  [-0.08, 0.08].forEach((dx) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.25, 5), legMat);
    leg.position.set(dx, 0.12, 0);
    group.add(leg);
  });

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), skinMat);
  head.position.y = 0.9;
  head.castShadow = true;
  group.add(head);

  // Eyes
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  [-0.05, 0.05].forEach((dx) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), eyeMat);
    eye.position.set(dx, 0.92, 0.13);
    group.add(eye);

    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.008, 4, 4),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    shine.position.set(dx + 0.01, 0.93, 0.14);
    group.add(shine);
  });

  // Mouth
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0xc97b5a });
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.01, 4, 4), mouthMat);
  mouth.position.set(0, 0.86, 0.14);
  mouth.scale.set(1.5, 0.5, 1);
  group.add(mouth);

  // Hair
  createHair(group, hairStyle, hairMat);

  // Arms
  [-0.18, 0.18].forEach((dx) => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.35, 4), bodyMat);
    arm.position.set(dx, 0.6, 0);
    arm.rotation.z = dx < 0 ? 0.1 : -0.1;
    arm.castShadow = true;
    group.add(arm);
  });

  return group;
}

function createHair(group, style, mat) {
  switch (style) {
    case 'long': {
      // Long hair - cap + side strands
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      cap.position.y = 0.96;
      cap.scale.y = 0.6;
      group.add(cap);
      for (let i = 0; i < 4; i++) {
        const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.015, 0.3, 4), mat);
        strand.position.set(-0.12 + i * 0.08, 0.65, 0);
        group.add(strand);
      }
      break;
    }
    case 'ponytail': {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      cap.position.y = 0.96;
      cap.scale.y = 0.5;
      group.add(cap);
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.2, 5), mat);
      tail.position.set(0, 0.7, -0.1);
      tail.rotation.x = 0.3;
      group.add(tail);
      break;
    }
    case 'curly': {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), mat);
      cap.position.y = 0.96;
      cap.scale.y = 0.7;
      group.add(cap);
      for (let i = 0; i < 3; i++) {
        const curl = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 4), mat);
        curl.position.set(-0.1 + i * 0.1, 0.92 + Math.sin(i) * 0.04, 0.1);
        group.add(curl);
      }
      break;
    }
    case 'bun': {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      cap.position.y = 0.96;
      cap.scale.y = 0.4;
      group.add(cap);
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), mat);
      bun.position.set(0, 1.0, 0);
      group.add(bun);
      break;
    }
    case 'bald': {
      break; // No hair
    }
    case 'mohawk': {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      cap.position.y = 0.96;
      cap.scale.y = 0.4;
      group.add(cap);
      for (let i = 0; i < 3; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.12, 4), mat);
        spike.position.set(0, 1.0 + i * 0.06, 0);
        spike.scale.x = 1 - i * 0.2;
        group.add(spike);
      }
      break;
    }
    case 'wavy': {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), mat);
      cap.position.y = 0.94;
      cap.scale.y = 0.6;
      cap.scale.x = 1.1;
      group.add(cap);
      break;
    }
    default: { // short
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      cap.position.y = 0.97;
      cap.scale.y = 0.5;
      group.add(cap);
      break;
    }
  }
}

export default Village3D;
