import * as THREE from "three";
import { createCamera } from "./scripts/camera";
import { buildBoard } from "./scripts/map";
import { createPlayer } from "./scripts/player";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfaf7fb);
scene.fog = new THREE.Fog(0xfaf7fb, 10, 45);

const camera = createCamera();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambient = new THREE.AmbientLight(0xfff1f7, 0.8);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xfff7e8, 0.95);
dirLight.position.set(8, 14, 6);
scene.add(dirLight);

const TILE_SIZE = 1;
const board = buildBoard(scene, TILE_SIZE);
createPlayer(board.group, TILE_SIZE);

function animate() {
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});
