/** Y 좌표(0~1)로 신체 부위 라벨 추론 */
export default function inferBodyPart(y: number): string {
	if (y < 0.18) return "머리";
	if (y < 0.32) return "가슴";
	if (y < 0.48) return "복부";
	if (y < 0.72) return "허벅지";
	return "종아리";
}
