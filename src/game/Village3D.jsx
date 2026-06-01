import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import ActionDirector from './ActionDirector';

// HD-2D Post-processing
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ============================================================
// DESIGN SYSTEM TOKENS & STYLES
// ============================================================
const COLORS = {
  bg: 0x120c14,         // Warm HD-2D deep purple night
  ground: 0x1a2e1a,     // Dark forest ground
  groundAccent: 0x1a2e1a,
  houseWall: 0x5a4a3e,
  houseRoof: 0x7c2d12,   // Warm red roofs
  houseTrim: 0x8a7a5f,
  treeTrunk: 0x2e251b,
  treeLeaves: 0x064e3b,  // Dark emerald pine leaves
  path: 0x1c1917,       // Dark cobblestone pathway
  fire: 0xf97316,
};

const BODY_COLORS = {
  male:    0x3b82f6,    // Village Blue
  female:  0xec4899,    // Lovers Pink
  neutral: 0x10b981,    // Success Green
};

const SKIN_COLOR = 0xfecdd3; // Rosy skin tone

// ============================================================
// Village3D Component
// ============================================================
const Village3D = forwardRef(({ players, mySocketId, onMoveTo, phase, emotes }, ref) => {
  const [sceneReady, setSceneReady] = React.useState(false);
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  const labelRendererRef = useRef(null);
  const playerMeshesRef = useRef({}); // sid -> { group, label, id, targetPosition, isAlive }
  const animFrameRef = useRef(null);
  const fireParticlesRef = useRef([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const initializedRef = useRef(false);
  const actionDirectorRef = useRef(null);
  const composerRef = useRef(null);
  const bloomRef = useRef(null);
  const bokehRef = useRef(null);

  // Decouple onMoveTo trigger to prevent Three.js scene recreation
  const onMoveToRef = useRef(onMoveTo);
  useEffect(() => {
    onMoveToRef.current = onMoveTo;
  }, [onMoveTo]);

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
    scene.fog = new THREE.Fog(0x1a0e1e, 28, 60); // Warmer, closer fog for HD-2D diorama depth
    sceneRef.current = scene;

    // Camera (Isometric angle)
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(15, 14, 18);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // WebGL Renderer (High Quality Specs)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // HD-2D Post-processing: EffectComposer pipeline
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    // Unreal Bloom — warm glow for fire, lanterns, emissive windows
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      0.6,   // strength
      0.8,   // radius (spread)
      0.1    // threshold (low = nearly everything bright glows)
    );
    composer.addPass(bloom);
    bloomRef.current = bloom;

    // Bokeh Depth of Field — tilt-shift diorama effect (HD-2D signature)
    const bokeh = new BokehPass(scene, camera, {
      focus: 22,
      aperture: 0.008,
      maxblur: 0.012,
    });
    composer.addPass(bokeh);
    bokehRef.current = bokeh;

    // Output to screen (required as final pass)
    composer.addPass(new OutputPass());
    composerRef.current = composer;

    // CSS2D Renderer (Dynamic over-head HTML name badges — no post-processing)
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(w, h);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);
    labelRendererRef.current = labelRenderer;

    // Camera Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 6;
    controls.maxDistance = 45;
    controls.maxPolarAngle = Math.PI / 2.2; // Don't allow camera to go below ground
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    // Initialize ActionDirector
    actionDirectorRef.current = new ActionDirector({
      scene,
      camera,
      controls,
      renderer,
      labelRenderer,
    });

    // --- Lights Setup (HD-2D Warm Night) ---
    const ambient = new THREE.AmbientLight(0x8c7b7e, 1.2);
    scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0xb4a5d4, 0x3e2b3e, 1.6);
    scene.add(hemi);

    // Moonlight (Warm silver for HD-2D diorama lighting)
    const moon = new THREE.DirectionalLight(0xd4c8f0, 2.8);
    moon.position.set(-12, 20, 8);
    moon.castShadow = true;
    moon.shadow.mapSize.width = 2048;
    moon.shadow.mapSize.height = 2048;
    moon.shadow.camera.near = 0.5;
    moon.shadow.camera.far = 40;
    moon.shadow.camera.left = -18;
    moon.shadow.camera.right = 18;
    moon.shadow.camera.top = 18;
    moon.shadow.camera.bottom = -18;
    moon.shadow.bias = -0.0005;
    scene.add(moon);

    // Warm Campfire Light (Brightened)
    const fireLight = new THREE.PointLight(0xff7700, 3.2, 14);
    fireLight.position.set(0, 0.4, 0);
    scene.add(fireLight);

    // --- Build Isometric Village Map ---
    buildGround(scene);
    buildPath(scene);
    buildHouses(scene);
    buildTrees(scene);
    buildFence(scene);
    buildWell(scene);
    buildCampfire(scene, fireParticlesRef);
    buildLanterns(scene);

    // --- Ground click-to-move detection ---
    const handleClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      const groundObjects = [];
      scene.traverse((obj) => {
        if (obj.userData.isGround) groundObjects.push(obj);
      });

      const intersects = raycasterRef.current.intersectObjects(groundObjects);
      if (intersects.length > 0 && onMoveToRef.current) {
        const pt = intersects[0].point;
        // Limit path movement to ground radius
        const distance = Math.sqrt(pt.x * pt.x + pt.z * pt.z);
        if (distance < 20) {
          onMoveToRef.current(pt.x, pt.z);
        }
      }
    };
    renderer.domElement.addEventListener('click', handleClick);

    // Resize Handler
    const handleResize = () => {
      const w2 = container.clientWidth;
      const h2 = container.clientHeight;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
      composer.setSize(w2, h2);
      labelRenderer.setSize(w2, h2);
    };
    window.addEventListener('resize', handleResize);

    // --- 60FPS SMOOTH ANIMATION AND LERP LOOP ---
    const clock = new THREE.Clock();
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // 1. Campfire Particle Animations
      fireParticlesRef.current.forEach((p, i) => {
        const speed = p.userData.speed || 1;
        p.position.y += 0.012 * speed;
        p.position.x += Math.sin(time * 3.5 + i) * 0.003;
        p.position.z += Math.cos(time * 3.5 + i * 0.7) * 0.003;
        p.material.opacity = Math.max(0, 1 - (p.position.y - 0.1) / 2.2);
        
        const s = 0.25 + Math.sin(time * 4 + i) * 0.12;
        p.scale.set(s, s, s);
        
        if (p.position.y > 2.2) {
          p.position.set((Math.random() - 0.5) * 0.4, 0.1, (Math.random() - 0.5) * 0.4);
          p.material.opacity = 0.85;
        }
      });

      // 2. 60FPS Fluid Character Motion, Facing direction & Walk/Idle Animation Cycles
      Object.values(playerMeshesRef.current).forEach((entry) => {
        const group = entry.group;
        const target = entry.targetPosition || group.position;
        const isAlive = entry.isAlive !== false;

        // Retrieve named limbs for skeleton swings
        const legLeft = group.getObjectByName('legLeft');
        const legRight = group.getObjectByName('legRight');
        const armLeft = group.getObjectByName('armLeft');
        const armRight = group.getObjectByName('armRight');
        const head = group.getObjectByName('head');
        const bodyMesh = group.getObjectByName('bodyMesh');

        if (!isAlive) {
          // --- DEAD STATE (KNOCKED OUT) ---
          // Rotate on side smoothly
          group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, Math.PI / 2, 0.15);
          group.position.y = THREE.MathUtils.lerp(group.position.y, 0.08, 0.15);
          
          // Lay down limbs flat
          if (legLeft) legLeft.rotation.x = 0;
          if (legRight) legRight.rotation.x = 0;
          if (armLeft) { armLeft.rotation.x = 0; armLeft.rotation.z = 0.1; }
          if (armRight) { armRight.rotation.x = 0; armRight.rotation.z = -0.1; }
          
          // Make character semi-transparent ghost-like
          group.traverse(child => {
            if (child.isMesh && child.material) {
              child.material.transparent = true;
              child.material.opacity = THREE.MathUtils.lerp(child.material.opacity, 0.45, 0.05);
            }
          });

          // Dim/cross-out floating name label
          if (entry.label?.element) {
            entry.label.element.style.opacity = '0.4';
            entry.label.element.style.background = 'rgba(0,0,0,0.85)';
            entry.label.element.style.border = '1px solid rgba(255,0,0,0.2)';
            entry.label.element.style.textDecoration = 'line-through';
          }
          
          // Animate name badge float gently above laid corpse
          if (entry.label) {
            entry.label.position.set(0, 0.5, 0.5);
          }
          return;
        }

        // Restore transparency for living players
        group.traverse(child => {
          if (child.isMesh && child.material) {
            child.material.transparent = false;
            child.material.opacity = 1.0;
          }
        });

        if (entry.label?.element) {
          entry.label.element.style.textDecoration = 'none';
        }

        // --- ALIVE STATE MOTION INTERPOLATION ---
        if (entry.isAdmin) {
          // --- ADMIN (ANGEL) MOTION & FLAPPING WINGS ---
          // 1. Move towards target (X and Z only)
          const targetXZ = new THREE.Vector3(target.x, group.position.y, target.z);
          group.position.lerp(targetXZ, 0.015); // HD-2D slower glide

          // 2. Hover high in the sky
          group.position.y = 2.0 + Math.sin(time * 2.5) * 0.25;

          // 3. Face moving direction
          const direction = new THREE.Vector3().subVectors(target, group.position);
          direction.y = 0;
          direction.normalize();
          if (direction.lengthSq() > 0.0001) {
            const angle = Math.atan2(direction.x, direction.z);
            let diff = angle - group.rotation.y;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            group.rotation.y += diff * 0.22;
          }

          // 4. Flap Angelic Wings
          const wingLeft = group.getObjectByName('wingLeft');
          const wingRight = group.getObjectByName('wingRight');
          if (wingLeft && wingRight) {
            const flapSpeed = targetXZ.distanceTo(group.position) > 0.1 ? 5 : 2; // Relaxed wing flaps matching speed
            const flapAmp = targetXZ.distanceTo(group.position) > 0.1 ? 0.45 : 0.25;
            wingLeft.rotation.y = 0.4 + Math.sin(time * flapSpeed) * flapAmp;
            wingRight.rotation.y = -0.4 - Math.sin(time * flapSpeed) * flapAmp;
          }

          // 5. Calm arm floating breathing cycle
          if (armLeft) { armLeft.rotation.x = Math.sin(time * 2) * 0.1; armLeft.rotation.z = 0.25; }
          if (armRight) { armRight.rotation.x = -Math.sin(time * 2) * 0.1; armRight.rotation.z = -0.25; }
          if (head) head.rotation.y = Math.sin(time * 0.4) * 0.08;

          // Float overhead label high above the angel
          if (entry.label) entry.label.position.set(0, 2.2, 0);
        } else {
          // --- NORMAL PLAYER MOTION ---
          const dist = group.position.distanceTo(target);

          if (dist > 0.05) {
            // 60FPS fluid lerp glide
            group.position.lerp(target, 0.02); // HD-2D slower glide
            
            // Lock height to ground plane
            group.position.y = 0;

          // Rotate character smoothly to face exactly towards moving direction vector
          const direction = new THREE.Vector3().subVectors(target, group.position).normalize();
          if (direction.lengthSq() > 0.0001) {
            const angle = Math.atan2(direction.x, direction.z);
            let diff = angle - group.rotation.y;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // Normalize to [-PI, PI]
            group.rotation.y += diff * 0.22;
          }

          // Walking limb swing animation
          const walkCycle = time * 4.0; // HD-2D slower walk
          if (legLeft) legLeft.rotation.x = Math.sin(walkCycle) * 0.55;
          if (legRight) legRight.rotation.x = -Math.sin(walkCycle) * 0.55;
          if (armLeft) {
            armLeft.rotation.x = -Math.sin(walkCycle) * 0.45;
            armLeft.rotation.z = 0.15;
          }
          if (armRight) {
            armRight.rotation.x = Math.sin(walkCycle) * 0.45;
            armRight.rotation.z = -0.15;
          }
          // Bob body up & down dynamically based on stride
          if (bodyMesh) bodyMesh.position.y = 0.6 + Math.abs(Math.sin(walkCycle)) * 0.035;
          if (head) head.position.y = 0.9 + Math.abs(Math.sin(walkCycle)) * 0.025;

          // Align label overhead
          if (entry.label) entry.label.position.set(0, 1.8, 0);
        } else {
          // --- IDLE STATE BREATHING bob ---
          group.position.copy(target);
          group.position.y = 0;
          group.rotation.x = 0;

          const idleCycle = time * 2;
          if (legLeft) legLeft.rotation.x = 0;
          if (legRight) legRight.rotation.x = 0;
          if (armLeft) {
            armLeft.rotation.x = Math.sin(idleCycle) * 0.05;
            armLeft.rotation.z = 0.1 + Math.sin(idleCycle) * 0.02;
          }
          if (armRight) {
            armRight.rotation.x = -Math.sin(idleCycle) * 0.05;
            armRight.rotation.z = -0.1 - Math.sin(idleCycle) * 0.02;
          }
          if (bodyMesh) bodyMesh.position.y = 0.6 + Math.sin(idleCycle) * 0.01;
          if (head) {
            head.position.y = 0.9 + Math.sin(idleCycle) * 0.008;
            head.rotation.y = Math.sin(time * 0.4) * 0.12; // gentle head scan
          }

          // Overhead float name tag
          if (entry.label) {
            entry.label.position.set(0, 1.8 + Math.sin(time * 0.9 + (entry.id.charCodeAt(0) || 0)) * 0.04, 0);
          }
        }
      }
    });

      controls.update();
      composer.render();
      labelRenderer.render(scene, camera);
    };
    animate();
    setSceneReady(true);

    // Cleanup
    return () => {
      setSceneReady(false);
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleClick);
      if (actionDirectorRef.current) {
        actionDirectorRef.current.cleanup();
        actionDirectorRef.current = null;
      }
      if (composerRef.current) {
        composerRef.current.dispose();
        composerRef.current = null;
      }
      renderer.dispose();
      labelRenderer.domElement.remove();
      container.innerHTML = '';
    };
  }, []);

  // Init on mount
  useEffect(() => {
    const cleanup = initScene();
    return () => {
      if (typeof cleanup === 'function') cleanup();
      initializedRef.current = false;
    };
  }, [initScene]);

  // --- React to state updates securely ---
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !sceneReady) return;

    if (!players || !Object.keys(players).length) return;

    // 1. Remove disconnected players
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

    // 2. Add/update players
    Object.entries(players).forEach(([sid, p]) => {
      if (!p.online) return;
      const isMe = sid === mySocketId;

      // Handle null/default coords
      const px = p.x !== undefined ? p.x : 0;
      const py = p.y !== undefined ? p.y : 0;

      if (!playerMeshesRef.current[sid]) {
        // Create new character group
        const group = createVillager(p.gender, p.hairStyle, p.hairColor, p.isAdmin);
        group.userData.socketId = sid;
        group.userData.isPlayer = true;

        // Custom stylized Over-head Floating Name Badges (CSS2D)
        const div = document.createElement('div');
        div.style.color = isMe ? '#a78bfa' : '#f1f5f9';
        div.style.fontFamily = "'Space Grotesk', sans-serif";
        div.style.fontSize = '10px';
        div.style.fontWeight = '700';
        div.style.textShadow = '0 2px 6px rgba(0,0,0,0.9)';
        div.style.background = isMe ? 'rgba(139,92,246,0.25)' : 'rgba(15,23,42,0.8)';
        div.style.padding = '3px 9px';
        div.style.borderRadius = '20px';
        div.style.backdropFilter = 'blur(6px)';
        div.style.border = isMe ? '1.5px solid rgba(167,139,250,0.5)' : '1px solid rgba(255,255,255,0.08)';
        div.style.boxShadow = isMe ? '0 0 10px rgba(167,139,250,0.2)' : '0 2px 8px rgba(0,0,0,0.5)';
        div.style.whiteSpace = 'nowrap';
        div.style.transition = 'all 0.3s ease';
        div.textContent = `${isMe ? '👤 ' : ''}${p.username}${p.isAdmin ? ' 👑' : ''}`;

        const label = new CSS2DObject(div);
        label.position.set(0, 1.8, 0);
        group.add(label);

        group.position.set(px, 0, py);
        scene.add(group);

        playerMeshesRef.current[sid] = {
          group,
          label,
          id: sid,
          targetPosition: new THREE.Vector3(px, 0, py),
          isAlive: p.isAlive,
          isAdmin: p.isAdmin,
        };
      } else {
        // Update target positions dynamically
        const entry = playerMeshesRef.current[sid];
        entry.targetPosition.set(px, 0, py);
        entry.isAlive = p.isAlive;
        entry.isAdmin = p.isAdmin;
      }
    });

    // 3. Update emotes dynamically above players' heads in 3D
    Object.entries(players).forEach(([sid, p]) => {
      const entry = playerMeshesRef.current[sid];
      if (!entry || !entry.group) return;

      const emoteData = emotes?.[sid];

      if (emoteData) {
        // Emote active! Show or update bubble
        if (!entry.emoteObj) {
          const parentDiv = document.createElement('div');
          parentDiv.style.pointerEvents = 'none';

          const div = document.createElement('div');
          div.style.fontSize = '20px';
          div.style.background = 'rgba(15,23,42,0.85)';
          div.style.border = '1.5px solid rgba(139,92,246,0.45)';
          div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.6), 0 0 10px rgba(139,92,246,0.2)';
          div.style.padding = '6px';
          div.style.borderRadius = '50%';
          div.style.width = '36px';
          div.style.height = '36px';
          div.style.display = 'flex';
          div.style.alignItems = 'center';
          div.style.justifyContent = 'center';
          div.style.backdropFilter = 'blur(8px)';
          div.style.pointerEvents = 'none';
          div.style.animation = 'emotePop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, emoteBob 1.5s ease-in-out infinite alternate';
          div.textContent = emoteData.emoji;

          parentDiv.appendChild(div);

          // Inject custom CSS keyframes dynamically if not present
          if (!document.getElementById('emote-keyframes')) {
            const style = document.createElement('style');
            style.id = 'emote-keyframes';
            style.textContent = `
              @keyframes emotePop {
                0% { transform: scale(0) translateY(10px); opacity: 0; }
                100% { transform: scale(1) translateY(0); opacity: 1; }
              }
              @keyframes emoteBob {
                0% { transform: translateY(0); }
                100% { transform: translateY(-6px); }
              }
            `;
            document.head.appendChild(style);
          }

          const emoteLabel = new CSS2DObject(parentDiv);
          emoteLabel.position.set(0, p.isAdmin ? 2.8 : 2.3, 0);
          entry.group.add(emoteLabel);
          entry.emoteObj = emoteLabel;
        } else {
          // Update emoji text if changed
          const childDiv = entry.emoteObj.element.querySelector('div');
          if (childDiv && childDiv.textContent !== emoteData.emoji) {
            childDiv.textContent = emoteData.emoji;
          }
        }
      } else {
        // No emote active! Remove bubble if present
        if (entry.emoteObj) {
          entry.group.remove(entry.emoteObj);
          entry.emoteObj = null;
        }
      }
    });
  }, [players, emotes, mySocketId, phase, sceneReady]);

  // Expose camera fly-to function
  useImperativeHandle(ref, () => ({
    flyTo: (x, z) => {
      if (controlsRef.current) {
        controlsRef.current.target.set(x, 0, z);
      }
    },
    get actionDirector() {
      return actionDirectorRef.current;
    },
  }));

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0"
      style={{ cursor: 'grab' }}
      onMouseDown={() => { if (containerRef.current) containerRef.current.style.cursor = 'grabbing'; }}
      onMouseUp={() => { if (containerRef.current) containerRef.current.style.cursor = 'grab'; }}
    />
  );
});

