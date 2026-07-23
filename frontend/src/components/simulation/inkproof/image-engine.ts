export type DrawableImage = HTMLImageElement | HTMLCanvasElement;

export type DepthEngine = "depth-anything-v2" | "local-fallback";
export type PersonMaskEngine =
  | "mediapipe-selfie-multiclass"
  | "local-silhouette";

export interface DepthMap {
  data: Float32Array;
  width: number;
  height: number;
  engine: DepthEngine;
  detail: string;
}

export interface PersonMask {
  canvas: HTMLCanvasElement;
  data: Float32Array;
  width: number;
  height: number;
  coverage: number;
  engine: PersonMaskEngine;
  detail: string;
}

export interface TattooTransform {
  x: number;
  y: number;
  width: number;
  rotation: number;
}

export interface RenderSettings {
  curvature: number;
  opacity: number;
}

export interface OverlayGeometry {
  center: { x: number; y: number };
  width: number;
  height: number;
  corners: Array<{ x: number; y: number }>;
  rotationHandle: { x: number; y: number };
}

type ProgressCallback = (label: string, progress?: number) => void;

type DepthEstimator = (
  image: HTMLCanvasElement,
) => Promise<{
  predicted_depth?: {
    data: Float32Array | ArrayLike<number>;
    dims: number[];
  };
  depth: {
    data: Uint8Array | Uint8ClampedArray;
    width: number;
    height: number;
  };
}>;

interface NormalizedRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface PreparedDepthInput {
  canvas: HTMLCanvasElement;
  roi: NormalizedRect;
}

interface DepthRaster {
  data: Float32Array;
  width: number;
  height: number;
}

// 변경: 인물 실루엣 경계까지의 거리와 최종 가시성 마스크를 캐시한다.
// 드래그 중 매 프레임 거리장을 다시 계산하지 않기 위한 브라우저 내부 캐시다.
interface BoundaryField {
  insideDistance: Float32Array;
  visibilityCanvas: HTMLCanvasElement;
  width: number;
  height: number;
}

interface MaskCrossSection {
  start: number;
  end: number;
  midpoint: number;
  radius: number;
  confidence: number;
}

interface WeightedLinePoint {
  position: number;
  value: number;
  weight: number;
}

interface LinearFit {
  intercept: number;
  slope: number;
}

interface DepthGradient {
  x: number;
  y: number;
  disagreement: number;
}

interface LocalDepthSurface {
  centerDepth: number;
  gradientX: number;
  gradientY: number;
  confidence: number;
}

interface FrustumProjection {
  midpointIntercept: number;
  midpointSlope: number;
  radiusIntercept: number;
  radiusSlope: number;
  confidence: number;
}

interface WebGLSurfaceRendererState {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vertexArray: WebGLVertexArrayObject;
  tattooTexture: WebGLTexture;
  depthTexture: WebGLTexture;
  maskTexture: WebGLTexture;
  bodyTexture: WebGLTexture;
  boundaryTexture: WebGLTexture;
  lastTattoo: HTMLCanvasElement | null;
  lastDepth: DepthMap | null;
  lastMask: PersonMask | null;
  lastBody: HTMLImageElement | null;
  lastBodyWidth: number;
  lastBodyHeight: number;
  lastBoundaryField: BoundaryField | null;
  neutralDepthUploaded: boolean;
}

let depthEstimatorPromise: Promise<DepthEstimator> | null = null;
let depthEstimatorMode: "webgpu" | "wasm" | null = null;
let personSegmenterPromise: Promise<
  import("@mediapipe/tasks-vision").ImageSegmenter
> | null = null;
const boundaryFieldCache = new WeakMap<PersonMask, BoundaryField>();
let webGLSurfaceRendererState: WebGLSurfaceRendererState | null = null;

const MEDIAPIPE_WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const PERSON_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite";
const DEPTH_MODEL_ID = "onnx-community/depth-anything-v2-small";

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

const getContext = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext("2d", {
    alpha: true,
    willReadFrequently: true,
  });

  if (!context) {
    throw new Error("Canvas 2D context를 만들 수 없습니다.");
  }

  return context;
};

export const loadImageFile = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지를 읽을 수 없습니다."));
    };
    image.src = objectUrl;
  });

const fitDimensions = (width: number, height: number, maxEdge: number) => {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const drawFittedImage = (image: DrawableImage, maxEdge: number) => {
  const dimensions = fitDimensions(image.width, image.height, maxEdge);
  const canvas = createCanvas(dimensions.width, dimensions.height);
  const context = getContext(canvas);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const median = (values: number[]) => {
  if (!values.length) return 255;
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
};

/**
 * 흰색 또는 거의 흰색인 배경 중 이미지 테두리와 연결된 영역만 제거한다.
 * 도안 내부의 흰색 디테일은 가능한 한 보존하고, 경계 픽셀은 부드럽게 페더링한다.
 */
export const removeTattooBackground = (image: HTMLImageElement) => {
  const source = drawFittedImage(image, 1800);
  const context = getContext(source);
  const imageData = context.getImageData(0, 0, source.width, source.height);
  const pixels = imageData.data;
  const reds: number[] = [];
  const greens: number[] = [];
  const blues: number[] = [];
  const sampleStep = Math.max(1, Math.round(Math.min(source.width, source.height) / 180));

  const sample = (x: number, y: number) => {
    const index = (y * source.width + x) * 4;
    if (pixels[index + 3] < 16) return;
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const luma = (r + g + b) / 3;
    if (luma > 170) {
      reds.push(r);
      greens.push(g);
      blues.push(b);
    }
  };

  for (let x = 0; x < source.width; x += sampleStep) {
    sample(x, 0);
    sample(x, source.height - 1);
  }
  for (let y = 0; y < source.height; y += sampleStep) {
    sample(0, y);
    sample(source.width - 1, y);
  }

  const background = {
    r: median(reds),
    g: median(greens),
    b: median(blues),
  };
  const backgroundLuma = (background.r + background.g + background.b) / 3;
  const shouldRemoveWhite = backgroundLuma > 188;

  if (shouldRemoveWhite) {
    const pixelCount = source.width * source.height;
    const visited = new Uint8Array(pixelCount);
    const queue = new Int32Array(pixelCount);
    let head = 0;
    let tail = 0;

    const isBackgroundCandidate = (pixelIndex: number) => {
      const index = pixelIndex * 4;
      if (pixels[index + 3] < 12) return true;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const distance = Math.hypot(
        r - background.r,
        g - background.g,
        b - background.b,
      );
      const luma = (r + g + b) / 3;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      return distance < 92 && luma > 168 && chroma < 72;
    };

    const enqueue = (pixelIndex: number) => {
      if (visited[pixelIndex] || !isBackgroundCandidate(pixelIndex)) return;
      visited[pixelIndex] = 1;
      queue[tail++] = pixelIndex;
    };

    for (let x = 0; x < source.width; x += 1) {
      enqueue(x);
      enqueue((source.height - 1) * source.width + x);
    }
    for (let y = 0; y < source.height; y += 1) {
      enqueue(y * source.width);
      enqueue(y * source.width + source.width - 1);
    }

    while (head < tail) {
      const pixelIndex = queue[head++];
      const x = pixelIndex % source.width;
      const y = Math.floor(pixelIndex / source.width);
      if (x > 0) enqueue(pixelIndex - 1);
      if (x < source.width - 1) enqueue(pixelIndex + 1);
      if (y > 0) enqueue(pixelIndex - source.width);
      if (y < source.height - 1) enqueue(pixelIndex + source.width);
    }

    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
      if (!visited[pixelIndex]) continue;
      const index = pixelIndex * 4;
      const distance = Math.hypot(
        pixels[index] - background.r,
        pixels[index + 1] - background.g,
        pixels[index + 2] - background.b,
      );
      const feather = clamp((distance - 12) / 58);
      pixels[index + 3] = Math.round(pixels[index + 3] * feather);
    }
  }

  context.putImageData(imageData, 0, 0);

  let minX = source.width;
  let minY = source.height;
  let maxX = -1;
  let maxY = -1;
  const croppedPixels = getContext(source).getImageData(
    0,
    0,
    source.width,
    source.height,
  ).data;

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      if (croppedPixels[(y * source.width + x) * 4 + 3] <= 10) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    throw new Error("도안에서 표시할 픽셀을 찾지 못했습니다.");
  }

  const padding = Math.max(2, Math.round(Math.max(source.width, source.height) * 0.012));
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(source.width - 1, maxX + padding);
  maxY = Math.min(source.height - 1, maxY + padding);

  const output = createCanvas(maxX - minX + 1, maxY - minY + 1);
  getContext(output).drawImage(
    source,
    minX,
    minY,
    output.width,
    output.height,
    0,
    0,
    output.width,
    output.height,
  );
  return output;
};

const boxBlur = (
  input: Float32Array,
  width: number,
  height: number,
  radius: number,
) => {
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
      sum +=
        horizontal[addY * width + x] -
        horizontal[removeY * width + x];
    }
  }

  return output;
};

const smoothStep = (edge0: number, edge1: number, value: number) => {
  const normalized = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return normalized * normalized * (3 - 2 * normalized);
};

const buildPersonMask = (
  scores: Float32Array,
  width: number,
  height: number,
  engine: PersonMaskEngine,
  detail: string,
): PersonMask => {
  const softened = boxBlur(scores, width, height, 1);
  const data = new Float32Array(softened.length);
  const canvas = createCanvas(width, height);
  const context = getContext(canvas);
  const imageData = context.createImageData(width, height);
  let covered = 0;

  for (let index = 0; index < softened.length; index += 1) {
    // 변경: 낮은 인물 확률은 완전히 버리고 경계 안쪽만 짧게 페더링한다.
    const alpha = smoothStep(0.42, 0.7, softened[index]);
    data[index] = alpha;
    if (alpha > 0.12) covered += 1;
    const offset = index * 4;
    imageData.data[offset] = 255;
    imageData.data[offset + 1] = 255;
    imageData.data[offset + 2] = 255;
    imageData.data[offset + 3] = Math.round(alpha * 255);
  }

  context.putImageData(imageData, 0, 0);
  return {
    canvas,
    data,
    width,
    height,
    coverage: covered / Math.max(1, data.length),
    engine,
    detail,
  };
};

const createLocalSilhouette = (image: HTMLImageElement): PersonMask => {
  const source = drawFittedImage(image, 512);
  const context = getContext(source);
  const pixels = context.getImageData(0, 0, source.width, source.height).data;
  const width = source.width;
  const height = source.height;
  const pixelCount = width * height;
  const bins = new Map<
    number,
    { count: number; red: number; green: number; blue: number }
  >();
  const sampleStep = Math.max(1, Math.round(Math.min(width, height) / 100));

  const addBorderSample = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    const key =
      (Math.round(red / 32) << 8) |
      (Math.round(green / 32) << 4) |
      Math.round(blue / 32);
    const entry = bins.get(key) ?? {
      count: 0,
      red: 0,
      green: 0,
      blue: 0,
    };
    entry.count += 1;
    entry.red += red;
    entry.green += green;
    entry.blue += blue;
    bins.set(key, entry);
  };

  for (let x = 0; x < width; x += sampleStep) {
    addBorderSample(x, 0);
    addBorderSample(x, height - 1);
  }
  for (let y = 0; y < height; y += sampleStep) {
    addBorderSample(0, y);
    addBorderSample(width - 1, y);
  }

  const palette = [...bins.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((entry) => ({
      red: entry.red / entry.count,
      green: entry.green / entry.count,
      blue: entry.blue / entry.count,
    }));
  const background = new Uint8Array(pixelCount);
  const queued = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;

  const colorDistance = (pixelIndex: number) => {
    const offset = pixelIndex * 4;
    let closest = Number.POSITIVE_INFINITY;
    for (const color of palette) {
      const red = pixels[offset] - color.red;
      const green = pixels[offset + 1] - color.green;
      const blue = pixels[offset + 2] - color.blue;
      closest = Math.min(
        closest,
        Math.sqrt(red * red * 0.34 + green * green * 0.5 + blue * blue * 0.16),
      );
    }
    return closest;
  };

  const enqueue = (pixelIndex: number) => {
    if (queued[pixelIndex] || colorDistance(pixelIndex) > 46) return;
    queued[pixelIndex] = 1;
    queue[tail++] = pixelIndex;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const pixelIndex = queue[head++];
    background[pixelIndex] = 1;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (x > 0) enqueue(pixelIndex - 1);
    if (x < width - 1) enqueue(pixelIndex + 1);
    if (y > 0) enqueue(pixelIndex - width);
    if (y < height - 1) enqueue(pixelIndex + width);
  }

  const scores = new Float32Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    scores[index] = background[index] ? 0 : 1;
  }

  return buildPersonMask(
    scores,
    width,
    height,
    "local-silhouette",
    "테두리 연결 배경을 제거한 로컬 안전 마스크",
  );
};

const createPersonSegmenter = async () => {
  if (personSegmenterPromise) return personSegmenterPromise;

  personSegmenterPromise = (async () => {
    const { FilesetResolver, ImageSegmenter } = await import(
      "@mediapipe/tasks-vision"
    );
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_ROOT);
    return ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: PERSON_MODEL_URL,
      },
      runningMode: "IMAGE",
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    });
  })();

  try {
    return await personSegmenterPromise;
  } catch (error) {
    personSegmenterPromise = null;
    throw error;
  }
};

