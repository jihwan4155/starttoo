import { useRef, useState } from "react";
import armImage from "../../assets/images/home/hero-arm-black-transparent.png";
import machineImage from "../../assets/images/home/tattoo-machine-cursor.png";
import spiderImage from "../../assets/images/home/tattoo-spider-blackwork.png";
import tigerImage from "../../assets/images/home/tattoo-tiger-blackwork.png";
import "./TattooHeroSection.css";

type Point = { x: number; y: number };
type Needle = "1RL" | "5RL" | "9RL";
type NeedleStyle = "line" | "shade" | "pack";
type Design = "spider" | "tiger";

const NEEDLES = [
	{ id: "1RL" as Needle, pins: 1, width: 1, label: "Fine" },
	{ id: "5RL" as Needle, pins: 5, width: 2.2, label: "Medium" },
	{ id: "9RL" as Needle, pins: 9, width: 3.8, label: "Bold" },
];

const STYLES = [
	{ id: "line" as NeedleStyle, label: "Lining", opacity: 1 },
	{ id: "shade" as NeedleStyle, label: "Shading", opacity: 0.4 },
	{ id: "pack" as NeedleStyle, label: "Packing", opacity: 0.8 },
];

const COLORS = ["#171516", "#d92f45", "#1759c7", "#317c54"];

function PinIcon({ count }: { count: number }) {
	const positions: Record<number, Point[]> = {
		1: [{ x: 16, y: 16 }],
		5: [{ x: 16, y: 7 }, { x: 8, y: 15 }, { x: 24, y: 15 }, { x: 11, y: 24 }, { x: 21, y: 24 }],
		9: [{ x: 16, y: 5 }, { x: 8, y: 10 }, { x: 24, y: 10 }, { x: 5, y: 19 }, { x: 16, y: 16 }, { x: 27, y: 19 }, { x: 9, y: 27 }, { x: 19, y: 27 }, { x: 27, y: 27 }],
	};
	return <svg viewBox="0 0 32 32" aria-hidden>{positions[count].map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="1.15" />)}</svg>;
}

