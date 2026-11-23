import * as THREE from 'three';

const viewer = document.querySelector('.lamp-view');
const canvas = viewer.querySelector('canvas');
const button = viewer.querySelector('button');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const point = (x, y, z) => new THREE.Vector3(x, y, z);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
const renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;

const lamp = new THREE.Group();
scene.add(lamp);

function noise(x, y, period = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const smooth = t => t * t * (3 - 2 * t);
  const hash = (i, j) => {
    if (period) i = ((i % period) + period) % period;
    let seed = Math.imul(i, 1597334677) ^ Math.imul(j, 3812015801);
    seed = Math.imul(seed ^ (seed >>> 13), 2246822519);
    return ((seed ^ (seed >>> 16)) >>> 0) / 4294967295;
  };
  const u = smooth(x - xi), v = smooth(y - yi);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(hash(xi, yi), hash(xi + 1, yi), u),
    THREE.MathUtils.lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v);
}

function grain(endGrain) {
  const board = document.createElement('canvas');
  const relief = document.createElement('canvas');
  const size = 768;
  board.width = board.height = relief.width = relief.height = size;
  const ctx = board.getContext('2d'), bump = relief.getContext('2d');
  const image = ctx.createImageData(size, size), height = bump.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const i = 4 * (y * size + x);
      const patches = noise(8 * u + 11, 11 * v, 8);
      const flecks = noise(75 * u, 88 * v, 75) - .5;
      let lift, hue, depth;
      if (endGrain) {
        const dx = (u - .45) * 1.06, dy = (v - .53) * .93;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const radial = dist + .009 * noise(u * 9 + 2, v * 8) + .007 * Math.sin(3 * angle) * dist;
        const ring = Math.pow(.5 + .5 * Math.sin(178 * radial + 1.1 * Math.sin(radial * 49)), 7);
        const rays = Math.pow(Math.max(0, Math.cos(angle * 19 + noise(u * 11, v * 9) * 2)), 46);
        const checking = rays * Math.max(0, Math.sin(dist * 12 + angle * 3)) *
          Math.min(1, Math.max(0, (dist - .14) * 5));
        lift = 1 + (patches - .5) * .22 + flecks * .11 - ring * .15 - checking * .53;
        hue = [145, 110, 75];
        depth = .62 - ring * .12 - checking * .29 + flecks * .07;
      } else {
        const warp = (noise(7 * u + 16, 5 * v, 7) - .5) * .075
          + (noise(14 * u + 2, 18 * v, 14) - .5) * .019;
        const grainU = u + warp;
        const ridges = noise(39 * grainU, 7 * v, 39);
        const splits = noise(67 * grainU + 23, 12 * v, 67);
        const narrow = Math.pow(Math.max(0, (splits - .48) / .52), 4);
        const flakes = noise(114 * u + 4, 51 * v, 114);
        const weathered = noise(13 * u + 3, 8 * v, 13);
        lift = .80 + ridges * .37 + (patches - .5) * .45 + (flakes - .5) * .24
          + flecks * .13 - narrow * .46;
        hue = [77 + weathered * 29, 62 + weathered * 16, 48 + weathered * 9];
        depth = .31 + ridges * .42 + (flakes - .5) * .14 - narrow * .31;
      }
      for (let channel = 0; channel < 3; channel++) {
        image.data[i + channel] = hue[channel] * lift;
        height.data[i + channel] = depth * 255;
      }
      image.data[i + 3] = height.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  bump.putImageData(height, 0, 0);
  const map = new THREE.CanvasTexture(board), bumpMap = new THREE.CanvasTexture(relief);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = bumpMap.wrapS = THREE.RepeatWrapping;
  map.anisotropy = bumpMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return {map, bumpMap};
}

const wood = new THREE.MeshStandardMaterial({...grain(false), bumpScale:.085, roughness:.94});
const cut = new THREE.MeshStandardMaterial({...grain(true), bumpScale:.025, roughness:.82});
const iron = new THREE.MeshStandardMaterial({color:0x282c26, metalness:.63, roughness:.46});
const bronze = new THREE.MeshStandardMaterial({color:0x926849, metalness:.65, roughness:.37});
const cord = new THREE.MeshStandardMaterial({color:0x25201a, roughness:.86});

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  lamp.add(object);
  return object;
}

