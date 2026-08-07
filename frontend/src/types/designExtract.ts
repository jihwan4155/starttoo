/** 도안 결과 모달에서 사용하는 이미지 URL */
export type DesignExtractResult = {
	/**
	 * 도안 보관함 저장 API에 사용하는 타투 seq.
	 * 사진을 직접 올려 추출한 결과에는 없다 (서버에 등록된 타투가 아니다).
	 */
	tattooSeq?: number;
	/** 분류 과정에서 저장된 도안 이미지 seq */
	imageSeq?: number;
	/** 화면에 표시할 이미지 URL */
	previewUrl: string;
	/** PNG 다운로드 URL */
	downloadUrl: string;
};

/** 도안 보관함에 저장된 도안 */
export type SavedDesign = {
	id: number;
	createdAt: string;
	previewUrl: string;
	downloadUrl: string;
	/** POST /collections 요청에 사용하는 imageSeq */
	imageSeq?: number;
	/** 백엔드 도안 보관함이 아닌 로컬 샘플 도안 */
	isDemo?: boolean;
};
