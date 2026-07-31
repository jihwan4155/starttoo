import type { StateStorage } from "zustand/middleware";

/** persist 쓰기 debounce — 드래그 중 localStorage 직렬화 부담 완화 */
export function createDebouncedStorage(delayMs = 400): StateStorage {
	const timers = new Map<string, ReturnType<typeof setTimeout>>();

	return {
		getItem: (name) => localStorage.getItem(name),
		setItem: (name, value) => {
			const pending = timers.get(name);
			if (pending) clearTimeout(pending);
			timers.set(
				name,
				setTimeout(() => {
					timers.delete(name);
					localStorage.setItem(name, value);
				}, delayMs),
			);
		},
		removeItem: (name) => {
			const pending = timers.get(name);
			if (pending) clearTimeout(pending);
			timers.delete(name);
			localStorage.removeItem(name);
		},
	};
}
