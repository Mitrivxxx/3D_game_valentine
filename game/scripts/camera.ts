import * as THREE from "three";
import { materialOpacity } from "three/examples/jsm/nodes/Nodes.js";

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

   camera.position.set(10, 13, 10);
  camera.lookAt(0, 0, 0);

  return camera;
}
