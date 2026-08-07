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
 * 이 함수는 verificationStatus를 직접 들고 있는 화면(마이페이지·프로필)에서만
 * 쓴다. 피드 작성자·팔로우 목록·회원 검색·DM 상대는 서버가 같은 판정을 미리
 * 계산해 verified로 내려주므로 그 값을 그대로 본다.
 */
export function isVerifiedArtist(
	role: string | null | undefined,
	verificationStatus: string | null | undefined,
): boolean {
	return role === "ARTIST" && verificationStatus === "VERIFIED";
}