export const segmentPerson = async (
  image: HTMLImageElement,
  progress: ProgressCallback,
): Promise<PersonMask> => {
  progress("MediaPipe 인물 모델을 불러오는 중", 8);

  try {
    const segmenter = await createPersonSegmenter();
    progress("사람과 배경을 자동 분리하는 중", 62);
    const result = segmenter.segment(image);
    const masks = result.confidenceMasks;
    const backgroundMask = masks?.[0];
    if (!backgroundMask) {
      throw new Error("MediaPipe가 인물 신뢰도 마스크를 반환하지 않았습니다.");
    }

    const background = backgroundMask.getAsFloat32Array();
    const scores = new Float32Array(background.length);
    for (let index = 0; index < background.length; index += 1) {
      // 변경: 배경 이외의 머리·피부·얼굴·옷·액세서리를 모두 인물로 묶는다.
      scores[index] = clamp(1 - background[index]);
    }

    const mask = buildPersonMask(
      scores,
      backgroundMask.width,
      backgroundMask.height,
      "mediapipe-selfie-multiclass",
      "MediaPipe Selfie Multiclass · 자동 인물 분할",
    );
    masks?.forEach((item) => item.close());

    if (mask.coverage < 0.003) {
      throw new Error("사진에서 사람 영역을 찾지 못했습니다.");
    }
    progress("인물 마스크 완료", 100);
    return mask;
  } catch {
    // 변경: 모델 파일을 받을 수 없는 환경에서도 배경 전체 허용 대신
    // 테두리 연결 배경을 제거하는 보수적인 로컬 마스크로 전환한다.
    progress("로컬 안전 마스크로 전환 중", 82);
    const fallback = createLocalSilhouette(image);
    progress("로컬 인물 마스크 완료", 100);
    return fallback;
  }
};

const sampleFloatGrid = (
  data: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
) => {
  const px = clamp(x) * (width - 1);
  const py = clamp(y) * (height - 1);
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = px - x0;
  const ty = py - y0;
  const a = data[y0 * width + x0];
  const b = data[y0 * width + x1];
  const c = data[y1 * width + x0];
  const d = data[y1 * width + x1];
  return (
    a * (1 - tx) * (1 - ty) +
    b * tx * (1 - ty) +
    c * (1 - tx) * ty +
    d * tx * ty
  );
};

const getPersonBounds = (mask: PersonMask): NormalizedRect => {
  let minX = mask.width;
  let minY = mask.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[y * mask.width + x] < 0.16) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return { left: 0, top: 0, right: 1, bottom: 1 };
  }

  return {
    left: minX / Math.max(1, mask.width - 1),
    top: minY / Math.max(1, mask.height - 1),
    right: maxX / Math.max(1, mask.width - 1),
    bottom: maxY / Math.max(1, mask.height - 1),
  };
};

const expandRect = (
  rect: NormalizedRect,
  paddingRatio: number,
): NormalizedRect => {
  const width = Math.max(0.02, rect.right - rect.left);
  const height = Math.max(0.02, rect.bottom - rect.top);
  return {
    left: clamp(rect.left - width * paddingRatio),
    top: clamp(rect.top - height * paddingRatio),
    right: clamp(rect.right + width * paddingRatio),
    bottom: clamp(rect.bottom + height * paddingRatio),
  };
};

const prepareDepthInput = (
  image: HTMLImageElement,
  mask: PersonMask,
  paddingRatio: number,
): PreparedDepthInput => {
  const roi = expandRect(getPersonBounds(mask), paddingRatio);
  const sourceLeft = roi.left * image.width;
  const sourceTop = roi.top * image.height;
  const sourceWidth = Math.max(1, (roi.right - roi.left) * image.width);
  const sourceHeight = Math.max(1, (roi.bottom - roi.top) * image.height);
  const dimensions = fitDimensions(sourceWidth, sourceHeight, 960);
  const foreground = createCanvas(dimensions.width, dimensions.height);
  const foregroundContext = getContext(foreground);

  foregroundContext.drawImage(
    image,
    sourceLeft,
    sourceTop,
    sourceWidth,
    sourceHeight,
    0,
    0,
    foreground.width,
    foreground.height,
  );
  foregroundContext.globalCompositeOperation = "destination-in";
  foregroundContext.drawImage(
    mask.canvas,
    roi.left * mask.width,
    roi.top * mask.height,
    (roi.right - roi.left) * mask.width,
    (roi.bottom - roi.top) * mask.height,
    0,
    0,
    foreground.width,
    foreground.height,
  );

  // 변경: 배경을 투명 검정으로 두면 모델이 강한 가짜 경계를 만들 수 있어
  // 중성 회색 바탕에 분리된 신체만 다시 합성한다.
  const input = createCanvas(foreground.width, foreground.height);
  const inputContext = getContext(input);
  inputContext.fillStyle = "#808080";
  inputContext.fillRect(0, 0, input.width, input.height);
  inputContext.drawImage(foreground, 0, 0);

  return { canvas: input, roi };
};

const extractDepthRaster = (output: Awaited<ReturnType<DepthEstimator>>) => {
  const tensor = output.predicted_depth;
  if (tensor?.data && tensor.dims.length >= 2) {
    const width = tensor.dims[tensor.dims.length - 1];
    const height = tensor.dims[tensor.dims.length - 2];
    return {
      data: Float32Array.from(tensor.data),
      width,
      height,
    } satisfies DepthRaster;
  }

  const data = new Float32Array(output.depth.data.length);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = output.depth.data[index] / 255;
  }
  return {
    data,
    width: output.depth.width,
    height: output.depth.height,
  } satisfies DepthRaster;
};

const projectDepthRaster = (
  raster: DepthRaster,
  roi: NormalizedRect,
  width: number,
  height: number,
) => {
  const output = new Float32Array(width * height);
  output.fill(0.5);
  const roiWidth = Math.max(0.0001, roi.right - roi.left);
  const roiHeight = Math.max(0.0001, roi.bottom - roi.top);

  for (let y = 0; y < height; y += 1) {
    const normalizedY = y / Math.max(1, height - 1);
    if (normalizedY < roi.top || normalizedY > roi.bottom) continue;
    const localY = (normalizedY - roi.top) / roiHeight;
    for (let x = 0; x < width; x += 1) {
      const normalizedX = x / Math.max(1, width - 1);
      if (normalizedX < roi.left || normalizedX > roi.right) continue;
      const localX = (normalizedX - roi.left) / roiWidth;
      output[y * width + x] = sampleFloatGrid(
        raster.data,
        raster.width,
        raster.height,
        localX,
        localY,
      );
    }
  }

  return output;
};

const createFittedMask = (
  mask: PersonMask,
  width: number,
  height: number,
) => {
  const fitted = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      fitted[y * width + x] = sampleFloatGrid(
        mask.data,
        mask.width,
        mask.height,
        x / Math.max(1, width - 1),
        y / Math.max(1, height - 1),
      );
    }
  }
  return fitted;
};

const normalizeDepthMasked = (
  input: Float32Array,
  mask: Float32Array,
) => {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < input.length; index += 1) {
    if (mask[index] < 0.24 || !Number.isFinite(input[index])) continue;
    minimum = Math.min(minimum, input[index]);
    maximum = Math.max(maximum, input[index]);
  }

  if (!Number.isFinite(minimum) || maximum - minimum < 0.000001) {
    const neutral = new Float32Array(input.length);
    neutral.fill(0.5);
    return neutral;
  }

  const histogram = new Uint32Array(512);
  let total = 0;
  const initialRange = maximum - minimum;
  for (let index = 0; index < input.length; index += 1) {
    if (mask[index] < 0.24 || !Number.isFinite(input[index])) continue;
    const bin = Math.round(
      clamp((input[index] - minimum) / initialRange) *
        (histogram.length - 1),
    );
    histogram[bin] += 1;
    total += 1;
  }

  const lowTarget = total * 0.025;
  const highTarget = total * 0.975;
  let cumulative = 0;
  let lowBin = 0;
  let highBin = histogram.length - 1;
  for (let index = 0; index < histogram.length; index += 1) {
    cumulative += histogram[index];
    if (cumulative >= lowTarget) {
      lowBin = index;
      break;
    }
  }
  cumulative = 0;
  for (let index = 0; index < histogram.length; index += 1) {
    cumulative += histogram[index];
    if (cumulative >= highTarget) {
      highBin = index;
      break;
    }
  }

  const low =
    minimum + (lowBin / Math.max(1, histogram.length - 1)) * initialRange;
  const high =
    minimum + (highBin / Math.max(1, histogram.length - 1)) * initialRange;
  const range = Math.max(0.000001, high - low);
  const normalized = new Float32Array(input.length);
  normalized.fill(0.5);
  for (let index = 0; index < input.length; index += 1) {
    if (mask[index] < 0.04) continue;
    normalized[index] = clamp((input[index] - low) / range);
  }
  return normalized;
};

const createFittedLuminance = (
  image: HTMLImageElement,
  width: number,
  height: number,
) => {
  const canvas = createCanvas(width, height);
  const context = getContext(canvas);
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const luminance = new Float32Array(width * height);
  for (let index = 0; index < luminance.length; index += 1) {
    const offset = index * 4;
    luminance[index] =
      (pixels[offset] * 0.2126 +
        pixels[offset + 1] * 0.7152 +
        pixels[offset + 2] * 0.0722) /
      255;
  }
  return luminance;
};

const edgeAwareSmooth = (
  input: Float32Array,
  mask: Float32Array,
  luminance: Float32Array,
  width: number,
  height: number,
) => {
  const output = new Float32Array(input.length);
  output.fill(0.5);
  const radius = 2;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (mask[index] < 0.05) continue;
      let weightedDepth = 0;
      let totalWeight = 0;

      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        const sampleY = Math.min(height - 1, Math.max(0, y + offsetY));
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          const sampleX = Math.min(width - 1, Math.max(0, x + offsetX));
          const sampleIndex = sampleY * width + sampleX;
          if (mask[sampleIndex] < 0.05) continue;
          const spatialWeight = Math.exp(
            -(offsetX * offsetX + offsetY * offsetY) / 5,
          );
          const colorWeight = Math.exp(
            -Math.abs(luminance[index] - luminance[sampleIndex]) * 9,
          );
          const weight = spatialWeight * colorWeight * mask[sampleIndex];
          weightedDepth += input[sampleIndex] * weight;
          totalWeight += weight;
        }
      }

      const filtered =
        totalWeight > 0 ? weightedDepth / totalWeight : input[index];
      // 원본의 미세 굴곡을 남기면서 평탄부의 깊이 노이즈만 억제한다.
      output[index] = input[index] * 0.68 + filtered * 0.32;
    }
  }

  return output;
};

const normalizeDepth = (input: Float32Array) => {
  const histogram = new Uint32Array(256);
  for (const value of input) {
    histogram[Math.round(clamp(value) * 255)] += 1;
  }

  const total = input.length;
  const lowTarget = total * 0.02;
  const highTarget = total * 0.98;
  let cumulative = 0;
  let low = 0;
  let high = 255;

  for (let index = 0; index < histogram.length; index += 1) {
    cumulative += histogram[index];
    if (cumulative >= lowTarget) {
      low = index;
      break;
    }
  }

  cumulative = 0;
  for (let index = 0; index < histogram.length; index += 1) {
    cumulative += histogram[index];
    if (cumulative >= highTarget) {
      high = index;
      break;
    }
  }

  const range = Math.max(1, high - low);
  const normalized = new Float32Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    normalized[index] = clamp((input[index] * 255 - low) / range);
  }
  return normalized;
};

const createFallbackDepth = (image: DrawableImage): DepthMap => {
  const canvas = drawFittedImage(image, 640);
  const context = getContext(canvas);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const luminance = new Float32Array(canvas.width * canvas.height);

  for (let index = 0; index < luminance.length; index += 1) {
    const offset = index * 4;
    const r = pixels[offset] / 255;
    const g = pixels[offset + 1] / 255;
    const b = pixels[offset + 2] / 255;
    luminance[index] =
      0.2126 * Math.pow(r, 2.2) +
      0.7152 * Math.pow(g, 2.2) +
      0.0722 * Math.pow(b, 2.2);
  }

  const local = boxBlur(luminance, canvas.width, canvas.height, 3);
  const broad = boxBlur(luminance, canvas.width, canvas.height, 18);
  const depth = new Float32Array(luminance.length);

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = y * canvas.width + x;
      const nx = (x / Math.max(1, canvas.width - 1) - 0.5) * 2;
      const ny = (y / Math.max(1, canvas.height - 1) - 0.5) * 2;
      const centerPrior = Math.max(0, 1 - Math.hypot(nx, ny) * 0.72);
      const localShape = local[index] - broad[index];
      depth[index] = clamp(
        broad[index] * 0.68 + localShape * 1.7 + centerPrior * 0.13,
      );
    }
  }

  return {
    data: boxBlur(normalizeDepth(depth), canvas.width, canvas.height, 2),
    width: canvas.width,
    height: canvas.height,
    engine: "local-fallback",
    detail: "명암·에지 기반 로컬 추정",
  };
};

const createDepthEstimator = async (
  progress: ProgressCallback,
  forceWasm = false,
) => {
  const { pipeline } = await import("@huggingface/transformers");
  const canUseWebGpu = !forceWasm && "gpu" in navigator;
  const mode = canUseWebGpu ? "webgpu" : "wasm";

  if (depthEstimatorPromise && depthEstimatorMode === mode) {
    return depthEstimatorPromise;
  }

  depthEstimatorMode = mode;
  depthEstimatorPromise = pipeline(
    "depth-estimation",
    DEPTH_MODEL_ID,
    {
      device: mode,
      progress_callback: (event: {
        status?: string;
        progress?: number;
        loaded?: number;
        total?: number;
      }) => {
        if (event.status === "progress") {
          const value =
            typeof event.progress === "number"
              ? event.progress
              : event.total
                ? (Number(event.loaded ?? 0) / event.total) * 100
                : undefined;
          progress("AI 깊이 모델 준비 중", value);
        } else if (event.status === "ready") {
          progress("곡면을 분석하는 중", 100);
        }
      },
    },
  ) as unknown as Promise<DepthEstimator>;

  return depthEstimatorPromise;
};

