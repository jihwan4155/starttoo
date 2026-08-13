![starttoo 배너](docs/images/banner.gif)


<img src="docs/images/logo.png" width="100" valign="middle" /> starttoo


> AI 도안 생성부터 AR/3D 시뮬레이션, 커버업 추천, 타투이스트 매칭까지. 
> 타투를 새기기로 결심한 순간부터 실제로 새기는 순간까지 전 과정을 하나로 연결하는 플랫폼

<!-- 한 줄 소개는 팀에서 확정한 문구로 교체하세요 -->

- **서비스 URL**: https://stattoo.duckdns.org
- **서비스 소개 영상**: https://youtu.be/6rRotlTOfq4
- **개발 기간**: 2026.07 ~ 2026.08 (SSAFY 15기 공통 프로젝트)

---

## 👥 Team (D201 백두산 호랑이)

<!-- 사진: docs/images/member-이름.png (권장 비율 3:4, width로 크기 조절) -->

| 팀장 | 팀원1 | 팀원2 |
| :---: | :---: | :---: |
| 신지환 | 박범준 | 이한준 |
| `AI/INFRA` | `BE` | `AI` |

| 팀원3 | 팀원4 | 팀원5 |
| :---: | :---: | :---: |
| 양혜림 | 심재훈 | 이효주 |
| `FE`| `FE` | `FE` |


---

## 💡 기획 배경

2027년 10월 문신 시술 합법화 시행을 앞두고 국내 타투 시장은 성장 국면에 진입한다. 그러나 시장 규모의 확대에 비해 이를 뒷받침할 디지털 인프라는 사실상 부재한 상태다.

타투 특성상, 한번 하면 평생 남기에 시술 전 확신이 필요하다. 하지만 현재는 결과를 미리 확인할 방법이 없다. 실제로 타투 미보유자 대상 설문에서 **평생 남는 것에 대한 두려움(79.1%)**, **자신의 몸에 어울릴지에 대한 불확실성(41.9%)**, **디자인 선택의 어려움(41.9%)**이 주요 진입 장벽으로 나타났다. 수요는 존재하나 불확실성이 실제 시술을 가로막고 있는 것이다.

이미 타투를 보유한 사용자도 사정은 다르지 않다. 예약·상담 채널은 **인스타그램 DM(72.7%)**, **카카오톡(45.5%)**, **전화·방문(27.3%)**으로 파편화되어 있어, 도안 탐색부터 상담과 예약까지 전 과정이 개인 SNS와 메신저에 흩어져 있다. 이를 통합할 전용 플랫폼이 없다는 뜻이다.

결국 두 집단의 문제는 **"시술 전에 확인할 방법이 없다"**와 **"한곳에서 해결할 곳이 없다"**로 수렴한다. 이에 생성형 AI·시뮬레이션·이미지 벡터 검색 기술을 결합해 AI 도안 생성부터 시뮬레이션, 커버업 추천, 도안 추출, 공유까지 하나의 흐름으로 묶은 **타투 올인원 서비스**를 기획했다.

> 설문조사 기간: 2026.07.13 ~ 07.15 / 총 128명(타투 보유자 11명) 대상

---

## ✨ 주요 기능

### 1. AI 타투 도안 생성

> 한국어 프롬프트를 번역·보강해 원하는 스타일의 타투 도안을 생성

| 프롬프트 입력 | 생성 결과 |
| :---: | :---: |
| <img src="docs/images/ai-prompt.png" width="240" /> | <img src="docs/images/ai-result.png" width="240" /> |

### 2. AR 시뮬레이션

> 카메라로 내 몸에 타투를 실시간으로 얹어보고, 인물 분할 기반 마스크로 자연스럽게 합성

| 소개 화면 | QR 연결 전 | QR 연결 후 | AR 결과 |
| :---: | :---: | :---: | :---: |
| <img src="docs/images/ar-intro.png" width="240" /> | <img src="docs/images/ar-qr1.png" width="240" /> | <img src="docs/images/ar-qr2.png" width="240" /> | <img src="docs/images/ar-after.png" width="240" /> |

<!-- 짧은 시연은 mp4/GIF로: ![AR 시연](docs/videos/ar-demo.mp4) -->

### 3. 3D 이미지 시뮬레이션

> 신체 사진을 올려 도안을 얹고, 몸의 굴곡을 따라 휘어진 모습으로 합성

| 신체 사진 선택 | 도안 선택 | 도안 정리 | 도안 합성 |
| :---: | :---: | :---: | :---: |
| <img src="docs/images/3d_select_body.png" width="240" /> | <img src="docs/images/3d_select_tattoo1.png" width="240" /> | <img src="docs/images/3d_select_tattoo2.png" width="240" /> | <img src="docs/images/3d_after.png" width="240" /> |

![커버업과 3D 시뮬레이션](docs/images/3dsimulation.gif)

### 4. 커버업 도안 추천

> 기존 타투 사진 위에 직접 그려보고, 커버업 도안을 미리 확인

| 기존 타투 | 드로잉 | 커버업 결과 |
| :---: | :---: | :---: |
| <img src="docs/images/coverup_before.png" width="200" /> | <img src="docs/images/coverup_drawing.png" width="200" /> | <img src="docs/images/coverup_after.png" width="200" /> |

![커버업과 3D 시뮬레이션](docs/images/coverup_and_3d_simul.gif)

### 5. 탐색 & 피드 & DM & 타투이스트 페이지

> 포트폴리오 탐색, 게시글·검색, 타투이스트와 1:1 실시간 상담

| 피드 | 탐색 | 메시지 |
| :---: | :---: | :---: |
| <img src="docs/images/피드.png" width="200" /> | <img src="docs/images/탐색.png" width="200" /> | <img src="docs/images/메시지.png" width="200" /> |

![피드: 추천, 검색](docs/images/feed.gif)

<!-- 기능 개수·이름은 실제 서비스에 맞게 조정 -->

---

## 🛠 기술 스택

### Frontend
`React 19` `TypeScript` `Vite` `Tailwind CSS 4` `Zustand` `TanStack Query` `MediaPipe` `Transformers.js` `OpenCV.js` `STOMP`

### Backend
`Java 21` `Spring Boot` `Spring Security (OAuth2)` `JPA` `MySQL` `Redis` `WebSocket` `MinIO` `Firebase FCM`

### AI
`Python` `FastAPI` `PyTorch` `Diffusers` `Transformers` `Gemini API`

### Infra
`Docker` `Docker Compose` `Jenkins` `Nginx` `GitLab` `Jira`

<!-- 버전/항목은 실제 사용 기준으로 다듬기 -->

---

## 🏗 아키텍처

![시스템 아키텍처](docs/images/architecture.png)

<!-- draw.io 등으로 그린 아키텍처 다이어그램 -->

---

## ERD
![erd](docs/images/erd.png)

## 📄 산출물

| 구분 | 링크 |
| :--- | :--- |
| 기획/요구사항 | https://brief-vase-0fa.notion.site/39cb65bd273280c28e32f5d204fc897c |
| 화면 설계 (Figma) | https://www.figma.com/design/lD3bqI5XAELh9rtrzzViLx/starttoo-%EC%99%80%EC%9D%B4%EC%96%B4%ED%94%84%EB%A0%88%EC%9E%84?node-id=0-1&t=7weNZHSoUT14mlQs-1|
| API 명세 | https://brief-vase-0fa.notion.site/API_-3a4b65bd2732805bbe93cf1a066ba523?source=copy_link |
| 팀 컨벤션 | [docs/CONVENTIONS.md](docs/CONVENTIONS.md) |