Village3D.displayName = 'Village3D';

// ============================================================
// ISO WORLD BUILDING FUNCTIONS
// ============================================================

function buildGround(scene) {
  // Forest turf circle
  const groundGeo = new THREE.CircleGeometry(24, 48);
  const groundMat = new THREE.MeshStandardMaterial({
    color: COLORS.ground,
    roughness: 0.95,
    metalness: 0.05,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  ground.userData.isGround = true;
  scene.add(ground);

  // Stylized boundary grid lines (Dark mood overlay)
  const grid = new THREE.GridHelper(50, 25, 0x4f46e5, 0x1e1b4b);
  grid.position.y = 0.005;
  grid.material.opacity = 0.15;
  grid.material.transparent = true;
  scene.add(grid);
}

function buildPath(scene) {
  const pathMat = new THREE.MeshStandardMaterial({
    color: COLORS.path,
    roughness: 1.0,
    metalness: 0.0,
  });
  // Crossroads layout centered around fire plaza
  const positions = [
    { x: 0, z: 0, w: 2.8, h: 12, rot: 0 },
    { x: 0, z: -8, w: 2.2, h: 4, rot: 0 },
    { x: 0, z: 8, w: 2.2, h: 4, rot: 0 },
    { x: -8, z: 0, w: 2.2, h: 4, rot: Math.PI / 2 },
    { x: 8, z: 0, w: 2.2, h: 4, rot: Math.PI / 2 },
  ];
  positions.forEach((p) => {
    const geo = new THREE.PlaneGeometry(p.w, p.h);
    const mesh = new THREE.Mesh(geo, pathMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = p.rot;
    mesh.position.set(p.x, 0.008, p.z);
    mesh.receiveShadow = true;
    scene.add(mesh);
  });
}

function buildHouses(scene) {
  // Houses placed at 4 quadrants of the crossroad
  const houses = [
    { x: -6.5, z: -5.5, rot: 0, color: 0x5a4a3e, roofColor: 0x7c2d12 },
    { x: 6.5, z: -5.5, rot: Math.PI, color: 0x4a473e, roofColor: 0x854d0e },
    { x: -6.5, z: 5.5, rot: 0, color: 0x3d4a3e, roofColor: 0x7c2d12 },
    { x: 6.5, z: 5.5, rot: Math.PI, color: 0x5a3e3e, roofColor: 0x451a03 },
  ];
  houses.forEach((h) => createHouse(scene, h.x, h.z, h.rot, h.color, h.roofColor));
}

function createHouse(scene, x, z, rot, wallColor, roofColor) {
  const group = new THREE.Group();

  // Box walls (Toon shading for HD-2D cel-shaded look)
  const wallMat = new THREE.MeshToonMaterial({ color: wallColor });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.7, 2.4), wallMat);
  body.position.y = 0.85;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Roof (4-sided cone — Toon shading)
  const roofMat = new THREE.MeshToonMaterial({ color: roofColor });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.9, 4), roofMat);
  roof.position.y = 1.7 + 0.45;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  // Door
  const doorMat = new THREE.MeshToonMaterial({ color: 0x27272a });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.95), doorMat);
  door.position.set(0, 0.475, 1.205);
  group.add(door);

  // Glowing Windows (HD-2D warm bloom)
  const winMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 4.0,
  });
  const winPos = [[-0.65, 0.8, 1.205], [0.65, 0.8, 1.205]];
  winPos.forEach(([wx, wy, wz]) => {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.35), winMat);
    win.position.set(wx, wy, wz);
    group.add(win);
  });

  group.position.set(x, 0, z);
  group.rotation.y = rot;
  scene.add(group);
}

