import CtaButton from "../ui/CtaButton";
import demoImage from "../../assets/images/demo-tattoo.png";

type FeatureBlockProps = {
	id?: string;
	reversed?: boolean;
};

function FeatureCopy() {
	return (
		<div className="flex w-full max-w-[482px] flex-col">
			<p className="text-[24px] font-normal leading-7 text-black">
				AI가 그리는 나만의 타투 도안
			</p>
			<h2 className="mt-5 text-[48px] font-extrabold leading-[57px] text-black">
				상상만 하던 타투,
				<br />
				이제 눈으로 확인하세요
			</h2>
			<p className="mt-5 text-[18px] font-light leading-[21px] text-black">
				스타일과 프롬프트만 입력하면 AI가 몇 초 만에 도안을 그려드립니다.
			</p>
			<CtaButton className="mt-8">도안 생성하기</CtaButton>
		</div>
	);
}

function FeatureImage() {
	return (
		<img
			src={demoImage}
			alt="타투 도안 예시"
			className="h-[334px] w-full max-w-[493px] rounded-[10px] object-cover"
		/>
	);
}

export default function FeatureSection({
	id,
	reversed = false,
}: FeatureBlockProps) {
	return (
		<section
			id={id}
			className="mx-auto flex w-full max-w-[1199px] items-center justify-center py-[138px]">
			<div
				className={`flex w-full max-w-[1039px] items-center justify-between gap-10 ${
					reversed ? "flex-row-reverse" : "flex-row"
				}`}>
				<FeatureCopy />
				<FeatureImage />
			</div>
		</section>
	);
}
