/** 타투이스트(아티스트) 인증 뱃지 — 주황 물결 실(seal) 안에 흰색 체크 */
export default function ArtistBadge({
	size = 16,
	className,
}: {
	size?: number;
	/** 댓글처럼 글줄 안에 끼울 때 정렬을 맞추려고 받는다 */
	className?: string;
}) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			aria-label="타투이스트 인증"
			role="img"
			className={className ? `shrink-0 ${className}` : "shrink-0"}>
			<path
				d="M20.78 15.64 Q21.55 21.55 15.64 20.78 Q12 25.5 8.36 20.78 Q2.45 21.55 3.22 15.64 Q-1.5 12 3.22 8.36 Q2.45 2.45 8.36 3.22 Q12 -1.5 15.64 3.22 Q21.55 2.45 20.78 8.36 Q25.5 12 20.78 15.64 Z"
				fill="#F2604E"
			/>
			<path
				d="M7.8 12.3 10.8 15.2 16.2 9.7"
				stroke="#fff"
				strokeWidth="2.2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
