import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export const BOARD_ROTATION_Y = Math.PI / 4;

export const POLE_DIMENSIONS = {
  height: 1.5,
  width: 1.0,
};

const DEFAULT_MAP_SIZE = 10;

function getMapSizeFromUrl() {
  if (typeof window === "undefined") {
    return DEFAULT_MAP_SIZE;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get("mode") !== "hard" || params.get("hard") !== "1") {
    return DEFAULT_MAP_SIZE;
  }
  const sizeParam = params.get("size");
  const parsed = sizeParam ? Number(sizeParam) : NaN;
  const size = Number.isFinite(parsed) ? Math.floor(parsed) : DEFAULT_MAP_SIZE;
  return Math.max(5, size);
}

const MAP_SIZE = getMapSizeFromUrl();

export const MAP = generateMaze(MAP_SIZE, MAP_SIZE);

export type WallCell = { x: number; y: number };

export function getColumnTopY(x: number, y: number, tileSize: number) {
  const tile = MAP[y]?.[x];
  if (tile !== 1 && tile !== 2 && tile !== 3) {
    return null;
  }

  if (tile === 2 || tile === 3) {
    return getGoalColumnHeight(tileSize);
  }

  return getPoleHeight(tileSize);
}

function puffNoise(x: number, z: number) {
  const v = Math.sin(x * 3.17 + z * 4.29) * 43758.5453;
  return v - Math.floor(v);
}


function getPoleHeight(tileSize: number) {
  return tileSize * POLE_DIMENSIONS.height;
}

function getPoleWidth(tileSize: number) {
  return tileSize * POLE_DIMENSIONS.width;
}

function getGoalColumnHeight(tileSize: number) {
  return getPoleHeight(tileSize) * 1.2;
}

function shuffle<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }

  return items;
}

function generateMaze(rows: number, cols: number) {
  const start = { x: 1, y: 1 };

  while (true) {
    const map = Array.from({ length: rows }, () => Array(cols).fill(0));

    const inBounds = (x: number, y: number) => x > 0 && y > 0 && x < cols - 1 && y < rows - 1;
    const directions = [
      { x: 0, y: -2 },
      { x: 2, y: 0 },
      { x: 0, y: 2 },
      { x: -2, y: 0 },
    ];

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

    const secondGoal = findDeadEndCellOffPath(map, start, goal ?? start);
    if (secondGoal) {
      map[secondGoal.y][secondGoal.x] = 3;
      return map;
    }
  }
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

function findDeadEndCellOffPath(
  map: number[][],
  start: { x: number; y: number },
  goal: { x: number; y: number },
) {
  const path = findPathCells(map, start, goal);
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  const deadEnds: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (map[y][x] !== 1) {
        continue;
      }

      if (x === goal.x && y === goal.y) {
        continue;
      }

      if (path.has(cellKey(x, y))) {
        continue;
      }

      const neighbors = countOpenNeighbors(map, x, y);
      if (neighbors === 1) {
        deadEnds.push({ x, y });
      }
    }
  }

  if (deadEnds.length > 0) {
    const index = Math.floor(Math.random() * deadEnds.length);
    return deadEnds[index];
  }

  // Require a dead-end off the main path for the secondary goal.
  return null;
}

function pickRandomCell(candidates: Array<{ x: number; y: number }>) {
  if (candidates.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}

function pickRandomOpenCell(map: number[][], exclude: { x: number; y: number }) {
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  const candidates: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (map[y][x] !== 1) {
        continue;
      }

      if (x === exclude.x && y === exclude.y) {
        continue;
      }

      candidates.push({ x, y });
    }
  }

  return pickRandomCell(candidates);
}

function findPathCells(
  map: number[][],
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  const distances = Array.from({ length: rows }, () => Array(cols).fill(-1));
  const parents = Array.from({ length: rows }, () => Array(cols).fill(null as { x: number; y: number } | null));
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

    if (current.x === end.x && current.y === end.y) {
      break;
    }

    for (const dir of dirs) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) {
        continue;
      }

      if (!isOpenCell(map[ny][nx]) || distances[ny][nx] !== -1) {
        continue;
      }

      distances[ny][nx] = distances[current.y][current.x] + 1;
      parents[ny][nx] = current;
      queue.push({ x: nx, y: ny });
    }
  }

  const path = new Set<string>();
  let node: { x: number; y: number } | null = end;
  while (node) {
    path.add(cellKey(node.x, node.y));
    if (node.x === start.x && node.y === start.y) {
      break;
    }
    node = parents[node.y][node.x];
  }

  return path;
}

