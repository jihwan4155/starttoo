/*
 * QR Code generator (byte mode) — 의존성 없는 순수 TS 구현.
 * Nayuki QR Code generator(MIT License)를 프로젝트 용도에 맞게 축약·이식했다.
 * encodeText(text)로 실제 스캔 가능한 QR 모듈 행렬(boolean[][])을 얻는다.
 */

type Ecc = { ordinal: number; formatBits: number };

const ECC_LOW: Ecc = { ordinal: 0, formatBits: 1 };
const ECC_MEDIUM: Ecc = { ordinal: 1, formatBits: 0 };
const ECC_QUARTILE: Ecc = { ordinal: 2, formatBits: 3 };
const ECC_HIGH: Ecc = { ordinal: 3, formatBits: 2 };

const MIN_VERSION = 1;
const MAX_VERSION = 40;
const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

// prettier-ignore
const ECC_CODEWORDS_PER_BLOCK: number[][] = [
	[-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
	[-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
	[-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
	[-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];

// prettier-ignore
const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
	[-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
	[-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
	[-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
	[-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

/** GF(256) 곱셈 */
function reedSolomonMultiply(x: number, y: number): number {
	let z = 0;
	for (let i = 7; i >= 0; i--) {
		z = (z << 1) ^ ((z >>> 7) * 0x11d);
		z ^= ((y >>> i) & 1) * x;
	}
	return z & 0xff;
}

function reedSolomonComputeDivisor(degree: number): number[] {
	const result: number[] = [];
	for (let i = 0; i < degree - 1; i++) result.push(0);
	result.push(1);
	let root = 1;
	for (let i = 0; i < degree; i++) {
		for (let j = 0; j < result.length; j++) {
			result[j] = reedSolomonMultiply(result[j], root);
			if (j + 1 < result.length) result[j] ^= result[j + 1];
		}
		root = reedSolomonMultiply(root, 0x02);
	}
	return result;
}

function reedSolomonComputeRemainder(data: number[], divisor: number[]): number[] {
	const result = divisor.map(() => 0);
	for (const b of data) {
		const factor = b ^ (result.shift() as number);
		result.push(0);
		divisor.forEach((coef, i) => {
			result[i] ^= reedSolomonMultiply(coef, factor);
		});
	}
	return result;
}

function getNumRawDataModules(ver: number): number {
	let result = (16 * ver + 128) * ver + 64;
	if (ver >= 2) {
		const numAlign = Math.floor(ver / 7) + 2;
		result -= (25 * numAlign - 10) * numAlign - 55;
		if (ver >= 7) result -= 36;
	}
	return result;
}

function getNumDataCodewords(ver: number, ecl: Ecc): number {
	return (
		Math.floor(getNumRawDataModules(ver) / 8) -
		ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver] *
			NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver]
	);
}

class QrCode {
	readonly size: number;
	readonly version: number;
	readonly errorCorrectionLevel: Ecc;
	private readonly modules: boolean[][] = [];
	private readonly isFunction: boolean[][] = [];

	constructor(
		version: number,
		errorCorrectionLevel: Ecc,
		dataCodewords: number[],
		msk: number,
	) {
		this.version = version;
		this.errorCorrectionLevel = errorCorrectionLevel;
		if (version < MIN_VERSION || version > MAX_VERSION)
			throw new RangeError("Version out of range");
		this.size = version * 4 + 17;
		for (let i = 0; i < this.size; i++) {
			this.modules.push(new Array(this.size).fill(false));
			this.isFunction.push(new Array(this.size).fill(false));
		}

		this.drawFunctionPatterns();
		const allCodewords = this.addEccAndInterleave(dataCodewords);
		this.drawCodewords(allCodewords);

		let mask = msk;
		if (mask === -1) {
			let minPenalty = Infinity;
			for (let i = 0; i < 8; i++) {
				this.applyMask(i);
				this.drawFormatBits(i);
				const penalty = this.getPenaltyScore();
				if (penalty < minPenalty) {
					mask = i;
					minPenalty = penalty;
				}
				this.applyMask(i);
			}
		}
		this.applyMask(mask);
		this.drawFormatBits(mask);
	}

	getModule(x: number, y: number): boolean {
		return (
			x >= 0 && x < this.size && y >= 0 && y < this.size && this.modules[y][x]
		);
	}

	/** 스캔 가능한 모듈 행렬 반환 (true=검정) */
	getMatrix(): boolean[][] {
		return this.modules.map((row) => row.slice());
	}

	private drawFunctionPatterns(): void {
		for (let i = 0; i < this.size; i++) {
			this.setFunctionModule(6, i, i % 2 === 0);
			this.setFunctionModule(i, 6, i % 2 === 0);
		}
		this.drawFinderPattern(3, 3);
		this.drawFinderPattern(this.size - 4, 3);
		this.drawFinderPattern(3, this.size - 4);

		const alignPatPos = this.getAlignmentPatternPositions();
		const numAlign = alignPatPos.length;
		for (let i = 0; i < numAlign; i++) {
			for (let j = 0; j < numAlign; j++) {
				if (
					!(
						(i === 0 && j === 0) ||
						(i === 0 && j === numAlign - 1) ||
						(i === numAlign - 1 && j === 0)
					)
				)
					this.drawAlignmentPattern(alignPatPos[i], alignPatPos[j]);
			}
		}

		this.drawFormatBits(0);
		this.drawVersion();
	}

	private drawFormatBits(mask: number): void {
		const data = (this.errorCorrectionLevel.formatBits << 3) | mask;
		let rem = data;
		for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
		const bits = ((data << 10) | rem) ^ 0x5412;

		for (let i = 0; i <= 5; i++) this.setFunctionModule(8, i, getBit(bits, i));
		this.setFunctionModule(8, 7, getBit(bits, 6));
		this.setFunctionModule(8, 8, getBit(bits, 7));
		this.setFunctionModule(7, 8, getBit(bits, 8));
		for (let i = 9; i < 15; i++)
			this.setFunctionModule(14 - i, 8, getBit(bits, i));

		for (let i = 0; i < 8; i++)
			this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
		for (let i = 8; i < 15; i++)
			this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
		this.setFunctionModule(8, this.size - 8, true);
	}

	private drawVersion(): void {
		if (this.version < 7) return;
		let rem = this.version;
		for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
		const bits = (this.version << 12) | rem;

		for (let i = 0; i < 18; i++) {
			const bit = getBit(bits, i);
			const a = this.size - 11 + (i % 3);
			const b = Math.floor(i / 3);
			this.setFunctionModule(a, b, bit);
			this.setFunctionModule(b, a, bit);
		}
	}

	private drawFinderPattern(x: number, y: number): void {
		for (let dy = -4; dy <= 4; dy++) {
			for (let dx = -4; dx <= 4; dx++) {
				const dist = Math.max(Math.abs(dx), Math.abs(dy));
				const xx = x + dx;
				const yy = y + dy;
				if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size)
					this.setFunctionModule(xx, yy, dist !== 2 && dist !== 4);
			}
		}
	}

	private drawAlignmentPattern(x: number, y: number): void {
		for (let dy = -2; dy <= 2; dy++) {
			for (let dx = -2; dx <= 2; dx++) {
				this.setFunctionModule(
					x + dx,
					y + dy,
					Math.max(Math.abs(dx), Math.abs(dy)) !== 1,
				);
			}
		}
	}

	private setFunctionModule(x: number, y: number, isDark: boolean): void {
		this.modules[y][x] = isDark;
		this.isFunction[y][x] = true;
	}

	private addEccAndInterleave(data: number[]): number[] {
		const ver = this.version;
		const ecl = this.errorCorrectionLevel;
		const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
		const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver];
		const rawCodewords = Math.floor(getNumRawDataModules(ver) / 8);
		const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
		const shortBlockLen = Math.floor(rawCodewords / numBlocks);

		const blocks: number[][] = [];
		const rsDiv = reedSolomonComputeDivisor(blockEccLen);
		for (let i = 0, k = 0; i < numBlocks; i++) {
			const dat = data.slice(
				k,
				k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1),
			);
			k += dat.length;
			const ecc = reedSolomonComputeRemainder(dat, rsDiv);
			if (i < numShortBlocks) dat.push(0);
			blocks.push(dat.concat(ecc));
		}

		const result: number[] = [];
		for (let i = 0; i < blocks[0].length; i++) {
			blocks.forEach((block, j) => {
				if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks)
					result.push(block[i]);
			});
		}
		return result;
	}

	private drawCodewords(data: number[]): void {
		let i = 0;
		for (let right = this.size - 1; right >= 1; right -= 2) {
			if (right === 6) right = 5;
			for (let vert = 0; vert < this.size; vert++) {
				for (let j = 0; j < 2; j++) {
					const x = right - j;
					const upward = ((right + 1) & 2) === 0;
					const y = upward ? this.size - 1 - vert : vert;
					if (!this.isFunction[y][x] && i < data.length * 8) {
						this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
						i++;
					}
				}
			}
		}
	}

	private applyMask(mask: number): void {
		for (let y = 0; y < this.size; y++) {
			for (let x = 0; x < this.size; x++) {
				let invert = false;
				switch (mask) {
					case 0:
						invert = (x + y) % 2 === 0;
						break;
					case 1:
						invert = y % 2 === 0;
						break;
					case 2:
						invert = x % 3 === 0;
						break;
					case 3:
						invert = (x + y) % 3 === 0;
						break;
					case 4:
						invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
						break;
					case 5:
						invert = ((x * y) % 2) + ((x * y) % 3) === 0;
						break;
					case 6:
						invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
						break;
					case 7:
						invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
						break;
				}
				if (!this.isFunction[y][x] && invert)
					this.modules[y][x] = !this.modules[y][x];
			}
		}
	}

	private getPenaltyScore(): number {
		let result = 0;
		const size = this.size;

		for (let y = 0; y < size; y++) {
			let runColor = false;
			let runX = 0;
			const runHistory = [0, 0, 0, 0, 0, 0, 0];
			for (let x = 0; x < size; x++) {
				if (this.modules[y][x] === runColor) {
					runX++;
					if (runX === 5) result += PENALTY_N1;
					else if (runX > 5) result++;
				} else {
					this.finderPenaltyAddHistory(runX, runHistory);
					if (!runColor)
						result += this.finderPenaltyCountPatterns(runHistory) * PENALTY_N3;
					runColor = this.modules[y][x];
					runX = 1;
				}
			}
			result +=
				this.finderPenaltyTerminateAndCount(runColor, runX, runHistory) *
				PENALTY_N3;
		}

		for (let x = 0; x < size; x++) {
			let runColor = false;
			let runY = 0;
			const runHistory = [0, 0, 0, 0, 0, 0, 0];
			for (let y = 0; y < size; y++) {
				if (this.modules[y][x] === runColor) {
					runY++;
					if (runY === 5) result += PENALTY_N1;
					else if (runY > 5) result++;
				} else {
					this.finderPenaltyAddHistory(runY, runHistory);
					if (!runColor)
						result += this.finderPenaltyCountPatterns(runHistory) * PENALTY_N3;
					runColor = this.modules[y][x];
					runY = 1;
				}
			}
			result +=
				this.finderPenaltyTerminateAndCount(runColor, runY, runHistory) *
				PENALTY_N3;
		}

		for (let y = 0; y < size - 1; y++) {
			for (let x = 0; x < size - 1; x++) {
				const color = this.modules[y][x];
				if (
					color === this.modules[y][x + 1] &&
					color === this.modules[y + 1][x] &&
					color === this.modules[y + 1][x + 1]
				)
					result += PENALTY_N2;
			}
		}

		let dark = 0;
		for (const row of this.modules)
			dark = row.reduce((sum, color) => sum + (color ? 1 : 0), dark);
		const total = size * size;
		const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
		result += k * PENALTY_N4;
		return result;
	}

	private getAlignmentPatternPositions(): number[] {
		if (this.version === 1) return [];
		const numAlign = Math.floor(this.version / 7) + 2;
		const step =
			this.version === 32
				? 26
				: Math.ceil((this.version * 4 + 4) / (numAlign * 2 - 2)) * 2;
		const result = [6];
		for (let pos = this.size - 7; result.length < numAlign; pos -= step)
			result.splice(1, 0, pos);
		return result;
	}

	private finderPenaltyCountPatterns(runHistory: number[]): number {
		const n = runHistory[1];
		const core =
			n > 0 &&
			runHistory[2] === n &&
			runHistory[3] === n * 3 &&
			runHistory[4] === n &&
			runHistory[5] === n;
		return (
			(core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0) +
			(core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0)
		);
	}

	private finderPenaltyTerminateAndCount(
		currentRunColor: boolean,
		currentRunLength: number,
		runHistory: number[],
	): number {
		let runLen = currentRunLength;
		if (currentRunColor) {
			this.finderPenaltyAddHistory(runLen, runHistory);
			runLen = 0;
		}
		runLen += this.size;
		this.finderPenaltyAddHistory(runLen, runHistory);
		return this.finderPenaltyCountPatterns(runHistory);
	}

	private finderPenaltyAddHistory(currentRunLength: number, runHistory: number[]): void {
		if (runHistory[0] === 0) currentRunLength += this.size;
		runHistory.pop();
		runHistory.unshift(currentRunLength);
	}

	static encodeSegment(
		data: number[],
		ecl: Ecc,
	): QrCode {
		// 바이트 모드 단일 세그먼트로 인코딩
		let version = MIN_VERSION;
		let dataUsedBits = 0;
		for (; ; version++) {
			const dataCapacityBits = getNumDataCodewords(version, ecl) * 8;
			const usedBits = 4 + getCharCountBits(version) + data.length * 8;
			if (usedBits <= dataCapacityBits) {
				dataUsedBits = usedBits;
				break;
			}
			if (version >= MAX_VERSION) throw new RangeError("Data too long");
		}

		const bb: number[] = [];
		appendBits(0x4, 4, bb); // 바이트 모드 지시자
		appendBits(data.length, getCharCountBits(version), bb);
		for (const b of data) appendBits(b, 8, bb);

		const dataCapacityBits = getNumDataCodewords(version, ecl) * 8;
		appendBits(0, Math.min(4, dataCapacityBits - dataUsedBits), bb);
		appendBits(0, (8 - (bb.length % 8)) % 8, bb);
		for (let padByte = 0xec; bb.length < dataCapacityBits; padByte ^= 0xec ^ 0x11)
			appendBits(padByte, 8, bb);

		const dataCodewords: number[] = new Array(bb.length >>> 3).fill(0);
		bb.forEach((bit, i) => {
			dataCodewords[i >>> 3] |= bit << (7 - (i & 7));
		});

		return new QrCode(version, ecl, dataCodewords, -1);
	}
}

function getCharCountBits(version: number): number {
	// 바이트 모드 기준 문자 수 비트폭
	if (version <= 9) return 8;
	return 16;
}

function appendBits(val: number, len: number, bb: number[]): void {
	for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1);
}

function getBit(x: number, i: number): boolean {
	return ((x >>> i) & 1) !== 0;
}

/** UTF-8 바이트 배열로 변환 */
function toUtf8Bytes(str: string): number[] {
	const encoder = new TextEncoder();
	return Array.from(encoder.encode(str));
}

export type EccName = "L" | "M" | "Q" | "H";

const ECC_MAP: Record<EccName, Ecc> = {
	L: ECC_LOW,
	M: ECC_MEDIUM,
	Q: ECC_QUARTILE,
	H: ECC_HIGH,
};

/**
 * 텍스트(URL 등)를 스캔 가능한 QR 모듈 행렬로 인코딩한다.
 * @returns boolean[][] — true가 검정 모듈. matrix[y][x]
 */
export function encodeText(text: string, ecc: EccName = "M"): boolean[][] {
	const qr = QrCode.encodeSegment(toUtf8Bytes(text), ECC_MAP[ecc]);
	return qr.getMatrix();
}
