import * as THREE from "three";
import { createPlayer } from "./player";
import type { GameAudio, GameSetup } from "./gameSetup";

type PlayerOptions = NonNullable<Parameters<typeof createPlayer>[2]>;
type MoveComplete = NonNullable<PlayerOptions["onMoveComplete"]>;
type GridPos = Parameters<MoveComplete>[0];

type PlayerUiRefs = {
	restartButton: HTMLElement | null;
	hardButton: HTMLElement | null;
	titleElement: HTMLElement | null;
};

type PlayerSetupOptions = {
	board: GameSetup["board"];
	tileSize: number;
	audio: GameAudio;
	goals: {
		heartGoal: GameSetup["heartGoal"];
		sadGoal: GameSetup["sadGoal"];
	};
	sadEmojis: THREE.Group;
	ui: PlayerUiRefs;
};

export function createGamePlayer({
	board,
	tileSize,
	audio,
	goals,
	sadEmojis,
	ui,
}: PlayerSetupOptions) {
	let hasGameOver = false;
	let hasWon = false;
	let player!: ReturnType<typeof createPlayer>;

	player = createPlayer(board.group, tileSize, {
		modelUrl: "/model/player.glb",
		onMoveStart: () => {
			if (!audio.hasStartedMusic) {
				audio.hasStartedMusic = true;
				audio.musicLoop.play().catch(() => undefined);
			}
			audio.jumpSound.currentTime = 0;
			audio.jumpSound.play().catch(() => undefined);
		},
		onMoveComplete: (pos: GridPos) => {
			if (hasGameOver || hasWon) {
				return;
			}

			if (goals.sadGoal && pos.x === goals.sadGoal.gridX && pos.y === goals.sadGoal.gridY) {
				hasGameOver = true;
				board.group.visible = false;
				sadEmojis.visible = true;
				document.body.classList.add("game-over");
				if (ui.titleElement) {
					ui.titleElement.textContent = "how could you do that";
				}
				audio.gameOverSound.currentTime = 0;
				audio.gameOverSound.play().catch(() => undefined);
				if (ui.restartButton) {
					ui.restartButton.textContent = "play again";
					ui.restartButton.classList.remove("is-hidden");
				}
				ui.hardButton?.classList.add("is-hidden");
				return;
			}

			if (goals.heartGoal && pos.x === goals.heartGoal.gridX && pos.y === goals.heartGoal.gridY) {
				hasWon = true;
				goals.heartGoal.group.visible = false;
				player.startDance();
				audio.victorySound.currentTime = 0;
				audio.victorySound.play().catch(() => undefined);
				if (ui.titleElement) {
					ui.titleElement.textContent = "I love you";
				}
				if (ui.restartButton) {
					ui.restartButton.textContent = "play again";
					ui.restartButton.classList.remove("is-hidden");
				}
				ui.hardButton?.classList.remove("is-hidden");
			}
		},
	});

	return player;
}
