import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const WORLD_W = 300;
const WORLD_D = 270;
const UP = new THREE.Vector3(0, 1, 0);

function seededRandom(seed = 1975) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = seededRandom();
const rand = (min, max) => min + random() * (max - min);

const materials = {};
function material(name, color, extra = {}) {
  if (!materials[name]) {
    materials[name] = new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...extra });
  }
  return materials[name];
}

const MAT = {
  loess: material('loess', 0xa78858),
  loessLight: material('loessLight', 0xb59b6c),
  loessDark: material('loessDark', 0x80623e),
  plaster: material('plaster', 0xbca77f),
  plasterOld: material('plasterOld', 0x9f875e),
  stone: material('stone', 0x827b67),
  stoneLight: material('stoneLight', 0x9c937a),
  stoneDark: material('stoneDark', 0x615e50),
  wood: material('wood', 0x554431),
  oldWood: material('oldWood', 0x3f382c),
  woodLight: material('woodLight', 0x796044),
  cave: material('cave', 0x211f19),
  courtyard: material('courtyard', 0xa98c5c),
  straw: material('straw', 0xa68a45),
  strawLight: material('strawLight', 0xc0a457),
  leaf: material('leaf', 0x566247),
  leafLight: material('leafLight', 0x6c7450),
  cypress: material('cypress', 0x344b3d),
  bark: material('bark', 0x554735),
  clay: material('clay', 0x72533a),
  blackPot: material('blackPot', 0x35352e),
  fadedBlue: material('fadedBlue', 0x485d63),
  fadedRed: material('fadedRed', 0x824d3c),
  linen: material('linen', 0xbeb69d),
  skin: material('skin', 0xb4956e),
  white: material('white', 0xd2c9ad),
  black: material('black', 0x292d29),
};

function mesh(geometry, mat, parent, x = 0, y = 0, z = 0, shadows = true) {
  const object = new THREE.Mesh(geometry, mat);
  object.position.set(x, y, z);
  object.castShadow = shadows;
  object.receiveShadow = shadows;
  if (parent) parent.add(object);
  return object;
}

function box(parent, w, h, d, mat, x = 0, y = 0, z = 0) {
  return mesh(new THREE.BoxGeometry(w, h, d), mat, parent, x, y, z);
}

function cylinder(parent, rt, rb, h, mat, x = 0, y = 0, z = 0, segments = 10) {
  return mesh(new THREE.CylinderGeometry(rt, rb, h, segments), mat, parent, x, y, z);
}

function sphere(parent, r, mat, x = 0, y = 0, z = 0, detail = 0) {
  return mesh(new THREE.IcosahedronGeometry(r, detail), mat, parent, x, y, z);
}

function beamBetween(parent, a, b, radius, mat, segments = 7) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const direction = end.clone().sub(start);
  const object = cylinder(parent, radius, radius, direction.length(), mat, 0, 0, 0, segments);
  object.position.copy(start).add(end).multiplyScalar(0.5);
  object.quaternion.setFromUnitVectors(UP, direction.normalize());
  return object;
}

function gaussian(x, z, cx, cz, sx, sz, height) {
  const dx = (x - cx) / sx;
  const dz = (z - cz) / sz;
  return Math.exp(-(dx * dx + dz * dz)) * height;
}

function eastRiverX(z) {
  return -5 + Math.sin(z * 0.033) * 5 + Math.sin(z * 0.075) * 1.2;
}

const kuYanPoints = [
  new THREE.Vector3(78, 5, -111),
  new THREE.Vector3(62, 3.8, -79),
  new THREE.Vector3(43, 2, -48),
  new THREE.Vector3(28, 0.2, -20),
  new THREE.Vector3(10, -2.3, 1),
  new THREE.Vector3(eastRiverX(8), -3, 8),
];
const kuYanCurve = new THREE.CatmullRomCurve3(kuYanPoints);

function closestKuYan(x, z) {
  let best = { distance: Infinity, y: -3 };
  for (let i = 0; i <= 40; i++) {
    const p = kuYanCurve.getPoint(i / 40);
    const distance = Math.hypot(x - p.x, z - p.z);
    if (distance < best.distance) best = { distance, y: p.y };
  }
  return best;
}

function heightAt(x, z) {
  let h = -0.8;
  h += gaussian(x, z, -114, -40, 40, 85, 32);
  h += gaussian(x, z, -92, 105, 52, 40, 26);
  h += gaussian(x, z, 112, 55, 42, 72, 31);
  h += gaussian(x, z, 88, -82, 38, 44, 38);
  h += gaussian(x, z, 15, -91, 35, 34, 16);
  h += gaussian(x, z, -22, -132, 70, 24, 24);
  h += Math.sin(x * 0.105 + z * 0.036) * 1.15 + Math.cos(z * 0.13 - x * 0.025) * 0.8;
  h += Math.sin(x * 0.38 + z * 0.21) * 0.24;

  const eastDistance = Math.abs(x - eastRiverX(z));
  if (eastDistance < 11) {
    const cut = -4.4 + Math.pow(eastDistance / 11, 1.8) * 5;
    h = Math.min(h, cut);
  }
  const ku = closestKuYan(x, z);
  if (ku.distance < 8 && z < 12) {
    const cut = ku.y - 1.15 + Math.pow(ku.distance / 8, 1.7) * 4;
    h = Math.min(h, cut);
  }

  const delta = Math.hypot((x - 6) * 0.85, (z + 14) * 0.7);
  if (delta < 22 && z < 14) h = Math.min(h, -0.2 + delta * 0.022);
  return h;
}

function createTerrain(scene) {
  const geometry = new THREE.PlaneGeometry(WORLD_W, WORLD_D, 190, 172);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = [];
  const low = new THREE.Color(0x9e865d);
  const high = new THREE.Color(0xb59c70);
  const green = new THREE.Color(0x838063);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const y = heightAt(x, z);
    positions.setY(i, y);
    const color = low.clone().lerp(high, THREE.MathUtils.clamp((y + 5) / 43, 0, 1));
    const patch = Math.sin(x * 0.16) * Math.cos(z * 0.12) + Math.sin(x * 0.45 + z * 0.3) * 0.3;
    if (patch > 0.6 && y > 1) color.lerp(green, 0.25);
    color.offsetHSL(0, 0, rand(-0.028, 0.028));
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: false });
  const terrain = mesh(geometry, terrainMat, scene);
  terrain.receiveShadow = true;
  terrain.castShadow = false;
  return terrain;
}

