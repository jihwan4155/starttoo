import demoImage from "../../assets/images/demo-tattoo.png";

export default function CommunitySection() {
	return (
		<section
			id="community"
			className="mx-auto flex w-full max-w-[1199px] flex-col items-center overflow-hidden px-0 pb-24 pt-20">
			<p className="text-[24px] font-normal leading-7 text-brand">COMMUNITY</p>
			<h2 className="mt-3 text-center text-[48px] font-extrabold leading-[57px] text-black">
				다른 사람들은 어떻게 그렸을까요?
			</h2>
			<p className="mt-4 text-center text-[18px] font-light leading-[21px] text-black">
				커뮤니티에서 도안과 후기를 나눠보세요.
			</p>

			<div className="mt-10 flex w-full gap-[34px] overflow-x-auto px-[48px] pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				{Array.from({ length: 6 }).map((_, index) => (
					<img
						key={index}
						src={demoImage}
						alt={`커뮤니티 도안 ${index + 1}`}
						className="h-[200px] w-[200px] shrink-0 rounded-[10px] object-cover"
					/>
				))}
			</div>
		</section>
	);
}
