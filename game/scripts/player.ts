import * as THREE from "three";
import { BOARD_ROTATION_Y, MAP, getColumnTopY } from "./map";

type GridPos = { x: number; y: number };

type PlayerController = {
  mesh: THREE.Mesh;
  getGridPosition: () => GridPos;
  setGridPosition: (x: number, y: number) => void;
  dispose: () => void;
};

const MOVE_KEYS: Record<string, { x: number; z: number }> = {
  ArrowUp: { x: 0, z: -1 },
  ArrowDown: { x: 0, z: 1 },
  ArrowLeft: { x: -1, z: 0 },
  ArrowRight: { x: 1, z: 0 },
};

function worldDeltaToGrid(delta: { x: number; z: number }): GridPos {
  const cos = Math.cos(-BOARD_ROTATION_Y);
  const sin = Math.sin(-BOARD_ROTATION_Y);
  const localX = delta.x * cos - delta.z * sin;
  const localZ = delta.x * sin + delta.z * cos;

  if (Math.abs(localX) >= Math.abs(localZ)) {
    return { x: Math.sign(localX), y: 0 };
  }

  return { x: 0, y: Math.sign(localZ) };
}

function gridToWorld(pos: GridPos, tileSize: number, radius: number) {
  const rows = MAP.length;
  const cols = MAP[0]?.length ?? 0;
  const offsetX = ((cols - 1) * tileSize) / 2;
  const offsetZ = ((rows - 1) * tileSize) / 2;
  const baseX = pos.x * tileSize - offsetX;
  const baseZ = pos.y * tileSize - offsetZ;
  const topY = getColumnTopY(pos.x, pos.y, tileSize) ?? 0;

  return {
    x: baseX,
    y: topY + radius,
    z: baseZ,
  };
}

function findFirstWalkable(): GridPos | null {
  for (let y = 0; y < MAP.length; y++) {
    for (let x = 0; x < MAP[y].length; x++) {
      if (MAP[y][x] === 1) {
        return { x, y };
      }
    }
  }

  return null;
}

export function createPlayer(parent: THREE.Object3D, tileSize: number): PlayerController {
  const start = findFirstWalkable() ?? { x: 0, y: 0 };
  let gridPos: GridPos = { ...start };

  const radius = tileSize * 0.28;
  const geometry = new THREE.SphereGeometry(radius, 32, 24);
  const material = new THREE.MeshStandardMaterial({
    color: 0xe63946,
    roughness: 0.35,
    metalness: 0.1,
    emissive: 0x2b0408,
  });

  const mesh = new THREE.Mesh(geometry, material);
  const world = gridToWorld(gridPos, tileSize, radius);
  mesh.position.set(world.x, world.y, world.z);
  parent.add(mesh);

  function isWalkable(pos: GridPos) {
    return MAP[pos.y]?.[pos.x] === 1;
  }

  function moveTo(pos: GridPos) {
    if (!isWalkable(pos)) {
      return;
    }

    gridPos = { ...pos };
    const target = gridToWorld(gridPos, tileSize, radius);
    mesh.position.set(target.x, target.y, target.z);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.repeat) {
      return;
    }

    const worldDelta = MOVE_KEYS[event.key];
    if (!worldDelta) {
      return;
    }

    const delta = worldDeltaToGrid(worldDelta);
    const next = { x: gridPos.x + delta.x, y: gridPos.y + delta.y };
    moveTo(next);
  }

  window.addEventListener("keydown", handleKeyDown);

  return {
    mesh,
    getGridPosition: () => ({ ...gridPos }),
    setGridPosition: (x, y) => moveTo({ x, y }),
    dispose: () => {
      window.removeEventListener("keydown", handleKeyDown);
      geometry.dispose();
      material.dispose();
      parent.remove(mesh);
    },
  };
}
