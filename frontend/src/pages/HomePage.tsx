import CommunitySection from "../components/home/CommunitySection";
import DualImageFeatureSection from "../components/home/DualImageFeatureSection";
import FeatureSection from "../components/home/FeatureSection";
import Footer from "../components/home/Footer";
import HeroSection from "../components/home/HeroSection";
import homeAiImage from "../assets/images/home/home-ai.png";
import homeCoverUpImage from "../assets/images/home/home-coverup.png";
import homeSimulAfterImage from "../assets/images/home/home-simul-after.png";
import homeSimulBeforeImage from "../assets/images/home/home-simul-before.png";

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
					image={homeAiImage}
					imageAlt="AI 타투 도안 예시"
				/>
				<DualImageFeatureSection
					id="simulation"
					eyebrow="몸에 직접 그려본 듯한 시뮬레이션"
					heading="시술 전에 먼저 내 몸 위에 그려보세요"
					description="AR로 즉시 확인하거나, 사진을 올려 3D로 확인하세요."
					buttonLabel="시뮬레이션 시작하기"
					buttonTo="/simulations"
					imageBefore={homeSimulBeforeImage}
					imageAfter={homeSimulAfterImage}
					imageAlt="타투 시뮬레이션 예시"
				/>
				<FeatureSection
					id="cover-up"
					reversed
					eyebrow="흉터도, 오래된 타투도 새롭게"
					heading={["감추고 싶은 자리에", "새로운 도안을 더하세요"]}
					description="흉터든 기존 타투든, AI가 그 위에 어울리는 커버업 도안을 추천해드려요."
					buttonLabel="커버업 추천받기"
					buttonTo="/coverups"
					image={homeCoverUpImage}
					imageAlt="커버업 타투 예시"
				/>
				<CommunitySection />
			</div>
			<Footer />
		</div>
	);
}
