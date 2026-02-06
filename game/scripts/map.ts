import * as THREE from "three";

export const BOARD_ROTATION_Y = Math.PI / 4;

export const MAP = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1],
  [1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1],
  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 2, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

export type WallCell = { x: number; y: number };

export function getColumnTopY(x: number, y: number, tileSize: number) {
  if (MAP[y]?.[x] !== 1) {
    return null;
  }

  const blockSize = tileSize * 0.8;
  const blockGap = tileSize * 0.01;
  const heightJitter = 0.85 + tileNoise(x, y) * 0.35;
  const columnHeight = tileSize * 1.4 * heightJitter;
  const blockStep = blockSize + blockGap;
  const blockCount = Math.max(4, Math.floor(columnHeight / blockStep));

  return blockSize + (blockCount - 1) * blockStep;
}

function tileNoise(x: number, y: number) {
  const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

export function buildBoard(scene: THREE.Scene, tileSize: number) {
  const walls: WallCell[] = [];
  const boardGroup = new THREE.Group();
  boardGroup.rotation.y = BOARD_ROTATION_Y;

  const floorGeo = new THREE.BoxGeometry(tileSize, 0.08, tileSize);
  const blockSize = tileSize * 0.8;
  const blockGap = tileSize * 0.01;
  const blockGeo = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
  const goalBaseGeo = new THREE.BoxGeometry(tileSize * 0.5, 0.18, tileSize * 0.32);
  const goalLidGeo = new THREE.BoxGeometry(tileSize * 0.52, 0.12, tileSize * 0.34);
  const goalBandGeo = new THREE.BoxGeometry(tileSize * 0.06, 0.16, tileSize * 0.36);

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xf7f3f8,
    roughness: 0.95,
    metalness: 0.02,
  });
  const blockMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.9,
    metalness: 0.05,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd4a33a,
    roughness: 0.35,
    metalness: 0.8,
    emissive: 0x241a08,
  });
  const goalMat = new THREE.MeshStandardMaterial({
    color: 0xf1a6bf,
    roughness: 0.6,
    metalness: 0.2,
    emissive: 0x2b0b18,
  });

  const rows = MAP.length;
  const cols = MAP[0]?.length ?? 0;
  const offsetX = ((cols - 1) * tileSize) / 2;
  const offsetZ = ((rows - 1) * tileSize) / 2;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const tile = MAP[y][x];
      const posX = x * tileSize - offsetX;
      const posZ = y * tileSize - offsetZ;

      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.position.set(posX, -0.04, posZ);
      boardGroup.add(floor);

      if (tile === 1) {
        const wallGroup = new THREE.Group();
        const heightJitter = 0.85 + tileNoise(x, y) * 0.35;
        const columnHeight = tileSize * 1.4 * heightJitter;
        const blockStep = blockSize + blockGap;
        const blockCount = Math.max(4, Math.floor(columnHeight / blockStep));

        for (let i = 0; i < blockCount; i++) {
          const block = new THREE.Mesh(blockGeo, blockMat);
          block.position.set(0, blockSize * 0.5 + i * blockStep, 0);
          wallGroup.add(block);
        }

        wallGroup.position.set(posX, 0, posZ);
        boardGroup.add(wallGroup);

        walls.push({ x, y });
      }

      if (tile === 2) {
        const goalGroup = new THREE.Group();
        const base = new THREE.Mesh(goalBaseGeo, goalMat);
        base.position.y = 0.1;
        goalGroup.add(base);

        const band = new THREE.Mesh(goalBandGeo, goldMat);
        band.position.y = 0.1;
        goalGroup.add(band);

        const lid = new THREE.Mesh(goalLidGeo, goalMat);
        lid.position.y = 0.22;
        lid.rotation.x = -0.15;
        goalGroup.add(lid);

        goalGroup.position.set(posX, 0, posZ);
        boardGroup.add(goalGroup);
      }
    }
  }

  scene.add(boardGroup);

  return { walls, group: boardGroup };
}
