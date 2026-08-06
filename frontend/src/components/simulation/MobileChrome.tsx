/**
 * 모바일 시뮬레이션 화면의 공통 상단 UI.
 * 앱 셸 안(/simulations)과 QR 진입 풀스크린(/simulations/ar/:sessionId)이
 * 같은 모양을 쓰도록 여기서만 정의한다. 홈·뒤로가기 핸들러를 넘기지 않으면
 * 해당 버튼 없이 제목만 그린다 (QR 진입은 PC로 돌아가는 흐름이라 이동 버튼이 없다).
 */

function BackIcon() {
	return <svg width="20" height="24" viewBox="0 0 20 24" fill="none" aria-hidden><path d="m15 3-9 9 9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function HomeIcon() {
	return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M3 10.8 12 3l9 7.8V21h-6v-6H9v6H3V10.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
}

export function CloseIcon() {
	return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="m4 4 12 12M16 4 4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}

export function MobileHeader({ title, onHome }: { title: string; onHome?: () => void }) {
	return (
		<header className="fixed inset-x-0 top-0 z-[70] flex h-[50px] items-center justify-center border-b border-[#E8E8E8] bg-white">
			{onHome && (
				<button type="button" onClick={onHome} aria-label="홈으로 가기" className="absolute left-4 flex size-8 items-center justify-center text-[#555]"><HomeIcon /></button>
			)}
			<h1 className="text-[19px] font-bold">{title}</h1>
		</header>
	);
}

export function StepTitle({ children, onBack, className = "mb-5" }: { children: React.ReactNode; onBack?: () => void; className?: string }) {
	return (
		<div className={`relative flex min-h-8 items-center justify-center ${className}`}>
			{onBack && (
				<button type="button" onClick={onBack} aria-label="이전 단계" className="absolute left-0 flex size-8 items-center justify-center text-[#BDBDBD]"><BackIcon /></button>
			)}
			<h2 className="px-9 text-center text-[18px] font-semibold">{children}</h2>
		</div>
	);
}
