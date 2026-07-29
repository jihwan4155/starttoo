import type { TrackedPoints } from "./opticalFlowTrack";
import type { Point } from "./markerDetect";

interface StabilizedPose {
	center: Point;
	halfWidth: number;
	halfHeight: number;
	xAxisAngle: number;
	topScale: number;
	bottomScale: number;
}

function distance(first: Point, second: Point): number {
	return Math.hypot(first.x - second.x, first.y - second.y);
}

function mix(from: number, to: number, alpha: number): number {
	return from + (to - from) * alpha;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

function closestUndirectedAngle(target: number, reference: number): number {
	let candidate = target;
	while (candidate - reference > Math.PI / 2) candidate -= Math.PI;
	while (candidate - reference < -Math.PI / 2) candidate += Math.PI;
	return candidate;
}

function averagePoint(points: Point[]): Point {
	return {
		x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
		y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
	};
}

/**
 * Stabilizes the tattoo as one rigid surface pose instead of filtering four
 * corners independently. The arm axis decides the orientation, while the
 * marker decides center, size, and a small amount of perspective.
 */
export class TattooPoseStabilizer {
	private pose: StabilizedPose | null = null;

	reset(): void {
		this.pose = null;
	}

	update(
		points: TrackedPoints,
		armAxisAngleDeg: number | null,
		designXAxisOffsetDeg: number
	): TrackedPoints {
		const corners = [
			points.topLeft,
			points.topRight,
			points.bottomRight,
			points.bottomLeft,
		];
		const rawCenter = averagePoint(corners);
		const topWidth = distance(points.topLeft, points.topRight);
		const bottomWidth = distance(points.bottomLeft, points.bottomRight);
		const leftHeight = distance(points.topLeft, points.bottomLeft);
		const rightHeight = distance(points.topRight, points.bottomRight);
		const rawHalfWidth = Math.max(6, (topWidth + bottomWidth) * 0.25);
		const rawHalfHeight = Math.max(6, (leftHeight + rightHeight) * 0.25);
		const averageSize = Math.max(12, rawHalfWidth + rawHalfHeight);
		const rawTopScale = clamp(
			(topWidth / Math.max(topWidth + bottomWidth, 1)) * 2,
			0.82,
			1.18
		);
		const rawBottomScale = clamp(
			(bottomWidth / Math.max(topWidth + bottomWidth, 1)) * 2,
			0.82,
			1.18
		);

		const markerXAxisAngle = Math.atan2(
			points.topRight.y - points.topLeft.y,
			points.topRight.x - points.topLeft.x
		);
		const desiredAngle =
			armAxisAngleDeg === null
				? markerXAxisAngle
				: ((armAxisAngleDeg + designXAxisOffsetDeg) * Math.PI) / 180;

		if (!this.pose) {
			this.pose = {
				center: rawCenter,
				halfWidth: rawHalfWidth,
				halfHeight: rawHalfHeight,
				xAxisAngle: desiredAngle,
				topScale: rawTopScale,
				bottomScale: rawBottomScale,
			};
		} else {
			const targetAngle = closestUndirectedAngle(
				desiredAngle,
				this.pose.xAxisAngle
			);
			const movement = distance(this.pose.center, rawCenter) / averageSize;
			const centerAlpha = clamp(0.2 + movement * 0.24, 0.2, 0.5);
			this.pose.center.x = mix(this.pose.center.x, rawCenter.x, centerAlpha);
			this.pose.center.y = mix(this.pose.center.y, rawCenter.y, centerAlpha);
			this.pose.halfWidth = mix(this.pose.halfWidth, rawHalfWidth, 0.1);
			this.pose.halfHeight = mix(this.pose.halfHeight, rawHalfHeight, 0.1);
			this.pose.xAxisAngle = mix(this.pose.xAxisAngle, targetAngle, 0.12);
			this.pose.topScale = mix(this.pose.topScale, rawTopScale, 0.08);
			this.pose.bottomScale = mix(this.pose.bottomScale, rawBottomScale, 0.08);
		}

		const pose = this.pose;
		const xAxis = {
			x: Math.cos(pose.xAxisAngle),
			y: Math.sin(pose.xAxisAngle),
		};
		const yAxis = { x: -xAxis.y, y: xAxis.x };
		const topCenter = {
			x: pose.center.x - yAxis.x * pose.halfHeight,
			y: pose.center.y - yAxis.y * pose.halfHeight,
		};
		const bottomCenter = {
			x: pose.center.x + yAxis.x * pose.halfHeight,
			y: pose.center.y + yAxis.y * pose.halfHeight,
		};
		const topHalfWidth = pose.halfWidth * pose.topScale;
		const bottomHalfWidth = pose.halfWidth * pose.bottomScale;

		return {
			topLeft: {
				x: topCenter.x - xAxis.x * topHalfWidth,
				y: topCenter.y - xAxis.y * topHalfWidth,
			},
			topRight: {
				x: topCenter.x + xAxis.x * topHalfWidth,
				y: topCenter.y + xAxis.y * topHalfWidth,
			},
			bottomRight: {
				x: bottomCenter.x + xAxis.x * bottomHalfWidth,
				y: bottomCenter.y + xAxis.y * bottomHalfWidth,
			},
			bottomLeft: {
				x: bottomCenter.x - xAxis.x * bottomHalfWidth,
				y: bottomCenter.y - xAxis.y * bottomHalfWidth,
			},
			fringeTip: { ...pose.center },
		};
	}
}
