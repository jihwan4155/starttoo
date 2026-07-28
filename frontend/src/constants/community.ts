import type { ReportReasonCode } from "../types/community";

export const POST_UPLOAD_PURPOSE = "POST_IMAGE";

/** 일반 회원 커뮤니티 게시글 유형 */
export const DEFAULT_POST_TYPE = "USER_POST";

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

export const SEARCH_CATEGORIES = [
	"미니멀",
	"블랙워크",
	"올드스쿨",
	"레터링",
	"수채화",
	"라인아트",
] as const;

export type CommunityFeedTab = "all" | "following";
