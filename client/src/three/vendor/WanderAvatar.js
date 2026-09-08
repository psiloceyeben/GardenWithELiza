// Generated from the recorded Wander renderer snapshot. See manifest.json; do not edit by hand.

// avatar-vendor-NmG3MJ/source/playerAvatar.ts
import * as THREE7 from "three";

// avatar-vendor-NmG3MJ/source/materialRegistry.ts
import * as THREE2 from "three";

// avatar-vendor-NmG3MJ/source/clayShaderPatch.ts
import * as THREE from "three";
var RIM_COLOR = new THREE.Color(16771528);
var RIM_STRENGTH = 0.06;
var RIM_POWER = 3.5;
var _cfg = {
  color: RIM_COLOR.clone(),
  strength: RIM_STRENGTH,
  power: RIM_POWER
};
var _patched = /* @__PURE__ */ new Set();
function applyClayShaderPatch(material) {
  if (!material) return;
  const m = material;
  if (m.__clayRimPatched) return;
  m.__clayRimPatched = true;
  const prevOBC = m.onBeforeCompile;
  const prevCacheKey = m.customProgramCacheKey;
  m.onBeforeCompile = (shader, renderer) => {
    if (typeof prevOBC === "function") {
      try {
        prevOBC.call(m, shader, renderer);
      } catch {
      }
    }
    const anchor = "#include <dithering_fragment>";
    if (typeof shader.fragmentShader !== "string" || shader.fragmentShader.indexOf(anchor) === -1) {
      return;
    }
    shader.uniforms.uClayRimColor = { value: _cfg.color };
    shader.uniforms.uClayRimStrength = { value: _cfg.strength };
    shader.uniforms.uClayRimPower = { value: _cfg.power };
    shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      /* glsl */
      `
        uniform vec3  uClayRimColor;
        uniform float uClayRimStrength;
        uniform float uClayRimPower;
        void main() {
      `
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      anchor,
      /* glsl */
      `
        {
          vec3  clayN = normalize( normal );
          vec3  clayV = normalize( vViewPosition );
          float clayNdV = clamp( dot( clayN, clayV ), 0.0, 1.0 );
          float clayFres = pow( 1.0 - clayNdV, uClayRimPower );
          gl_FragColor.rgb += uClayRimColor * ( uClayRimStrength * clayFres );
        }
        ${anchor}
      `
    );
  };
  m.customProgramCacheKey = () => {
    const base = typeof prevCacheKey === "function" ? prevCacheKey.call(m) : "";
    return base + "|clayRim1";
  };
  m.needsUpdate = true;
  _patched.add(m);
  m.addEventListener("dispose", () => {
    _patched.delete(m);
  });
}
if (typeof window !== "undefined") {
  window._wanderClayRim = {
    setStrength: (v) => {
      _cfg.strength = v;
      _patched.forEach((mm) => {
        mm.needsUpdate = true;
      });
    },
    setPower: (v) => {
      _cfg.power = v;
      _patched.forEach((mm) => {
        mm.needsUpdate = true;
      });
    },
    setColor: (hex) => {
      _cfg.color.setHex(hex);
    },
    get config() {
      return { strength: _cfg.strength, power: _cfg.power, color: "#" + _cfg.color.getHexString() };
    },
    patchedCount: () => _patched.size
  };
}

