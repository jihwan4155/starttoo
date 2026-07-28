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
