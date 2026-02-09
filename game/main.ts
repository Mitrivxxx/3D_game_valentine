import * as THREE from "three";
import { applyCameraViewport, createCamera, updateCameraFocus } from "./scripts/camera";
import { initGameSetup } from "./scripts/gameSetup";
import { createGamePlayer } from "./scripts/playerSetup";
import { loadSadEmojis } from "./scripts/sadEmojis";
import { buildHardModeUrl, buildRestartUrl, cleanupUrlSearchParams } from "./scripts/urlCleanup";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfde1ea);
scene.fog = new THREE.Fog(0xfde1ea, 10, 45);

const camera = createCamera();

const renderer = new THREE.WebGLRenderer({ antialias: true });
document.body.appendChild(renderer.domElement);

const restartButton = document.getElementById("restart-button");
const hardButton = document.getElementById("hard-button");
const titleElement = document.getElementById("game-title");
const restartLabel = "Zacznij od nowa";

cleanupUrlSearchParams();

if (restartButton) {
	restartButton.textContent = restartLabel;
	restartButton.addEventListener("click", () => {
			window.location.href = buildRestartUrl();
	});
}

if (hardButton) {
	hardButton.addEventListener("click", () => {
			window.location.href = buildHardModeUrl();
	});
}

const ambient = new THREE.AmbientLight(0xffe9f1, 0.85);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xfff0e6, 1.0);
dirLight.position.set(8, 14, 6);
scene.add(dirLight);

const { TILE_SIZE, board, heartGoal, sadGoal, sadEmojis, sadEmojiCount, audio } = initGameSetup(scene);
let zoomT = 0;
loadSadEmojis({
	group: sadEmojis,
	tileSize: TILE_SIZE,
	count: sadEmojiCount,
});

const player = createGamePlayer({
	board,
	tileSize: TILE_SIZE,
	audio,
	goals: {
		heartGoal,
		sadGoal,
	},
	sadEmojis,
	ui: {
		restartButton,
		hardButton,
		titleElement,
	},
});

const clock = new THREE.Clock();

function animate() {
	requestAnimationFrame(animate);
	const delta = clock.getDelta();
	player.update(delta);

	if (player.isDancing()) {
		player.faceCamera(camera.position);
		zoomT = Math.min(zoomT + delta * 0.8, 1);
	} else {
		zoomT = Math.max(zoomT - delta * 0.8, 0);
	}

	updateCameraFocus(camera, player.getWorldPosition(), zoomT);
	for (const emoji of board.rotatingEmojis) {
		emoji.rotation.y += delta * 1.4;
	}
	renderer.render(scene, camera);
}

function onResize() {
	const width = window.innerWidth;
	const height = Math.round(window.innerHeight * 0.75);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
	renderer.setSize(width, height);
	applyCameraViewport(camera, width, height);
}

onResize();
animate();

window.addEventListener("resize", onResize);
