import CommunitySection from "../components/home/CommunitySection";
import CoverUpSection from "../components/home/CoverUpSection";
import FeatureSection from "../components/home/FeatureSection";
import HeroSection from "../components/home/HeroSection";

export default function HomePage() {
	return (
		<div className="min-h-screen bg-surface">
			<HeroSection />
			<div className="mx-auto max-w-[1200px]">
				<section id="ai-design">
					<FeatureSection />
				</section>
				<section id="simulation">
					<FeatureSection reversed />
				</section>
				<CoverUpSection />
				<CommunitySection />
			</div>
		</div>
	);
}
