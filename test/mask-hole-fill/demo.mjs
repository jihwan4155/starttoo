import {
  buildPersonMaskDataCurrent,
  buildPersonMaskDataFixed,
} from "./algorithm.mjs";

const N = 100; // 내부 연산 그리드 해상도 (N x N)
const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const PERSON = { cx: 50, cy: 46, r: 34 };
const INK = { cx: 50, cy: 46, r: 28 };
const LEG_GAP = { x0: 47, x1: 53, y0: 62, y1: 99 };

const inLegGap = (x, y) =>
  x >= LEG_GAP.x0 && x <= LEG_GAP.x1 && y >= LEG_GAP.y0 && y <= LEG_GAP.y1;

// 참값: 실제 피부가 있는 자리(사용자가 뭘 그리든 바뀌지 않음).
// 다리 사이 틈만 원래부터 피부가 아니었던 것으로 취급.
const skinTruth = new Uint8Array(N * N);
for (let y = 0; y < N; y += 1) {
  for (let x = 0; x < N; x += 1) {
    const index = y * N + x;
    skinTruth[index] =
      inCircle(x, y, PERSON.cx, PERSON.cy, PERSON.r) && !inLegGap(x, y) ? 1 : 0;
  }
}

function defaultScores() {
  const scores = new Float32Array(N * N);
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const index = y * N + x;
      let score = 0.05;
      if (inCircle(x, y, PERSON.cx, PERSON.cy, PERSON.r)) score = 0.95;
      if (inCircle(x, y, 50, 26, 6)) score = 0.1; // 기본 흉터
      if (inLegGap(x, y)) score = 0.05; // 다리 사이 틈
      scores[index] = score;
    }
  }
  return scores;
}

let scores = defaultScores();
let mode = "scar"; // "scar" | "heal"
let brushRadius = 5;
let painting = false;

const els = {
  input: document.getElementById("canvas-input"),
  current: document.getElementById("canvas-current"),
  fixed: document.getElementById("canvas-fixed"),
  previewCurrent: document.getElementById("canvas-preview-current"),
  previewFixed: document.getElementById("canvas-preview-fixed"),
};

for (const canvas of Object.values(els)) {
  canvas.width = N;
  canvas.height = N;
}

function drawGrayscale(canvas, data) {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(N, N);
  for (let i = 0; i < data.length; i += 1) {
    const value = Math.round(Math.max(0, Math.min(1, data[i])) * 255);
    const offset = i * 4;
    imageData.data[offset] = value;
    imageData.data[offset + 1] = value;
    imageData.data[offset + 2] = value;
    imageData.data[offset + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
}

const SKIN_COLOR = [231, 199, 156];
const BG_COLOR = [244, 242, 238];
const INK_COLOR = [17, 17, 17];

function drawTattooPreview(canvas, maskAlpha) {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(N, N);
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      const index = y * N + x;
      const isSkin = skinTruth[index] === 1;
      const base = isSkin ? SKIN_COLOR : BG_COLOR;
      const isInk = inCircle(x, y, INK.cx, INK.cy, INK.r) && isSkin;
      const inkAlpha = isInk ? Math.max(0, Math.min(1, maskAlpha[index])) : 0;
      const offset = index * 4;
      imageData.data[offset] = base[0] * (1 - inkAlpha) + INK_COLOR[0] * inkAlpha;
      imageData.data[offset + 1] = base[1] * (1 - inkAlpha) + INK_COLOR[1] * inkAlpha;
      imageData.data[offset + 2] = base[2] * (1 - inkAlpha) + INK_COLOR[2] * inkAlpha;
      imageData.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function render() {
  const currentMask = buildPersonMaskDataCurrent(scores, N, N);
  const fixedMask = buildPersonMaskDataFixed(scores, N, N);

  drawGrayscale(els.input, scores);
  drawGrayscale(els.current, currentMask);
  drawGrayscale(els.fixed, fixedMask);
  drawTattooPreview(els.previewCurrent, currentMask);
  drawTattooPreview(els.previewFixed, fixedMask);
}

function paintAt(gridX, gridY) {
  const value = mode === "scar" ? 0.1 : 0.95;
  for (let dy = -brushRadius; dy <= brushRadius; dy += 1) {
    for (let dx = -brushRadius; dx <= brushRadius; dx += 1) {
      if (dx * dx + dy * dy > brushRadius * brushRadius) continue;
      const x = gridX + dx;
      const y = gridY + dy;
      if (x < 0 || x >= N || y < 0 || y >= N) continue;
      scores[y * N + x] = value;
    }
  }
}

function eventToGrid(event) {
  const rect = els.input.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * N);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * N);
  return { x, y };
}

els.input.addEventListener("pointerdown", (event) => {
  painting = true;
  try {
    els.input.setPointerCapture(event.pointerId);
  } catch {
    // 일부 입력 소스는 활성 포인터로 등록되지 않아 캡처가 실패할 수 있다.
    // 캡처 없이도 그리기 자체는 계속 진행한다.
  }
  const { x, y } = eventToGrid(event);
  paintAt(x, y);
  render();
});
els.input.addEventListener("pointermove", (event) => {
  if (!painting) return;
  const { x, y } = eventToGrid(event);
  paintAt(x, y);
  render();
});
window.addEventListener("pointerup", () => {
  painting = false;
});

document.getElementById("mode-scar").addEventListener("click", (event) => {
  mode = "scar";
  event.currentTarget.classList.add("active");
  document.getElementById("mode-heal").classList.remove("active");
});
document.getElementById("mode-heal").addEventListener("click", (event) => {
  mode = "heal";
  event.currentTarget.classList.add("active");
  document.getElementById("mode-scar").classList.remove("active");
});
document.getElementById("brush").addEventListener("input", (event) => {
  brushRadius = Number(event.currentTarget.value);
});
document.getElementById("reset").addEventListener("click", () => {
  scores = defaultScores();
  render();
});
document.getElementById("clear").addEventListener("click", () => {
  scores = new Float32Array(N * N).fill(0.05);
  render();
});

render();
