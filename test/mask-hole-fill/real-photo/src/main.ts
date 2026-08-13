import * as Current from "./image-engine-current";
import * as Fixed from "./image-engine-fixed";
import type { DepthMap, PersonMask, TattooTransform } from "./image-engine-current";

const statusEl = document.getElementById("status") as HTMLDivElement;
const bodyFileEl = document.getElementById("body-file") as HTMLInputElement;
const tattooFileEl = document.getElementById("tattoo-file") as HTMLInputElement;
const canvasCurrent = document.getElementById("canvas-current") as HTMLCanvasElement;
const canvasFixed = document.getElementById("canvas-fixed") as HTMLCanvasElement;
const opacityEl = document.getElementById("opacity") as HTMLInputElement;
const opacityValueEl = document.getElementById("opacity-value") as HTMLSpanElement;
const curvatureEl = document.getElementById("curvature") as HTMLInputElement;
const curvatureValueEl = document.getElementById("curvature-value") as HTMLSpanElement;
const showMaskEl = document.getElementById("show-mask") as HTMLInputElement;

const SETTINGS = { curvature: 1.1, opacity: 0.7 };

let bodyImage: HTMLImageElement | null = null;
let tattooCanvas: HTMLCanvasElement | null = null;

let currentMask: PersonMask | null = null;
let currentDepth: DepthMap | null = null;
let currentDepthPreview: HTMLCanvasElement | null = null;

let fixedMask: PersonMask | null = null;
let fixedDepth: DepthMap | null = null;
let fixedDepthPreview: HTMLCanvasElement | null = null;

const transform: TattooTransform = { x: 0.5, y: 0.52, width: 0.3, rotation: 0 };

function setStatus(text: string) {
  statusEl.textContent = text;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function sizeCanvases() {
  if (!bodyImage) return;
  const scale = Math.min(1, 900 / Math.max(bodyImage.width, bodyImage.height));
  const width = Math.max(1, Math.round(bodyImage.width * scale));
  const height = Math.max(1, Math.round(bodyImage.height * scale));
  for (const canvas of [canvasCurrent, canvasFixed]) {
    canvas.width = width;
    canvas.height = height;
  }
}

function renderBoth() {
  if (!bodyImage) return;
  const clipAnchor = { x: transform.x, y: transform.y };
  const showPersonMask = showMaskEl.checked;

  if (currentMask && currentDepth) {
    Current.renderScene({
      canvas: canvasCurrent,
      body: bodyImage,
      tattoo: tattooCanvas,
      depth: currentDepth,
      depthPreview: currentDepthPreview,
      personMask: currentMask,
      transform,
      clipAnchor,
      settings: SETTINGS,
      showDepth: false,
      showPersonMask,
      showGuides: false,
    });
  }

  if (fixedMask && fixedDepth) {
    Fixed.renderScene({
      canvas: canvasFixed,
      body: bodyImage,
      tattoo: tattooCanvas,
      depth: fixedDepth,
      depthPreview: fixedDepthPreview,
      personMask: fixedMask,
      transform,
      clipAnchor,
      settings: SETTINGS,
      showDepth: false,
      showPersonMask,
      showGuides: false,
    });
  }
}

opacityEl.addEventListener("input", () => {
  SETTINGS.opacity = Number(opacityEl.value);
  opacityValueEl.textContent = SETTINGS.opacity.toFixed(2);
  renderBoth();
});
curvatureEl.addEventListener("input", () => {
  SETTINGS.curvature = Number(curvatureEl.value);
  curvatureValueEl.textContent = SETTINGS.curvature.toFixed(2);
  renderBoth();
});
showMaskEl.addEventListener("change", () => {
  renderBoth();
});

async function processBody(file: File) {
  setStatus("사진을 불러오는 중...");
  bodyImage = await Current.loadImageFile(file);
  sizeCanvases();

  setStatus("인물 분리 중 (현재 코드 · 수정판 동시 실행)...");
  const [cMask, fMask] = await Promise.all([
    Current.segmentPerson(bodyImage, (label) => setStatus(`[현재] ${label}`)),
    Fixed.segmentPerson(bodyImage, (label) => setStatus(`[수정판] ${label}`)),
  ]);
  currentMask = cMask;
  fixedMask = fMask;

  setStatus("3D 굴곡(depth) 추정 중 (Depth Anything V2, 첫 실행은 모델 다운로드로 오래 걸릴 수 있음)...");
  const [cDepth, fDepth] = await Promise.all([
    Current.estimateDepth(bodyImage, cMask, (label) => setStatus(`[현재] ${label}`)),
    Fixed.estimateDepth(bodyImage, fMask, (label) => setStatus(`[수정판] ${label}`)),
  ]);
  currentDepth = cDepth;
  fixedDepth = fDepth;
  currentDepthPreview = Current.createDepthPreview(cDepth);
  fixedDepthPreview = Fixed.createDepthPreview(fDepth);

  setStatus(
    `완료 (현재: ${cMask.engine}/${cDepth.engine}, 수정판: ${fMask.engine}/${fDepth.engine}). ` +
      "타투 도안을 올리고 캔버스를 드래그해보세요.",
  );
  renderBoth();
}

async function processTattoo(file: File) {
  setStatus("도안 배경 제거 중...");
  const image = await Current.loadImageFile(file);
  tattooCanvas = Current.removeTattooBackground(image);
  setStatus("도안 준비 완료.");
  renderBoth();
}

bodyFileEl.addEventListener("change", () => {
  const file = bodyFileEl.files?.[0];
  if (!file) return;
  processBody(file).catch((error) => {
    setStatus(error instanceof Error ? `오류: ${error.message}` : "신체 사진 처리 중 오류가 발생했습니다.");
  });
});

tattooFileEl.addEventListener("change", () => {
  const file = tattooFileEl.files?.[0];
  if (!file) return;
  processTattoo(file).catch((error) => {
    setStatus(error instanceof Error ? `오류: ${error.message}` : "도안 처리 중 오류가 발생했습니다.");
  });
});

function pointFromEvent(canvas: HTMLCanvasElement, event: PointerEvent) {
  const bounds = canvas.getBoundingClientRect();
  const scaleX = canvas.width / Math.max(1, bounds.width);
  const scaleY = canvas.height / Math.max(1, bounds.height);
  return {
    x: (event.clientX - bounds.left) * scaleX,
    y: (event.clientY - bounds.top) * scaleY,
  };
}

function attachInteraction(canvas: HTMLCanvasElement) {
  let dragging = false;
  let start = { x: 0, y: 0 };
  let startTransform: TattooTransform = { ...transform };

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // 일부 입력 소스는 활성 포인터로 등록되지 않아 캡처가 실패할 수 있다.
    }
    start = pointFromEvent(canvas, event);
    startTransform = { ...transform };
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const point = pointFromEvent(canvas, event);
    transform.x = clamp01(startTransform.x + (point.x - start.x) / canvas.width);
    transform.y = clamp01(startTransform.y + (point.y - start.y) / canvas.height);
    renderBoth();
  });

  const endDrag = () => {
    dragging = false;
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      if (event.shiftKey) {
        const step = (event.deltaY < 0 ? -1 : 1) * (Math.PI / 60);
        transform.rotation += step;
      } else {
        const factor = event.deltaY < 0 ? 1.05 : 1 / 1.05;
        transform.width = Math.min(1.2, Math.max(0.045, transform.width * factor));
      }
      renderBoth();
    },
    { passive: false },
  );
}

attachInteraction(canvasCurrent);
attachInteraction(canvasFixed);