export const estimateDepth = async (
  image: HTMLImageElement,
  personMask: PersonMask,
  progress: ProgressCallback,
): Promise<DepthMap> => {
  // 변경: MediaPipe 배경 제거 결과에서 신체 ROI를 두 크기로 준비한다.
  // 좁은 ROI는 피부의 미세 굴곡, 넓은 ROI는 전체 형태 문맥을 보존한다.
  const detailInput = prepareDepthInput(image, personMask, 0.06);
  const contextInput = prepareDepthInput(image, personMask, 0.26);
  const dimensions = fitDimensions(image.width, image.height, 640);
  const fittedMask = createFittedMask(
    personMask,
    dimensions.width,
    dimensions.height,
  );
  progress("Depth Anything V2 ViT-S를 불러오는 중", 0);

  try {
    let estimator: DepthEstimator;
    const modelProgress: ProgressCallback = (label, value) => {
      progress(
        label,
        typeof value === "number" ? Math.min(30, value * 0.3) : undefined,
      );
    };
    try {
      estimator = await createDepthEstimator(modelProgress);
    } catch (webGpuError) {
      if (!("gpu" in navigator)) throw webGpuError;
      depthEstimatorPromise = null;
      estimator = await createDepthEstimator(modelProgress, true);
    }

    progress("신체 세부 굴곡을 추론하는 중", 38);
    const detailOutput = extractDepthRaster(
      await estimator(detailInput.canvas),
    );
    progress("전체 곡면 문맥을 교차 검증하는 중", 70);
    const contextOutput = extractDepthRaster(
      await estimator(contextInput.canvas),
    );

    const detailDepth = normalizeDepthMasked(
      projectDepthRaster(
        detailOutput,
        detailInput.roi,
        dimensions.width,
        dimensions.height,
      ),
      fittedMask,
    );
    const contextDepth = normalizeDepthMasked(
      projectDepthRaster(
        contextOutput,
        contextInput.roi,
        dimensions.width,
        dimensions.height,
      ),
      fittedMask,
    );
    const fused = new Float32Array(detailDepth.length);
    for (let index = 0; index < fused.length; index += 1) {
      if (fittedMask[index] < 0.04) {
        fused[index] = 0.5;
        continue;
      }
      fused[index] = detailDepth[index] * 0.7 + contextDepth[index] * 0.3;
    }
    const luminance = createFittedLuminance(
      image,
      dimensions.width,
      dimensions.height,
    );
    const refined = edgeAwareSmooth(
      fused,
      fittedMask,
      luminance,
      dimensions.width,
      dimensions.height,
    );
    progress("신체 내부 깊이맵 보정 완료", 100);

    return {
      data: refined,
      width: dimensions.width,
      height: dimensions.height,
      engine: "depth-anything-v2",
      detail:
        depthEstimatorMode === "webgpu"
          ? "Depth Anything V2 ViT-S · 전경 2-스케일 · WebGPU"
          : "Depth Anything V2 ViT-S · 전경 2-스케일 · WASM",
    };
  } catch {
    progress("로컬 보정 분석으로 전환 중", 100);
    const fallback = createFallbackDepth(detailInput.canvas);
    const projected = normalizeDepthMasked(
      projectDepthRaster(
        fallback,
        detailInput.roi,
        dimensions.width,
        dimensions.height,
      ),
      fittedMask,
    );
    return {
      data: edgeAwareSmooth(
        projected,
        fittedMask,
        createFittedLuminance(image, dimensions.width, dimensions.height),
        dimensions.width,
        dimensions.height,
      ),
      width: dimensions.width,
      height: dimensions.height,
      engine: "local-fallback",
      detail: "배경 제거 ROI · 명암·에지 기반 로컬 추정",
    };
  }
};

const sampleDepth = (map: DepthMap | null, x: number, y: number) => {
  if (!map) return 0.5;
  const px = clamp(x) * (map.width - 1);
  const py = clamp(y) * (map.height - 1);
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const x1 = Math.min(map.width - 1, x0 + 1);
  const y1 = Math.min(map.height - 1, y0 + 1);
  const tx = px - x0;
  const ty = py - y0;
  const a = map.data[y0 * map.width + x0];
  const b = map.data[y0 * map.width + x1];
  const c = map.data[y1 * map.width + x0];
  const d = map.data[y1 * map.width + x1];
  return (
    a * (1 - tx) * (1 - ty) +
    b * tx * (1 - ty) +
    c * (1 - tx) * ty +
    d * tx * ty
  );
};

const samplePersonMask = (mask: PersonMask | null, x: number, y: number) => {
  if (!mask) return 0;
  const px = clamp(x) * (mask.width - 1);
  const py = clamp(y) * (mask.height - 1);
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const x1 = Math.min(mask.width - 1, x0 + 1);
  const y1 = Math.min(mask.height - 1, y0 + 1);
  const tx = px - x0;
  const ty = py - y0;
  const a = mask.data[y0 * mask.width + x0];
  const b = mask.data[y0 * mask.width + x1];
  const c = mask.data[y1 * mask.width + x0];
  const d = mask.data[y1 * mask.width + x1];
  return (
    a * (1 - tx) * (1 - ty) +
    b * tx * (1 - ty) +
    c * (1 - tx) * ty +
    d * tx * ty
  );
};

// 변경: 클릭·드래그 기준점이 실제 인물 영역 안에 있는지 확인한다.
export const isPointInsidePerson = (
  mask: PersonMask,
  x: number,
  y: number,
) => samplePersonMask(mask, x, y) >= 0.32;

// 변경: 드래그 기준점이 배경을 건너 다른 신체 영역으로 순간 이동하지 않게
// 이전 유효 좌표와 후보 좌표 사이를 마스크 해상도 기준으로 검사한다.
export const isPersonPathContinuous = (
  mask: PersonMask,
  from: { x: number; y: number },
  to: { x: number; y: number },
) => {
  const distanceInMaskPixels = Math.hypot(
    (to.x - from.x) * mask.width,
    (to.y - from.y) * mask.height,
  );
  const steps = Math.max(
    1,
    Math.min(96, Math.ceil(distanceInMaskPixels / 1.4)),
  );
  for (let index = 0; index <= steps; index += 1) {
    const amount = index / steps;
    const x = from.x + (to.x - from.x) * amount;
    const y = from.y + (to.y - from.y) * amount;
    if (samplePersonMask(mask, x, y) < 0.3) return false;
  }
  return true;
};

// 변경: 8방향 chamfer distance transform으로 몸 안쪽 픽셀에서
// 가장 가까운 실루엣 경계까지의 거리를 계산한다.
const createBoundaryField = (mask: PersonMask): BoundaryField => {
  const cached = boundaryFieldCache.get(mask);
  if (cached) return cached;

  const { width, height } = mask;
  const insideDistance = new Float32Array(width * height);
  const farDistance = width + height;
  insideDistance.fill(farDistance);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const isCanvasEdge =
        x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (isCanvasEdge || mask.data[index] < 0.28) {
        insideDistance[index] = 0;
      }
    }
  }

  const diagonal = Math.SQRT2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      let value = insideDistance[index];
      if (x > 0) value = Math.min(value, insideDistance[index - 1] + 1);
      if (y > 0) value = Math.min(value, insideDistance[index - width] + 1);
      if (x > 0 && y > 0) {
        value = Math.min(
          value,
          insideDistance[index - width - 1] + diagonal,
        );
      }
      if (x < width - 1 && y > 0) {
        value = Math.min(
          value,
          insideDistance[index - width + 1] + diagonal,
        );
      }
      insideDistance[index] = value;
    }
  }

  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const index = y * width + x;
      let value = insideDistance[index];
      if (x < width - 1) {
        value = Math.min(value, insideDistance[index + 1] + 1);
      }
      if (y < height - 1) {
        value = Math.min(value, insideDistance[index + width] + 1);
      }
      if (x < width - 1 && y < height - 1) {
        value = Math.min(
          value,
          insideDistance[index + width + 1] + diagonal,
        );
      }
      if (x > 0 && y < height - 1) {
        value = Math.min(
          value,
          insideDistance[index + width - 1] + diagonal,
        );
      }
      insideDistance[index] = value;
    }
  }

  const visibilityCanvas = createCanvas(width, height);
  const visibilityContext = getContext(visibilityCanvas);
  const visibilityImage = visibilityContext.createImageData(width, height);
  for (let index = 0; index < insideDistance.length; index += 1) {
    // 변경: 경계 마지막 약 1마스크 픽셀만 부드럽게 감쇠한다.
    // 페이드 폭이 넓어 타투가 지워진 것처럼 보이지 않도록 범위를 줄였다.
    // 실루엣에서 도안이 칼로 잘린 듯 보이는 현상을 줄인다.
    const edgeVisibility = smoothStep(0.16, 1.65, insideDistance[index]);
    const alpha = clamp(mask.data[index] * edgeVisibility);
    const offset = index * 4;
    visibilityImage.data[offset] = 255;
    visibilityImage.data[offset + 1] = 255;
    visibilityImage.data[offset + 2] = 255;
    visibilityImage.data[offset + 3] = Math.round(alpha * 255);
  }
  visibilityContext.putImageData(visibilityImage, 0, 0);

  const field = {
    insideDistance,
    visibilityCanvas,
    width,
    height,
  };
  boundaryFieldCache.set(mask, field);
  return field;
};

const sampleBoundaryDistance = (
  field: BoundaryField,
  x: number,
  y: number,
) =>
  sampleFloatGrid(
    field.insideDistance,
    field.width,
    field.height,
    x,
    y,
  );

// 변경: 타투의 가로 방향으로 마스크를 훑어 현재 위치의 몸 단면을 찾는다.
// 중심을 포함하는 연속 구간만 선택하므로 다른 팔·다리나 배경으로 건너뛰지 않는다.
const findMaskCrossSection = (
  mask: PersonMask,
  canvasWidth: number,
  canvasHeight: number,
  origin: { x: number; y: number },
  direction: { x: number; y: number },
  maxDistance: number,
): MaskCrossSection | null => {
  const maskPixelScale = Math.max(
    1,
    Math.min(canvasWidth / mask.width, canvasHeight / mask.height),
  );
  const step = Math.max(1.25, maskPixelScale * 0.58);
  const threshold = 0.32;
  let runStart: number | null = null;
  let confidenceSum = 0;
  let confidenceCount = 0;
  const runs: Array<{
    start: number;
    end: number;
    confidence: number;
  }> = [];

  const finishRun = (end: number) => {
    if (runStart === null) return;
    runs.push({
      start: runStart,
      end,
      confidence: confidenceSum / Math.max(1, confidenceCount),
    });
    runStart = null;
    confidenceSum = 0;
    confidenceCount = 0;
  };

  for (
    let offset = -maxDistance;
    offset <= maxDistance + step * 0.5;
    offset += step
  ) {
    const x = origin.x + direction.x * offset;
    const y = origin.y + direction.y * offset;
    const confidence =
      x >= 0 && x <= canvasWidth && y >= 0 && y <= canvasHeight
        ? samplePersonMask(mask, x / canvasWidth, y / canvasHeight)
        : 0;

    if (confidence >= threshold) {
      if (runStart === null) runStart = offset;
      confidenceSum += confidence;
      confidenceCount += 1;
    } else {
      finishRun(offset - step * 0.5);
    }
  }
  finishRun(maxDistance);

  const selected = runs.find((run) => run.start <= 0 && run.end >= 0);
  if (
    !selected ||
    selected.start <= -maxDistance + step ||
    selected.end >= maxDistance - step
  ) {
    return null;
  }

  const radius = (selected.end - selected.start) / 2;
  if (radius < Math.max(5, maskPixelScale * 1.5)) return null;

  return {
    start: selected.start,
    end: selected.end,
    midpoint: (selected.start + selected.end) / 2,
    radius,
    confidence: clamp((selected.confidence - threshold) / (1 - threshold)),
  };
};

// 변경: 메시 행마다 독립적으로 검출한 단면 폭이 출렁이지 않도록
// 인접한 행끼리 중심과 반지름을 평활화한다.
const smoothMaskCrossSections = (
  input: Array<MaskCrossSection | null>,
) => {
  let output = input.map((section) => (section ? { ...section } : null));

  for (let pass = 0; pass < 2; pass += 1) {
    output = output.map((current, index, sections) => {
      const previous = sections[index - 1] ?? null;
      const next = sections[index + 1] ?? null;

      if (!current) {
        if (!previous || !next) return null;
        const radiusRatio =
          Math.max(previous.radius, next.radius) /
          Math.max(1, Math.min(previous.radius, next.radius));
        const midpointDifference = Math.abs(
          previous.midpoint - next.midpoint,
        );
        if (
          radiusRatio > 1.28 ||
          midpointDifference > Math.min(previous.radius, next.radius) * 0.28
        ) {
          return null;
        }
        const midpoint = (previous.midpoint + next.midpoint) / 2;
        const radius = (previous.radius + next.radius) / 2;
        return {
          start: midpoint - radius,
          end: midpoint + radius,
          midpoint,
          radius,
          confidence: Math.min(previous.confidence, next.confidence) * 0.82,
        };
      }

      const compatible = [previous, next].filter(
        (section): section is MaskCrossSection => {
          if (!section) return false;
          const radiusRatio =
            Math.max(current.radius, section.radius) /
            Math.max(1, Math.min(current.radius, section.radius));
          return (
            radiusRatio <= 1.5 &&
            Math.abs(current.midpoint - section.midpoint) <=
              Math.max(10, current.radius * 0.4)
          );
        },
      );
      if (!compatible.length) return current;

      let midpointSum = current.midpoint * 2;
      let radiusSum = current.radius * 2;
      let confidenceSum = current.confidence * 2;
      let weightSum = 2;
      for (const section of compatible) {
        midpointSum += section.midpoint;
        radiusSum += section.radius;
        confidenceSum += section.confidence;
        weightSum += 1;
      }
      const midpoint = midpointSum / weightSum;
      const radius = radiusSum / weightSum;
      return {
        start: midpoint - radius,
        end: midpoint + radius,
        midpoint,
        radius,
        confidence: confidenceSum / weightSum,
      };
    });
  }

  return output;
};

