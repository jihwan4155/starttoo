// image-engine.ts의 인물 마스크 계산 로직을 canvas/MediaPipe 의존성 없이
// 순수 배열 연산만 떼어낸 버전. 원본 위치:
//   frontend/src/components/simulation/inkproof/image-engine.ts
//   - clamp: line 163
//   - boxBlur: line 378
//   - buildPersonMask: line 424 (smoothStep(0.42, 0.7, ...) 하드 컷오프, 홀 메우기 없음)

export const clamp = (value, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

export const smoothStep = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export const boxBlur = (input, width, height, radius) => {
  if (radius <= 0) return input.slice();
  const horizontal = new Float32Array(input.length);
  const output = new Float32Array(input.length);

  for (let y = 0; y < height; y += 1) {
    let sum = 0;
    for (let x = -radius; x <= radius; x += 1) {
      sum += input[y * width + Math.min(width - 1, Math.max(0, x))];
    }
    for (let x = 0; x < width; x += 1) {
      horizontal[y * width + x] = sum / (radius * 2 + 1);
      const removeX = Math.max(0, x - radius);
      const addX = Math.min(width - 1, x + radius + 1);
      sum += input[y * width + addX] - input[y * width + removeX];
    }
  }

  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let y = -radius; y <= radius; y += 1) {
      sum += horizontal[Math.min(height - 1, Math.max(0, y)) * width + x];
    }
    for (let y = 0; y < height; y += 1) {
      output[y * width + x] = sum / (radius * 2 + 1);
      const removeY = Math.max(0, y - radius);
      const addY = Math.min(height - 1, y + radius + 1);
      sum += horizontal[addY * width + x] - horizontal[removeY * width + x];
    }
  }

  return output;
};

/** 현재 코드와 동일: 블러 + 하드 컷오프. 흉터 같은 내부 저신뢰 섬을 그대로 구멍으로 남긴다. */
export const buildPersonMaskDataCurrent = (scores, width, height) => {
  const softened = boxBlur(scores, width, height, 1);
  const data = new Float32Array(softened.length);
  for (let index = 0; index < softened.length; index += 1) {
    data[index] = smoothStep(0.42, 0.7, softened[index]);
  }
  return data;
};

/**
 * 제안하는 수정판: 하드 컷오프 이후, "마스크 바깥 테두리와 연결되지 않은
 * 저신뢰 영역(=고신뢰 인물 픽셀에 완전히 둘러싸인 섬)"을 인물로 승격한다.
 * removeTattooBackground()가 도안 배경을 지울 때 쓰는 테두리 연결 flood-fill과
 * 동일한 원리를 인물 마스크에 적용한 것.
 */
export const fillEnclosedLowConfidenceHoles = (
  alpha,
  width,
  height,
  lowThreshold = 0.5,
) => {
  const size = alpha.length;
  const reachesBorder = new Uint8Array(size);
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;

  const enqueueIfLow = (index) => {
    if (reachesBorder[index] || alpha[index] >= lowThreshold) return;
    reachesBorder[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < width; x += 1) {
    enqueueIfLow(x);
    enqueueIfLow((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueueIfLow(y * width);
    enqueueIfLow(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = (index - x) / width;
    if (x > 0) enqueueIfLow(index - 1);
    if (x < width - 1) enqueueIfLow(index + 1);
    if (y > 0) enqueueIfLow(index - width);
    if (y < height - 1) enqueueIfLow(index + width);
  }

  const result = alpha.slice();
  for (let index = 0; index < size; index += 1) {
    if (alpha[index] < lowThreshold && !reachesBorder[index]) {
      result[index] = 1;
    }
  }
  return result;
};

export const buildPersonMaskDataFixed = (scores, width, height) => {
  const current = buildPersonMaskDataCurrent(scores, width, height);
  return fillEnclosedLowConfidenceHoles(current, width, height, 0.5);
};