function countOpenNeighbors(map: number[][], x: number, y: number) {
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  let count = 0;
  const dirs = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];

  for (const dir of dirs) {
    const nx = x + dir.x;
    const ny = y + dir.y;
    if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) {
      continue;
    }

    if (isOpenCell(map[ny][nx])) {
      count += 1;
    }
  }

  return count;
}

function isOpenCell(tile: number) {
  return tile === 1 || tile === 2;
}

function cellKey(x: number, y: number) {
  return `${x},${y}`;
}

export function buildBoard(scene: THREE.Scene, tileSize: number) {
  const walls: WallCell[] = [];
  const rotatingEmojis: THREE.Object3D[] = [];
  const boardGroup = new THREE.Group();
  boardGroup.rotation.y = BOARD_ROTATION_Y;

  const goalHeight = getGoalColumnHeight(tileSize);
  const goalColumnGeo = new THREE.CylinderGeometry(tileSize * 0.18, tileSize * 0.2, goalHeight, 20);

  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xf7f7ff,
    roughness: 0.9,
    metalness: 0.0,
    emissive: 0x0f0f18,
  });
  const goalMat = new THREE.MeshStandardMaterial({
    color: 0xe11d2e,
    roughness: 0.4,
    metalness: 0.15,
    emissive: 0x2a0308,
  });
  const altGoalMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.4,
    metalness: 0.15,
    emissive: 0x0b1b3a,
  });

  const rows = MAP.length;
  const cols = MAP[0]?.length ?? 0;
  const offsetX = ((cols - 1) * tileSize) / 2;
  const offsetZ = ((rows - 1) * tileSize) / 2;
  const boardWidth = (cols - 1) * tileSize;
  const boardDepth = (rows - 1) * tileSize;
  const cloudRadius = Math.max(boardWidth, boardDepth) * 0.6 + tileSize * 0.6;
  const cloudYOffset = -0.18;
  const cloudGroup = new THREE.Group();
  const cloudTop = new THREE.Mesh(new THREE.CircleGeometry(cloudRadius, 40), cloudMat);
  cloudTop.rotation.x = -Math.PI / 2;
  cloudTop.position.y = cloudYOffset;
  cloudGroup.add(cloudTop);

  const haloCanvas = document.createElement("canvas");
  haloCanvas.width = 256;
  haloCanvas.height = 256;
  const haloCtx = haloCanvas.getContext("2d");
  if (haloCtx) {
    const gradient = haloCtx.createRadialGradient(128, 128, 12, 128, 128, 122);
    gradient.addColorStop(0, "rgba(255, 248, 251, 0.55)");
    gradient.addColorStop(0.6, "rgba(255, 220, 232, 0.22)");
    gradient.addColorStop(1, "rgba(255, 220, 232, 0)");
    haloCtx.fillStyle = gradient;
    haloCtx.fillRect(0, 0, haloCanvas.width, haloCanvas.height);
  }
  const haloTexture = new THREE.CanvasTexture(haloCanvas);
  const haloMat = new THREE.MeshBasicMaterial({
    map: haloTexture,
    transparent: true,
    depthWrite: false,
  });
  const haloRadius = cloudRadius * 1.1;
  const halo = new THREE.Mesh(new THREE.CircleGeometry(haloRadius, 64), haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = cloudYOffset - 0.02;
  cloudGroup.add(halo);

  const sparkleMat = new THREE.MeshBasicMaterial({
    color: 0xffe6ef,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  const sparkleGeo = new THREE.CircleGeometry(tileSize * 0.12, 16);
  const sparkleCount = 16;
  for (let i = 0; i < sparkleCount; i++) {
    const angle = (i / sparkleCount) * Math.PI * 2 + Math.random() * 0.3;
    const radius = cloudRadius * (1.02 + Math.random() * 0.22);
    const sparkle = new THREE.Mesh(sparkleGeo, sparkleMat);
    sparkle.rotation.x = -Math.PI / 2;
    sparkle.position.set(
      Math.cos(angle) * radius,
      cloudYOffset + 0.05 + Math.random() * 0.08,
      Math.sin(angle) * radius
    );
    sparkle.scale.setScalar(0.7 + Math.random() * 0.6);
    cloudGroup.add(sparkle);
  }

  const puffGeo = new THREE.SphereGeometry(1, 18, 14);
  const puffStep = tileSize * 0.9;
  for (let z = -boardDepth * 0.6; z <= boardDepth * 0.6; z += puffStep) {
    for (let x = -boardWidth * 0.6; x <= boardWidth * 0.6; x += puffStep) {
      const dist = Math.hypot(x, z);
      if (dist > cloudRadius * 0.98) {
        continue;
      }

      const noise = puffNoise(x, z);
      const radius = tileSize * (0.35 + noise * 0.22);
      const puff = new THREE.Mesh(puffGeo, cloudMat);
      puff.scale.set(radius, radius * 0.65, radius);
      puff.position.set(x, cloudYOffset + noise * 0.08, z);
      cloudGroup.add(puff);
    }
  }

  boardGroup.add(cloudGroup);
  const wallPositions: Array<{ x: number; z: number }> = [];
  const goalEmojis: Array<{
    x: number;
    z: number;
    height: number;
    type: "heart" | "sad";
    group: THREE.Group;
  }> = [];
  const goalMarkers: Array<{
    type: "heart" | "sad";
    gridX: number;
    gridY: number;
    group: THREE.Group;
  }> = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const tile = MAP[y][x];
      const posX = x * tileSize - offsetX;
      const posZ = y * tileSize - offsetZ;

      if (tile === 1) {
        wallPositions.push({ x: posX, z: posZ });

        walls.push({ x, y });
      }

      if (tile === 2 || tile === 3) {
        const goalColumn = new THREE.Mesh(goalColumnGeo, tile === 2 ? goalMat : altGoalMat);
        goalColumn.position.set(posX, goalHeight * 0.5, posZ);
        boardGroup.add(goalColumn);
        const emojiGroup = new THREE.Group();
        emojiGroup.position.set(posX, 0, posZ);
        boardGroup.add(emojiGroup);
        rotatingEmojis.push(emojiGroup);
        goalEmojis.push({
          x: posX,
          z: posZ,
          height: goalHeight,
          type: tile === 2 ? "heart" : "sad",
          group: emojiGroup,
        });
        goalMarkers.push({
          type: tile === 2 ? "heart" : "sad",
          gridX: x,
          gridY: y,
          group: emojiGroup,
        });
      }
    }
  }

  const loader = new GLTFLoader();

  if (wallPositions.length > 0) {
    loader.load(
      "/model/pole.glb",
      (gltf) => {
        const template = gltf.scene;
        const box = new THREE.Box3().setFromObject(template);
        const size = new THREE.Vector3();
        box.getSize(size);

        const desiredHeight = getPoleHeight(tileSize);
        const desiredWidth = getPoleWidth(tileSize);
        const scaleY = size.y > 0 ? desiredHeight / size.y : 1;
        const scaleX = size.x > 0 ? desiredWidth / size.x : scaleY;
        const scaleZ = size.z > 0 ? desiredWidth / size.z : scaleY;
        const scaledMinY = box.min.y * scaleY;

        for (const pos of wallPositions) {
          const pole = template.clone(true);
          pole.scale.set(scaleX, scaleY, scaleZ);
          pole.position.set(pos.x, -scaledMinY, pos.z);
          boardGroup.add(pole);
        }
      },
      undefined,
      (error) => {
        console.warn("Failed to load pole model", error);
      }
    );
  }

  const emojiTargetHeight = tileSize * 0.9;
  const emojiConfigs = [
    { type: "heart" as const, url: "/model/heart_emoji.glb" },
    { type: "sad" as const, url: "/model/sad_emoji.glb" },
  ];

  for (const config of emojiConfigs) {
    if (!goalEmojis.some((goal) => goal.type === config.type)) {
      continue;
    }

    loader.load(
      config.url,
      (gltf) => {
        const template = gltf.scene;
        const box = new THREE.Box3().setFromObject(template);
        const size = new THREE.Vector3();
        box.getSize(size);

        const scale = size.y > 0 ? emojiTargetHeight / size.y : 1;
        const minY = box.min.y * scale;

        for (const goal of goalEmojis) {
          if (goal.type !== config.type) {
            continue;
          }

          const emoji = template.clone(true);
          emoji.scale.setScalar(scale);
          emoji.position.set(0, goal.height - minY, 0);
          goal.group.add(emoji);
        }
      },
      undefined,
      (error) => {
        console.warn(`Failed to load ${config.type} emoji`, error);
      }
    );
  }

  scene.add(boardGroup);

  return { walls, group: boardGroup, rotatingEmojis, goalMarkers };
}