export default function DoodleHeroSection() {
	const inkCanvasRef = useRef<HTMLCanvasElement>(null);
	const drawingRef = useRef(false);
	const lastPointRef = useRef<Point | null>(null);
	const [needle, setNeedle] = useState<Needle>("5RL");
	const [needleStyle, setNeedleStyle] = useState<NeedleStyle>("line");
	const [color, setColor] = useState(COLORS[0]);
	const [design, setDesign] = useState<Design>("spider");
	const [hasInk, setHasInk] = useState(false);
	const [drawing, setDrawing] = useState(false);
	const [engaged, setEngaged] = useState(false);
	const [cursor, setCursor] = useState<Point>({ x: 51, y: 54 });

	const selectedNeedle = NEEDLES.find((item) => item.id === needle) ?? NEEDLES[1];
	const selectedStyle = STYLES.find((item) => item.id === needleStyle) ?? STYLES[0];
	const selectedDesign = design === "spider" ? spiderImage : tigerImage;

	const resetInk = () => {
		const canvas = inkCanvasRef.current;
		canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
		setHasInk(false);
	};

	const chooseDesign = (next: Design) => {
		setDesign(next);
		resetInk();
	};

	const canvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
		const canvas = event.currentTarget;
		const bounds = canvas.getBoundingClientRect();
		return {
			x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
			y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
		};
	};

	const cursorPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
		const bounds = event.currentTarget.getBoundingClientRect();
		return {
			x: ((event.clientX - bounds.left) / bounds.width) * 100,
			y: ((event.clientY - bounds.top) / bounds.height) * 100,
		};
	};

	const configureInk = (context: CanvasRenderingContext2D) => {
		context.strokeStyle = color;
		context.fillStyle = color;
		context.globalAlpha = selectedStyle.opacity;
		context.lineWidth = selectedNeedle.width;
		context.lineCap = needleStyle === "pack" ? "square" : "round";
		context.lineJoin = "round";
	};

	const handleDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
		event.currentTarget.setPointerCapture(event.pointerId);
		const point = canvasPoint(event);
		const context = event.currentTarget.getContext("2d");
		if (!context) return;
		configureInk(context);
		context.beginPath();
		context.arc(point.x, point.y, selectedNeedle.width / 2, 0, Math.PI * 2);
		context.fill();
		drawingRef.current = true;
		lastPointRef.current = point;
		setCursor(cursorPoint(event));
		setDrawing(true);
		setEngaged(true);
		setHasInk(true);
	};

	const handleMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
		setCursor(cursorPoint(event));
		if (!drawingRef.current || !lastPointRef.current) return;
		const point = canvasPoint(event);
		const context = event.currentTarget.getContext("2d");
		if (!context) return;
		configureInk(context);
		context.beginPath();
		context.moveTo(lastPointRef.current.x, lastPointRef.current.y);
		context.lineTo(point.x, point.y);
		context.stroke();
		lastPointRef.current = point;
	};

	const handleEnd = () => {
		drawingRef.current = false;
		lastPointRef.current = null;
		setDrawing(false);
	};

	return (
		<section className="tattoo-lab">
			<aside className="tattoo-lab__controls" aria-label="타투 도구 설정">
				<div className="tattoo-lab__control-block">
					<header><span>01</span><strong>Tattoo needle</strong></header>
					<div className="tattoo-lab__needle-grid">
						{NEEDLES.map((item) => <button key={item.id} type="button" className={needle === item.id ? "is-active" : ""} onClick={() => setNeedle(item.id)}><PinIcon count={item.pins} /><b>{item.id}</b><small>{item.label}</small></button>)}
					</div>
				</div>
				<div className="tattoo-lab__control-block">
					<header><span>02</span><strong>Needle style</strong></header>
					<div className="tattoo-lab__segments">{STYLES.map((item) => <button key={item.id} type="button" className={needleStyle === item.id ? "is-active" : ""} onClick={() => setNeedleStyle(item.id)}>{item.label}</button>)}</div>
				</div>
				<div className="tattoo-lab__control-block tattoo-lab__bottom-controls">
					<div><header><span>03</span><strong>Ink color</strong></header><div className="tattoo-lab__colors">{COLORS.map((item) => <button key={item} type="button" aria-label={`잉크 색상 ${item}`} className={color === item ? "is-active" : ""} style={{ backgroundColor: item }} onClick={() => setColor(item)} />)}</div></div>
					<div><header><span>04</span><strong>Tattoo</strong></header><div className="tattoo-lab__designs"><button type="button" className={design === "spider" ? "is-active" : ""} onClick={() => chooseDesign("spider")}><img src={spiderImage} alt="거미 도안" /></button><button type="button" className={design === "tiger" ? "is-active" : ""} onClick={() => chooseDesign("tiger")}><img src={tigerImage} alt="호랑이 도안" /></button></div></div>
				</div>
			</aside>

			<div className={`tattoo-lab__canvas ${engaged ? "is-engaged" : ""}`}>
				<img className="tattoo-lab__arm" src={armImage} alt="검정 민소매를 입은 팔" />
				<img className="tattoo-lab__machine-preview" src={machineImage} alt="타투 머신" />
				<div className="tattoo-lab__hint"><span />{drawing ? "INKING" : engaged ? "DRAG TO INK" : "MOVE OVER THE STENCIL"}</div>
				<div className={`tattoo-lab__tattoo-zone tattoo-lab__tattoo-zone--${design}`}>
					<img className="tattoo-lab__stencil-image" src={selectedDesign} alt="" aria-hidden />
					<canvas ref={inkCanvasRef} width="600" height="900" onPointerEnter={() => setEngaged(true)} onPointerDown={handleDown} onPointerMove={handleMove} onPointerUp={handleEnd} onPointerCancel={handleEnd} aria-label="팔 위 자유 드로잉 영역" />
					<img className={`tattoo-lab__machine ${engaged ? "is-visible" : ""}`} src={machineImage} alt="" aria-hidden style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }} />
				</div>
				<button className="tattoo-lab__reset" type="button" onClick={resetInk} disabled={!hasInk}>Clear ink</button>
			</div>
		</section>
	);
}
