import * as THREE from "three";

export const BOARD_ROTATION_Y = Math.PI / 4;

const MAP_ROWS = 12;
const MAP_COLS = 12;

export const MAP = generateMaze(MAP_ROWS, MAP_COLS);

export type WallCell = { x: number; y: number };

export function getColumnTopY(x: number, y: number, tileSize: number) {
  const tile = MAP[y]?.[x];
  if (tile !== 1 && tile !== 2 && tile !== 3) {
    return null;
  }

  if (tile === 2 || tile === 3) {
    return getGoalColumnHeight(tileSize);
  }

  const blockSize = tileSize * 0.8;
  const blockGap = tileSize * 0.01;
  const columnHeight = getColumnHeight(x, y, tileSize);
  const blockStep = blockSize + blockGap;
  const blockCount = Math.max(4, Math.floor(columnHeight / blockStep));

  return blockSize + (blockCount - 1) * blockStep;
}

function tileNoise(x: number, y: number) {
  const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function getColumnHeight(x: number, y: number, tileSize: number) {
  const heightJitter = 0.85 + tileNoise(x, y) * 0.35;
  return tileSize * 1.4 * heightJitter;
}

function getGoalColumnHeight(tileSize: number) {
  return tileSize * 4;
}

function shuffle<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }

  return items;
}

function generateMaze(rows: number, cols: number) {
  const map = Array.from({ length: rows }, () => Array(cols).fill(0));

  const inBounds = (x: number, y: number) => x > 0 && y > 0 && x < cols - 1 && y < rows - 1;
  const directions = [
    { x: 0, y: -2 },
    { x: 2, y: 0 },
    { x: 0, y: 2 },
    { x: -2, y: 0 },
  ];

  const start = { x: 1, y: 1 };

  function carve(x: number, y: number) {
    map[y][x] = 1;
    const shuffled = shuffle([...directions]);

    for (const dir of shuffled) {
      const nx = x + dir.x;
      const ny = y + dir.y;

      if (!inBounds(nx, ny) || map[ny][nx] !== 0) {
        continue;
      }

      const betweenX = x + dir.x / 2;
      const betweenY = y + dir.y / 2;
      map[betweenY][betweenX] = 1;
      carve(nx, ny);
    }
  }

  carve(start.x, start.y);

  const goal = findFarthestCell(map, start);
  if (goal) {
    map[goal.y][goal.x] = 2;
  }

  const secondGoal = findFarthestCell(map, goal ?? start);
  if (secondGoal) {
    map[secondGoal.y][secondGoal.x] = 3;
  }

  return map;
}

function findFarthestCell(map: number[][], start: { x: number; y: number }) {
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  const distances = Array.from({ length: rows }, () => Array(cols).fill(-1));
  const queue: Array<{ x: number; y: number }> = [];

  distances[start.y][start.x] = 0;
  queue.push(start);

  const dirs = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    for (const dir of dirs) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) {
        continue;
      }

      if (map[ny][nx] !== 1 || distances[ny][nx] !== -1) {
        continue;
      }

      distances[ny][nx] = distances[current.y][current.x] + 1;
      queue.push({ x: nx, y: ny });
    }
  }

  let best: { x: number; y: number } | null = null;
  let bestDistance = -1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const distance = distances[y][x];
      if (distance > bestDistance) {
        bestDistance = distance;
        best = { x, y };
      }
    }
  }

  return best;
}

export function buildBoard(scene: THREE.Scene, tileSize: number) {
  const walls: WallCell[] = [];
  const boardGroup = new THREE.Group();
  boardGroup.rotation.y = BOARD_ROTATION_Y;

  const floorGeo = new THREE.BoxGeometry(tileSize, 0.08, tileSize);
  const blockSize = tileSize * 0.8;
  const blockGap = tileSize * 0.01;
  const blockGeo = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
  const goalHeight = getGoalColumnHeight(tileSize);
  const goalColumnGeo = new THREE.CylinderGeometry(tileSize * 0.18, tileSize * 0.2, goalHeight, 20);

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
  const goalMat = new THREE.MeshStandardMaterial({
    color: 0xe11d2e,
    roughness: 0.4,
    metalness: 0.15,
    emissive: 0x2a0308,
  });
  const altGoalMat = new THREE.MeshStandardMaterial({
    color: 0x16a34a,
    roughness: 0.4,
    metalness: 0.15,
    emissive: 0x06240f,
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
        const columnHeight = getColumnHeight(x, y, tileSize);
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

      if (tile === 2 || tile === 3) {
        const goalColumn = new THREE.Mesh(goalColumnGeo, tile === 2 ? goalMat : altGoalMat);
        goalColumn.position.set(posX, goalHeight * 0.5, posZ);
        boardGroup.add(goalColumn);
      }
    }
  }

  scene.add(boardGroup);

  return { walls, group: boardGroup };
}
