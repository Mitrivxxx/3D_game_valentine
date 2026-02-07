import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { BOARD_ROTATION_Y, MAP, getColumnTopY } from "./map";

type GridPos = { x: number; y: number };

type PlayerController = {
  mesh: THREE.Mesh;
  update: (delta: number) => void;
  getGridPosition: () => GridPos;
  getWorldPosition: () => THREE.Vector3;
  setGridPosition: (x: number, y: number) => void;
  startDance: () => void;
  faceCamera: (cameraPosition: THREE.Vector3) => void;
  isDancing: () => boolean;
  dispose: () => void;
};

const MOVE_KEYS: Record<string, { x: number; z: number }> = {
  ArrowUp: { x: 0, z: -1 },
  ArrowDown: { x: 0, z: 1 },
  ArrowLeft: { x: -1, z: 0 },
  ArrowRight: { x: 1, z: 0 },
};

const SWIPE_THRESHOLD = 24;
const SWIPE_AXIS_RATIO = 1.2;

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

function gridToWorld(pos: GridPos, tileSize: number, yOffset: number) {
  const rows = MAP.length;
  const cols = MAP[0]?.length ?? 0;
  const offsetX = ((cols - 1) * tileSize) / 2;
  const offsetZ = ((rows - 1) * tileSize) / 2;
  const baseX = pos.x * tileSize - offsetX;
  const baseZ = pos.y * tileSize - offsetZ;
  const topY = getColumnTopY(pos.x, pos.y, tileSize) ?? 0;

  return {
    x: baseX,
    y: topY + yOffset,
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

type PlayerOptions = {
  modelUrl?: string;
  onMoveStart?: (pos: GridPos) => void;
  onMoveComplete?: (pos: GridPos) => void;
};

function createDanceEmote(size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "200px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
    ctx.fillText("💖💗💘", canvas.width / 2, canvas.height / 2 - 70);
    ctx.fillText("💝💞💓", canvas.width / 2, canvas.height / 2 + 40);

    ctx.font = "64px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
    ctx.fillText("I LOVE YOU", canvas.width / 2, canvas.height / 2 + 160);
  }

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(size * 2.2);
  sprite.visible = false;

  return sprite;
}

export function createPlayer(
  parent: THREE.Object3D,
  tileSize: number,
  options: PlayerOptions = {}
): PlayerController {
  const start = findFirstWalkable() ?? { x: 0, y: 0 };
  let gridPos: GridPos = { ...start };
  let yOffset = tileSize * 0.28;

  const radius = tileSize * 0.28;
  const geometry = new THREE.SphereGeometry(radius, 32, 24);
  const material = new THREE.MeshStandardMaterial({
    color: 0xe63946,
    roughness: 0.35,
    metalness: 0.1,
    emissive: 0x2b0408,
  });

  const mesh = new THREE.Mesh(geometry, material);
  const world = gridToWorld(gridPos, tileSize, yOffset);
  mesh.position.set(world.x, world.y, world.z);
  parent.add(mesh);

  let root: THREE.Object3D = mesh;
  let mixer: THREE.AnimationMixer | null = null;
  let idleAction: THREE.AnimationAction | null = null;
  let jumpAction: THREE.AnimationAction | null = null;
  let danceAction: THREE.AnimationAction | null = null;
  let isMoving = false;
  let moveElapsed = 0;
  let moveDuration = 0.2;
  const jumpHeight = tileSize * 0.35;
  const moveFrom = new THREE.Vector3();
  const moveToTarget = new THREE.Vector3();
  const movePos = new THREE.Vector3();
  const modelFacingOffset = 0;
  let facingYaw = 0;
  let isDancing = false;
  let danceElapsed = 0;
  const danceBasePosition = new THREE.Vector3();
  const danceEmote = createDanceEmote(tileSize);
  parent.add(danceEmote);
  let touchStart: { x: number; y: number } | null = null;

  if (options.modelUrl) {
    const loader = new GLTFLoader();
    loader.load(
      options.modelUrl,
      (gltf) => {
        parent.remove(root);

        root = gltf.scene;
        parent.add(root);

        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        box.getSize(size);

        const desiredHeight = tileSize * 0.8;
        const scale = size.y > 0 ? desiredHeight / size.y : 1;
        root.scale.setScalar(scale);

        const scaledMinY = box.min.y * scale;
        yOffset = -scaledMinY;

        const updated = gridToWorld(gridPos, tileSize, yOffset);
        root.position.set(updated.x, updated.y, updated.z);
        root.rotation.y = facingYaw + modelFacingOffset;

        if (gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(root);
          const idleClip = gltf.animations.find((clip) => clip.name === "Idle") ?? gltf.animations[0];
          const jumpClip = gltf.animations.find((clip) => clip.name === "Jump") ?? gltf.animations[0];
          const danceClip = gltf.animations.find((clip) => /dance/i.test(clip.name)) ?? null;
          idleAction = mixer.clipAction(idleClip);
          jumpAction = mixer.clipAction(jumpClip);
          danceAction = danceClip ? mixer.clipAction(danceClip) : null;

          idleAction.loop = THREE.LoopRepeat;
          idleAction.play();
        }
      },
      undefined,
      (error) => {
        console.warn("Failed to load player model", error);
      }
    );
  }

  function isWalkable(pos: GridPos) {
    const tile = MAP[pos.y]?.[pos.x];
    return tile === 1 || tile === 2 || tile === 3;
  }

  function moveTo(pos: GridPos, moveDir?: GridPos) {
    if (isDancing) {
      return;
    }

    if (!isWalkable(pos)) {
      return;
    }

    options.onMoveStart?.({ ...pos });

    if (moveDir && (moveDir.x !== 0 || moveDir.y !== 0)) {
      facingYaw = Math.atan2(moveDir.x, moveDir.y);
      root.rotation.y = facingYaw + modelFacingOffset;
    }

    gridPos = { ...pos };
    const target = gridToWorld(gridPos, tileSize, yOffset);
    moveFrom.copy(root.position);
    moveToTarget.set(target.x, target.y, target.z);
    moveElapsed = 0;
    isMoving = true;

    if (jumpAction && idleAction && jumpAction !== idleAction) {
      idleAction.stop();
      jumpAction.reset();
      jumpAction.loop = THREE.LoopRepeat;
      jumpAction.clampWhenFinished = false;
      jumpAction.play();
      const clipDuration = jumpAction.getClip().duration;
      moveDuration = clipDuration > 0 ? Math.max(clipDuration, 0.2) : 0.35;
    } else {
      moveDuration = 0.2;
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.repeat || isMoving || isDancing) {
      return;
    }

    const worldDelta = MOVE_KEYS[event.key];
    if (!worldDelta) {
      return;
    }

    const delta = worldDeltaToGrid(worldDelta);
    const next = { x: gridPos.x + delta.x, y: gridPos.y + delta.y };
    moveTo(next, delta);
  }

  function handleTouchStart(event: TouchEvent) {
    if (event.touches.length !== 1) {
      touchStart = null;
      return;
    }

    const touch = event.touches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: TouchEvent) {
    if (!touchStart || isMoving || isDancing) {
      touchStart = null;
      return;
    }

    const touch = event.changedTouches[0];
    if (!touch) {
      touchStart = null;
      return;
    }

    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    touchStart = null;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (Math.max(absX, absY) < SWIPE_THRESHOLD) {
      return;
    }

    let worldDelta: { x: number; z: number } | null = null;
    if (absX > absY * SWIPE_AXIS_RATIO) {
      worldDelta = deltaX > 0 ? MOVE_KEYS.ArrowRight : MOVE_KEYS.ArrowLeft;
    } else if (absY > absX * SWIPE_AXIS_RATIO) {
      worldDelta = deltaY > 0 ? MOVE_KEYS.ArrowDown : MOVE_KEYS.ArrowUp;
    } else {
      return;
    }

    const delta = worldDeltaToGrid(worldDelta);
    const next = { x: gridPos.x + delta.x, y: gridPos.y + delta.y };
    moveTo(next, delta);
  }

  function handleTouchCancel() {
    touchStart = null;
  }

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("touchstart", handleTouchStart, { passive: true });
  window.addEventListener("touchend", handleTouchEnd);
  window.addEventListener("touchcancel", handleTouchCancel);

  return {
    mesh,
    update: (delta) => {
      if (isDancing) {
        danceElapsed += delta;
      }

      if (mixer) {
        mixer.update(delta);
      }

      if (isMoving) {
        moveElapsed += delta;
        const t = Math.min(moveElapsed / moveDuration, 1);
        movePos.lerpVectors(moveFrom, moveToTarget, t);
        const arc = jumpHeight * 4 * t * (1 - t);
        movePos.y += arc;
        root.position.copy(movePos);

        if (t >= 1) {
          isMoving = false;
          if (idleAction && jumpAction && idleAction !== jumpAction) {
            jumpAction.stop();
            idleAction.reset();
            idleAction.play();
          }
          options.onMoveComplete?.({ ...gridPos });
          if (isDancing) {
            danceBasePosition.copy(root.position);
          }
        }
      }

      if (isDancing && !isMoving) {
        const sway = Math.sin(danceElapsed * 6) * 0.35;
        const bob = Math.sin(danceElapsed * 9) * (tileSize * 0.04);
        root.rotation.y = facingYaw + modelFacingOffset + sway;
        root.position.copy(danceBasePosition);
        root.position.y += bob;
      }

      if (danceEmote.visible) {
        danceEmote.position.set(root.position.x, root.position.y + tileSize * 1.1, root.position.z);
        const pulse = 1 + Math.sin(danceElapsed * 7) * 0.08;
        danceEmote.scale.setScalar(tileSize * 1.4 * pulse);
      }
    },
    getGridPosition: () => ({ ...gridPos }),
    getWorldPosition: () => root.position.clone(),
    setGridPosition: (x, y) => moveTo({ x, y }),
    startDance: () => {
      if (isDancing) {
        return;
      }

      isDancing = true;
      danceElapsed = 0;
      isMoving = false;
      danceBasePosition.copy(root.position);
      danceEmote.visible = true;

      if (mixer && danceAction) {
        idleAction?.stop();
        jumpAction?.stop();
        danceAction.reset();
        danceAction.loop = THREE.LoopRepeat;
        danceAction.play();
      }
    },
    faceCamera: (cameraPosition) => {
      const dx = cameraPosition.x - root.position.x;
      const dz = cameraPosition.z - root.position.z;
      facingYaw = Math.atan2(dx, dz);
    },
    isDancing: () => isDancing,
    dispose: () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchCancel);
      geometry.dispose();
      material.dispose();
      danceEmote.material.dispose();
      if (danceEmote.material.map) {
        danceEmote.material.map.dispose();
      }
      parent.remove(danceEmote);
      if (root !== mesh) {
        root.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((childMaterial) => childMaterial.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      }
      parent.remove(root);
    },
  };
}