function buildTrees(scene) {
  const treePositions = [
    [-9.5, -8], [-11, -3.5], [-9.5, 2.5], [-10.5, 7.5],
    [9.5, -8], [11, -3.5], [9.5, 2.5], [10.5, 7.5],
    [-5, -9.5], [5, -9.5], [-5, 9.5], [5, 9.5],
    [-2, -9.5], [2, -9.5], [-2, 9.5], [2, 9.5],
    [-11.5, -6], [11.5, -6], [-11.5, 6], [11.5, 6],
  ];
  treePositions.forEach(([x, z]) => createTree(scene, x, z));
}

function createTree(scene, x, z) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: COLORS.treeTrunk, roughness: 1.0 });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.3, 5), trunkMat);
  trunk.position.y = 0.65;
  trunk.castShadow = true;
  group.add(trunk);

  // Layered Stylized Low-Poly Pine Leaves
  const leafMat = new THREE.MeshStandardMaterial({ color: COLORS.treeLeaves, roughness: 0.95 });
  const leafCount = 3;
  for (let i = 0; i < leafCount; i++) {
    const size = 0.7 - i * 0.12;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(size, 0.7, 5), leafMat);
    leaf.position.set(0, 1.1 + i * 0.4, 0);
    leaf.castShadow = true;
    group.add(leaf);
  }
  
  group.position.set(x, 0, z);
  scene.add(group);
}