const baseProfile = new THREE.CylinderGeometry(.79, .85, .22, 72, 4);
const basePositions = baseProfile.attributes.position;
for (let i = 0; i < basePositions.count; i++) {
  const x = basePositions.getX(i), z = basePositions.getZ(i);
  const angle = Math.atan2(z, x);
  const edge = 1 + .048 * Math.sin(angle * 5) + .025 * Math.cos(angle * 13)
    + .028 * Math.sin(angle * 9 + .8) + .013 * Math.cos(angle * 23);
  const thickness = .022 * Math.cos(4 * angle + .8) + .012 * Math.sin(11 * angle);
  const edgeWeight = Math.min(1, Math.hypot(x, z) / .75);
  basePositions.setXYZ(i, x * edge * 1.15, basePositions.getY(i) + thickness * edgeWeight, z * edge * .88);
}
baseProfile.computeVertexNormals();
mesh(baseProfile, [wood, cut, cut], 0, .12);

function branch(points, start, end, seed, taper) {
  const path = new THREE.CatmullRomCurve3(points.map(p => point(...p)));
  const segments = 76, sides = 44;
  const frames = path.computeFrenetFrames(segments, false);
  const vertices = [], uv = [], indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, center = path.getPointAt(t);
    for (let j = 0; j <= sides; j++) {
      const a = 2 * Math.PI * j / sides;
      const lumps = noise(j * 8 / sides + seed, 9 * t + seed, 8) - .5;
      const chips = noise(j * 30 / sides + seed, 21 * t, 30) - .5;
      const knots = 1 + .115 * Math.sin(a * 3 + seed + 4 * t)
        + .07 * Math.sin(a * 7 - 8 * t) + .23 * lumps + .065 * chips;
      const r = THREE.MathUtils.lerp(start, end, Math.pow(t, taper)) * knots;
      const vertex = center.clone().addScaledVector(frames.normals[i], r * Math.cos(a))
        .addScaledVector(frames.binormals[i], r * Math.sin(a));
      vertices.push(vertex.x, vertex.y, vertex.z);
      uv.push(j / sides, t);
      if (i && j) {
        const k = i * (sides + 1) + j, previous = k - sides - 1;
        indices.push(previous - 1, previous, k - 1, previous, k, k - 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const barkSides = wood.clone();
  barkSides.side = THREE.DoubleSide;
  mesh(geo, barkSides);
}

branch([[-.52,.19,.02],[-.65,.76,.08],[-.57,1.37,.01],[-.68,2.03,-.12],[-.47,2.68,-.12],[-.13,3.21,-.13],[.35,3.37,-.09],[.61,3.54,.01]], .235, .034, 1.2, .79);
branch([[-.64,1.72,-.04],[-.87,2.04,-.18],[-1.03,2.42,-.29],[-.97,2.67,-.33]], .117, .014, 4.1, .86);
branch([[-.55,2.44,-.11],[-.4,2.79,.15],[-.41,3.12,.31]], .08, .013, 2.6, .85);

function pipe(points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points);
  return mesh(new THREE.TubeGeometry(curve, 36, radius, 8, false), material);
}

function rod(a, b, radius, material) {
  const center = a.clone().lerp(b, .5);
  const object = mesh(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 8), material,
    center.x, center.y, center.z);
  object.quaternion.setFromUnitVectors(point(0, 1, 0), b.clone().sub(a).normalize());
}

const cx = .39, cz = .07;
pipe([point(-.32,.12,-.02),point(-.54,1.08,-.07),point(-.46,2.06,-.18),
  point(-.40,2.78,-.18),point(-.08,3.28,-.15),point(cx,3.41,-.085),
  point(cx,3.25,cz),point(cx,2.92,cz)], .019, cord);
mesh(new THREE.CylinderGeometry(.109,.116,.22,32), bronze, cx,2.88,cz);
for (let y = 2.80; y < 2.98; y += .035) {
  const groove = mesh(new THREE.TorusGeometry(.111,.007,6,28), iron,cx,y,cz);
  groove.rotation.x = Math.PI / 2;
}

const rings = [[2.78,.117],[2.59,.37],[2.04,.44],[1.87,.27]];
const count = 7;
const ringPoint = (level, i) => {
  const [y, radius] = rings[level], a = (i / count) * Math.PI * 2 + .19;
  return point(cx + radius * Math.cos(a), y, cz + radius * Math.sin(a));
};
for (let ring = 0; ring < rings.length; ring++) {
  for (let i = 0; i < count; i++) {
    const a = ringPoint(ring, i);
    rod(a, ringPoint(ring, i + 1), .017, iron);
    if (ring) rod(a, ringPoint(ring - 1, i), .018, iron);
  }
}

const glass = new THREE.MeshPhysicalMaterial({
  color:0xffdaa1, emissive:0xd17b24, emissiveIntensity:.13, transparent:true, opacity:.24,
  metalness:.14, roughness:.15, clearcoat:1, depthWrite:false
});
const contour = [[0,-.247],[.082,-.24],[.14,-.205],[.164,-.14],[.166,.005],
  [.136,.12],[.087,.215],[.075,.29]].map(([r,y]) => new THREE.Vector2(r,y));
mesh(new THREE.LatheGeometry(contour, 48), glass, cx,2.43,cz).renderOrder = 2;
const filament = new THREE.MeshBasicMaterial({color:0xffedc6, toneMapped:false});
const filamentHalo = new THREE.MeshBasicMaterial({
  color:0xffa42f, transparent:true, opacity:.27, blending:THREE.AdditiveBlending,
  depthWrite:false, toneMapped:false
});
for (let i = 0; i < 3; i++) {
  const points = [];
  for (let j = 0; j <= 25; j++) {
    const t = j / 25, a = i * (2 * Math.PI / 3) + t * Math.PI;
    points.push(point(cx + .063*Math.cos(a), 2.27 + t*.34, cz + .063*Math.sin(a)));
  }
  pipe(points, .0065, filament);
  pipe(points, .013, filamentHalo);
}
const glowCanvas = document.createElement('canvas');
glowCanvas.width = glowCanvas.height = 128;
const glowContext = glowCanvas.getContext('2d');
const halo = glowContext.createRadialGradient(64,64,0,64,64,64);
halo.addColorStop(0,'rgba(255,204,119,.80)');
halo.addColorStop(.14,'rgba(255,180,76,.59)');
halo.addColorStop(.38,'rgba(255,151,45,.26)');
halo.addColorStop(.68,'rgba(255,115,26,.07)');
halo.addColorStop(1,'rgba(255,103,27,0)');
glowContext.fillStyle = halo;
glowContext.fillRect(0,0,128,128);
const bloom = new THREE.Sprite(new THREE.SpriteMaterial({
  map:new THREE.CanvasTexture(glowCanvas), transparent:true, depthWrite:false,
  blending:THREE.AdditiveBlending, opacity:.79, toneMapped:false
}));
bloom.position.set(cx,2.42,cz);
bloom.scale.set(.96,1.15,1);
lamp.add(bloom);

const glowLight = new THREE.PointLight(0xffb462, 5.5, 4.2, 2);
glowLight.position.set(cx,2.42,cz);
lamp.add(glowLight);
scene.add(new THREE.HemisphereLight(0xe2ded1,0x615042,1.65));
const key = new THREE.DirectionalLight(0xfff0dd,2.35);
key.position.set(-3,5,4);
scene.add(key);
const rim = new THREE.DirectionalLight(0xe2e5df,2.1);
rim.position.set(2,3,-4);
scene.add(rim);

let angle = -.26, drag = null, paused = reduced.matches, visible = true, lastTime;
function draw() {
  lamp.rotation.y = angle;
  renderer.render(scene,camera);
}
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.position.set(0,2.18,Math.max(7.15, 4.65 / camera.aspect));
  camera.lookAt(0,1.76,0);
  camera.updateProjectionMatrix();
  renderer.setSize(w,h,false);
  draw();
}
function updateButton() {
  button.textContent = paused ? 'Вращать модель' : 'Остановить вращение';
}
button.addEventListener('click', () => {
  paused = !paused;
  updateButton();
});
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  drag = {id:event.pointerId, x:event.clientX, angle};
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (drag?.id !== event.pointerId) return;
  angle = drag.angle + (event.clientX - drag.x) * .013;
  draw();
});
canvas.addEventListener('lostpointercapture', () => { drag = null; });
reduced.addEventListener('change', event => {
  paused = event.matches;
  updateButton();
});
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(viewer);
new ResizeObserver(resize).observe(viewer);

function frame(time) {
  if (visible && !paused && !drag && viewer.closest('.intro').style.visibility !== 'hidden') {
    angle += Math.min((time - (lastTime ?? time)) / 1000, .05) * .43;
    draw();
  }
  lastTime = time;
  requestAnimationFrame(frame);
}
resize();
viewer.classList.add('ready');
updateButton();
requestAnimationFrame(frame);
