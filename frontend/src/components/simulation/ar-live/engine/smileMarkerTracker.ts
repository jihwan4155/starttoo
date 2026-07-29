/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Rect } from "./handRegion";
import type { Point } from "./markerDetect";
import type { TrackedPoints } from "./opticalFlowTrack";
import { trackPointArrayForwardBackward } from "./opticalFlowTrack";
import { MarkerPointsFilter } from "./oneEuroFilter";
import {
	isValidQuadrilateral,
	markerBoundingRect,
	meanCornerDistance,
} from "./markerGeometry";

export interface Segment {
	start: Point;
	end: Point;
}

export interface SmileMarkerFeatures {
	leftEyeTop: Point;
	leftEyeBottom: Point;
	rightEyeTop: Point;
	rightEyeBottom: Point;
	mouthLeft: Point;
	mouthRight: Point;
}

export type SmileTrackSource = "detection" | "optical-flow";

export interface SmileTrackResult {
	points: TrackedPoints;
	features: SmileMarkerFeatures;
	source: SmileTrackSource;
	confidence: number;
	fbErrorPx: number;
}

export interface LostSearchContext {
	region: Rect | null;
	skinMask: any | null;
	allowUnmaskedFallback?: boolean;
}

interface LineModel extends Segment {
	midpoint: Point;
	direction: Point;
	length: number;
}

interface TrackedShape {
	featurePoints: Point[];
	corners: Point[];
	source: SmileTrackSource;
	confidence: number;
	fbErrorPx: number;
}

const MAX_RAW_SEGMENTS = 180;
const MAX_MERGED_SEGMENTS = 42;
const MIN_TEMPLATE_SCORE = 0.27;
const ACQUIRE_MIN_CONFIDENCE = 0.42;
const ACQUIRE_CONFIRMATION_FRAMES = 3;
const ACQUIRE_MAX_MOVEMENT_RATIO = 0.55;
const PATCH_WIDTH = 120;
const PATCH_HEIGHT = 140;
const COS_18_DEG = Math.cos((18 * Math.PI) / 180);
const SIN_27_DEG = Math.sin((27 * Math.PI) / 180);

function add(a: Point, b: Point): Point {
	return { x: a.x + b.x, y: a.y + b.y };
}

function sub(a: Point, b: Point): Point {
	return { x: a.x - b.x, y: a.y - b.y };
}

function scale(a: Point, amount: number): Point {
	return { x: a.x * amount, y: a.y * amount };
}

function dot(a: Point, b: Point): number {
	return a.x * b.x + a.y * b.y;
}

function length(a: Point): number {
	return Math.hypot(a.x, a.y);
}

function distance(a: Point, b: Point): number {
	return length(sub(a, b));
}

function midpoint(a: Point, b: Point): Point {
	return scale(add(a, b), 0.5);
}

