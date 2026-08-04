/** TODO: 이용약관·개인정보처리방침·커뮤니티 가이드라인 페이지 생기면 링크 연결 */
export default function Footer() {
	return (
		<footer className="border-t border-black/10 px-5 py-8 text-center lg:py-10">
			<div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[12px] font-light text-black/50 lg:text-[14px]">
				<span>이용약관</span>
				<span className="text-black/20">|</span>
				<span>개인정보처리방침</span>
				<span className="text-black/20">|</span>
				<span>커뮤니티 가이드라인</span>
			</div>
			<p className="mt-3 text-[13px] font-light text-black/35">
				© 2026 Starttoo. All Rights Reserved.
			</p>
		</footer>
	);
}