function ribbonGeometry(curve, width, segments = 100, yOffset = 0.08, followTerrain = false) {
  const vertices = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPoint(t);
    const tangent = curve.getTangent(t);
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const localWidth = typeof width === 'function' ? width(t) : width;
    for (const sign of [-1, 1]) {
      const x = p.x + side.x * localWidth * 0.5 * sign;
      const z = p.z + side.z * localWidth * 0.5 * sign;
      const y = followTerrain ? heightAt(x, z) + yOffset : p.y + yOffset;
      vertices.push(x, y, z);
      uvs.push(sign === -1 ? 0 : 1, t * 10);
    }
    if (i < segments) {
      const n = i * 2;
      indices.push(n, n + 2, n + 1, n + 2, n + 3, n + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeCurve(points) {
  return new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
}

function createPath(scene, points, width = 2.5, color = 0xb49a6d) {
  const curve = makeCurve(points.map(([x, z]) => [x, 0, z]));
  const pathMat = material(`path-${color}`, color, { polygonOffset: true, polygonOffsetFactor: -2 });
  const path = mesh(ribbonGeometry(curve, width, 70, 0.12, true), pathMat, scene);
  path.castShadow = false;
  return path;
}

function createWater(scene) {
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x6f918a, roughness: 0.3, metalness: 0.08, transparent: true, opacity: 0.86,
    clearcoat: 0.35, clearcoatRoughness: 0.4, side: THREE.DoubleSide,
  });
  const eastPoints = [];
  for (let i = 0; i <= 30; i++) {
    const z = -137 + (274 * i) / 30;
    eastPoints.push(new THREE.Vector3(eastRiverX(z), -3.05 - (z + 137) * 0.001, z));
  }
  const eastCurve = new THREE.CatmullRomCurve3(eastPoints);
  mesh(ribbonGeometry(eastCurve, (t) => 7.4 + Math.sin(t * 12) * 1.4, 150, 0.12), waterMat, scene);
  mesh(ribbonGeometry(kuYanCurve, (t) => 3.5 + (1 - t) * 1.4, 100, 0.12), waterMat, scene);

  const rippleMat = new THREE.LineBasicMaterial({ color: 0xc2d0bc, transparent: true, opacity: 0.42 });
  const ripples = new THREE.Group();
  for (let i = 0; i < 75; i++) {
    const useEast = random() > 0.4;
    const curve = useEast ? eastCurve : kuYanCurve;
    const p = curve.getPoint(random());
    const length = rand(0.35, 1.5);
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(p.x - length, p.y + 0.2, p.z),
      new THREE.Vector3(p.x + length, p.y + 0.2, p.z + rand(-0.15, 0.15)),
    ]);
    ripples.add(new THREE.Line(geometry, rippleMat));
  }
  scene.add(ripples);
  return ripples;
}

function createRiverBanks(scene) {
  const count = 340;
  const geometry = new THREE.DodecahedronGeometry(0.65, 0);
  const stones = new THREE.InstancedMesh(geometry, MAT.stoneLight, count);
  stones.castShadow = true;
  stones.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const z = rand(-133, 133);
    const side = random() > 0.5 ? 1 : -1;
    const x = eastRiverX(z) + side * rand(4.2, 6.4);
    dummy.position.set(x, heightAt(x, z) + 0.1, z);
    dummy.rotation.set(rand(0, 2), rand(0, 3), rand(0, 2));
    dummy.scale.set(rand(0.4, 1.4), rand(0.3, 0.7), rand(0.5, 1.5));
    dummy.updateMatrix();
    stones.setMatrixAt(i, dummy.matrix);
  }
  scene.add(stones);

  for (let i = 0; i < 7; i++) {
    const z = 27 + (i % 2) * 0.45;
    const x = -11 + i * 2.1;
    const stone = sphere(scene, 1, MAT.stoneLight, x, -2.55, z, 0);
    stone.scale.set(1.05, 0.36, 0.8);
    stone.rotation.y = rand(-0.4, 0.4);
  }
}

function createTerracedMountain(scene) {
  const group = new THREE.Group();
  group.position.set(15, 0, -91);
  const baseY = heightAt(15, -72) - 1;
  const layers = 8;
  for (let i = 0; i < layers; i++) {
    const radius = 34 - i * 3.55;
    const y = baseY + i * 3.15;
    const points = [];
    const segments = 72;
    for (let j = 0; j <= segments; j++) {
      const angle = (j / segments) * Math.PI * 2;
      const r = radius + Math.sin(angle * 5 + i * 0.4) * 1.2 + Math.cos(angle * 9) * 0.45;
      points.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r * 0.82));
    }
    const vertices = [];
    const indices = [];
    for (let j = 0; j <= segments; j++) {
      const p = points[j];
      vertices.push(p.x, p.y, p.z, p.x * 0.96, p.y - 3.05, p.z * 0.96);
      if (j < segments) {
        const n = j * 2;
        indices.push(n, n + 1, n + 2, n + 2, n + 1, n + 3);
      }
    }
    const wallGeo = new THREE.BufferGeometry();
    wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    wallGeo.setIndex(indices);
    wallGeo.computeVertexNormals();
    mesh(wallGeo, i % 2 ? MAT.loess : MAT.loessLight, group);

    const shape = new THREE.Shape();
    points.slice(0, -1).forEach((p, index) => {
      if (index === 0) shape.moveTo(p.x, p.z);
      else shape.lineTo(p.x, p.z);
    });
    shape.closePath();
    const topGeo = new THREE.ShapeGeometry(shape, 72);
    topGeo.rotateX(Math.PI / 2);
    const topMat = material(`terrace-${i}`, i % 3 === 0 ? 0x8b895d : 0x999064, { side: THREE.DoubleSide });
    mesh(topGeo, topMat, group, 0, y + 0.04, 0);

    if (i < 6) {
      for (let j = 0; j < 22; j++) {
        const angle = rand(0, Math.PI * 2);
        const r = radius - rand(0.8, 2.2);
        const crop = box(group, 0.12, rand(0.35, 0.7), 1.1, MAT.straw, Math.cos(angle) * r, y + 0.3, Math.sin(angle) * r * 0.82);
        crop.rotation.y = -angle;
      }
    }
  }
  scene.add(group);
  return group;
}

