import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { applyCameraViewport, createCamera, updateCameraFocus } from "./scripts/camera";
import { buildBoard } from "./scripts/map";
import { createPlayer } from "./scripts/player";

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
const gameOverLabel = "how could you do that, play again";
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get("hard") === "1") {
	urlParams.delete("hard");
	urlParams.delete("mode");
	urlParams.delete("size");
	const cleanUrl = new URL(window.location.href);
	cleanUrl.search = urlParams.toString();
	window.history.replaceState({}, "", cleanUrl.toString());
} else if (urlParams.get("mode") !== "hard") {
	if (urlParams.has("size") || urlParams.has("mode")) {
		urlParams.delete("size");
		urlParams.delete("mode");
		const cleanUrl = new URL(window.location.href);
		cleanUrl.search = urlParams.toString();
		window.history.replaceState({}, "", cleanUrl.toString());
	}
}
if (restartButton) {
	restartButton.textContent = restartLabel;
	restartButton.addEventListener("click", () => {
		const url = new URL(window.location.href);
		url.searchParams.delete("mode");
		url.searchParams.delete("size");
		window.location.href = url.toString();
	});
}

if (hardButton) {
	hardButton.addEventListener("click", () => {
		const url = new URL(window.location.href);
		url.searchParams.set("mode", "hard");
		url.searchParams.set("hard", "1");
		url.searchParams.set("size", "12");
		window.location.href = url.toString();
	});
}

const ambient = new THREE.AmbientLight(0xffe9f1, 0.85);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xfff0e6, 1.0);
dirLight.position.set(8, 14, 6);
scene.add(dirLight);

const TILE_SIZE = 1;
const board = buildBoard(scene, TILE_SIZE);
const heartGoal = board.goalMarkers.find((goal) => goal.type === "heart") ?? null;
const sadGoal = board.goalMarkers.find((goal) => goal.type === "sad") ?? null;
let zoomT = 0;
let hasGameOver = false;
let hasWon = false;
const gameOverSound = new Audio("/audio/game_over.wav");
const victorySound = new Audio("/audio/victory.wav");
const jumpSound = new Audio("/audio/jump.wav");
const musicLoop = new Audio("/audio/game_music_loop.wav");
musicLoop.loop = true;
musicLoop.volume = 0.4;
jumpSound.volume = 0.6;
victorySound.volume = 0.75;
gameOverSound.volume = 0.75;
let hasStartedMusic = false;
const sadEmojis = new THREE.Group();
sadEmojis.visible = false;
scene.add(sadEmojis);
const sadEmojiCount = 18;

const modelLoader = new GLTFLoader();
modelLoader.load(
	"/model/sad_emoji.glb",
	(gltf) => {
		const template = gltf.scene;
		const box = new THREE.Box3().setFromObject(template);
		const size = new THREE.Vector3();
		box.getSize(size);
		const desiredHeight = TILE_SIZE * 1.6;
		const scale = size.y > 0 ? desiredHeight / size.y : 1;
		const tint = new THREE.Color(0x3b82f6);
		const spread = TILE_SIZE * 4.8;

		for (let i = 0; i < sadEmojiCount; i++) {
			const emoji = template.clone(true);
			emoji.scale.setScalar(scale * (0.75 + Math.random() * 0.7));
			emoji.position.set(
				(Math.random() - 0.5) * spread * 2,
				TILE_SIZE * (0.5 + Math.random() * 1.2),
				(Math.random() - 0.5) * spread * 2
			);
			emoji.rotation.y = Math.random() * Math.PI * 2;
			emoji.traverse((child) => {
				if (child instanceof THREE.Mesh) {
					if (Array.isArray(child.material)) {
						child.material = child.material.map((material) => {
							const next = material.clone();
							if ("color" in next && next.color) {
								next.color.set(tint);
							}
							if ("emissive" in next && next.emissive) {
								next.emissive.set(0x0b1d47);
							}
							return next;
						});
					} else {
						const next = child.material.clone();
						if ("color" in next && next.color) {
							next.color.set(tint);
						}
						if ("emissive" in next && next.emissive) {
							next.emissive.set(0x0b1d47);
						}
						child.material = next;
					}
				}
			});
			sadEmojis.add(emoji);
		}
	},
	undefined,
	(error) => {
		console.warn("Failed to load sad emoji model", error);
	}
);

const player = createPlayer(board.group, TILE_SIZE, {
	modelUrl: "/model/player.glb",
	onMoveStart: () => {
		if (!hasStartedMusic) {
			hasStartedMusic = true;
			musicLoop.play().catch(() => undefined);
		}
		jumpSound.currentTime = 0;
		jumpSound.play().catch(() => undefined);
	},
	onMoveComplete: (pos) => {
		if (hasGameOver || hasWon) {
			return;
		}

		if (sadGoal && pos.x === sadGoal.gridX && pos.y === sadGoal.gridY) {
			hasGameOver = true;
			board.group.visible = false;
			sadEmojis.visible = true;
			document.body.classList.add("game-over");
			if (titleElement) {
				titleElement.textContent = "how could you do that";
			}
			gameOverSound.currentTime = 0;
			gameOverSound.play().catch(() => undefined);
			if (restartButton) {
				restartButton.textContent = "play again";
				restartButton.classList.remove("is-hidden");
			}
			hardButton?.classList.add("is-hidden");
			return;
		}

		if (heartGoal && pos.x === heartGoal.gridX && pos.y === heartGoal.gridY) {
			hasWon = true;
			heartGoal.group.visible = false;
			player.startDance();
			victorySound.currentTime = 0;
			victorySound.play().catch(() => undefined);
			if (titleElement) {
				titleElement.textContent = "I love you";
			}
			if (restartButton) {
				restartButton.textContent = "play again";
				restartButton.classList.remove("is-hidden");
			}
			hardButton?.classList.remove("is-hidden");
		}
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
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(width, height);
	applyCameraViewport(camera, width, height);
}

onResize();
animate();

window.addEventListener("resize", onResize);
