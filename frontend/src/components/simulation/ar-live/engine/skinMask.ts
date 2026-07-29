/* eslint-disable @typescript-eslint/no-explicit-any */
// Builds a binary mask of likely skin pixels in a color (RGBA) ROI. The
// marker search then only considers edges that fall on skin, so background
// clutter with lots of straight lines (laptop trackpad, keyboard, desk
// edges) can't be mistaken for the "I + fringe" marker. This is the "피부
// 영역 추출" idea from the teammate's AR doc, used here as a detection gate.
//
// The marker itself is drawn in dark pen ON the skin: the ink pixels aren't
// skin-colored, so the raw mask has hole(s) exactly where the marker is and
// would mask its own lines out. A morphological CLOSE (dilate then erode
// with the same kernel) fills those thin ink holes WITHOUT growing the mask
// past the arm's silhouette — the earlier dilate-only version expanded ~12px
// beyond the arm, so the arm's contour and nearby desk/laptop edges flooded
// the line detector (the debug overlay showed 21 lines, all silhouette and
// furniture, zero on the marker). The extra ERODE afterwards pulls the mask
// slightly inside the silhouette so the contour's own Canny edges are
// excluded too; the marker sits well inside the forearm and survives.

const SKIN_CR_MIN = 133;
const SKIN_CR_MAX = 173;
const SKIN_CB_MIN = 77;
const SKIN_CB_MAX = 127;
const CLOSE_KERNEL_SIZE = 25;
const ERODE_KERNEL_SIZE = 7;
const OPEN_KERNEL_SIZE = 5;
const SMOOTH_KERNEL_SIZE = 9;

/** Caller owns the returned Mat and must delete() it. */
export function computeSkinMask(cv: any, colorRoi: any): any {
	const rgb = new cv.Mat();
	cv.cvtColor(colorRoi, rgb, cv.COLOR_RGBA2RGB);
	const ycrcb = new cv.Mat();
	cv.cvtColor(rgb, ycrcb, cv.COLOR_RGB2YCrCb);
	rgb.delete();

	const low = new cv.Mat(ycrcb.rows, ycrcb.cols, ycrcb.type(), [
		0,
		SKIN_CR_MIN,
		SKIN_CB_MIN,
		0,
	]);
	const high = new cv.Mat(ycrcb.rows, ycrcb.cols, ycrcb.type(), [
		255,
		SKIN_CR_MAX,
		SKIN_CB_MAX,
		255,
	]);
	const mask = new cv.Mat();
	cv.inRange(ycrcb, low, high, mask);
	ycrcb.delete();
	low.delete();
	high.delete();

	const closeKernel = cv.getStructuringElement(
		cv.MORPH_ELLIPSE,
		new cv.Size(CLOSE_KERNEL_SIZE, CLOSE_KERNEL_SIZE)
	);
	cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, closeKernel);
	closeKernel.delete();

	const erodeKernel = cv.getStructuringElement(
		cv.MORPH_ELLIPSE,
		new cv.Size(ERODE_KERNEL_SIZE, ERODE_KERNEL_SIZE)
	);
	cv.erode(mask, mask, erodeKernel);
	erodeKernel.delete();

	const openKernel = cv.getStructuringElement(
		cv.MORPH_ELLIPSE,
		new cv.Size(OPEN_KERNEL_SIZE, OPEN_KERNEL_SIZE)
	);
	cv.morphologyEx(mask, mask, cv.MORPH_OPEN, openKernel);
	openKernel.delete();
	cv.GaussianBlur(
		mask,
		mask,
		new cv.Size(SMOOTH_KERNEL_SIZE, SMOOTH_KERNEL_SIZE),
		0
	);
	cv.threshold(mask, mask, 127, 255, cv.THRESH_BINARY);

	return mask;
}

/** Fraction (0..1) of the mask that is skin. Used to bail out when almost no
 * skin is visible (bad lighting / skin tone out of range) rather than run a
 * detection that can only produce garbage. */
export function skinFraction(cv: any, mask: any): number {
	const nonZero = cv.countNonZero(mask);
	return nonZero / (mask.rows * mask.cols);
}

export interface OutlinePoint {
	x: number;
	y: number;
}

/** Returns a simplified outline around the largest connected skin region. */
export function largestSkinOutline(cv: any, mask: any): OutlinePoint[] | null {
	const working = mask.clone();
	const contours = new cv.MatVector();
	const hierarchy = new cv.Mat();
	const simplified = new cv.Mat();

	try {
		cv.findContours(
			working,
			contours,
			hierarchy,
			cv.RETR_EXTERNAL,
			cv.CHAIN_APPROX_SIMPLE
		);
		let largestIndex = -1;
		let largestArea = 0;
		for (let index = 0; index < contours.size(); index++) {
			const contour = contours.get(index);
			const area = cv.contourArea(contour, false);
			contour.delete();
			if (area > largestArea) {
				largestArea = area;
				largestIndex = index;
			}
		}
		if (largestIndex < 0) return null;

		const largest = contours.get(largestIndex);
		try {
			const perimeter = cv.arcLength(largest, true);
			cv.approxPolyDP(largest, simplified, Math.max(3, perimeter * 0.01), true);
			const data = simplified.data32S as Int32Array;
			const points: OutlinePoint[] = [];
			for (let index = 0; index + 1 < data.length; index += 2) {
				points.push({ x: data[index], y: data[index + 1] });
			}
			return points.length >= 3 ? points : null;
		} finally {
			largest.delete();
		}
	} finally {
		working.delete();
		contours.delete();
		hierarchy.delete();
		simplified.delete();
	}
}

