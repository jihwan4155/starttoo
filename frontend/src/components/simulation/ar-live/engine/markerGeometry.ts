// Port of the Android PoC's MarkerGeometry (Kotlin, OpenCV-free): sanity
// checks on the tracked/detected quad, and the ROI helper for periodic
// re-detection around the current track.

import type { Point } from "./markerDetect";
import type { Rect } from "./handRegion";

function distance(a: Point, b: Point): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

function polygonArea(corners: Point[]): number {
	let sum = 0;
	for (let i = 0; i < corners.length; i++) {
		const next = (i + 1) % corners.length;
		sum += corners[i].x * corners[next].y - corners[next].x * corners[i].y;
	}
	return Math.abs(sum) * 0.5;
}

/** Rejects degenerate quads: out-of-frame corners, extreme side ratios,
 * too-small/too-large area, or non-convex winding. Corner order is
 * TL, TR, BR, BL. */
export function isValidQuadrilateral(
	corners: Point[],
	width: number,
	height: number
): boolean {
	if (corners.length !== 4) return false;
	if (
		corners.some(
			(c) => c.x < 1 || c.x >= width - 1 || c.y < 1 || c.y >= height - 1
		)
	) {
		return false;
	}

	const edges = corners.map((c, i) => distance(c, corners[(i + 1) % 4]));
	const shortest = Math.min(...edges);
	const longest = Math.max(...edges);
	if (shortest < 10 || longest / shortest > 4.5) return false;

	const area = polygonArea(corners);
	const frameArea = width * height;
	if (area < Math.max(180, frameArea * 0.00045) || area > frameArea * 0.48)
		return false;

	// Convexity: all cross products must share a sign.
	let sign = 0;
	for (let i = 0; i < 4; i++) {
		const a = corners[i];
		const b = corners[(i + 1) % 4];
		const c = corners[(i + 2) % 4];
		const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
		if (Math.abs(cross) < 1e-3) return false;
		if (i === 0) sign = cross;
		else if (cross * sign < 0) return false;
	}
	return true;
}

/** Padded, frame-clamped bounding box around the corners — the ROI that
 * periodic re-detection searches instead of the whole frame. */
export function markerBoundingRect(
	corners: Point[],
	frameWidth: number,
	frameHeight: number,
	paddingRatio = 0.85
): Rect {
	const xs = corners.map((c) => c.x);
	const ys = corners.map((c) => c.y);
	const minX = Math.min(...xs);
	const maxX = Math.max(...xs);
	const minY = Math.min(...ys);
	const maxY = Math.max(...ys);
	const size = Math.max(maxX - minX, maxY - minY, 24);
	const padding = size * paddingRatio;
	const left = Math.min(
		Math.max(Math.floor(minX - padding), 0),
		frameWidth - 2
	);
	const top = Math.min(
		Math.max(Math.floor(minY - padding), 0),
		frameHeight - 2
	);
	const right = Math.min(
		Math.max(Math.ceil(maxX + padding), left + 2),
		frameWidth
	);
	const bottom = Math.min(
		Math.max(Math.ceil(maxY + padding), top + 2),
		frameHeight
	);
	return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Mean per-corner distance between two quads — the "movement" penalty used
 * to prefer a re-detection near the current track over a far-away one. */
export function meanCornerDistance(first: Point[], second: Point[]): number {
	if (first.length !== 4 || second.length !== 4) return Number.MAX_VALUE;
	let sum = 0;
	for (let i = 0; i < 4; i++) sum += distance(first[i], second[i]);
	return sum / 4;
}
