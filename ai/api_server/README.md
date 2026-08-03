# Tattoo AI FastAPI Server

INKLIFT V11.7 No-Flat 추출 모델과 Stable Diffusion 1.5 타투 생성 모델을 제공하는
API입니다. API가 사용하는 모델과 커스텀 런타임 코드는 모두
`api_server` 안에 포함되어 있습니다.

## 제공 API

- `GET /`: 서버 정보
- `GET /health`: 모델 로딩 상태와 실행 장치 확인
- `POST /api/v1/extract`: 타투 사진에서 PNG 도안 추출
- `GET /api/v1/generate/styles`: 사용 가능한 생성 스타일 조회
- `POST /api/v1/generate`: 프롬프트와 스타일로 PNG 도안 생성
- `POST /api/v1/classify`: 이미지에서 5개 타투 속성 라벨 추론
- `GET /demo`: 이미지 업로드와 결과 확인용 테스트 화면
- `GET /api/v1/logs`: 최근 요청 및 추론 이벤트 JSON 로그
- `GET /docs`: Swagger UI
- `GET /redoc`: ReDoc

서버가 시작되면 V11.7 모델을 백그라운드에서 한 번만 로드합니다.
`GET /health`의 `pipeline_status`가 `ready`가 된 후 추론을 요청할 수
있습니다. 같은 GPU에서 여러 요청이 동시에 실행되지 않도록 추론은
한 건씩 처리됩니다.

Stable Diffusion 1.5 생성 모델은 기본값에서는 첫 생성 요청 때
한 번만 로드합니다. 이후 요청은 이미 로드된 모델을 재사용합니다.
추출과 생성은 같은 GPU 작업 잠금을 사용하므로 동시에 실행되지 않습니다.
GPU가 이미 작업 중이면 뒤 요청을 계속 대기시키지 않고 HTTP 503과
`AI_SERVER_BUSY`를 반환합니다. 응답의 `Retry-After` 값 이후 재시도하면 됩니다.

## 설치

프로젝트 루트에서 실행합니다.

```powershell
envs\classification\Scripts\python.exe -m pip install -r api_server\requirements.txt
```

필요하면 `.env.example`을 `.env`로 복사하고 값을 변경합니다. `.env`가
없으면 `api_server/vendor` 안의 추출·생성 모델을 자동으로 사용합니다.
서버 코드는 `api_server/tattoo_create_model`을 import하거나 참조하지
않으므로 해당 원본 전달 폴더를 삭제해도 동작합니다.

### 공개 모델 자동 다운로드

배포 ZIP에는 팀에서 학습한 체크포인트와 LoRA만 포함됩니다. 아래 공개
모델은 파일이 없을 경우 해당 API의 첫 요청에서 Hugging Face로부터
`api_server/vendor` 아래에 자동 다운로드됩니다.

- 생성: `stable-diffusion-v1-5/stable-diffusion-v1-5`
- subject 분류: `google/siglip2-so400m-patch16-384`

첫 생성·분류 요청에는 수 GB 다운로드 시간이 추가됩니다. 다운로드 중에는
서버를 종료하지 말고 인터넷 연결과 디스크 여유 공간을 유지해야 합니다.

팀 전달용 ZIP에는 대형 공개 모델이 들어 있지 않습니다. 압축을 푼 뒤 서버를
처음 실행하기 전에 다음 명령으로 두 모델을 직접 설치하는 방식을 권장합니다.

```powershell
python -m pip install -r api_server\requirements.txt
python -m api_server.download_models
```

한 모델만 설치하려면 마지막에 `generator` 또는 `classifier`를 지정합니다.

```powershell
python -m api_server.download_models generator
python -m api_server.download_models classifier
```

수동 설치를 생략해도 관련 API의 첫 요청에서 같은 다운로드가 자동 실행됩니다.

## 실행

```powershell
envs\classification\Scripts\python.exe -m api_server
```

실행 후 다음 주소를 확인합니다.

```text
http://127.0.0.1:8000/health
http://127.0.0.1:8000/demo
http://127.0.0.1:8000/docs
```

## 투명 PNG 추출

