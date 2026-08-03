# Tattoo Classifier V3 Bundle

이 폴더는 `POST /api/v1/classify`가 사용하는 모든 모델 자산을 포함합니다.

- `checkpoints/encoder.pt`: tattoo-domain ConvNeXtV2 encoder
- `checkpoints/primary.pt`: primary specialist
- `checkpoints/secondary.pt`: hierarchical secondary specialist
- `checkpoints/color.pt`: color specialist
- `checkpoints/rendering.pt`: rendering MIL specialist
- `taxonomy.json`: 네 축 분류 taxonomy
- `subject_taxonomy.json`: SigLIP2 zero-shot subject 후보
- `siglip2-so400m-patch16-384/`: 고정 revision의 로컬 Hugging Face 모델
- `bundle.json`: API용 상대 경로 manifest

SigLIP2 파일이 없으면 런타임이 Hugging Face에서 이 폴더 아래로 자동
다운로드합니다. 다운로드 후에는 `local_files_only=True`로 읽으며 외부 모델 경로나
Hugging Face 네트워크를 사용하지 않습니다.
