import {
  buildPersonMaskDataCurrent,
  buildPersonMaskDataFixed,
} from "./algorithm.mjs";

// 64x64 합성 마스크 시나리오:
//  - 사람: 중심(32,32) 반경22 원, score=0.95
//  - 흉터: 사람 원 "안쪽"에 완전히 둘러싸인 작은 원(중심 32,20 반경4), score=0.1
//    -> MediaPipe가 흉터를 배경으로 오탐한 상황을 흉내낸 것
//  - 다리 사이 틈: 사람 원 안쪽에서 시작해 이미지 아래쪽 테두리까지 뚫린
//    좁은 통로(x:30-34, y:40-63), score=0.05
//    -> 진짜 배경(다리 사이처럼 테두리와 연결된 오목한 부분)을 흉내낸 것.
//       이건 절대 메워지면 안 됨.
//  - 나머지: 배경, score=0.05
const WIDTH = 64;
const HEIGHT = 64;
const scores = new Float32Array(WIDTH * HEIGHT);

const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;

for (let y = 0; y < HEIGHT; y += 1) {
  for (let x = 0; x < WIDTH; x += 1) {
    const index = y * WIDTH + x;
    let score = 0.05; // 배경 기본값

    if (inCircle(x, y, 32, 32, 22)) score = 0.95; // 사람
    if (inCircle(x, y, 32, 20, 4)) score = 0.1; // 흉터 (사람 안쪽 섬)
    if (x >= 30 && x <= 34 && y >= 40 && y <= 63) score = 0.05; // 다리 사이 틈(테두리 연결)

    scores[index] = score;
  }
}

const currentMask = buildPersonMaskDataCurrent(scores, WIDTH, HEIGHT);
const fixedMask = buildPersonMaskDataFixed(scores, WIDTH, HEIGHT);

const at = (mask, x, y) => mask[y * WIDTH + x];

const cases = [
  {
    name: "흉터 중심 (사람 안쪽에 둘러싸인 섬)",
    x: 32,
    y: 20,
    expectCurrent: "low",
    expectFixed: "high",
  },
  {
    name: "정상 피부 중심",
    x: 32,
    y: 32,
    expectCurrent: "high",
    expectFixed: "high",
  },
  {
    name: "다리 사이 틈 (테두리와 연결된 진짜 배경)",
    x: 32,
    y: 45,
    expectCurrent: "low",
    expectFixed: "low",
  },
  {
    name: "사진 바깥 배경",
    x: 5,
    y: 5,
    expectCurrent: "low",
    expectFixed: "low",
  },
];

const LOW_MAX = 0.2;
const HIGH_MIN = 0.8;

let allPassed = true;

for (const testCase of cases) {
  const currentValue = at(currentMask, testCase.x, testCase.y);
  const fixedValue = at(fixedMask, testCase.x, testCase.y);

  const check = (value, expect) =>
    expect === "low" ? value <= LOW_MAX : value >= HIGH_MIN;

  const currentPass = check(currentValue, testCase.expectCurrent);
  const fixedPass = check(fixedValue, testCase.expectFixed);
  const passed = currentPass && fixedPass;
  allPassed = allPassed && passed;

  console.log(
    `${passed ? "PASS" : "FAIL"}  ${testCase.name}\n` +
      `  현재 코드   : ${currentValue.toFixed(3)} (기대: ${testCase.expectCurrent}) ${currentPass ? "OK" : "MISMATCH"}\n` +
      `  수정판      : ${fixedValue.toFixed(3)} (기대: ${testCase.expectFixed}) ${fixedPass ? "OK" : "MISMATCH"}`,
  );
}

console.log("\n" + (allPassed ? "모든 케이스 통과" : "일부 케이스 실패"));
process.exit(allPassed ? 0 : 1);