function buildFence(scene) {
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 1.0 });
  const postsCount = 28;
  for (let i = 0; i < postsCount; i++) {
    const angle = (i / postsCount) * Math.PI * 2;
    const r = 13.5;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    
    // Skip path intersections
    if (Math.abs(x) < 1.8 || Math.abs(z) < 1.8) continue;

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.85, 4), fenceMat);
    post.position.set(x, 0.425, z);
    post.castShadow = true;
    scene.add(post);
  }
}

function buildWell(scene) {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 0.35, 10), stoneMat);
  base.position.y = 0.175;
  base.castShadow = true;
  group.add(base);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 8, 12), stoneMat);
  ring.position.y = 0.38;
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.95 });
  const pole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.65, 4), roofMat);
  pole1.position.set(-0.45, 0.65, 0);
  group.add(pole1);
  const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.65, 4), roofMat);
  pole2.position.set(0.45, 0.65, 0);
  group.add(pole2);
  
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.3, 4), roofMat);
  roof.position.y = 1.05;
  roof.rotation.y = Math.PI / 4;
  group.add(roof);

  group.position.set(0, 0, -8);
  scene.add(group);
}

function buildCampfire(scene, fireParticlesRef) {
  const group = new THREE.Group();

  // Pile of Logs
  const logMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 1.0 });
  for (let i = 0; i < 6; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.32, 4), logMat);
    const angle = (i / 6) * Math.PI * 2;
    log.position.set(Math.cos(angle) * 0.18, 0.02, Math.sin(angle) * 0.18);
    log.rotation.z = 0.22;
    log.rotation.x = Math.random() * 0.25;
    group.add(log);
  }

  // Stone fireplace ring
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 1.0 });
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.SphereGeometry(0.065, 4, 4), stoneMat);
    stone.position.set(Math.cos(angle) * 0.35, 0.03, Math.sin(angle) * 0.35);
    stone.scale.y = 0.6;
    group.add(stone);
  }

  // Soft Fire inner glow shape
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 2.2,
    transparent: true,
    opacity: 0.35,
  });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), glowMat);
  glow.position.y = 0.25;
  group.add(glow);

  // Flowing fire sparks/particles
  const particleMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.85,
  });
  for (let i = 0; i < 18; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 4), particleMat.clone());
    p.position.set(
      (Math.random() - 0.5) * 0.4,
      0.1 + Math.random() * 0.4,
      (Math.random() - 0.5) * 0.4,
    );
    p.userData = { speed: 0.85 + Math.random() * 1.3 };
    group.add(p);
    fireParticlesRef.current = [...(fireParticlesRef.current || []), p];
  }

  group.position.set(0, 0, 0);
  scene.add(group);
}

