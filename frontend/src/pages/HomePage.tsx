import CommunitySection from "../components/home/CommunitySection";
import CoverUpSection from "../components/home/CoverUpSection";
import FeatureSection from "../components/home/FeatureSection";
import Footer from "../components/home/Footer";
import HeroSection from "../components/home/HeroSection";

export default function HomePage() {
	return (
		<div className="min-h-screen bg-surface">
			<HeroSection />
			<div className="mx-auto max-w-[1200px]">
				<FeatureSection
					id="ai-design"
					eyebrow="AI가 그리는 나만의 타투 도안"
					heading={["상상만 하던 타투,", "이제 눈으로 확인하세요"]}
					description="스타일과 프롬프트만 입력하면 AI가 몇 초 만에 도안을 그려드립니다."
					buttonLabel="도안 생성하기"
					buttonTo="/ai"
				/>
				<FeatureSection
					id="simulation"
					reversed
					eyebrow="몸에 직접 그려본 듯한 시뮬레이션"
					heading={["시술 전에 먼저", "내 몸 위에 그려보세요"]}
					description="AR로 즉시 확인하거나, 사진을 올려 3D로 확인하세요."
					buttonLabel="시뮬레이션 시작하기"
					buttonTo="/simulations"
				/>
				<CoverUpSection />
				<CommunitySection />
			</div>
			<Footer />
		</div>
	);
}