const fitWeightedLine = (points: WeightedLinePoint[]): LinearFit | null => {
  if (points.length < 2) return null;

  let weightSum = 0;
  let positionSum = 0;
  let valueSum = 0;
  let positionSquaredSum = 0;
  let positionValueSum = 0;

  for (const point of points) {
    weightSum += point.weight;
    positionSum += point.position * point.weight;
    valueSum += point.value * point.weight;
    positionSquaredSum +=
      point.position * point.position * point.weight;
    positionValueSum +=
      point.position * point.value * point.weight;
  }

  const denominator =
    weightSum * positionSquaredSum - positionSum * positionSum;
  if (weightSum < 0.0001 || Math.abs(denominator) < 0.0001) return null;

  const slope =
    (weightSum * positionValueSum - positionSum * valueSum) /
    denominator;
  return {
    intercept: (valueSum - slope * positionSum) / weightSum,
    slope,
  };
};

// 변경: 행마다 다른 반지름을 그대로 사용하지 않고 중심과 반지름을
// 각각 하나의 직선으로 회귀해 매끄러운 원뿔대 단면으로 제한한다.
const fitFrustumCrossSections = (
  input: Array<MaskCrossSection | null>,
) => {
  const minimumSamples = Math.max(5, Math.ceil(input.length * 0.45));
  const samples = input.flatMap((section, index) => {
    if (!section) return [];
    return [
      {
        index,
        position: index / Math.max(1, input.length - 1),
        midpoint: section.midpoint,
        radius: section.radius,
        confidence: section.confidence,
      },
    ];
  });

  const disabled = () => input.map(() => null);
  if (samples.length < minimumSamples) return disabled();

  let accepted = samples;
  let midpointFit: LinearFit | null = null;
  let radiusFit: LinearFit | null = null;

  // 변경: 2회의 강건 회귀로 마스크의 돌출·홈·분할 노이즈를 제거한다.
  for (let iteration = 0; iteration < 2; iteration += 1) {
    midpointFit = fitWeightedLine(
      accepted.map((sample) => ({
        position: sample.position,
        value: sample.midpoint,
        weight: Math.max(0.08, sample.confidence) ** 2,
      })),
    );
    radiusFit = fitWeightedLine(
      accepted.map((sample) => ({
        position: sample.position,
        value: sample.radius,
        weight: Math.max(0.08, sample.confidence) ** 2,
      })),
    );
    if (!midpointFit || !radiusFit) return disabled();

    const residuals = accepted
      .map((sample) => {
        const predictedMidpoint =
          midpointFit!.intercept + midpointFit!.slope * sample.position;
        const predictedRadius =
          radiusFit!.intercept + radiusFit!.slope * sample.position;
        return (
          (Math.abs(sample.midpoint - predictedMidpoint) +
            Math.abs(sample.radius - predictedRadius)) /
          Math.max(1, sample.radius)
        );
      })
      .sort((a, b) => a - b);
    const medianResidual =
      residuals[Math.floor(residuals.length / 2)] ?? 0;
    const rejectionThreshold = Math.max(0.055, medianResidual * 2.6);
    const filtered = accepted.filter((sample) => {
      const predictedMidpoint =
        midpointFit!.intercept + midpointFit!.slope * sample.position;
      const predictedRadius =
        radiusFit!.intercept + radiusFit!.slope * sample.position;
      const residual =
        (Math.abs(sample.midpoint - predictedMidpoint) +
          Math.abs(sample.radius - predictedRadius)) /
        Math.max(1, sample.radius);
      return residual <= rejectionThreshold;
    });

    if (filtered.length < minimumSamples) return disabled();
    accepted = filtered;
  }

  midpointFit = fitWeightedLine(
    accepted.map((sample) => ({
      position: sample.position,
      value: sample.midpoint,
      weight: Math.max(0.08, sample.confidence) ** 2,
    })),
  );
  radiusFit = fitWeightedLine(
    accepted.map((sample) => ({
      position: sample.position,
      value: sample.radius,
      weight: Math.max(0.08, sample.confidence) ** 2,
    })),
  );
  if (!midpointFit || !radiusFit) return disabled();

  const topRadius = radiusFit.intercept;
  const bottomRadius = radiusFit.intercept + radiusFit.slope;
  const minimumRadius = Math.min(topRadius, bottomRadius);
  const maximumRadius = Math.max(topRadius, bottomRadius);
  if (
    minimumRadius <= 5 ||
    maximumRadius / Math.max(1, minimumRadius) > 2.5
  ) {
    return disabled();
  }

  let errorSum = 0;
  let confidenceSum = 0;
  for (const sample of accepted) {
    const predictedMidpoint =
      midpointFit.intercept + midpointFit.slope * sample.position;
    const predictedRadius =
      radiusFit.intercept + radiusFit.slope * sample.position;
    errorSum +=
      (Math.abs(sample.midpoint - predictedMidpoint) +
        Math.abs(sample.radius - predictedRadius)) /
      Math.max(1, sample.radius);
    confidenceSum += sample.confidence;
  }

  const normalizedError = errorSum / Math.max(1, accepted.length);
  const sampleCoverage = accepted.length / input.length;
  const averageConfidence = confidenceSum / Math.max(1, accepted.length);
  const fitConfidence =
    (1 - smoothStep(0.055, 0.17, normalizedError)) *
    smoothStep(0.44, 0.78, sampleCoverage) *
    smoothStep(0.08, 0.68, averageConfidence);

  // 변경: 원뿔대에 맞지 않는 어깨·복부·복잡한 실루엣에서는
  // 경계 기하 변형을 자동으로 끄고 깊이 기반 변형만 사용한다.
  if (normalizedError > 0.17 || fitConfidence < 0.16) {
    return disabled();
  }

  return input.map((section, index) => {
    if (!section) return null;
    const position = index / Math.max(1, input.length - 1);
    const midpoint =
      midpointFit!.intercept + midpointFit!.slope * position;
    const radius = Math.max(
      5,
      radiusFit!.intercept + radiusFit!.slope * position,
    );
    return {
      start: midpoint - radius,
      end: midpoint + radius,
      midpoint,
      radius,
      confidence: Math.min(section.confidence, fitConfidence),
    };
  });
};

const createFrustumProjection = (
  sections: Array<MaskCrossSection | null>,
): FrustumProjection | null => {
  const samples = sections.flatMap((section, index) => {
    if (!section) return [];
    return [
      {
        position: index / Math.max(1, sections.length - 1),
        section,
      },
    ];
  });
  if (samples.length < Math.max(5, Math.ceil(sections.length * 0.4))) {
    return null;
  }

  const midpointFit = fitWeightedLine(
    samples.map(({ position, section }) => ({
      position,
      value: section.midpoint,
      weight: Math.max(0.08, section.confidence) ** 2,
    })),
  );
  const radiusFit = fitWeightedLine(
    samples.map(({ position, section }) => ({
      position,
      value: section.radius,
      weight: Math.max(0.08, section.confidence) ** 2,
    })),
  );
  if (!midpointFit || !radiusFit) return null;

  return {
    midpointIntercept: midpointFit.intercept,
    midpointSlope: midpointFit.slope,
    radiusIntercept: radiusFit.intercept,
    radiusSlope: radiusFit.slope,
    confidence:
      samples.reduce(
        (sum, sample) => sum + sample.section.confidence,
        0,
      ) / samples.length,
  };
};

// 변경: 단일 픽셀 노이즈보다 넓은 신체 형태를 우선하도록
// 두 반경의 깊이 기울기를 섞어 표면 노멀의 기반을 만든다.
const sampleDepthGradient = (
  map: DepthMap | null,
  x: number,
  y: number,
): DepthGradient => {
  if (!map) return { x: 0, y: 0, disagreement: 1 };
  const fineX = 2 / Math.max(2, map.width);
  const fineY = 2 / Math.max(2, map.height);
  const broadX = 7 / Math.max(2, map.width);
  const broadY = 7 / Math.max(2, map.height);
  const fineGradientX =
    (sampleDepth(map, x + fineX, y) - sampleDepth(map, x - fineX, y)) /
    Math.max(0.0001, fineX * 2);
  const fineGradientY =
    (sampleDepth(map, x, y + fineY) - sampleDepth(map, x, y - fineY)) /
    Math.max(0.0001, fineY * 2);
  const broadGradientX =
    (sampleDepth(map, x + broadX, y) -
      sampleDepth(map, x - broadX, y)) /
    Math.max(0.0001, broadX * 2);
  const broadGradientY =
    (sampleDepth(map, x, y + broadY) -
      sampleDepth(map, x, y - broadY)) /
    Math.max(0.0001, broadY * 2);
  return {
    x: fineGradientX * 0.36 + broadGradientX * 0.64,
    y: fineGradientY * 0.36 + broadGradientY * 0.64,
    // 변경: 서로 다른 반경의 기울기가 다르면 깊이 추정이 불안정한 것으로 본다.
    disagreement: Math.hypot(
      fineGradientX - broadGradientX,
      fineGradientY - broadGradientY,
    ),
  };
};

const rotatePoint = (x: number, y: number, angle: number) => {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: x * cosine - y * sine,
    y: x * sine + y * cosine,
  };
};

const solveLinear3x3 = (
  matrix: number[][],
  vector: number[],
): [number, number, number] | null => {
  const augmented = matrix.map((row, index) => [
    ...row,
    vector[index],
  ]);

  for (let column = 0; column < 3; column += 1) {
    let pivotRow = column;
    for (let row = column + 1; row < 3; row += 1) {
      if (
        Math.abs(augmented[row][column]) >
        Math.abs(augmented[pivotRow][column])
      ) {
        pivotRow = row;
      }
    }
    if (Math.abs(augmented[pivotRow][column]) < 0.0000001) return null;
    [augmented[column], augmented[pivotRow]] = [
      augmented[pivotRow],
      augmented[column],
    ];

    const pivot = augmented[column][column];
    for (let index = column; index < 4; index += 1) {
      augmented[column][index] /= pivot;
    }
    for (let row = 0; row < 3; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let index = column; index < 4; index += 1) {
        augmented[row][index] -= factor * augmented[column][index];
      }
    }
  }

  return [
    augmented[0][3],
    augmented[1][3],
    augmented[2][3],
  ];
};

// 변경: 타투 주변 깊이를 z = a + bx + cy 평면으로 적합한다.
// 카메라를 향한 전체 기울기와 실제 피부의 국소 굴곡을 분리하기 위한 기준면이다.
const fitLocalDepthSurface = ({
  depth,
  personMask,
  boundaryField,
  geometry,
  transform,
  canvasWidth,
  canvasHeight,
}: {
  depth: DepthMap | null;
  personMask: PersonMask;
  boundaryField: BoundaryField;
  geometry: OverlayGeometry;
  transform: TattooTransform;
  canvasWidth: number;
  canvasHeight: number;
}): LocalDepthSurface => {
  const fallbackGradient = sampleDepthGradient(
    depth,
    transform.x,
    transform.y,
  );
  if (!depth) {
    return {
      centerDepth: 0.5,
      gradientX: 0,
      gradientY: 0,
      confidence: 0,
    };
  }

  const samples: Array<{
    dx: number;
    dy: number;
    depth: number;
    weight: number;
  }> = [];
  const gridSize = 7;

  for (let row = 0; row < gridSize; row += 1) {
    const v = row / Math.max(1, gridSize - 1);
    for (let column = 0; column < gridSize; column += 1) {
      const u = column / Math.max(1, gridSize - 1);
      const localX = (u - 0.5) * geometry.width * 0.92;
      const localY = (v - 0.5) * geometry.height * 0.92;
      const rotated = rotatePoint(localX, localY, transform.rotation);
      const normalizedX =
        (geometry.center.x + rotated.x) / canvasWidth;
      const normalizedY =
        (geometry.center.y + rotated.y) / canvasHeight;
      const maskConfidence = smoothStep(
        0.18,
        0.72,
        samplePersonMask(personMask, normalizedX, normalizedY),
      );
      const boundaryConfidence = smoothStep(
        0.65,
        3.4,
        sampleBoundaryDistance(
          boundaryField,
          normalizedX,
          normalizedY,
        ),
      );
      const centerDistance = Math.hypot((u - 0.5) * 2, (v - 0.5) * 2);
      const centerWeight = clamp(1.08 - centerDistance * 0.32, 0.42, 1);
      const weight =
        maskConfidence * boundaryConfidence * centerWeight;
      if (weight < 0.035) continue;
      samples.push({
        dx: normalizedX - transform.x,
        dy: normalizedY - transform.y,
        depth: sampleDepth(depth, normalizedX, normalizedY),
        weight,
      });
    }
  }

  if (samples.length < 9) {
    return {
      centerDepth: sampleDepth(depth, transform.x, transform.y),
      gradientX: fallbackGradient.x,
      gradientY: fallbackGradient.y,
      confidence: 0.18,
    };
  }

  let m00 = 0;
  let m01 = 0;
  let m02 = 0;
  let m11 = 0;
  let m12 = 0;
  let m22 = 0;
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;

  for (const sample of samples) {
    const { dx, dy, weight } = sample;
    m00 += weight;
    m01 += weight * dx;
    m02 += weight * dy;
    m11 += weight * dx * dx;
    m12 += weight * dx * dy;
    m22 += weight * dy * dy;
    b0 += weight * sample.depth;
    b1 += weight * dx * sample.depth;
    b2 += weight * dy * sample.depth;
  }

  const solution = solveLinear3x3(
    [
      [m00, m01, m02],
      [m01, m11, m12],
      [m02, m12, m22],
    ],
    [b0, b1, b2],
  );
  if (!solution) {
    return {
      centerDepth: sampleDepth(depth, transform.x, transform.y),
      gradientX: fallbackGradient.x,
      gradientY: fallbackGradient.y,
      confidence: 0.18,
    };
  }

  const [centerDepth, gradientX, gradientY] = solution;
  let residualSum = 0;
  let weightSum = 0;
  for (const sample of samples) {
    const predicted =
      centerDepth + gradientX * sample.dx + gradientY * sample.dy;
    const residual = sample.depth - predicted;
    residualSum += residual * residual * sample.weight;
    weightSum += sample.weight;
  }
  const rootMeanSquaredError = Math.sqrt(
    residualSum / Math.max(0.0001, weightSum),
  );
  const coverage = samples.length / (gridSize * gridSize);
  const confidence =
    smoothStep(0.22, 0.72, coverage) *
    (1 - smoothStep(0.028, 0.115, rootMeanSquaredError));

  return {
    centerDepth,
    gradientX,
    gradientY,
    confidence: clamp(confidence),
  };
};

