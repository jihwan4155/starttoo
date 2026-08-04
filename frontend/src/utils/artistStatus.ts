const APPROVAL_LABEL: Record<string, string> = {
	VERIFIED: "인증 완료",
	UNVERIFIED: "미인증",
	PENDING: "심사 중",
	REJECTED: "반려",
};

export function formatApprovalStatus(status: string | null | undefined): string {
	if (!status) return "—";
	return APPROVAL_LABEL[status] ?? status;
}

/**
 * 인증 뱃지를 붙일 계정인지 — role=ARTIST이고 인증까지 끝난 경우만.
 *
 * 가입 시 verificationStatus는 UNVERIFIED로 시작하므로 role만 보면 심사 전
 * 계정에도 뱃지가 붙는다. 운영팀이 승인해 VERIFIED가 된 뒤에만 보여야 한다.
 *
 * 주의 — 게시글 작성자(PostDtos.UserSummary)와 팔로우 목록(RelationUser)에는
 * verificationStatus가 없어서 이 판정을 쓸 수 없다. 그쪽은 role만 보고 있다.
 */
export function isVerifiedArtist(
	role: string | null | undefined,
	verificationStatus: string | null | undefined,
): boolean {
	return role === "ARTIST" && verificationStatus === "VERIFIED";
}
