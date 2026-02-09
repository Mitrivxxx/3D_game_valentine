export function cleanupUrlSearchParams(): void {
	const urlParams = new URLSearchParams(window.location.search);
	if (urlParams.get("hard") === "1") {
		urlParams.delete("hard");
		urlParams.delete("mode");
		urlParams.delete("size");
		const cleanUrl = new URL(window.location.href);
		cleanUrl.search = urlParams.toString();
		window.history.replaceState({}, "", cleanUrl.toString());
		return;
	}

	if (urlParams.get("mode") !== "hard") {
		if (urlParams.has("size") || urlParams.has("mode")) {
			urlParams.delete("size");
			urlParams.delete("mode");
			const cleanUrl = new URL(window.location.href);
			cleanUrl.search = urlParams.toString();
			window.history.replaceState({}, "", cleanUrl.toString());
		}
	}
}

export function buildRestartUrl(): string {
	const url = new URL(window.location.href);
	url.searchParams.delete("mode");
	url.searchParams.delete("size");
	return url.toString();
}

export function buildHardModeUrl(size = "12"): string {
	const url = new URL(window.location.href);
	url.searchParams.set("mode", "hard");
	url.searchParams.set("hard", "1");
	url.searchParams.set("size", size);
	return url.toString();
}
