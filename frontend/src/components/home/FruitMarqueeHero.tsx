import { useEffect, useRef } from "react";
import mobileLogo from "../../assets/images/mobile-logo.png";
import "./FruitMarqueeHero.css";

const FRUITS = [
	["watermelon", "수박"],
	["tomato", "토마토"],
	["melon", "메론"],
	["grape", "포도"],
	["mangosteen", "망고스틴"],
	["peach", "복숭아"],
	["chamoe", "참외"],
	["banana", "바나나"],
	["cherry", "체리"],
	["kiwi", "키위"],
	["fig", "무화과"],
	["pineapple", "파인애플"],
	["apple", "사과"],
	["lemon", "레몬"],
	["dragonfruit", "용과"],
	["pomegranate", "석류"],
] as const;

const LOGO_REPEATS = Array.from({ length: 10 });

function LogoRail() {
	return (
		<div className="fruit-marquee__logo-rail" aria-hidden="true">
			<div className="fruit-marquee__logo-row">
				{LOGO_REPEATS.map((_, index) => (
					<img key={index} src={mobileLogo} alt="" />
				))}
			</div>
		</div>
	);
}

function FruitGroup({ hidden = false }: { hidden?: boolean }) {
	return (
		<ul className="fruit-marquee__group" aria-hidden={hidden || undefined}>
			{FRUITS.map(([fileName, label], index) => (
				<li className="fruit-marquee__item" key={fileName}>
					<img
						src={`/images/tattoo-fruits/tattoo-${fileName}-pop.webp`}
						alt={hidden ? "" : `${label} POP 스티커 아트`}
						width="720"
						height="720"
						decoding="async"
						loading={!hidden && index < 4 ? "eager" : "lazy"}
						fetchPriority={!hidden && index < 3 ? "high" : "auto"}
					/>
				</li>
			))}
		</ul>
	);
}

export default function FruitMarqueeHero() {
	const sectionRef = useRef<HTMLElement>(null);
	const viewportRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const section = sectionRef.current;
		const viewport = viewportRef.current;
		const track = trackRef.current;
		if (!section || !viewport || !track) return undefined;

		const items = Array.from(
			viewport.querySelectorAll<HTMLLIElement>(".fruit-marquee__item"),
		);
		const activeItems = new Set<HTMLLIElement>();
		let frameId: number | null = null;
		let lastUpdate = 0;
		let lastFrame = 0;
		let isInViewport = true;
		let targetPlaybackRate = 1;
		let currentPlaybackRate = 1;
		const hoverPlaybackRate = 2.4;

		const smoothStep = (value: number) => value * value * (3 - 2 * value);
		const emphasizeCenteredFruit = (timestamp: number) => {
			frameId = null;
			if (!isInViewport || document.hidden) return;

			const deltaSeconds = lastFrame
				? Math.min((timestamp - lastFrame) / 1000, 0.1)
				: 0;
			lastFrame = timestamp;
			const response = targetPlaybackRate > currentPlaybackRate ? 7 : 4;
			currentPlaybackRate +=
				(targetPlaybackRate - currentPlaybackRate) *
				(1 - Math.exp(-response * deltaSeconds));
			const trackAnimation = track.getAnimations()[0];
			if (trackAnimation) trackAnimation.playbackRate = currentPlaybackRate;

			if (timestamp - lastUpdate >= 1000 / 30) {
				lastUpdate = timestamp;
				const viewportBounds = viewport.getBoundingClientRect();
				const viewportCenter = viewportBounds.left + viewportBounds.width / 2;
				const influenceRadius = Math.max(viewportBounds.width * 0.3, 240);
				const emphasisStrength = Math.min(
					1,
					Math.max(
						0,
						(currentPlaybackRate - 1) / (hoverPlaybackRate - 1),
					),
				);
				const measurements = Array.from(activeItems, (item) => {
					const bounds = item.getBoundingClientRect();
					return { item, center: bounds.left + bounds.width / 2 };
				});

				measurements.forEach(({ item, center }) => {
					const proximity = Math.max(
						0,
						1 - Math.abs(center - viewportCenter) / influenceRadius,
					);
					item.style.setProperty(
						"--center-emphasis",
						(1 + smoothStep(proximity) * 0.24 * emphasisStrength).toFixed(3),
					);
				});
			}

			frameId = requestAnimationFrame(emphasizeCenteredFruit);
		};

		const syncRunningState = () => {
			const shouldRun = isInViewport && !document.hidden;
			track.style.animationPlayState = shouldRun ? "running" : "paused";
			if (shouldRun && frameId === null)
				frameId = requestAnimationFrame(emphasizeCenteredFruit);
			else if (!shouldRun && frameId !== null) {
				cancelAnimationFrame(frameId);
				frameId = null;
			}
		};

		const speedUp = () => {
			targetPlaybackRate = hoverPlaybackRate;
		};
		const slowDown = () => {
			targetPlaybackRate = 1;
		};

		const itemObserver = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					const item = entry.target as HTMLLIElement;
					if (entry.isIntersecting) activeItems.add(item);
					else {
						activeItems.delete(item);
						item.style.setProperty("--center-emphasis", "1");
					}
				});
			},
			{ root: viewport, rootMargin: "0px 35%", threshold: 0 },
		);
		items.forEach((item) => itemObserver.observe(item));

		const sectionObserver = new IntersectionObserver(([entry]) => {
			isInViewport = entry.isIntersecting;
			syncRunningState();
		});
		sectionObserver.observe(section);
		document.addEventListener("visibilitychange", syncRunningState);
		section.addEventListener("pointerenter", speedUp);
		section.addEventListener("pointerleave", slowDown);
		syncRunningState();

		return () => {
			if (frameId !== null) cancelAnimationFrame(frameId);
			itemObserver.disconnect();
			sectionObserver.disconnect();
			document.removeEventListener("visibilitychange", syncRunningState);
			section.removeEventListener("pointerenter", speedUp);
			section.removeEventListener("pointerleave", slowDown);
		};
	}, []);

	return (
		<section ref={sectionRef} className="fruit-marquee" aria-label="STARTTOO POP 과일 배너">
			<LogoRail />
			<div ref={viewportRef} className="fruit-marquee__viewport">
				<div ref={trackRef} className="fruit-marquee__track">
					<FruitGroup />
					<FruitGroup hidden />
				</div>
			</div>
			<LogoRail />
		</section>
	);
}
