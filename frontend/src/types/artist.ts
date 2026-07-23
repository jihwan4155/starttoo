// TODO: 백엔드 타투이스트 스펙(GET /artists) 확정되면 동기화
export type Artist = {
	id: number;
	name: string;
	/** 현재 영업 중 여부 */
	isOpen: boolean;
	/** 영업 시간 표시 문구 (예: "22:00에 영업 종료") */
	hoursLabel: string;
	/** 현재 위치 기준 거리 (km, null이면 미표시) */
	distanceKm: number | null;
	address: string;
	/** 작업 장르 태그 */
	categories: string[];
	/** 대표 작업물 이미지 URL (없으면 placeholder) */
	imageUrls: string[];
};
