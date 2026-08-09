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

/** 이보다 작은 각도 변화는 추정 잡음으로 보고 무시한다. */
const ANGLE_DEADBAND = (0.8 * Math.PI) / 180;
/** 최대 회전 속도. 팔 축 추정이 튀어도 타투가 혼자 뱅뱅 도는 것을 막는다
 *  (팔을 실제로 돌리면 여러 프레임에 걸쳐 따라감). */
const MAX_ANGLE_RATE = (20 * Math.PI) / 180; // rad/s

/**
 * 아래 스무딩 계수들은 원래 이 간격(초)에 한 번 호출되는 것을 전제로 잡혔다.
 * 프레임 간격이 기기 성능에 따라 달라지므로, 실제 경과 시간에 맞춰 환산해야
 * 빠른 기기에서는 과하게 민감하고 느린 기기에서는 굼뜨게 따라오는 일이 없다.
 */
const REFERENCE_STEP_SECONDS = 0.08;

/** 기준 간격 기준 계수를 실제 경과 시간에 맞게 환산한다. */
function timeScaledAlpha(reference: number, deltaSeconds: number): number {
	if (reference <= 0) return 0;
	if (reference >= 1) return 1;
	return 1 - Math.pow(1 - reference, deltaSeconds / REFERENCE_STEP_SECONDS);
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
	private lastUpdateAtMs: number | null = null;

	reset(): void {
		this.pose = null;
		this.lastUpdateAtMs = null;
	}

	update(
		points: TrackedPoints,
		armAxisAngleDeg: number | null,
		designXAxisOffsetDeg: number,
		nowMs: number = performance.now()
	): TrackedPoints {
		// 프레임 간격은 기기·부하에 따라 달라진다. 튐(탭 전환 복귀 등)은 잘라낸다.
		const deltaSeconds = Math.min(
			0.5,
			Math.max(
				0.001,
				this.lastUpdateAtMs === null
					? REFERENCE_STEP_SECONDS
					: (nowMs - this.lastUpdateAtMs) / 1000
			)
		);
		this.lastUpdateAtMs = nowMs;

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
			const centerAlpha = timeScaledAlpha(
				clamp(0.2 + movement * 0.24, 0.2, 0.5),
				deltaSeconds
			);
			const sizeAlpha = timeScaledAlpha(0.1, deltaSeconds);
			const scaleAlpha = timeScaledAlpha(0.08, deltaSeconds);
			this.pose.center.x = mix(this.pose.center.x, rawCenter.x, centerAlpha);
			this.pose.center.y = mix(this.pose.center.y, rawCenter.y, centerAlpha);
			this.pose.halfWidth = mix(this.pose.halfWidth, rawHalfWidth, sizeAlpha);
			this.pose.halfHeight = mix(this.pose.halfHeight, rawHalfHeight, sizeAlpha);
			// 각도는 데드밴드 + 속도 제한을 걸어 따라간다. 피부 마스크에 배경이
			// 섞이면 팔 축 추정이 프레임마다 튀는데, 그대로 mix하면 타투가
			// 제자리에서 계속 돌아버린다. 제한은 "프레임당"이 아니라 "초당"이라
			// 기기가 느려도 팔을 돌리는 속도를 똑같이 따라온다.
			const angleDelta = targetAngle - this.pose.xAxisAngle;
			if (Math.abs(angleDelta) >= ANGLE_DEADBAND) {
				const maxStep = MAX_ANGLE_RATE * deltaSeconds;
				this.pose.xAxisAngle += clamp(
					angleDelta * timeScaledAlpha(0.12, deltaSeconds),
					-maxStep,
					maxStep
				);
			}
			this.pose.topScale = mix(this.pose.topScale, rawTopScale, scaleAlpha);
			this.pose.bottomScale = mix(
				this.pose.bottomScale,
				rawBottomScale,
				scaleAlpha
			);
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
