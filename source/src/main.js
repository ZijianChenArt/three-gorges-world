import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { WORLD, assetUrl, getInitialSelection } from './config.js';
import { fitPositionToBox } from './camera-fit.js';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#world');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = matchMedia('(pointer: coarse)').matches;
const narrow = () => innerWidth <= 520;
const initial = getInitialSelection(location.search);
const state = { mode: initial.mode, view: initial.view, loaded: false, motion: false, interacting: false, manualView: false, transition: null, lastFrame: 0, elapsed: 0 };
const clock = new THREE.Clock();
let renderer, scene, camera, controls, root, keyLight, rimLight, floor, grid, rings, particles;
let environmentTarget, toastTimer, frameId, coordinateTime = 0;
const originalMaterials = new Map();
const materialVariants = new Map();
const scanUniforms = { uScanTime: { value: 0 } };

const icons = {
  field: '<path d="m3 18 15-8 15 8-15 8-15-8Zm3 7 12 7 12-7M11 14v-5l7-4 7 4v5M18 5v12"/>',
  core: '<ellipse cx="18" cy="18" rx="10" ry="14"/><path d="m14 10 8 4-8 4 8 4-8 4M8 18h20"/>',
  horizon: '<path d="M4 27V15m5 12V10m5 17V5m5 22V8m5 19V13m5 14V18M3 29h29"/>',
  aerial: '<path d="m7 11 4-3 4 3-4 3-4-3Zm13-5 4-3 4 3-4 3-4-3ZM22 17l4-3 4 3-4 3-4-3ZM9 24l4-3 4 3-4 3-4-3ZM5 30h26M11 14v16M24 9v21M26 20v10M13 27v3"/>',
  echo: '<path d="M4 29V4h23v25M9 29V8h19v21M14 29V12h15v17M19 29V16h11v13"/>',
  bloom: '<path d="m18 30-9-5L4 12l8 4-1-12 7 11 7-11-1 12 8-4-5 13-9 5Zm0 0V15M9 25l9-6 9 6"/>',
};

