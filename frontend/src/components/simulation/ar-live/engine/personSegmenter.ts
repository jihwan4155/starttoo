/* eslint-disable @typescript-eslint/no-explicit-any */
// 사람/배경을 직접 가르는 마스크. 피부색(Cr/Cb)만으로는 따뜻한 흰 벽·나무
// 책상·살구빛 옷을 걸러낼 수 없고(실측: 벽 Cr≈130, 책상 Cr≈150 — 피부와 겹침),
// 임계값을 좁히면 이번엔 팔이 깎인다. 인물 분할을 교집합으로 걸면 배경이 무슨
// 색이든 무관해진다.
//
// URL은 inkproof/image-engine.ts와 **같은 것**을 쓴다. 그래야 그 기능에서 이미
// 받아둔 CDN 캐시를 그대로 재사용해 추가 다운로드가 생기지 않는다.
import type { ImageSegmenter } from "@mediapipe/tasks-vision";

const MEDIAPIPE_WASM_ROOT =
	"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const PERSON_MODEL_URL =
	"https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite";

/** 인물로 볼 최소 신뢰도. */
const PERSON_CONFIDENCE = 0.5;

let segmenterPromise: Promise<ImageSegmenter | null> | null = null;

/**
 * 세그멘터를 미리 받아둔다. WASM이 10MB대라 카메라를 켠 뒤에 받기 시작하면
 * 첫 몇 초가 비므로, 도안 선택처럼 앞선 화면에서 불러 두는 용도.
 */
export function warmUpPersonSegmenter(): void {
	void loadPersonSegmenter();
}

/**
 * 실패해도 throw하지 않고 null을 돌려준다 — 모델을 못 받는 환경(오프라인,
 * CDN 차단)에서도 AR 자체는 기존 피부 마스크만으로 계속 동작해야 한다.
 */
export function loadPersonSegmenter(): Promise<ImageSegmenter | null> {
	if (!segmenterPromise) {
		segmenterPromise = (async () => {
			try {
				const { FilesetResolver, ImageSegmenter } = await import(
					"@mediapipe/tasks-vision"
				);
				const vision =
					await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_ROOT);
				return await ImageSegmenter.createFromOptions(vision, {
					baseOptions: { modelAssetPath: PERSON_MODEL_URL },
					runningMode: "VIDEO",
					outputCategoryMask: false,
					outputConfidenceMasks: true,
				});
			} catch (error) {
				console.warn("[ar-live] 인물 세그멘터를 쓸 수 없습니다", error);
				return null;
			}
		})();
	}
	return segmenterPromise;
}

/**
 * 현재 비디오 프레임의 인물 영역을 width×height 크기의 0/255 마스크로 만든다.
 * 실패하면 null (호출부가 인물 분할 없이 진행하도록).
 *
 * `timestampMs`는 VIDEO 모드 요구사항상 호출마다 증가해야 한다.
 *
 * Caller owns the returned Mat and must delete() it.
 */
export function personMaskFromVideo(
	cv: any,
	segmenter: ImageSegmenter,
	video: HTMLVideoElement,
	timestampMs: number,
	width: number,
	height: number
): any {
	let result: any = null;
	try {
		result = segmenter.segmentForVideo(video, timestampMs);
	} catch (error) {
		console.warn("[ar-live] 인물 분할 실패", error);
		return null;
	}
	const masks = result?.confidenceMasks;
	// 이 모델은 0번이 "배경" 신뢰도다. 나머지(피부·머리·옷·액세서리)를 전부
	// 인물로 묶어야 소매·장갑 근처에서 팔이 잘리지 않는다.
	const backgroundMask = masks?.[0];
	if (!backgroundMask) {
		masks?.forEach((mask: any) => mask.close());
		return null;
	}

	let small: any = null;
	let resized: any = null;
	try {
		const background = backgroundMask.getAsFloat32Array();
		const maskWidth = backgroundMask.width;
		const maskHeight = backgroundMask.height;
		const binary = new Uint8Array(background.length);
		for (let index = 0; index < background.length; index++) {
			binary[index] = 1 - background[index] >= PERSON_CONFIDENCE ? 255 : 0;
		}
		small = cv.matFromArray(maskHeight, maskWidth, cv.CV_8UC1, binary);
		resized = new cv.Mat();
		cv.resize(small, resized, new cv.Size(width, height), 0, 0, cv.INTER_NEAREST);
		const output = resized;
		resized = null;
		return output;
	} catch (error) {
		console.warn("[ar-live] 인물 마스크 변환 실패", error);
		resized?.delete();
		return null;
	} finally {
		small?.delete();
		masks?.forEach((mask: any) => mask.close());
	}
}