function normalized(a: Point): Point | null {
	const magnitude = length(a);
	return magnitude < 1e-5 ? null : scale(a, 1 / magnitude);
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

function pointsToFeatures(points: Point[]): SmileMarkerFeatures {
	return {
		leftEyeTop: points[0],
		leftEyeBottom: points[1],
		rightEyeTop: points[2],
		rightEyeBottom: points[3],
		mouthLeft: points[4],
		mouthRight: points[5],
	};
}

function shapeToTrackedPoints(corners: Point[]): TrackedPoints {
	const center = scale(
		corners.reduce((sum, point) => add(sum, point), { x: 0, y: 0 }),
		0.25
	);
	return {
		topLeft: corners[0],
		topRight: corners[1],
		bottomRight: corners[2],
		bottomLeft: corners[3],
		fringeTip: center,
	};
}

function trackedPointsToCorners(points: TrackedPoints): Point[] {
	return [
		points.topLeft,
		points.topRight,
		points.bottomRight,
		points.bottomLeft,
	];
}

function lineFromSegment(segment: Segment): LineModel | null {
	const delta = sub(segment.end, segment.start);
	const lineLength = length(delta);
	if (lineLength < 1) return null;
	return {
		...segment,
		midpoint: midpoint(segment.start, segment.end),
		direction: scale(delta, 1 / lineLength),
		length: lineLength,
	};
}

function intervalGap(first: LineModel, second: LineModel, axis: Point): number {
	const firstValues = [dot(first.start, axis), dot(first.end, axis)].sort(
		(a, b) => a - b
	);
	const secondValues = [dot(second.start, axis), dot(second.end, axis)].sort(
		(a, b) => a - b
	);
	if (firstValues[1] < secondValues[0]) return secondValues[0] - firstValues[1];
	if (secondValues[1] < firstValues[0]) return firstValues[0] - secondValues[1];
	return 0;
}

function mergePointCloud(points: Point[]): LineModel | null {
	if (points.length < 2) return null;
	let meanX = 0;
	let meanY = 0;
	for (const point of points) {
		meanX += point.x;
		meanY += point.y;
	}
	meanX /= points.length;
	meanY /= points.length;

	let sxx = 0;
	let sxy = 0;
	let syy = 0;
	for (const point of points) {
		const dx = point.x - meanX;
		const dy = point.y - meanY;
		sxx += dx * dx;
		sxy += dx * dy;
		syy += dy * dy;
	}
	const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
	const direction = { x: Math.cos(theta), y: Math.sin(theta) };
	let minimum = Infinity;
	let maximum = -Infinity;
	for (const point of points) {
		const projection = dot(sub(point, { x: meanX, y: meanY }), direction);
		minimum = Math.min(minimum, projection);
		maximum = Math.max(maximum, projection);
	}
	return lineFromSegment({
		start: add({ x: meanX, y: meanY }, scale(direction, minimum)),
		end: add({ x: meanX, y: meanY }, scale(direction, maximum)),
	});
}

/**
 * Tracks the hand-drawn three-line "square smile":
 *
 *   |   |
 *   -----
 *
 * Detection is rotation-independent. Two short, parallel strokes become the
 * eyes; a third, roughly perpendicular stroke on one side becomes the mouth.
 * Six real stroke endpoints are tracked with forward/backward optical flow,
 * while a perspective quad is derived from those points for rendering.
 */
export class SmileMarkerTracker {
	private cv: any;
	private previousGray: any;
	private previousFeaturePoints: Point[] | null = null;
	private previousCorners: Point[] | null = null;
	private frameNumber = 0;
	private misses = 0;
	private pendingCorners: Point[] | null = null;
	private pendingHits = 0;
	private pendingMisses = 0;
	private smoother = new MarkerPointsFilter();
	private templateMask: any;
	private dilatedTemplateMask: any;
	private toleranceKernel: any;

	lastDebugSegments: Segment[] | null = null;

	private _detectionInterval = 6;
	get detectionInterval(): number {
		return this._detectionInterval;
	}
	set detectionInterval(value: number) {
		this._detectionInterval = Math.min(12, Math.max(1, Math.round(value)));
	}

	constructor(cv: any) {
		this.cv = cv;
		this.previousGray = new cv.Mat();
		this.toleranceKernel = cv.getStructuringElement(
			cv.MORPH_ELLIPSE,
			new cv.Size(7, 7)
		);
		const template = this.createTemplate();
		this.templateMask = template.mask;
		this.dilatedTemplateMask = template.dilated;
	}

	needsExternalSearch(): boolean {
		return this.previousFeaturePoints === null;
	}

	process(
		gray: any,
		timestampSeconds: number,
		lost: LostSearchContext | null
	): SmileTrackResult | null {
		this.frameNumber++;
		this.lastDebugSegments = null;

		const oldFeatures = this.previousFeaturePoints;
		const oldCorners = this.previousCorners;
		let flow: TrackedShape | null = null;
		if (
			oldFeatures &&
			!this.previousGray.empty() &&
			this.previousGray.rows === gray.rows &&
			this.previousGray.cols === gray.cols
		) {
			flow = this.trackFlow(gray, oldFeatures);
		}

		const scheduledDetection =
			!oldFeatures || this.frameNumber % this._detectionInterval === 0;
		// A locked marker is re-checked only in its nearby ROI. Periodic
		// full-frame scans caused visible frame spikes after acquisition.
		const useFullFrame = !oldFeatures || this.misses >= 2;
		let detection: TrackedShape | null = null;
		if (scheduledDetection || !flow) {
			detection = this.detectMarker(
				gray,
				flow?.corners ?? oldCorners,
				useFullFrame,
				lost
			);
		}

		// Do not lock onto the first three vaguely similar lines we see. A real
		// marker stays in almost the same place for several consecutive frames,
		// while background false positives tend to jump around.
		if (!oldFeatures) {
			if (!detection) {
				this.notePendingMiss();
				return null;
			}
			if (!this.confirmAcquisition(detection)) return null;
		}

		let selected: TrackedShape | null;
		// Never replace a healthy optical-flow track with a fresh detection.
		// Re-detection can label the same three strokes in a different order,
		// which used to rotate or mirror the tattoo in a single frame.
		if (flow) selected = flow;
		else selected = detection;

		if (!selected) {
			this.misses++;
			// Never draw the tattoo at an old position. If both optical flow and
			// detection fail, the current frame is unverified and must stay clean.
			if (this.misses >= 2) this.clearTrackingState();
			return null;
		}

		this.misses = 0;
		this.previousFeaturePoints = selected.featurePoints;
		this.previousCorners = selected.corners;
		gray.copyTo(this.previousGray);

		const smoothed = this.smoother.filter(
			shapeToTrackedPoints(selected.corners),
			timestampSeconds
		);
		// Once acquired, a reliable forward/backward optical-flow result remains
		// visible even when a scheduled line detector misses. This prevents a
		// flickering skin mask, motion blur, or a partially covered stroke from
		// dropping an otherwise stable tattoo track.
		return {
			points: smoothed,
			features: pointsToFeatures(selected.featurePoints),
			source: selected.source,
			confidence: selected.confidence,
			fbErrorPx: selected.fbErrorPx,
		};
	}

	reset(): void {
		this.clearTrackingState();
		this.frameNumber = 0;
	}

	release(): void {
		this.clearTrackingState();
		this.previousGray.delete();
		this.templateMask.delete();
		this.dilatedTemplateMask.delete();
		this.toleranceKernel.delete();
	}

	private clearTrackingState(): void {
		this.previousFeaturePoints = null;
		this.previousCorners = null;
		this.misses = 0;
		this.clearPendingAcquisition();
		this.smoother = new MarkerPointsFilter();
		this.previousGray.delete();
		this.previousGray = new this.cv.Mat();
	}

	private confirmAcquisition(candidate: TrackedShape): boolean {
		if (candidate.confidence < ACQUIRE_MIN_CONFIDENCE) {
			this.notePendingMiss();
			return false;
		}

		if (this.pendingCorners) {
			const markerSize = Math.max(this.averageSide(this.pendingCorners), 20);
			const movementRatio =
				meanCornerDistance(this.pendingCorners, candidate.corners) / markerSize;
			if (movementRatio <= ACQUIRE_MAX_MOVEMENT_RATIO) {
				this.pendingHits++;
			} else {
				this.pendingHits = 1;
			}
		} else {
			this.pendingHits = 1;
		}

		this.pendingCorners = candidate.corners.map((point) => ({ ...point }));
		this.pendingMisses = 0;
		if (this.pendingHits < ACQUIRE_CONFIRMATION_FRAMES) return false;

		this.clearPendingAcquisition();
		return true;
	}

	private notePendingMiss(): void {
		if (!this.pendingCorners) return;
		this.pendingMisses++;
		if (this.pendingMisses >= 2) this.clearPendingAcquisition();
	}

	private clearPendingAcquisition(): void {
		this.pendingCorners = null;
		this.pendingHits = 0;
		this.pendingMisses = 0;
	}

	private trackFlow(gray: any, oldFeatures: Point[]): TrackedShape | null {
		const result = trackPointArrayForwardBackward(
			this.cv,
			this.previousGray,
			gray,
			oldFeatures
		);
		if (!result) return null;
		const shape = this.shapeFromFeatures(
			result.points,
			"optical-flow",
			1 - result.meanFbErrorPx / 2.5
		);
		if (!shape || !isValidQuadrilateral(shape.corners, gray.cols, gray.rows))
			return null;
		return {
			...shape,
			confidence: Math.min(
				shape.confidence,
				clamp01(1 - result.meanFbErrorPx / 2.3)
			),
			fbErrorPx: result.meanFbErrorPx,
		};
	}

	private detectMarker(
		gray: any,
		expected: Point[] | null,
		useFullFrame: boolean,
		lost: LostSearchContext | null
	): TrackedShape | null {
		const cv = this.cv;
		let roi: Rect | null = null;
		const sourceMask = lost?.skinMask ?? null;
		const allowUnmaskedFallback = lost?.allowUnmaskedFallback ?? true;
		if (expected && !useFullFrame) {
			roi = markerBoundingRect(expected, gray.cols, gray.rows, 1.15);
		} else if (lost) {
			roi = lost.region;
		}

		const input = roi
			? gray.roi(new cv.Rect(roi.x, roi.y, roi.width, roi.height))
			: gray;
		let searchMask = sourceMask;
		let ownsSearchMask = false;
		if (
			roi &&
			sourceMask &&
			sourceMask.rows === gray.rows &&
			sourceMask.cols === gray.cols
		) {
			searchMask = sourceMask.roi(
				new cv.Rect(roi.x, roi.y, roi.width, roi.height)
			);
			ownsSearchMask = true;
		}
		try {
			const offsetX = roi?.x ?? 0;
			const offsetY = roi?.y ?? 0;
			const frameShortSide = Math.min(gray.rows, gray.cols);
			let candidates = this.findMarkerCandidates(
				input,
				searchMask,
				frameShortSide
			);
			// A fixed skin-color range can miss valid skin under unusual lighting.
			// Retry weak masked searches too, rather than letting one weak background
			// candidate prevent the unmasked detector from seeing the real marker.
			if (
				searchMask &&
				allowUnmaskedFallback &&
				(candidates.length === 0 || candidates[0].confidence < 0.52)
			) {
				candidates = [
					...candidates,
					...this.findMarkerCandidates(input, null, frameShortSide),
				]
					.sort((a, b) => b.confidence - a.confidence)
					.slice(0, 20);
			}

			if (this.lastDebugSegments && (offsetX || offsetY)) {
				this.lastDebugSegments = this.lastDebugSegments.map((segment) => ({
					start: { x: segment.start.x + offsetX, y: segment.start.y + offsetY },
					end: { x: segment.end.x + offsetX, y: segment.end.y + offsetY },
				}));
			}

			let best: TrackedShape | null = null;
			let bestRank = -Infinity;
			for (const raw of candidates) {
				const candidate: TrackedShape = {
					...raw,
					featurePoints: raw.featurePoints.map((point) => ({
						x: point.x + offsetX,
						y: point.y + offsetY,
					})),
					corners: raw.corners.map((point) => ({
						x: point.x + offsetX,
						y: point.y + offsetY,
					})),
				};
				if (!isValidQuadrilateral(candidate.corners, gray.cols, gray.rows))
					continue;
				if (this.averageSide(candidate.corners) > frameShortSide * 0.62)
					continue;

				let rank = candidate.confidence;
				if (expected) {
					const expectedSize = Math.max(this.averageSide(expected), 20);
					const movement =
						meanCornerDistance(expected, candidate.corners) / expectedSize;
					rank -= Math.min(movement, 2.5) * 0.18;
				}
				if (rank > bestRank) {
					bestRank = rank;
					best = candidate;
				}
			}
			return best;
		} finally {
			if (ownsSearchMask) searchMask.delete();
			if (roi) input.delete();
		}
	}

	private findMarkerCandidates(
		gray: any,
		skinMask: any | null,
		frameShortSide: number
	): TrackedShape[] {
		const cv = this.cv;
		if (gray.rows < 32 || gray.cols < 32) return [];

		const blurred = new cv.Mat();
		const binary = new cv.Mat();
		try {
			cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0);
			let blockSize = Math.min(41, Math.min(gray.rows, gray.cols));
			if (blockSize % 2 === 0) blockSize--;
			blockSize = Math.max(3, blockSize);
			cv.adaptiveThreshold(
				blurred,
				binary,
				255,
				cv.ADAPTIVE_THRESH_GAUSSIAN_C,
				cv.THRESH_BINARY_INV,
				blockSize,
				6
			);
			if (skinMask) cv.bitwise_and(binary, skinMask, binary);

			const rawSegments = this.findLineSegments(blurred, skinMask);
			const mergedSegments = this.mergeCollinearSegments(rawSegments);
			this.lastDebugSegments = mergedSegments;
			const lineModels = mergedSegments
				.map(lineFromSegment)
				.filter((line): line is LineModel => line !== null)
				.slice(0, MAX_MERGED_SEGMENTS);

			const candidates: TrackedShape[] = [];
			for (let firstIndex = 0; firstIndex < lineModels.length; firstIndex++) {
				for (
					let secondIndex = firstIndex + 1;
					secondIndex < lineModels.length;
					secondIndex++
				) {
					const firstEye = lineModels[firstIndex];
					const secondEye = lineModels[secondIndex];
					const eyeAlignment = Math.abs(
						dot(firstEye.direction, secondEye.direction)
					);
					if (eyeAlignment < COS_18_DEG) continue;

					const averageEyeLength = (firstEye.length + secondEye.length) * 0.5;
					// A phone is often held close enough that a marker stroke occupies
					// roughly one third of the short frame side.
					if (averageEyeLength > frameShortSide * 0.36) continue;
					const eyeLengthRatio =
						Math.min(firstEye.length, secondEye.length) /
						Math.max(firstEye.length, secondEye.length);
					if (eyeLengthRatio < 0.48) continue;

					let eyeDirection = firstEye.direction;
					const alignedSecond =
						dot(firstEye.direction, secondEye.direction) < 0
							? scale(secondEye.direction, -1)
							: secondEye.direction;
					eyeDirection =
						normalized(add(eyeDirection, alignedSecond)) ?? eyeDirection;
					const eyeNormal = { x: -eyeDirection.y, y: eyeDirection.x };
					const eyeDelta = sub(secondEye.midpoint, firstEye.midpoint);
					const eyeSeparation = Math.abs(dot(eyeDelta, eyeNormal));
					const eyeStagger = Math.abs(dot(eyeDelta, eyeDirection));
					if (
						eyeSeparation < averageEyeLength * 0.35 ||
						eyeSeparation > averageEyeLength * 3.4
					)
						continue;
					if (eyeStagger > averageEyeLength * 0.72) continue;

					for (
						let mouthIndex = 0;
						mouthIndex < lineModels.length;
						mouthIndex++
					) {
						if (mouthIndex === firstIndex || mouthIndex === secondIndex)
							continue;
						const mouth = lineModels[mouthIndex];
						if (mouth.length > frameShortSide * 0.48) continue;
						const perpendicularError = Math.abs(
							dot(mouth.direction, eyeDirection)
						);
						if (perpendicularError > SIN_27_DEG) continue;

						const mouthRatio = mouth.length / averageEyeLength;
						if (mouthRatio < 0.65 || mouthRatio > 3.4) continue;

						const eyeCenter = midpoint(firstEye.midpoint, secondEye.midpoint);
						const mouthOffset = sub(mouth.midpoint, eyeCenter);
						const signedDown = dot(mouthOffset, eyeDirection);
						const downDistance = Math.abs(signedDown);
						if (
							downDistance < averageEyeLength * 0.5 ||
							downDistance > averageEyeLength * 4.2
						)
							continue;

						const vertical =
							signedDown >= 0 ? eyeDirection : scale(eyeDirection, -1);
						let horizontal = { x: vertical.y, y: -vertical.x };
						if (
							dot(sub(secondEye.midpoint, firstEye.midpoint), horizontal) < 0
						) {
							horizontal = scale(horizontal, -1);
						}
						const centerOffset = Math.abs(dot(mouthOffset, horizontal));
						const centerLimit = Math.max(
							eyeSeparation * 0.72,
							mouth.length * 0.45
						);
						if (centerOffset > centerLimit) continue;

						const orderedEyes = [firstEye, secondEye].sort(
							(a, b) =>
								dot(a.midpoint, horizontal) - dot(b.midpoint, horizontal)
						);
						const leftEyePoints = [
							orderedEyes[0].start,
							orderedEyes[0].end,
						].sort((a, b) => dot(a, vertical) - dot(b, vertical));
						const rightEyePoints = [
							orderedEyes[1].start,
							orderedEyes[1].end,
						].sort((a, b) => dot(a, vertical) - dot(b, vertical));
						const mouthPoints = [mouth.start, mouth.end].sort(
							(a, b) => dot(a, horizontal) - dot(b, horizontal)
						);
						const features = [
							leftEyePoints[0],
							leftEyePoints[1],
							rightEyePoints[0],
							rightEyePoints[1],
							mouthPoints[0],
							mouthPoints[1],
						];

						const parallelScore = clamp01(
							(eyeAlignment - COS_18_DEG) / (1 - COS_18_DEG)
						);
						const perpendicularScore = clamp01(
							1 - perpendicularError / SIN_27_DEG
						);
						const lengthScore = eyeLengthRatio;
						const staggerScore = clamp01(
							1 - eyeStagger / (averageEyeLength * 0.72)
						);
						const centerScore = clamp01(1 - centerOffset / centerLimit);
						const spacingScore = clamp01(
							1 - Math.abs(eyeSeparation / averageEyeLength - 1.05) / 2.1
						);
						const geometryScore =
							parallelScore * 0.18 +
							perpendicularScore * 0.22 +
							lengthScore * 0.16 +
							staggerScore * 0.14 +
							centerScore * 0.18 +
							spacingScore * 0.12;

						const shape = this.shapeFromFeatures(
							features,
							"detection",
							geometryScore
						);
						if (!shape) continue;
						const templateScore = this.scoreCandidateTemplate(
							binary,
							shape.corners
						);
						if (templateScore < MIN_TEMPLATE_SCORE) continue;
						candidates.push({
							...shape,
							confidence: geometryScore * 0.66 + templateScore * 0.34,
							fbErrorPx: 0,
						});
					}
				}
			}

			candidates.sort((a, b) => b.confidence - a.confidence);
			return candidates.slice(0, 20);
		} finally {
			blurred.delete();
			binary.delete();
		}
	}

	private findLineSegments(blurred: any, skinMask: any | null): Segment[] {
		const cv = this.cv;
		const edges = new cv.Mat();
		const lines = new cv.Mat();
		try {
			// The strict body/skin mask now removes most background clutter, so a
			// slightly more sensitive edge threshold can recover faint pen strokes.
			cv.Canny(blurred, edges, 32, 105);
			if (skinMask) cv.bitwise_and(edges, skinMask, edges);
			// Keep small hand-drawn strokes visible even when the webcam is a little
			// farther away. Temporal confirmation above handles the extra noise.
			const minimumLength = Math.max(
				7,
				Math.min(blurred.rows, blurred.cols) * 0.012
			);
			cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 11, minimumLength, 8);

			const count = lines.data32S.length / 4;
			const segments: Segment[] = [];
			for (let index = 0; index < count; index++) {
				const segment = {
					start: {
						x: lines.data32S[index * 4],
						y: lines.data32S[index * 4 + 1],
					},
					end: {
						x: lines.data32S[index * 4 + 2],
						y: lines.data32S[index * 4 + 3],
					},
				};
				if (distance(segment.start, segment.end) >= minimumLength)
					segments.push(segment);
			}
			segments.sort(
				(a, b) => distance(b.start, b.end) - distance(a.start, a.end)
			);
			return segments.slice(0, MAX_RAW_SEGMENTS);
		} finally {
			edges.delete();
			lines.delete();
		}
	}

	private mergeCollinearSegments(segments: Segment[]): Segment[] {
		const groups: Point[][] = [];
		const models: LineModel[] = [];

		for (const segment of segments) {
			const candidate = lineFromSegment(segment);
			if (!candidate) continue;
			let merged = false;
			for (let index = 0; index < models.length; index++) {
				const model = models[index];
				if (
					Math.abs(dot(candidate.direction, model.direction)) <
					Math.cos((12 * Math.PI) / 180)
				)
					continue;
				const normal = { x: -model.direction.y, y: model.direction.x };
				const perpendicularDistance = Math.abs(
					dot(sub(candidate.midpoint, model.midpoint), normal)
				);
				const distanceLimit = Math.max(
					4,
					Math.min(candidate.length, model.length) * 0.16
				);
				if (perpendicularDistance > distanceLimit) continue;
				const gap = intervalGap(candidate, model, model.direction);
				if (gap > Math.max(10, Math.max(candidate.length, model.length) * 0.28))
					continue;

				groups[index].push(candidate.start, candidate.end);
				const updated = mergePointCloud(groups[index]);
				if (updated) models[index] = updated;
				merged = true;
				break;
			}
			if (!merged) {
				groups.push([candidate.start, candidate.end]);
				models.push(candidate);
			}
		}

		return models
			.sort((a, b) => b.length - a.length)
			.slice(0, MAX_MERGED_SEGMENTS)
			.map(({ start, end }) => ({ start, end }));
	}

	private shapeFromFeatures(
		features: Point[],
		source: SmileTrackSource,
		inputConfidence: number
	): TrackedShape | null {
		if (features.length !== 6) return null;
		const [leftTop, leftBottom, rightTop, rightBottom, mouthLeft, mouthRight] =
			features;
		const leftEye = sub(leftBottom, leftTop);
		const rightEye = sub(rightBottom, rightTop);
		const leftLength = length(leftEye);
		const rightLength = length(rightEye);
		const mouthLength = distance(mouthLeft, mouthRight);
		if (Math.min(leftLength, rightLength) < 8 || mouthLength < 10) return null;

		const leftDirection = normalized(leftEye);
		const rightDirection = normalized(rightEye);
		if (!leftDirection || !rightDirection) return null;
		if (dot(leftDirection, rightDirection) < COS_18_DEG) return null;

		const vertical = normalized(add(leftDirection, rightDirection));
		if (!vertical) return null;
		const horizontal = normalized(
			sub(midpoint(rightTop, rightBottom), midpoint(leftTop, leftBottom))
		);
		if (!horizontal || Math.abs(dot(vertical, horizontal)) > 0.58) return null;

		const averageEyeLength = (leftLength + rightLength) * 0.5;
		const eyeSeparation = distance(
			midpoint(leftTop, leftBottom),
			midpoint(rightTop, rightBottom)
		);
		const mouthRatio = mouthLength / averageEyeLength;
		if (mouthRatio < 0.5 || mouthRatio > 3.8) return null;
		if (
			eyeSeparation < averageEyeLength * 0.3 ||
			eyeSeparation > averageEyeLength * 3.8
		)
			return null;

		const eyeCenter = midpoint(
			midpoint(leftTop, leftBottom),
			midpoint(rightTop, rightBottom)
		);
		const mouthCenter = midpoint(mouthLeft, mouthRight);
		const mouthOffset = sub(mouthCenter, eyeCenter);
		if (dot(mouthOffset, vertical) < averageEyeLength * 0.2) return null;
		if (
			Math.abs(
				dot(normalized(sub(mouthRight, mouthLeft)) ?? horizontal, vertical)
			) > 0.58
		)
			return null;

		const corners = this.computePerspectiveQuad(
			leftTop,
			rightTop,
			mouthRight,
			mouthLeft
		);
		if (!corners) return null;

		const eyeLengthRatio =
			Math.min(leftLength, rightLength) / Math.max(leftLength, rightLength);
		const geometryConfidence = clamp01(
			0.42 * eyeLengthRatio +
				0.3 * (1 - Math.abs(dot(vertical, horizontal))) +
				0.28 * clamp01(1 - Math.abs(mouthRatio - 1.5) / 2.3)
		);
		return {
			featurePoints: features,
			corners,
			source,
			confidence: Math.min(clamp01(inputConfidence), geometryConfidence),
			fbErrorPx: source === "optical-flow" ? 0 : Number.NaN,
		};
	}

	private computePerspectiveQuad(
		leftEyeTop: Point,
		rightEyeTop: Point,
		mouthRight: Point,
		mouthLeft: Point
	): Point[] | null {
		const cv = this.cv;
		const reference = cv.matFromArray(
			4,
			1,
			cv.CV_32FC2,
			[0.3, 0.08, 0.7, 0.08, 0.86, 0.82, 0.14, 0.82]
		);
		const detected = cv.matFromArray(4, 1, cv.CV_32FC2, [
			leftEyeTop.x,
			leftEyeTop.y,
			rightEyeTop.x,
			rightEyeTop.y,
			mouthRight.x,
			mouthRight.y,
			mouthLeft.x,
			mouthLeft.y,
		]);
		const transform = cv.getPerspectiveTransform(reference, detected);
		const canonicalCorners = cv.matFromArray(
			4,
			1,
			cv.CV_32FC2,
			[0.05, 0.02, 0.95, 0.02, 0.95, 0.98, 0.05, 0.98]
		);
		const projected = new cv.Mat();
		try {
			cv.perspectiveTransform(canonicalCorners, projected, transform);
			const data = projected.data32F as Float32Array;
			if (
				data.length < 8 ||
				Array.from(data).some((value) => !Number.isFinite(value))
			)
				return null;
			return [
				{ x: data[0], y: data[1] },
				{ x: data[2], y: data[3] },
				{ x: data[4], y: data[5] },
				{ x: data[6], y: data[7] },
			];
		} finally {
			reference.delete();
			detected.delete();
			transform.delete();
			canonicalCorners.delete();
			projected.delete();
		}
	}

	private scoreCandidateTemplate(binary: any, corners: Point[]): number {
		const cv = this.cv;
		const src = cv.matFromArray(4, 1, cv.CV_32FC2, [
			corners[0].x,
			corners[0].y,
			corners[1].x,
			corners[1].y,
			corners[2].x,
			corners[2].y,
			corners[3].x,
			corners[3].y,
		]);
		const dst = cv.matFromArray(4, 1, cv.CV_32FC2, [
			0,
			0,
			PATCH_WIDTH - 1,
			0,
			PATCH_WIDTH - 1,
			PATCH_HEIGHT - 1,
			0,
			PATCH_HEIGHT - 1,
		]);
		const transform = cv.getPerspectiveTransform(src, dst);
		const patch = new cv.Mat();
		const dilatedPatch = new cv.Mat();
		const intersection = new cv.Mat();
		try {
			cv.warpPerspective(
				binary,
				patch,
				transform,
				new cv.Size(PATCH_WIDTH, PATCH_HEIGHT),
				cv.INTER_LINEAR,
				cv.BORDER_CONSTANT,
				new cv.Scalar(0)
			);
			cv.threshold(patch, patch, 127, 255, cv.THRESH_BINARY);
			const patchPixels = cv.countNonZero(patch);
			const templatePixels = cv.countNonZero(this.templateMask);
			if (patchPixels <= 0 || templatePixels <= 0) return 0;

			cv.bitwise_and(patch, this.dilatedTemplateMask, intersection);
			const precision = cv.countNonZero(intersection) / patchPixels;
			cv.dilate(patch, dilatedPatch, this.toleranceKernel);
			cv.bitwise_and(dilatedPatch, this.templateMask, intersection);
			const recall = cv.countNonZero(intersection) / templatePixels;
			return precision + recall < 1e-5
				? 0
				: (2 * precision * recall) / (precision + recall);
		} finally {
			src.delete();
			dst.delete();
			transform.delete();
			patch.delete();
			dilatedPatch.delete();
			intersection.delete();
		}
	}

	private createTemplate(): { mask: any; dilated: any } {
		const cv = this.cv;
		const mask = cv.Mat.zeros(PATCH_HEIGHT, PATCH_WIDTH, cv.CV_8UC1);
		const white = new cv.Scalar(255);
		const thickness = 9;
		cv.line(mask, new cv.Point(36, 12), new cv.Point(36, 57), white, thickness);
		cv.line(mask, new cv.Point(84, 12), new cv.Point(84, 57), white, thickness);
		cv.line(
			mask,
			new cv.Point(18, 115),
			new cv.Point(102, 115),
			white,
			thickness
		);
		const dilated = new cv.Mat();
		cv.dilate(mask, dilated, this.toleranceKernel);
		return { mask, dilated };
	}

	private averageSide(corners: Point[]): number {
		if (corners.length !== 4) return 0;
		let sum = 0;
		for (let index = 0; index < 4; index++) {
			sum += distance(corners[index], corners[(index + 1) % 4]);
		}
		return sum / 4;
	}
}

export function scaledTrackedPoints(
	points: TrackedPoints,
	factor: number
): TrackedPoints {
	const corners = trackedPointsToCorners(points);
	const center = scale(
		corners.reduce((sum, point) => add(sum, point), { x: 0, y: 0 }),
		0.25
	);
	const scaledCorners = corners.map((point) =>
		add(center, scale(sub(point, center), factor))
	);
	return {
		topLeft: scaledCorners[0],
		topRight: scaledCorners[1],
		bottomRight: scaledCorners[2],
		bottomLeft: scaledCorners[3],
		fringeTip: center,
	};
}
