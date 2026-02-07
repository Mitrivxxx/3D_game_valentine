import * as THREE from "three";

const BASE_CAMERA_POSITION = new THREE.Vector3(5.5, 11, 5.5);
const MOBILE_REFERENCE_WIDTH = 600;
const MOBILE_MAX_SCALE = 1.6;

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );

  //pozycja kamery i punkt na który patrzy
    // [x, y, z]
    // x-jak daleko jestem od mapy
    // y-jak wysoko jest kamera
    // z-obracam się wokół mapy

  applyCameraViewport(camera, window.innerWidth, window.innerHeight);

  return camera;
}

export function applyCameraViewport(
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const scale = Math.min(MOBILE_MAX_SCALE, Math.max(1, MOBILE_REFERENCE_WIDTH / safeWidth));
  const position = BASE_CAMERA_POSITION.clone().multiplyScalar(scale);

  camera.aspect = safeWidth / safeHeight;
  camera.position.copy(position);
  camera.userData.basePosition = position.clone();
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

export function updateCameraFocus(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  zoomT: number,
) {
  const basePosition =
    camera.userData.basePosition instanceof THREE.Vector3
      ? camera.userData.basePosition
      : camera.position.clone();
  const t = THREE.MathUtils.clamp(zoomT, 0, 1);
  const baseDistance = basePosition.length();
  const focusDistance = baseDistance * THREE.MathUtils.lerp(1, 0.45, t);
  const focusDirection = basePosition.clone().normalize();
  const focusPosition = target.clone().add(focusDirection.multiplyScalar(focusDistance));
  const lookAtPosition = new THREE.Vector3().lerpVectors(new THREE.Vector3(), target, t);

  camera.position.lerpVectors(basePosition, focusPosition, t);
  camera.lookAt(lookAtPosition);
}
