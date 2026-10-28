import * as THREE from 'three';

const V2 = (a) => new THREE.Vector2(a, a);

// HDR colour: values above 1.0 are what the bloom pass picks up as glow.
export const hdr = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

export function createMaterials(tx) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const m = {};

  m.concrete = std({ ...tx.concrete, roughness: 1, normalScale: V2(1.2), color: 0xb4b8c6 });
  m.brick = std({ ...tx.brick, roughness: 1, normalScale: V2(1.4), color: 0xc8bfc0 });
  m.shutter = std({ ...tx.shutter, roughness: 1, metalness: 0.55, normalScale: V2(1.1) });
  m.facade = std({
    map: tx.facade.map, normalMap: tx.facade.normalMap, roughnessMap: tx.facade.roughnessMap,
    emissiveMap: tx.facade.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.6,
    roughness: 1, color: 0xa4a8b6, normalScale: V2(1.2),
  });
  m.tower = std({
    map: tx.facade.map, emissiveMap: tx.facade.emissiveMap, emissive: 0xffffff,
    emissiveIntensity: 5, roughness: 0.7, color: 0x4a4c58,
  });

  const metalMaps = { map: tx.metal.map, roughnessMap: tx.metal.roughnessMap };
  m.metal = std({ ...metalMaps, roughness: 1, metalness: 0.85, color: 0x8a8f9a });
  m.metalDark = std({ ...metalMaps, roughness: 1, metalness: 0.8, color: 0x3a3d46 });
  m.metalLight = std({ ...metalMaps, roughness: 1, metalness: 0.35, color: 0xc4c8d0 });
  m.metalGreen = std({ ...metalMaps, roughness: 1, metalness: 0.5, color: 0x2c4a3a });
  m.metalRed = std({ ...metalMaps, roughness: 1, metalness: 0.4, color: 0xb0222c });
  m.acFront = std({ map: tx.acFront, roughness: 0.55, metalness: 0.3 });

  m.snow = std({ color: 0xe6ecff, roughness: 0.62, metalness: 0 });
  m.ice = std({ color: 0xd2ecff, roughness: 0.05, metalness: 0.1, envMapIntensity: 2.5, emissive: 0x0a1420 });
  m.trash = std({ color: 0x0c0c10, roughness: 0.16, metalness: 0, envMapIntensity: 1.6 });
  m.cable = std({ color: 0x050507, roughness: 0.5 });
  m.grate = std({ map: tx.grate.map, normalMap: tx.grate.normalMap, roughnessMap: tx.grate.roughnessMap, roughness: 1, metalness: 0.8 });
  m.glass = std({ color: 0x06080d, roughness: 0.04, metalness: 0.3, envMapIntensity: 2 });
  m.plasticBlue = std({ color: 0x1c4fd0, roughness: 0.4 });
  m.plasticRed = std({ color: 0xc81e32, roughness: 0.4 });
  m.plasticYellow = std({ color: 0xe8b416, roughness: 0.4 });

  const cache = new Map();
  m.strip = (hex, k = 5) => {
    const key = hex + ':' + k;
    if (!cache.has(key)) cache.set(key, new THREE.MeshBasicMaterial({ color: hdr(hex, k) }));
    return cache.get(key);
  };
  m.lantern = new THREE.MeshBasicMaterial({ color: hdr('#ff5a24', 3.2) });
  m.beacon = new THREE.MeshBasicMaterial({ color: hdr('#ff2020', 10) });
  m.blink = new THREE.MeshBasicMaterial({ color: hdr('#ff8a1c', 6) });
  m.blinkBase = m.blink.color.clone();

  const basicMap = (map, k) => new THREE.MeshBasicMaterial({ map, color: new THREE.Color(k, k, k) });
  m.shopRamen = basicMap(tx.shopRamen, 1.5);
  m.shopBar = basicMap(tx.shopBar, 1.6);
  m.shopMart = basicMap(tx.shopMart, 1.4);
  m.vending = basicMap(tx.vending, 1.7);
  m.ads = tx.ads.map((t) => basicMap(t, 2.6));
  return m;
}
