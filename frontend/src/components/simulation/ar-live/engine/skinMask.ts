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

// 임계값을 중립(Cr=Cb=128) 쪽으로 넓히면 안 된다. 실측해 보면 피부는
// Cr≈153 / Cb≈107인데 따뜻한 조명 아래 흰 벽이 Cr≈130 / Cb≈124라, 하한을
// 130까지만 내려도 벽 전체가 피부로 잡혀 타투가 배경으로 새어나갔다.
// 그래서 범위는 아래 하나로 고정하고, 배경 분리는 색이 아니라 연결 성분
// (keepComponentAt)으로 처리한다 — 나무 책상처럼 색만으로는 피부와 구분되지
// 않는 물체는 임계값을 어떻게 잡아도 걸러낼 수 없기 때문이다.
const SKIN_CR_MIN = 133;
const SKIN_CR_MAX = 173;
const SKIN_CB_MIN = 77;
const SKIN_CB_MAX = 127;

// 커널 크기는 640px 폭 기준으로 잡은 값이다. 실제 계산은 아래 MASK_MAX_SIDE로
// 줄여서 하고 커널도 같은 비율로 줄인다 — MORPH_CLOSE의 타원 커널은 분리가
// 안 되어 픽셀당 k² 연산이라, 640×480/25×25 조합이 갤럭시에서 400ms를 넘겼다.
// 해상도를 절반으로 낮추면 픽셀 수 1/4 × 커널 면적 1/4 = 약 16배 빨라지고,
// 마스크는 원래 부드러운 영역이라 정밀도 손실은 거의 없다.
const CLOSE_KERNEL_SIZE = 25;
const ERODE_KERNEL_SIZE = 7;
const OPEN_KERNEL_SIZE = 5;
const SMOOTH_KERNEL_SIZE = 9;

/** 형태학 연산을 수행할 최대 변 길이. */
const MASK_MAX_SIDE = 320;

/** 디버그용 출력 — 형태학 연산 전 원본 마스크 비율. */
export interface SkinMaskInfo {
	rawFraction: number;
}

/** Caller owns the returned Mat and must delete() it. */
export function computeSkinMask(cv: any, colorRoi: any, info?: SkinMaskInfo): any {
	const scale = Math.min(
		1,
		MASK_MAX_SIDE / Math.max(colorRoi.cols, colorRoi.rows)
	);
	/** 640px 기준 커널을 작업 해상도에 맞춰 줄인다 (홀수 유지). */
	const kernelSize = (base: number) =>
		Math.max(3, Math.round(base * scale) | 1);

	let working = colorRoi;
	let downscaled: any = null;
	if (scale < 1) {
		downscaled = new cv.Mat();
		cv.resize(
			colorRoi,
			downscaled,
			new cv.Size(
				Math.max(1, Math.round(colorRoi.cols * scale)),
				Math.max(1, Math.round(colorRoi.rows * scale))
			),
			0,
			0,
			cv.INTER_AREA
		);
		working = downscaled;
	}

	const rgb = new cv.Mat();
	cv.cvtColor(working, rgb, cv.COLOR_RGBA2RGB);
	const ycrcb = new cv.Mat();
	cv.cvtColor(rgb, ycrcb, cv.COLOR_RGB2YCrCb);
	rgb.delete();
	downscaled?.delete();

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

	if (info) {
		const total = mask.rows * mask.cols;
		info.rawFraction = total > 0 ? cv.countNonZero(mask) / total : 0;
	}

	const closeSize = kernelSize(CLOSE_KERNEL_SIZE);
	const closeKernel = cv.getStructuringElement(
		cv.MORPH_ELLIPSE,
		new cv.Size(closeSize, closeSize)
	);
	cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, closeKernel);
	closeKernel.delete();

	const erodeSize = kernelSize(ERODE_KERNEL_SIZE);
	const erodeKernel = cv.getStructuringElement(
		cv.MORPH_ELLIPSE,
		new cv.Size(erodeSize, erodeSize)
	);
	cv.erode(mask, mask, erodeKernel);
	erodeKernel.delete();

	const openSize = kernelSize(OPEN_KERNEL_SIZE);
	const openKernel = cv.getStructuringElement(
		cv.MORPH_ELLIPSE,
		new cv.Size(openSize, openSize)
	);
	cv.morphologyEx(mask, mask, cv.MORPH_OPEN, openKernel);
	openKernel.delete();
	const smoothSize = kernelSize(SMOOTH_KERNEL_SIZE);
	cv.GaussianBlur(mask, mask, new cv.Size(smoothSize, smoothSize), 0);
	cv.threshold(mask, mask, 127, 255, cv.THRESH_BINARY);

	// 호출부는 원본 해상도의 마스크를 기대한다 (인물 마스크와 bitwise_and,
	// 합성 클리핑 모두 원본 좌표계 기준).
	if (scale < 1) {
		const full = new cv.Mat();
		try {
			cv.resize(
				mask,
				full,
				new cv.Size(colorRoi.cols, colorRoi.rows),
				0,
				0,
				cv.INTER_NEAREST
			);
			mask.delete();
			return full;
		} catch (error) {
			full.delete();
			throw error;
		}
	}

	return mask;
}

