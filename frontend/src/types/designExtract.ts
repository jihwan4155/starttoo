/** 도안 결과 모달에서 사용하는 이미지 URL */
export type DesignExtractResult = {
	/** 화면에 표시할 이미지 URL */
	previewUrl: string;
	/** PNG 다운로드 URL */
	downloadUrl: string;
};

/** 내 도안 보관함에 저장된 도안 */
export type SavedDesign = DesignExtractResult & {
	id: number;
	createdAt: string;
	/** POST /collections 요청에 사용하는 imageSeq */
	imageSeq?: number;
	/** 백엔드 보관함이 아닌 로컬 샘플 도안 */
	isDemo?: boolean;
};
