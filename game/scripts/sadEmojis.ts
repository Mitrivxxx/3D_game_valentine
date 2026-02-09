import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type SadEmojisOptions = {
	group: THREE.Group;
	tileSize: number;
	count: number;
	modelUrl?: string;
	tint?: THREE.ColorRepresentation;
	emissive?: THREE.ColorRepresentation;
	spreadMultiplier?: number;
	heightMultiplier?: number;
};

export function loadSadEmojis({
	group,
	tileSize,
	count,
	modelUrl = "/model/sad_emoji.glb",
	tint = 0x3b82f6,
	emissive = 0x0b1d47,
	spreadMultiplier = 4.8,
	heightMultiplier = 1.6,
}: SadEmojisOptions) {
	const modelLoader = new GLTFLoader();
	modelLoader.load(
		modelUrl,
		(gltf) => {
			const template = gltf.scene;
			const box = new THREE.Box3().setFromObject(template);
			const size = new THREE.Vector3();
			box.getSize(size);
			const desiredHeight = tileSize * heightMultiplier;
			const scale = size.y > 0 ? desiredHeight / size.y : 1;
			const spread = tileSize * spreadMultiplier;
			const tintColor = new THREE.Color(tint);

			for (let i = 0; i < count; i++) {
				const emoji = template.clone(true);
				emoji.scale.setScalar(scale * (0.75 + Math.random() * 0.7));
				emoji.position.set(
					(Math.random() - 0.5) * spread * 2,
					tileSize * (0.5 + Math.random() * 1.2),
					(Math.random() - 0.5) * spread * 2
				);
				emoji.rotation.y = Math.random() * Math.PI * 2;
				emoji.traverse((child) => {
					if (child instanceof THREE.Mesh) {
						if (Array.isArray(child.material)) {
							child.material = child.material.map((material) => {
								const next = material.clone();
								if ("color" in next && next.color) {
									next.color.set(tintColor);
								}
								if ("emissive" in next && next.emissive) {
									next.emissive.set(emissive);
								}
								return next;
							});
						} else {
							const next = child.material.clone();
							if ("color" in next && next.color) {
								next.color.set(tintColor);
							}
							if ("emissive" in next && next.emissive) {
								next.emissive.set(emissive);
							}
							child.material = next;
						}
					}
				});
				group.add(emoji);
			}
		},
		undefined,
		(error) => {
			console.warn("Failed to load sad emoji model", error);
		}
	);

	return group;
}