const normalizeVector3 = (vector: { x: number; y: number; z: number }) => {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length < 0.0001) return { x: 0, y: 0, z: 1 };
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
};

// 변경: EXIF가 없는 일반 업로드에서도 안정적으로 동작하도록
// 55도 수평 화각의 가상 카메라를 사용해 픽셀별 시선 방향을 계산한다.
const getViewDirection = (
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
) => {
  const horizontalFieldOfView = (55 * Math.PI) / 180;
  const focalLength =
    canvasWidth / (2 * Math.tan(horizontalFieldOfView / 2));
  return normalizeVector3({
    x: (canvasWidth * 0.5 - x) / focalLength,
    y: (canvasHeight * 0.5 - y) / focalLength,
    z: 1,
  });
};

export const getOverlayGeometry = (
  canvasWidth: number,
  canvasHeight: number,
  tattoo: HTMLCanvasElement,
  transform: TattooTransform,
): OverlayGeometry => {
  const width = transform.width * canvasWidth;
  const height = width * (tattoo.height / tattoo.width);
  const center = {
    x: transform.x * canvasWidth,
    y: transform.y * canvasHeight,
  };
  const localCorners = [
    { x: -width / 2, y: -height / 2 },
    { x: width / 2, y: -height / 2 },
    { x: width / 2, y: height / 2 },
    { x: -width / 2, y: height / 2 },
  ];
  const corners = localCorners.map((point) => {
    const rotated = rotatePoint(point.x, point.y, transform.rotation);
    return { x: center.x + rotated.x, y: center.y + rotated.y };
  });
  const topOffset = rotatePoint(0, -height / 2 - Math.max(30, width * 0.08), transform.rotation);

  return {
    center,
    width,
    height,
    corners,
    rotationHandle: {
      x: center.x + topOffset.x,
      y: center.y + topOffset.y,
    },
  };
};

const WEBGL_SURFACE_VERTEX_SHADER = `#version 300 es
precision highp float;

void main() {
  vec2 positions[3] = vec2[3](
    vec2(-1.0, -1.0),
    vec2(3.0, -1.0),
    vec2(-1.0, 3.0)
  );
  gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
}
`;

const WEBGL_SURFACE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D uTattoo;
uniform sampler2D uDepth;
uniform sampler2D uMask;
uniform sampler2D uBody;
uniform sampler2D uBoundary;
uniform vec2 uCanvasSize;
uniform vec2 uDepthSize;
uniform vec2 uMaskSize;
uniform vec2 uBoundarySize;
uniform vec2 uCenter;
uniform vec2 uAnchor;
uniform vec2 uOverlaySize;
uniform vec4 uPlane;
uniform vec4 uFrustum;
uniform float uFrustumConfidence;
uniform float uRotation;
uniform float uCurvature;
uniform float uOpacity;

out vec4 outputColor;

const float PI = 3.141592653589793;

vec3 srgbToLinear(vec3 color) {
  vec3 low = color / 12.92;
  vec3 high = pow((color + 0.055) / 1.055, vec3(2.4));
  return mix(high, low, lessThanEqual(color, vec3(0.04045)));
}

vec3 linearToSrgb(vec3 color) {
  color = max(color, vec3(0.0));
  vec3 low = color * 12.92;
  vec3 high = 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055;
  return clamp(
    mix(high, low, lessThanEqual(color, vec3(0.0031308))),
    0.0,
    1.0
  );
}

float linearLuminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

float bodyLuminance(vec2 uv) {
  return linearLuminance(srgbToLinear(texture(uBody, uv).rgb));
}

float sampleScalar(sampler2D textureSampler, vec2 rasterSize, vec2 uv) {
  vec2 coordinate =
    clamp(uv, vec2(0.0), vec2(1.0)) * max(rasterSize - 1.0, vec2(0.0));
  ivec2 lower = ivec2(floor(coordinate));
  ivec2 upper = min(lower + ivec2(1), ivec2(rasterSize) - ivec2(1));
  vec2 amount = fract(coordinate);
  float top = mix(
    texelFetch(textureSampler, lower, 0).r,
    texelFetch(textureSampler, ivec2(upper.x, lower.y), 0).r,
    amount.x
  );
  float bottom = mix(
    texelFetch(textureSampler, ivec2(lower.x, upper.y), 0).r,
    texelFetch(textureSampler, upper, 0).r,
    amount.x
  );
  return mix(top, bottom, amount.y);
}

vec2 depthGradient(vec2 normalizedPixel, float radius) {
  vec2 stepSize = radius / uCanvasSize;
  float left = sampleScalar(
    uDepth,
    uDepthSize,
    normalizedPixel - vec2(stepSize.x, 0.0)
  );
  float right = sampleScalar(
    uDepth,
    uDepthSize,
    normalizedPixel + vec2(stepSize.x, 0.0)
  );
  float top = sampleScalar(
    uDepth,
    uDepthSize,
    normalizedPixel - vec2(0.0, stepSize.y)
  );
  float bottom = sampleScalar(
    uDepth,
    uDepthSize,
    normalizedPixel + vec2(0.0, stepSize.y)
  );
  return vec2(
    (right - left) / max(0.0001, stepSize.x * 2.0),
    (bottom - top) / max(0.0001, stepSize.y * 2.0)
  );
}

// 변경: 기준점에서 현재 픽셀까지 이동하며 배경을 한 번이라도 통과하면 숨긴다.
// 경계 거리만큼 안전하게 전진하므로 고정 간격 샘플보다 얇은 배경 틈을 덜 놓친다.
float anchorPathVisibility(vec2 anchorUv, vec2 targetUv) {
  vec2 ray = targetUv - anchorUv;
  float rayLength = length(ray * uBoundarySize);
  if (rayLength < 0.5) return 1.0;

  float travelled = 0.0;
  for (int index = 0; index < 24; index += 1) {
    float amount = clamp(travelled / rayLength, 0.0, 1.0);
    vec2 point = anchorUv + ray * amount;
    if (sampleScalar(uMask, uMaskSize, point) < 0.26) return 0.0;
    if (amount >= 0.999) return 1.0;

    float safeDistance = sampleScalar(
      uBoundary,
      uBoundarySize,
      point
    );
    travelled += clamp(safeDistance * 0.68, 0.75, 18.0);
  }

  // 변경: 매우 긴 경로는 마지막으로 균등 샘플링해 큰 배경 구간을 보완한다.
  for (int index = 1; index <= 8; index += 1) {
    float amount = float(index) / 8.0;
    vec2 point = anchorUv + ray * amount;
    if (sampleScalar(uMask, uMaskSize, point) < 0.26) return 0.0;
  }
  return 1.0;
}

