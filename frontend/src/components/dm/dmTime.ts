/** 메시지 시각 — "오전/오후 h:mm" */
export function formatDmTime(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	const hours = date.getHours();
	const minutes = date.getMinutes();
	const period = hours < 12 ? "오전" : "오후";
	const hour12 = hours % 12 === 0 ? 12 : hours % 12;
	return `${period} ${hour12}:${String(minutes).padStart(2, "0")}`;
}

/** 날짜 구분선 라벨 — 올해는 "3월 15일", 지난해부터는 연도까지 */
export function formatDmDateLabel(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	const month = date.getMonth() + 1;
	const day = date.getDate();
	const year = date.getFullYear();
	if (year === new Date().getFullYear()) {
		return `${month}월 ${day}일`;
	}
	return `${year}년 ${month}월 ${day}일`;
}
