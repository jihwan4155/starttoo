// Shared 2D point type for the marker-tracking pipeline.
//
// The original HoughLinesP-based single-file detector that lived here was
// replaced by a full port of the teammate's Android PoC (HybridKeyedITracker
// → src/keyedITracker.ts): LSD-style line layout + 4-way flipped template
// verification + forward/backward optical flow. Only this shared Point type
// survived, kept here so the many `import type { Point } from "./markerDetect"`
// sites didn't all have to change.

export interface Point {
	x: number;
	y: number;
}
