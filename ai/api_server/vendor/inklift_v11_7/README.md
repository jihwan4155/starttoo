# INKLIFT V11.7 vendored runtime

이 폴더에는 `api_server`가 실제 추론에 사용하는 V11.7 코드와 모델
가중치만 포함되어 있습니다.

원본:

```text
tattoo_to_design/V11.7_Tattoo_Extractor_NoFlat_Portable_20260727
```

포함 범위:

- `web/backend`: 모델 런타임 및 후처리 코드
- `models/releases/.../scripts`: SegFormer 및 ROI 실행 코드
- `models/releases/.../weights`: 기본, 컬러, 웜블랙, ROI 가중치
- `models/releases/.../pretrained_segformer_b0`: SegFormer 로컬 베이스 모델
- `models/segmentation/.../best_model.pt`: 레드 잉크 전문 모델

학습 자료, 원본 웹 프론트엔드, 샘플과 리포트는 API 실행에 필요하지
않으므로 포함하지 않았습니다.
