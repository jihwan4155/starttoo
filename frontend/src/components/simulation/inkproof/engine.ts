/*
 * INKPROOF 3D 메시 타투 합성 엔진 (WebGL)
 * 원본: 3d simulation/inkproof-mesh_19.html 의 스크립트를 React에서 쓸 수 있게 포팅.
 * - 뎁스맵으로 표면을 세워 도안을 신체 굴곡에 감아 합성한다.
 * - 신체 마스크(MODNet)·부위 인식(MediaPipe Pose)·뎁스맵(Depth Anything V2)은
 *   CDN에서 동적 로드 (모델 최초 1회 다운로드 · 네트워크 필요)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ProgressHandler = (message: string) => void;

type Pt = [number, number, number];

const TRANSFORMERS_CDN = "https://cdn.jsdelivr.net/npm/@huggingface/transformers";
const MP_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MP_MODEL =
	"https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
const MP_MODEL_HEAVY =
	"https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task";

const PHOTO_VS =
	"attribute vec2 aPos; varying vec2 vUV; void main(){ vUV=aPos*0.5+0.5; gl_Position=vec4(aPos,0.0,1.0); }";
const PHOTO_FS =
	"precision highp float; varying vec2 vUV; uniform sampler2D uPhoto;" +
	"void main(){ gl_FragColor=vec4(texture2D(uPhoto,vec2(vUV.x,1.0-vUV.y)).rgb,1.0); }";

const MESH_VS = [
	"precision highp float;",
	"attribute vec2 aLocal; attribute vec2 aUV;",
	"uniform vec2 uCenter; uniform float uScale,uAngle,uTattooAspect,uAspect,uBulge;",
	"uniform sampler2D uDepth;",
	"varying vec2 vUV; varying vec2 vScreenUV; varying vec2 vDepthUV;",
	"void main(){",
	"  vUV=aUV;",
	"  vec2 vis=vec2(aLocal.x*uScale*uTattooAspect, aLocal.y*uScale);",
	"  float c=cos(uAngle), s=sin(uAngle);",
	"  vec2 rot=vec2(vis.x*c - vis.y*s, vis.x*s + vis.y*c);",
	"  vec2 uvPos=uCenter+vec2(rot.x/uAspect, rot.y);",
	"  vDepthUV=uvPos;",
	"  float d=texture2D(uDepth, vec2(uvPos.x,1.0-uvPos.y)).r;",
	"  float persp=1.0+(d-0.5)*uBulge;",
	"  vec2 disp=uCenter+(uvPos-uCenter)*persp;",
	"  vScreenUV=disp;",
	"  gl_Position=vec4(disp*2.0-1.0, 0.0, 1.0);",
	"}",
].join("\n");

const MESH_FS = [
	"precision highp float;",
	"uniform sampler2D uTattoo,uPhoto,uDepth,uBodyTex,uRegionTex,uPartTex;",
	"uniform float uOpacity,uBlend,uInk,uLight,uShade,uFace,uEdge,uWhiteKey,uMask,uUseBlend,uUseLight,uBulge,uTexel,uCut,uCenterDepth,uLock,uAge,uRadius,uUseBody,uRegion,uPart;",
	"varying vec2 vUV,vScreenUV,vDepthUV;",
	"float luma(vec3 c){ return dot(c,vec3(0.2126,0.7152,0.0722)); }",
	"float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }",
	"float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); float a=hash(i),b=hash(i+vec2(1.0,0.0)),c=hash(i+vec2(0.0,1.0)),d=hash(i+vec2(1.0,1.0));",
	"  vec2 u=f*f*(3.0-2.0*f); return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }",
	"float skinMask(vec3 c){",
	"  float Y=dot(c,vec3(0.299,0.587,0.114));",
	"  float Cb=-0.169*c.r-0.331*c.g+0.5*c.b+0.5;",
	"  float Cr=0.5*c.r-0.419*c.g-0.081*c.b+0.5;",
	"  float mcb=smoothstep(0.28,0.33,Cb)*(1.0-smoothstep(0.48,0.53,Cb));",
	"  float mcr=smoothstep(0.50,0.54,Cr)*(1.0-smoothstep(0.65,0.71,Cr));",
	"  float mv=smoothstep(0.10,0.20,Y);",
	"  return clamp(mcb*mcr*mv,0.0,1.0);",
	"}",
	"float dS(vec2 uv){ return texture2D(uDepth,vec2(uv.x,1.0-uv.y)).r; }",
	"void main(){",
	"  float blurR=uAge*0.004;",
	"  vec4 t=texture2D(uTattoo,vUV);",
	"  if(blurR>0.0){ vec4 ac=t;",
	"    ac+=texture2D(uTattoo,vUV+vec2(blurR,0.0)); ac+=texture2D(uTattoo,vUV-vec2(blurR,0.0));",
	"    ac+=texture2D(uTattoo,vUV+vec2(0.0,blurR)); ac+=texture2D(uTattoo,vUV-vec2(0.0,blurR));",
	"    ac+=texture2D(uTattoo,vUV+vec2(blurR,blurR)); ac+=texture2D(uTattoo,vUV-vec2(blurR,blurR));",
	"    ac+=texture2D(uTattoo,vUV+vec2(blurR,-blurR)); ac+=texture2D(uTattoo,vUV-vec2(blurR,-blurR));",
	"    t=ac/9.0; }",
	"  float tl=luma(t.rgb);",
	"  float a=t.a;",
	"  a*=mix(1.0,1.0-smoothstep(0.55,0.97,tl),uWhiteKey);",
	"  vec3 photo=texture2D(uPhoto,vec2(vScreenUV.x,1.0-vScreenUV.y)).rgb;",
	"  float pl=luma(photo);",
	"  float dr=dS(vDepthUV+vec2(uTexel,0.0)), dl=dS(vDepthUV-vec2(uTexel,0.0));",
	"  float du=dS(vDepthUV+vec2(0.0,uTexel)), dd=dS(vDepthUV-vec2(0.0,uTexel));",
	"  vec3 n=normalize(vec3(-(dr-dl)*18.0, -(du-dd)*18.0, 1.0));",
	"  float facing=clamp(n.z,0.0,1.0);",
	"  float cliff=smoothstep(0.06,0.14, max(abs(dr-dl),abs(du-dd)));",
	"  a*=(1.0-cliff*uCut);",
	"  float dc=dS(vDepthUV);",
	"  float other=smoothstep(0.12,0.22, abs(dc-uCenterDepth));",
	"  a*=(1.0-other*uLock);",
	"  float rd=length(vUV-vec2(0.5));",
	"  a*=1.0-smoothstep(uRadius,uRadius+0.08,rd);",
	"  a*=mix(1.0,smoothstep(0.05,0.55,pl),uShade);",
	"  a*=mix(1.0,smoothstep(0.35,0.85,facing),uEdge);",
	"  float bodyM = uUseBody>0.5 ? texture2D(uBodyTex,vec2(vScreenUV.x,1.0-vScreenUV.y)).r : skinMask(photo);",
	"  a*=mix(1.0,bodyM,uMask);",
	"  float regionM=texture2D(uRegionTex,vec2(vScreenUV.x,1.0-vScreenUV.y)).r;",
	"  a*=mix(1.0,regionM,uRegion);",
	"  float partM=texture2D(uPartTex,vec2(vScreenUV.x,1.0-vScreenUV.y)).r;",
	"  a*=mix(1.0,partM,uPart);",
	"  a*=uOpacity;",
	"  a*=mix(1.0,0.72,uAge);",
	"  a*=mix(1.0, mix(0.68,1.0,vnoise(vUV*9.0)), uAge*0.6);",
	"  float sat=max(max(t.r,t.g),t.b)-min(min(t.r,t.g),t.b);",
	"  float chroma=smoothstep(0.06,0.20,sat);",
	"  vec3 inkC=vec3(0.17,0.13,0.11);",
	"  vec3 tinted=mix(inkC,vec3(1.0),tl);",
	"  vec3 toneNeutral=mix(t.rgb,tinted,uInk);",
	"  vec3 toneColor=mix(t.rgb,t.rgb*vec3(0.88,0.90,0.94)+vec3(0.04,0.03,0.03),uInk);",
	"  vec3 tatt=mix(toneNeutral,toneColor,chroma);",
	"  float agl=luma(tatt);",
	"  tatt=mix(tatt,vec3(agl),uAge*0.6*(1.0-chroma*0.75));",
	"  tatt=mix(tatt,tatt*vec3(0.80,0.96,1.06),uAge*0.6*(1.0-agl)*(1.0-chroma));",
	"  vec3 lit=mix(tatt,tatt*clamp(pl*1.9,0.0,1.6),uLight*uUseLight);",
	"  lit*=mix(1.0,facing,uFace);",
	"  vec3 col=mix(lit,photo*lit,uBlend*uUseBlend);",
	"  gl_FragColor=vec4(col,a);",
	"}",
].join("\n");

// 부위 인접표: 해부학적으로 맞닿아 있는 부위만 나열 (자동 선택 시 인접 부위까지만 허용)
const ATR_ADJ: Record<number, number[]> = {
	1: [8, 15, 16],
	2: [15, 4],
	3: [16, 5],
	4: [2, 6],
	5: [3, 7],
	6: [4],
	7: [5],
	8: [1, 9, 10, 15, 16],
	9: [8, 11],
	10: [8, 12],
	11: [9, 13],
	12: [10, 14],
	13: [11],
	14: [12],
	15: [1, 2, 8],
	16: [1, 3, 8],
};

function ctx2d(c: HTMLCanvasElement, willRead = false): CanvasRenderingContext2D {
	return c.getContext("2d", willRead ? { willReadFrequently: true } : undefined)!;
}

export class InkproofEngine {
	private canvas: HTMLCanvasElement;

	private host: HTMLElement;

	private gl: WebGLRenderingContext;

	private photoProg: WebGLProgram;

	private meshProg: WebGLProgram;

	private quadBuf: WebGLBuffer;

	private localBuf: WebGLBuffer;

	private uvBuf: WebGLBuffer;

	private idxBuf: WebGLBuffer;

	private idxCount: number;

	private photoTex: WebGLTexture;

	private tattooTex: WebGLTexture;

	private depthTex: WebGLTexture;

	private bodyTex: WebGLTexture;

	private regionTex: WebGLTexture;

	private partTex: WebGLTexture;

	private cssW = 1;

	private cssH = 1;

	private photoCanvas = document.createElement("canvas");

	private lumaCanvas: HTMLCanvasElement | null = null;

	private realDepthCanvas: HTMLCanvasElement | null = null;

	private surfaceCanvas: HTMLCanvasElement | null = null;

	private bodyMaskCanvas: HTMLCanvasElement | null = null;

	private regionCanvas: HTMLCanvasElement | null = null;

	// 상태 — 원본 st. 굴곡 강도(bulge)는 요구사항대로 최대(1.0)
	private st = {
		center: { x: 0.5, y: 0.5 },
		angle: 0,
		scale: 0.42,
		tattooAspect: 1,
		photoAspect: 3 / 4,
		bulge: 1.0,
		edge: 0.45,
		opacity: 0.9,
		blend: 0.9,
		ink: 0.45,
		light: 0.75,
		shade: 0.55,
		face: 0.35,
		mask: 0.75,
		whiteKey: 1,
		useBlend: 1,
		useLight: 1,
		mix: 0.6,
		cut: 0.8,
		lock: 0.9,
		centerDepth: 0.5,
		age: 0,
		radius: 0.8,
		useBody: 0,
		smooth: true,
		feather: true,
		region: 0.9,
		regionTol: 0.045,
		part: 0,
		hasPart: false,
		partSel: {} as Record<number, boolean>,
		shExt: 0.25,
		partOv: 0.35,
	};

	// 부위 파싱 결과
	private partIdx: Uint8Array | null = null;

	private partBits: Uint32Array | null = null;

	private partW = 0;

	private partH = 0;

	private lastPose: { lms: any[]; seg: { data: Float32Array; w: number; h: number } | null } | null =
		null;

	// AI 모델 (동적 로드)
	private estimator: any = null;

	private segmenter: any = null;

	private landmarker: any = null;

	private mpVision: any = null;

	private mpFileset: any = null;

	private lastDetectW = 0;

	private lastDetectH = 0;

	private dragging = false;

	private disposed = false;

	private detachEvents: () => void;

	/** 배치 변경(드래그·휠) 시 알림 — UI가 크기/회전 값을 표시할 때 사용 */
	onPlacementChange: (() => void) | null = null;

	constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
		this.canvas = canvas;
		this.host = host;
		// alpha:false — 투명 캔버스면 타투 영역 알파(<1)가 밝은 페이지 배경과 합성되어
		// 잉크가 허옇게 씻겨 보인다 (원본 HTML은 배경이 검정이라 티가 안 났음)
		const gl =
			canvas.getContext("webgl", { alpha: false }) ||
			canvas.getContext("experimental-webgl", { alpha: false });
		if (!gl) throw new Error("이 브라우저에서 WebGL을 켤 수 없습니다.");
		this.gl = gl as WebGLRenderingContext;

		this.photoProg = this.link(PHOTO_VS, PHOTO_FS);
		this.meshProg = this.link(MESH_VS, MESH_FS);

		// geometry
		const g = this.gl;
		this.quadBuf = g.createBuffer()!;
		g.bindBuffer(g.ARRAY_BUFFER, this.quadBuf);
		g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);

		const SEG = 140;
		const local: number[] = [];
		const uvs: number[] = [];
		const idx: number[] = [];
		for (let j = 0; j <= SEG; j += 1) {
			for (let i = 0; i <= SEG; i += 1) {
				const u = i / SEG;
				const v = j / SEG;
				local.push(u - 0.5, v - 0.5);
				uvs.push(u, v);
			}
		}
		for (let jj = 0; jj < SEG; jj += 1) {
			for (let ii = 0; ii < SEG; ii += 1) {
				const r = jj * (SEG + 1) + ii;
				idx.push(r, r + 1, r + SEG + 1, r + 1, r + SEG + 2, r + SEG + 1);
			}
		}
		this.localBuf = g.createBuffer()!;
		g.bindBuffer(g.ARRAY_BUFFER, this.localBuf);
		g.bufferData(g.ARRAY_BUFFER, new Float32Array(local), g.STATIC_DRAW);
		this.uvBuf = g.createBuffer()!;
		g.bindBuffer(g.ARRAY_BUFFER, this.uvBuf);
		g.bufferData(g.ARRAY_BUFFER, new Float32Array(uvs), g.STATIC_DRAW);
		this.idxBuf = g.createBuffer()!;
		g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, this.idxBuf);
		g.bufferData(g.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), g.STATIC_DRAW);
		this.idxCount = idx.length;

		this.photoTex = this.makeTex();
		this.tattooTex = this.makeTex();
		this.depthTex = this.makeTex();
		this.bodyTex = this.makeTex();
		this.regionTex = this.makeTex();
		this.partTex = this.makeTex();
		const white = document.createElement("canvas");
		white.width = 2;
		white.height = 2;
		const wx = ctx2d(white);
		wx.fillStyle = "#fff";
		wx.fillRect(0, 0, 2, 2);
		this.upload(this.bodyTex, white);
		this.upload(this.regionTex, white);
		this.upload(this.partTex, white);

		this.detachEvents = this.attachEvents();
	}

	/* ---------- WebGL helpers ---------- */

	private compile(type: number, src: string): WebGLShader {
		const g = this.gl;
		const sh = g.createShader(type)!;
		g.shaderSource(sh, src);
		g.compileShader(sh);
		if (!g.getShaderParameter(sh, g.COMPILE_STATUS))
			throw new Error(g.getShaderInfoLog(sh) ?? "shader compile error");
		return sh;
	}

	private link(vs: string, fs: string): WebGLProgram {
		const g = this.gl;
		const p = g.createProgram()!;
		g.attachShader(p, this.compile(g.VERTEX_SHADER, vs));
		g.attachShader(p, this.compile(g.FRAGMENT_SHADER, fs));
		g.linkProgram(p);
		if (!g.getProgramParameter(p, g.LINK_STATUS))
			throw new Error(g.getProgramInfoLog(p) ?? "program link error");
		return p;
	}

	private makeTex(): WebGLTexture {
		const g = this.gl;
		const t = g.createTexture()!;
		g.bindTexture(g.TEXTURE_2D, t);
		g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
		g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
		g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
		g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
		return t;
	}

	private upload(tex: WebGLTexture, src: TexImageSource) {
		const g = this.gl;
		g.bindTexture(g.TEXTURE_2D, tex);
		g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, src);
	}

	private ml(name: string): WebGLUniformLocation | null {
		return this.gl.getUniformLocation(this.meshProg, name);
	}

	/* ---------- surface pipeline (원본과 동일 로직) ---------- */

	private static lumaDepth(srcCanvas: HTMLCanvasElement): HTMLCanvasElement {
		const W = Math.min(384, srcCanvas.width);
		const H = Math.round((W * srcCanvas.height) / srcCanvas.width);
		const cv = document.createElement("canvas");
		cv.width = W;
		cv.height = H;
		const x = ctx2d(cv, true);
		x.drawImage(srcCanvas, 0, 0, W, H);
		const id = x.getImageData(0, 0, W, H);
		const d = id.data;
		for (let i = 0; i < d.length; i += 4) {
			const v = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
			d[i] = v;
			d[i + 1] = v;
			d[i + 2] = v;
		}
		x.putImageData(id, 0, 0);
		return cv;
	}

	// 마스크 팽창(dilate): 소프트 경계가 실루엣 안쪽(팔 끝)을 파먹지 않게 바깥으로 민다
	private static dilateMask(src: HTMLCanvasElement, r: number): HTMLCanvasElement {
		const W = src.width;
		const H = src.height;
		const c = document.createElement("canvas");
		c.width = W;
		c.height = H;
		const x = ctx2d(c);
		x.globalCompositeOperation = "lighter";
		for (let a = 0; a < 8; a += 1) {
			const t = (a * Math.PI) / 4;
			x.drawImage(src, Math.cos(t) * r, Math.sin(t) * r);
		}
		x.drawImage(src, 0, 0);
		return c;
	}

	private static featherMask(
		src: HTMLCanvasElement,
		W: number,
		H: number,
		radius: number,
	): Uint8ClampedArray {
		const mc = document.createElement("canvas");
		mc.width = W;
		mc.height = H;
		const mx = ctx2d(mc, true);
		if (radius > 0 && mx.filter !== undefined) mx.filter = `blur(${radius}px)`;
		mx.drawImage(src, 0, 0, W, H);
		mx.filter = "none";
		return mx.getImageData(0, 0, W, H).data;
	}

	// bilateral 스무딩: 실루엣(엣지)은 지키고 노이즈만 제거
	private static bilateral(
		S: Uint8ClampedArray,
		W: number,
		H: number,
		radius: number,
		sigmaR: number,
	): Uint8ClampedArray {
		const out = new Uint8ClampedArray(S.length);
		const inv = 1 / (2 * sigmaR * sigmaR);
		for (let y = 0; y < H; y += 1) {
			for (let x = 0; x < W; x += 1) {
				const ci = (y * W + x) * 4;
				const cv = S[ci];
				let sum = 0;
				let wsum = 0;
				for (let dy = -radius; dy <= radius; dy += 1) {
					const yy = y + dy;
					if (yy >= 0 && yy < H) {
						for (let dx = -radius; dx <= radius; dx += 1) {
							const xx = x + dx;
							if (xx >= 0 && xx < W) {
								const v = S[(yy * W + xx) * 4];
								const d = v - cv;
								const w = Math.exp(-d * d * inv);
								sum += v * w;
								wsum += w;
							}
						}
					}
				}
				const r = wsum > 0 ? sum / wsum : cv;
				out[ci] = r;
				out[ci + 1] = r;
				out[ci + 2] = r;
				out[ci + 3] = 255;
			}
		}
		return out;
	}

	// 신체 마스크 업로드: 팽창 후 페더링 → 부드러운 경계 램프가 실루엣 바깥에 생긴다
	private uploadBodyTex() {
		if (!this.bodyMaskCanvas) return;
		const W = this.bodyMaskCanvas.width;
		const H = this.bodyMaskCanvas.height;
		const r = Math.max(2, Math.round(Math.min(W, H) * 0.006));
		let src = InkproofEngine.dilateMask(this.bodyMaskCanvas, r);
		if (this.st.feather) {
			const soft = document.createElement("canvas");
			soft.width = W;
			soft.height = H;
			const sx = ctx2d(soft);
			if (sx.filter !== undefined) sx.filter = `blur(${r}px)`;
			sx.drawImage(src, 0, 0);
			sx.filter = "none";
			src = soft;
		}
		this.upload(this.bodyTex, src);
	}

	// 백분위(2~98%) 정규화 + bilateral 스무딩 (신체 영역 기준)
	private applyBodyNorm(surf: HTMLCanvasElement) {
		if (!this.bodyMaskCanvas) return;
		const W = surf.width;
		const H = surf.height;
		const M = InkproofEngine.featherMask(this.bodyMaskCanvas, W, H, 0);
		const sx = ctx2d(surf, true);
		const sd = sx.getImageData(0, 0, W, H);
		const S = sd.data;

		const hist = new Uint32Array(256);
		let cnt = 0;
		for (let i = 0; i < S.length; i += 4) {
			if (M[i] > 127) {
				cnt += 1;
				hist[S[i]] += 1;
			}
		}
		if (cnt === 0) return;
		const loN = Math.floor(cnt * 0.02);
		const hiN = Math.floor(cnt * 0.98);
		let acc = 0;
		let lo = 0;
		let hi = 255;
		let gotLo = false;
		for (let b = 0; b < 256; b += 1) {
			acc += hist[b];
			if (!gotLo && acc >= loN) {
				lo = b;
				gotLo = true;
			}
			if (acc >= hiN) {
				hi = b;
				break;
			}
		}
		if (hi <= lo) hi = lo + 1;
		// 주의: 깊이값에 마스크를 곱하면 경계 안쪽에 '가짜 절벽'이 생겨
		// cliff(uCut)·lock(uLock) 로직이 오작동한다. 마스킹은 uBodyTex가 담당.
		for (let i = 0; i < S.length; i += 4) {
			let v = ((S[i] - lo) / (hi - lo)) * 255;
			v = v < 0 ? 0 : v > 255 ? 255 : v;
			S[i] = v;
			S[i + 1] = v;
			S[i + 2] = v;
		}
		if (this.st.smooth) {
			const sm = InkproofEngine.bilateral(S, W, H, 2, 18);
			for (let i = 0; i < S.length; i += 1) S[i] = sm[i];
		}
		sx.putImageData(sd, 0, 0);
	}

	private updateCenterDepth() {
		if (!this.surfaceCanvas) return;
		const W = this.surfaceCanvas.width;
		const H = this.surfaceCanvas.height;
		const px = Math.max(0, Math.min(W - 1, Math.round(this.st.center.x * (W - 1))));
		const py = Math.max(0, Math.min(H - 1, Math.round((1 - this.st.center.y) * (H - 1))));
		this.st.centerDepth = ctx2d(this.surfaceCanvas, true).getImageData(px, py, 1, 1).data[0] / 255;
	}

	// 연결 영역: 타투 중심에서 '깊이 절벽'을 넘지 않고 도달 가능한 영역만 남긴다
	private computeRegion() {
		if (!this.surfaceCanvas) return;
		const SW = this.surfaceCanvas.width;
		const SH = this.surfaceCanvas.height;
		const RW = Math.min(256, SW);
		const RH = Math.max(1, Math.round((RW * SH) / SW));
		if (!this.regionCanvas) this.regionCanvas = document.createElement("canvas");
		if (this.regionCanvas.width !== RW || this.regionCanvas.height !== RH) {
			this.regionCanvas.width = RW;
			this.regionCanvas.height = RH;
		}
		const rx = ctx2d(this.regionCanvas, true);
		const tc = document.createElement("canvas");
		tc.width = RW;
		tc.height = RH;
		const tx = ctx2d(tc, true);
		tx.drawImage(this.surfaceCanvas, 0, 0, RW, RH);
		const D = tx.getImageData(0, 0, RW, RH).data;

		// 신체 마스크 벽 — 문턱 64 (MODNet 소프트 경계에서 팔 끝이 깎이지 않게 낮게)
		let MD: Uint8ClampedArray | null = null;
		if (this.bodyMaskCanvas) {
			const mcv = document.createElement("canvas");
			mcv.width = RW;
			mcv.height = RH;
			const mtx = ctx2d(mcv, true);
			mtx.drawImage(this.bodyMaskCanvas, 0, 0, RW, RH);
			MD = mtx.getImageData(0, 0, RW, RH).data;
		}
		const open = (q: number) => !MD || MD[q * 4] > 64;

		const sx = Math.max(0, Math.min(RW - 1, Math.round(this.st.center.x * (RW - 1))));
		const sy = Math.max(0, Math.min(RH - 1, Math.round((1 - this.st.center.y) * (RH - 1))));
		const N = RW * RH;
		const vis = new Uint8Array(N);
		const tol = this.st.regionTol * 255;
		const queue = new Int32Array(N);
		let qh = 0;
		let qt = 0;
		const start = sy * RW + sx;
		vis[start] = 1;
		queue[qt] = start;
		qt += 1;
		while (qh < qt) {
			const p = queue[qh];
			qh += 1;
			const py = Math.floor(p / RW);
			const px = p - py * RW;
			const cv = D[p * 4];
			const tryVisit = (q: number) => {
				if (!vis[q] && open(q) && Math.abs(D[q * 4] - cv) <= tol) {
					vis[q] = 1;
					queue[qt] = q;
					qt += 1;
				}
			};
			if (px > 0) tryVisit(p - 1);
			if (px < RW - 1) tryVisit(p + 1);
			if (py > 0) tryVisit(p - RW);
			if (py < RH - 1) tryVisit(p + RW);
		}
		const img = rx.createImageData(RW, RH);
		for (let i = 0, j = 0; i < N; i += 1, j += 4) {
			const v = vis[i] ? 255 : 0;
			img.data[j] = v;
			img.data[j + 1] = v;
			img.data[j + 2] = v;
			img.data[j + 3] = 255;
		}
		rx.putImageData(img, 0, 0);
		const bc = document.createElement("canvas");
		bc.width = RW;
		bc.height = RH;
		const bx = ctx2d(bc);
		if (bx.filter !== undefined) bx.filter = "blur(1.5px)";
		bx.drawImage(this.regionCanvas, 0, 0);
		bx.filter = "none";
		this.upload(this.regionTex, bc);
	}

	private rebuildSurface() {
		const base = this.lumaCanvas;
		if (!base) return;
		const W = base.width;
		const H = base.height;
		const out = document.createElement("canvas");
		out.width = W;
		out.height = H;
		const ox = ctx2d(out, true);
		if (!this.realDepthCanvas) {
			ox.drawImage(base, 0, 0);
		} else {
			const tmp = document.createElement("canvas");
			tmp.width = W;
			tmp.height = H;
			ctx2d(tmp).drawImage(this.realDepthCanvas, 0, 0, W, H);
			const la = ctx2d(base, true).getImageData(0, 0, W, H);
			const da = ctx2d(tmp, true).getImageData(0, 0, W, H);
			const L = la.data;
			const D = da.data;
			const m = this.st.mix;
			for (let i = 0; i < L.length; i += 4) {
				const v = L[i] * (1.0 - m) + D[i] * m;
				L[i] = v;
				L[i + 1] = v;
				L[i + 2] = v;
			}
			ox.putImageData(la, 0, 0);
		}
		this.applyBodyNorm(out);
		this.uploadBodyTex();
		this.upload(this.depthTex, out);
		this.surfaceCanvas = out;
		this.updateCenterDepth();
		this.computeRegion();
	}

	/* ---------- 소스 설정 ---------- */

	setPhoto(src: HTMLImageElement | HTMLCanvasElement) {
		const w = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
		const h = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
		const cap = 1024;
		let W = w;
		let H = h;
		if (Math.max(W, H) > cap) {
			const sc = cap / Math.max(W, H);
			W = Math.round(W * sc);
			H = Math.round(H * sc);
		}
		this.photoCanvas.width = W;
		this.photoCanvas.height = H;
		ctx2d(this.photoCanvas).drawImage(src, 0, 0, W, H);
		this.upload(this.photoTex, this.photoCanvas);
		this.st.photoAspect = W / H;
		this.lumaCanvas = InkproofEngine.lumaDepth(this.photoCanvas);
		this.realDepthCanvas = null;
		this.bodyMaskCanvas = null;
		this.st.useBody = 0;
		this.partIdx = null;
		this.st.hasPart = false;
		this.st.part = 0;
		this.st.partSel = {};
		this.rebuildSurface();
		this.resize();
	}

	setTattoo(img: HTMLImageElement) {
		this.st.tattooAspect = img.naturalWidth / img.naturalHeight;
		this.upload(this.tattooTex, img);
		this.render();
	}

	setAge(v: number) {
		this.st.age = Math.max(0, Math.min(1, v));
		this.render();
	}

	getPlacement() {
		return {
			scalePct: Math.round(this.st.scale * 100),
			rotationDeg: Math.round((this.st.angle * 180) / Math.PI),
		};
	}

	/* ---------- 레이아웃·렌더 ---------- */

	resize() {
		const avail = this.host.clientWidth;
		const maxH = this.host.clientHeight;
		if (avail <= 0 || maxH <= 0) return;
		let w = Math.min(avail, 720);
		let h = w / this.st.photoAspect;
		if (h > maxH) {
			h = maxH;
			w = h * this.st.photoAspect;
		}
		this.cssW = Math.max(1, Math.round(w));
		this.cssH = Math.max(1, Math.round(h));
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		this.canvas.style.width = `${this.cssW}px`;
		this.canvas.style.height = `${this.cssH}px`;
		this.canvas.width = Math.round(this.cssW * dpr);
		this.canvas.height = Math.round(this.cssH * dpr);
		this.render();
	}

	render() {
		if (this.disposed) return;
		const g = this.gl;
		g.viewport(0, 0, this.canvas.width, this.canvas.height);
		g.disable(g.BLEND);
		g.clearColor(0, 0, 0, 1);
		g.clear(g.COLOR_BUFFER_BIT);
		// photo pass
		g.useProgram(this.photoProg);
		g.bindBuffer(g.ARRAY_BUFFER, this.quadBuf);
		const pPos = g.getAttribLocation(this.photoProg, "aPos");
		g.enableVertexAttribArray(pPos);
		g.vertexAttribPointer(pPos, 2, g.FLOAT, false, 0, 0);
		g.activeTexture(g.TEXTURE0);
		g.bindTexture(g.TEXTURE_2D, this.photoTex);
		g.uniform1i(g.getUniformLocation(this.photoProg, "uPhoto"), 0);
		g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
		// mesh pass
		g.useProgram(this.meshProg);
		g.enable(g.BLEND);
		g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA);
		g.bindBuffer(g.ARRAY_BUFFER, this.localBuf);
		const aL = g.getAttribLocation(this.meshProg, "aLocal");
		g.enableVertexAttribArray(aL);
		g.vertexAttribPointer(aL, 2, g.FLOAT, false, 0, 0);
		g.bindBuffer(g.ARRAY_BUFFER, this.uvBuf);
		const aU = g.getAttribLocation(this.meshProg, "aUV");
		g.enableVertexAttribArray(aU);
		g.vertexAttribPointer(aU, 2, g.FLOAT, false, 0, 0);
		g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, this.idxBuf);
		const bindTex = (unit: number, tex: WebGLTexture, name: string) => {
			g.activeTexture(g.TEXTURE0 + unit);
			g.bindTexture(g.TEXTURE_2D, tex);
			g.uniform1i(this.ml(name), unit);
		};
		bindTex(0, this.tattooTex, "uTattoo");
		bindTex(1, this.photoTex, "uPhoto");
		bindTex(2, this.depthTex, "uDepth");
		bindTex(3, this.bodyTex, "uBodyTex");
		bindTex(4, this.regionTex, "uRegionTex");
		bindTex(5, this.partTex, "uPartTex");
		const s = this.st;
		g.uniform1f(this.ml("uRegion"), s.region);
		g.uniform1f(this.ml("uPart"), s.hasPart ? s.part : 0);
		g.uniform1f(this.ml("uUseBody"), s.useBody);
		g.uniform2f(this.ml("uCenter"), s.center.x, s.center.y);
		g.uniform1f(this.ml("uScale"), s.scale);
		g.uniform1f(this.ml("uAngle"), s.angle);
		g.uniform1f(this.ml("uTattooAspect"), s.tattooAspect);
		g.uniform1f(this.ml("uAspect"), this.cssW / this.cssH);
		g.uniform1f(this.ml("uBulge"), s.bulge);
		g.uniform1f(this.ml("uOpacity"), s.opacity);
		g.uniform1f(this.ml("uBlend"), s.blend);
		g.uniform1f(this.ml("uInk"), s.ink);
		g.uniform1f(this.ml("uLight"), s.light);
		g.uniform1f(this.ml("uShade"), s.shade);
		g.uniform1f(this.ml("uFace"), s.face);
		g.uniform1f(this.ml("uEdge"), s.edge);
		g.uniform1f(this.ml("uWhiteKey"), s.whiteKey);
		g.uniform1f(this.ml("uMask"), s.mask);
		g.uniform1f(this.ml("uCut"), s.cut);
		g.uniform1f(this.ml("uCenterDepth"), s.centerDepth);
		g.uniform1f(this.ml("uLock"), s.lock);
		g.uniform1f(this.ml("uAge"), s.age);
		g.uniform1f(this.ml("uRadius"), s.radius * 0.75);
		g.uniform1f(this.ml("uUseBlend"), s.useBlend);
		g.uniform1f(this.ml("uUseLight"), s.useLight);
		g.uniform1f(this.ml("uTexel"), 1.6 / 384.0);
		g.drawElements(g.TRIANGLES, this.idxCount, g.UNSIGNED_SHORT, 0);
	}

	toBlob(): Promise<Blob | null> {
		this.render();
		return new Promise((resolve) => {
			this.canvas.toBlob((b) => resolve(b), "image/png");
		});
	}

	/* ---------- 입력 (드래그 이동 · 휠 크기 · Shift+휠 회전) ---------- */

	private attachEvents(): () => void {
		const cv = this.canvas;
		const moveTo = (e: PointerEvent) => {
			const r = cv.getBoundingClientRect();
			this.st.center.x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
			this.st.center.y = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
			this.updateCenterDepth();
			this.computeRegion();
			this.autoSelectFromCenter();
			this.render();
			this.onPlacementChange?.();
		};
		const onDown = (e: PointerEvent) => {
			this.dragging = true;
			cv.classList.add("cursor-grabbing");
			cv.setPointerCapture(e.pointerId);
			moveTo(e);
		};
		const onMove = (e: PointerEvent) => {
			if (this.dragging) moveTo(e);
		};
		const onUp = () => {
			this.dragging = false;
			cv.classList.remove("cursor-grabbing");
		};
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			if (e.shiftKey) {
				this.st.angle += (e.deltaY > 0 ? 1 : -1) * 0.06;
			} else {
				this.st.scale = Math.max(0.05, Math.min(1.2, this.st.scale * (e.deltaY > 0 ? 0.95 : 1.0526)));
			}
			this.autoSelectFromCenter();
			this.render();
			this.onPlacementChange?.();
		};
		cv.addEventListener("pointerdown", onDown);
		cv.addEventListener("pointermove", onMove);
		cv.addEventListener("pointerup", onUp);
		cv.addEventListener("wheel", onWheel, { passive: false });
		return () => {
			cv.removeEventListener("pointerdown", onDown);
			cv.removeEventListener("pointermove", onMove);
			cv.removeEventListener("pointerup", onUp);
			cv.removeEventListener("wheel", onWheel);
		};
	}

	/* ---------- AI 1: 신체 마스크 (MODNet) ---------- */

	private async ensureSegmenter(onProgress: ProgressHandler) {
		if (this.segmenter) return this.segmenter;
		onProgress("라이브러리 불러오는 중…");
		const mod = await import(/* @vite-ignore */ TRANSFORMERS_CDN);
		const { pipeline } = mod;
		const prog = (p: { status?: string; progress?: number }) => {
			if (p && p.status === "progress" && p.progress != null)
				onProgress(`모델 다운로드 ${Math.round(p.progress)}%`);
		};
		onProgress("모델 불러오는 중… (최초 1회)");
		const model = "Xenova/modnet";
		this.segmenter = await pipeline("background-removal", model, {
			device: "webgpu",
			dtype: "fp32",
			progress_callback: prog,
		}).catch(() =>
			pipeline("background-removal", model, {
				device: "wasm",
				dtype: "fp32",
				progress_callback: prog,
			}),
		);
		return this.segmenter;
	}

	async runBodyMask(onProgress: ProgressHandler): Promise<void> {
		const seg = await this.ensureSegmenter(onProgress);
		onProgress("신체 분리 중…");
		const url = this.photoCanvas.toDataURL("image/jpeg", 0.92);
		const out = await seg(url);
		let ri = Array.isArray(out) ? out[0] : out;
		if (ri && ri.mask) ri = ri.mask;
		if (!ri || !ri.data) throw new Error("세그멘테이션 출력 형식을 해석하지 못했습니다.");
		const W = ri.width as number;
		const H = ri.height as number;
		const ch = (ri.channels as number) || ri.data.length / (W * H);
		const bmc = document.createElement("canvas");
		bmc.width = W;
		bmc.height = H;
		const ictx = ctx2d(bmc);
		const img = ictx.createImageData(W, H);
		for (let i = 0, jp = 0; i < W * H; i += 1, jp += 4) {
			let a: number = ch >= 4 ? ri.data[i * ch + 3] : ri.data[i * ch];
			// 신뢰도 완화(레벨 확장): 어두운 배경과 맞닿은 경계에서 알파가 애매하게 나와
			// 마스크가 팔보다 일찍 끝나는 것을 방지 — 16~150 구간을 0~255로 편다
			a = a <= 16 ? 0 : a >= 150 ? 255 : Math.round(((a - 16) * 255) / 134);
			img.data[jp] = a;
			img.data[jp + 1] = a;
			img.data[jp + 2] = a;
			img.data[jp + 3] = 255;
		}
		ictx.putImageData(img, 0, 0);
		this.bodyMaskCanvas = bmc;
		this.uploadBodyTex();
		this.st.useBody = 1;
		this.rebuildSurface();
		this.render();
	}

	/* ---------- AI 2: 뎁스맵 (Depth Anything V2) ---------- */

	private async ensureEstimator(onProgress: ProgressHandler) {
		if (this.estimator) return this.estimator;
		onProgress("라이브러리 불러오는 중…");
		const mod = await import(/* @vite-ignore */ TRANSFORMERS_CDN);
		const { pipeline } = mod;
		const prog = (p: { status?: string; progress?: number }) => {
			if (p && p.status === "progress" && p.progress != null)
				onProgress(`모델 다운로드 ${Math.round(p.progress)}%`);
		};
		onProgress("모델 불러오는 중… (최초 1회, ~100–200MB)");
		const model = "onnx-community/depth-anything-v2-base";
		this.estimator = await pipeline("depth-estimation", model, {
			device: "webgpu",
			dtype: "fp16",
			progress_callback: prog,
		}).catch(() =>
			pipeline("depth-estimation", model, {
				device: "wasm",
				dtype: "q8",
				progress_callback: prog,
			}),
		);
		return this.estimator;
	}

	async runDepthMap(onProgress: ProgressHandler): Promise<void> {
		const est = await this.ensureEstimator(onProgress);
		onProgress("깊이 추정 중…");
		const url = this.photoCanvas.toDataURL("image/jpeg", 0.92);
		const out = await est(url);
		const d = out.depth;
		const W = d.width as number;
		const H = d.height as number;
		const ch = (d.channels as number) || d.data.length / (W * H);
		const dc = document.createElement("canvas");
		dc.width = W;
		dc.height = H;
		const ictx = ctx2d(dc);
		const img = ictx.createImageData(W, H);
		for (let i = 0, jp = 0; i < W * H; i += 1, jp += 4) {
			const v = d.data[i * ch];
			img.data[jp] = v;
			img.data[jp + 1] = v;
			img.data[jp + 2] = v;
			img.data[jp + 3] = 255;
		}
		ictx.putImageData(img, 0, 0);
		this.realDepthCanvas = dc;
		this.rebuildSurface();
		this.render();
	}

	/* ---------- AI 3: 부위 인식 (MediaPipe Pose) ---------- */

	private createLandmarker(delegate: string, model?: string) {
		return this.mpVision.PoseLandmarker.createFromOptions(this.mpFileset, {
			baseOptions: { modelAssetPath: model || MP_MODEL, delegate },
			runningMode: "IMAGE",
			numPoses: 1,
			outputSegmentationMasks: true,
			minPoseDetectionConfidence: 0.3,
			minPosePresenceConfidence: 0.3,
		});
	}

	private async ensureLandmarker(onProgress: ProgressHandler) {
		if (this.landmarker) return this.landmarker;
		onProgress("라이브러리 불러오는 중… (MediaPipe)");
		const mod = await import(/* @vite-ignore */ `${MP_CDN}/vision_bundle.mjs`);
		this.mpVision = mod;
		this.mpFileset = await mod.FilesetResolver.forVisionTasks(`${MP_CDN}/wasm`);
		onProgress("모델 불러오는 중… (Pose Landmarker, 최초 1회 ~9MB)");
		// GPU 델리게이트는 일부 드라이버에서 엉터리 관절을 조용히 반환 → CPU 우선
		this.landmarker = await this.createLandmarker("CPU").catch(() => this.createLandmarker("GPU"));
		return this.landmarker;
	}

	// MediaPipe 버그 대응: 사진 크기가 바뀌면 인스턴스 재생성 (WASM abort 회피)
	private async detectPose(onProgress: ProgressHandler): Promise<any> {
		if (
			this.landmarker &&
			(this.photoCanvas.width !== this.lastDetectW || this.photoCanvas.height !== this.lastDetectH) &&
			this.lastDetectW > 0
		) {
			try {
				this.landmarker.close?.();
			} catch {
				/* ignore */
			}
			this.landmarker = null;
			await this.ensureLandmarker(onProgress);
		}
		this.lastDetectW = this.photoCanvas.width;
		this.lastDetectH = this.photoCanvas.height;
		try {
			return this.landmarker.detect(this.photoCanvas);
		} catch {
			try {
				this.landmarker.close?.();
			} catch {
				/* ignore */
			}
			this.landmarker = null;
			await this.ensureLandmarker(onProgress);
			return this.landmarker.detect(this.photoCanvas);
		}
	}

	private static extractPose(res: any) {
		if (!res || !res.landmarks || !res.landmarks.length) return null;
		const segMask = (res.segmentationMasks && res.segmentationMasks[0]) || null;
		const seg = segMask
			? { data: segMask.getAsFloat32Array() as Float32Array, w: segMask.width, h: segMask.height }
			: null;
		const lms = res.landmarks[0];
		try {
			res.close?.();
		} catch {
			/* ignore */
		}
		return { lms, seg };
	}

	// 33개 관절이 이미지의 25%×25%보다 작은 영역에 뭉치면 ROI 붕괴로 판정
	private static skeletonCollapsed(lms: any[]): boolean {
		let x0 = 1e9;
		let y0 = 1e9;
		let x1 = -1e9;
		let y1 = -1e9;
		for (let i = 0; i < lms.length; i += 1) {
			const l = lms[i];
			if (l.x < x0) x0 = l.x;
			if (l.x > x1) x1 = l.x;
			if (l.y < y0) y0 = l.y;
			if (l.y > y1) y1 = l.y;
		}
		return x1 - x0 < 0.25 && y1 - y0 < 0.25;
	}

	private static segDist(px: number, py: number, a: Pt, b: Pt): number {
		const vx = b[0] - a[0];
		const vy = b[1] - a[1];
		const wx = px - a[0];
		const wy = py - a[1];
		const L2 = vx * vx + vy * vy;
		const t = L2 > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / L2)) : 0;
		const dx = wx - t * vx;
		const dy = wy - t * vy;
		return Math.sqrt(dx * dx + dy * dy);
	}

	// 33개 관절 → 뼈대 캡슐 목록 → 픽셀 최근접 할당으로 17클래스 부위 맵 생성
	private buildPartIdxFromPose(
		lms: any[],
		segMask: { data: Float32Array; w: number; h: number } | null,
	) {
		const collapsed = InkproofEngine.skeletonCollapsed(lms);
		const pw = this.photoCanvas.width;
		const ph = this.photoCanvas.height;
		const sc = 256 / Math.max(pw, ph);
		const W = Math.max(2, Math.round(pw * sc));
		const H = Math.max(2, Math.round(ph * sc));
		const P = (i: number): Pt => {
			const l = lms[i];
			return [l.x * W, l.y * H, l.visibility != null ? l.visibility : 1];
		};
		const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.min(a[2], b[2])];
		const LSh = P(11);
		const RSh = P(12);
		const LEl = P(13);
		const REl = P(14);
		const LWr = P(15);
		const RWr = P(16);
		const LHp = P(23);
		const RHp = P(24);
		const LKn = P(25);
		const RKn = P(26);
		const LAn = P(27);
		const RAn = P(28);
		const LHa = mid(mid(P(17), P(19)), P(21));
		const RHa = mid(mid(P(18), P(20)), P(22));
		const LFt = P(31);
		const RFt = P(32);
		const nose = P(0);
		const LEar = P(7);
		const REar = P(8);
		const head: Pt = [
			(nose[0] + LEar[0] + REar[0]) / 3,
			(nose[1] + LEar[1] + REar[1]) / 3,
			Math.max(nose[2], LEar[2], REar[2]),
		];
		const mSh = mid(LSh, RSh);
		let mHp = mid(LHp, RHp);
		// 반경 기준 = 어깨너비 (측면 사진 하한 보정)
		let sw = Math.hypot(LSh[0] - RSh[0], LSh[1] - RSh[1]);
		if (mHp[2] > 0.35) sw = Math.max(sw, 0.55 * Math.hypot(mSh[0] - mHp[0], mSh[1] - mHp[1]));
		sw = Math.max(sw, 0.05 * Math.max(W, H));
		// 얼굴 캡슐 가드: 뒷모습에서 환각된 얼굴이 온몸을 집어삼키는 것 방지
		if (head[2] > 0.5) {
			let dux = 0;
			let duy = 1;
			if (mHp[2] > 0.35) {
				const tx = mHp[0] - mSh[0];
				const ty = mHp[1] - mSh[1];
				const tl = Math.hypot(tx, ty) || 1;
				dux = tx / tl;
				duy = ty / tl;
			}
			const proj = (head[0] - mSh[0]) * dux + (head[1] - mSh[1]) * duy;
			if (proj > -0.15 * sw) head[2] = 0;
		} else head[2] = 0;
		// 하반신이 잘린 사진: 가상 척추로 몸통 캡슐을 아래로 연장
		if (mHp[2] <= 0.35 && Math.min(LSh[2], RSh[2]) > 0.35) {
			let ddx = 0;
			let ddy = 1;
			if (head[2] > 0) {
				const hx = mSh[0] - head[0];
				const hy = mSh[1] - head[1];
				const hl = Math.hypot(hx, hy) || 1;
				ddx = hx / hl;
				ddy = hy / hl;
			}
			mHp = [mSh[0] + ddx * 1.6 * sw, mSh[1] + ddy * 1.6 * sw, Math.min(LSh[2], RSh[2])];
		}
		const ext = (a: Pt, b: Pt, f: number): Pt => [
			b[0] + (b[0] - a[0]) * f,
			b[1] + (b[1] - a[1]) * f,
			b[2],
		];
		const lerp = (a: Pt, b: Pt, t: number): Pt => [
			a[0] + (b[0] - a[0]) * t,
			a[1] + (b[1] - a[1]) * t,
			Math.min(a[2], b[2]),
		];
		const ax = this.st.shExt;
		// [시작점, 끝점, 논리클래스, 반경계수]
		type Cap = [Pt, Pt, number, number];
		const caps = (
			[
				[head, mid(head, mSh), 1, 0.5],
				[mSh, mHp, 8, 0.62],
				[lerp(LSh, RSh, 0.3), lerp(LSh, RSh, 0.7), 8, 0.42],
				[lerp(LHp, RHp, 0.3), lerp(LHp, RHp, 0.7), 8, 0.42],
				[LSh, LEl, 2, 0.22],
				[RSh, REl, 3, 0.22],
				[LSh, ext(LEl, LSh, ax), 15, 0.28],
				[RSh, ext(REl, RSh, ax), 16, 0.28],
				[LEl, LWr, 4, 0.18],
				[REl, RWr, 5, 0.18],
				[LWr, LHa, 6, 0.2],
				[RWr, RHa, 7, 0.2],
				[ext(LKn, LHp, 0.15), LKn, 9, 0.34],
				[ext(RKn, RHp, 0.15), RKn, 10, 0.34],
				[LKn, LAn, 11, 0.24],
				[RKn, RAn, 12, 0.24],
				[LAn, LFt, 13, 0.22],
				[RAn, RFt, 14, 0.22],
			] as Cap[]
		).filter((c) => {
			// 손은 프레임 밖인데 프레임 안 좌표로 환각되는 일이 잦아 더 엄격히
			const vmin = c[2] === 6 || c[2] === 7 ? 0.5 : 0.25;
			if (c[0][2] <= vmin || c[1][2] <= vmin) return false;
			const inF = (p: Pt) => p[0] > -0.25 * W && p[0] < 1.25 * W && p[1] > -0.25 * H && p[1] < 1.25 * H;
			return inF(c[0]) && inF(c[1]);
		});
		// 신체 마스크: MODNet(있으면) 우선, 없으면 Pose 자체 세그 마스크
		let maskData: Uint8ClampedArray | null = null;
		if (this.bodyMaskCanvas) {
			const mc = document.createElement("canvas");
			mc.width = W;
			mc.height = H;
			const mx = ctx2d(mc, true);
			const dr = Math.max(
				2,
				Math.round(Math.min(this.bodyMaskCanvas.width, this.bodyMaskCanvas.height) * 0.006),
			);
			mx.drawImage(InkproofEngine.dilateMask(this.bodyMaskCanvas, dr), 0, 0, W, H);
			maskData = mx.getImageData(0, 0, W, H).data;
		}
		let segData: Float32Array | null = null;
		let segW = 0;
		let segH = 0;
		if (!maskData && segMask) {
			segData = segMask.data;
			segW = segMask.w;
			segH = segMask.h;
		}
		const idx = new Uint8Array(W * H);
		// 겹침 밴드: 최단 캡슐과의 정규화 거리 차가 ov 이내인 클래스는 전부 소속(비트마스크)
		const bits = new Uint32Array(W * H);
		const ov = this.st.partOv;
		const ds = new Float32Array(caps.length);
		for (let y = 0; y < H; y += 1) {
			for (let x = 0; x < W; x += 1) {
				const i = y * W + x;
				let inBody = true;
				if (maskData) inBody = maskData[i * 4] > 127;
				else if (segData) {
					const sxp = Math.min(segW - 1, Math.round((x / (W - 1)) * (segW - 1)));
					const syp = Math.min(segH - 1, Math.round((y / (H - 1)) * (segH - 1)));
					inBody = segData[syp * segW + sxp] > 0.5;
				}
				if (!inBody) {
					idx[i] = 0;
				} else if (collapsed) {
					idx[i] = 8;
					 
					bits[i] = 1 << 8;
				} else {
					let best = 0;
					let bestD = 1e9;
					for (let c = 0; c < caps.length; c += 1) {
						const d = InkproofEngine.segDist(x, y, caps[c][0], caps[c][1]) / (sw * caps[c][3]);
						ds[c] = d;
						if (d < bestD) {
							bestD = d;
							best = caps[c][2];
						}
					}
					idx[i] = best;
					 
					let b = 1 << best;
					for (let c = 0; c < caps.length; c += 1) {
						 
						if (ds[c] <= bestD + ov) b |= 1 << caps[c][2];
					}
					bits[i] = b;
				}
			}
		}
		return { idx, bits, W, H };
	}

	private centerClass(): number {
		if (!this.partIdx) return -1;
		const px = Math.max(0, Math.min(this.partW - 1, Math.round(this.st.center.x * (this.partW - 1))));
		const py = Math.max(
			0,
			Math.min(this.partH - 1, Math.round((1 - this.st.center.y) * (this.partH - 1))),
		);
		return this.partIdx[py * this.partW + px];
	}

	// 선택된 부위들의 합집합으로 마스크를 만든다
	private buildPartMask() {
		if (!this.partIdx) {
			this.st.hasPart = false;
			return;
		}
		const sel = this.st.partSel;
		const c = document.createElement("canvas");
		c.width = this.partW;
		c.height = this.partH;
		const cx = ctx2d(c);
		const img = cx.createImageData(this.partW, this.partH);
		const n = this.partW * this.partH;
		let selBits = 0;
		Object.keys(sel).forEach((s) => {
			 
			if (sel[+s]) selBits |= 1 << +s;
		});
		for (let i = 0, j = 0; i < n; i += 1, j += 4) {
			 
			const on = this.partBits ? ((this.partBits[i] & selBits) ? 255 : 0) : sel[this.partIdx[i]] ? 255 : 0;
			img.data[j] = on;
			img.data[j + 1] = on;
			img.data[j + 2] = on;
			img.data[j + 3] = 255;
		}
		cx.putImageData(img, 0, 0);
		const bc = document.createElement("canvas");
		bc.width = this.partW;
		bc.height = this.partH;
		const bx = ctx2d(bc);
		if (bx.filter !== undefined) bx.filter = "blur(1.5px)";
		bx.drawImage(InkproofEngine.dilateMask(c, 1), 0, 0);
		bx.filter = "none";
		this.upload(this.partTex, bc);
		this.st.hasPart = true;
	}

	// 자동 선택: 타투 중심 부위가 주 소속, 커버리지 8% 이상 + 인접 부위만 부 소속
	private autoSelectFromCenter() {
		if (!this.partIdx) return;
		const asp = this.cssW / this.cssH;
		const c = Math.cos(this.st.angle);
		const s = Math.sin(this.st.angle);
		const counts: Record<number, number> = {};
		let tot = 0;
		const N = 15;
		for (let gy = 0; gy < N; gy += 1) {
			for (let gx = 0; gx < N; gx += 1) {
				const lx = gx / (N - 1) - 0.5;
				const ly = gy / (N - 1) - 0.5;
				if (lx * lx + ly * ly <= 0.23) {
					const vx = lx * this.st.scale * this.st.tattooAspect;
					const vy = ly * this.st.scale;
					const rx = vx * c - vy * s;
					const ry = vx * s + vy * c;
					const ux = this.st.center.x + rx / asp;
					const uy = this.st.center.y + ry;
					if (ux >= 0 && ux <= 1 && uy >= 0 && uy <= 1) {
						const px = Math.max(0, Math.min(this.partW - 1, Math.round(ux * (this.partW - 1))));
						const py = Math.max(0, Math.min(this.partH - 1, Math.round((1 - uy) * (this.partH - 1))));
						const cls = this.partIdx[py * this.partW + px];
						if (cls > 0) counts[cls] = (counts[cls] || 0) + 1;
						tot += 1;
					}
				}
			}
		}
		const cc = this.centerClass();
		let allowed: Record<number, boolean> | null = null;
		if (cc > 0) {
			allowed = { [cc]: true };
			(ATR_ADJ[cc] || []).forEach((a) => {
				allowed![a] = true;
			});
		}
		const sel: Record<number, boolean> = {};
		let any = false;
		Object.keys(counts).forEach((k) => {
			const kn = +k;
			if (counts[kn] >= tot * 0.08 && (!allowed || allowed[kn])) {
				sel[kn] = true;
				any = true;
			}
		});
		if (cc > 0) {
			sel[cc] = true;
			any = true;
		}
		if (!any) return;
		this.st.partSel = sel;
		this.buildPartMask();
	}

	private applyPoseResult(first: boolean) {
		if (!this.lastPose) return;
		const out = this.buildPartIdxFromPose(this.lastPose.lms, this.lastPose.seg);
		this.partIdx = out.idx;
		this.partBits = out.bits;
		this.partW = out.W;
		this.partH = out.H;
		if (first) {
			this.st.partSel = {};
			const cc = this.centerClass();
			if (cc >= 0) this.st.partSel[cc] = true;
			this.st.part = 0.99;
		}
		this.buildPartMask();
		this.autoSelectFromCenter();
		this.render();
	}

	async runPartParsing(onProgress: ProgressHandler): Promise<void> {
		await this.ensureLandmarker(onProgress);
		onProgress("포즈 분석 중…");
		const res = await this.detectPose(onProgress);
		const pose = InkproofEngine.extractPose(res);
		if (!pose) throw new Error("사진에서 사람 포즈를 찾지 못했습니다.");
		if (!InkproofEngine.skeletonCollapsed(pose.lms)) {
			this.lastPose = pose;
			this.applyPoseResult(true);
			return;
		}
		// 스켈레톤 붕괴 → 정밀 모델(heavy)로 1회 재시도
		onProgress("포즈가 불안정해 정밀 모델로 재시도 중… (최초 1회 ~26MB)");
		const hlm = await this.createLandmarker("CPU", MP_MODEL_HEAVY);
		let hres: any = null;
		try {
			hres = hlm.detect(this.photoCanvas);
		} catch {
			/* ignore */
		}
		const hpose = hres ? InkproofEngine.extractPose(hres) : null;
		try {
			hlm.close?.();
		} catch {
			/* ignore */
		}
		if (hpose && !InkproofEngine.skeletonCollapsed(hpose.lms)) {
			this.lastPose = hpose;
		} else {
			// heavy도 붕괴 → 신체 전체를 몸통으로 잠금 (buildPartIdxFromPose가 감지)
			this.lastPose = pose;
		}
		this.applyPoseResult(true);
	}

	destroy() {
		this.disposed = true;
		this.detachEvents();
		try {
			this.landmarker?.close?.();
		} catch {
			/* ignore */
		}
		this.landmarker = null;
		this.segmenter = null;
		this.estimator = null;
	}
}