// avatar-vendor-NmG3MJ/source/materialRegistry.ts
function _texHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function _mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var CLAY_MODE = true;
var CLAY_ROUGH_JITTER = 0.06;
var CLAY_ROUGH_MIN = 0.82;
var CLAY_ROUGH_MAX = 0.98;
var CLAY_NORMAL_SCALE = 0.15;
var CLAY_NORMAL_REPEAT = 3;
function clayRoughness(baseRough, seed) {
  const s = typeof seed === "number" ? seed.toString(16) : seed;
  const r = _mulberry32(_texHash("clayrough:" + s))();
  const jittered = baseRough + (r * 2 - 1) * CLAY_ROUGH_JITTER;
  return Math.max(CLAY_ROUGH_MIN, Math.min(CLAY_ROUGH_MAX, jittered));
}
var _clayNormalMap = null;
function _buildClayNormalCanvas() {
  const SIZE = 128;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(SIZE, SIZE);
  const data = img.data;
  const rand = _mulberry32(_texHash("clay-normal-height"));
  const L = 8;
  const lattice = new Float32Array((L + 1) * (L + 1));
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
  const smooth = (t) => t * t * (3 - 2 * t);
  const undulation = (x, y) => {
    const gx = x / SIZE * L, gy = y / SIZE * L;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = smooth(gx - x0), fy = smooth(gy - y0);
    const idx = (xx, yy) => lattice[yy % (L + 1) * (L + 1) + xx % (L + 1)];
    const a = idx(x0, y0), b = idx(x0 + 1, y0), c = idx(x0, y0 + 1), d = idx(x0 + 1, y0 + 1);
    const top = a + (b - a) * fx, bot = c + (d - c) * fx;
    return top + (bot - top) * fy;
  };
  const DIMPLES = 26;
  const dimples = [];
  for (let i = 0; i < DIMPLES; i++) {
    dimples.push({
      x: rand() * SIZE,
      y: rand() * SIZE,
      r: 8 + rand() * 14,
      depth: (rand() * 2 - 1) * 0.5
      // some pressed in, some pushed out
    });
  }
  const heightAt = (x, y) => {
    let h = (undulation(x, y) - 0.5) * 0.55;
    for (const d of dimples) {
      let dx = x - d.x;
      if (dx > SIZE / 2) dx -= SIZE;
      if (dx < -SIZE / 2) dx += SIZE;
      let dy = y - d.y;
      if (dy > SIZE / 2) dy -= SIZE;
      if (dy < -SIZE / 2) dy += SIZE;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < d.r) {
        const f = 0.5 * (1 + Math.cos(dist / d.r * Math.PI));
        h += d.depth * f;
      }
    }
    return h;
  };
  const STRENGTH = 1.6;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const xl = (x - 1 + SIZE) % SIZE, xr = (x + 1) % SIZE;
      const yu = (y - 1 + SIZE) % SIZE, yd = (y + 1) % SIZE;
      const dhdx = (heightAt(xr, y) - heightAt(xl, y)) * STRENGTH;
      const dhdy = (heightAt(x, yd) - heightAt(x, yu)) * STRENGTH;
      let nx = -dhdx, ny = -dhdy, nz = 1;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= inv;
      ny *= inv;
      nz *= inv;
      const o = (y * SIZE + x) * 4;
      data[o] = Math.round((nx * 0.5 + 0.5) * 255);
      data[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[o + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
function getClayNormalMap() {
  if (_clayNormalMap) return _clayNormalMap;
  if (typeof document === "undefined") return null;
  const tex = new THREE2.CanvasTexture(_buildClayNormalCanvas());
  tex.wrapS = tex.wrapT = THREE2.RepeatWrapping;
  tex.repeat.set(CLAY_NORMAL_REPEAT, CLAY_NORMAL_REPEAT);
  tex.colorSpace = THREE2.NoColorSpace;
  tex.needsUpdate = true;
  _clayNormalMap = tex;
  return tex;
}
function clayNormalScale() {
  return new THREE2.Vector2(CLAY_NORMAL_SCALE, CLAY_NORMAL_SCALE);
}

// avatar-vendor-NmG3MJ/source/characterRigContract.ts
import * as THREE3 from "three";
var registered = /* @__PURE__ */ new Set();
function asNodes(v) {
  return Array.isArray(v) ? v.filter((x) => !!x && x.isObject3D) : [];
}
function makeHandSocket(parent, fallback, side) {
  const socket = new THREE3.Object3D();
  socket.name = side < 0 ? "slot.hand_left" : "slot.hand_right";
  socket.position.set(0, -0.48, 0.08);
  (parent || fallback).add(socket);
  return socket;
}
function bindCharacterRig(root, role, explicit) {
  const source = root.userData.characterRig || root.userData.rig || {};
  const arms = explicit?.arms || asNodes(source.arms || source.armPivots);
  const legs = explicit?.legs || asNodes(source.legs || source.legPivots);
  const head = explicit?.head || source.head || source.headPivot;
  const slots = explicit?.slots || root.userData.characterSlots || {};
  const handLeft = slots.hand_left || source.handLeft || source.leftHand || makeHandSocket(arms[0], root, -1);
  const handRight = slots.hand_right || source.handRight || source.rightHand || makeHandSocket(arms[1] || arms[0], root, 1);
  const detailMeshes = [];
  const box = new THREE3.Box3();
  const size = new THREE3.Vector3();
  root.traverse((o) => {
    const mesh = o;
    if (!mesh.isMesh) return;
    box.setFromObject(mesh).getSize(size);
    if (Math.max(size.x, size.y, size.z) < 0.16 || o.userData.isMemeFace) detailMeshes.push(o);
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m || m.isMeshBasicMaterial) continue;
      if (typeof m.roughness === "number") m.roughness = Math.max(0.82, m.roughness);
      if (typeof m.metalness === "number") m.metalness = 0;
    }
  });
  const bounds = new THREE3.Box3().setFromObject(root);
  const groundOffset = Number.isFinite(bounds.min.y) ? -bounds.min.y : 0;
  const contract = {
    version: 1,
    role,
    root,
    head: head || void 0,
    arms,
    legs,
    handLeft,
    handRight,
    state: "idle",
    detailMeshes,
    damageUntil: 0,
    groundOffset
  };
  root.userData.characterRig = { arms, legs, head, handLeft, handRight };
  root.userData.characterContract = contract;
  root.userData.characterSlots = { ...slots, hand_left: handLeft, hand_right: handRight };
  registered.add(root);
  return contract;
}

// avatar-vendor-NmG3MJ/source/generators/wearable.ts
import * as THREE6 from "three";

