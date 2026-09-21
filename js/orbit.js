/* The hero animates while visible; the configurator draws after interaction or resize. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const model = loader.loadAsync('assets/stand_up_pouch.glb');
// Keep the SVG illustration visible if the model cannot be loaded.
model.catch(() => {});
for (const id of ['hero-product', 'config-stage']) {
  const mount = document.getElementById(id);
  if (mount) createView(mount).catch(() => mount.classList.remove('is-ready'));
}
async function createView(mount) {
  const interactive = mount.id === 'config-stage';
  const heroView = mount.id === 'hero-product';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
  catch { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  mount.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .01, 20);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  pmrem.dispose();
  room.dispose();
  // The last light is the surface the pouch stands on bouncing light up. Every other light is overhead, so without
  // it the underside gets nothing and the Bottom view renders as a black hole. It points almost straight up on
  // purpose: any sideways component would also brighten the front and side faces.
  for (const [colour, power, position] of [[0xfff4e2, 1.6, [.55, 1, .8]], [0xdfe8ff, .4, [-.9, .15, .55]], [0xfff0dd, .7, [-.4, .55, -1]], [0xf1e6d2, 1.5, [.05, -1, .08]]]) {
    const light = new THREE.DirectionalLight(colour, power);
    light.position.set(...position); scene.add(light);
  }
  const pivot = new THREE.Group(); scene.add(pivot);
  let body, spout, handleGroup, baseHeight = .28, ready = false, pending = false, failed = false;
  const spoutHome = new THREE.Vector3();
  let variant = 'side', wantedVariant = 'side'; // where the spout sits: on the top corner, or centred
  const shape = { bodyW: 1, bodyH: 1, spoutW: 1, straightSides: 0 };
  let handleEnabled = false;
  // Straight sides are a morph target on the body: 0 = natural curve, 1 = straight.
  let sideMorph = null, spoutShiftX = 0, sideMix = 0, sideGoal = 0, sideFrame = 0;
  const baseAngle = interactive ? 32 : 15;
  const baseTilt = -9;
  let angle = baseAngle;
  let tilt = baseTilt;
  // Zoom eases toward its goal. Pan is in world units and only has room while zoomed in.
  const ZOOM_MIN = 1, ZOOM_MAX = 3;
  let zoom = 1, zoomGoal = 1, zoomFrame = 0, panX = 0, panY = 0;
  // Opening the spout: the cap unscrews and lifts off along the spout's axis, exposing the mouth.
  const OPEN_LIFT = .026, OPEN_TURNS = 2, OPEN_MS = 1000;
  let cap = null, bore = null, openMix = 0, openGoal = 0, openFrom = 0, openStart = 0, openDuration = OPEN_MS, openFrame = 0;
  let currentColour = 0xe9dfc8;
  const bodyMaterials = [];
  const controls = interactive ? mount.parentElement.querySelector('.rotation-controls') : null;
  function fail() {
    failed = true; ready = false; mount.classList.remove('is-ready');
    if (controls) controls.hidden = true;
    if (heroView) mount.parentElement.querySelector('[data-hero-motion]')?.setAttribute('hidden', '');
  }
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); fail(); });
  function draw() {
    pending = false;
    if (!ready || failed || document.hidden) return;
    const width = mount.clientWidth, height = mount.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    camera.position.setFromSphericalCoords(viewDistance(width, height), Math.PI / 2 + tilt * Math.PI / 180, angle * Math.PI / 180);
    camera.position.y += baseHeight * .51;
    camera.lookAt(0, baseHeight * .51, 0);
    if (handleGroup) {
      const frontFacing = Math.cos(angle * Math.PI / 180) >= 0;
      handleGroup.userData.front.visible = frontFacing;
      handleGroup.userData.back.visible = !frontFacing;
    }
    // Panning slides the camera sideways in its own frame, so it works from any rotation.
    clampPan();
    camera.translateX(-panX); camera.translateY(-panY);
    renderer.render(scene, camera);
    mount.classList.add('is-ready');
  }
  function requestDraw() { if (!pending && !failed) { pending = true; requestAnimationFrame(draw); } }
  function viewDistance(width, height) { return baseHeight * 2.95 * Math.max(1, height / width * .82) / zoom; }
  function clampPan() {
    const room = baseHeight * .7 * (1 - 1 / zoom); // none at 1x, so the pouch can never be lost off-screen
    panX = Math.max(-room, Math.min(room, panX));
    panY = Math.max(-room, Math.min(room, panY));
  }
  function applyShape() {
    if (body) {
      body.scale.set(shape.bodyW, shape.bodyH, shape.bodyW);
      // Not bodyParts: that list is declared after the model loads, and this can run before.
      body.children.forEach(part => { if (part.morphTargetInfluences) part.morphTargetInfluences[0] = sideMix; });
    }
    if (spout) {
      spout.scale.setScalar(shape.spoutW);
      // The spout rides the shoulder edge as the sides move, then scales with the body.
      spout.position.set((spoutHome.x + spoutShiftX * sideMix) * shape.bodyW, spoutHome.y * shape.bodyH, spoutHome.z);
    }
    if (handleGroup) {
      handleGroup.visible = handleEnabled;
      // The handle is meshed to the film and carries its own straight-sides morph, so it stays on the surface.
      handleGroup.traverse(node => { if (node.morphTargetInfluences) node.morphTargetInfluences[0] = sideMix; });
    }
    bodyMaterials.forEach(material => material.color.setHex(currentColour));
    requestDraw();
  }
  if (interactive) document.addEventListener('pouch:spec', event => {
    for (const key of Object.keys(shape)) if (Number.isFinite(event.detail[key])) shape[key] = event.detail[key];
    handleEnabled = event.detail.handle === 'opposite';
    wantedVariant = event.detail.spout === 'center' ? 'center' : 'side';
    if (ready && wantedVariant !== variant && assemble(wantedVariant)) syncSpoutButton();
    currentColour = event.detail.industry === 'beauty' ? 0xcac4d3 : 0xe9dfc8;
    setSideGoal(shape.straightSides ? 1 : 0);
    applyShape();
  });
  function setSideGoal(goal) {
    sideGoal = goal;
    if (!sideMorph || sideMix === goal) return;
    if (reduceMotion.matches) { sideMix = goal; return; }
    if (!sideFrame) sideFrame = requestAnimationFrame(stepSides);
  }
  function stepSides() {
    sideFrame = 0;
    const gap = sideGoal - sideMix;
    sideMix = Math.abs(gap) < .005 ? sideGoal : sideMix + gap * .18;
    applyShape();
    if (sideMix !== sideGoal) sideFrame = requestAnimationFrame(stepSides);
  }
  let gltf;
  try { gltf = await model; } catch { renderer.dispose(); environment.dispose(); fail(); return; }
  if (failed) return;
  /* The model has its spout on a chamfered top corner ("side"). A "center" bag is built from the same file:
     the corner is filled out symmetrically and the spout is stood upright on the top edge. */
  let bodyParts = [];
  function assemble(next) {
    variant = next;
    cancelAnimationFrame(openFrame); openFrame = 0;
    pivot.traverse(node => {
      if (!node.isMesh) return;
      node.geometry.dispose();
      [].concat(node.material).forEach(material => material.dispose());
    });
    pivot.clear();
    bodyMaterials.length = 0;
    body = spout = handleGroup = cap = bore = null;
    sideMorph = null; spoutShiftX = 0; openMix = 0; openGoal = 0;
    bodyParts = [];
    const spoutParts = [];
    const root = gltf.scene.clone(true);
    root.traverse(node => {
      if (!node.isMesh) return;
      node.geometry = node.geometry.clone();
      const packedPosition = node.geometry.getAttribute('position');
      const positionValues = new Float32Array(packedPosition.count * 3);
      for (let index = 0; index < packedPosition.count; index++) {
        positionValues[index * 3] = packedPosition.getX(index);
        positionValues[index * 3 + 1] = packedPosition.getY(index);
        positionValues[index * 3 + 2] = packedPosition.getZ(index);
      }
      node.geometry.setAttribute('position', new THREE.BufferAttribute(positionValues, 3));
      node.material = node.material.clone();
      const material = node.material;
      const name = material.name || '';
      if (/front film|back film/i.test(name)) { material.color.setHex(currentColour); bodyMaterials.push(material); }
      else if (/heat seal/i.test(name)) material.color.setHex(0xded2b8);
      else if (/gusset/i.test(name)) material.color.setHex(0xeae0ca); // the base is the same film as the body, just in shade
      else if (/cap|spout|flange|tamper/i.test(name)) material.color.setHex(0xbe5f2c);
      if (/film|seal|gusset/i.test(name)) material.roughness = .3;
      material.envMapIntensity = .6;
      const label = `${node.name || ''} ${node.parent?.name || ''} ${name}`;
      (/spout|cap|flange|tamper/i.test(label) ? spoutParts : bodyParts).push(node);
    });
    if (!bodyParts.length) { fail(); return false; }
    // Preserve transforms from mesh quantisation when regrouping the source model.
    pivot.add(root); root.updateWorldMatrix(true, true);
    body = new THREE.Group(); pivot.add(body);
    bodyParts.forEach(part => body.attach(part));
    if (variant === 'center') centreTheSpout(bodyParts, spoutParts);
    straightenBottom(bodyParts);
    foldBase(bodyParts);
    if (interactive) sideMorph = buildSideMorph(bodyParts);
    const frame = new THREE.Box3();
    if (spoutParts.length) {
      const bounds = new THREE.Box3(); spoutParts.forEach(part => bounds.expandByObject(part)); bounds.getCenter(spoutHome);
      // Average the edge movement over the height the spout occupies on the shoulder.
      if (sideMorph && variant === 'side') spoutShiftX = (sideMorph.edgeShiftAt(bounds.min.y) + sideMorph.edgeShiftAt(bounds.max.y)) / 2;
      // A centred spout scales about its weld flange, so it stays seated on the top edge as it grows.
      if (variant === 'center') spoutHome.copy(centreFlange);
      spout = new THREE.Group(); spout.position.copy(spoutHome); pivot.add(spout);
      const inner = new THREE.Group(); inner.position.copy(spoutHome).multiplyScalar(-1); spout.add(inner);
      spoutParts.forEach(part => inner.attach(part));
      if (interactive) setupOpening(spoutParts, inner);
      if (variant === 'center') frame.copy(bounds);
    }
    const bounds = new THREE.Box3().setFromObject(body);
    if (interactive) {
      handleGroup = createCarryHandle(bounds);
      body.add(handleGroup);
    }
    // A standing spout adds height above the body, and the camera has to frame all of it.
    frame.union(bounds);
    baseHeight = frame.max.y - frame.min.y;
    sideMix = sideMorph ? sideGoal : 0; // a restored "straight" choice shows immediately, not eased in
    ready = true; applyShape();
    return true;
  }

  const centreFlange = new THREE.Vector3();
  function centreTheSpout(parts, spoutParts) {
    body.updateWorldMatrix(true, true);
    const films = parts.filter(part => /front film|back film/i.test(part.material.name));
    const box = new THREE.Box3(); films.forEach(part => box.expandByObject(part));
    const minY = box.min.y, topY = box.max.y, height = topY - minY;
    const BINS = 96, binHeight = height / BINS;
    const left = new Array(BINS).fill(Infinity), right = new Array(BINS).fill(-Infinity);
    const world = new THREE.Vector3(), local = new THREE.Vector3();
    films.forEach(part => {
      part.updateWorldMatrix(true, false);
      const position = part.geometry.getAttribute('position');
      for (let index = 0; index < position.count; index++) {
        world.fromBufferAttribute(position, index).applyMatrix4(part.matrixWorld);
        const bin = THREE.MathUtils.clamp(Math.floor((world.y - minY) / binHeight), 0, BINS - 1);
        if (world.x < left[bin]) left[bin] = world.x;
        if (world.x > right[bin]) right[bin] = world.x;
      }
    });
    for (let i = BINS - 2; i >= 0; i--) if (!Number.isFinite(left[i])) { left[i] = left[i + 1]; right[i] = right[i + 1]; }
    for (let i = 1; i < BINS; i++) if (!Number.isFinite(left[i])) { left[i] = left[i - 1]; right[i] = right[i - 1]; }
    const centreY = index => minY + (index + .5) * binHeight;
    const sample = (profile, y) => {
      const at = THREE.MathUtils.clamp((y - minY) / binHeight - .5, 0, BINS - 1);
      const lower = Math.floor(at);
      return THREE.MathUtils.lerp(profile[lower], profile[Math.min(BINS - 1, lower + 1)], at - lower);
    };

    // Where the left edge leaves the straight wall and starts running toward the spout.
    const wall = sample(left, minY + height * .6);
    let start = topY;
    for (let i = Math.floor(BINS * .6); i < BINS; i++) if (left[i] > wall + height * .01) { start = centreY(i); break; }
    const middle = (sample(left, start) + sample(right, start)) / 2;
    const blend = height * .03;
    // Mirror the right edge across the middle, easing in over a few millimetres so no kink shows.
    const targetLeft = y => {
      const l = sample(left, y), mirrored = 2 * middle - sample(right, y);
      return l + (mirrored - l) * THREE.MathUtils.clamp((y - (start - blend)) / blend, 0, 1);
    };
    parts.forEach(part => {
      part.updateWorldMatrix(true, false);
      const inverseWorld = part.matrixWorld.clone().invert();
      const position = part.geometry.getAttribute('position');
      for (let index = 0; index < position.count; index++) {
        local.fromBufferAttribute(position, index);
        world.copy(local).applyMatrix4(part.matrixWorld);
        if (world.y > start - blend) {
          const l = sample(left, world.y), r = sample(right, world.y), tl = targetLeft(world.y);
          world.x = tl + (world.x - l) * (r - tl) / Math.max(r - l, 1e-6);
          position.setXYZ(index, ...world.applyMatrix4(inverseWorld).toArray());
        }
      }
      position.needsUpdate = true;
      part.geometry.computeBoundingBox(); part.geometry.computeBoundingSphere();
    });

    // Stand the spout upright with its weld flange on the top edge, at the middle.
    const find = pattern => spoutParts.find(part => pattern.test(part.name));
    const flangePart = find(/flange/i), capPart = find(/^cap/i);
    if (!flangePart || !capPart) return;
    const centreOf = part => new THREE.Box3().setFromObject(part).getCenter(new THREE.Vector3());
    spoutParts.forEach(part => part.updateWorldMatrix(true, false));
    const flange = centreOf(flangePart);
    const axis = centreOf(capPart).sub(flange).normalize();
    const upright = new THREE.Quaternion().setFromUnitVectors(axis, new THREE.Vector3(0, 1, 0));
    centreFlange.set(middle, topY + height * .004, 0);
    const move = new THREE.Matrix4()
      .makeTranslation(centreFlange.x, centreFlange.y, centreFlange.z)
      .multiply(new THREE.Matrix4().makeRotationFromQuaternion(upright))
      .multiply(new THREE.Matrix4().makeTranslation(-flange.x, -flange.y, -flange.z));
    spoutParts.forEach(part => {
      // Bake the whole move into the vertices so the part's own transform can go back to identity.
      part.geometry.applyMatrix4(part.matrixWorld.clone().premultiply(move));
      part.removeFromParent();
      part.position.set(0, 0, 0); part.quaternion.identity(); part.scale.set(1, 1, 1);
      part.updateMatrix();
      pivot.add(part);
      part.updateWorldMatrix(true, false);
    });
  }
  if (!assemble(wantedVariant)) return;
  new ResizeObserver(requestDraw).observe(mount);
  document.addEventListener('visibilitychange', requestDraw);
  if (heroView) {
    setupHeroMotion();
    return;
  }
  if (!interactive) return;
  controls.hidden = false;
  const pointers = new Map();
  let dragging = false, lastX = 0, lastY = 0, pinchSpread = 1, pinchZoom = 1, pinchX = 0, pinchY = 0;
  const spread = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  const midpoint = () => { const [a, b] = [...pointers.values()]; return [(a.x + b.x) / 2, (a.y + b.y) / 2]; };
  function panBy(dx, dy) {
    // Pixels to world units at the current zoom, so the pouch follows the pointer 1:1.
    const perPixel = 2 * viewDistance(mount.clientWidth, mount.clientHeight) * Math.tan(15 * Math.PI / 180) / mount.clientHeight;
    panX += dx * perPixel; panY -= dy * perPixel;
  }
  function syncZoomButtons() {
    // aria-disabled rather than disabled, so a focused button keeps focus when it reaches its limit.
    controls.querySelectorAll('[data-zoom]').forEach(button => {
      const atLimit = Number(button.dataset.zoom) > 0 ? zoomGoal >= ZOOM_MAX - .001 : zoomGoal <= ZOOM_MIN + .001;
      button.setAttribute('aria-disabled', String(atLimit));
    });
  }
  function setZoomGoal(goal, immediate = false) {
    zoomGoal = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, goal));
    syncZoomButtons();
    if (immediate || reduceMotion.matches) { zoom = zoomGoal; requestDraw(); return; }
    if (!zoomFrame) zoomFrame = requestAnimationFrame(stepZoom);
  }
  function stepZoom() {
    zoomFrame = 0;
    const gap = zoomGoal - zoom;
    zoom = Math.abs(gap) < .002 ? zoomGoal : zoom + gap * .2;
    requestDraw();
    if (zoom !== zoomGoal) zoomFrame = requestAnimationFrame(stepZoom);
  }
  syncZoomButtons();
  syncSpoutButton();
  // A press only counts as a click on the spout if it never turned into a drag or a pinch.
  const gesture = { x: 0, y: 0, moved: false, multi: false, time: 0 };

  mount.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    mount.classList.add('is-dragging');
    try { mount.setPointerCapture(event.pointerId); } catch { /* not an active pointer */ }
    if (pointers.size === 2) {
      // A second finger turns the gesture from rotate into pinch-zoom and pan.
      dragging = false; pinchSpread = spread(); pinchZoom = zoomGoal; [pinchX, pinchY] = midpoint();
      gesture.multi = true;
    } else if (pointers.size === 1) {
      dragging = true; lastX = event.clientX; lastY = event.clientY;
      Object.assign(gesture, { x: event.clientX, y: event.clientY, moved: false, multi: false, time: performance.now() });
    }
  });
  mount.addEventListener('pointermove', event => {
    const known = pointers.get(event.pointerId);
    if (!known) {
      // Hovering with a mouse: show the spout is clickable.
      if (event.pointerType === 'mouse' && !pointers.size) mount.style.cursor = overSpout(event.clientX, event.clientY) ? 'pointer' : '';
      return;
    }
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 6) gesture.moved = true;
    known.x = event.clientX; known.y = event.clientY;
    if (pointers.size === 2) {
      setZoomGoal(pinchZoom * spread() / pinchSpread, true); // tracks the fingers directly, no easing
      const [x, y] = midpoint();
      panBy(x - pinchX, y - pinchY);
      pinchX = x; pinchY = y;
      requestDraw();
    } else if (dragging) {
      const dx = event.clientX - lastX, dy = event.clientY - lastY;
      lastX = event.clientX; lastY = event.clientY;
      if (event.shiftKey && zoom > 1.001) panBy(dx, dy);
      else {
        // The camera orbits, so its angles move opposite to the drag: that way the pouch itself follows the pointer.
        angle -= dx * .55;
        tilt = Math.max(-75, Math.min(75, tilt - dy * .42));
      }
      requestDraw();
    }
  });
  function endPointer(event) {
    if (!pointers.delete(event.pointerId)) return; // pointerup and lostpointercapture both land here
    if (pointers.size === 1) {
      // Lifting one finger mid-pinch hands control back to the other, without a jump.
      const [rest] = pointers.values();
      dragging = true; lastX = rest.x; lastY = rest.y;
    } else dragging = false;
    if (!pointers.size) mount.classList.remove('is-dragging');
  }
  mount.addEventListener('pointerup', event => {
    // Runs before endPointer, so exactly one pointer is still down for a plain click.
    if (gesture.multi || gesture.moved || pointers.size !== 1 || performance.now() - gesture.time > 800) return;
    if (overSpout(event.clientX, event.clientY)) setOpen(openGoal ? 0 : 1);
  });
  mount.addEventListener('pointerup', endPointer); mount.addEventListener('pointercancel', endPointer); mount.addEventListener('lostpointercapture', endPointer);
  // Only Ctrl/Cmd + wheel (which is also how a trackpad pinch arrives) zooms; a plain wheel keeps scrolling the page.
  mount.addEventListener('wheel', event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoomGoal(zoomGoal * Math.exp(-event.deltaY * (event.deltaMode === 1 ? 16 : 1) * .0022));
  }, { passive: false });
  controls.addEventListener('click', event => {
    const rotate = event.target.closest('[data-rotate]');
    const view = event.target.closest('[data-view]');
    const step = event.target.closest('[data-zoom]');
    if (event.target.closest('[data-spout]')) setOpen(openGoal ? 0 : 1);
    if (rotate) angle -= Number(rotate.dataset.rotate); // data-rotate is how far the pouch turns (negative = left)
    if (step) setZoomGoal(zoomGoal * (Number(step.dataset.zoom) > 0 ? 1.35 : 1 / 1.35));
    if (view?.dataset.view === 'bottom') {
      angle = 18;
      tilt = 62;
    }
    if (view?.dataset.view === 'front') {
      angle = baseAngle;
      tilt = baseTilt;
      panX = panY = 0;
      setZoomGoal(1);
    }
    if (rotate || view || step) requestDraw();
  });

  /* Builds the "straight sides" shape as a morph target on every body part.

     The natural body is a barrel: widest ~15% up, tapering toward the top seal,
     with the lower corners rounding in. Straight sides means parallel vertical
     edges, so for each height this maps the cross-section's current left/right
     extents onto two fixed lines. Above the shoulder the left target slides
     back to the existing diagonal, so the spout still meets the film.

     It is a function of world (x, y) only, so vertices shared between the film,
     seal and gusset parts move identically and no seams open. */
  function buildSideMorph(parts) {
    body.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(body);
    const minY = box.min.y, height = box.max.y - box.min.y, topY = box.max.y;
    const BINS = 48, binHeight = height / BINS;
    const left = new Array(BINS).fill(Infinity), right = new Array(BINS).fill(-Infinity);
    const world = new THREE.Vector3(), local = new THREE.Vector3(), moved = new THREE.Vector3();

    parts.forEach(part => {
      part.updateWorldMatrix(true, false);
      const position = part.geometry.getAttribute('position');
      for (let index = 0; index < position.count; index++) {
        world.fromBufferAttribute(position, index).applyMatrix4(part.matrixWorld);
        const bin = THREE.MathUtils.clamp(Math.floor((world.y - minY) / binHeight), 0, BINS - 1);
        if (world.x < left[bin]) left[bin] = world.x;
        if (world.x > right[bin]) right[bin] = world.x;
      }
    });
    for (let i = 1; i < BINS; i++) if (!Number.isFinite(left[i])) { left[i] = left[i - 1]; right[i] = right[i - 1]; }
    for (let i = BINS - 2; i >= 0; i--) if (!Number.isFinite(left[i])) { left[i] = left[i + 1]; right[i] = right[i + 1]; }

    const centreY = index => minY + (index + .5) * binHeight;
    const sample = (profile, y) => {
      const at = THREE.MathUtils.clamp((y - minY) / binHeight - .5, 0, BINS - 1);
      const lower = Math.floor(at);
      return THREE.MathUtils.lerp(profile[lower], profile[Math.min(BINS - 1, lower + 1)], at - lower);
    };

    // The shoulder starts where the left edge turns steeply toward the spout (dx/dy > .5).
    let shoulder = minY + height * .82;
    for (let i = Math.floor(BINS * .5); i < BINS - 1; i++) {
      if ((left[i + 1] - left[i]) / binHeight > .5) { shoulder = centreY(i); break; }
    }
    shoulder = THREE.MathUtils.clamp(shoulder, minY + height * .55, minY + height * .93);

    // Straight edges sit at the mean half-width below the shoulder, keeping the body's overall volume.
    let halfSum = 0, centreSum = 0, samples = 0;
    for (let i = 0; i < BINS && centreY(i) <= shoulder; i++) {
      halfSum += (right[i] - left[i]) / 2; centreSum += (right[i] + left[i]) / 2; samples++;
    }
    const centre = centreSum / samples, half = halfSum / samples;
    const leftLine = centre - half, rightLine = centre + half, leftTop = sample(left, topY);
    const targetLeft = y => y <= shoulder ? leftLine
      : THREE.MathUtils.lerp(leftLine, leftTop, Math.min(1, (y - shoulder) / (topY - shoulder)));

    parts.forEach(part => {
      const geometry = part.geometry, position = geometry.getAttribute('position');
      const inverseWorld = part.matrixWorld.clone().invert();
      const basePositions = position.array.slice();
      const baseNormals = geometry.getAttribute('normal').array.slice();
      const deltaPositions = new Float32Array(basePositions.length);

      for (let index = 0; index < position.count; index++) {
        local.fromBufferAttribute(position, index);
        world.copy(local).applyMatrix4(part.matrixWorld);
        const l = sample(left, world.y), r = sample(right, world.y), tl = targetLeft(world.y);
        world.x = tl + (world.x - l) * (rightLine - tl) / Math.max(r - l, 1e-6);
        moved.copy(world).applyMatrix4(inverseWorld);
        deltaPositions[index * 3] = moved.x - local.x;
        deltaPositions[index * 3 + 1] = moved.y - local.y;
        deltaPositions[index * 3 + 2] = moved.z - local.z;
        position.setXYZ(index, moved.x, moved.y, moved.z);
      }

      // Normals for the morphed shape come from the shape itself, so lighting stays correct mid-transition.
      geometry.deleteAttribute('normal');
      geometry.computeVertexNormals();
      const morphedNormals = geometry.getAttribute('normal').array.slice();
      position.array.set(basePositions);
      position.needsUpdate = true;
      geometry.setAttribute('normal', new THREE.BufferAttribute(baseNormals, 3));

      geometry.morphAttributes.position = [new THREE.BufferAttribute(deltaPositions, 3)];
      geometry.morphAttributes.normal = [new THREE.BufferAttribute(morphedNormals.map((value, i) => value - baseNormals[i]), 3)];
      geometry.morphTargetsRelative = true;
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      part.updateMorphTargets();
    });

    return {
      edgeShiftAt: y => targetLeft(y) - sample(left, y),
      // Where the straight-sides morph sends a point of the body, so things laid on the film can follow it.
      deformX: (x, y) => {
        const l = sample(left, y), r = sample(right, y), tl = targetLeft(y);
        return tl + (x - l) * (rightLine - tl) / Math.max(r - l, 1e-6);
      },
      leftEdgeAt: y => sample(left, y),
      rightEdgeAt: y => sample(right, y)
    };
  }

  /* An illustrative die-cut carry handle. The source pouch has no boolean cut-out,
     so thin front/back overlays create a reinforced pad, inner shadow and opening
     without adding a bulky piece to the original model. */
  function roundedRectangle(path, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    path.moveTo(x + r, y);
    path.lineTo(x + width - r, y);
    path.quadraticCurveTo(x + width, y, x + width, y + r);
    path.lineTo(x + width, y + height - r);
    path.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    path.lineTo(x + r, y + height);
    path.quadraticCurveTo(x, y + height, x, y + height - r);
    path.lineTo(x, y + r);
    path.quadraticCurveTo(x, y, x + r, y);
    path.closePath();
  }


  function createCarryHandle(bounds) {
    const size = new THREE.Vector3(), centre = new THREE.Vector3();
    bounds.getSize(size); bounds.getCenter(centre);
    const outerWidth = size.x * .19;
    const outerHeight = size.y * .23;
    const edgeGap = size.x * .035;
    const topGap = size.y * .04;
    const onRight = spoutHome.x <= centre.x;
    const y = bounds.max.y - topGap - outerHeight;
    const anchorY = y + outerHeight / 2;
    const naturalEdge = sideMorph
      ? (onRight ? sideMorph.rightEdgeAt(anchorY) : sideMorph.leftEdgeAt(anchorY))
      : (onRight ? bounds.max.x : bounds.min.x);
    const x = onRight ? naturalEdge - edgeGap - outerWidth : naturalEdge + edgeGap;
    const insetX = outerWidth * .28;
    const insetY = outerWidth * .23;
    const innerWidth = outerWidth - insetX * 2;
    const innerHeight = outerHeight - insetY * 2;
    const group = new THREE.Group();
    const padShape = new THREE.Shape();
    roundedRectangle(padShape, x, y, outerWidth, outerHeight, outerWidth * .46);
    const shadowShape = new THREE.Shape();
    roundedRectangle(shadowShape, x + insetX, y + insetY, innerWidth, innerHeight, innerWidth * .48);
    const openingShape = new THREE.Shape();
    const shadow = outerWidth * .026;
    roundedRectangle(openingShape, x + insetX + shadow, y + insetY + shadow, innerWidth - shadow * 2, innerHeight - shadow * 2, innerWidth * .45);

    const padMaterial = new THREE.MeshPhysicalMaterial({
      color: currentColour, roughness: .34, envMapIntensity: .55, side: THREE.DoubleSide
    });
    const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0xa9a295, side: THREE.DoubleSide });
    const openingMaterial = new THREE.MeshBasicMaterial({ color: 0xe4e0d3, side: THREE.DoubleSide });
    bodyMaterials.push(padMaterial);
    /* Each layer is meshed onto the film's own surface, front and back. Laying flat stickers at one depth
       does not work: the pouch is ~75mm thick at the belly but only a few mm thick up where the handle
       sits, so a sticker placed at the belly's depth hangs centimetres in front of the film. */
    const surface = surfaceSampler(bodyParts);
    const offset = Math.max(size.z * .012, .00035);
    const makeFace = side => {
      const face = new THREE.Group();
      [[padShape, padMaterial, 1], [shadowShape, shadowMaterial, 2], [openingShape, openingMaterial, 3]].forEach(([shape, material, layer]) => {
        const mesh = new THREE.Mesh(conformedLayer(shape, surface, side, offset * layer), material);
        mesh.updateMorphTargets();
        face.add(mesh);
      });
      group.add(face);
      return face;
    };
    group.userData.front = makeFace(1);
    group.userData.back = makeFace(-1);
    group.userData.back.visible = false;
    group.visible = false;
    group.userData.anchorY = anchorY;
    return group;
  }

  /* The cap is a separate mesh already, so opening it is just a transform: turn about the spout's own
     axis while sliding out along it, like a thread. Nothing is downloaded and no geometry is added,
     apart from a small dark bore: the neck is a solid disc at its mouth, so without one the open
     spout would look like a plug. */
  function setupOpening(parts, inner) {
    const named = pattern => parts.find(part => pattern.test(part.name));
    const capPart = named(/^cap/i), neckPart = named(/neck/i), flangePart = named(/flange/i), ringPart = named(/tamper/i);
    if (!capPart || !neckPart || !flangePart) return;
    // Inside `inner`, coordinates match the model's own, so world boxes measured now are in the right space.
    const centreOf = part => new THREE.Box3().setFromObject(part).getCenter(new THREE.Vector3());
    const flange = centreOf(flangePart), capCentre = centreOf(capPart);
    const axis = capCentre.clone().sub(flange).normalize(); // out of the pouch, along the spout

    // How far out along the axis a part reaches, and how wide it is there.
    const point = new THREE.Vector3(), offset = new THREE.Vector3();
    const alongOf = v => offset.copy(v).sub(flange).dot(axis);
    const extent = part => {
      part.updateMatrix();
      const position = part.geometry.getAttribute('position');
      let top = -Infinity, radius = 0;
      for (let i = 0; i < position.count; i++) top = Math.max(top, alongOf(point.fromBufferAttribute(position, i).applyMatrix4(part.matrix)));
      for (let i = 0; i < position.count; i++) {
        point.fromBufferAttribute(position, i).applyMatrix4(part.matrix);
        const along = alongOf(point);
        if (along < top - .0002) continue;
        radius = Math.max(radius, offset.copy(point).sub(flange).addScaledVector(axis, -along).length());
      }
      return { top, radius };
    };
    /* The tamper ring's top face is a solid disc standing 0.8mm proud of the neck's mouth, so it is what
       an open spout actually shows: the bore has to sit on that face, or it would be buried inside it. */
    const neck = extent(neckPart), collar = ringPart ? extent(ringPart) : neck;
    const top = collar.top, mouthRadius = neck.radius;
    const boreRadius = mouthRadius * .64;
    bore = new THREE.Group();
    bore.add(
      new THREE.Mesh(new THREE.CircleGeometry(boreRadius, 40), new THREE.MeshBasicMaterial({ color: 0x241c15, side: THREE.DoubleSide })),
      new THREE.Mesh(new THREE.RingGeometry(boreRadius, mouthRadius * .76, 40), new THREE.MeshBasicMaterial({ color: 0x6d4223, side: THREE.DoubleSide }))
    );
    bore.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
    bore.position.copy(flange).addScaledVector(axis, top + mouthRadius * .012); // just proud of the disc, so it never z-fights
    bore.visible = false;
    inner.add(bore);

    capPart.updateMatrix();
    cap = { part: capPart, position0: capPart.position.clone(), quaternion0: capPart.quaternion.clone(), centre: capCentre, axis };
  }

  const openTurn = new THREE.Quaternion();
  function applyOpen() {
    if (!cap) return;
    const lift = openMix * openMix * (3 - 2 * openMix); // slow while it is still on the thread, quick once clear
    openTurn.setFromAxisAngle(cap.axis, openMix * OPEN_TURNS * Math.PI * 2);
    cap.part.quaternion.copy(openTurn).multiply(cap.quaternion0);
    cap.part.position.copy(cap.position0).sub(cap.centre).applyQuaternion(openTurn).add(cap.centre).addScaledVector(cap.axis, OPEN_LIFT * lift);
    bore.visible = openMix > .12;
    requestDraw();
  }
  function syncSpoutButton() {
    const button = controls?.querySelector('[data-spout]');
    if (!button) return;
    button.hidden = !cap;
    button.setAttribute('aria-pressed', String(openGoal === 1));
    button.textContent = openGoal ? 'Close spout' : 'Open spout';
  }
  function setOpen(goal) {
    goal = goal ? 1 : 0;
    if (!cap || goal === openGoal) return;
    openGoal = goal; openFrom = openMix; openStart = performance.now();
    openDuration = Math.max(250, OPEN_MS * Math.abs(goal - openFrom)); // a half-open cap doesn't take a full second to finish
    syncSpoutButton();
    if (reduceMotion.matches) { openMix = goal; applyOpen(); return; }
    if (!openFrame) openFrame = requestAnimationFrame(stepOpen);
  }
  function stepOpen(now) {
    openFrame = 0;
    const t = Math.min(1, Math.max(0, (now - openStart) / openDuration));
    const eased = t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
    openMix = openFrom + (openGoal - openFrom) * eased;
    applyOpen();
    if (t < 1) openFrame = requestAnimationFrame(stepOpen);
  }

  /* Whether a screen point is on the spout. The spout is ~30mm on a ~280mm pouch, which is a tiny thing
     to tap, so the target is its projected size with a fingertip-sized floor. It follows the cap as it lifts. */
  const hitBox = new THREE.Box3(), hitSize = new THREE.Vector3(), hitCentre = new THREE.Vector3(), hitEdge = new THREE.Vector3(), hitRight = new THREE.Vector3();
  function overSpout(clientX, clientY) {
    if (!cap || !ready) return false;
    camera.updateMatrixWorld();
    hitBox.setFromObject(spout);
    hitBox.getCenter(hitCentre); hitBox.getSize(hitSize);
    const rect = renderer.domElement.getBoundingClientRect();
    const toScreen = world => { const p = world.clone().project(camera); return [(p.x * .5 + .5) * rect.width, (-p.y * .5 + .5) * rect.height]; };
    const [sx, sy] = toScreen(hitCentre);
    hitRight.setFromMatrixColumn(camera.matrixWorld, 0);
    const [ex, ey] = toScreen(hitEdge.copy(hitCentre).addScaledVector(hitRight, hitSize.length() * .35));
    const reach = Math.max(Math.hypot(ex - sx, ey - sy), 22);
    return Math.hypot(clientX - rect.left - sx, clientY - rect.top - sy) <= reach;
  }

  /* How far the film's outer surface stands from the centre plane at any (x, y), front and back,
     read off the body's own vertices. Filled, blurred slightly and interpolated, so a layer laid on
     it follows the curve without picking up per-vertex noise as rippled shading. */
  function surfaceSampler(parts) {
    body.updateWorldMatrix(true, true);
    const CELL = .0015;
    const box = new THREE.Box3().setFromObject(body);
    const nx = Math.ceil((box.max.x - box.min.x) / CELL) + 2, ny = Math.ceil((box.max.y - box.min.y) / CELL) + 2;
    const front = new Float32Array(nx * ny).fill(-Infinity), back = new Float32Array(nx * ny).fill(Infinity);
    const world = new THREE.Vector3();
    parts.forEach(part => {
      part.updateWorldMatrix(true, false);
      const position = part.geometry.getAttribute('position');
      for (let i = 0; i < position.count; i++) {
        world.fromBufferAttribute(position, i).applyMatrix4(part.matrixWorld);
        const ix = Math.floor((world.x - box.min.x) / CELL), iy = Math.floor((world.y - box.min.y) / CELL);
        if (ix < 0 || iy < 0 || ix >= nx || iy >= ny) continue;
        const k = iy * nx + ix;
        if (world.z > front[k]) front[k] = world.z;
        if (world.z < back[k]) back[k] = world.z;
      }
    });
    const settle = grid => {
      for (let pass = 0, missing = true; missing && pass < 10; pass++) {
        missing = false;
        const next = grid.slice();
        for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
          const k = iy * nx + ix;
          if (Number.isFinite(grid[k])) continue;
          let sum = 0, count = 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const jx = ix + dx, jy = iy + dy;
            if (jx < 0 || jy < 0 || jx >= nx || jy >= ny) continue;
            const value = grid[jy * nx + jx];
            if (Number.isFinite(value)) { sum += value; count++; }
          }
          if (count) next[k] = sum / count; else missing = true;
        }
        grid.set(next);
      }
      for (let pass = 0; pass < 2; pass++) {
        const next = grid.slice();
        for (let iy = 1; iy < ny - 1; iy++) for (let ix = 1; ix < nx - 1; ix++) {
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += grid[(iy + dy) * nx + ix + dx];
          next[iy * nx + ix] = sum / 9;
        }
        grid.set(next);
      }
    };
    settle(front); settle(back);
    const at = (grid, x, y) => {
      const fx = THREE.MathUtils.clamp((x - box.min.x) / CELL - .5, 0, nx - 1.001);
      const fy = THREE.MathUtils.clamp((y - box.min.y) / CELL - .5, 0, ny - 1.001);
      const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      return THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(grid[iy * nx + ix], grid[iy * nx + ix + 1], tx),
        THREE.MathUtils.lerp(grid[(iy + 1) * nx + ix], grid[(iy + 1) * nx + ix + 1], tx), ty);
    };
    return { front: (x, y) => at(front, x, y), back: (x, y) => at(back, x, y) };
  }

  /* Meshes a rounded outline as concentric rings, each vertex sitting `lift` above the film. Rings rather
     than a plain triangulation because a few long triangles would cut straight across a curved surface. It
     also carries the straight-sides morph, moving with the film exactly as the film's own vertices do. */
  function conformedLayer(shape, surface, side, lift) {
    const outline = shape.getPoints(24);
    if (outline.length > 1 && outline[0].distanceTo(outline[outline.length - 1]) < 1e-9) outline.pop();
    const min = new THREE.Vector2(Infinity, Infinity), max = new THREE.Vector2(-Infinity, -Infinity);
    outline.forEach(point => { min.min(point); max.max(point); });
    const middle = min.clone().add(max).multiplyScalar(.5);
    const RINGS = 10, count = outline.length;
    const positions = new Float32Array((1 + RINGS * count) * 3), deltas = new Float32Array(positions.length);
    const put = (index, x, y) => {
      const z = side > 0 ? surface.front(x, y) + lift : surface.back(x, y) - lift;
      positions[index * 3] = x; positions[index * 3 + 1] = y; positions[index * 3 + 2] = z;
      if (sideMorph) deltas[index * 3] = sideMorph.deformX(x, y) - x;
    };
    put(0, middle.x, middle.y);
    for (let ring = 1; ring <= RINGS; ring++) {
      for (let i = 0; i < count; i++) {
        const point = outline[i];
        put(1 + (ring - 1) * count + i, middle.x + (point.x - middle.x) * ring / RINGS, middle.y + (point.y - middle.y) * ring / RINGS);
      }
    }
    const vertex = (ring, i) => 1 + (ring - 1) * count + (i % count);
    const indices = [];
    for (let i = 0; i < count; i++) indices.push(0, vertex(1, i), vertex(1, i + 1));
    for (let ring = 1; ring < RINGS; ring++) {
      for (let i = 0; i < count; i++) {
        indices.push(vertex(ring, i), vertex(ring + 1, i), vertex(ring + 1, i + 1), vertex(ring, i), vertex(ring + 1, i + 1), vertex(ring, i + 1));
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    if (sideMorph) {
      geometry.morphAttributes.position = [new THREE.BufferAttribute(deltas, 3)];
      geometry.morphTargetsRelative = true;
    }
    return geometry;
  }

  /* Gives the base the folded look of a real gusseted pouch bottom.

     straightenBottom flattens the base to one plane, which is clean but reads as
     a blank disc. A real base is a sheet folded inward along its centre line, with
     a diagonal crease running from each end of that fold out to the corners: a
     hip roof seen from underneath. So the base is lifted into that shape, and the
     creases are darkened the way the film shadows itself along a fold.

     The relief is zero all along the rim, so it still meets the film's bottom edge
     flush, and it only rises into the pouch, so nothing shows from the sides. */
  function foldBase(parts) {
    const gusset = parts.filter(part => /gusset/i.test(part.material.name || ''));
    if (!gusset.length) return;
    body.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(body);
    const bodyHeight = box.max.y - box.min.y;
    const base = new THREE.Box3();
    gusset.forEach(part => base.expandByObject(part));
    const cx = (base.min.x + base.max.x) / 2, cz = (base.min.z + base.max.z) / 2;
    const reach = (base.max.x - base.min.x) / 2;
    const RISE = bodyHeight * .05;       // how far the ridge is pushed up into the pouch
    const END = reach * .55;             // how much of each end is taken up by the corner creases
    const FOLD_WIDTH = bodyHeight * .009; // softness of the darkening along a crease
    const FOLD_DARK = .36;
    const FACET_LIGHT = .3;              // the two slopes face different ways, so they catch light differently
    const world = new THREE.Vector3(), moved = new THREE.Vector3();

    // The base's outline is a lens: how far front-to-back it reaches at each distance from the middle.
    const BINS = 32, depth = new Array(BINS).fill(0);
    gusset.forEach(part => {
      part.updateWorldMatrix(true, false);
      const position = part.geometry.getAttribute('position');
      for (let i = 0; i < position.count; i++) {
        world.fromBufferAttribute(position, i).applyMatrix4(part.matrixWorld);
        const bin = THREE.MathUtils.clamp(Math.floor(Math.abs(world.x - cx) / reach * BINS), 0, BINS - 1);
        depth[bin] = Math.max(depth[bin], Math.abs(world.z - cz));
      }
    });
    for (let i = BINS - 2; i >= 0; i--) depth[i] = Math.max(depth[i], depth[i + 1] * .999); // no gaps toward the tips
    const depthAt = ax => {
      const at = THREE.MathUtils.clamp(ax / reach * BINS - .5, 0, BINS - 1), lower = Math.floor(at);
      return THREE.MathUtils.lerp(depth[lower], depth[Math.min(BINS - 1, lower + 1)], at - lower);
    };

    gusset.forEach(part => {
      const old = part.geometry;
      // Unindexed, so each facet keeps its own normal and the creases stay crisp instead of smoothing over.
      const geometry = old.toNonIndexed();
      old.dispose();
      part.geometry = geometry;
      const position = geometry.getAttribute('position');
      const inverseWorld = part.matrixWorld.clone().invert();
      const colours = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count; i++) {
        world.fromBufferAttribute(position, i).applyMatrix4(part.matrixWorld);
        const ax = Math.abs(world.x - cx), az = Math.abs(world.z - cz);
        const d = depthAt(ax);
        const across = d > 1e-5 ? THREE.MathUtils.clamp(1 - az / d, 0, 1) : 0; // 0 on the rim, 1 on the centre line
        const along = Math.min(1, THREE.MathUtils.clamp((reach - ax) / END, 0, 1));
        world.y += RISE * Math.min(across, along);
        // The crease is wherever the two slopes meet, measured in millimetres-ish across the base.
        const fold = Math.abs(across - along) * d;
        const shade = 1 - FOLD_DARK * Math.exp(-((fold / FOLD_WIDTH) ** 2));
        colours[i * 3] = colours[i * 3 + 1] = colours[i * 3 + 2] = shade;
        moved.copy(world).applyMatrix4(inverseWorld);
        position.setXYZ(i, moved.x, moved.y, moved.z);
      }
      position.needsUpdate = true;
      geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
      geometry.deleteAttribute('normal');
      geometry.computeVertexNormals();
      const normal = geometry.getAttribute('normal');
      for (let i = 0; i < position.count; i++) {
        const facet = .94 + FACET_LIGHT * normal.getZ(i);
        colours[i * 3] *= facet; colours[i * 3 + 1] *= facet; colours[i * 3 + 2] *= facet;
      }
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      part.material.vertexColors = true;
      part.material.needsUpdate = true;
    });
    body.updateWorldMatrix(true, true);
  }

  function straightenBottom(parts) {
    body.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(body);
    const centre = new THREE.Vector3(), size = new THREE.Vector3();
    bounds.getCenter(centre); bounds.getSize(size);
    const height = bounds.max.y - bounds.min.y;
    const straightY = bounds.min.y + height * .055;
    const flatTop = bounds.min.y + height * .085;
    const blendTop = bounds.min.y + height * .16;
    const gussetLift = height * .042;
    const halfWidth = Math.max(size.x / 2, 1e-6);
    const halfDepth = Math.max(size.z / 2, 1e-6);
    const worldPoint = new THREE.Vector3();

    parts.forEach(part => {
      const position = part.geometry.getAttribute('position');
      if (!position) return;
      part.updateWorldMatrix(true, false);
      const inverseWorld = part.matrixWorld.clone().invert();
      for (let index = 0; index < position.count; index++) {
        worldPoint.fromBufferAttribute(position, index).applyMatrix4(part.matrixWorld);
        if (worldPoint.y >= blendTop) continue;
        // The outer front/back edges stay level, giving the pouch its straight
        // standing line. Film nearer the centre depth lifts into the recessed
        // V fold seen on a stand-up pouch gusset; the lift tapers at the corners.
        const depthInset = 1 - THREE.MathUtils.clamp(Math.abs(worldPoint.z - centre.z) / halfDepth, 0, 1);
        const widthInset = 1 - THREE.MathUtils.clamp(Math.abs(worldPoint.x - centre.x) / halfWidth, 0, 1);
        const foldedY = straightY + gussetLift * Math.pow(depthInset, 1.25) * Math.pow(widthInset, .35);
        if (worldPoint.y <= flatTop) {
          worldPoint.y = foldedY;
        } else {
          const progress = THREE.MathUtils.clamp((worldPoint.y - flatTop) / (blendTop - flatTop), 0, 1);
          const eased = progress * progress * (3 - 2 * progress);
          worldPoint.y = THREE.MathUtils.lerp(foldedY, worldPoint.y, eased);
        }
        worldPoint.applyMatrix4(inverseWorld);
        position.setXYZ(index, worldPoint.x, worldPoint.y, worldPoint.z);
      }
      position.needsUpdate = true;
      part.geometry.deleteAttribute('normal');
      part.geometry.computeVertexNormals();
      part.geometry.computeBoundingBox();
      part.geometry.computeBoundingSphere();
    });
    body.updateWorldMatrix(true, true);
  }

  function setupHeroMotion() {
    let visible = false;
    let pointerActive = false;
    let targetYaw = 0;
    let targetPitch = 0;
    let currentYaw = 0;
    let currentPitch = 0;
    let frame = 0;
    let elapsed = 0;
    let lastTime = null;
    let paused = false;
    const motionButton = mount.parentElement.querySelector('[data-hero-motion]');

    function syncMotionButton() {
      if (!motionButton) return;
      motionButton.hidden = reduceMotion.matches || failed;
      motionButton.textContent = paused ? 'Play motion' : 'Pause motion';
      motionButton.setAttribute('aria-label', paused ? 'Play product animation' : 'Pause product animation');
    }
    syncMotionButton();
    motionButton?.addEventListener('click', () => {
      paused = !paused;
      if (paused) stop();
      else start();
      syncMotionButton();
    });

    const observer = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false;
      if (visible) start();
      else stop();
    }, { threshold: .05 });
    observer.observe(mount);

    function start() {
      if (frame || !visible || paused || failed || reduceMotion.matches || document.hidden) return;
      frame = requestAnimationFrame(animate);
    }

    function stop() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lastTime = null;
    }

    function animate(time) {
      frame = 0;
      if (!visible || paused || failed || reduceMotion.matches || document.hidden) return;

      // Eight-second turns reveal the pouch depth within the first few seconds.
      // Keep the turn running under pointer parallax, and freeze its phase when paused.
      const delta = lastTime === null ? 0 : Math.min(time - lastTime, 64);
      lastTime = time;
      elapsed += delta;
      const phase = elapsed * Math.PI * 2 / 8000;
      const idle = Math.sin(phase) * 28;
      const ease = 1 - Math.exp(-delta / 180);
      currentYaw += (targetYaw - currentYaw) * ease;
      currentPitch += (targetPitch - currentPitch) * ease;
      angle = baseAngle + idle + currentYaw;
      tilt = baseTilt + Math.sin(phase) * 2 + currentPitch;
      requestDraw();
      frame = requestAnimationFrame(animate);
    }

    mount.addEventListener('pointerenter', event => {
      if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      pointerActive = true;
      start();
    });

    mount.addEventListener('pointermove', event => {
      if (!pointerActive || reduceMotion.matches) return;
      const rect = mount.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      targetYaw = x * 22;
      targetPitch = -y * 8;
    });

    mount.addEventListener('pointerleave', () => {
      pointerActive = false;
      targetYaw = 0;
      targetPitch = 0;
    });

    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
    reduceMotion.addEventListener('change', event => {
      if (event.matches) {
        stop();
        pointerActive = false;
        targetYaw = targetPitch = currentYaw = currentPitch = 0;
        angle = baseAngle;
        tilt = baseTilt;
        elapsed = 0;
        requestDraw();
      } else {
        start();
      }
      syncMotionButton();
    });
  }
}
