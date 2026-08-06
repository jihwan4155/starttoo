import { useEffect, useRef } from "react";
import logoBelt from "../../assets/images/home/logo-belt.svg";
import "./TattooMarqueeHero.css";

const MARQUEE_ITEMS = [
	["machine", "타투 머신"],
	["disinfectant", "소독제"],
	["needle", "타투 니들"],
	["cartridge", "카트리지"],
	["ink", "타투 잉크"],
	["power-supply", "파워 서플라이"],
	["stencil-paper", "스텐실 용지"],
	["pen-2", "타투 펜"],
	["task-lamp", "작업등"],
	["spray-bottle", "스프레이 보틀"],
	["wet-wipes", "물티슈"],
	["worn-glove", "작업 장갑"],
	["mask", "마스크"],
	["surgical-scissors", "수술 가위"],
	["dressing-film", "드레싱 필름"],
] as const;

const MARQUEE_IMAGE_BASE = "/images/tattoo-tools";

const LOGO_REPEATS = Array.from({ length: 10 });

function LogoRail() {
	return (
		<div className="tattoo-marquee__logo-rail" aria-hidden="true">
			<div className="tattoo-marquee__logo-row">
				{LOGO_REPEATS.map((_, index) => (
					<img key={index} src={logoBelt} alt="" />
				))}
			</div>
		</div>
	);
}

function MarqueeGroup({ hidden = false }: { hidden?: boolean }) {
	return (
		<ul className="tattoo-marquee__group" aria-hidden={hidden || undefined}>
			{MARQUEE_ITEMS.map(([fileName, label], index) => (
				<li className="tattoo-marquee__item" key={fileName}>
					<img
						src={`${MARQUEE_IMAGE_BASE}/tattoo-${fileName}-pop.webp`}
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

export default function TattooMarqueeHero() {
	const sectionRef = useRef<HTMLElement>(null);
	const viewportRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const section = sectionRef.current;
		const viewport = viewportRef.current;
		const track = trackRef.current;
		if (!section || !viewport || !track) return undefined;

		const items = Array.from(
			viewport.querySelectorAll<HTMLLIElement>(".tattoo-marquee__item"),
		);
		const activeItems = new Set<HTMLLIElement>();
		let frameId: number | null = null;
		let lastUpdate = 0;
		let lastFrame = 0;
		let isInViewport = true;
		let targetPlaybackRate = 1;
		let currentPlaybackRate = 1;
		const hoverPlaybackRate = 2.4;

		const getAnimatedElements = () => [
			track,
			...Array.from(
				section.querySelectorAll<HTMLElement>(".tattoo-marquee__logo-row"),
			),
		];

		const setElementAnimationsRunning = (shouldRun: boolean) => {
			for (const element of getAnimatedElements()) {
				element.style.animationPlayState = shouldRun ? "running" : "paused";
				for (const animation of element.getAnimations()) {
					if (shouldRun) {
						if (animation.playState === "paused") animation.play();
					} else if (animation.playState === "running") {
						animation.pause();
					}
				}
			}
		};

		const smoothStep = (value: number) => value * value * (3 - 2 * value);
		const emphasizeCenteredItem = (timestamp: number) => {
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

			frameId = requestAnimationFrame(emphasizeCenteredItem);
		};

		const syncRunningState = () => {
			const shouldRun = isInViewport && !document.hidden;
			setElementAnimationsRunning(shouldRun);

			if (!shouldRun) {
				targetPlaybackRate = 1;
				currentPlaybackRate = 1;
				lastFrame = 0;
			}

			if (shouldRun && frameId === null)
				frameId = requestAnimationFrame(emphasizeCenteredItem);
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

		const sectionObserver = new IntersectionObserver(
			([entry]) => {
				isInViewport = entry.isIntersecting;
				syncRunningState();
			},
			{ threshold: 0.05 },
		);
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
		<section ref={sectionRef} className="tattoo-marquee" aria-label="STARTTOO POP 타투 도구 배너">
			<LogoRail />
			<div ref={viewportRef} className="tattoo-marquee__viewport">
				<div ref={trackRef} className="tattoo-marquee__track">
					<MarqueeGroup />
					<MarqueeGroup hidden />
				</div>
			</div>
			<LogoRail />
		</section>
	);
}