function buildLanterns(scene) {
  // Torches around central campfire plaza
  const lanternPositions = [
    [-3.8, -4.2], [-3.8, 4.2], [3.8, -4.2], [3.8, 4.2],
    [-4.5, -1.8], [4.5, -1.8], [-4.5, 1.8], [4.5, 1.8],
  ];
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.95 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xeab308,
    emissiveIntensity: 1.0,
  });

  lanternPositions.forEach(([x, z]) => {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.8, 4), poleMat);
    pole.position.y = 0.4;
    group.add(pole);

    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 5), lampMat);
    lamp.position.y = 0.8;
    group.add(lamp);

    const light = new THREE.PointLight(0xf97316, 0.5, 3.5);
    light.position.y = 0.8;
    group.add(light);

    group.position.set(x, 0, z);
    scene.add(group);
  });
}

// ============================================================
// 3D SKELETAL CHARACTER MODEL GENERATION
// ============================================================
function createVillager(gender = 'male', hairStyle = 'short', hairColor = '#1a1a1a', isAdmin = false) {
  const group = new THREE.Group();
  const bodyColor = BODY_COLORS[gender] || BODY_COLORS.male;
  const hairHex = parseInt(hairColor.replace('#', ''), 16);

  const skinMat = new THREE.MeshStandardMaterial({ color: SKIN_COLOR, roughness: 0.7, metalness: 0.1 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.6, metalness: 0.15 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairHex, roughness: 0.85 });

  if (isAdmin) {
    // ============================================================
    // GORGEOUS CELESTIAL GLOWING ANGEL MODEL FOR HOST (ADMIN)
    // ============================================================
    const angelMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe0e7ff,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.1,
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xeab308,
      emissiveIntensity: 1.0,
      roughness: 0.15,
      metalness: 0.9,
    });

    // 1. Tapered Celestial Gown (No legs!)
    const gown = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.15, 0.48, 16), angelMat);
    gown.position.y = 0.6;
    gown.name = 'bodyMesh';
    gown.castShadow = true;
    gown.receiveShadow = true;
    group.add(gown);

    // Gold collar wrap
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 16), goldMat);
    collar.position.y = 0.82;
    collar.rotation.x = Math.PI / 2;
    group.add(collar);

    // 2. Smooth Angel Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), skinMat);
    head.position.y = 0.94;
    head.name = 'head';
    head.castShadow = true;
    group.add(head);

    // 3. Floating Glowing Halo
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 16), goldMat);
    halo.position.set(0, 1.15, -0.02);
    halo.rotation.x = Math.PI / 2.2;
    group.add(halo);

    // 4. Glowing Angelic Wings (Large boxes angled on back)
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.2, 0.4), angelMat);
    wingL.position.set(-0.11, 0.72, -0.09);
    wingL.rotation.y = 0.4;
    wingL.rotation.z = -0.3;
    wingL.name = 'wingLeft';
    wingL.castShadow = true;
    group.add(wingL);

    const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.2, 0.4), angelMat);
    wingR.position.set(0.11, 0.72, -0.09);
    wingR.rotation.y = -0.4;
    wingR.rotation.z = 0.3;
    wingR.name = 'wingRight';
    wingR.castShadow = true;
    group.add(wingR);

    // 5. Stylized Blue Glowing Eyes
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1 });
    const irisMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 0.8, roughness: 0.1 });
    [-0.035, 0.035].forEach((dx) => {
      const eyeBase = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), eyeMat);
      eyeBase.position.set(dx, 0.95, 0.1);
      eyeBase.scale.set(1, 1.3, 0.5);
      group.add(eyeBase);

      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6), irisMat);
      iris.position.set(dx + (dx > 0 ? -0.002 : 0.002), 0.95, 0.11);
      group.add(iris);

      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.004, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      shine.position.set(dx + 0.004, 0.96, 0.12);
      group.add(shine);
    });

    // 6. Styled Arms (Floating Hand)
    const armLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.26, 12), angelMat);
    armLeft.position.set(-0.14, 0.62, 0);
    armLeft.rotation.z = 0.2;
    armLeft.name = 'armLeft';
    armLeft.castShadow = true;
    group.add(armLeft);

    const handLeft = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), skinMat);
    handLeft.position.set(-0.16, 0.48, 0.02);
    group.add(handLeft);

    const armRight = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.26, 12), angelMat);
    armRight.position.set(0.14, 0.62, 0);
    armRight.rotation.z = -0.2;
    armRight.name = 'armRight';
    armRight.castShadow = true;
    group.add(armRight);

    const handRight = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), skinMat);
    handRight.position.set(0.16, 0.48, 0.02);
    group.add(handRight);

    return group;
  }

  // 1. Tapered Stylized Torso
  const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.38, 16), bodyMat);
  bodyMesh.position.y = 0.6;
  bodyMesh.name = 'bodyMesh';
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // Decorative Neck Collar / Scarf
  const scarfColor = gender === 'female' ? 0xf43f5e : 0x8b5cf6;
  const scarfMat = new THREE.MeshStandardMaterial({ color: scarfColor, roughness: 0.8 });
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.03, 8, 16), scarfMat);
  collar.position.y = 0.76;
  collar.rotation.x = Math.PI / 2;
  group.add(collar);

  // Tiny coat buttons
  const buttonMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  for (let i = 0; i < 3; i++) {
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), buttonMat);
    btn.position.set(0, 0.68 - i * 0.08, 0.13);
    group.add(btn);
  }

  // 2. Hip / Belt
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 16), beltMat);
  belt.position.y = 0.4;
  group.add(belt);

  // Gold buckle
  const buckleMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.3, metalness: 0.8 });
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.02), buckleMat);
  buckle.position.set(0, 0.4, 0.14);
  group.add(buckle);

  // 3. Legs
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });

  // Left leg with shoe
  const legLeftGroup = new THREE.Group();
  legLeftGroup.position.set(-0.07, 0.22, 0);
  legLeftGroup.name = 'legLeft';
  
  const legLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 12), legMat);
  legLeft.position.y = -0.11;
  legLeft.castShadow = true;
  legLeftGroup.add(legLeft);

  const shoeLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.09), shoeMat);
  shoeLeft.position.set(0, -0.21, 0.02);
  shoeLeft.castShadow = true;
  legLeftGroup.add(shoeLeft);
  group.add(legLeftGroup);

  // Right leg with shoe
  const legRightGroup = new THREE.Group();
  legRightGroup.position.set(0.07, 0.22, 0);
  legRightGroup.name = 'legRight';
  
  const legRight = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 12), legMat);
  legRight.position.y = -0.11;
  legRight.castShadow = true;
  legRightGroup.add(legRight);

  const shoeRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.09), shoeMat);
  shoeRight.position.set(0, -0.21, 0.02);
  shoeRight.castShadow = true;
  legRightGroup.add(shoeRight);
  group.add(legRightGroup);

  // 4. Smooth Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 16), skinMat);
  head.position.y = 0.92;
  head.name = 'head';
  head.castShadow = true;
  group.add(head);

  // 5. Stylized Glow Eyes
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1 });
  const irisColor = gender === 'female' ? 0x06b6d4 : 0x4f46e5;
  const irisMat = new THREE.MeshStandardMaterial({ color: irisColor, emissive: irisColor, emissiveIntensity: 0.6, roughness: 0.1 });
  
  [-0.04, 0.04].forEach((dx) => {
    const eyeBase = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), eyeMat);
    eyeBase.position.set(dx, 0.93, 0.11);
    eyeBase.scale.set(1, 1.4, 0.6); // tall stylized anime eyes
    group.add(eyeBase);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), irisMat);
    iris.position.set(dx + (dx > 0 ? -0.003 : 0.003), 0.93, 0.12);
    group.add(iris);

    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.005, 4, 4),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    shine.position.set(dx + 0.005, 0.94, 0.13);
    group.add(shine);
  });

  // Mouth
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.5 });
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.008, 4, 4), mouthMat);
  mouth.position.set(0, 0.86, 0.115);
  mouth.scale.set(1.4, 0.4, 0.8);
  group.add(mouth);

  // Hair
  createHair(group, hairStyle, hairMat);

  // 6. Styled Arms (Floating Hand Chibi Style)
  const armLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.3, 12), bodyMat);
  armLeft.position.set(-0.16, 0.6, 0);
  armLeft.rotation.z = 0.15;
  armLeft.name = 'armLeft';
  armLeft.castShadow = true;
  group.add(armLeft);

  const handLeft = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), skinMat);
  handLeft.position.set(-0.19, 0.44, 0.02);
  group.add(handLeft);

  const armRight = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.3, 12), bodyMat);
  armRight.position.set(0.16, 0.6, 0);
  armRight.rotation.z = -0.15;
  armRight.name = 'armRight';
  armRight.castShadow = true;
  group.add(armRight);

  const handRight = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), skinMat);
  handRight.position.set(0.19, 0.44, 0.02);
  group.add(handRight);

  // 7. Dynamic Role-Based Hats / Crown
  if (isAdmin) {
    // GORGEOUS GOLDEN GLOWING CROWN FOR HOST
    const crownGroup = new THREE.Group();
    crownGroup.position.set(0, 1.08, 0);
    
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.1,
      metalness: 0.95,
      emissive: 0xeab308,
      emissiveIntensity: 0.35,
    });
    
    // Base ring
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16), crownMat);
    crownGroup.add(ring);
    
    // Spikes
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.06, 4), crownMat);
      spike.position.set(Math.cos(angle) * 0.09, 0.03, Math.sin(angle) * 0.09);
      spike.rotation.y = angle;
      spike.rotation.z = -0.15;
      crownGroup.add(spike);
      
      // Floating ruby gems on tips
      const gemMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.8 });
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.008, 4, 4), gemMat);
      gem.position.set(Math.cos(angle) * 0.08, 0.065, Math.sin(angle) * 0.08);
      crownGroup.add(gem);
    }
    group.add(crownGroup);
  } else {
    // CUTE STYLIZED HATS FOR VILLAGERS
    if (gender === 'male') {
      // High-quality straw hat
      const hatGroup = new THREE.Group();
      hatGroup.position.set(0, 1.04, 0);
      hatGroup.rotation.x = -0.06;

      const strawMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.9 });
      const bandMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.7 });

      // Brim
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.015, 16), strawMat);
      hatGroup.add(brim);

      // Ribbon Band
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.125, 0.02, 16), bandMat);
      band.position.y = 0.02;
      hatGroup.add(band);

      // Hat Cap
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.12, 0.06, 16), strawMat);
      cap.position.y = 0.055;
      hatGroup.add(cap);

      group.add(hatGroup);
    } else {
      // High-quality Head Band / Bow
      const bowGroup = new THREE.Group();
      bowGroup.position.set(0, 1.05, 0);
      
      const bowMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.6 });
      
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), bowMat);
      bowGroup.add(center);

      const wingLeft = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 4), bowMat);
      wingLeft.rotation.z = Math.PI / 3;
      wingLeft.position.set(-0.03, 0.01, 0);
      bowGroup.add(wingLeft);

      const wingRight = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 4), bowMat);
      wingRight.rotation.z = -Math.PI / 3;
      wingRight.position.set(0.03, 0.01, 0);
      bowGroup.add(wingRight);

      group.add(bowGroup);
    }
  }

  return group;
}