function createTree(parent, x, z, type = 'jujube', scale = 1) {
  const group = new THREE.Group();
  const ground = heightAt(x, z);
  group.position.set(x, ground, z);
  group.scale.setScalar(scale);
  if (type === 'cypress') {
    cylinder(group, 0.17, 0.28, 4.5, MAT.bark, 0, 2.25, 0, 7);
    for (let i = 0; i < 4; i++) {
      const crown = cylinder(group, 0.1, 1.65 - i * 0.25, 3.3, MAT.cypress, 0, 3.1 + i * 1.1, 0, 8);
      crown.rotation.y = i * 0.5;
    }
  } else if (type === 'willow') {
    cylinder(group, 0.23, 0.38, 4.2, MAT.bark, 0, 2.1, 0, 7);
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2;
      const ex = Math.cos(angle) * rand(1.2, 2.2);
      const ez = Math.sin(angle) * rand(1.2, 2.2);
      beamBetween(group, [0, 3.4, 0], [ex, rand(4.2, 5.2), ez], 0.09, MAT.bark);
      const leaves = sphere(group, rand(0.8, 1.2), i % 2 ? MAT.leaf : MAT.leafLight, ex, 3.6, ez, 1);
      leaves.scale.set(0.8, 1.8, 0.8);
    }
  } else {
    cylinder(group, 0.18, 0.33, 3.1, MAT.bark, 0, 1.55, 0, 7);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + rand(-0.2, 0.2);
      const ex = Math.cos(angle) * rand(1, 1.9);
      const ez = Math.sin(angle) * rand(1, 1.9);
      const ey = rand(3.1, 4.4);
      beamBetween(group, [0, 2, 0], [ex, ey, ez], 0.1, MAT.bark);
      const crown = sphere(group, rand(1.1, 1.6), i % 2 ? MAT.leaf : MAT.leafLight, ex, ey, ez, 1);
      crown.scale.y = 0.75;
    }
  }
  parent.add(group);
  return group;
}

function archShape(width, height) {
  const shape = new THREE.Shape();
  const r = width / 2;
  shape.moveTo(-r, 0);
  shape.lineTo(r, 0);
  shape.lineTo(r, height - r);
  shape.absarc(0, height - r, r, 0, Math.PI, false);
  shape.lineTo(-r, 0);
  return shape;
}

function createArchedPanel(parent, x, y, z, width, height, mat) {
  const geo = new THREE.ShapeGeometry(archShape(width, height), 18);
  return mesh(geo, mat, parent, x, y, z);
}

function createLatticeWindow(parent, x, y, z, radius, ornate = false) {
  const dark = createArchedPanel(parent, x, y - radius, z, radius * 2, radius * 2, MAT.cave);
  dark.scale.y = 0.62;
  const ring = mesh(new THREE.TorusGeometry(radius, 0.1, 5, 24, Math.PI), MAT.oldWood, parent, x, y, z + 0.035);
  for (let i = -2; i <= 2; i++) {
    const xx = x + (i * radius) / 2.5;
    const hh = Math.sqrt(Math.max(0, radius * radius - (xx - x) ** 2));
    box(parent, 0.07, hh, 0.07, MAT.oldWood, xx, y + hh / 2, z + 0.06);
  }
  box(parent, radius * 2, 0.08, 0.08, MAT.oldWood, x, y, z + 0.06);
  if (ornate) {
    const diamond = box(parent, radius * 0.8, radius * 0.8, 0.06, MAT.woodLight, x, y + radius * 0.38, z + 0.08);
    diamond.rotation.z = Math.PI / 4;
    diamond.scale.set(1, 1, 1);
  }
}

function createCave(parent, options = {}) {
  const {
    x = 0, z = 0, rotation = 0, count = 1, stoneFaced = false,
    ornate = false, width = 6.4, height = 5.8, depth = 6.5, id,
  } = options;
  const group = new THREE.Group();
  const totalWidth = count * width;
  const ground = heightAt(x, z);
  group.position.set(x, ground, z);
  group.rotation.y = rotation;
  const wallMat = stoneFaced ? MAT.stoneLight : ornate ? MAT.plaster : MAT.plasterOld;

  box(group, totalWidth + 0.6, height + 0.7, depth, MAT.loess, 0, (height + 0.7) / 2 - 0.2, -depth / 2 + 0.45);
  const moundGeometry = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const moundPositions = moundGeometry.attributes.position;
  for (let i = 0; i < moundPositions.count; i++) {
    const mx = moundPositions.getX(i);
    const my = moundPositions.getY(i);
    const mz = moundPositions.getZ(i);
    moundPositions.setY(i, my + Math.sin(mx * 11 + mz * 8) * 0.035 * my);
  }
  moundGeometry.computeVertexNormals();
  const mound = mesh(moundGeometry, MAT.loess, group, 0, -0.15, -depth * 0.84);
  mound.scale.set(totalWidth * 0.62, height * 1.18, depth * 0.86);
  box(group, totalWidth + 0.35, height, 0.65, wallMat, 0, height / 2, 0);
  box(group, totalWidth + 1.1, 0.42, 1.1, stoneFaced ? MAT.stoneDark : MAT.loessDark, 0, height + 0.13, 0.08);

  for (let c = 0; c < count; c++) {
    const cx = (c - (count - 1) / 2) * width;
    const doorWidth = 2.35;
    const doorHeight = 4.25;
    createArchedPanel(group, cx, 0.05, 0.345, doorWidth + 0.35, doorHeight + 0.25, MAT.stoneDark);
    createArchedPanel(group, cx, 0.08, 0.37, doorWidth, doorHeight, MAT.cave);
    box(group, doorWidth * 0.92, 2.45, 0.12, ornate ? MAT.oldWood : MAT.wood, cx, 1.3, 0.41);
    for (let p = -2; p <= 2; p++) box(group, 0.055, 2.4, 0.04, MAT.oldWood, cx + p * 0.43, 1.3, 0.49);
    box(group, doorWidth, 0.1, 0.08, MAT.oldWood, cx, 2.47, 0.5);
    createLatticeWindow(group, cx, 2.75, 0.43, 1.02, ornate);
    box(group, 0.07, 0.32, 0.08, MAT.stoneLight, cx + 0.73, 1.38, 0.51);

    const archCenterY = doorHeight - doorWidth / 2;
    for (let s = 0; s < 9; s++) {
      const angle = (s / 8) * Math.PI;
      const sx = cx + Math.cos(angle) * (doorWidth / 2 + 0.27);
      const sy = archCenterY + Math.sin(angle) * (doorWidth / 2 + 0.27);
      const block = box(group, 0.48, 0.5, 0.24, s % 2 ? MAT.stone : MAT.stoneLight, sx, sy, 0.48);
      block.rotation.z = angle - Math.PI / 2;
    }
    for (const side of [-1, 1]) {
      for (let b = 0; b < 5; b++) box(group, 0.47, 0.52, 0.25, b % 2 ? MAT.stoneLight : MAT.stone, cx + side * (doorWidth / 2 + 0.27), 0.32 + b * 0.55, 0.48);
    }

    if (count > 1 || stoneFaced) {
      const wx = cx + width * 0.35;
      box(group, 1.1, 1.25, 0.12, MAT.cave, wx, 2.5, 0.38);
      box(group, 0.08, 1.25, 0.08, MAT.oldWood, wx, 2.5, 0.48);
      box(group, 1.1, 0.08, 0.08, MAT.oldWood, wx, 2.5, 0.48);
    }
  }

  if (stoneFaced) {
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < count * 6; col++) {
        if (random() > 0.52) continue;
        const bx = -totalWidth / 2 + 0.5 + col * (totalWidth / (count * 6));
        box(group, 0.65, 0.06, 0.06, MAT.stoneDark, bx, 0.55 + row * 0.7, 0.37);
      }
    }
  }
  if (id) group.userData.landmarkId = id;
  parent.add(group);
  return group;
}

