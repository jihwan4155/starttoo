import { ApiError } from "../../services/api";

export type SearchErrorInfo = {
	message: string;
	/** 재시도 버튼을 노출할지 */
	retryable: boolean;
	/** 로그인 유도가 필요한지 */
	needsLogin: boolean;
};

/**
 * 검색 실패를 화면 안내로 바꾼다.
 *
 * <p>400이 두 종류라서 status만 보면 안내가 뭉개진다. 마스크 크기 초과는
 * MASK_TOO_LARGE 코드로 오므로 code를 먼저 보고 status로 폴백한다.
 *
 * <p>503은 앱이 죽은 게 아니다. 검색 엔진이 부팅 직후 워밍업 중이거나 동시 요청이
 * 몰릴 때 정상적으로 발생하고, 서버 설정으로 검색이 꺼져 있을 때도 503이다.
 */
export function describeSearchError(error: unknown): SearchErrorInfo {
	if (!(error instanceof ApiError)) {
		return {
			message: "도안을 찾지 못했어요. 잠시 후 다시 시도해주세요.",
			retryable: true,
			needsLogin: false,
		};
	}

	if (error.code === "MASK_TOO_LARGE") {
		return {
			message: "그린 형태가 너무 복잡해요. 조금 단순하게 다시 그려주세요.",
			retryable: false,
			needsLogin: false,
		};
	}

	switch (error.status) {
		case 400:
			// 서버가 실어 준 사유("PNG 디코딩 실패" 등)는 사용자가 손댈 수 있는 말이
			// 아니라 화면에 붙이지 않는다. 다시 그리면 되는 상황이므로 그것만 알린다.
			return {
				message: "이미지를 처리할 수 없어요. 다시 그려주세요.",
				retryable: false,
				needsLogin: false,
			};
		case 401:
			return {
				message: "로그인이 만료됐어요. 다시 로그인한 뒤 시도해주세요.",
				retryable: false,
				needsLogin: true,
			};
		case 429:
			return {
				message: "요청이 많습니다. 잠시 후 다시 시도해주세요.",
				retryable: true,
				needsLogin: false,
			};
		case 503:
			return {
				message: "검색 준비 중입니다. 잠시 후 다시 시도해주세요.",
				retryable: true,
				needsLogin: false,
			};
		default:
			return {
				// 네트워크 실패(status 0)와 나머지 5xx
				message:
					error.status >= 500 || error.status === 0
						? "일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요."
						: error.message,
				retryable: true,
				needsLogin: false,
			};
	}
}