// avatar-vendor-NmG3MJ/source/generators/materials.ts
import * as THREE4 from "three";
var MATERIAL_PALETTE = {
  marble: { color: 15722700, roughness: 0.3, metalness: 0, toon: true },
  concrete: { color: 10920600, roughness: 0.85, metalness: 0.05, toon: true },
  wood: { color: 9067058, roughness: 0.7, metalness: 0, toon: true },
  brick: { color: 12084038, roughness: 0.8, metalness: 0, toon: true },
  stone: { color: 9866620, roughness: 0.75, metalness: 0, toon: true },
  glass: { color: 13166320, roughness: 0.05, metalness: 0, toon: false },
  steel: { color: 11975102, roughness: 0.3, metalness: 0.9, toon: false },
  gold: { color: 14859370, roughness: 0.25, metalness: 0.95, toon: false },
  copper: { color: 13797464, roughness: 0.45, metalness: 0.85, toon: false },
  // default — used when no material modifier is present
  _default: { color: 13021844, roughness: 0.6, metalness: 0.05, toon: true }
};
var COLOR_NAME_MAP = {
  scarlet: 13777454,
  azure: 3832786,
  emerald: 3056490,
  ivory: 15722700,
  obsidian: 2302250,
  umber: 7029795,
  mustard: 13805358,
  violet: 8015797,
  teal: 3054243,
  rose: 14711446
};
var CONDITION_TINT = {
  weathered: { darken: 0.85, rough_add: 0.1 },
  ruined: { darken: 0.7, rough_add: 0.2 },
  half_ruined: { darken: 0.78, rough_add: 0.15 },
  overgrown: { darken: 0.8, rough_add: 0.05 },
  abandoned: { darken: 0.85, rough_add: 0.1 },
  pristine: { darken: 1, rough_add: -0.05 },
  polished: { darken: 1.05, rough_add: -0.15 }
};
var _toonGradient = null;
function getToonGradient() {
  if (_toonGradient) return _toonGradient;
  const data = new Uint8Array([56, 56, 56, 255, 140, 140, 140, 255, 210, 210, 210, 255, 255, 255, 255, 255]);
  const tex = new THREE4.DataTexture(data, 4, 1, THREE4.RGBAFormat);
  tex.magFilter = THREE4.NearestFilter;
  tex.minFilter = THREE4.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  _toonGradient = tex;
  return tex;
}
function materialFor(modifiers = []) {
  let palette = MATERIAL_PALETTE._default;
  for (const m of modifiers) {
    if (m in MATERIAL_PALETTE) {
      palette = MATERIAL_PALETTE[m];
      break;
    }
  }
  let { color, roughness, metalness, toon } = palette;
  for (const m of modifiers) {
    if (m in COLOR_NAME_MAP) {
      color = COLOR_NAME_MAP[m];
      break;
    }
  }
  for (const m of modifiers) {
    if (m in CONDITION_TINT) {
      const t = CONDITION_TINT[m];
      const c = new THREE4.Color(color);
      c.multiplyScalar(t.darken);
      color = c.getHex();
      roughness = Math.max(0, Math.min(1, roughness + t.rough_add));
    }
  }
  if (CLAY_MODE) {
    if (toon) {
      const _clayM = new THREE4.MeshStandardMaterial({
        color: new THREE4.Color(color),
        roughness: clayRoughness(Math.max(0.9, roughness), color),
        metalness: 0,
        normalMap: getClayNormalMap(),
        normalScale: clayNormalScale(),
        envMapIntensity: 0.5
      });
      applyClayShaderPatch(_clayM);
      return _clayM;
    }
    return new THREE4.MeshStandardMaterial({
      color: new THREE4.Color(color),
      roughness: Math.min(1, roughness + 0.15),
      metalness: metalness * 0.85,
      envMapIntensity: 0.5
    });
  }
  if (toon) {
    return new THREE4.MeshToonMaterial({
      color: new THREE4.Color(color),
      gradientMap: getToonGradient()
    });
  }
  return new THREE4.MeshStandardMaterial({
    color: new THREE4.Color(color),
    roughness,
    metalness
  });
}

// avatar-vendor-NmG3MJ/source/hitbox.ts
import * as THREE5 from "three";
function stampHitVectors(obj, vectors) {
  obj.userData.hitVectors = vectors;
}
function inferMaterialTag(modifiers = []) {
  for (const m of modifiers) {
    if ([
      "marble",
      "concrete",
      "wood",
      "stone",
      "brick",
      "glass",
      "steel",
      "iron",
      "bronze",
      "gold"
    ].includes(m)) return m;
  }
  return "stone";
}