function makeViewButtons() {
  $('#view-buttons').innerHTML = WORLD.views.map((view) => `<button class="view-button" data-view="${view.id}" aria-pressed="false"><span class="view-icon"><svg viewBox="0 0 36 36" aria-hidden="true">${icons[view.icon] || icons.field}</svg></span><span class="view-text"><span class="view-title">${view.title}</span><span class="view-subtitle">${view.subtitle}</span></span><span class="view-number">${view.number}</span></button>`).join('');
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
    if (!state.loaded) return;
    setView(button.dataset.view);
    if (narrow()) setPanel(false);
  }));
}
function setPanel(expanded) {
  $('#panel-toggle').setAttribute('aria-expanded', String(expanded));
  $('#view-list').hidden = !expanded;
  $('#view-panel').classList.toggle('is-collapsed', !expanded);
}
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('is-visible'), 2700);
}
function markView(id) {
  document.querySelectorAll('[data-view]').forEach((button) => {
    const active = button.dataset.view === id;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
function setView(id, immediate = false) {
  const view = WORLD.views.find((item) => item.id === id) || WORLD.views[0];
  state.view = view.id;
  state.manualView = false;
  state.motion = false;
  $('#motion-toggle').setAttribute('aria-pressed', 'false');
  controls.autoRotate = false;
  controls.update();
  const target = new THREE.Vector3(...view.target);
  let position = new THREE.Vector3(...view.position);
  if (root) {
    const subject = view.group ? root.getObjectByName(view.group) || root : root;
    const bounds = new THREE.Box3().setFromObject(subject, true);
    position = fitPositionToBox(position, target, bounds, camera.fov, camera.aspect);
  }
  if (immediate || reducedMotion) {
    controls.target.copy(target); camera.position.copy(position); controls.update(); state.transition = null;
  } else {
    state.transition = { started: performance.now(), duration: 1350, fromPosition: camera.position.clone(), toPosition: position, fromTarget: controls.target.clone(), toTarget: target };
  }
  markView(view.id);
  $('#scene-location').textContent = `FIELD / ${view.subtitle}`;
  $('#view-description').innerHTML = view.description;
}
function createStage() {
  const ground = new THREE.CircleGeometry(90, 128);
  floor = new THREE.Mesh(ground, new THREE.MeshStandardMaterial({ color: 0x18201c, roughness: .52, metalness: .25 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.055;
  floor.receiveShadow = true;
  scene.add(floor);
  grid = new THREE.GridHelper(160, 80, 0x6b8274, 0x3b5145);
  grid.position.y = -.025;
  grid.material.transparent = true;
  grid.material.opacity = .16;
  grid.material.depthWrite = false;
  scene.add(grid);
  rings = new THREE.Group();
  for (const radius of [14, 20, 28, 39]) {
    const points = Array.from({ length: 257 }, (_, i) => new THREE.Vector3(Math.sin(i * Math.PI / 128) * radius, -.014, Math.cos(i * Math.PI / 128) * radius));
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xc9fc9b, transparent: true, opacity: radius === 14 ? .23 : .11, depthWrite: false }));
    rings.add(ring);
  }
  scene.add(rings);
  const positions = [];
  // Deterministic particles avoid a visually different scene on every reload.
  let seed = 2718;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 100; i++) positions.push((random() - .5) * 70, 1 + random() * 20, (random() - .5) * 70);
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color: 0xbfddb3, size: .028, transparent: true, opacity: .33, sizeAttenuation: true, depthWrite: false }));
  scene.add(particles);
}
function makeMonolithMaterial(original) {
  const isBase = /obsidian/i.test(original.name);
  const isLight = /light|amber/i.test(original.name);
  return new THREE.MeshStandardMaterial({
    color: isBase ? 0x28312b : isLight ? 0xe7ffd1 : 0xd4ddc9,
    roughness: isBase ? .62 : .39,
    metalness: isBase ? .32 : .26,
    emissive: isLight ? 0x52623c : 0x000000,
    emissiveIntensity: isLight ? .8 : 0,
    side: original.side,
  });
}
function makeSignalMaterial(original) {
  if (/obsidian/i.test(original.name)) return new THREE.MeshStandardMaterial({ color: 0x0c2029, roughness: .45, metalness: .4 });
  const material = new THREE.MeshStandardMaterial({ color: 0x123d50, roughness: .38, metalness: .35, emissive: 0x268a89, emissiveIntensity: .35, wireframe: true });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uScanTime = scanUniforms.uScanTime;
    shader.vertexShader = `varying vec3 vScanPosition;\n${shader.vertexShader}`.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvScanPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = `uniform float uScanTime;\nvarying vec3 vScanPosition;\n${shader.fragmentShader}`.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat scanBand = pow(max(0.0, 1.0 - abs(vScanPosition.y - mod(uScanTime * 1.35, 12.0) + 2.0) * 1.5), 3.0);\ntotalEmissiveRadiance += vec3(0.35, 1.0, 0.8) * scanBand * 4.0;');
  };
  material.customProgramCacheKey = () => 'signal-scan-v1';
  return material;
}
function variantsFor(material) {
  if (!materialVariants.has(material)) materialVariants.set(material, { source: material, monolith: makeMonolithMaterial(material), signal: makeSignalMaterial(material) });
  return materialVariants.get(material);
}
function setMode(mode) {
  if (!WORLD.appearance[mode]) return;
  state.mode = mode;
  const appearance = WORLD.appearance[mode];
  document.documentElement.style.setProperty('--accent', appearance.accent);
  document.querySelectorAll('[data-mode]').forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
  });
  if (!scene) return;
  scene.background.set(appearance.background); scene.fog.color.set(appearance.fog);
  floor.material.color.set(appearance.floor);
  keyLight.color.set(appearance.key); rimLight.color.set(appearance.rim);
  rings.children.forEach((ring) => ring.material.color.set(appearance.accent));
  particles.material.color.set(appearance.accent);
  scene.environmentIntensity = mode === 'source' ? .72 : .6;
  originalMaterials.forEach((original, mesh) => {
    mesh.material = Array.isArray(original) ? original.map((material) => variantsFor(material)[mode]) : variantsFor(original)[mode];
  });
  if (renderer) renderer.shadowMap.needsUpdate = true;
}
function initializeRenderer() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: coarsePointer ? 'low-power' : 'high-performance' });
  } catch (error) {
    console.warn('WebGL initialization failed', error);
    showError('当前浏览器无法创建三维画布。请使用支持 WebGL 2 的浏览器，或关闭低电量限制后重试。');
    return false;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarsePointer ? 1.4 : 1.8));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#121715');
  scene.fog = new THREE.FogExp2('#121715', Math.min(.013, .014 * innerWidth / innerHeight));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  environmentTarget = pmrem.fromScene(room, .04);
  scene.environment = environmentTarget.texture;
  room.dispose(); pmrem.dispose();
  camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, .03, 190);
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .07;
  controls.minDistance = 1.8; controls.maxDistance = 150;
  controls.maxPolarAngle = Math.PI * .49;
  controls.minPolarAngle = .08;
  controls.panSpeed = .65; controls.rotateSpeed = .55;
  controls.zoomSpeed = .8; controls.autoRotateSpeed = .32;
  controls.screenSpacePanning = false;
  controls.addEventListener('start', () => {
    state.transition = null;
    state.interacting = true;
    state.manualView = true;
    $('#gesture-hint').classList.add('is-quiet');
    markView('');
  });
  controls.addEventListener('end', () => { state.interacting = false; });
  scene.add(new THREE.HemisphereLight(0xdaf1ee, 0x162224, 1.35));
  keyLight = new THREE.DirectionalLight(0xffefda, 3.6);
  keyLight.position.set(-13, 24, 11);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(coarsePointer ? 1024 : 2048, coarsePointer ? 1024 : 2048);
  Object.assign(keyLight.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: .5, far: 70 });
  keyLight.shadow.bias = -.0003;
  keyLight.shadow.normalBias = .035;
  scene.add(keyLight);
  rimLight = new THREE.DirectionalLight(0xa78cff, 4.5);
  rimLight.position.set(5, 8, -15); scene.add(rimLight);
  const fill = new THREE.PointLight(0x62dada, 65, 35, 1.5);
  fill.position.set(-8, 4, 4); scene.add(fill);
  createStage(); setMode(state.mode); setView(state.view, true);
  animate();
  return true;
}
function showError(message) {
  $('#loading-screen').classList.add('is-loaded');
  $('#loading-screen').setAttribute('aria-busy', 'false');
  $('#error-detail').textContent = message;
  $('#error-card').hidden = false;
  document.querySelectorAll('[data-view],[data-mode],#motion-toggle,#reset-view').forEach((button) => { button.disabled = true; });
  document.body.dataset.status = 'error';
}
async function loadModel() {
  const loader = new GLTFLoader();
  let hardTimeout;
  const timeout = setTimeout(() => { $('#loading-detail').textContent = '网络较慢，仍在载入。请稍候…'; }, 12000);
  try {
    const loading = loader.loadAsync(assetUrl(WORLD.model.url), (event) => {
      if (event.total) {
        const fraction = Math.min(event.loaded / event.total, 1);
        $('#loading-progress').style.width = `${Math.max(5, fraction * 94)}%`;
        $('#loading-detail').textContent = `载入雕塑 ${Math.round(fraction * 100)}%`;
      }
    });
    const gltf = await Promise.race([loading, new Promise((_, reject) => {
      hardTimeout = setTimeout(() => reject(new Error('Model load timed out after 45 seconds.')), 45000);
    })]);
    root = gltf.scene;
    root.rotation.y = WORLD.model.rotationY;
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root, true);
    if (bounds.isEmpty()) throw new Error('The model contains no visible geometry.');
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = WORLD.model.normalizedSize / Math.max(size.x, size.y, size.z);
    root.scale.setScalar(scale);
    root.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true; object.receiveShadow = true;
      originalMaterials.set(object, object.material);
    });
    scene.add(root); setMode(state.mode);
    renderer.shadowMap.needsUpdate = true;
    state.loaded = true;
    setView(state.view, true);
    document.body.dataset.status = 'ready';
    $('#loading-progress').style.width = '100%';
    $('#loading-screen').setAttribute('aria-busy', 'false');
    setTimeout(() => $('#loading-screen').classList.add('is-loaded'), reducedMotion ? 0 : 240);
  } catch (error) {
    console.error('Unable to load sculpture asset', error);
    showError('雕塑文件暂时无法载入。请检查网络后重试。如果问题持续，请确认 models 文件夹与网页一同发布。');
  } finally { clearTimeout(timeout); clearTimeout(hardTimeout); }
}
function animate() {
  frameId = requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), .05);
  if (document.hidden || !renderer) return;
  if (!reducedMotion) {
    state.elapsed += delta;
    scanUniforms.uScanTime.value = state.elapsed;
    particles.rotation.y = Math.sin(state.elapsed * .035) * .06;
  }
  if (state.transition) {
    const transition = state.transition;
    const progress = Math.min((performance.now() - transition.started) / transition.duration, 1);
    const ease = progress < .5 ? 4 * progress ** 3 : 1 - ((-2 * progress + 2) ** 3) / 2;
    camera.position.lerpVectors(transition.fromPosition, transition.toPosition, ease);
    controls.target.lerpVectors(transition.fromTarget, transition.toTarget, ease);
    if (progress >= 1) state.transition = null;
  }
  // Keep panning within the installation, above the ground.
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, -25, 25);
  controls.target.y = THREE.MathUtils.clamp(controls.target.y, .2, 14);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, -25, 25);
  controls.update(delta);
  renderer.render(scene, camera);
  coordinateTime += delta;
  if (coordinateTime > .3) {
    coordinateTime = 0;
    const format = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
    $('#camera-coordinate').textContent = `X ${format(camera.position.x)} / Y ${format(camera.position.y)}`;
  }
}
function resize() {
  if (!renderer) return;
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  scene.fog.density = Math.min(.013, .014 * camera.aspect);
  renderer.setSize(innerWidth, innerHeight);
  if (state.loaded && !state.manualView && !state.motion) setView(state.view, true);
}