/** Undirected image-space angle (deg, -90..90) of the skin blob's major
 * axis, from image moments. Used by the close-up fallback: with the arm
 * right up to the camera the hand is out of frame, so MediaPipe can't
 * supply the forearm axis — but the arm itself IS the skin blob, and its
 * elongation direction is a good stand-in. Returns null for a degenerate
 * blob (nearly round or empty), where orientation is meaningless. */
export function estimateSkinAxisAngleDeg(cv: any, mask: any): number | null {
	const working = mask.clone();
	const contours = new cv.MatVector();
	const hierarchy = new cv.Mat();
	try {
		cv.findContours(
			working,
			contours,
			hierarchy,
			cv.RETR_EXTERNAL,
			cv.CHAIN_APPROX_SIMPLE
		);
		let largestIndex = -1;
		let largestArea = 0;
		for (let index = 0; index < contours.size(); index++) {
			const contour = contours.get(index);
			const area = cv.contourArea(contour, false);
			contour.delete();
			if (area > largestArea) {
				largestArea = area;
				largestIndex = index;
			}
		}
		if (largestIndex < 0) return null;

		const largest = contours.get(largestIndex);
		try {
			const moments = cv.moments(largest, false);
			if (moments.m00 < 1) return null;
			const mu20 = moments.mu20 / moments.m00;
			const mu02 = moments.mu02 / moments.m00;
			const mu11 = moments.mu11 / moments.m00;
			if (Math.abs(mu20 - mu02) < 1e-3 && Math.abs(mu11) < 1e-3) return null;
			return (0.5 * Math.atan2(2 * mu11, mu20 - mu02) * 180) / Math.PI;
		} finally {
			largest.delete();
		}
	} finally {
		working.delete();
		contours.delete();
		hierarchy.delete();
	}
}

/**
 * Estimates the arm axis only around the tracked marker. This prevents a
 * skin-colored wall, ceiling, or hand elsewhere in the frame from rotating
 * the tattoo.
 */
export function estimateLocalSkinAxisAngleDeg(
	cv: any,
	mask: any,
	center: { x: number; y: number },
	radius: number
): number | null {
	const left = Math.max(0, Math.floor(center.x - radius));
	const top = Math.max(0, Math.floor(center.y - radius));
	const right = Math.min(mask.cols, Math.ceil(center.x + radius));
	const bottom = Math.min(mask.rows, Math.ceil(center.y + radius));
	if (right - left < 16 || bottom - top < 16) return null;

	const roi = mask.roi(new cv.Rect(left, top, right - left, bottom - top));
	const working = roi.clone();
	const contours = new cv.MatVector();
	const hierarchy = new cv.Mat();
	try {
		cv.findContours(
			working,
			contours,
			hierarchy,
			cv.RETR_EXTERNAL,
			cv.CHAIN_APPROX_SIMPLE
		);
		const localCenter = new cv.Point(center.x - left, center.y - top);
		let selectedIndex = -1;
		let selectedArea = 0;
		let fallbackIndex = -1;
		let fallbackArea = 0;

		for (let index = 0; index < contours.size(); index++) {
			const contour = contours.get(index);
			const area = cv.contourArea(contour, false);
			if (area > fallbackArea) {
				fallbackArea = area;
				fallbackIndex = index;
			}
			if (
				area > selectedArea &&
				cv.pointPolygonTest(contour, localCenter, false) >= 0
			) {
				selectedArea = area;
				selectedIndex = index;
			}
			contour.delete();
		}
		const index = selectedIndex >= 0 ? selectedIndex : fallbackIndex;
		if (index < 0) return null;

		const contour = contours.get(index);
		try {
			const moments = cv.moments(contour, false);
			if (moments.m00 < 1) return null;
			const mu20 = moments.mu20 / moments.m00;
			const mu02 = moments.mu02 / moments.m00;
			const mu11 = moments.mu11 / moments.m00;
			if (Math.abs(mu20 - mu02) < 1e-3 && Math.abs(mu11) < 1e-3) return null;
			return (0.5 * Math.atan2(2 * mu11, mu20 - mu02) * 180) / Math.PI;
		} finally {
			contour.delete();
		}
	} finally {
		roi.delete();
		working.delete();
		contours.delete();
		hierarchy.delete();
	}
}
