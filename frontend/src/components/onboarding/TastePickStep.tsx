import { useEffect, useState } from "react";
import { fetchPrimaryStyles } from "../../services/classificationApi";
import { TATTOO_STYLE_CHOICES } from "./tattooStyleChoices";
import LoadingLabel from "../loader/LoadingLabel";

/** 최대 이만큼 고른다 — 취향이 한쪽으로 쏠리지 않게 상한을 둔다 */
const PICK_MAX = 3;

type TastePickStepProps = {
	submitting: boolean;
	submitError: string | null;
	/** 고른 스타일의 primaryStyleSeq — 취향 설문으로 보낸다 */
	onSubmit: (primaryStyleSeqs: number[]) => void;
};

/**
 * 온보딩 마지막 단계 — 좋아하는 타투 스타일 고르기.
 *
 * 예전에는 서버 도안을 아홉 장 받아 보여줬다. 무엇이 나올지 모르고, 조회가
 * 실패하면 설문 자체가 사라져 취향이 비는 채로 가입이 끝났다. 지금은 스타일
 * 대표 이미지를 앱에 두고 항상 같은 설문을 보여준다.
 *
 * 고른 스타일의 seq가 최초 취향 점수가 된다. seq는 DB가 매기는 값이라
 * GET /classifications/primary-styles에서 code로 찾아 맞춘다.
 */
export default function TastePickStep({
	submitting,
	submitError,
	onSubmit,
}: TastePickStepProps) {
	const [pickedCodes, setPickedCodes] = useState<string[]>([]);
	/** code → seq. 조회 전에는 null이고, 실패하면 빈 Map이 된다 */
	const [seqByCode, setSeqByCode] = useState<Map<string, number> | null>(null);

	useEffect(() => {
		let alive = true;
		fetchPrimaryStyles()
			.then((items) => {
				if (!alive) return;
				setSeqByCode(new Map(items.map((item) => [item.code, item.seq])));
			})
			.catch(() => {
				// 설문은 건너뛸 수 있는 단계다. 분류를 못 받아도 가입은 그대로 끝낸다.
				if (alive) setSeqByCode(new Map());
			});
		return () => {
			alive = false;
		};
	}, []);

	const toggle = (code: string) => {
		setPickedCodes((prev) => {
			if (prev.includes(code)) return prev.filter((item) => item !== code);
			// 가장 오래된 선택을 밀어내 항상 최대 3개만 유지한다.
			return [...prev, code].slice(-PICK_MAX);
		});
	};

	const handleSubmit = () => {
		const seqs = pickedCodes
			.map((code) => seqByCode?.get(code))
			.filter((seq): seq is number => seq != null);
		onSubmit(seqs);
	};

	return (
		<div>
			<p className="mb-3 text-center text-[13px] font-light leading-5 text-black/50">
				마음에 드는 스타일을 최대 {PICK_MAX}개 골라 주세요.
				<br />
				고른 취향에 맞춰 도안을 추천해 드려요.
			</p>

			{/*
			  넓은 화면에서는 10개를 5열 두 줄로 놓아 스크롤 없이 한눈에 들어온다.
			  좁은 화면에서 5열로 두면 칸이 60px 아래로 줄어 그림이 안 보이므로
			  모바일은 3열을 유지한다.
			*/}
			<div className="grid grid-cols-3 gap-[2px] overflow-hidden rounded-[8px] border border-[#D9D9D9] bg-[#D9D9D9] p-[2px] sm:grid-cols-5">
				{TATTOO_STYLE_CHOICES.map((style) => {
					const picked = pickedCodes.includes(style.code);
					return (
						<button
							key={style.code}
							type="button"
							onClick={() => toggle(style.code)}
							aria-pressed={picked}
							className={`relative aspect-square overflow-hidden bg-white transition ${
								picked ? "ring-2 ring-inset ring-brand" : ""
							}`}>
							{/*
							  lazy를 걸지 않는다 — 열 칸이 모두 처음부터 보이는 자리라
							  지연시켜 봐야 그림이 뒤늦게 튀어나올 뿐이다.
							*/}
							<img
								src={style.imageUrl}
								alt={style.label}
								className="h-full w-full object-cover"
							/>
							{/* 이름은 이미지 위에 얹는다 — 칸이 작아 아래에 두면 그림이 눌린다 */}
							<span
								className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1 pb-1 pt-3 text-[11px] font-semibold text-white"
								aria-hidden>
								{style.label}
							</span>
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
				{pickedCodes.length}/{PICK_MAX}
			</p>

			{submitError && (
				<p role="alert" className="mt-3 text-[13px] leading-5 text-brand">
					{submitError}
				</p>
			)}

			<button
				type="button"
				onClick={handleSubmit}
				disabled={submitting}
				className="mx-auto mt-5 block h-[48px] w-[160px] rounded-full bg-brand text-[16px] font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#FFB4B4]">
				{submitting
					? <LoadingLabel>저장하는 중…</LoadingLabel>
					: pickedCodes.length === 0
						? "건너뛰기"
						: "시작하기"}
			</button>
		</div>
	);
}
