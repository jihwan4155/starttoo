# Tattoo Generator SD1.5 model assets

이 폴더에는 타투 도안 생성 API의 커스텀 LoRA를 둡니다. 실제 실행 로직은
`api_server/services/tattoo_generator.py`에 있습니다.

- `pytorch_lora_weights.safetensors`: SD1.5용 타투 스타일 LoRA
- `models/stable-diffusion-v1-5/`: 최초 생성 요청에서 자동 다운로드되는 공개 모델

공개 베이스 모델은 `stable-diffusion-v1-5/stable-diffusion-v1-5`에서
이 폴더 아래로 내려받습니다. 다운로드가 끝나면 서버는 로컬 파일만 읽습니다.
