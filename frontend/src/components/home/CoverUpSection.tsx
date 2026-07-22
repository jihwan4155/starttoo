import CtaButton from "../ui/CtaButton";
import demoImage from "../../assets/images/demo-tattoo.png";

export default function CoverUpSection() {
	return (
		<section
			id="cover-up"
			className="mx-auto flex w-full max-w-[1199px] flex-col items-center py-24">
			<p className="text-[24px] font-normal leading-7 text-black">
				흉터도, 오래된 타투도 새롭게
			</p>
			<h2 className="mt-3 text-center text-[48px] font-extrabold leading-[57px] text-black">
				감추고 싶은 자리에 새로운 도안을 더하세요
			</h2>
			<p className="mt-4 max-w-[688px] text-center text-[18px] font-light leading-[21px] text-black">
				흉터든 기존 타투든, AI가 그 위에 어울리는 커버업 도안을 추천해드려요.
				사진 한 장이면 충분해요. AI가 흉터나 기존 타투의 형태와 위치를
				분석해서 자연스럽게 이어지는 커버업 도안을 제안합니다.
			</p>

			<div className="mt-12 flex w-full max-w-[1039px] items-center justify-center gap-12">
				<img
					src={demoImage}
					alt="커버업 타투 예시"
					className="h-[334px] w-full max-w-[493px] rounded-[10px] object-cover"
				/>
				<img
					src={demoImage}
					alt="커버업 타투 예시"
					className="h-[334px] w-full max-w-[493px] rounded-[10px] object-cover"
				/>
			</div>

			<CtaButton className="mt-10">도안 생성하기</CtaButton>
		</section>
	);
}