/**
 * 마스크에서 `point`가 속한 연결 성분 하나만 남긴 새 마스크를 돌려준다.
 * 없으면 null (호출부가 원본 마스크를 그대로 쓰도록).
 *
 * 색 임계값만으로는 배경을 못 거른다 — 따뜻한 흰 벽, 나무 책상, 살구빛 옷은
 * 피부와 Cr/Cb가 겹치고, 임계값을 좁히면 이번엔 팔이 깎인다. 하지만 마커가
 * 찍힌 곳은 반드시 팔이므로, 마커를 품은 덩어리만 남기면 배경이 무슨 색이든
 * (흰 벽이든 검은 배경이든) 전부 떨어져 나간다. 팔 자체는 한 덩어리라
 * 마스크가 줄어들지도 않는다.
 *
 * Caller owns the returned Mat and must delete() it.
 */
export function keepComponentAt(
	cv: any,
	mask: any,
	point: { x: number; y: number }
): any {
	const x = Math.round(point.x);
	const y = Math.round(point.y);
	if (x < 0 || y < 0 || x >= mask.cols || y >= mask.rows) return null;

	const labels = new cv.Mat();
	try {
		const count = cv.connectedComponents(mask, labels, 8, cv.CV_32S);
		if (count <= 1) return null;
		const labelData = labels.data32S as Int32Array;
		let target = labelData[y * mask.cols + x];

		// 마커가 잉크 때문에 마스크 구멍 위에 떨어질 수 있다. 그럴 땐 주변을
		// 조금 훑어 가장 가까운 성분을 집는다.
		if (target === 0) {
			const radius = Math.max(4, Math.round(Math.min(mask.cols, mask.rows) * 0.03));
			search: for (let r = 1; r <= radius; r++) {
				for (let dy = -r; dy <= r; dy++) {
					for (let dx = -r; dx <= r; dx++) {
						if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
						const nx = x + dx;
						const ny = y + dy;
						if (nx < 0 || ny < 0 || nx >= mask.cols || ny >= mask.rows) continue;
						const label = labelData[ny * mask.cols + nx];
						if (label !== 0) {
							target = label;
							break search;
						}
					}
				}
			}
		}
		if (target === 0) return null;

		const isolated = cv.Mat.zeros(mask.rows, mask.cols, cv.CV_8UC1);
		const out = isolated.data as Uint8Array;
		for (let index = 0; index < labelData.length; index++) {
			if (labelData[index] === target) out[index] = 255;
		}
		return isolated;
	} finally {
		labels.delete();
	}
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
