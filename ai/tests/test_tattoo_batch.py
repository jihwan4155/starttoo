"""
게시물 이미지 배치 분석(/v1/tattoos/analyze-batch) 계약 검증.
무거운 모델을 띄우지 않고 추출·분류 서비스를 가짜로 주입해 라우트 로직만 확인한다.

확인 항목
  · 결과 배열 길이가 요청 이미지 수와 항상 같다 (백엔드가 인덱스로 매칭한다)
  · 타투/비타투/개별 실패가 TATTOO·NOT_TATTOO·FAILED 로 구분된다
  · 한 장의 실패가 나머지 장의 결과를 망치지 않는다
  · 응답 필드가 camelCase 별칭으로 직렬화된다
  · 추론 슬롯 점유 같은 서버 차원 오류는 항목별 FAILED 가 아니라 503 이다
  · 백엔드용 /v1 경로와 문서용 /api/v1 경로 모두에 매달려 있다
"""

from __future__ import annotations

import dataclasses
import io
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

OK, FAIL = "  [OK]", "  [FAIL]"
_fails: list[str] = []

TATTOO_URL = "https://minio.test/tattoo.png"
PLAIN_URL = "https://minio.test/plain.png"
BROKEN_URL = "https://minio.test/broken.png"


def check(cond: bool, msg: str) -> None:
    print((OK if cond else FAIL), msg)
    if not cond:
        _fails.append(msg)


def _png_bytes(color: tuple[int, int, int]) -> bytes:
    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (32, 32), color).save(buffer, format="PNG")
    return buffer.getvalue()


@dataclass(frozen=True)
class _Prediction:
    label: str
    confidence: float = 0.9


@dataclass(frozen=True)
class _Extracted:
    content: bytes
    predicted_ratio: float


class FakeExtractor:
    """타투로 볼 URL 만 높은 predicted_ratio 를 준다."""

    max_upload_bytes = 20 * 1024 * 1024
    status = "ready"
    message = "fake"
    device = "cpu"

    def __init__(self, tattoo_payload: bytes, busy: bool = False) -> None:
        self.tattoo_payload = tattoo_payload
        self.busy = busy
        self.ratio_by_payload: dict[bytes, float] = {}

    def ensure_ready(self) -> None:
        return None

    async def load(self) -> None:
        return None

    async def extract(self, raw: bytes, output: str = "transparent") -> _Extracted:
        if self.busy:
            from api_server.core.exceptions import InferenceBusyError

            raise InferenceBusyError("추론 슬롯 사용 중")
        ratio = self.ratio_by_payload.get(raw, 0.0)
        return _Extracted(content=self.tattoo_payload, predicted_ratio=ratio)


class FakeClassifier:
    status = "ready"
    message = "fake"
    device = "cpu"

    def __init__(self) -> None:
        self.calls = 0

    def ensure_configured(self) -> None:
        return None

    async def load(self) -> None:
        return None

    async def classify(self, raw: bytes, segmented: bytes):
        self.calls += 1
        return type(
            "Result",
            (),
            {
                "primary": _Prediction("minimal"),
                "secondary": _Prediction("none"),
                "color": _Prediction("black_only"),
                "rendering": _Prediction("fine_line"),
                "renderings": [_Prediction("fine_line")],
                "subject": _Prediction("장미"),
                "processing_seconds": 0.01,
            },
        )()


