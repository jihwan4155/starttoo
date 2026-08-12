# 팀 Git & GitLab 컨벤션

> 기존 README에 있던 팀 컨벤션 문서입니다.

## 1. 태그 목록
- `init`: 가장 처음 Initial Commit
- `feat`: 새로운 기능 구현
- `fix`: 버그나 오류 해결
- `docs`: README, 템플릿 등 문서 수정
- `setting`: 프로젝트 관련 설정 변경
- `add`: 사진/에셋, 라이브러리 추가
- `refactor`: 기존 코드 리팩토링 및 구조 수정
- `chore`: 기타 경미한 수정

---

## 2. 커밋 컨벤션
- **포맷**: `이슈번호 [파트] 태그: 제목` (예: `S15P11D201-91 [FE] feat: 로그인 기능 구현`)
- **이슈 번호**: Jira 이슈 키 필수 작성 (예: `S15P11D201-91`)
- **파트 구분**: `[FE]`, `[BE]`, `[AI]` (대문자)
- **태그**: 소문자 작성 (`feat`, `fix`, `docs`, `refactor` 등)
- **제목**: 한글 명령조, 50자 이내 작성

### 📌 Jira 이슈 자동 완료 (Merge 시)
- **GitLab/GitHub 기본 방식**: MR 설명란 또는 커밋 본문에 `Closes 이슈번호` 작성
  - 예시: `Closes S15P11D201-91`

---

## 3. 브랜치 컨벤션
- **포맷**: `파트/태그/기능-이름` (예: `FE/feat/login-ui`, `BE/setting/gitignore`)
- **파트 명시**: `FE`, `BE`, `AI` (대문자 사용)
- **태그 및 기능명**: 소문자 및 하이픈(`-`) 사용

---

## 🌿 브랜치 전략 (Branch Strategy)
- **`master`**: 최종 배포 및 검증용 완성본 브랜치
- **`dev`**: 팀원들의 작업이 1차 통합 및 테스트되는 **기본(Default) 브랜치**
- **`[파트]feat/기능명`**: 개별 기능 개발 브랜치

### ⚙️ 작업 워크플로우
1. 작업 시작 시 항상 `dev` 브랜치를 기준으로 새 브랜치를 생성합니다.
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b FE/feat/login-ui
   ```
