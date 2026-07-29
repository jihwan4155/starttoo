/* eslint-disable @typescript-eslint/no-explicit-any */
import cvModule from "@techstark/opencv-js";

let readyPromise: Promise<any> | null = null;

/** @techstark/opencv-js's default export is sometimes a Promise, sometimes
 * the Emscripten module object itself (ready or not) — normalize all three
 * shapes into a single awaitable. See package README's "Basic Usage". */
export function waitForOpenCv(): Promise<any> {
	if (!readyPromise) {
		readyPromise = (async () => {
			const mod: any = cvModule;
			if (mod instanceof Promise) return mod;
			if (mod.Mat) return mod;
			await new Promise<void>((resolve) => {
				mod.onRuntimeInitialized = () => resolve();
			});
			return mod;
		})();
	}
	return readyPromise;
}