function createHair(group, style, mat) {
  // Styles translated exactly from custom character presets
  switch (style) {
    case 'long': {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      cap.position.y = 0.95;
      cap.scale.y = 0.6;
      group.add(cap);
      for (let i = 0; i < 4; i++) {
        const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.014, 0.28, 4), mat);
        strand.position.set(-0.11 + i * 0.07, 0.66, 0);
        group.add(strand);
      }
      break;
    }
    case 'ponytail': {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      cap.position.y = 0.95;
      cap.scale.y = 0.5;
      group.add(cap);
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.035, 0.18, 5), mat);
      tail.position.set(0, 0.72, -0.1);
      tail.rotation.x = 0.28;
      group.add(tail);
      break;
    }
    case 'curly': {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), mat);
      cap.position.y = 0.95;
      cap.scale.y = 0.68;
      group.add(cap);
      for (let i = 0; i < 3; i++) {
        const curl = new THREE.Mesh(new THREE.SphereGeometry(0.028, 4, 4), mat);
        curl.position.set(-0.09 + i * 0.09, 0.91 + Math.sin(i) * 0.03, 0.09);
        group.add(curl);
      }
      break;
    }
    case 'bun': {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      cap.position.y = 0.95;
      cap.scale.y = 0.42;
      group.add(cap);
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), mat);
      bun.position.set(0, 0.99, 0);
      group.add(bun);
      break;
    }
    case 'bald': {
      break;
    }
    case 'mohawk': {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      cap.position.y = 0.95;
      cap.scale.y = 0.42;
      group.add(cap);
      for (let i = 0; i < 3; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.11, 4), mat);
        spike.position.set(0, 0.99 + i * 0.055, 0);
        spike.scale.x = 1 - i * 0.18;
        group.add(spike);
      }
      break;
    }
    case 'wavy': {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), mat);
      cap.position.y = 0.93;
      cap.scale.y = 0.58;
      cap.scale.x = 1.08;
      group.add(cap);
      break;
    }
    default: { // short
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      cap.position.y = 0.95;
      cap.scale.y = 0.48;
      group.add(cap);
      break;
    }
  }
}

export default Village3D;
