import markerGuide from "../../assets/images/ar-marker-guide.png";

const GUIDE_ITEMS = [
	{
		title: "팔 안쪽에 그려주세요",
		body: "잘 지워지는 검정 펜으로 팔뚝 안쪽 평평한 곳에 그립니다.",
	},
	{
		title: "세로선 2개 + 가로선 1개",
		body: "짧은 세로선 두 개를 나란히, 그 아래에 조금 더 긴 가로선 하나를 그립니다.",
	},
	{
		title: "가로 3~4cm 크기로",
		body: "너무 작으면 인식이 어려워요. 선은 진하고, 서로 닿지 않게 그려주세요.",
	},
];

export default function MarkerGuideStep() {
	return (
		<div className="mx-auto flex h-full max-h-[520px] w-full max-w-[700px] flex-col items-center gap-4 overflow-y-auto rounded-[16px] bg-white px-5 py-6 sm:max-h-[400px] sm:flex-row sm:gap-8 sm:px-8">
			{/* 원본이 세로로 매우 길어(1140x3608) 높이에 맞추면 사진이 사라진다.
			    폭을 고정하고 마커 주변(손목~팔뚝)을 잘라 어떤 화면 높이에서도 크게 보이게 한다. */}
			<img
				src={markerGuide}
				alt="팔 안쪽에 세로선 두 개와 그 아래 가로선 하나를 그린 마커 예시"
				className="h-[210px] w-full shrink-0 rounded-[12px] bg-black/[0.03] object-contain sm:h-full sm:min-h-0 sm:w-[190px] sm:object-cover sm:object-[50%_68%]"
			/>

			<ol className="flex w-full min-w-0 flex-col gap-4 sm:w-auto sm:flex-1">
				{GUIDE_ITEMS.map((item, index) => (
					<li key={item.title} className="flex gap-3">
						<span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[13px] font-bold text-brand">
							{index + 1}
						</span>
						<div className="min-w-0">
							<p className="text-[14px] font-bold text-black sm:text-[15px]">
								{item.title}
							</p>
							<p className="mt-1 text-[12px] font-light leading-[17px] text-black/55 sm:text-[13px] sm:leading-5">
								{item.body}
							</p>
						</div>
					</li>
				))}
			</ol>
		</div>
	);
}