def _build(busy: bool = False):
    from api_server.api.routes import tattoos
    from api_server.core.config import Settings, get_settings
    from api_server.main import create_app

    get_settings.cache_clear()
    settings = dataclasses.replace(
        Settings.from_env(),
        model_load_on_startup=False,
        generator_load_on_startup=False,
        classifier_load_on_startup=False,
    )

    # 색을 달리해 URL 별로 실제로 다른 바이트열이 나오게 한다. 같은 바이트열이면
    # dict 조회가 값 동등성으로 맞아 버려서 타투/비타투 구분이 무의미해진다.
    tattoo_raw = _png_bytes((10, 20, 30))
    plain_raw = _png_bytes((200, 210, 220))
    extractor = FakeExtractor(tattoo_raw, busy=busy)
    extractor.ratio_by_payload[tattoo_raw] = 0.5
    extractor.ratio_by_payload[plain_raw] = 0.0

    async def fake_download(image_url: str, max_bytes: int) -> bytes:
        if image_url == BROKEN_URL:
            from fastapi import HTTPException

            raise HTTPException(status_code=400, detail="Image URL could not be downloaded.")
        if image_url == TATTOO_URL:
            return tattoo_raw
        return plain_raw

    original_download = tattoos._download_image
    tattoos._download_image = fake_download

    classifier = FakeClassifier()
    app = create_app(
        settings=settings,
        extractor_service=extractor,
        classifier_service=classifier,
        event_log=None,
    )
    return app, classifier, (tattoos, original_download)


def main() -> int:
    from fastapi.testclient import TestClient

    print("배치 분석 계약")
    app, classifier, (module, original_download) = _build()
    try:
        with TestClient(app) as client:
            response = client.post(
                "/v1/tattoos/analyze-batch",
                json={"imageUrls": [TATTOO_URL, PLAIN_URL, BROKEN_URL]},
            )
            check(response.status_code == 200, f"200 응답 (실제 {response.status_code})")
            body = response.json()
            results = body.get("results", [])
            check(
                len(results) == 3,
                f"결과 배열 길이가 요청 이미지 수와 같다 (실제 {len(results)})",
            )
            statuses = [item.get("status") for item in results]
            check(
                statuses == ["TATTOO", "NOT_TATTOO", "FAILED"],
                f"상태가 순서대로 구분된다 (실제 {statuses})",
            )
            check(
                results[2].get("analysis") is None,
                "실패한 항목의 analysis 는 null",
            )
            check(
                "errorMessage" not in results[2],
                "실패 메시지는 응답에 실리지 않는다",
            )
            analysis = results[0].get("analysis") or {}
            check(
                analysis.get("primaryStyleCode") == "minimal",
                f"primaryStyleCode camelCase 직렬화 (실제 {analysis.get('primaryStyleCode')})",
            )
            check(
                analysis.get("renderingStyleCodes") == ["fine_line"],
                f"renderingStyleCodes 직렬화 (실제 {analysis.get('renderingStyleCodes')})",
            )
            check(
                analysis.get("colorCode") == "black_only",
                f"colorCode 직렬화 (실제 {analysis.get('colorCode')})",
            )
            check(analysis.get("subjects") == ["장미"], "subjects 직렬화")
            check(
                classifier.calls == 1,
                f"비타투·실패 이미지는 분류를 돌리지 않는다 (실제 {classifier.calls}회)",
            )

            documented = client.post(
                "/api/v1/tattoos/analyze-batch",
                json={"imageUrls": [PLAIN_URL]},
            )
            check(
                documented.status_code == 200,
                f"/api/v1 경로도 살아 있다 (실제 {documented.status_code})",
            )
    finally:
        module._download_image = original_download

    print("서버 차원 오류는 항목별 실패로 감추지 않는다")
    app_busy, _, (module_busy, original_busy) = _build(busy=True)
    try:
        with TestClient(app_busy, raise_server_exceptions=False) as client:
            response = client.post(
                "/v1/tattoos/analyze-batch",
                json={"imageUrls": [TATTOO_URL, PLAIN_URL]},
            )
            check(
                response.status_code == 503,
                f"추론 슬롯 점유는 503 (실제 {response.status_code})",
            )
    finally:
        module_busy._download_image = original_busy

    print()
    if _fails:
        print(f"실패 {len(_fails)}건")
        for item in _fails:
            print("  -", item)
        return 1
    print("전부 통과")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
