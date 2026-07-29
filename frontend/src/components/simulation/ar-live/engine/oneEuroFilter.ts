// Standard 1€ Filter (Casiez, Roussel, Vogel 2012) — reference algorithm
// linked from the teammate's AR doc: https://gery.casiez.net/1euro/
import type { Point } from "./markerDetect";
import type { TrackedPoints } from "./opticalFlowTrack";

class LowPassFilter {
	private y = 0;
	private s = 0;
	private initialized = false;

	filterWithAlpha(value: number, alpha: number): number {
		const result = this.initialized
			? alpha * value + (1 - alpha) * this.s
			: value;
		this.initialized = true;
		this.y = value;
		this.s = result;
		return result;
	}

	hasLastRawValue(): boolean {
		return this.initialized;
	}

	lastRawValue(): number {
		return this.y;
	}
}

export class OneEuroFilter {
	private freq: number;
	private mincutoff: number;
	private beta: number;
	private dcutoff: number;
	private x = new LowPassFilter();
	private dx = new LowPassFilter();
	private lastTime: number | undefined;

	constructor(freq = 30, mincutoff = 1.0, beta = 0.0, dcutoff = 1.0) {
		this.freq = freq;
		this.mincutoff = mincutoff;
		this.beta = beta;
		this.dcutoff = dcutoff;
	}

	private alpha(cutoff: number): number {
		const te = 1.0 / this.freq;
		const tau = 1.0 / (2 * Math.PI * cutoff);
		return 1.0 / (1.0 + tau / te);
	}

	filter(value: number, timestampSeconds?: number): number {
		if (
			this.lastTime !== undefined &&
			timestampSeconds !== undefined &&
			timestampSeconds > this.lastTime
		) {
			this.freq = 1.0 / (timestampSeconds - this.lastTime);
		}
		this.lastTime = timestampSeconds;

		const dvalue = this.x.hasLastRawValue()
			? (value - this.x.lastRawValue()) * this.freq
			: 0.0;
		const edvalue = this.dx.filterWithAlpha(dvalue, this.alpha(this.dcutoff));
		const cutoff = this.mincutoff + this.beta * Math.abs(edvalue);
		return this.x.filterWithAlpha(value, this.alpha(cutoff));
	}
}

class PointFilter {
	private fx = new OneEuroFilter();
	private fy = new OneEuroFilter();

	filter(p: Point, timestampSeconds: number): Point {
		return {
			x: this.fx.filter(p.x, timestampSeconds),
			y: this.fy.filter(p.y, timestampSeconds),
		};
	}
}

/** Smooths all 5 tracked marker points together. */
export class MarkerPointsFilter {
	private filters = {
		topLeft: new PointFilter(),
		topRight: new PointFilter(),
		bottomLeft: new PointFilter(),
		bottomRight: new PointFilter(),
		fringeTip: new PointFilter(),
	};

	filter(points: TrackedPoints, timestampSeconds: number): TrackedPoints {
		return {
			topLeft: this.filters.topLeft.filter(points.topLeft, timestampSeconds),
			topRight: this.filters.topRight.filter(points.topRight, timestampSeconds),
			bottomLeft: this.filters.bottomLeft.filter(
				points.bottomLeft,
				timestampSeconds
			),
			bottomRight: this.filters.bottomRight.filter(
				points.bottomRight,
				timestampSeconds
			),
			fringeTip: this.filters.fringeTip.filter(
				points.fringeTip,
				timestampSeconds
			),
		};
	}
}
