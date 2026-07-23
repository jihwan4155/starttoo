/** POST /api/convert 응답의 outputs 항목 */
export type DesignExtractOutput = {
	id: string;
	preview_url: string;
	download_url: string;
};

/** POST /api/convert 응답 */
export type DesignExtractResponse = {
	ok: boolean;
	outputs: DesignExtractOutput[];
};

/** 프론트에서 사용하는 도안 추출 결과 (절대 URL로 변환됨) */
export type DesignExtractResult = {
	/** 화면 표시용 이미지 URL */
	previewUrl: string;
	/** PNG 다운로드 URL */
	downloadUrl: string;
};

/** 내 도안 보관함에 저장된 도안 */
export type SavedDesign = DesignExtractResult & {
	id: number;
	createdAt: string;
};
