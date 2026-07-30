/** 부위 마스크 PNG 색상 → 부위 ID (앞·뒤 2장 공통) */
export const MANNEQUIN_PART = {
	NONE: 0,
	TORSO: 2,
	LEFT_ARM: 3,
	RIGHT_ARM: 4,
	LEFT_LEG: 5,
	RIGHT_LEG: 6,
} as const;

export type MannequinPartId =
	(typeof MANNEQUIN_PART)[keyof typeof MANNEQUIN_PART];

export type MannequinPartMask = {
	data: Uint8Array;
	width: number;
	height: number;
	canvas: HTMLCanvasElement;
};

/** 허용 부위 + 경계(NONE) 채움 여부 */
export type PartClipRule = {
	allowed: ReadonlySet<MannequinPartId>;
	allowNone: boolean;
};

const SHOULDER_Y_MIN = 0.14;
const SHOULDER_Y_MAX = 0.38;
/** 팔쪽 x — 중앙 몸통과 구분 */
const ARM_LATERAL_X = 0.32;
/** 복부~가랑이·허벅지 상단 — 몸통+해당 다리 */
const HIP_Y_MIN = 0.32;
const HIP_Y_MAX = 0.58;

function rotatePoint(x: number, y: number, angleRad: number) {
	const cos = Math.cos(angleRad);
	const sin = Math.sin(angleRad);
	return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function partSet(...parts: MannequinPartId[]): ReadonlySet<MannequinPartId> {
	return new Set(parts);
}

function isOnArmSide(x: number): boolean {
	return x < ARM_LATERAL_X || x > 1 - ARM_LATERAL_X;
}

type PartVotes = {
	leftArm: number;
	rightArm: number;
	leftLeg: number;
	rightLeg: number;
	torso: number;
};

function getPartVotes(counts: Map<MannequinPartId, number>): PartVotes {
	return {
		leftArm: counts.get(MANNEQUIN_PART.LEFT_ARM) ?? 0,
		rightArm: counts.get(MANNEQUIN_PART.RIGHT_ARM) ?? 0,
		leftLeg: counts.get(MANNEQUIN_PART.LEFT_LEG) ?? 0,
		rightLeg: counts.get(MANNEQUIN_PART.RIGHT_LEG) ?? 0,
		torso: counts.get(MANNEQUIN_PART.TORSO) ?? 0,
	};
}

export function decodePartIdFromPixel(r: number, g: number, b: number): MannequinPartId {
	if (g >= 140 && g >= r + 25 && g >= b + 25) return MANNEQUIN_PART.TORSO;
	if (r >= 190 && g >= 140 && b < 130) return MANNEQUIN_PART.RIGHT_ARM;
	if (b >= 190 && g >= 140 && r < 130) return MANNEQUIN_PART.LEFT_ARM;
	if (r >= 160 && b >= 180 && g < 130) return MANNEQUIN_PART.RIGHT_LEG;
	if (b >= 180 && r >= 60 && r <= 140 && g < 130) return MANNEQUIN_PART.LEFT_LEG;
	return MANNEQUIN_PART.NONE;
}

export function samplePartId(
	partMask: MannequinPartMask,
	canvasX: number,
	canvasY: number,
	canvasWidth: number,
	canvasHeight: number,
): MannequinPartId {
	const scaleX = partMask.width / canvasWidth;
	const scaleY = partMask.height / canvasHeight;
	const x = Math.min(
		partMask.width - 1,
		Math.max(0, Math.round(canvasX * scaleX)),
	);
	const y = Math.min(
		partMask.height - 1,
		Math.max(0, Math.round(canvasY * scaleY)),
	);
	return (partMask.data[y * partMask.width + x] ?? MANNEQUIN_PART.NONE) as MannequinPartId;
}

function countFootprintParts(
	partMask: MannequinPartMask,
	centerX: number,
	centerY: number,
	halfW: number,
	halfH: number,
	rotationRad: number,
	canvasWidth: number,
	canvasHeight: number,
) {
	const counts = new Map<MannequinPartId, number>();
	for (const dy of [-0.5, -0.25, 0, 0.25, 0.5]) {
		for (const dx of [-0.5, -0.25, 0, 0.25, 0.5]) {
			const local = rotatePoint(dx * halfW * 2, dy * halfH * 2, rotationRad);
			const part = samplePartId(
				partMask,
				centerX + local.x,
				centerY + local.y,
				canvasWidth,
				canvasHeight,
			);
			if (part === MANNEQUIN_PART.NONE) continue;
			counts.set(part, (counts.get(part) ?? 0) + 1);
		}
	}
	return counts;
}

function pickPluralityPart(counts: Map<MannequinPartId, number>): MannequinPartId {
	let best: MannequinPartId = MANNEQUIN_PART.NONE;
	let bestCount = 0;
	for (const [part, count] of counts) {
		if (count > bestCount) {
			bestCount = count;
			best = part;
		} else if (count === bestCount && part === MANNEQUIN_PART.TORSO) {
			best = part;
		}
	}
	return best;
}

function inferArmPart(
	x: number,
	counts: Map<MannequinPartId, number>,
): MannequinPartId {
	const votes = getPartVotes(counts);
	if (votes.rightArm > votes.leftArm && votes.rightArm > 0) {
		return MANNEQUIN_PART.RIGHT_ARM;
	}
	if (votes.leftArm > votes.rightArm && votes.leftArm > 0) {
		return MANNEQUIN_PART.LEFT_ARM;
	}
	return x < 0.5 ? MANNEQUIN_PART.RIGHT_ARM : MANNEQUIN_PART.LEFT_ARM;
}

/** 중심·footprint 기준 팔 구역 — 중심이 몸통이면 옆구리/복부는 제외 */
function isArmRegion(
	x: number,
	y: number,
	votes: PartVotes,
	centerPart: MannequinPartId,
): boolean {
	if (
		centerPart === MANNEQUIN_PART.LEFT_ARM ||
		centerPart === MANNEQUIN_PART.RIGHT_ARM
	) {
		return true;
	}

	// 옆구리·복부 등 몸통 중심 배치는 팔 구역으로 보지 않음
	if (centerPart === MANNEQUIN_PART.TORSO) {
		return false;
	}

	const armVotes = votes.leftArm + votes.rightArm;
	const legVotes = votes.leftLeg + votes.rightLeg;

	if (armVotes > votes.torso && armVotes >= legVotes) {
		return true;
	}

	return (
		isOnArmSide(x) &&
		y >= SHOULDER_Y_MIN &&
		y <= 0.62 &&
		armVotes > votes.torso
	);
}

function isLegRegion(
	x: number,
	y: number,
	votes: PartVotes,
	centerPart: MannequinPartId,
): boolean {
	if (
		centerPart === MANNEQUIN_PART.LEFT_LEG ||
		centerPart === MANNEQUIN_PART.RIGHT_LEG
	) {
		return true;
	}

	const legVotes = votes.leftLeg + votes.rightLeg;
	if (y < HIP_Y_MIN) return false;
	if (isOnArmSide(x) && isArmRegion(x, y, votes, centerPart)) return false;

	if (legVotes > 0) return true;
	return (
		y >= HIP_Y_MIN &&
		y <= HIP_Y_MAX &&
		centerPart === MANNEQUIN_PART.TORSO &&
		!isOnArmSide(x)
	);
}

/** 어깨·겨드랑이: 몸통+팔 / 팔 중·하단: 해당 팔만 */
function resolveShoulderArmComposite(
	x: number,
	y: number,
	counts: Map<MannequinPartId, number>,
	centerPart: MannequinPartId,
): MannequinPartId | null {
	const inShoulderBand = y >= SHOULDER_Y_MIN && y <= SHOULDER_Y_MAX;
	if (!inShoulderBand) return null;

	const votes = getPartVotes(counts);
	const armVotes = votes.leftArm + votes.rightArm;
	const armPart = inferArmPart(x, counts);

	if (centerPart === MANNEQUIN_PART.TORSO && armVotes > 0) {
		return armPart;
	}
	if (
		centerPart === MANNEQUIN_PART.LEFT_ARM ||
		centerPart === MANNEQUIN_PART.RIGHT_ARM
	) {
		return centerPart;
	}
	if (votes.torso > 0 && armVotes > 0) {
		return armPart;
	}
	return null;
}

/** 어깨·겨드랑이: 몸통+팔 / 팔 중·하단: 해당 팔만 */
function resolveArmClipRule(
	x: number,
	y: number,
	counts: Map<MannequinPartId, number>,
	centerPart: MannequinPartId,
): PartClipRule {
	const armPart = inferArmPart(x, counts);
	const centerIsArm =
		centerPart === MANNEQUIN_PART.LEFT_ARM ||
		centerPart === MANNEQUIN_PART.RIGHT_ARM;
	const activeArm = centerIsArm ? centerPart : armPart;

	const compositeArm = resolveShoulderArmComposite(x, y, counts, centerPart);
	if (compositeArm !== null) {
		return {
			allowed: partSet(MANNEQUIN_PART.TORSO, compositeArm),
			allowNone: true,
		};
	}

	if (centerPart === MANNEQUIN_PART.TORSO) {
		return { allowed: partSet(MANNEQUIN_PART.TORSO), allowNone: true };
	}

	return { allowed: partSet(activeArm), allowNone: true };
}

/** 복부~가랑이·허벅지 상단: 몸통+해당 다리, 중앙은 양다리 */
function resolveHipClipRule(
	x: number,
	counts: Map<MannequinPartId, number>,
): PartClipRule {
	const votes = getPartVotes(counts);
	const spansBothLegs = votes.leftLeg > 0 && votes.rightLeg > 0;
	const centerGroin = x > 0.41 && x < 0.59;

	if (spansBothLegs || centerGroin) {
		return {
			allowed: partSet(
				MANNEQUIN_PART.TORSO,
				MANNEQUIN_PART.LEFT_LEG,
				MANNEQUIN_PART.RIGHT_LEG,
			),
			allowNone: true,
		};
	}

	if (votes.rightLeg > votes.leftLeg || x < 0.5) {
		return {
			allowed: partSet(MANNEQUIN_PART.TORSO, MANNEQUIN_PART.RIGHT_LEG),
			allowNone: true,
		};
	}
	return {
		allowed: partSet(MANNEQUIN_PART.TORSO, MANNEQUIN_PART.LEFT_LEG),
		allowNone: true,
	};
}

function resolveStandardClipRule(centerPart: MannequinPartId): PartClipRule {
	switch (centerPart) {
		case MANNEQUIN_PART.LEFT_ARM:
			return { allowed: partSet(MANNEQUIN_PART.LEFT_ARM), allowNone: true };
		case MANNEQUIN_PART.RIGHT_ARM:
			return { allowed: partSet(MANNEQUIN_PART.RIGHT_ARM), allowNone: true };
		case MANNEQUIN_PART.LEFT_LEG:
			return {
				allowed: partSet(
					MANNEQUIN_PART.LEFT_LEG,
					MANNEQUIN_PART.TORSO,
					MANNEQUIN_PART.RIGHT_ARM,
				),
				allowNone: true,
			};
		case MANNEQUIN_PART.RIGHT_LEG:
			return {
				allowed: partSet(
					MANNEQUIN_PART.RIGHT_LEG,
					MANNEQUIN_PART.TORSO,
					MANNEQUIN_PART.LEFT_ARM,
				),
				allowNone: true,
			};
		case MANNEQUIN_PART.TORSO:
			return { allowed: partSet(MANNEQUIN_PART.TORSO), allowNone: true };
		default:
			return { allowed: partSet(), allowNone: true };
	}
}

/** 배치 위치·footprint 기준 클립 규칙 */
export function resolvePartClipRule(
	partMask: MannequinPartMask,
	placement: { x: number; y: number; scale: number; rotation: number },
	canvasWidth: number,
	canvasHeight: number,
	tattooAspect: number,
): PartClipRule {
	const centerX = placement.x * canvasWidth;
	const centerY = placement.y * canvasHeight;
	const halfW = (placement.scale * canvasWidth) / 2;
	const halfH = halfW * tattooAspect;
	const rotationRad = (placement.rotation * Math.PI) / 180;
	const counts = countFootprintParts(
		partMask,
		centerX,
		centerY,
		halfW,
		halfH,
		rotationRad,
		canvasWidth,
		canvasHeight,
	);

	const centerPart = samplePartId(
		partMask,
		centerX,
		centerY,
		canvasWidth,
		canvasHeight,
	);
	const votes = getPartVotes(counts);
	const { x, y } = placement;

	// 몸통→팔 드래그 (어깨·겨드랑이): 몸통+팔 복합
	const compositeArm = resolveShoulderArmComposite(x, y, counts, centerPart);
	if (compositeArm !== null) {
		return {
			allowed: partSet(MANNEQUIN_PART.TORSO, compositeArm),
			allowNone: true,
		};
	}

	if (isArmRegion(x, y, votes, centerPart)) {
		return resolveArmClipRule(x, y, counts, centerPart);
	}

	if (isLegRegion(x, y, votes, centerPart)) {
		if (
			centerPart === MANNEQUIN_PART.LEFT_LEG ||
			centerPart === MANNEQUIN_PART.RIGHT_LEG
		) {
			return resolveStandardClipRule(centerPart);
		}
		return resolveHipClipRule(x, counts);
	}

	if (centerPart !== MANNEQUIN_PART.NONE) {
		return resolveStandardClipRule(centerPart);
	}

	return resolveStandardClipRule(pickPluralityPart(counts));
}

export function isPixelPartAllowed(
	pixelPart: MannequinPartId,
	rule: PartClipRule,
): boolean {
	if (pixelPart === MANNEQUIN_PART.NONE) return rule.allowNone;
	return rule.allowed.has(pixelPart);
}