void main() {
  // 변경: WebGL의 아래쪽 원점을 Canvas와 같은 위쪽 원점으로 변환한다.
  vec2 pixel = vec2(gl_FragCoord.x, uCanvasSize.y - gl_FragCoord.y);
  vec2 normalizedPixel = pixel / uCanvasSize;
  vec2 anchorUv = uAnchor;
  if (sampleScalar(uMask, uMaskSize, anchorUv) < 0.32) discard;
  float person = sampleScalar(uMask, uMaskSize, normalizedPixel);
  if (person < 0.035) discard;
  float boundaryDistance = sampleScalar(
    uBoundary,
    uBoundarySize,
    normalizedPixel
  );
  float boundaryVisibility = smoothstep(0.16, 1.65, boundaryDistance);
  float stableInterior = smoothstep(0.9, 5.5, boundaryDistance);

  float cosine = cos(uRotation);
  float sine = sin(uRotation);
  vec2 relativePixel = pixel - uCenter;
  vec2 localPixel = vec2(
    cosine * relativePixel.x + sine * relativePixel.y,
    -sine * relativePixel.x + cosine * relativePixel.y
  );
  vec2 affineUv = localPixel / uOverlaySize + 0.5;
  if (
    affineUv.x < -0.34 ||
    affineUv.x > 1.34 ||
    affineUv.y < -0.34 ||
    affineUv.y > 1.34
  ) {
    discard;
  }
  if (anchorPathVisibility(anchorUv, normalizedPixel) < 0.5) discard;

  vec2 fineGradient = depthGradient(normalizedPixel, 2.0);
  vec2 broadGradient = depthGradient(normalizedPixel, 7.0);
  vec2 measuredGradient = mix(fineGradient, broadGradient, 0.64);
  float overlaySpan = max(
    uOverlaySize.x / uCanvasSize.x,
    uOverlaySize.y / uCanvasSize.y
  );
  float agreement = 1.0 - smoothstep(
    0.035,
    0.26,
    length(fineGradient - broadGradient) * overlaySpan
  );
  float maskConfidence = smoothstep(0.15, 0.72, person);
  float depthConfidence =
    maskConfidence *
    agreement *
    mix(0.42, 1.0, uPlane.w) *
    mix(0.18, 1.0, stableInterior);
  float planeDepth =
    uPlane.x +
    uPlane.y * (normalizedPixel.x - uCenter.x / uCanvasSize.x) +
    uPlane.z * (normalizedPixel.y - uCenter.y / uCanvasSize.y);
  float rawDepth = sampleScalar(uDepth, uDepthSize, normalizedPixel);

  // 변경: 불안정한 단안 깊이는 국소 기준 평면 쪽으로 수축한다.
  float stableDepth = mix(
    planeDepth,
    rawDepth,
    clamp(depthConfidence * 0.74, 0.0, 0.82)
  );
  vec2 stableGradient = mix(
    uPlane.yz,
    measuredGradient,
    clamp(agreement * maskConfidence, 0.0, 0.78)
  );
  float depthScale = mix(0.0, 0.22, clamp(uCurvature, 0.0, 1.15));
  float viewDepth = clamp(
    1.0 - (stableDepth - uPlane.x) * depthScale,
    0.86,
    1.14
  );

  // 변경: 가상의 55도 카메라에서 픽셀을 3D 표면점으로 역투영한다.
  float focalLength =
    uCanvasSize.x / (2.0 * tan(radians(55.0) * 0.5));
  vec2 principalPoint = uCanvasSize * 0.5;
  vec3 surfacePoint = vec3(
    (pixel - principalPoint) / focalLength * viewDepth,
    -viewDepth
  );
  vec3 anchorPoint = vec3(
    (uCenter - principalPoint) / focalLength,
    -1.0
  );

  vec2 normalizedWorldSpan = vec2(
    uCanvasSize.x / focalLength,
    uCanvasSize.y / focalLength
  );
  vec2 surfaceSlope =
    stableGradient *
    depthScale /
    max(normalizedWorldSpan, vec2(0.0001));
  surfaceSlope = clamp(surfaceSlope, vec2(-0.68), vec2(0.68));
  vec3 geometryNormal = normalize(vec3(-surfaceSlope, 1.0));
  vec3 viewDirection = normalize(-surfacePoint);

  vec3 horizontal = vec3(cosine, sine, 0.0);
  vec3 vertical = vec3(-sine, cosine, 0.0);
  vec3 tangent = normalize(
    horizontal - geometryNormal * dot(horizontal, geometryNormal)
  );
  vec3 bitangentCandidate =
    vertical -
    geometryNormal * dot(vertical, geometryNormal) -
    tangent * dot(vertical, tangent);
  vec3 bitangent =
    length(bitangentCandidate) > 0.0001
      ? normalize(bitangentCandidate)
      : normalize(cross(geometryNormal, tangent));

  vec3 surfaceDelta = surfacePoint - anchorPoint;
  vec2 worldOverlaySize = uOverlaySize / focalLength;
  vec2 surfaceUv = vec2(
    dot(surfaceDelta, tangent) / max(0.0001, worldOverlaySize.x) + 0.5,
    dot(surfaceDelta, bitangent) / max(0.0001, worldOverlaySize.y) + 0.5
  );

  // 변경: 강건하게 적합된 원뿔대는 몸의 가장자리에서만 역함수로 보정한다.
  float rowPosition = clamp(surfaceUv.y, 0.0, 1.0);
  float midpoint = uFrustum.x + uFrustum.y * rowPosition;
  float radius = max(5.0, uFrustum.z + uFrustum.w * rowPosition);
  float normalizedAcross = (localPixel.x - midpoint) / radius;
  if (abs(normalizedAcross) < 0.995 && uFrustumConfidence > 0.0) {
    float flatAcross =
      midpoint +
      (2.0 / PI) * asin(clamp(normalizedAcross, -0.995, 0.995)) * radius;
    float inverseFrustumU = flatAcross / uOverlaySize.x + 0.5;
    float sectionEdgeInfluence = smoothstep(
      0.58,
      0.94,
      abs(normalizedAcross)
    );
    float silhouetteInfluence =
      1.0 - smoothstep(1.6, 10.0, boundaryDistance);
    float edgeInfluence = max(
      sectionEdgeInfluence,
      silhouetteInfluence * 0.84
    );
    float frustumStrength =
      clamp(uCurvature, 0.0, 1.15) *
      uFrustumConfidence *
      edgeInfluence *
      0.34;
    surfaceUv.x = mix(surfaceUv.x, inverseFrustumU, frustumStrength);
  }

  if (
    surfaceUv.x < 0.0 ||
    surfaceUv.x > 1.0 ||
    surfaceUv.y < 0.0 ||
    surfaceUv.y > 1.0
  ) {
    discard;
  }

  // 변경: 깊이맵의 큰 굴곡에 피부 명암의 작은 기울기를 약하게 결합한다.
  // 명암 에지가 지나치게 강하면 털·그림자일 가능성이 있어 자동으로 배제한다.
  vec2 microStep = vec2(2.5) / uCanvasSize;
  float centerLuminance = bodyLuminance(normalizedPixel);
  float leftLuminance = bodyLuminance(
    normalizedPixel - vec2(microStep.x, 0.0)
  );
  float rightLuminance = bodyLuminance(
    normalizedPixel + vec2(microStep.x, 0.0)
  );
  float topLuminance = bodyLuminance(
    normalizedPixel - vec2(0.0, microStep.y)
  );
  float bottomLuminance = bodyLuminance(
    normalizedPixel + vec2(0.0, microStep.y)
  );
  vec2 imageGradient = vec2(
    rightLuminance - leftLuminance,
    bottomLuminance - topLuminance
  );
  float imageGradientMagnitude = length(imageGradient);
  float microConfidence =
    smoothstep(0.0015, 0.035, imageGradientMagnitude) *
    (1.0 - smoothstep(0.075, 0.22, imageGradientMagnitude)) *
    maskConfidence;
  vec2 microSlope = clamp(
    imageGradient * 2.8,
    vec2(-0.22),
    vec2(0.22)
  ) * microConfidence;

  // 변경: 실루엣에 가까워질수록 표면 노멀도 원뿔대 안쪽으로 서서히 회전한다.
  float boundaryRoll =
    (1.0 - smoothstep(1.2, 8.5, boundaryDistance)) *
    uFrustumConfidence *
    clamp(abs(normalizedAcross), 0.0, 1.0);
  vec2 rollSlope =
    horizontal.xy *
    sign(normalizedAcross) *
    boundaryRoll *
    0.34;
  vec3 appearanceNormal = normalize(
    vec3(-(surfaceSlope + microSlope * 0.32 + rollSlope), 1.0)
  );
  float facing = clamp(dot(appearanceNormal, viewDirection), 0.0, 1.0);
  float visibility =
    smoothstep(0.1, 0.48, person) *
    boundaryVisibility *
    mix(0.72, 1.0, smoothstep(0.3, 0.74, facing));

  // 변경: 미리 곱한 알파와 Mipmap을 사용해 축소·회전·급한 원근에서도
  // 도안 가장자리의 검은 테두리와 계단 현상을 줄인다.
  vec4 inkSample = textureGrad(
    uTattoo,
    surfaceUv,
    dFdx(surfaceUv),
    dFdy(surfaceUv)
  );
  float effectiveAlpha = inkSample.a * visibility * uOpacity;
  if (effectiveAlpha < 0.0015) discard;
  vec3 inkSrgb = clamp(
    inkSample.rgb / max(inkSample.a, 0.001),
    0.0,
    1.0
  );

  // 변경: sRGB 단순 multiply 대신 선형 색 공간의 색소 흡수로 합성한다.
  vec3 skinLinear = srgbToLinear(texture(uBody, normalizedPixel).rgb);
  vec3 inkLinear = srgbToLinear(inkSrgb);
  vec3 absorptionCoefficient =
    vec3(0.28) + (vec3(1.0) - inkLinear) * 2.48;
  vec3 transmission = exp(
    -absorptionCoefficient * effectiveAlpha * 1.34
  );
  vec3 pigmentScatter =
    inkLinear * (vec3(1.0) - transmission) * 0.16;
  vec3 tattooedSkin = skinLinear * transmission + pigmentScatter;

  vec2 broadStep = vec2(7.0) / uCanvasSize;
  float broadLuminance = (
    centerLuminance * 2.0 +
    bodyLuminance(normalizedPixel - vec2(broadStep.x, 0.0)) +
    bodyLuminance(normalizedPixel + vec2(broadStep.x, 0.0)) +
    bodyLuminance(normalizedPixel - vec2(0.0, broadStep.y)) +
    bodyLuminance(normalizedPixel + vec2(0.0, broadStep.y))
  ) / 6.0;
  float highlight = smoothstep(
    0.012,
    0.12,
    max(0.0, centerLuminance - broadLuminance)
  );
  float highlightRecovery =
    highlight *
    smoothstep(0.34, 0.86, facing) *
    mix(0.24, 0.56, effectiveAlpha);
  tattooedSkin = mix(
    tattooedSkin,
    skinLinear,
    clamp(highlightRecovery, 0.0, 0.58)
  );

  // 변경: 이미 피부색과 도안 알파를 모두 계산했으므로 완성 픽셀로 출력한다.
  outputColor = vec4(linearToSrgb(tattooedSkin), 1.0);
}
`;

const compileWebGLShader = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const createWebGLSurfaceRenderer = (): WebGLSurfaceRendererState | null => {
  const canvas = createCanvas(1, 1);
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) return null;

  const vertexShader = compileWebGLShader(
    gl,
    gl.VERTEX_SHADER,
    WEBGL_SURFACE_VERTEX_SHADER,
  );
  const fragmentShader = compileWebGLShader(
    gl,
    gl.FRAGMENT_SHADER,
    WEBGL_SURFACE_FRAGMENT_SHADER,
  );
  if (!vertexShader || !fragmentShader) {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    return null;
  }

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  const vertexArray = gl.createVertexArray();
  const tattooTexture = gl.createTexture();
  const depthTexture = gl.createTexture();
  const maskTexture = gl.createTexture();
  const bodyTexture = gl.createTexture();
  const boundaryTexture = gl.createTexture();
  if (
    !vertexArray ||
    !tattooTexture ||
    !depthTexture ||
    !maskTexture ||
    !bodyTexture ||
    !boundaryTexture
  ) {
    gl.deleteProgram(program);
    return null;
  }

  return {
    canvas,
    gl,
    program,
    vertexArray,
    tattooTexture,
    depthTexture,
    maskTexture,
    bodyTexture,
    boundaryTexture,
    lastTattoo: null,
    lastDepth: null,
    lastMask: null,
    lastBody: null,
    lastBodyWidth: 0,
    lastBodyHeight: 0,
    lastBoundaryField: null,
    neutralDepthUploaded: false,
  };
};

const uploadScalarTexture = (
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  width: number,
  height: number,
  data: Float32Array,
) => {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.R32F,
    width,
    height,
    0,
    gl.RED,
    gl.FLOAT,
    data,
  );
};

const applyAnisotropicFiltering = (
  gl: WebGL2RenderingContext,
  target = gl.TEXTURE_2D,
) => {
  const extension = gl.getExtension("EXT_texture_filter_anisotropic");
  if (!extension) return;
  const maximum = gl.getParameter(
    extension.MAX_TEXTURE_MAX_ANISOTROPY_EXT,
  ) as number;
  gl.texParameterf(
    target,
    extension.TEXTURE_MAX_ANISOTROPY_EXT,
    Math.min(8, maximum),
  );
};

const uploadBodyTexture = (
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  body: HTMLImageElement,
  width: number,
  height: number,
) => {
  // 변경: Canvas와 정확히 같은 크기로 맞춘 신체 이미지를 GPU에 올린다.
  const fittedBody = createCanvas(width, height);
  getContext(fittedBody).drawImage(body, 0, 0, width, height);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    fittedBody,
  );
  gl.generateMipmap(gl.TEXTURE_2D);
  applyAnisotropicFiltering(gl);
};

// 변경: 출력 픽셀을 깊이 표면으로 역투영한 뒤 도안 UV를 찾는다.
// 정방향 삼각형 메시에서 생기던 틈·중첩·경계 접힘을 구조적으로 피한다.
const drawTattooWithWebGL = (
  target: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  body: HTMLImageElement,
  tattoo: HTMLCanvasElement,
  depth: DepthMap | null,
  personMask: PersonMask,
  transform: TattooTransform,
  clipAnchor: { x: number; y: number },
  curvature: number,
  opacity: number,
) => {
  try {
    if (!webGLSurfaceRendererState) {
      webGLSurfaceRendererState = createWebGLSurfaceRenderer();
    }
    const state = webGLSurfaceRendererState;
    if (!state || state.gl.isContextLost()) return false;

    const { canvas, gl, program } = state;
    // 변경: 이전 프레임의 WebGL 오류가 이번 프레임 판정에 섞이지 않게 비운다.
    for (let index = 0; index < 8; index += 1) {
      if (gl.getError() === gl.NO_ERROR) break;
    }
    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    }
    const geometry = getOverlayGeometry(
      canvasWidth,
      canvasHeight,
      tattoo,
      transform,
    );
    const boundaryField = createBoundaryField(personMask);
    const localSurface = fitLocalDepthSurface({
      depth,
      personMask,
      boundaryField,
      geometry,
      transform,
      canvasWidth,
      canvasHeight,
    });

    const wrapDirection = rotatePoint(1, 0, transform.rotation);
    const axisDirection = rotatePoint(0, 1, transform.rotation);
    const rows = Math.max(
      16,
      Math.round(32 * (geometry.height / Math.max(1, geometry.width))),
    );
    const maxCrossSectionDistance = Math.min(
      Math.hypot(canvasWidth, canvasHeight) * 0.68,
      Math.max(
        geometry.width * 2.35,
        Math.min(canvasWidth, canvasHeight) * 0.36,
      ),
    );
    const rawCrossSections: Array<MaskCrossSection | null> = [];
    for (let row = 0; row <= rows; row += 1) {
      const localY = (row / rows - 0.5) * geometry.height;
      const rowCenter = {
        x: geometry.center.x + axisDirection.x * localY,
        y: geometry.center.y + axisDirection.y * localY,
      };
      rawCrossSections.push(
        findMaskCrossSection(
          personMask,
          canvasWidth,
          canvasHeight,
          rowCenter,
          wrapDirection,
          maxCrossSectionDistance,
        ),
      );
    }
    const fittedCrossSections = fitFrustumCrossSections(
      smoothMaskCrossSections(rawCrossSections),
    );
    const frustum = createFrustumProjection(fittedCrossSections);

    gl.viewport(0, 0, canvasWidth, canvasHeight);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const margin = Math.max(
      18,
      geometry.width * 0.22,
      geometry.height * 0.22,
    );
    const left = clamp(
      Math.floor(
        Math.min(...geometry.corners.map((point) => point.x)) - margin,
      ),
      0,
      canvasWidth,
    );
    const top = clamp(
      Math.floor(
        Math.min(...geometry.corners.map((point) => point.y)) - margin,
      ),
      0,
      canvasHeight,
    );
    const right = clamp(
      Math.ceil(
        Math.max(...geometry.corners.map((point) => point.x)) + margin,
      ),
      0,
      canvasWidth,
    );
    const bottom = clamp(
      Math.ceil(
        Math.max(...geometry.corners.map((point) => point.y)) + margin,
      ),
      0,
      canvasHeight,
    );
    if (right <= left || bottom <= top) return true;
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(
      Math.floor(left),
      Math.floor(canvasHeight - bottom),
      Math.ceil(right - left),
      Math.ceil(bottom - top),
    );

    gl.useProgram(program);
    gl.bindVertexArray(state.vertexArray);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.tattooTexture);
    if (state.lastTattoo !== tattoo) {
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      // 변경: 알파를 미리 곱한 Mipmap으로 투명 도안 경계의 검은 번짐을 막는다.
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        tattoo,
      );
      gl.generateMipmap(gl.TEXTURE_2D);
      applyAnisotropicFiltering(gl);
      state.lastTattoo = tattoo;
    }

    gl.activeTexture(gl.TEXTURE1);
    if (depth) {
      if (state.lastDepth !== depth) {
        uploadScalarTexture(
          gl,
          state.depthTexture,
          depth.width,
          depth.height,
          depth.data,
        );
        state.lastDepth = depth;
      } else {
        gl.bindTexture(gl.TEXTURE_2D, state.depthTexture);
      }
    } else if (!state.neutralDepthUploaded || state.lastDepth !== null) {
      uploadScalarTexture(
        gl,
        state.depthTexture,
        1,
        1,
        new Float32Array([0.5]),
      );
      state.lastDepth = null;
      state.neutralDepthUploaded = true;
    } else {
      gl.bindTexture(gl.TEXTURE_2D, state.depthTexture);
    }

    gl.activeTexture(gl.TEXTURE2);
    if (state.lastMask !== personMask) {
      uploadScalarTexture(
        gl,
        state.maskTexture,
        personMask.width,
        personMask.height,
        personMask.data,
      );
      state.lastMask = personMask;
    } else {
      gl.bindTexture(gl.TEXTURE_2D, state.maskTexture);
    }

    gl.activeTexture(gl.TEXTURE3);
    if (
      state.lastBody !== body ||
      state.lastBodyWidth !== canvasWidth ||
      state.lastBodyHeight !== canvasHeight
    ) {
      uploadBodyTexture(
        gl,
        state.bodyTexture,
        body,
        canvasWidth,
        canvasHeight,
      );
      state.lastBody = body;
      state.lastBodyWidth = canvasWidth;
      state.lastBodyHeight = canvasHeight;
    } else {
      gl.bindTexture(gl.TEXTURE_2D, state.bodyTexture);
    }

    gl.activeTexture(gl.TEXTURE4);
    if (state.lastBoundaryField !== boundaryField) {
      uploadScalarTexture(
        gl,
        state.boundaryTexture,
        boundaryField.width,
        boundaryField.height,
        boundaryField.insideDistance,
      );
      state.lastBoundaryField = boundaryField;
    } else {
      gl.bindTexture(gl.TEXTURE_2D, state.boundaryTexture);
    }

    gl.uniform1i(gl.getUniformLocation(program, "uTattoo"), 0);
    gl.uniform1i(gl.getUniformLocation(program, "uDepth"), 1);
    gl.uniform1i(gl.getUniformLocation(program, "uMask"), 2);
    gl.uniform1i(gl.getUniformLocation(program, "uBody"), 3);
    gl.uniform1i(gl.getUniformLocation(program, "uBoundary"), 4);
    gl.uniform2f(
      gl.getUniformLocation(program, "uCanvasSize"),
      canvasWidth,
      canvasHeight,
    );
    gl.uniform2f(
      gl.getUniformLocation(program, "uDepthSize"),
      depth?.width ?? 1,
      depth?.height ?? 1,
    );
    gl.uniform2f(
      gl.getUniformLocation(program, "uMaskSize"),
      personMask.width,
      personMask.height,
    );
    gl.uniform2f(
      gl.getUniformLocation(program, "uBoundarySize"),
      boundaryField.width,
      boundaryField.height,
    );
    gl.uniform2f(
      gl.getUniformLocation(program, "uCenter"),
      geometry.center.x,
      geometry.center.y,
    );
    gl.uniform2f(
      gl.getUniformLocation(program, "uAnchor"),
      clipAnchor.x,
      clipAnchor.y,
    );
    gl.uniform2f(
      gl.getUniformLocation(program, "uOverlaySize"),
      geometry.width,
      geometry.height,
    );
    gl.uniform4f(
      gl.getUniformLocation(program, "uPlane"),
      localSurface.centerDepth,
      localSurface.gradientX,
      localSurface.gradientY,
      depth ? localSurface.confidence : 0,
    );
    gl.uniform4f(
      gl.getUniformLocation(program, "uFrustum"),
      frustum?.midpointIntercept ?? 0,
      frustum?.midpointSlope ?? 0,
      frustum?.radiusIntercept ?? 1,
      frustum?.radiusSlope ?? 0,
    );
    gl.uniform1f(
      gl.getUniformLocation(program, "uFrustumConfidence"),
      frustum?.confidence ?? 0,
    );
    gl.uniform1f(
      gl.getUniformLocation(program, "uRotation"),
      transform.rotation,
    );
    gl.uniform1f(
      gl.getUniformLocation(program, "uCurvature"),
      curvature,
    );
    gl.uniform1f(
      gl.getUniformLocation(program, "uOpacity"),
      opacity,
    );

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.flush();
    gl.disable(gl.SCISSOR_TEST);
    // 변경: 텍스처 형식이나 GPU 명령이 실패하면 빈 결과를 쓰지 않고
    // 같은 프레임에서 Canvas 폴백으로 전환한다.
    if (gl.getError() !== gl.NO_ERROR) return false;
    target.drawImage(canvas, 0, 0);
    return true;
  } catch {
    return false;
  }
};

const mapTriangle = (
  context: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  source: Array<{ x: number; y: number }>,
  destination: Array<{ x: number; y: number }>,
) => {
  const [s0, s1, s2] = source;
  const [d0, d1, d2] = destination;
  const determinant =
    s0.x * (s1.y - s2.y) +
    s1.x * (s2.y - s0.y) +
    s2.x * (s0.y - s1.y);

  if (Math.abs(determinant) < 0.00001) return;

  const a =
    (d0.x * (s1.y - s2.y) +
      d1.x * (s2.y - s0.y) +
      d2.x * (s0.y - s1.y)) /
    determinant;
  const c =
    (d0.x * (s2.x - s1.x) +
      d1.x * (s0.x - s2.x) +
      d2.x * (s1.x - s0.x)) /
    determinant;
  const e =
    (d0.x * (s1.x * s2.y - s2.x * s1.y) +
      d1.x * (s2.x * s0.y - s0.x * s2.y) +
      d2.x * (s0.x * s1.y - s1.x * s0.y)) /
    determinant;
  const b =
    (d0.y * (s1.y - s2.y) +
      d1.y * (s2.y - s0.y) +
      d2.y * (s0.y - s1.y)) /
    determinant;
  const d =
    (d0.y * (s2.x - s1.x) +
      d1.y * (s0.x - s2.x) +
      d2.y * (s1.x - s0.x)) /
    determinant;
  const f =
    (d0.y * (s1.x * s2.y - s2.x * s1.y) +
      d1.y * (s2.x * s0.y - s0.x * s2.y) +
      d2.y * (s0.x * s1.y - s1.x * s0.y)) /
    determinant;

  context.save();
  context.beginPath();
  context.moveTo(d0.x, d0.y);
  context.lineTo(d1.x, d1.y);
  context.lineTo(d2.x, d2.y);
  context.closePath();
  context.clip();
  context.transform(a, b, c, d, e, f);
  context.drawImage(image, 0, 0);
  context.restore();
};

const drawWarpedTattoo = (
  target: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  tattoo: HTMLCanvasElement,
  depth: DepthMap | null,
  personMask: PersonMask,
  transform: TattooTransform,
  curvature: number,
) => {
  const geometry = getOverlayGeometry(
    canvasWidth,
    canvasHeight,
    tattoo,
    transform,
  );
  // 변경: 강건하게 적합한 원뿔대와 다중 스케일 깊이 노멀을 함께 적용한다.
  const columns = 32;
  const rows = Math.max(
    16,
    Math.round(columns * (geometry.height / Math.max(1, geometry.width))),
  );
  const vertices: Array<{ x: number; y: number }> = [];
  const boundaryField = createBoundaryField(personMask);
  const localSurface = fitLocalDepthSurface({
    depth,
    personMask,
    boundaryField,
    geometry,
    transform,
    canvasWidth,
    canvasHeight,
  });
  const wrapDirection = rotatePoint(1, 0, transform.rotation);
  const axisDirection = rotatePoint(0, 1, transform.rotation);
  const maxCrossSectionDistance = Math.min(
    Math.hypot(canvasWidth, canvasHeight) * 0.68,
    Math.max(
      geometry.width * 2.35,
      Math.min(canvasWidth, canvasHeight) * 0.36,
    ),
  );
  const rawCrossSections: Array<MaskCrossSection | null> = [];

  for (let row = 0; row <= rows; row += 1) {
    const localY = (row / rows - 0.5) * geometry.height;
    const rowCenter = {
      x: geometry.center.x + axisDirection.x * localY,
      y: geometry.center.y + axisDirection.y * localY,
    };
    rawCrossSections.push(
      findMaskCrossSection(
        personMask,
        canvasWidth,
        canvasHeight,
        rowCenter,
        wrapDirection,
        maxCrossSectionDistance,
      ),
    );
  }
  const crossSections = fitFrustumCrossSections(
    smoothMaskCrossSections(rawCrossSections),
  );

  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    const localY = (v - 0.5) * geometry.height;
    const rowCenter = {
      x: geometry.center.x + axisDirection.x * localY,
      y: geometry.center.y + axisDirection.y * localY,
    };
    const crossSection = crossSections[row];

    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const localX = (u - 0.5) * geometry.width;
      let mappedAcross = localX;
      let frustumStrength = 0;

      if (crossSection) {
        const centeredAcross = localX - crossSection.midpoint;
        const normalizedAcross = centeredAcross / crossSection.radius;
        const absoluteAcross = Math.abs(normalizedAcross);

        // 변경: 원뿔대 투영을 몸 안쪽 전체가 아닌 실루엣 근처에만 적용한다.
        // 마스크 밖의 정점은 당겨오지 않고 최종 가시성 마스크에서 제거한다.
        if (absoluteAcross <= 1) {
          const projectedAcross =
            crossSection.midpoint +
            Math.sin(normalizedAcross * Math.PI * 0.5) *
              crossSection.radius;
          const tattooToBodyRatio =
            geometry.width / Math.max(1, crossSection.radius * 2);
          const distanceFromEdge = 1 - absoluteAcross;
          const edgeInfluence =
            1 - smoothStep(0.16, 0.56, distanceFromEdge);
          frustumStrength =
            clamp(curvature, 0, 1.15) *
            clamp(0.18 + tattooToBodyRatio * 0.2, 0.18, 0.38) *
            smoothStep(0.12, 0.72, crossSection.confidence) *
            edgeInfluence;

          // 변경: 한 정점이 움직일 수 있는 최대 거리를 제한해
          // 경계에서 메시가 찌그러지거나 접히는 현상을 막는다.
          const maximumShift = Math.min(
            geometry.width * 0.035,
            crossSection.radius * 0.06,
          );
          const shift = clamp(
            (projectedAcross - localX) * frustumStrength,
            -maximumShift,
            maximumShift,
          );
          mappedAcross = localX + shift;
        }
      }

      const surfaceX =
        rowCenter.x + wrapDirection.x * mappedAcross;
      const surfaceY =
        rowCenter.y + wrapDirection.y * mappedAcross;
      const normalizedX = surfaceX / canvasWidth;
      const normalizedY = surfaceY / canvasHeight;
      const currentDepth = sampleDepth(depth, normalizedX, normalizedY);
      const expectedPlane =
        localSurface.centerDepth +
        localSurface.gradientX * (normalizedX - transform.x) +
        localSurface.gradientY * (normalizedY - transform.y);
      const surfaceConfidence = smoothStep(
        0.15,
        0.72,
        samplePersonMask(personMask, normalizedX, normalizedY),
      );
      const boundaryDistance = sampleBoundaryDistance(
        boundaryField,
        normalizedX,
        normalizedY,
      );
      const edgeBand = clamp(
        (geometry.width / canvasWidth) * boundaryField.width * 0.11,
        2.2,
        9,
      );
      const edgeAmount =
        1 - smoothStep(0.7, edgeBand, boundaryDistance);
      const depthGradient = sampleDepthGradient(
        depth,
        normalizedX,
        normalizedY,
      );
      const overlaySpan = Math.max(
        geometry.width / canvasWidth,
        geometry.height / canvasHeight,
      );
      const multiScaleConfidence =
        1 -
        smoothStep(
          0.035,
          0.26,
          depthGradient.disagreement * overlaySpan,
        );
      // 변경: 경계 근처의 불안정한 단안 깊이값은 거의 사용하지 않고
      // 제한된 원뿔대 투영과 가시성 페이드가 실루엣을 담당하게 한다.
      const depthConfidence =
        surfaceConfidence *
        (1 - edgeAmount * 0.9) *
        multiScaleConfidence *
        (0.42 + localSurface.confidence * 0.58);
      const relief =
        clamp(currentDepth - expectedPlane, -0.2, 0.2) * depthConfidence;
      const stableGradientX =
        localSurface.gradientX +
        (depthGradient.x - localSurface.gradientX) *
          multiScaleConfidence;
      const stableGradientY =
        localSurface.gradientY +
        (depthGradient.y - localSurface.gradientY) *
          multiScaleConfidence;

      // 변경: 기준 평면은 카메라에 대한 전체 기울기를, 잔차는 실제 굴곡을
      // 담당한다. 두 크기의 깊이 기울기가 다르면 잔차 영향은 자동으로 줄어든다.
      const slopeX = clamp(
        stableGradientX *
          (geometry.width / canvasWidth) *
          0.24 *
          depthConfidence,
        -0.55,
        0.55,
      );
      const slopeY = clamp(
        stableGradientY *
          (geometry.height / canvasHeight) *
          0.24 *
          depthConfidence,
        -0.55,
        0.55,
      );
      const relativeX = surfaceX - geometry.center.x;
      const relativeY = surfaceY - geometry.center.y;
      // 변경: 기준 평면의 상대 깊이로 가까운 쪽은 조금 크게,
      // 먼 쪽은 조금 작게 만들어 카메라 투영에 따른 원근 크기를 반영한다.
      const perspectiveDepthDelta =
        expectedPlane - localSurface.centerDepth;
      const perspectiveScale = clamp(
        1 +
          perspectiveDepthDelta *
            curvature *
            0.18 *
            localSurface.confidence,
        0.955,
        1.045,
      );
      const perspectiveX = relativeX * perspectiveScale;
      const perspectiveY = relativeY * perspectiveScale;

      // 변경: 표면 노멀과 픽셀별 카메라 시선의 내적으로 실제 단축률을 구한다.
      // 화면 가장자리에서도 정면 기준 단축만 강제로 적용하던 문제를 줄인다.
      const surfaceNormal = normalizeVector3({
        x: -slopeX * 2.4,
        y: -slopeY * 2.4,
        z: 1,
      });
      const viewDirection = getViewDirection(
        surfaceX,
        surfaceY,
        canvasWidth,
        canvasHeight,
      );
      const facing = clamp(
        surfaceNormal.x * viewDirection.x +
          surfaceNormal.y * viewDirection.y +
          surfaceNormal.z * viewDirection.z,
        0.35,
        1,
      );
      const projectedTiltX = surfaceNormal.x - viewDirection.x;
      const projectedTiltY = surfaceNormal.y - viewDirection.y;
      const projectedTiltLength = Math.hypot(
        projectedTiltX,
        projectedTiltY,
      );
      const directionX =
        projectedTiltLength > 0.0001
          ? projectedTiltX / projectedTiltLength
          : 0;
      const directionY =
        projectedTiltLength > 0.0001
          ? projectedTiltY / projectedTiltLength
          : 0;
      const alongNormal =
        perspectiveX * directionX + perspectiveY * directionY;
      const foreshortening =
        clamp(
          (1 - facing) *
            curvature *
            0.72 *
            depthConfidence *
            (1 - frustumStrength * edgeAmount * 0.72),
          0,
          0.16,
        );
      const compressedX =
        perspectiveX - directionX * alongNormal * foreshortening;
      const compressedY =
        perspectiveY - directionY * alongNormal * foreshortening;
      const surfaceScale = clamp(1 - relief * curvature * 0.38, 0.88, 1.12);
      const residualSlopeX =
        (depthGradient.x - localSurface.gradientX) *
        (geometry.width / canvasWidth) *
        0.18 *
        depthConfidence;
      const residualSlopeY =
        (depthGradient.y - localSurface.gradientY) *
        (geometry.height / canvasHeight) *
        0.18 *
        depthConfidence;
      const pullX =
        -residualSlopeX * geometry.width * curvature * 0.018;
      const pullY =
        -residualSlopeY * geometry.height * curvature * 0.018;

      vertices.push({
        x:
          geometry.center.x +
          compressedX * surfaceScale +
          pullX,
        y:
          geometry.center.y +
          compressedY * surfaceScale +
          pullY,
      });
    }
  }

  const vertex = (column: number, row: number) =>
    vertices[row * (columns + 1) + column];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const sx0 = (column / columns) * tattoo.width;
      const sx1 = ((column + 1) / columns) * tattoo.width;
      const sy0 = (row / rows) * tattoo.height;
      const sy1 = ((row + 1) / rows) * tattoo.height;
      const p00 = vertex(column, row);
      const p10 = vertex(column + 1, row);
      const p01 = vertex(column, row + 1);
      const p11 = vertex(column + 1, row + 1);

      mapTriangle(
        target,
        tattoo,
        [
          { x: sx0, y: sy0 },
          { x: sx1, y: sy0 },
          { x: sx1, y: sy1 },
        ],
        [p00, p10, p11],
      );
      mapTriangle(
        target,
        tattoo,
        [
          { x: sx0, y: sy0 },
          { x: sx1, y: sy1 },
          { x: sx0, y: sy1 },
        ],
        [p00, p11, p01],
      );
    }
  }
};

const applySkinLighting = (
  tattooLayer: HTMLCanvasElement,
  body: HTMLImageElement,
  geometry: OverlayGeometry,
) => {
  const margin = Math.max(12, geometry.width * 0.22);
  const left = Math.max(
    0,
    Math.floor(Math.min(...geometry.corners.map((point) => point.x)) - margin),
  );
  const top = Math.max(
    0,
    Math.floor(Math.min(...geometry.corners.map((point) => point.y)) - margin),
  );
  const right = Math.min(
    tattooLayer.width,
    Math.ceil(Math.max(...geometry.corners.map((point) => point.x)) + margin),
  );
  const bottom = Math.min(
    tattooLayer.height,
    Math.ceil(Math.max(...geometry.corners.map((point) => point.y)) + margin),
  );
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  const bodyCanvas = createCanvas(width, height);
  const bodyContext = getContext(bodyCanvas);
  const sourceLeft = (left / tattooLayer.width) * body.width;
  const sourceTop = (top / tattooLayer.height) * body.height;
  const sourceWidth = (width / tattooLayer.width) * body.width;
  const sourceHeight = (height / tattooLayer.height) * body.height;
  bodyContext.drawImage(
    body,
    sourceLeft,
    sourceTop,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );
  const bodyPixels = bodyContext.getImageData(0, 0, width, height).data;
  const layerContext = getContext(tattooLayer);
  const layerImage = layerContext.getImageData(left, top, width, height);
  const layerPixels = layerImage.data;
  const luminance = new Float32Array(width * height);

  for (let index = 0; index < luminance.length; index += 1) {
    const offset = index * 4;
    luminance[index] =
      (bodyPixels[offset] * 0.2126 +
        bodyPixels[offset + 1] * 0.7152 +
        bodyPixels[offset + 2] * 0.0722) /
      255;
  }

  const radius = Math.max(2, Math.round(Math.min(width, height) / 220));
  const broadLight = boxBlur(luminance, width, height, radius);

  for (let index = 0; index < luminance.length; index += 1) {
    const offset = index * 4;
    if (layerPixels[offset + 3] === 0) continue;
    const localContrast = clamp(
      1 + (luminance[index] - broadLight[index]) * 1.35,
      0.78,
      1.22,
    );
    const colorLight = clamp(0.88 + broadLight[index] * 0.2, 0.88, 1.08);
    const alphaLight = clamp(
      1.08 - localContrast * 0.1 - broadLight[index] * 0.06,
      0.84,
      1.04,
    );

    layerPixels[offset] = Math.round(
      clamp((layerPixels[offset] / 255) * colorLight) * 255,
    );
    layerPixels[offset + 1] = Math.round(
      clamp((layerPixels[offset + 1] / 255) * colorLight) * 255,
    );
    layerPixels[offset + 2] = Math.round(
      clamp((layerPixels[offset + 2] / 255) * colorLight) * 255,
    );
    layerPixels[offset + 3] = Math.round(
      layerPixels[offset + 3] * alphaLight,
    );
  }

  layerContext.putImageData(layerImage, left, top);
};

const drawGuides = (
  context: CanvasRenderingContext2D,
  geometry: OverlayGeometry,
  scale: number,
) => {
  const handleRadius = 6 * scale;
  context.save();
  context.strokeStyle = "#f6f3ed";
  context.fillStyle = "#111211";
  context.lineWidth = Math.max(1.5, 1.4 * scale);
  context.setLineDash([6 * scale, 5 * scale]);
  context.beginPath();
  context.moveTo(geometry.corners[0].x, geometry.corners[0].y);
  geometry.corners.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  context.closePath();
  context.stroke();
  context.setLineDash([]);

  const topMiddle = {
    x: (geometry.corners[0].x + geometry.corners[1].x) / 2,
    y: (geometry.corners[0].y + geometry.corners[1].y) / 2,
  };
  context.beginPath();
  context.moveTo(topMiddle.x, topMiddle.y);
  context.lineTo(geometry.rotationHandle.x, geometry.rotationHandle.y);
  context.stroke();

  [...geometry.corners, geometry.rotationHandle].forEach((point, index) => {
    context.beginPath();
    context.arc(
      point.x,
      point.y,
      index === geometry.corners.length ? handleRadius * 1.18 : handleRadius,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.stroke();
  });
  context.restore();
};

export const createDepthPreview = (depth: DepthMap) => {
  const canvas = createCanvas(depth.width, depth.height);
  const context = getContext(canvas);
  const imageData = context.createImageData(depth.width, depth.height);
  const stops = [
    [10, 12, 18],
    [42, 55, 78],
    [61, 145, 154],
    [190, 205, 160],
    [239, 111, 75],
  ];

  for (let index = 0; index < depth.data.length; index += 1) {
    const value = clamp(depth.data[index]);
    const scaled = value * (stops.length - 1);
    const stopIndex = Math.min(stops.length - 2, Math.floor(scaled));
    const mix = scaled - stopIndex;
    const from = stops[stopIndex];
    const to = stops[stopIndex + 1];
    const offset = index * 4;
    imageData.data[offset] = Math.round(from[0] + (to[0] - from[0]) * mix);
    imageData.data[offset + 1] = Math.round(
      from[1] + (to[1] - from[1]) * mix,
    );
    imageData.data[offset + 2] = Math.round(
      from[2] + (to[2] - from[2]) * mix,
    );
    imageData.data[offset + 3] = 255;
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
};

export const renderScene = ({
  canvas,
  body,
  tattoo,
  depth,
  depthPreview,
  personMask,
  transform,
  clipAnchor,
  settings,
  showDepth,
  showPersonMask,
  showGuides,
}: {
  canvas: HTMLCanvasElement;
  body: HTMLImageElement;
  tattoo: HTMLCanvasElement | null;
  depth: DepthMap | null;
  depthPreview: HTMLCanvasElement | null;
  personMask: PersonMask | null;
  transform: TattooTransform;
  clipAnchor: { x: number; y: number };
  settings: RenderSettings;
  showDepth: boolean;
  showPersonMask: boolean;
  showGuides: boolean;
}) => {
  const context = getContext(canvas);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(body, 0, 0, canvas.width, canvas.height);

  if (showDepth && depthPreview) {
    context.save();
    context.globalAlpha = 0.76;
    context.globalCompositeOperation = "source-over";
    context.drawImage(depthPreview, 0, 0, canvas.width, canvas.height);
    context.restore();
  }

  if (showPersonMask && personMask) {
    const maskPreview = createCanvas(canvas.width, canvas.height);
    const maskContext = getContext(maskPreview);
    maskContext.fillStyle = "#cbff42";
    maskContext.fillRect(0, 0, canvas.width, canvas.height);
    maskContext.globalCompositeOperation = "destination-in";
    maskContext.drawImage(
      personMask.canvas,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    context.save();
    context.globalAlpha = 0.54;
    context.drawImage(maskPreview, 0, 0);
    context.restore();
    return;
  }

  // 변경: 자동 인물 마스크가 준비되기 전에는 배경 오합성을 막기 위해
  // 타투 레이어를 그리지 않는다.
  if (!tattoo || !personMask) {
    canvas.dataset.renderer = "none";
    return;
  }

  const layer = createCanvas(canvas.width, canvas.height);
  const layerContext = getContext(layer);
  const usedWebGLSurface = drawTattooWithWebGL(
    layerContext,
    canvas.width,
    canvas.height,
    body,
    tattoo,
    depth,
    personMask,
    transform,
    clipAnchor,
    settings.curvature,
    settings.opacity,
  );
  // 변경: 개발자 도구에서 실제 선택된 렌더러를 즉시 확인할 수 있다.
  canvas.dataset.renderer = usedWebGLSurface ? "webgl2" : "canvas";
  if (usedWebGLSurface) {
    // 변경: WebGL2 경로는 피부색과 색소 흡수까지 계산한 완성 픽셀이다.
    context.save();
    context.globalCompositeOperation = "source-over";
    context.drawImage(layer, 0, 0);
    context.restore();
  } else {
    // 변경: WebGL2를 사용할 수 없는 브라우저에서는 기존 Canvas 메시를 유지한다.
    drawWarpedTattoo(
      layerContext,
      canvas.width,
      canvas.height,
      tattoo,
      depth,
      personMask,
      transform,
      settings.curvature,
    );
    applySkinLighting(
      layer,
      body,
      getOverlayGeometry(canvas.width, canvas.height, tattoo, transform),
    );

    // 변경: Canvas 폴백에서도 인물 바깥쪽은 거리장으로 완전히 제거한다.
    const boundaryField = createBoundaryField(personMask);
    layerContext.save();
    layerContext.globalCompositeOperation = "destination-in";
    layerContext.drawImage(
      boundaryField.visibilityCanvas,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    layerContext.restore();

    const softenedLayer = createCanvas(canvas.width, canvas.height);
    const softenedContext = getContext(softenedLayer);
    softenedContext.filter = `blur(${Math.max(0.28, canvas.width / 4200)}px)`;
    softenedContext.drawImage(layer, 0, 0);
    softenedContext.filter = "none";

    context.save();
    context.globalAlpha = settings.opacity;
    context.globalCompositeOperation = "multiply";
    context.drawImage(softenedLayer, 0, 0);
    context.restore();

    context.save();
    context.globalAlpha = settings.opacity * 0.025;
    context.globalCompositeOperation = "source-over";
    context.drawImage(layer, 0, 0);
    context.restore();
  }

  if (showGuides) {
    const geometry = getOverlayGeometry(
      canvas.width,
      canvas.height,
      tattoo,
      transform,
    );
    drawGuides(context, geometry, canvas.width / 1100);
  }
};

export const pointInTattoo = (
  point: { x: number; y: number },
  geometry: OverlayGeometry,
  rotation: number,
) => {
  const translatedX = point.x - geometry.center.x;
  const translatedY = point.y - geometry.center.y;
  const local = rotatePoint(translatedX, translatedY, -rotation);
  return (
    Math.abs(local.x) <= geometry.width / 2 &&
    Math.abs(local.y) <= geometry.height / 2
  );
};

export const distance = (
  first: { x: number; y: number },
  second: { x: number; y: number },
) => Math.hypot(first.x - second.x, first.y - second.y);
