/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Point } from "./markerDetect";

export interface TrackedPoints {
	topLeft: Point;
	topRight: Point;
	bottomLeft: Point;
	bottomRight: Point;
	fringeTip: Point;
}

function toFlatArray(pts: TrackedPoints): number[] {
	return [
		pts.topLeft.x,
		pts.topLeft.y,
		pts.topRight.x,
		pts.topRight.y,
		pts.bottomLeft.x,
		pts.bottomLeft.y,
		pts.bottomRight.x,
		pts.bottomRight.y,
		pts.fringeTip.x,
		pts.fringeTip.y,
	];
}

function fromFlatArray(arr: Float32Array): TrackedPoints {
	return {
		topLeft: { x: arr[0], y: arr[1] },
		topRight: { x: arr[2], y: arr[3] },
		bottomLeft: { x: arr[4], y: arr[5] },
		bottomRight: { x: arr[6], y: arr[7] },
		fringeTip: { x: arr[8], y: arr[9] },
	};
}

export interface FlowResult {
	points: TrackedPoints;
	/** Mean round-trip error (px): prev → curr → back-to-prev vs. original. */
	meanFbErrorPx: number;
}

export interface PointArrayFlowResult {
	points: Point[];
	meanFbErrorPx: number;
}

// Thresholds ported from the Android PoC's HybridKeyedITracker.
const MAX_PER_POINT_ERROR = 45;
const MAX_MEAN_FB_ERROR_PX = 1.8;

/**
 * Generic forward/backward LK tracker for a variable number of actual image
 * features. The smile marker uses all six stroke endpoints.
 */
export function trackPointArrayForwardBackward(
	cv: any,
	prevGray: any,
	currGray: any,
	previousPoints: Point[]
): PointArrayFlowResult | null {
	const pointCount = previousPoints.length;
	if (pointCount < 1) return null;
	const flat = previousPoints.flatMap((point) => [point.x, point.y]);
	const prevPtsMat = cv.matFromArray(pointCount, 1, cv.CV_32FC2, flat);
	const nextPtsMat = new cv.Mat();
	const forwardStatus = new cv.Mat();
	const forwardErr = new cv.Mat();
	const backPtsMat = new cv.Mat();
	const backStatus = new cv.Mat();
	const backErr = new cv.Mat();
	const winSize = new cv.Size(21, 21);
	const criteria = new cv.TermCriteria(
		cv.TermCriteria_COUNT + cv.TermCriteria_EPS,
		24,
		0.01
	);

	try {
		cv.calcOpticalFlowPyrLK(
			prevGray,
			currGray,
			prevPtsMat,
			nextPtsMat,
			forwardStatus,
			forwardErr,
			winSize,
			3,
			criteria
		);
		cv.calcOpticalFlowPyrLK(
			currGray,
			prevGray,
			nextPtsMat,
			backPtsMat,
			backStatus,
			backErr,
			winSize,
			3,
			criteria
		);

		if (
			forwardStatus.data.length < pointCount ||
			backStatus.data.length < pointCount
		)
			return null;
		const nextData = nextPtsMat.data32F as Float32Array;
		const backData = backPtsMat.data32F as Float32Array;
		const errorData = forwardErr.data32F as Float32Array;
		if (nextData.length < pointCount * 2 || backData.length < pointCount * 2)
			return null;

		let totalFbError = 0;
		const nextPoints: Point[] = [];
		for (let index = 0; index < pointCount; index++) {
			if (forwardStatus.data[index] === 0 || backStatus.data[index] === 0)
				return null;
			if (index < errorData.length && errorData[index] > MAX_PER_POINT_ERROR)
				return null;
			totalFbError += Math.hypot(
				backData[index * 2] - flat[index * 2],
				backData[index * 2 + 1] - flat[index * 2 + 1]
			);
			nextPoints.push({ x: nextData[index * 2], y: nextData[index * 2 + 1] });
		}
		const meanFbErrorPx = totalFbError / pointCount;
		if (meanFbErrorPx > MAX_MEAN_FB_ERROR_PX) return null;
		return { points: nextPoints, meanFbErrorPx };
	} finally {
		prevPtsMat.delete();
		nextPtsMat.delete();
		forwardStatus.delete();
		forwardErr.delete();
		backPtsMat.delete();
		backStatus.delete();
		backErr.delete();
	}
}

/**
 * Forward/backward pyramidal Lucas-Kanade (ported from the Android PoC):
 * tracks prev → curr, then curr → prev, and rejects the whole frame when the
 * round-trip lands too far from where it started. Plain forward LK follows
 * pixel patterns with no notion of correctness, so it drifts silently; the
 * backward pass turns drift into a measurable error. Returns null on any
 * unreliable point (status != 1), a large per-point error, or a mean
 * round-trip error above 1.8px — callers treat that as "re-detect".
 */
export function trackPointsForwardBackward(
	cv: any,
	prevGray: any,
	currGray: any,
	prevPoints: TrackedPoints
): FlowResult | null {
	const prevPtsMat = cv.matFromArray(
		5,
		1,
		cv.CV_32FC2,
		toFlatArray(prevPoints)
	);
	const nextPtsMat = new cv.Mat();
	const forwardStatus = new cv.Mat();
	const forwardErr = new cv.Mat();
	const backPtsMat = new cv.Mat();
	const backStatus = new cv.Mat();
	const backErr = new cv.Mat();
	const winSize = new cv.Size(21, 21);
	const criteria = new cv.TermCriteria(
		cv.TermCriteria_COUNT + cv.TermCriteria_EPS,
		24,
		0.01
	);

	try {
		cv.calcOpticalFlowPyrLK(
			prevGray,
			currGray,
			prevPtsMat,
			nextPtsMat,
			forwardStatus,
			forwardErr,
			winSize,
			3,
			criteria
		);
		cv.calcOpticalFlowPyrLK(
			currGray,
			prevGray,
			nextPtsMat,
			backPtsMat,
			backStatus,
			backErr,
			winSize,
			3,
			criteria
		);

		if (forwardStatus.rows !== 5 || backStatus.rows !== 5) return null;

		const prevFlat = toFlatArray(prevPoints);
		const nextData = nextPtsMat.data32F as Float32Array;
		const backData = backPtsMat.data32F as Float32Array;
		const errData = forwardErr.data32F as Float32Array;

		let totalFbError = 0;
		for (let i = 0; i < 5; i++) {
			if (forwardStatus.data[i] === 0 || backStatus.data[i] === 0) return null;
			if (i < errData.length && errData[i] > MAX_PER_POINT_ERROR) return null;
			totalFbError += Math.hypot(
				backData[i * 2] - prevFlat[i * 2],
				backData[i * 2 + 1] - prevFlat[i * 2 + 1]
			);
		}
		const meanError = totalFbError / 5;
		if (meanError > MAX_MEAN_FB_ERROR_PX) return null;

		return { points: fromFlatArray(nextData), meanFbErrorPx: meanError };
	} finally {
		prevPtsMat.delete();
		nextPtsMat.delete();
		forwardStatus.delete();
		forwardErr.delete();
		backPtsMat.delete();
		backStatus.delete();
		backErr.delete();
	}
}
