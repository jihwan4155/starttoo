import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

// https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker
const WRIST = 0;
const MIDDLE_FINGER_MCP = 9;

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Directed image-space angle (degrees) of the forearm axis, pointing from
 * the hand toward the elbow. The marker detector classifies line segments
 * relative to this axis (stem runs along it, bars across it) so a rotated
 * arm — the normal case on camera — still reads as an upright I. */
export function computeForearmAxisAngleDeg(
	landmarks: NormalizedLandmark[],
	canvasWidth: number,
	canvasHeight: number
): number | null {
	const wrist = landmarks[WRIST];
	const middleMcp = landmarks[MIDDLE_FINGER_MCP];
	if (!wrist || !middleMcp) return null;

	const dx = (wrist.x - middleMcp.x) * canvasWidth;
	const dy = (wrist.y - middleMcp.y) * canvasHeight;
	if (Math.hypot(dx, dy) < 1) return null;

	return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/**
 * The marker/tattoo sits on the forearm, past the wrist — MediaPipe's 21
 * hand landmarks stop at the wrist and never cover the forearm itself. So
 * instead of a bounding box around the hand, project outward from the
 * wrist, away from the fingers, to estimate where the forearm is and only
 * search for the marker there (cuts out background false positives too).
 */
export function computeForearmSearchRegion(
	landmarks: NormalizedLandmark[],
	canvasWidth: number,
	canvasHeight: number
): Rect | null {
	const wrist = landmarks[WRIST];
	const middleMcp = landmarks[MIDDLE_FINGER_MCP];
	if (!wrist || !middleMcp) return null;

	const wristPx = { x: wrist.x * canvasWidth, y: wrist.y * canvasHeight };
	const middlePx = {
		x: middleMcp.x * canvasWidth,
		y: middleMcp.y * canvasHeight,
	};

	const dx = wristPx.x - middlePx.x;
	const dy = wristPx.y - middlePx.y;
	const handLength = Math.hypot(dx, dy);
	if (handLength < 1) return null;

	const dirX = dx / handLength;
	const dirY = dy / handLength;

	// The marker can sit directly on the wrist or a little farther up the
	// forearm. Build a generous axis-aligned box around that projected strip.
	// It is still much smaller than the whole frame, so desks and keyboards no
	// longer compete with the marker detector.
	const nearDistance = -handLength * 0.3;
	const farDistance = handLength * 3.1;
	const halfWidth = handLength * 1.05;
	const normalX = -dirY;
	const normalY = dirX;
	const stripCorners = [
		{
			x: wristPx.x + dirX * nearDistance + normalX * halfWidth,
			y: wristPx.y + dirY * nearDistance + normalY * halfWidth,
		},
		{
			x: wristPx.x + dirX * nearDistance - normalX * halfWidth,
			y: wristPx.y + dirY * nearDistance - normalY * halfWidth,
		},
		{
			x: wristPx.x + dirX * farDistance + normalX * halfWidth,
			y: wristPx.y + dirY * farDistance + normalY * halfWidth,
		},
		{
			x: wristPx.x + dirX * farDistance - normalX * halfWidth,
			y: wristPx.y + dirY * farDistance - normalY * halfWidth,
		},
	];

	const minimumX = Math.max(
		0,
		Math.min(...stripCorners.map((point) => point.x))
	);
	const minimumY = Math.max(
		0,
		Math.min(...stripCorners.map((point) => point.y))
	);
	const maximumX = Math.min(
		canvasWidth,
		Math.max(...stripCorners.map((point) => point.x))
	);
	const maximumY = Math.min(
		canvasHeight,
		Math.max(...stripCorners.map((point) => point.y))
	);
	const x = minimumX;
	const y = minimumY;
	const width = maximumX - minimumX;
	const height = maximumY - minimumY;

	if (width < 10 || height < 10) return null;

	return {
		x: Math.round(x),
		y: Math.round(y),
		width: Math.round(width),
		height: Math.round(height),
	};
}