// avatar-vendor-NmG3MJ/source/generators/wearable.ts
function wearableSlot(profile) {
  return {
    glasses: "face",
    mask: "face",
    helm: "head",
    head: "head",
    hat: "head",
    boots: "feet",
    feet: "feet",
    ring: "hand_right",
    amulet: "neck",
    scarf: "neck",
    cape: "back",
    backpack: "back",
    cloak: "torso",
    robe: "torso",
    armor: "torso",
    shirt: "torso",
    jacket: "torso",
    tunic: "torso",
    skirt: "torso",
    belt: "torso"
  }[profile] || "torso";
}
function generateWearable(node) {
  const profile = String(node.params?.profile || "cloak");
  const group = new THREE6.Group();
  const mat = materialFor(node.modifiers || []);
  const add = (mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  if (profile === "glasses") {
    for (const x of [-0.1, 0.1]) add(new THREE6.Mesh(new THREE6.TorusGeometry(0.08, 0.012, 8, 16), mat)).position.set(x, 0, 0.02);
    const bridge = add(new THREE6.Mesh(new THREE6.CylinderGeometry(8e-3, 8e-3, 0.06, 8), mat));
    bridge.position.z = 0.02;
    bridge.rotation.z = Math.PI / 2;
  } else if (profile === "mask") {
    const mask = add(new THREE6.Mesh(new THREE6.SphereGeometry(0.19, 16, 10, 0, Math.PI * 2, 0.45, Math.PI * 0.45), mat));
    mask.position.set(0, -0.03, 5e-3);
    mask.scale.set(1, 1.05, 0.35);
  } else if (profile === "hat") {
    add(new THREE6.Mesh(new THREE6.CylinderGeometry(0.29, 0.29, 0.035, 18), mat));
    const crown = add(new THREE6.Mesh(new THREE6.ConeGeometry(0.17, 0.36, 16), mat));
    crown.position.y = 0.19;
  } else if (profile === "helm" || profile === "head") {
    const helm = add(new THREE6.Mesh(new THREE6.SphereGeometry(0.21, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.72), mat));
    helm.position.y = -0.1;
  } else if (profile === "boots" || profile === "feet") {
    for (const x of [-0.13, 0.13]) add(new THREE6.Mesh(new THREE6.BoxGeometry(0.14, 0.13, 0.27), mat)).position.set(x, 0.04, 0.04);
  } else if (profile === "ring") {
    add(new THREE6.Mesh(new THREE6.TorusGeometry(0.04, 8e-3, 8, 16), mat));
  } else if (profile === "amulet") {
    const chain = add(new THREE6.Mesh(new THREE6.TorusGeometry(0.12, 5e-3, 6, 24), mat));
    chain.position.set(0, -0.06, 0.03);
    const pendant = add(new THREE6.Mesh(new THREE6.SphereGeometry(0.03, 12, 8), mat));
    pendant.position.set(0, -0.19, 0.06);
  } else if (profile === "scarf") {
    const loop = add(new THREE6.Mesh(new THREE6.TorusGeometry(0.13, 0.035, 8, 20), mat));
    loop.rotation.x = Math.PI / 2;
    const tail = add(new THREE6.Mesh(new THREE6.BoxGeometry(0.09, 0.42, 0.035), mat));
    tail.position.set(0.06, -0.23, -0.02);
    tail.rotation.z = -0.12;
  } else if (profile === "cape") {
    const cape = add(new THREE6.Mesh(new THREE6.BoxGeometry(0.58, 0.98, 0.045), mat));
    cape.position.set(0, -0.22, -0.02);
    cape.rotation.x = -0.08;
    const clasp = add(new THREE6.Mesh(new THREE6.TorusGeometry(0.12, 0.018, 8, 18), mat));
    clasp.position.set(0, 0.25, 0.04);
  } else if (profile === "backpack") {
    const pack = add(new THREE6.Mesh(new THREE6.BoxGeometry(0.48, 0.6, 0.22), mat));
    pack.position.set(0, -0.05, -0.08);
  } else if (profile === "belt") {
    const belt = add(new THREE6.Mesh(new THREE6.TorusGeometry(0.31, 0.035, 8, 24), mat));
    belt.rotation.x = Math.PI / 2;
    belt.scale.z = 0.88;
    const buckle = add(new THREE6.Mesh(new THREE6.BoxGeometry(0.11, 0.09, 0.04), mat));
    buckle.position.set(0, 0, 0.28);
  } else if (profile === "skirt") {
    const skirt = add(new THREE6.Mesh(new THREE6.CylinderGeometry(0.28, 0.42, 0.75, 14), mat));
    skirt.position.y = -0.42;
  } else {
    const top = profile === "shirt" ? 0.3 : profile === "jacket" ? 0.33 : 0.29;
    const bottom = profile === "armor" ? 0.36 : profile === "robe" || profile === "cloak" ? 0.42 : 0.34;
    const height = profile === "robe" || profile === "cloak" ? 1.08 : profile === "tunic" ? 0.78 : 0.67;
    const torso = add(new THREE6.Mesh(new THREE6.CylinderGeometry(top, bottom, height, 12), mat));
    torso.position.y = profile === "robe" || profile === "cloak" ? -0.22 : -0.02;
    if (profile === "armor" || profile === "jacket") for (const side of [-1, 1]) {
      const shoulder = add(new THREE6.Mesh(new THREE6.SphereGeometry(0.12, 10, 8), mat));
      shoulder.position.set(side * 0.32, 0.22, 0);
      shoulder.scale.set(1.2, 0.75, 1);
    }
  }
  const slot = String(node.params?.attach_slot || wearableSlot(profile));
  const hits = [{
    label: profile,
    region: { center: [0, 0, 0], half_size: [0.35, 0.55, 0.24] },
    material_tag: inferMaterialTag(node.modifiers || []),
    affordances: { grasp: true, grasp_handle: [0, 0, 0], weight_class: 1, detach_cost: 0.5, inscribe: true, attach_to: [`player.slot.${slot}`, "wearable.rack"] }
  }];
  stampHitVectors(group, hits);
  return group;
}

// avatar-vendor-NmG3MJ/source/playerAvatar.ts
var DEFAULT_CUSTOM = {
  skinColor: "#f0d4a8",
  bodyColor: "#4a3f50",
  pantsColor: "#2a2533",
  hairStyle: "short",
  hairColor: "#3a2818",
  height: 1.7,
  build: "medium",
  eyeColor: "#3a2818",
  preset: "wanderer"
};
var PLAYER_MODEL_PRESETS = {
  // ── 5 semi-regular ──────────────────────────────────────────────────
  wanderer: {
    label: "Wanderer",
    meme: false,
    blurb: "The default traveller.",
    // Exactly DEFAULT_CUSTOM — the baseline everyone starts from.
    state: {
      skinColor: "#f0d4a8",
      bodyColor: "#4a3f50",
      pantsColor: "#2a2533",
      hairStyle: "short",
      hairColor: "#3a2818",
      height: 1.7,
      build: "medium",
      eyeColor: "#3a2818"
    }
  },
  warden: {
    label: "Warden",
    meme: false,
    blurb: "Stocky, muted green & brown.",
    state: {
      skinColor: "#d8b48c",
      bodyColor: "#556b3d",
      pantsColor: "#4a3a26",
      hairStyle: "short",
      hairColor: "#2e2114",
      height: 1.72,
      build: "stocky",
      eyeColor: "#3a2a16"
    }
  },
  scholar: {
    label: "Scholar",
    meme: false,
    blurb: "Slim, long-haired, deep blue.",
    state: {
      skinColor: "#ecc9a0",
      bodyColor: "#243a66",
      pantsColor: "#1b2540",
      hairStyle: "long",
      hairColor: "#20160c",
      height: 1.7,
      build: "slim",
      eyeColor: "#2a3a5a"
    }
  },
  forager: {
    label: "Forager",
    meme: false,
    blurb: "Short, earthy, ponytail.",
    state: {
      skinColor: "#e0b487",
      bodyColor: "#7a5a34",
      pantsColor: "#3d4a2a",
      hairStyle: "ponytail",
      hairColor: "#4a3218",
      height: 1.58,
      build: "medium",
      eyeColor: "#3a2a14"
    }
  },
  nomad: {
    label: "Nomad",
    meme: false,
    blurb: "Tall, sand-toned, hooded bun.",
    state: {
      skinColor: "#d9b48f",
      bodyColor: "#c8b083",
      pantsColor: "#9a825a",
      hairStyle: "bun",
      hairColor: "#2a1e12",
      height: 1.9,
      build: "medium",
      eyeColor: "#2e2214"
    }
  },
  // ── 5 meme ──────────────────────────────────────────────────────────
  capybara: {
    label: "Capybara",
    meme: true,
    blurb: "Unbothered quadruped traveller.",
    state: {
      skinColor: "#8a6a44",
      bodyColor: "#6f5334",
      pantsColor: "#5a4228",
      hairStyle: "shaved",
      hairColor: "#4a3620",
      height: 1.55,
      build: "stocky",
      eyeColor: "#1a120a"
    }
  },
  goblin: {
    label: "Goblin",
    meme: true,
    blurb: "Small, green, up to no good.",
    state: {
      skinColor: "#6f9440",
      bodyColor: "#3d4a2a",
      pantsColor: "#2a3018",
      hairStyle: "shaved",
      hairColor: "#2a3018",
      height: 1.5,
      build: "slim",
      eyeColor: "#c8f24b"
    }
  },
  golem: {
    label: "Golem",
    meme: true,
    blurb: "Tall, grey, stony.",
    state: {
      skinColor: "#8f9298",
      bodyColor: "#6a6d73",
      pantsColor: "#54575c",
      hairStyle: "shaved",
      hairColor: "#54575c",
      height: 2,
      build: "stocky",
      eyeColor: "#2a2c30"
    }
  },
  doge: {
    label: "Doge",
    meme: true,
    blurb: "Such wander. Very tan.",
    state: {
      skinColor: "#e0b25c",
      bodyColor: "#d9a84e",
      pantsColor: "#b98a34",
      hairStyle: "short",
      hairColor: "#8a5e24",
      height: 1.6,
      build: "medium",
      eyeColor: "#2a1c0a"
    }
  },
  chad: {
    label: "Chad",
    meme: true,
    blurb: "Maxed. Greyscale. Yes.",
    state: {
      skinColor: "#d8d8d8",
      bodyColor: "#4a4a4a",
      pantsColor: "#2a2a2a",
      hairStyle: "short",
      hairColor: "#3a3a3a",
      height: 2,
      build: "stocky",
      eyeColor: "#202020"
    }
  }
};
var STORAGE_KEY = "wander.player.customization.v1";
var EQUIPMENT_STORAGE_KEY = "wander.player.equipment.v1";
var PlayerAvatar = class {
  /** The visible group; parent it under whatever follows the camera. */
  root;
  /** Named attachment slots — each is a child Object3D you can reparent into. */
  slots = {};
  state;
  animArms = [];
  animLegs = [];
  animHead = null;
  quadruped = false;
  equipment = {};
  loadSaved = true;
  constructor(initialState, opts = {}) {
    this.loadSaved = opts.loadSaved !== false;
    this.state = { ...DEFAULT_CUSTOM, ...initialState };
    try {
      if (this.loadSaved) {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object") {
            this.state = { ...this.state, ...parsed };
          }
        }
      }
    } catch {
    }
    try {
      if (this.loadSaved) {
        const savedEquipment = JSON.parse(localStorage.getItem(EQUIPMENT_STORAGE_KEY) || "{}");
        if (savedEquipment && typeof savedEquipment === "object") {
          for (const [slot, node] of Object.entries(savedEquipment)) {
            if (node && typeof node === "object" && node.op === "atom" && node.kind === "wearable") {
              this.equipment[slot] = node;
            }
          }
        }
      }
    } catch {
    }
    this.root = new THREE7.Group();
    this.rebuild();
  }
  /** Rebuild the visible mesh from current state. Discards old geometry. */
  rebuild() {
    for (const material of this.root.userData.ponsOwnedMaterials || []) material.dispose();
    this.root.userData.ponsOwnedMaterials = [];
    while (this.root.children.length) {
      const c = this.root.children[0];
      this.root.remove(c);
      disposeRecursive(c);
    }
    this.slots = {};
    this.animArms = [];
    this.animLegs = [];
    this.animHead = null;
    this.quadruped = false;
    const s = resolveState(this.state);
    const clayMat = (c) => {
      const hex = new THREE7.Color(c).getHex();
      const _m = new THREE7.MeshStandardMaterial({
        color: c,
        roughness: clayRoughness(0.92, hex),
        metalness: 0,
        normalMap: getClayNormalMap(),
        normalScale: clayNormalScale(),
        envMapIntensity: 0.5
      });
      applyClayShaderPatch(_m);
      this.root.userData.ponsOwnedMaterials.push(_m);
      return _m;
    };
    const skin = clayMat(s.skinColor);
    const body = clayMat(s.bodyColor);
    const pants = clayMat(s.pantsColor);
    const hair = clayMat(s.hairColor);
    const eye = new THREE7.MeshBasicMaterial({ color: s.eyeColor });
    this.root.userData.ponsOwnedMaterials.push(eye);
    const buildScale = s.build === "slim" ? 0.85 : s.build === "stocky" ? 1.15 : 1;
    const yScale = s.height / 1.7;
    if (s.preset === "capybara") {
      this.quadruped = true;
      const q = new THREE7.Group();
      const qScale = s.height / 1.55;
      q.scale.setScalar(qScale);
      this.root.add(q);
      const addSlot = (name, x, y, z) => {
        const slot = new THREE7.Object3D();
        slot.position.set(x, y, z);
        q.add(slot);
        this.slots[name] = slot;
      };
      const bodyMesh = new THREE7.Mesh(new THREE7.CapsuleGeometry(0.29, 0.66, 6, 14), body);
      bodyMesh.rotation.x = Math.PI / 2;
      bodyMesh.position.set(0, 0.61, -0.04);
      bodyMesh.scale.x = 1.08 * buildScale;
      bodyMesh.castShadow = true;
      q.add(bodyMesh);
      const chest = new THREE7.Mesh(new THREE7.SphereGeometry(0.31, 16, 12), body);
      chest.position.set(0, 0.64, 0.3);
      chest.scale.set(1.05 * buildScale, 1, 0.95);
      chest.castShadow = true;
      q.add(chest);
      const head2 = new THREE7.Mesh(new THREE7.SphereGeometry(0.28, 16, 12), body);
      head2.position.set(0, 0.74, 0.57);
      head2.scale.set(1, 0.92, 1.18);
      head2.castShadow = true;
      q.add(head2);
      this.animHead = head2;
      const muzzle = new THREE7.Mesh(new THREE7.SphereGeometry(0.17, 14, 10), skin);
      muzzle.position.set(0, 0.69, 0.82);
      muzzle.scale.set(1.15, 0.78, 1.05);
      muzzle.castShadow = true;
      q.add(muzzle);
      for (const side of [-1, 1]) {
        const ear = new THREE7.Mesh(new THREE7.SphereGeometry(0.075, 10, 8), hair);
        ear.position.set(side * 0.18, 0.94, 0.5);
        ear.scale.set(0.9, 1.15, 0.65);
        q.add(ear);
        const e = new THREE7.Mesh(new THREE7.SphereGeometry(0.027, 8, 6), eye);
        e.position.set(side * 0.105, 0.79, 0.79);
        q.add(e);
        const nostril = new THREE7.Mesh(new THREE7.SphereGeometry(0.015, 7, 5), eye);
        nostril.position.set(side * 0.055, 0.72, 0.965);
        q.add(nostril);
      }
      for (const x of [-0.2, 0.2]) for (const z of [-0.3, 0.3]) {
        const leg = new THREE7.Mesh(new THREE7.CapsuleGeometry(0.075, 0.28, 4, 9), body);
        leg.position.set(x * buildScale, 0.27, z);
        leg.castShadow = true;
        q.add(leg);
        this.animLegs.push(leg);
        const paw = new THREE7.Mesh(new THREE7.SphereGeometry(0.085, 9, 7), hair);
        paw.position.set(x * buildScale, 0.07, z + 0.035);
        paw.scale.set(1, 0.62, 1.2);
        q.add(paw);
      }
      const tail = new THREE7.Mesh(new THREE7.SphereGeometry(0.055, 9, 7), hair);
      tail.position.set(0, 0.55, -0.63);
      tail.scale.set(1, 0.8, 0.65);
      q.add(tail);
      addSlot("torso", 0, 0.64, 0);
      addSlot("back", 0, 0.94, -0.06);
      addSlot("neck", 0, 0.82, 0.36);
      addSlot("head", 0, 1.02, 0.56);
      addSlot("face", 0, 0.76, 0.91);
      addSlot("hand_left", -0.2, 0.16, 0.34);
      addSlot("hand_right", 0.2, 0.16, 0.34);
      addSlot("feet", 0, 0.06, 0.02);
      this.attachEquipment();
      bindCharacterRig(this.root, "player", { head: this.animHead, arms: this.animArms, legs: this.animLegs, slots: this.slots });
      return;
    }
    for (const side of [-1, 1]) {
      const leg = new THREE7.Mesh(
        new THREE7.CylinderGeometry(0.13 * buildScale, 0.12 * buildScale, 0.85 * yScale, 10),
        pants
      );
      leg.position.set(side * 0.13 * buildScale, 0.42 * yScale, 0);
      leg.castShadow = true;
      this.root.add(leg);
      this.animLegs.push(leg);
    }
    const torso = new THREE7.Mesh(
      new THREE7.CylinderGeometry(0.3 * buildScale, 0.34 * buildScale, 0.65 * yScale, 12),
      body
    );
    torso.position.set(0, 1.17 * yScale, 0);
    torso.castShadow = true;
    this.root.add(torso);
    const slotTorso = new THREE7.Object3D();
    slotTorso.position.copy(torso.position);
    this.root.add(slotTorso);
    this.slots["torso"] = slotTorso;
    const slotBack = new THREE7.Object3D();
    slotBack.position.set(0, 1.17 * yScale, -0.2);
    this.root.add(slotBack);
    this.slots["back"] = slotBack;
    const shoulderY = 1.44 * yScale;
    const armLen = 0.6 * yScale;
    for (const side of [-1, 1]) {
      const armGroup = new THREE7.Group();
      armGroup.position.set(side * (0.3 * buildScale + 0.04), shoulderY, 0);
      armGroup.rotation.z = side * 0.16;
      this.root.add(armGroup);
      this.animArms.push(armGroup);
      const shoulder = new THREE7.Mesh(new THREE7.SphereGeometry(0.095 * buildScale, 12, 10), body);
      shoulder.castShadow = true;
      armGroup.add(shoulder);
      const arm = new THREE7.Mesh(new THREE7.CapsuleGeometry(0.072 * buildScale, armLen, 4, 10), body);
      arm.position.set(0, -armLen * 0.5 - 0.04, 0);
      arm.castShadow = true;
      armGroup.add(arm);
      const handLocalY = -armLen - 0.08;
      const hand = new THREE7.Mesh(new THREE7.SphereGeometry(0.078 * buildScale, 10, 8), skin);
      hand.position.set(0, handLocalY, 0);
      hand.scale.set(1, 0.85, 1);
      hand.castShadow = true;
      armGroup.add(hand);
      const slotHand = new THREE7.Object3D();
      slotHand.position.set(0, handLocalY, 0.03);
      armGroup.add(slotHand);
      this.slots[side === -1 ? "hand_left" : "hand_right"] = slotHand;
    }
    const neck = new THREE7.Mesh(
      new THREE7.CylinderGeometry(0.08, 0.09, 0.08 * yScale, 8),
      skin
    );
    neck.position.set(0, 1.55 * yScale, 0);
    this.root.add(neck);
    const slotNeck = new THREE7.Object3D();
    slotNeck.position.set(0, 1.55 * yScale, 0.04);
    this.root.add(slotNeck);
    this.slots["neck"] = slotNeck;
    const head = new THREE7.Mesh(
      new THREE7.SphereGeometry(0.18 * yScale, 16, 12),
      skin
    );
    head.position.set(0, 1.74 * yScale, 0);
    head.castShadow = true;
    this.root.add(head);
    this.animHead = head;
    for (const side of [-1, 1]) {
      const e = new THREE7.Mesh(
        new THREE7.SphereGeometry(0.025 * yScale, 8, 6),
        eye
      );
      e.position.set(side * 0.06, 1.77 * yScale, 0.16 * yScale);
      this.root.add(e);
    }
    const nose = new THREE7.Mesh(new THREE7.SphereGeometry(0.03 * yScale, 8, 6), skin);
    nose.position.set(0, 1.73 * yScale, 0.18 * yScale);
    nose.scale.set(1, 0.8, 1.1);
    this.root.add(nose);
    const slotFace = new THREE7.Object3D();
    slotFace.position.set(0, 1.76 * yScale, 0.18);
    this.root.add(slotFace);
    this.slots["face"] = slotFace;
    if (s.hairStyle !== "shaved") {
      const hairTop = new THREE7.Mesh(
        new THREE7.SphereGeometry(0.2 * yScale, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
        hair
      );
      hairTop.position.set(0, 1.78 * yScale, 0);
      hairTop.castShadow = true;
      this.root.add(hairTop);
      if (s.hairStyle === "long") {
        const back = new THREE7.Mesh(
          new THREE7.BoxGeometry(0.34 * yScale, 0.4 * yScale, 0.08),
          hair
        );
        back.position.set(0, 1.55 * yScale, -0.13);
        this.root.add(back);
      } else if (s.hairStyle === "ponytail") {
        const tail = new THREE7.Mesh(
          new THREE7.CylinderGeometry(0.06 * yScale, 0.04 * yScale, 0.35 * yScale, 8),
          hair
        );
        tail.position.set(0, 1.55 * yScale, -0.12);
        this.root.add(tail);
      } else if (s.hairStyle === "bun") {
        const bun = new THREE7.Mesh(
          new THREE7.SphereGeometry(0.09 * yScale, 12, 10),
          hair
        );
        bun.position.set(0, 1.96 * yScale, -0.06);
        this.root.add(bun);
      }
    }
    const slotHead = new THREE7.Object3D();
    slotHead.position.set(0, 1.92 * yScale, 0);
    this.root.add(slotHead);
    this.slots["head"] = slotHead;
    for (const side of [-1, 1]) {
      const foot = new THREE7.Mesh(
        new THREE7.BoxGeometry(0.12, 0.08, 0.22),
        pants
      );
      foot.position.set(side * 0.13 * buildScale, 0.04, 0.05);
      foot.castShadow = true;
      this.root.add(foot);
    }
    const slotFeet = new THREE7.Object3D();
    slotFeet.position.set(0, 0.04, 0.05);
    this.root.add(slotFeet);
    this.slots["feet"] = slotFeet;
    if (s.preset === "goblin") {
      for (const side of [-1, 1]) {
        const ear = new THREE7.Mesh(new THREE7.ConeGeometry(0.09, 0.34, 10), skin);
        ear.position.set(side * 0.3, 1.77 * yScale, 0);
        ear.rotation.z = side * -Math.PI / 2;
        ear.castShadow = true;
        this.root.add(ear);
      }
      nose.scale.set(1.2, 0.9, 2.2);
      nose.position.z = 0.215 * yScale;
    } else if (s.preset === "doge") {
      for (const side of [-1, 1]) {
        const ear = new THREE7.Mesh(new THREE7.ConeGeometry(0.095, 0.27, 10), hair);
        ear.position.set(side * 0.12, 2 * yScale, -0.01);
        ear.rotation.z = side * -0.12;
        ear.castShadow = true;
        this.root.add(ear);
      }
      const muzzle = new THREE7.Mesh(new THREE7.SphereGeometry(0.085 * yScale, 10, 8), skin);
      muzzle.position.set(0, 1.7 * yScale, 0.205 * yScale);
      muzzle.scale.set(1.25, 0.75, 1.15);
      muzzle.castShadow = true;
      this.root.add(muzzle);
      const snout = new THREE7.Mesh(new THREE7.SphereGeometry(0.027 * yScale, 8, 6), eye);
      snout.position.set(0, 1.72 * yScale, 0.292 * yScale);
      this.root.add(snout);
    } else if (s.preset === "golem") {
      for (const side of [-1, 1]) {
        const shoulderRock = new THREE7.Mesh(new THREE7.DodecahedronGeometry(0.18 * buildScale, 0), body);
        shoulderRock.position.set(side * 0.42 * buildScale, 1.43 * yScale, -0.02);
        shoulderRock.rotation.set(side * 0.2, 0.25, side * 0.35);
        shoulderRock.castShadow = true;
        this.root.add(shoulderRock);
      }
      head.scale.set(1.15, 0.95, 1);
      const brow = new THREE7.Mesh(new THREE7.BoxGeometry(0.3, 0.055, 0.06), hair);
      brow.position.set(0, 1.82 * yScale, 0.16 * yScale);
      brow.castShadow = true;
      this.root.add(brow);
    } else if (s.preset === "chad") {
      head.scale.set(1.12, 1.02, 1);
      const jaw = new THREE7.Mesh(new THREE7.BoxGeometry(0.31 * yScale, 0.16 * yScale, 0.25 * yScale), skin);
      jaw.position.set(0, 1.64 * yScale, 0.035);
      jaw.castShadow = true;
      this.root.add(jaw);
      const chin = new THREE7.Mesh(new THREE7.BoxGeometry(0.17 * yScale, 0.08 * yScale, 0.07), skin);
      chin.position.set(0, 1.57 * yScale, 0.15);
      chin.castShadow = true;
      this.root.add(chin);
    }
    this.attachEquipment();
    bindCharacterRig(this.root, "player", { head: this.animHead, arms: this.animArms, legs: this.animLegs, slots: this.slots });
  }
  attachEquipment() {
    for (const [slot, node] of Object.entries(this.equipment)) {
      const target = this.slots[slot];
      if (!target) continue;
      try {
        const visual = generateWearable(node);
        visual.name = `equipped:${slot}:${String(node.params?.profile || "wearable")}`;
        visual.userData.equippedWearable = true;
        target.add(visual);
      } catch (e) {
        console.warn(`[avatar] wearable failed for ${slot}:`, e);
      }
    }
  }
  saveEquipment() {
    if (!this.loadSaved) return;
    try {
      localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(this.equipment));
    } catch {
    }
  }
  /** Equip one wearable atom into its authored attachment slot. */
  equipWearable(node) {
    if (!node || node.kind !== "wearable") return null;
    const slot = String(node.params?.attach_slot || this.slotForProfile(String(node.params?.profile || "")));
    if (!this.slots[slot] && !["head", "face", "neck", "torso", "back", "hand_left", "hand_right", "feet"].includes(slot)) return null;
    this.equipment[slot] = JSON.parse(JSON.stringify(node));
    this.saveEquipment();
    this.rebuild();
    return slot;
  }
  /** Replace the current outfit with every wearable child in an outfit tree. */
  equipOutfit(tree) {
    const root = tree?.root;
    if (!root || root.op !== "composer" || root.kind !== "outfit" || !Array.isArray(root.children)) return 0;
    const next = {};
    for (const child of root.children) {
      if (child?.op !== "atom" || child.kind !== "wearable") continue;
      const slot = String(child.params?.attach_slot || this.slotForProfile(String(child.params?.profile || "")));
      if (slot) next[slot] = JSON.parse(JSON.stringify(child));
    }
    this.equipment = next;
    this.saveEquipment();
    this.rebuild();
    return Object.keys(next).length;
  }
  unequip(slot) {
    const node = this.equipment[slot];
    if (!node) return null;
    delete this.equipment[slot];
    this.saveEquipment();
    this.rebuild();
    return JSON.parse(JSON.stringify(node));
  }
  clearEquipment() {
    this.equipment = {};
    this.saveEquipment();
    this.rebuild();
  }
  equipmentSnapshot() {
    return JSON.parse(JSON.stringify(this.equipment));
  }
  setEquipment(equipment) {
    this.equipment = JSON.parse(JSON.stringify(equipment || {}));
    this.saveEquipment();
    this.rebuild();
  }
  slotForProfile(profile) {
    return {
      glasses: "face",
      mask: "face",
      helm: "head",
      head: "head",
      hat: "head",
      boots: "feet",
      feet: "feet",
      ring: "hand_right",
      amulet: "neck",
      scarf: "neck",
      cape: "back",
      backpack: "back",
      cloak: "torso",
      robe: "torso",
      armor: "torso",
      shirt: "torso",
      jacket: "torso",
      tunic: "torso",
      skirt: "torso",
      belt: "torso"
    }[profile] || "torso";
  }
  /** Drive the local third-person chassis from the same movement truth used by
   * controls. Peers/NPCs already animate; without this the player's own improved
   * model froze whenever O switched to third person. */
  animate(timeSeconds, moving, speed = 1) {
    if (!this.root.visible) return;
    const rate = (this.quadruped ? 7 : 6.2) * Math.max(0.6, speed);
    const amp = this.quadruped ? 0.36 : 0.58;
    const phase = timeSeconds * rate;
    for (let i = 0; i < this.animLegs.length; i++) {
      const pairPhase = this.quadruped ? i === 0 || i === 3 ? 0 : Math.PI : i % 2 * Math.PI;
      const target = moving ? Math.sin(phase + pairPhase) * amp : 0;
      this.animLegs[i].rotation.x += (target - this.animLegs[i].rotation.x) * 0.24;
    }
    for (let i = 0; i < this.animArms.length; i++) {
      const target = moving ? Math.sin(phase + i % 2 * Math.PI + Math.PI) * amp * 0.72 : 0;
      this.animArms[i].rotation.x += (target - this.animArms[i].rotation.x) * 0.24;
    }
    if (this.animHead) {
      const target = moving ? Math.sin(phase * 2) * 0.025 : Math.sin(timeSeconds * 0.7) * 0.045;
      this.animHead.rotation.y += (target - this.animHead.rotation.y) * 0.08;
    }
  }
  /** Persist current state to localStorage. */
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
    }
  }
  /** Apply a patch + rebuild + save. */
  update(patch) {
    Object.assign(this.state, patch);
    this.rebuild();
    this.save();
  }
  /**
   * Switch to one of the ten base models: bakes the preset's palette/build
   * into `state` (so later per-field edits override it) AND stamps `preset`
   * so the choice round-trips through the appearance doc / localStorage.
   * Equivalent to `update({ ...PLAYER_MODEL_PRESETS[id].state, preset: id })`.
   */
  setModel(id) {
    const p = PLAYER_MODEL_PRESETS[id];
    if (!p) return;
    this.update({ ...p.state, preset: id });
  }
};
var VISUAL_KEYS = [
  "skinColor",
  "bodyColor",
  "pantsColor",
  "hairStyle",
  "hairColor",
  "height",
  "build",
  "eyeColor"
];
function resolveState(state) {
  const preset = state.preset ? PLAYER_MODEL_PRESETS[state.preset] : void 0;
  const base = preset ? { ...DEFAULT_CUSTOM, ...preset.state } : { ...DEFAULT_CUSTOM };
  for (const k of VISUAL_KEYS) {
    const v = state[k];
    if (v !== void 0 && v !== null) base[k] = v;
  }
  base.preset = state.preset;
  return base;
}
function disposeRecursive(obj) {
  obj.traverse((o) => {
    const m = o;
    if (m.geometry) m.geometry.dispose();
    if (m.material) {
      if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
      else m.material.dispose();
    }
  });
}
export {
  DEFAULT_CUSTOM,
  PLAYER_MODEL_PRESETS,
  PlayerAvatar
};
