import * as THREE from "three";
import { buildBoard } from "./map";

const TILE_SIZE = 1;
const SAD_EMOJI_COUNT = 18;

export type GameAudio = {
	gameOverSound: HTMLAudioElement;
	victorySound: HTMLAudioElement;
	jumpSound: HTMLAudioElement;
	musicLoop: HTMLAudioElement;
	get hasStartedMusic(): boolean;
	set hasStartedMusic(value: boolean);
};

export type GameSetup = {
	TILE_SIZE: number;
	board: ReturnType<typeof buildBoard>;
	heartGoal: ReturnType<typeof buildBoard>["goalMarkers"][number] | null;
	sadGoal: ReturnType<typeof buildBoard>["goalMarkers"][number] | null;
	sadEmojis: THREE.Group;
	sadEmojiCount: number;
	audio: GameAudio;
};

function initAudio(): GameAudio {
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

	return {
		gameOverSound,
		victorySound,
		jumpSound,
		musicLoop,
		get hasStartedMusic() {
			return hasStartedMusic;
		},
		set hasStartedMusic(value: boolean) {
			hasStartedMusic = value;
		},
	};
}

function initSadEmojis(scene: THREE.Scene): THREE.Group {
	const sadEmojis = new THREE.Group();
	sadEmojis.visible = false;
	scene.add(sadEmojis);
	return sadEmojis;
}

export function initGameSetup(scene: THREE.Scene): GameSetup {
	const board = buildBoard(scene, TILE_SIZE);
	const heartGoal = board.goalMarkers.find((goal) => goal.type === "heart") ?? null;
	const sadGoal = board.goalMarkers.find((goal) => goal.type === "sad") ?? null;
	const sadEmojis = initSadEmojis(scene);
	const audio = initAudio();

	return {
		TILE_SIZE,
		board,
		heartGoal,
		sadGoal,
		sadEmojis,
		sadEmojiCount: SAD_EMOJI_COUNT,
		audio,
	};
}