function createWall(parent, x, y, z, w, h, d, broken = false) {
  const wall = box(parent, w, h, d, broken ? MAT.plasterOld : MAT.loessLight, x, y + h / 2, z);
  if (broken) {
    wall.rotation.z = rand(-0.015, 0.015);
    box(parent, w * 0.95, 0.13, d + 0.08, MAT.loessDark, x, y + h, z);
  }
  return wall;
}

function createPot(parent, x, y, z, scale = 1) {
  const pot = cylinder(parent, 0.38 * scale, 0.48 * scale, 0.85 * scale, MAT.clay, x, y + 0.43 * scale, z, 12);
  cylinder(parent, 0.32 * scale, 0.32 * scale, 0.08 * scale, MAT.cave, x, y + 0.88 * scale, z, 12);
  return pot;
}

function createHaystack(parent, x, y, z, scale = 1) {
  const hay = cylinder(parent, 0.35 * scale, 1.35 * scale, 2.2 * scale, MAT.straw, x, y + 1.1 * scale, z, 12);
  for (let i = 0; i < 7; i++) {
    const band = mesh(new THREE.TorusGeometry((0.48 + i * 0.11) * scale, 0.025, 3, 16), MAT.strawLight, parent, x, y + (1.75 - i * 0.2) * scale, z);
    band.rotation.x = Math.PI / 2;
  }
  return hay;
}

function createCart(parent, x, y, z, rotation = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotation;
  box(group, 2.4, 0.16, 1.45, MAT.oldWood, 0, 0.85, 0);
  for (const side of [-1, 1]) {
    box(group, 2.4, 0.65, 0.1, MAT.wood, 0, 1.15, side * 0.72);
    beamBetween(group, [0.8, 0.75, side * 0.5], [3.3, 0.65, side * 0.5], 0.075, MAT.oldWood);
    const wheel = mesh(new THREE.TorusGeometry(0.65, 0.09, 6, 16), MAT.oldWood, group, -0.2, 0.65, side * 0.84);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI;
      beamBetween(group, [-0.2 - Math.cos(a) * 0.62, 0.65 - Math.sin(a) * 0.62, side * 0.84], [-0.2 + Math.cos(a) * 0.62, 0.65 + Math.sin(a) * 0.62, side * 0.84], 0.025, MAT.oldWood, 5);
    }
  }
  parent.add(group);
  return group;
}

function createChicken(parent, x, y, z, color = MAT.linen) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rand(0, Math.PI * 2);
  const body = sphere(group, 0.25, color, 0, 0.35, 0);
  body.scale.set(1, 0.85, 1.35);
  sphere(group, 0.14, color, 0, 0.58, 0.22);
  const beak = cylinder(group, 0, 0.07, 0.18, MAT.strawLight, 0, 0.56, 0.39, 5);
  beak.rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) beamBetween(group, [side * 0.09, 0.27, 0], [side * 0.09, 0.02, 0.03], 0.018, MAT.strawDark || MAT.wood, 4);
  parent.add(group);
}

function createDonkey(parent, x, y, z, rotation = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotation;
  const fur = material('donkey', 0x69675b);
  const body = sphere(group, 0.72, fur, 0, 1.25, 0, 1);
  body.scale.set(0.75, 0.8, 1.45);
  const head = sphere(group, 0.4, fur, 0, 1.85, 0.93, 0);
  head.scale.set(0.7, 1.15, 0.8);
  for (const sx of [-0.33, 0.33]) {
    for (const sz of [-0.52, 0.52]) beamBetween(group, [sx, 1.05, sz], [sx * 0.9, 0.08, sz + 0.06], 0.085, fur);
  }
  for (const sx of [-0.16, 0.16]) {
    const ear = cylinder(group, 0.04, 0.11, 0.52, fur, sx, 2.38, 0.9, 5);
    ear.rotation.z = sx * 1.1;
  }
  beamBetween(group, [0, 1.35, -0.9], [0.12, 0.75, -1.35], 0.045, MAT.oldWood);
  parent.add(group);
  return group;
}

function createVillager(parent, x, z, options = {}) {
  const group = new THREE.Group();
  group.position.set(x, heightAt(x, z) + 0.15, z);
  group.rotation.y = options.rotation || 0;
  const cloth = options.color || MAT.fadedBlue;
  const body = cylinder(group, 0.29, 0.42, 1.05, cloth, 0, 1.5, 0, 7);
  body.rotation.z = options.working ? -0.17 : 0;
  sphere(group, 0.26, MAT.skin, 0, 2.22, 0, 1);
  if (options.scarf) {
    const scarf = sphere(group, 0.285, MAT.linen, 0, 2.3, -0.025, 1);
    scarf.scale.set(1, 0.7, 1);
  } else {
    cylinder(group, 0.29, 0.3, 0.12, MAT.fadedBlue, 0, 2.44, 0, 10);
    box(group, 0.35, 0.035, 0.25, MAT.fadedBlue, 0, 2.41, 0.22);
  }
  for (const side of [-1, 1]) {
    beamBetween(group, [side * 0.18, 1.04, 0], [side * 0.21, 0.12, side * 0.08], 0.11, MAT.black);
    const armEnd = options.carrying ? [side * 0.48, 0.95, 0.05] : [side * 0.42, 1.0, 0.12];
    beamBetween(group, [side * 0.26, 1.86, 0], armEnd, 0.105, cloth);
  }
  if (options.carrying) {
    beamBetween(group, [-1.25, 1.05, 0], [1.25, 1.05, 0], 0.045, MAT.woodLight);
    for (const side of [-1, 1]) {
      beamBetween(group, [side * 1.05, 1.05, 0], [side * 1.05, 0.35, 0], 0.025, MAT.oldWood);
      cylinder(group, 0.28, 0.2, 0.45, MAT.straw, side * 1.05, 0.28, 0, 10);
    }
  }
  parent.add(group);
  return group;
}

