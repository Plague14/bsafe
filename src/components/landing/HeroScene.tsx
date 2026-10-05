import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Brand palette (see src/index.css): primary-600 vault, cyan heirs (validated pair)
const BLUE = 0x2563eb;
const BLUE_DARK = 0x1e40af;
const CYAN = 0x0891b2;
const WHITE = 0xffffff;

interface Heir {
  group: THREE.Group;
  node: THREE.Mesh;
  line: THREE.Line;
  pulse: THREE.Mesh;
  speed: number;
  phase: number;
  radius: number;
}

/**
 * 3D hero: a vault with a turning dial, three heirs orbiting on tilted rings, and
 * pulses flowing from the vault to each heir. Pauses off-screen, honours
 * prefers-reduced-motion, and falls back to a static illustration without WebGL.
 */
export default function HeroScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Canvas follows its container via CSS; setSize(..., false) only sets the drawing buffer,
    // so the canvas never feeds its own size back into the layout
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.6, 10.5);

    // Lighting: soft studio setup that reads well on a white page
    scene.add(new THREE.HemisphereLight(0xffffff, 0xdbeafe, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(4, 6, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x93c5fd, 1.6);
    rim.position.set(-6, 2, -4);
    scene.add(rim);

    const world = new THREE.Group();
    scene.add(world);

    // --- Vault body
    const vault = new THREE.Group();
    world.add(vault);
    const body = new THREE.Mesh(
      new RoundedBoxGeometry(2.4, 2.4, 2.4, 6, 0.28),
      new THREE.MeshPhysicalMaterial({ color: BLUE, metalness: 0.25, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15 }),
    );
    vault.add(body);

    // Door panel + dial on the front face
    const door = new THREE.Mesh(
      new RoundedBoxGeometry(1.7, 1.7, 0.12, 4, 0.08),
      new THREE.MeshPhysicalMaterial({ color: BLUE_DARK, metalness: 0.35, roughness: 0.3, clearcoat: 1 }),
    );
    door.position.z = 1.22;
    vault.add(door);

    const dial = new THREE.Group();
    dial.position.z = 1.32;
    vault.add(dial);
    const metal = new THREE.MeshStandardMaterial({ color: WHITE, metalness: 0.6, roughness: 0.25 });
    dial.add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 16, 64), metal));
    dial.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 32).rotateX(Math.PI / 2), metal));
    for (let i = 0; i < 3; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.78, 0.05), metal);
      spoke.rotation.z = (i * Math.PI) / 3;
      dial.add(spoke);
    }
    // Small tick marks around the dial
    for (let i = 0; i < 12; i++) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.03), metal);
      const a = (i / 12) * Math.PI * 2;
      tick.position.set(Math.cos(a) * 0.58, Math.sin(a) * 0.58, 0);
      tick.rotation.z = a + Math.PI / 2;
      dial.add(tick);
    }

    // Glow halo behind the vault
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(1.9, 3.4, 64),
      new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
    );
    halo.position.z = -1.6;
    world.add(halo);

    // --- Heirs: nodes on tilted orbits, linked to the vault, with travelling pulses
    const heirs: Heir[] = [];
    const orbitMaterial = new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.55 });
    const orbits = [
      { radius: 3.3, tilt: 0.35, speed: 0.22, phase: 0 },
      { radius: 3.7, tilt: -0.55, speed: 0.17, phase: 2.1 },
      { radius: 4.1, tilt: 0.9, speed: 0.13, phase: 4.2 },
    ];
    for (const o of orbits) {
      const group = new THREE.Group();
      group.rotation.x = Math.PI / 2 - 0.25;
      group.rotation.y = o.tilt;
      world.add(group);

      const ring = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(
          Array.from({ length: 128 }, (_, i) => {
            const a = (i / 128) * Math.PI * 2;
            return new THREE.Vector3(Math.cos(a) * o.radius, Math.sin(a) * o.radius, 0);
          }),
        ),
        orbitMaterial,
      );
      group.add(ring);

      const node = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 32, 32),
        new THREE.MeshPhysicalMaterial({ color: CYAN, metalness: 0.1, roughness: 0.25, clearcoat: 1 }),
      );
      const nodeRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.4, 0.025, 12, 48),
        new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.6 }),
      );
      node.add(nodeRing);
      group.add(node);

      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        new THREE.LineDashedMaterial({ color: BLUE, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0.7 }),
      );
      world.add(line);

      const pulse = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 16, 16),
        new THREE.MeshBasicMaterial({ color: BLUE }),
      );
      world.add(pulse);

      heirs.push({ group, node, line, pulse, speed: o.speed, phase: o.phase, radius: o.radius });
    }

    // --- Floating particles
    const particleCount = 140;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const r = 3 + Math.random() * 3.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions.set([r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi) * 0.6, r * Math.sin(phi) * Math.sin(theta)], i * 3);
    }
    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particlesGeometry,
      new THREE.PointsMaterial({ color: BLUE, size: 0.045, transparent: true, opacity: 0.55 }),
    );
    world.add(particles);

    // --- Sizing, pointer parallax, visibility
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.position.z = camera.aspect < 0.9 ? 13.5 : 10.5;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    const pointer = { x: 0, y: 0 };
    const onPointerMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    let visible = true;
    const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    visibility.observe(mount);

    const nodeWorld = new THREE.Vector3();
    const clock = new THREE.Clock();
    let frame = 0;

    const renderFrame = (t: number) => {
      world.rotation.y += ((pointer.x * 0.35) - world.rotation.y) * 0.04;
      world.rotation.x += ((pointer.y * 0.18) - world.rotation.x) * 0.04;
      vault.rotation.y = Math.sin(t * 0.35) * 0.35;
      vault.position.y = Math.sin(t * 0.9) * 0.08;
      dial.rotation.z = t * 0.6;
      particles.rotation.y = t * 0.03;

      for (const heir of heirs) {
        const a = t * heir.speed + heir.phase;
        heir.node.position.set(Math.cos(a) * heir.radius, Math.sin(a) * heir.radius, 0);
        heir.node.children[0].rotation.x = t;
        heir.node.getWorldPosition(nodeWorld);
        world.worldToLocal(nodeWorld);

        const geo = heir.line.geometry as THREE.BufferGeometry;
        const pos = geo.attributes.position as THREE.BufferAttribute;
        pos.setXYZ(0, 0, vault.position.y, 0);
        pos.setXYZ(1, nodeWorld.x, nodeWorld.y, nodeWorld.z);
        pos.needsUpdate = true;
        heir.line.computeLineDistances();

        // Pulse travels vault -> heir, then restarts
        const k = (t * 0.45 + heir.phase * 0.17) % 1;
        heir.pulse.position.set(nodeWorld.x * k, vault.position.y + (nodeWorld.y - vault.position.y) * k, nodeWorld.z * k);
        heir.pulse.scale.setScalar(0.6 + Math.sin(k * Math.PI) * 0.8);
      }
      renderer.render(scene, camera);
    };

    const loop = () => {
      frame = requestAnimationFrame(loop);
      if (!visible) return;
      renderFrame(clock.getElapsedTime());
    };
    if (reduceMotion) {
      renderFrame(1.2);
    } else {
      loop();
    }

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibility.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      scene.traverse(obj => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach(m => m.dispose());
        else material?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  if (failed) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <img src="/images/logo-fundo-azul.png" alt="BSafe" className="w-40 h-40 rounded-3xl shadow-elevated" />
      </div>
    );
  }

  return <div ref={mountRef} className="w-full h-full overflow-hidden" aria-hidden="true" />;
}
