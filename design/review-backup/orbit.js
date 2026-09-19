/* Background product camera.

   Renders the real pouch model and moves a camera around it as the page
   scrolls. Each section below is a keyframe — azimuth, elevation, framing and
   horizontal offset — and the camera eases between them rather than snapping
   1:1 with the scrollbar.

   The model is decorative, so every failure path here is silent: no WebGL, a
   model that will not load, or reduced-motion all just leave the page without
   it. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const mount = document.getElementById('orbit-bg');
if (mount) init();

function init() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Camera storyboard, in document order.
     angle = azimuth°, tilt = elevation° (negative looks down),
     zoom  = framing, x = horizontal offset as % of viewport width. */
  const SHOTS = [
    { sel: '.hero',           angle:  10, tilt: -12, zoom: 1.20, x:  20 },
    /* The configurator holds a flattering 3/4 view rather than sweeping —
       the pouch is being inspected here, not toured. */
    { sel: '.configurator',   angle:  42, tilt:  -8, zoom: 0.72, x:   0 },
    { sel: '.process',        angle: 150, tilt:  -4, zoom: 0.90, x:   0 },
    { sel: '.sustainability', angle: 230, tilt:   6, zoom: 1.15, x: -22 },
    { sel: '.specs',          angle: 310, tilt: -16, zoom: 0.68, x:  34 },
    { sel: '.quote',          angle: 385, tilt: -12, zoom: 0.70, x:   0 },
    { sel: '.site-footer',    angle: 430, tilt: -12, zoom: 0.60, x:   0 }
  ];

  const KEYS = ['angle', 'tilt', 'zoom', 'x'];
  const DAMP = 0.085;

  // Brand palette applied over the model's own near-white materials.
  const FILM = 0xe9dfc8;
  const SEAL = 0xded2b8;
  const GUSSET = 0xd8cbb0;
  const SPOUT = 0xbe5f2c;
  const CAP = 0xc96831;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  } catch (err) {
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);

  /* Packaging film is semi-gloss, and a rough PBR surface lit only by
     directional lights renders as a flat matte blob — the sheen comes almost
     entirely from what it reflects. This is the cheapest believable room. */
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  /* Product-shot rig: a strong key to carve the form, a cool fill to keep the
     shadow side from going dead, and a back rim to separate the pouch from a
     background that is almost the same value as the film. Ambient stays low —
     raising it flattens the whole thing into a cream silhouette. */
  const key = new THREE.DirectionalLight(0xfff4e2, 1.5);
  key.position.set(0.55, 1.0, 0.8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.35);
  fill.position.set(-0.9, 0.15, 0.55);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xfff0dd, 0.7);
  rim.position.set(-0.4, 0.55, -1.0);
  scene.add(rim);

  const pivot = new THREE.Group();
  scene.add(pivot);

  let body = null;
  let spout = null;
  let spoutHome = new THREE.Vector3();
  let modelHeight = 0.28;
  let radius = 1;
  let ready = false;

  const shape = { bodyW: 1, bodyH: 1, spoutW: 1 };

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.load('assets/stand_up_pouch.glb', (gltf) => {
    const bodyParts = [];
    const spoutParts = [];

    /* The film is one glTF mesh with four primitives (front, back, seals,
       gusset), which three.js expands into a Group of meshes — so collect
       every mesh and classify it, rather than expecting one node per part.
       Collect first, reparent after: moving nodes mid-traverse skips some. */
    gltf.scene.traverse((node) => {
      if (!node.isMesh) return;
      paint(node);
      const label = node.name || (node.parent && node.parent.name) || '';
      if (/spout|cap/i.test(label)) spoutParts.push(node);
      else bodyParts.push(node);
    });

    if (!bodyParts.length) return;

    /* Meshopt compression brings KHR_mesh_quantization, which stores positions
       as integers and compensates with a transform on the loaded hierarchy.
       So these are moved with attach(), which preserves world placement —
       add() would silently drop that transform and render at the wrong size. */
    pivot.add(gltf.scene);
    gltf.scene.updateWorldMatrix(true, true);

    body = new THREE.Group();
    pivot.add(body);
    bodyParts.forEach((m) => body.attach(m));

    /* The spout rides in a group pivoted at its own centre, so changing spout
       diameter scales the cap about itself rather than flinging it away from
       the origin. Done with nested groups rather than by shifting geometry,
       which would fight the quantization transform. */
    if (spoutParts.length) {
      const box = new THREE.Box3();
      spoutParts.forEach((m) => box.expandByObject(m));
      box.getCenter(spoutHome);

      spout = new THREE.Group();
      spout.position.copy(spoutHome);
      pivot.add(spout);

      const inner = new THREE.Group();
      inner.position.copy(spoutHome).multiplyScalar(-1);
      spout.add(inner);
      spoutParts.forEach((m) => inner.attach(m));
    }

    const bounds = new THREE.Box3().setFromObject(body);
    modelHeight = bounds.max.y - bounds.min.y;
    radius = modelHeight * 3.1;

    applyShape();
    ready = true;
    dirty = true;
  });

  function paint(node) {
    const name = node.material && node.material.name ? node.material.name : '';
    const mat = node.material;
    if (!mat || !mat.color) return;
    if (/front film|back film/i.test(name)) mat.color.setHex(FILM);
    else if (/heat seal/i.test(name)) mat.color.setHex(SEAL);
    else if (/gusset/i.test(name)) mat.color.setHex(GUSSET);
    else if (/cap/i.test(name)) mat.color.setHex(CAP);
    else if (/spout|flange|tamper/i.test(name)) mat.color.setHex(SPOUT);
    if (/film|seal|gusset/i.test(name)) mat.roughness = 0.30;
    mat.envMapIntensity = 0.55;
  }


  function applyShape() {
    if (body) body.scale.set(shape.bodyW, shape.bodyH, shape.bodyW);
    if (spout) {
      spout.scale.setScalar(shape.spoutW);
      spout.position.set(spoutHome.x * shape.bodyW, spoutHome.y * shape.bodyH, spoutHome.z);
    }
  }

  // ---- sizing ----
  let size = 0;
  function resize() {
    const rect = renderer.domElement.getBoundingClientRect();
    size = rect.width || mount.clientWidth;
    if (!size) return;
    renderer.setSize(size, size, false);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
    dirty = true;
  }

  function draw(cam) {
    if (!ready || !size) return;
    const narrow = window.innerWidth < 720;
    const zoom = cam.zoom * (narrow ? 0.92 : 1);
    const offsetX = (cam.x / 100) * window.innerWidth * (narrow ? 0.4 : 1);
    renderer.domElement.style.transform =
      `translate(calc(-50% + ${offsetX.toFixed(1)}px), -50%)`;

    /* User drag is added on top of the damped storyboard value rather than fed
       through the damping, so dragging tracks the pointer 1:1. */
    const theta = ((cam.angle + userAngle) * Math.PI) / 180;
    const tilt = Math.max(-38, Math.min(28, cam.tilt + userTilt));
    const phi = Math.PI / 2 + (tilt * Math.PI) / 180;
    camera.position.setFromSphericalCoords(radius / zoom, phi, theta);
    camera.position.y += modelHeight * 0.5;
    camera.lookAt(0, modelHeight * 0.5, 0);
    renderer.render(scene, camera);
  }

  // ---- scroll -> camera ----
  let anchors = [];
  function measure() {
    anchors = [];
    for (const shot of SHOTS) {
      const el = document.querySelector(shot.sel);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const entry = { y: rect.top + window.pageYOffset + rect.height / 2 };
      for (const k of KEYS) entry[k] = shot[k];
      anchors.push(entry);
    }
    anchors.sort((a, b) => a.y - b.y);
  }

  function sample() {
    const out = {};
    if (!anchors.length) {
      for (const k of KEYS) out[k] = 0;
      return out;
    }
    const center = window.pageYOffset + window.innerHeight / 2;
    let a = anchors[0], b = null, t = 0;
    if (center > anchors[anchors.length - 1].y) {
      a = anchors[anchors.length - 1];
    } else {
      for (let i = 0; i < anchors.length - 1; i++) {
        if (center >= anchors[i].y && center <= anchors[i + 1].y) {
          a = anchors[i];
          b = anchors[i + 1];
          t = (center - a.y) / ((b.y - a.y) || 1);
          break;
        }
      }
    }
    for (const k of KEYS) out[k] = b ? a[k] + (b[k] - a[k]) * t : a[k];
    return out;
  }

  let current = null;
  let awake = true;
  let dirty = true;
  let userAngle = 0;
  let userTilt = 0;
  let dragging = false;

  /* Drag-to-rotate, scoped to the configurator's stage column. The offset is
     eased back to zero once that section leaves the viewport, so a spin here
     doesn't knock the rest of the storyboard out of alignment. */
  const stage = document.getElementById('config-stage');
  if (stage) {
    let lastX = 0;
    let lastY = 0;
    let pointerId = null;

    stage.addEventListener('pointerdown', (event) => {
      dragging = true;
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      stage.classList.add('is-dragging');
      event.preventDefault(); // otherwise the drag selects the copy beside it
      try { stage.setPointerCapture(pointerId); } catch (err) { pointerId = null; }
    });

    stage.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      userAngle += (event.clientX - lastX) * 0.45;
      userTilt -= (event.clientY - lastY) * 0.18;
      userTilt = Math.max(-26, Math.min(26, userTilt));
      lastX = event.clientX;
      lastY = event.clientY;
      dirty = true;
    });

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove('is-dragging');
      if (pointerId !== null && stage.hasPointerCapture(pointerId)) {
        stage.releasePointerCapture(pointerId);
      }
      pointerId = null;
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
  }

  function relaxUserRotation() {
    if (dragging || !stage) return;
    const rect = stage.getBoundingClientRect();
    const onScreen = rect.bottom > 0 && rect.top < window.innerHeight;
    if (onScreen) return;
    if (Math.abs(userAngle) > 0.01 || Math.abs(userTilt) > 0.01) {
      userAngle *= 0.92;
      userTilt *= 0.92;
      if (Math.abs(userAngle) < 0.01) userAngle = 0;
      if (Math.abs(userTilt) < 0.01) userTilt = 0;
      dirty = true;
    }
  }

  function tick() {
    if (awake) {
      relaxUserRotation();
      const target = sample();
      if (!current) {
        current = target;
        dirty = true;
      } else {
        for (const k of KEYS) {
          const delta = target[k] - current[k];
          if (Math.abs(delta) > 0.001) {
            current[k] += delta * DAMP;
            dirty = true;
          } else if (current[k] !== target[k]) {
            current[k] = target[k];
            dirty = true;
          }
        }
      }
      if (dirty) {
        draw(current);
        dirty = false;
      }
    }
    requestAnimationFrame(tick);
  }

  measure();
  resize();
  /* Section heights move after this runs — the configurator injects its
     controls, and webfonts reflow everything — so the anchors are re-taken
     once the page has settled. */
  window.addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  window.addEventListener('resize', () => {
    measure();
    resize();
  });

  document.addEventListener('visibilitychange', () => {
    awake = document.visibilityState === 'visible';
  });

  document.addEventListener('pouch:spec', (event) => {
    const next = event.detail || {};
    for (const k of Object.keys(shape)) {
      if (typeof next[k] === 'number') shape[k] = next[k];
    }
    applyShape();
    measure();
    dirty = true;
  });

  if (reduceMotion) {
    const still = sample();
    still.angle = 40;
    const drawWhenReady = () => {
      if (ready) draw(still);
      else requestAnimationFrame(drawWhenReady);
    };
    drawWhenReady();
  } else {
    requestAnimationFrame(tick);
  }
}
