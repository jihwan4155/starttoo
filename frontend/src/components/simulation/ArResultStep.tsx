import { useEffect, useState } from "react";
import type { ArComposite } from "../../types/simulation";
import LoadingLabel from "../loader/LoadingLabel";

type ArResultStepProps = {
	/** 폰에서 올라온 캡처들 (오래된 순) */
	composites: ArComposite[];
	/** 폰 연결 여부 — 아직 캡처가 없을 때 안내 문구를 가른다 */
	phoneConnected: boolean;
	/** 처음으로 돌아가 다시 시작 */
	onRestart: () => void;
};

/**
 * presigned URL은 다른 오리진이라 `<a download>`만으로는 저장되지 않고 탭만 열린다.
 * blob으로 받아 objectURL로 내려받되, 실패하면 새 탭으로 열어 직접 저장하게 둔다.
 */
async function downloadImage(url: string, filename: string): Promise<void> {
	let objectUrl: string | null = null;
	try {
		const response = await fetch(url);
		if (!response.ok) throw new Error(String(response.status));
		objectUrl = URL.createObjectURL(await response.blob());
	} catch {
		window.open(url, "_blank", "noopener");
		return;
	}

	const link = document.createElement("a");
	link.href = objectUrl;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}

/**
 * PC 마지막 단계 — 폰에서 캡처한 결과를 받아 미리보고 저장한다.
 * 여러 장 찍으면 최신 것을 크게 보여주고 아래 썸네일로 고를 수 있다.
 */
export default function ArResultStep({
	composites,
	phoneConnected,
	onRestart,
}: ArResultStepProps) {
	const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
	const [saving, setSaving] = useState(false);

	// 새 캡처가 올라오면 그쪽으로 옮겨 보여준다
	useEffect(() => {
		const latest = composites[composites.length - 1];
		if (latest) setSelectedSeq(latest.compositeSeq);
	}, [composites]);

	const selected =
		composites.find((item) => item.compositeSeq === selectedSeq) ??
		composites[composites.length - 1] ??
		null;

	const handleSave = async () => {
		if (!selected || saving) return;
		setSaving(true);
		try {
			await downloadImage(selected.imageUrl, "starttoo-ar-tattoo.png");
		} finally {
			setSaving(false);
		}
	};

	if (!selected) {
		return (
			<div className="mx-auto flex w-full max-w-[420px] flex-col items-center gap-4 text-center">
				<div className="flex w-full max-w-[240px] flex-col items-center justify-center gap-3 rounded-[16px] bg-black/5 py-16 ring-1 ring-black/5">
					<span className="size-2 animate-pulse rounded-full bg-amber-400" />
					<p className="text-[14px] font-medium text-black/50">
						{phoneConnected
							? "폰에서 촬영하면 여기에 나타나요"
							: "폰 연결을 기다리는 중…"}
					</p>
				</div>
				<button
					type="button"
					onClick={onRestart}
					className="h-[44px] text-[14px] font-semibold text-black/40 transition hover:text-black/60">
					처음부터 다시 하기
				</button>
			</div>
		);
	}

	return (
		<div className="mx-auto flex w-full max-w-[420px] flex-col items-center gap-4">
			{/* 폰 캡처는 video 해상도 그대로라 세로가 길다. 높이를 먼저 묶어 아래 버튼이
			    밀려나지 않게 하고, 상자는 w-fit으로 이미지에 딱 맞춰 배지가 뜨지 않게 한다. */}
			<div className="relative w-fit max-w-full overflow-hidden rounded-[16px] bg-black/5 ring-1 ring-black/5">
				<span className="absolute left-3 top-3 z-10 rounded-full bg-white/90 px-2.5 py-1 text-[12px] font-semibold text-black/60">
					폰에서 캡처한 결과
				</span>
				{/* max-w에 !가 붙은 이유: index.css의 레이어 없는 `img { max-width: 100% }`가
				    레이어에 들어간 유틸리티보다 우선해서, 그냥 쓰면 폭 제한이 먹지 않는다. */}
				<img
					src={selected.imageUrl}
					alt="AR 캡처 결과"
					className="block max-h-[min(42vh,360px)] w-auto max-w-[320px]! object-contain"
				/>
			</div>

			{composites.length > 1 && (
				<div className="flex max-w-full gap-2 overflow-x-auto pb-1">
					{composites.map((item) => (
						<button
							key={item.compositeSeq}
							type="button"
							onClick={() => setSelectedSeq(item.compositeSeq)}
							aria-pressed={item.compositeSeq === selected.compositeSeq}
							className={`size-14 shrink-0 overflow-hidden rounded-[8px] border-2 transition ${
								item.compositeSeq === selected.compositeSeq
									? "border-brand"
									: "border-transparent opacity-60 hover:opacity-100"
							}`}>
							<img
								src={item.imageUrl}
								alt="캡처 결과 미리보기"
								className="size-full object-cover"
							/>
						</button>
					))}
				</div>
			)}

			<div className="flex w-full max-w-[280px] flex-col gap-2">
				<button
					type="button"
					onClick={handleSave}
					disabled={saving}
					className="h-[52px] w-full rounded-[50px] bg-brand text-[16px] font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#D9D9D9] disabled:text-[#666]">
					{saving ? <LoadingLabel>저장 중…</LoadingLabel> : "결과 이미지 저장"}
				</button>
				<button
					type="button"
					onClick={onRestart}
					className="h-[44px] w-full text-[14px] font-semibold text-black/40 transition hover:text-black/60">
					처음부터 다시 하기
				</button>
			</div>
		</div>
	);
}
