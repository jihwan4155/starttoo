import { useEffect, useMemo, useState } from "react";
import ArLiveStage, { type ArEngineOptions } from "./ar-live/ArLiveStage";
import useArchive from "../../hooks/queries/useArchive";
import { mapArchiveItemToSavedDesign } from "../../utils/mapArchive";
import starDesign from "../../assets/ar/design-star.svg";
import vineDesign from "../../assets/ar/design-vine.svg";

/** 슬라이더가 다루는 UI 단위 옵션 (% / 도) */
type ArOptions = {
	/** 크기 % (100 = 기본) */
	size: number;
	/** 방향(도) */
	direction: number;
	/** 곡률 % (0~115) */
	curvature: number;
	/** 농도 % (20~100) */
	opacity: number;
};

const DEFAULT_OPTIONS: ArOptions = {
	size: 50,
	direction: 0,
	curvature: 50,
	opacity: 50,
};

/** PoC 기본 배율 — UI 100%가 이 값이 되도록 매핑 */
const BASE_SCALE = 4.4;

/**
 * 도안 보관함도 세션 도안도 비었을 때 쓰는 샘플 도안.
 *
 * AR 엔진은 항상 얹을 도안이 하나는 있어야 해서, 레일을 비워 두는 대신 샘플을 남긴다.
 */
const SAMPLE_DESIGNS: RailDesign[] = [
	{ name: "샘플 · 별", url: starDesign },
	{ name: "샘플 · 덩굴", url: vineDesign },
];

/** 레일에 놓이는 도안 한 칸 */
type RailDesign = {
	/**
	 * 도안 식별자(tattooSeq). 세션 도안과 도안 보관함의 도안이 같은 도안을 가리켜도
	 * presigned URL이 서로 달라 URL로는 같은 것인지 알 수 없다 — 이 값으로 겹침을
	 * 판단한다. 직접 올린 이미지·샘플에는 없다.
	 */
	seq?: number;
	name: string;
	url: string;
};

type ArCustomizeScreenProps = {
	/** 캡처 시 합성 화면 dataURL 전달 */
	onCapture: (dataUrl: string) => void;
	/**
	 * 레일 맨 앞에 붙일 도안. QR로 들어온 폰은 세션 /connect 응답으로 받은 도안을
	 * 넘긴다 — 그 폰은 로그인 상태가 아닐 수 있어 도안 보관함을 못 읽기 때문이다.
	 * 로그인한 폰이라면 같은 도안이 도안 보관함에도 있으므로 seq로 겹치는 것을 걸러낸다.
	 */
	designs?: RailDesign[];
};

type SliderRowProps = {
	label: string;
	value: number;
	min: number;
	max: number;
	suffix?: string;
	onChange: (value: number) => void;
};

function SliderRow({
	label,
	value,
	min,
	max,
	suffix,
	onChange,
}: SliderRowProps) {
	return (
		<label className="flex items-center gap-3">
			<span className="w-10 shrink-0 text-[13px] font-semibold text-black/70">
				{label}
			</span>
			<input
				type="range"
				min={min}
				max={max}
				value={value}
				onChange={(event) => onChange(Number(event.target.value))}
				className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-black/10 accent-brand"
			/>
			<span className="w-12 shrink-0 text-right text-[12px] tabular-nums text-black/50">
				{value}
				{suffix}
			</span>
		</label>
	);
}

/**
 * 폰에서 실행되는 AR 커스텀 화면 (도안 선택 + 실시간 피팅 + 캡처).
 * 실시간 트래킹/합성은 ArLiveStage(엔진)에 위임하고, 여기선 도안·옵션 UI를 담당한다.
 */
