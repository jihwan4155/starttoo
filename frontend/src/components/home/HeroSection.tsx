import heroImage from "../../assets/images/hero-rosalia.png";

export default function HeroSection() {
	return (
		<section className="w-full">
			<img
				src={heroImage}
				alt="starttoo 메인 비주얼"
				className="h-[705px] w-full object-cover object-center"
			/>
		</section>
	);
}
