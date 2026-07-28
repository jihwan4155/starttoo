# API 구현 현황

| 영역 | 상태 | 비고 |
|---|---|---|
| Auth | 구현 | Kakao/Google code 교환, 가입, JWT 재발급, 로그아웃, 탈퇴 |
| Users | 구현 | 기본 정보 수정, 공용 기본 프로필, 프로필 이미지 PUT/DELETE, 기기, 팔로우, 검색어, 차단, 취향, 컬렉션 |
| Artists | 구현 | 도시+닉네임 동시 검색, 인기/일치도 정렬, 프로필 수정 |
| AI Generation | 501 계약 | FastAPI/모델 연결 필요 |
| Coverup | 501 계약 | FastAPI/모델 연결 필요 |
| Archive | 구현 | 저장/해제와 목록 |
| Tattoos | 조회 구현 | rendering 응답 포함, 도안 재생성은 501 계약 |
| Simulation | 부분 구현 | AR 세션/QR/WebRTC 시그널 구현, 합성은 501 |
| Posts | 구현 | 검색 임베딩만 501 |
| Comments | 구현 | previewReplies 없이 replyCount만 반환, 루트 삭제 시 직속 답글 소프트 삭제 |
| DM | 구현 | REST, 나가기 숨김 경계, 새 메시지 재활성화, 방별 알림 끄기 |
| Notifications | 구현 | 유형별 미확인 수, Top 10, DM 방별 그룹 전체 목록, 읽음 처리 |
| Push | 연결 대기 | FCM 포트와 커밋 후 호출 구현, 현재 어댑터는 로그만 기록 |
| Uploads | 501 계약 | MinIO 어댑터 구현 필요 |
| Admin | 구현 | 신고 목록·일괄 처리, 미학습 이미지, 타투이스트 승인 상태 변경, 처리 결과 SYSTEM 알림 |

Swagger UI: `http://localhost:8080/v1/swagger-ui.html`

모든 Operation에는 간결한 핵심 규칙·트랜잭션·주요 오류 설명이 적용된다. JSON 본문을 반환하는 2xx 응답에는 스키마 기반 성공 예시를 자동으로 추가한다. 새 API를 추가하면 `DetailedOpenApiCustomizer`의 경로 문서와 문서화 회귀 테스트 개수도 함께 갱신한다.