export default function ArCustomizeScreen({
	onCapture,
	designs,
}: ArCustomizeScreenProps) {
	// 도안 보관함 — 마이페이지와 같은 서버 데이터(GET /archive).
	// 비로그인이면 훅이 요청 자체를 하지 않아 빈 목록이 된다.
	const { data: archiveData, isFetching: isArchiveFetching } = useArchive({
		size: 30,
	});
	const archiveDesigns = useMemo<RailDesign[]>(
		() =>
			archiveData?.pages
				.flatMap((page) => page.items.map(mapArchiveItemToSavedDesign))
				.map((design, index) => ({
					seq: design.id,
					name: `보관한 도안 ${index + 1}`,
					url: design.previewUrl,
				})) ?? [],
		[archiveData?.pages],
	);
	const hasOwnDesigns = Boolean(designs?.length) || archiveDesigns.length > 0;
	const designList = useMemo(() => {
		if (!hasOwnDesigns) return SAMPLE_DESIGNS;
		// 로그인한 폰이 QR로 들어오면 PC가 실어 보낸 세션 도안과 자기 도안 보관함이
		// 같은 도안을 가리켜 한 칸씩 두 번 나온다. seq로 먼저 온 쪽만 남긴다.
		const seen = new Set<number>();
		return [...(designs ?? []), ...archiveDesigns].filter((design) => {
			if (design.seq == null) return true;
			if (seen.has(design.seq)) return false;
			seen.add(design.seq);
			return true;
		});
	}, [hasOwnDesigns, designs, archiveDesigns]);

	const [designUrl, setDesignUrl] = useState(designList[0].url);
	const [options, setOptions] = useState<ArOptions>(DEFAULT_OPTIONS);

	// 도안 보관함은 첫 렌더 뒤에 도착한다. 그때까지 골라 둔 샘플이 목록에서 빠지므로
	// 첫 도안으로 다시 맞춘다.
	useEffect(() => {
		if (designList.some((design) => design.url === designUrl)) return;
		setDesignUrl(designList[0].url);
	}, [designList, designUrl]);

	const setOption = (key: keyof ArOptions) => (value: number) =>
		setOptions((current) => ({ ...current, [key]: value }));

	// UI 단위(%) → 엔진 네이티브 값
	const engineOptions = useMemo<ArEngineOptions>(
		() => ({
			scale: (options.size / 100) * BASE_SCALE,
			rotation: options.direction,
			curvature: options.curvature / 100,
			opacity: options.opacity / 100,
		}),
		[options]
	);

	return (
		<div className="flex w-full flex-col gap-3">
			<ArLiveStage
				designUrl={designUrl}
				options={engineOptions}
				onCapture={onCapture}
			/>

			<p className="mx-auto w-full text-center text-[12px] font-light leading-4 text-black/50 lg:max-w-[320px]">
				더 정확한 인식을 위해, 주변의 물건을 정리해 주세요.
			</p>

			{/* 도안 레일 */}
			<div className="mx-auto w-full lg:max-w-[320px]">
				<p className="mb-2 text-[13px] font-semibold text-black/60">
					도안 보관함
				</p>
				<div className="flex gap-2 overflow-x-auto pb-1">
					{designList.map((design) => (
						<button
							key={design.url}
							type="button"
							onClick={() => setDesignUrl(design.url)}
							aria-pressed={designUrl === design.url}
							title={design.name}
							className={`grid size-16 shrink-0 place-items-center overflow-hidden rounded-[10px] border-2 bg-white ${
								designUrl === design.url ? "border-brand" : "border-transparent"
							}`}>
							{/* 레일이 스무 칸까지 늘어난다. 폰이 접속 직후 전부 내려받느라
							    느려지지 않게 화면에 들어온 것부터 받는다 */}
							<img
								src={design.url}
								alt={design.name}
								loading="lazy"
								decoding="async"
								className="size-12 object-contain"
							/>
						</button>
					))}

				</div>

				{/* 샘플만 있는 이유를 알려 준다 — 레일이 비어 보이는 것보다 낫다 */}
				{!hasOwnDesigns && !isArchiveFetching && (
					<p className="mt-1.5 text-[11px] font-light leading-4 text-black/40">
						보관한 도안이 없어 샘플을 보여드려요. 피드에서 도안을 저장하면
						여기에서 고를 수 있어요.
					</p>
				)}
			</div>

			{/* 옵션 슬라이더 */}
			<div className="mx-auto flex w-full flex-col gap-2.5 rounded-[14px] bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)] lg:max-w-[320px]">
				<SliderRow
					label="크기"
					value={options.size}
					min={40}
					max={200}
					suffix="%"
					onChange={setOption("size")}
				/>
				<SliderRow
					label="방향"
					value={options.direction}
					min={-180}
					max={180}
					suffix="°"
					onChange={setOption("direction")}
				/>
				<SliderRow
					label="곡률"
					value={options.curvature}
					min={0}
					max={115}
					suffix="%"
					onChange={setOption("curvature")}
				/>
				<SliderRow
					label="농도"
					value={options.opacity}
					min={20}
					max={100}
					suffix="%"
					onChange={setOption("opacity")}
				/>
			</div>
		</div>
	);
}