makeViewButtons();
setPanel(!narrow());
$('#model-credit').textContent = WORLD.model.credit;
$('#source-note').textContent = WORLD.model.provenance;
$('#panel-toggle').addEventListener('click', () => setPanel($('#panel-toggle').getAttribute('aria-expanded') !== 'true'));
document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
$('#reset-view').addEventListener('click', () => { if (state.loaded) setView('overview'); });
$('#motion-toggle').addEventListener('click', () => {
  if (!state.loaded) return;
  state.transition = null;
  state.motion = !state.motion;
  controls.autoRotate = state.motion;
  $('#motion-toggle').setAttribute('aria-pressed', String(state.motion));
  if (state.motion) { markView(''); toast('缓慢环绕中 · 再次点击可停止'); }
});
$('#retry-button').addEventListener('click', () => location.reload());
const aboutDialog = $('#about-dialog');
$('#about-open').addEventListener('click', () => { aboutDialog.showModal(); });
$('#about-close').addEventListener('click', () => aboutDialog.close());
$('#about-done').addEventListener('click', () => aboutDialog.close());
aboutDialog.addEventListener('click', (event) => { if (event.target === aboutDialog) { const r = aboutDialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) aboutDialog.close(); } });
if (!document.fullscreenEnabled) $('#fullscreen-toggle').hidden = true;
$('#fullscreen-toggle').addEventListener('click', async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch { toast('当前浏览器不支持全屏，可直接旋转手机观看'); }
});
window.addEventListener('resize', resize);
window.addEventListener('keydown', (event) => {
  if (!state.loaded || aboutDialog.open || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
  const index = Number(event.key) - 1;
  if (index >= 0 && index < WORLD.views.length) setView(WORLD.views[index].id);
  else if (event.key.toLowerCase() === 'r') setView('overview');
});
canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); cancelAnimationFrame(frameId); showError('浏览器暂停了三维渲染。请关闭其他占用资源的页面，然后重新载入。'); });
canvas.addEventListener('webglcontextrestored', () => location.reload());
if (initializeRenderer()) loadModel();