```powershell
curl.exe -X POST "http://127.0.0.1:8000/api/v1/extract" `
  -F "file=@sample.jpg" `
  --output tattoo_transparent.png
```

기본 출력은 배경이 투명한 RGBA PNG입니다. `output` 쿼리 매개변수로
다음 결과를 선택할 수 있습니다.

- `transparent`: 투명 배경 도안
- `white`: 흰 배경 도안
- `mask`: 최종 이진 마스크
- `alpha`: 투명도 맵

예를 들어 흰 배경 도안은 다음과 같이 요청합니다.

```powershell
curl.exe -X POST "http://127.0.0.1:8000/api/v1/extract?output=white" `
  -F "file=@sample.jpg" `
  --output tattoo_white.png
```

응답 헤더에는 처리 시간, 원본 크기, 리사이즈 여부, 추출 영역 비율이
함께 포함됩니다.

## 프롬프트 기반 도안 생성

스타일 목록을 먼저 확인할 수 있습니다.

```powershell
curl.exe "http://127.0.0.1:8000/api/v1/generate/styles"
```

프롬프트만 사용하거나 `style`에 최대 2개를 지정합니다.

지원 스타일은 `realism`, `minimal`, `geometric_ornamental`, `lettering`,
`graphic_illustrative`, `new_school`, `tribal_indigenous`,
`western_traditional`, `japanese`, `abstract_experimental`입니다.

```powershell
curl.exe -X POST "http://127.0.0.1:8000/api/v1/generate" `
  -H "Content-Type: application/json" `
  -d '{"prompt":"a koi fish and cherry blossoms","style":["japanese"],"seed":42}' `
  --output generated_tattoo.png
```

성공 응답 본문은 `image/png` 바이너리이며, 생성 시드·처리 시간·크기·
스타일은 `X-Generation-Seed`, `X-Processing-Seconds`, `X-Image-Width`,
`X-Image-Height`, `X-Generation-Styles` 응답 헤더로 전달됩니다.

기본 생성값은 `1024×1024`, 30 step입니다. Stable Diffusion 1.5는
CPU offload를 사용하므로 첫 요청에는 모델 로딩 시간이 추가되고, 생성
시간은 검증용 저해상도·저 step 요청보다 길어집니다.

Swagger의 요청 예시도 운영 기본값과 동일하게 `1024×1024`, 30 step으로
설정되어 있습니다. 생성이 완료되면 Swagger 응답 영역에서 PNG를 직접
그리는 대신 파일 다운로드로 제공합니다.

## 타투 이미지 5축 분류

`POST /api/v1/classify`에 JPG, PNG 또는 WEBP 이미지를 업로드하면 다음
다섯 결과를 JSON으로 반환합니다.

- `primary`: 대표 타투 스타일
- `secondary`: primary에 속한 세부 스타일 (`minimal`처럼 세부 분류가
  없는 경우 `none`)
- `color`: 색상 사용 유형
- `rendering`: 가장 높은 렌더링 기법
- `subject`: 이미지가 묘사하는 대상

primary, secondary, color, rendering은 ConvNeXtV2 specialist system을
사용하며 subject는 `google/siglip2-so400m-patch16-384`를 사용합니다.
불투명한 원본 이미지는 먼저 V11.7 추출기로 배경을 제거한 뒤 원본·도안
쌍으로 분류합니다. 첫 요청 때만 분류 모델을 로드합니다.

```json
{
  "requestId": "d15d45b9575d4f25a20f0c8d5b4ccafa",
  "processingSeconds": 12.431,
  "primary": {"label": "japanese", "confidence": 0.91},
  "secondary": {"label": "traditional_irezumi", "confidence": 0.84},
  "color": {"label": "full_color", "confidence": 0.96},
  "rendering": {"label": "linework", "confidence": 0.79},
  "subject": {"label": "잉어", "confidence": 0.88}
}
```

`subject.label`은 한글 라벨로 반환됩니다.

분류에 필요한 전용 체크포인트와 taxonomy는
`api_server/vendor/tattoo_classifier_v3` 안에 포함됩니다. 공개 SigLIP2
파일은 폴더에 없을 경우 첫 분류 요청에서 같은 폴더로 자동 다운로드됩니다.
