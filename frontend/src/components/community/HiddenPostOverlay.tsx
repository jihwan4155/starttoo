import LoadingLabel from "../loader/LoadingLabel";

type HiddenPostOverlayProps = {
	onUnhide: () => void;
	isPending?: boolean;
};

/** 숨김(차단)된 피드 위에 덧씌우는 안내 UI */
export default function HiddenPostOverlay({
	onUnhide,
	isPending = false,
}: HiddenPostOverlayProps) {
	return (
		<div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[10px] bg-white/85 px-6 text-center backdrop-blur-[2px]">
			<p className="text-[15px] font-semibold text-black/80">
				이 피드를 숨겼습니다
			</p>
			<p className="mt-1.5 max-w-[240px] text-[13px] font-light leading-5 text-black/50">
				목록에서 이 피드가 표시되지 않습니다
			</p>
			<button
				type="button"
				onClick={onUnhide}
				disabled={isPending}
				className="mt-5 rounded-full border border-black/15 bg-white px-5 py-2 text-[13px] font-semibold text-black transition hover:bg-black/[0.03] disabled:opacity-50">
				{isPending ? <LoadingLabel>처리 중…</LoadingLabel> : "숨김 취소"}
			</button>
		</div>
	);
}
