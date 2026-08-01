import { useEffect, useState } from "react";
import { fetchTattooDesigns } from "../../services/tattooApi";
import type { TattooDesignItem } from "../../types/tattoo";

/** 목업의 3×3 그리드 */
const GRID_SIZE = 9;
/** 목업 하단의 "n/3" — 최대 이만큼 고른다 */
const PICK_MAX = 3;

type TastePickStepProps = {
	submitting: boolean;
	submitError: string | null;
	/** 고른 도안 — 주 스타일·색상 seq를 취향 설문으로 보낸다 */
	onSubmit: (picked: TattooDesignItem[]) => void;
};

/**
 * 온보딩 3단계 — 좋아하는 이미지 고르기.
 *
 * 고른 도안의 분류(주 스타일·색상)가 최초 취향 점수가 된다.
 * 일반 사용자와 타투이스트 모두 같은 화면을 본다.
 */
export default function TastePickStep({
	submitting,
	submitError,
	onSubmit,
}: TastePickStepProps) {
	const [designs, setDesigns] = useState<TattooDesignItem[] | null>(null);
	const [loadFailed, setLoadFailed] = useState(false);
	const [pickedSeqs, setPickedSeqs] = useState<number[]>([]);

	useEffect(() => {
		let alive = true;
		fetchTattooDesigns({ size: GRID_SIZE })
			.then((page) => {
				if (alive) setDesigns(page.items);
			})
			.catch(() => {
				// 취향 설문은 건너뛸 수 있는 단계라 실패해도 가입은 그대로 유지된다.
				if (alive) {
					setDesigns([]);
					setLoadFailed(true);
				}
			});
		return () => {
			alive = false;
		};
	}, []);

	const toggle = (tattooSeq: number) => {
		setPickedSeqs((prev) => {
			if (prev.includes(tattooSeq)) {
				return prev.filter((seq) => seq !== tattooSeq);
			}
			// 가장 오래된 선택을 밀어내 항상 최대 3개만 유지한다.
			return [...prev, tattooSeq].slice(-PICK_MAX);
		});
	};

	const handleSubmit = () => {
		const items = designs ?? [];
		onSubmit(items.filter((item) => pickedSeqs.includes(item.tattooSeq)));
	};

	if (designs === null) {
		return (
			<p className="py-12 text-center text-[14px] font-light text-black/50">
				도안을 불러오는 중…
			</p>
		);
	}

	// 보여줄 도안이 없으면 취향 설문 없이 넘어간다.
	if (designs.length === 0) {
		return (
			<div>
				<p className="py-8 text-center text-[14px] font-light leading-6 text-black/50">
					{loadFailed
						? "도안을 불러오지 못했어요. 취향은 나중에 둘러보며 채워집니다."
						: "아직 고를 수 있는 도안이 없어요. 취향은 둘러보며 채워집니다."}
				</p>
				<button
					type="button"
					onClick={() => onSubmit([])}
					className="mx-auto block h-[48px] w-[160px] rounded-full bg-brand text-[16px] font-semibold text-white transition hover:brightness-95">
					시작하기
				</button>
			</div>
		);
	}

	return (
		<div>
			<div className="grid grid-cols-3 gap-[2px] rounded-[8px] border border-[#D9D9D9] bg-[#D9D9D9] p-[2px]">
				{designs.map((design) => {
					const picked = pickedSeqs.includes(design.tattooSeq);
					return (
						<button
							key={design.tattooSeq}
							type="button"
							onClick={() => toggle(design.tattooSeq)}
							aria-pressed={picked}
							className={`relative aspect-square overflow-hidden bg-white transition ${
								picked ? "ring-2 ring-inset ring-brand" : ""
							}`}>
							<img
								src={design.designImageUrl}
								alt=""
								loading="lazy"
								className="h-full w-full object-cover"
							/>
							{picked && (
								<span
									aria-hidden
									className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
									✓
								</span>
							)}
						</button>
					);
				})}
			</div>

			<p className="mt-2 text-[12px] font-light text-black/45">
				{pickedSeqs.length}/{PICK_MAX}
			</p>

			{submitError && (
				<p role="alert" className="mt-3 text-[13px] leading-5 text-brand">
					{submitError}
				</p>
			)}

			<button
				type="button"
				onClick={handleSubmit}
				disabled={pickedSeqs.length === 0 || submitting}
				className="mx-auto mt-5 block h-[48px] w-[160px] rounded-full bg-brand text-[16px] font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#FFB4B4]">
				{submitting ? "저장하는 중…" : "완료"}
			</button>
		</div>
	);
}
