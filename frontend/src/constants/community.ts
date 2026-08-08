import type { ReportReasonCode } from "../types/community";

export const REPORT_REASONS: {
	code: ReportReasonCode;
	label: string;
}[] = [
	{ code: "SPAM", label: "스팸·광고" },
	{ code: "INAPPROPRIATE", label: "부적절한 콘텐츠" },
	{ code: "HARASSMENT", label: "괴롭힘·혐오" },
	{ code: "COPYRIGHT", label: "저작권 침해" },
	{ code: "OTHER", label: "기타" },
];

export const PRIMARY_STYLE_CATEGORIES = [
	{ code: "western_traditional", label: "웨스턴 트래디셔널" },
	{ code: "japanese", label: "재패니즈" },
	{ code: "realism", label: "리얼리즘" },
	{ code: "new_school", label: "뉴스쿨" },
	{ code: "minimal", label: "미니멀" },
	{ code: "abstract_experimental", label: "추상·실험" },
	{ code: "geometric", label: "지오메트릭" },
	{ code: "ornamental", label: "오너멘탈" },
	{ code: "tribal_indigenous", label: "트라이벌·인디지너스" },
	{ code: "lettering", label: "레터링" },
	{ code: "graphic_illustrative", label: "그래픽·일러스트레이티브" },
] as const;