function createCourtyard(scene, options) {
  const { x, z, width = 14, depth = 11, broken = false, id } = options;
  const y = heightAt(x, z);
  const group = new THREE.Group();
  group.position.set(x, y + 0.04, z);
  const ground = cylinder(group, 1, 1, 0.12, MAT.courtyard, 0, 0, depth * 0.32, 32);
  ground.scale.set(width * 0.57, 1, depth * 0.68);
  createWall(group, -width / 2, 0, depth * 0.32, 0.48, broken ? 1.1 : 1.5, depth, broken);
  createWall(group, width / 2, 0, depth * 0.32, 0.48, broken ? 1.3 : 1.6, depth, broken);
  createWall(group, -width * 0.34, 0, depth * 0.83, width * 0.32, broken ? 0.85 : 1.4, 0.5, broken);
  createWall(group, width * 0.34, 0, depth * 0.83, width * 0.32, broken ? 1.1 : 1.4, 0.5, broken);
  for (const gx of [-1.5, 1.5]) box(group, 0.25, 2.3, 0.25, MAT.oldWood, gx, 1.15, depth * 0.83);
  if (!broken) {
    box(group, 3.7, 0.24, 0.65, MAT.oldWood, 0, 2.38, depth * 0.83);
    const gate = box(group, 2.6, 1.65, 0.16, MAT.wood, -0.55, 0.83, depth * 0.83);
    gate.rotation.y = -0.38;
  }
  createPot(group, width * 0.32, 0, depth * 0.2, 1.15);
  createPot(group, width * 0.26, 0, depth * 0.1, 0.75);
  createHaystack(group, -width * 0.36, 0, depth * 0.12, 0.85);
  for (let i = 0; i < 10; i++) {
    const log = cylinder(group, 0.09, 0.11, 1.6, MAT.woodLight, -width * 0.36 + (i % 4) * 0.22, 0.3 + Math.floor(i / 4) * 0.18, depth * 0.47, 6);
    log.rotation.x = Math.PI / 2;
  }
  for (let i = 0; i < 3; i++) createChicken(group, rand(-2, 2), 0.1, rand(2, depth * 0.65), i === 0 ? MAT.fadedRed : MAT.linen);
  if (id) group.userData.landmarkId = id;
  scene.add(group);
  return group;
}

function addCorn(parent, x, y, z) {
  for (let i = 0; i < 7; i++) {
    const corn = cylinder(parent, 0.08, 0.1, 0.52, MAT.strawLight, x + (i % 3) * 0.18, y - Math.floor(i / 3) * 0.45, z, 6);
    corn.rotation.z = rand(-0.18, 0.18);
  }
}

function createHomes(scene) {
  const sun = createCave(scene, { x: -49, z: 88, count: 1, width: 7, height: 5.4, id: 'sun' });
  createCave(scene, { x: -41.9, z: 88, count: 1, width: 3.8, height: 3.6, depth: 3.4, id: 'sun' });
  const sunCourt = createCourtyard(scene, { x: -49, z: 91, width: 16, depth: 12, broken: true, id: 'sun' });
  createCart(sunCourt, 2, 0.1, 4.8, -0.3);
  addCorn(sun, 2.5, 3.1, 0.63);
  createDonkey(scene, -40, heightAt(-40, 99), 99, -0.5);

  const tianHomes = [
    [-58, 48, 1, 0.03], [-47, 48, 2, -0.03], [-66, 34, 1, 0.08],
    [-52, 31, 2, 0.02], [-39, 32, 1, -0.06], [-64, 17, 2, 0.12], [-45, 15, 1, 0],
  ];
  tianHomes.forEach(([x, z, count, rotation], index) => {
    const cave = createCave(scene, { x, z, rotation, count, width: 5.8, height: rand(4.8, 5.8), stoneFaced: index === 5, id: 'tian' });
    createCourtyard(scene, { x, z: z + 3, width: count * 6 + 3, depth: 8, broken: index !== 5, id: 'tian' });
    if (index % 2 === 0) addCorn(cave, count * 2.4, 3.5, 0.62);
  });

  const tian = createCave(scene, { x: -43, z: 58, count: 3, width: 5.8, height: 6.1, stoneFaced: true, ornate: true, id: 'tianfu' });
  const tianCourt = createCourtyard(scene, { x: -43, z: 62, width: 21, depth: 12, broken: false, id: 'tianfu' });
  createCart(tianCourt, 5.2, 0.1, 3.5, 0.1);
  const bike = new THREE.Group();
  bike.position.set(-47, heightAt(-47, 68) + 0.75, 68);
  for (const bx of [-0.75, 0.75]) {
    const wheel = mesh(new THREE.TorusGeometry(0.55, 0.035, 5, 20), MAT.black, bike, bx, 0, 0);
    wheel.rotation.y = Math.PI / 2;
  }
  beamBetween(bike, [-0.75, 0, 0], [0, 0.65, 0], 0.035, MAT.black);
  beamBetween(bike, [0, 0.65, 0], [0.75, 0, 0], 0.035, MAT.black);
  beamBetween(bike, [-0.75, 0, 0], [0.3, 0, 0], 0.035, MAT.black);
  beamBetween(bike, [0.3, 0, 0], [0, 0.65, 0], 0.035, MAT.black);
  scene.add(bike);

  const jinHomes = [
    [52, 42, 2, -0.08], [65, 40, 3, -0.12], [78, 34, 2, -0.18],
    [51, 27, 2, -0.04], [66, 23, 2, -0.12], [82, 18, 3, -0.2],
    [61, 8, 2, -0.1], [76, 3, 2, -0.2], [91, 5, 1, -0.2],
  ];
  jinHomes.forEach(([x, z, count, rotation], index) => {
    const cave = createCave(scene, { x, z, rotation, count, width: 5.7, height: rand(5.1, 6.2), stoneFaced: index % 3 !== 0, ornate: index % 2 === 0, id: 'jin' });
    const court = createCourtyard(scene, { x, z: z + 3, width: count * 6 + 2, depth: 9, broken: index % 3 === 0, id: 'jin' });
    if (index === 2) createCart(court, 1, 0.1, 3.8, 0.2);
    if (index % 2 === 0) addCorn(cave, 2.5, 3.4, 0.64);
  });

  createVillager(scene, -42, 78, { scarf: true, carrying: true, color: MAT.linen, rotation: -0.3 });
  createVillager(scene, -28, 42, { color: MAT.fadedBlue, rotation: Math.PI });
  createVillager(scene, 10, -4, { scarf: true, color: MAT.fadedRed, rotation: 0.4 });
  createVillager(scene, 55, 48, { color: MAT.fadedBlue, carrying: true, rotation: -0.6 });
  createVillager(scene, 68, 32, { scarf: true, color: MAT.linen });
}

