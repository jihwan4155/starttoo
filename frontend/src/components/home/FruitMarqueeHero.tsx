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
		let isInViewport = true;

		const smoothStep = (value: number) => value * value * (3 - 2 * value);
		const fade = (value: number, start: number, end: number) =>
			smoothStep(Math.min(1, Math.max(0, (value - start) / (end - start))));

		const slowStrengthAt = (phase: number) => {
			if (phase < 0.18) return 1;
			if (phase < 0.25) return 1 - fade(phase, 0.18, 0.25);
			if (phase >= 0.38 && phase < 0.44) return fade(phase, 0.38, 0.44);
			if (phase < 0.53 && phase >= 0.44) return 1;
			if (phase < 0.6 && phase >= 0.53) return 1 - fade(phase, 0.53, 0.6);
			if (phase >= 0.72 && phase < 0.78) return fade(phase, 0.72, 0.78);
			if (phase < 0.84 && phase >= 0.78) return 1;
			if (phase < 0.91 && phase >= 0.84) return 1 - fade(phase, 0.84, 0.91);
			return 0;
		};

		const emphasizeCenteredFruit = (timestamp: number) => {
			frameId = null;
			if (!isInViewport || document.hidden) return;

			if (timestamp - lastUpdate >= 1000 / 30) {
				lastUpdate = timestamp;
				const viewportBounds = viewport.getBoundingClientRect();
				const viewportCenter = viewportBounds.left + viewportBounds.width / 2;
				const influenceRadius = Math.max(viewportBounds.width * 0.3, 240);
				const progress = track.getAnimations()[0]?.effect?.getComputedTiming()
					.progress;
				const phase = typeof progress === "number" ? progress : 0;
				const slowSectionStrength = slowStrengthAt(phase);
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
						(1 + smoothStep(proximity) * 0.24 * slowSectionStrength).toFixed(3),
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
		syncRunningState();

		return () => {
			if (frameId !== null) cancelAnimationFrame(frameId);
			itemObserver.disconnect();
			sectionObserver.disconnect();
			document.removeEventListener("visibilitychange", syncRunningState);
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
