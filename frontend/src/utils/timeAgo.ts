/**
 * 작성 시각(ISO 문자열)과 현재 시각을 비교해 상대 시간 문자열로 변환
 * 예) 방금 전 / 5분 전 / 3시간 전 / 2일 전 / 3주 전 / 2025.06.01
 */
export function formatTimeAgo(createdAt: string): string {
	const created = new Date(createdAt).getTime();
	if (Number.isNaN(created)) return "";

	const diffSec = Math.max(0, Math.floor((Date.now() - created) / 1000));
	if (diffSec < 60) return "방금 전";

	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return `${diffMin}분 전`;

	const diffHour = Math.floor(diffMin / 60);
	if (diffHour < 24) return `${diffHour}시간 전`;

	const diffDay = Math.floor(diffHour / 24);
	if (diffDay < 7) return `${diffDay}일 전`;

	const diffWeek = Math.floor(diffDay / 7);
	if (diffWeek < 5) return `${diffWeek}주 전`;

	// 한 달 이상 지난 글은 날짜로 표시
	const date = new Date(created);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}