function createBridge(scene) {
  const group = new THREE.Group();
  group.position.set(27, 1.5, -17);
  group.rotation.y = -0.56;
  box(group, 11, 0.65, 3.4, MAT.stone, 0, 0, 0);
  for (const x of [-4.2, 0, 4.2]) {
    box(group, 1.25, 2.6, 3.1, MAT.stoneDark, x, -1.45, 0);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) box(group, 1.25, 0.7 + (i % 2) * 0.12, 0.55, i % 2 ? MAT.stoneLight : MAT.stone, -4.8 + i * 1.37, 0.63, side * 1.55);
  }
  for (let i = 0; i < 15; i++) box(group, 0.06, 0.02, 3.1, MAT.stoneDark, -5 + i * 0.72, 0.34, 0);
  scene.add(group);
  return group;
}

function makeTextTexture(text, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = options.width || 512;
  canvas.height = options.height || 128;
  const context = canvas.getContext('2d');
  context.fillStyle = options.background || '#d4c7a5';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = options.color || '#473e2f';
  context.font = `${options.weight || '600'} ${options.fontSize || 62}px "Songti SC", "SimSun", serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSchool(scene) {
  const school = createCave(scene, { x: 46, z: -1, count: 7, width: 4.8, height: 5.8, depth: 7, stoneFaced: true, id: 'school' });
  const signMat = new THREE.MeshStandardMaterial({ map: makeTextTexture('双水村小学'), roughness: 1 });
  box(school, 7.8, 1.5, 0.18, signMat, 0, 6.8, 0.6);
  const y = heightAt(46, 7);
  const yard = box(scene, 41, 0.16, 19, MAT.courtyard, 46, y + 0.05, 9);
  yard.rotation.y = -0.02;
  for (const x of [31, 60]) {
    const gy = heightAt(x, 15);
    beamBetween(scene, [x, gy, 15], [x, gy + 4.3, 15], 0.1, MAT.oldWood);
    box(scene, 2.7, 1.6, 0.12, MAT.woodLight, x, gy + 4.1, 15);
    const hoop = mesh(new THREE.TorusGeometry(0.43, 0.035, 5, 18), MAT.fadedRed, scene, x, gy + 3.55, 14.45);
    hoop.rotation.x = Math.PI / 2;
  }
  createVillager(scene, 38, 12, { color: MAT.fadedBlue, rotation: 1.2 });
  createVillager(scene, 42, 14, { color: MAT.linen, scarf: true, rotation: -1 });
  createVillager(scene, 55, 10, { color: MAT.fadedBlue });
  return school;
}

function createTemple(scene) {
  const group = new THREE.Group();
  const x = 2;
  const z = -3;
  group.position.set(x, heightAt(x, z), z);
  box(group, 8.5, 0.8, 6.5, MAT.stoneDark, 0, 0.4, 0);
  box(group, 7.5, 3.7, 5.4, MAT.plasterOld, 0, 2.4, -0.2);
  createArchedPanel(group, 0, 0.85, 2.53, 2, 3, MAT.cave);
  for (const side of [-1, 1]) cylinder(group, 0.2, 0.24, 3.6, MAT.fadedRed, side * 2.8, 2.5, 2.65, 8);
  const roofMat = material('roof', 0x575c50);
  const leftRoof = box(group, 4.8, 0.25, 7, roofMat, -2, 4.65, 0);
  leftRoof.rotation.z = -0.34;
  const rightRoof = box(group, 4.8, 0.25, 7, roofMat, 2, 4.65, 0);
  rightRoof.rotation.z = 0.34;
  for (let i = 0; i < 14; i++) {
    const tile = cylinder(group, 0.09, 0.09, 6.8, MAT.stoneDark, -3.8 + i * 0.58, 4.92 - Math.abs(-3.8 + i * 0.58) * 0.12, 0, 6);
    tile.rotation.x = Math.PI / 2;
  }
  box(group, 2.6, 0.8, 0.25, MAT.oldWood, 0, 3.95, 2.75);
  scene.add(group);

  const stage = new THREE.Group();
  stage.position.set(10, heightAt(10, -1), -1);
  box(stage, 8, 1.1, 5, MAT.stone, 0, 0.55, 0);
  for (const sx of [-3.3, 3.3]) {
    box(stage, 0.45, 3.5, 0.45, MAT.oldWood, sx, 2.7, -1.8);
    box(stage, 0.45, sx > 0 ? 2.2 : 3.4, 0.45, MAT.oldWood, sx, sx > 0 ? 2 : 2.65, 1.8);
  }
  const beam = box(stage, 7.5, 0.35, 0.4, MAT.oldWood, 0, 4.45, -1.8);
  beam.rotation.z = 0.04;
  scene.add(stage);
}

function createFields(scene) {
  const plots = [
    { x: -92, z: 52, w: 28, d: 24, rot: 0.12 },
    { x: -87, z: 9, w: 25, d: 22, rot: -0.05 },
    { x: 102, z: 68, w: 24, d: 25, rot: -0.18 },
    { x: 106, z: -23, w: 26, d: 22, rot: 0.1 },
    { x: -71, z: -48, w: 23, d: 26, rot: 0.18 },
  ];
  plots.forEach((plot, index) => {
    const group = new THREE.Group();
    const cos = Math.cos(plot.rot);
    const sin = Math.sin(plot.rot);
    const worldPoint = (x, z) => [plot.x + x * cos + z * sin, plot.z - x * sin + z * cos];
    const groundGeometry = new THREE.PlaneGeometry(plot.w, plot.d, 24, 20);
    groundGeometry.rotateX(-Math.PI / 2);
    groundGeometry.rotateY(plot.rot);
    groundGeometry.translate(plot.x, 0, plot.z);
    const groundPositions = groundGeometry.attributes.position;
    for (let i = 0; i < groundPositions.count; i++) {
      groundPositions.setY(i, heightAt(groundPositions.getX(i), groundPositions.getZ(i)) + 0.1);
    }
    groundGeometry.computeVertexNormals();
    mesh(groundGeometry, index % 2 ? MAT.loessDark : MAT.loess, group);
    for (let row = 0; row < 11; row++) {
      const z = -plot.d / 2 + 1 + row * ((plot.d - 2) / 10);
      const furrowPoints = [];
      for (let p = 0; p <= 8; p++) {
        const x = -plot.w / 2 + 0.8 + p * ((plot.w - 1.6) / 8);
        const [wx, wz] = worldPoint(x, z);
        furrowPoints.push([wx, 0, wz]);
      }
      mesh(ribbonGeometry(makeCurve(furrowPoints), 0.34, 24, 0.2, true), MAT.loessLight, group);
      if (index !== 1) {
        for (let c = 0; c < 15; c++) {
          if (random() > 0.72) continue;
          const x = -plot.w / 2 + 1.5 + c * ((plot.w - 3) / 14);
          const [wx, wz] = worldPoint(x, z);
          const crop = cylinder(group, 0.03, 0.09, rand(0.35, 0.75), MAT.straw, wx, heightAt(wx, wz) + 0.48, wz, 5);
          crop.rotation.z = rand(-0.12, 0.12);
        }
      }
    }
    scene.add(group);
  });
}

function createRoadSign(scene) {
  const x = -26;
  const z = -104;
  const y = heightAt(x, z);
  box(scene, 0.18, 3.8, 0.18, MAT.oldWood, x, y + 1.9, z);
  const signMat = new THREE.MeshStandardMaterial({ map: makeTextTexture('石圪节  →', { width: 512, height: 150, fontSize: 66, background: '#a4936f', color: '#3e3b30' }), roughness: 1 });
  box(scene, 4.4, 1.3, 0.18, signMat, x + 0.6, y + 3.35, z);
}

function createSmokeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(222,215,195,0.52)');
  gradient.addColorStop(0.45, 'rgba(215,207,188,0.22)');
  gradient.addColorStop(1, 'rgba(205,198,182,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function createSmoke(scene, x, z, height, smokeTexture) {
  const group = new THREE.Group();
  group.position.set(x, height, z);
  for (let i = 0; i < 6; i++) {
    const mat = new THREE.SpriteMaterial({ map: smokeTexture, transparent: true, opacity: 0.45 - i * 0.045, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(i * 0.35, i * 1.5, 0);
    sprite.scale.setScalar(2.2 + i * 0.75);
    sprite.userData.baseY = sprite.position.y;
    sprite.userData.phase = i * 0.8;
    group.add(sprite);
  }
  scene.add(group);
  return group;
}

function createVegetation(scene) {
  for (let i = 0; i < 54; i++) {
    const x = rand(-5, 25);
    const z = rand(-39, -9);
    if (Math.abs(x - eastRiverX(z)) < 6 || closestKuYan(x, z).distance < 4) continue;
    createTree(scene, x, z, 'jujube', rand(0.65, 1.05));
  }
  for (let i = 0; i < 19; i++) createTree(scene, rand(66, 90), rand(-66, -45), 'cypress', rand(0.75, 1.25));
  for (const [x, z] of [[-12, 53], [-14, 72], [2, 50], [4, 91], [-14, -52], [11, 104], [38, -30], [54, -43]]) createTree(scene, x, z, 'willow', rand(0.85, 1.2));
  for (let i = 0; i < 28; i++) {
    const x = rand(-125, 125);
    const z = rand(-120, 120);
    if (Math.abs(x) < 90 && z > -70 && z < 110) continue;
    createTree(scene, x, z, random() > 0.65 ? 'jujube' : 'cypress', rand(0.45, 0.85));
  }

  const grassGeo = new THREE.ConeGeometry(0.16, 0.8, 3);
  const grass = new THREE.InstancedMesh(grassGeo, MAT.straw, 550);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 550; i++) {
    const x = rand(-140, 140);
    const z = rand(-130, 130);
    dummy.position.set(x, heightAt(x, z) + 0.35, z);
    dummy.rotation.y = rand(0, Math.PI * 2);
    dummy.scale.set(rand(0.7, 1.6), rand(0.5, 1.2), rand(0.7, 1.6));
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
  }
  grass.castShadow = true;
  scene.add(grass);
}

function createBirds(scene) {
  const birds = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: 0x4c5146, transparent: true, opacity: 0.65 });
  for (let i = 0; i < 7; i++) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.8, 0, 0), new THREE.Vector3(0, -0.25, 0), new THREE.Vector3(0.8, 0, 0),
    ]);
    const bird = new THREE.Line(geo, mat);
    bird.position.set(i * 3.2, Math.sin(i) * 2, rand(-4, 4));
    birds.add(bird);
  }
  birds.position.set(-25, 47, -65);
  scene.add(birds);
  return birds;
}

function createHitTargets(scene, landmarks) {
  const targets = [];
  landmarks.filter((item) => item.id !== 'overview').forEach((item) => {
    const [x, , z] = item.position;
    const radius = ['tian', 'jin', 'miao'].includes(item.id) ? 17 : 9;
    const hit = mesh(new THREE.CylinderGeometry(radius, radius, 12, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), scene, x, heightAt(x, z) + 6, z, false);
    hit.userData.landmarkId = item.id;
    targets.push(hit);
  });
  return targets;
}

export function createVillage(container, { landmarks, onSelect, onFrame, onReady }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbcb49e);
  scene.fog = new THREE.Fog(0xbcb49e, 145, 345);

  const camera = new THREE.PerspectiveCamera(39, container.clientWidth / container.clientHeight, 0.5, 700);
  camera.position.set(142, 108, 164);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 5, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.minDistance = 18;
  controls.maxDistance = 295;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minPolarAngle = Math.PI * 0.12;
  controls.panSpeed = 0.65;
  controls.rotateSpeed = 0.48;
  controls.zoomSpeed = 0.75;

  const hemi = new THREE.HemisphereLight(0xe6dfc8, 0x6c6045, 2.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2ad, 3.25);
  sun.position.set(-90, 130, 65);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -155;
  sun.shadow.camera.right = 155;
  sun.shadow.camera.top = 145;
  sun.shadow.camera.bottom = -145;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.7;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xabbcc0, 0.45);
  fill.position.set(90, 45, -80);
  scene.add(fill);

  createTerrain(scene);
  createTerracedMountain(scene);
  const ripples = createWater(scene);
  createRiverBanks(scene);

  createPath(scene, [[-28, 135], [-27, 105], [-29, 79], [-28, 53], [-25, 24], [-25, -8], [-27, -42], [-24, -80], [-24, -112], [-18, -137]], 4.4, 0xb9a274);
  createPath(scene, [[-49, 94], [-39, 87], [-29, 79]], 2.2);
  createPath(scene, [[-60, 51], [-46, 58], [-29, 54]], 2.4);
  createPath(scene, [[-63, 35], [-48, 41], [-27, 39]], 2.1);
  createPath(scene, [[-27, 28], [-13, 28], [2, 27], [7, 11], [10, -5], [17, -14], [26, -18]], 2.2);
  createPath(scene, [[28, -17], [39, -7], [46, 9], [56, 25], [68, 44], [85, 53]], 2.2);
  createPath(scene, [[47, 9], [49, 29], [54, 46]], 2.5);
  createPath(scene, [[68, 42], [72, 23], [79, 6]], 2);
  createPath(scene, [[37, -6], [48, -27], [62, -48], [71, -69]], 1.7);

  createFields(scene);
  createHomes(scene);
  createBridge(scene);
  createTemple(scene);
  createSchool(scene);
  createVegetation(scene);
  createRoadSign(scene);

  const smokeTexture = createSmokeTexture();
  const smokes = [
    createSmoke(scene, -50, 86, heightAt(-49, 88) + 6.4, smokeTexture),
    createSmoke(scene, -48, 46, heightAt(-47, 48) + 7, smokeTexture),
    createSmoke(scene, -42, 56, heightAt(-43, 58) + 7, smokeTexture),
    createSmoke(scene, 66, 21, heightAt(66, 23) + 7, smokeTexture),
    createSmoke(scene, 52, 40, heightAt(52, 42) + 7, smokeTexture),
  ];
  const birds = createBirds(scene);

  const dustGeo = new THREE.BufferGeometry();
  const dustPositions = [];
  for (let i = 0; i < 260; i++) dustPositions.push(rand(-140, 140), rand(2, 65), rand(-120, 120));
  dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xe8d7af, size: 0.32, transparent: true, opacity: 0.33, depthWrite: false }));
  scene.add(dust);

  const selectionRing = mesh(new THREE.RingGeometry(5.5, 5.72, 64), new THREE.MeshBasicMaterial({ color: 0xe4d4a7, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false }), scene);
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.visible = false;

  const hitTargets = createHitTargets(scene, landmarks);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDown = null;
  let cameraTween = null;
  let currentId = 'overview';
  let labelsVisible = true;
  let destroyed = false;

  function getPointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  renderer.domElement.addEventListener('pointerdown', (event) => { pointerDown = [event.clientX, event.clientY]; });
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (!pointerDown || Math.hypot(event.clientX - pointerDown[0], event.clientY - pointerDown[1]) > 5) return;
    getPointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(hitTargets);
    if (hits.length) onSelect(hits[0].object.userData.landmarkId, true);
  });
  renderer.domElement.addEventListener('pointermove', (event) => {
    getPointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(hitTargets);
    renderer.domElement.style.cursor = hits.length ? 'pointer' : 'grab';
  });

  controls.addEventListener('start', () => { cameraTween = null; });

  function focus(item, immediate = false) {
    currentId = item.id;
    const endPosition = new THREE.Vector3(...item.camera);
    const endTarget = new THREE.Vector3(...item.target);
    if (window.innerWidth < 700 && item.id === 'overview') endPosition.multiplyScalar(1.25);
    if (immediate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      camera.position.copy(endPosition);
      controls.target.copy(endTarget);
      controls.update();
      cameraTween = null;
    } else {
      cameraTween = {
        start: performance.now(), duration: item.id === 'overview' ? 1900 : 1600,
        fromPosition: camera.position.clone(), fromTarget: controls.target.clone(), endPosition, endTarget,
      };
    }
    if (item.id === 'overview') selectionRing.visible = false;
    else {
      const [x, , z] = item.position;
      selectionRing.position.set(x, heightAt(x, z) + 0.4, z);
      selectionRing.visible = true;
      selectionRing.scale.setScalar(['tian', 'jin', 'miao'].includes(item.id) ? 2.2 : 1.25);
    }
  }

  function setTime(value) {
    const t = value / 100;
    const angle = THREE.MathUtils.lerp(0.12, Math.PI - 0.12, t);
    const altitude = Math.sin(angle);
    sun.position.set(Math.cos(angle) * 145, 28 + altitude * 125, 58 - t * 95);
    const dusk = Math.pow(Math.abs(t - 0.5) * 2, 2.2);
    sun.color.copy(new THREE.Color(0xfff0ca).lerp(new THREE.Color(0xffb16c), dusk * 0.75));
    sun.intensity = 2.5 + altitude * 1.1;
    hemi.intensity = 1.55 + altitude * 0.6;
    const sky = new THREE.Color(0xc5c4b2).lerp(new THREE.Color(t > 0.5 ? 0xbfa68b : 0xb9b09b), dusk * 0.75);
    scene.background.copy(sky);
    scene.fog.color.copy(sky);
    renderer.toneMappingExposure = 0.95 + altitude * 0.18;
  }

  function zoom(factor) {
    const direction = camera.position.clone().sub(controls.target);
    const nextDistance = THREE.MathUtils.clamp(direction.length() * factor, controls.minDistance, controls.maxDistance);
    direction.setLength(nextDistance);
    cameraTween = { start: performance.now(), duration: 450, fromPosition: camera.position.clone(), fromTarget: controls.target.clone(), endPosition: controls.target.clone().add(direction), endTarget: controls.target.clone() };
  }

  const clock = new THREE.Clock();
  let frame = 0;
  function animate() {
    if (destroyed) return;
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    if (cameraTween) {
      const t = Math.min(1, (performance.now() - cameraTween.start) / cameraTween.duration);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      camera.position.lerpVectors(cameraTween.fromPosition, cameraTween.endPosition, eased);
      controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.endTarget, eased);
      if (t >= 1) cameraTween = null;
    }
    controls.update();
    smokes.forEach((group, gi) => {
      group.children.forEach((sprite, i) => {
        sprite.position.x = i * 0.35 + Math.sin(elapsed * 0.45 + sprite.userData.phase) * 0.5;
        sprite.position.y = sprite.userData.baseY + Math.sin(elapsed * 0.3 + gi) * 0.3;
      });
    });
    birds.position.x = -25 + Math.sin(elapsed * 0.045) * 35;
    birds.position.z = -65 + Math.cos(elapsed * 0.045) * 16;
    birds.children.forEach((bird, i) => { bird.rotation.z = Math.sin(elapsed * 3 + i) * 0.16; });
    ripples.children.forEach((line, i) => { line.material.opacity = 0.28 + Math.sin(elapsed * 0.7 + i * 0.6) * 0.12; });
    dust.rotation.y = elapsed * 0.002;
    if (selectionRing.visible) selectionRing.material.opacity = 0.5 + Math.sin(elapsed * 2) * 0.15;
    renderer.render(scene, camera);
    if (onFrame && frame++ % 2 === 0) onFrame(camera, renderer, currentId, labelsVisible);
  }

  function resize() {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  window.addEventListener('resize', resize);
  animate();
  setTime(70);
  setTimeout(() => onReady?.(), 450);

  return {
    focus, setTime, zoom,
    setLabelsVisible(value) { labelsVisible = value; },
    stopMotion() { cameraTween = null; },
    dispose() {
      destroyed = true;
      window.removeEventListener('resize', resize);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
