#!/usr/bin/env bash
# 배포 환경 스모크 체크.
#
# 각 서비스가 "떠 있는지"가 아니라 "nginx를 통해 바깥에서 도달 가능한지"를 본다.
# 컨테이너는 healthy 인데 프록시 경로나 인증서가 어긋나 있는 사고가 이 프로젝트에서
# 제일 흔하므로, 서버 안에서가 아니라 밖에서(로컬 PC에서) 돌리는 것을 전제로 한다.
#
# 사용법:
#   bash test/integration/smoke.sh                      # 기본 도메인
#   BASE=https://starttoo.duckdns.org bash test/integration/smoke.sh
#   BASE=http://localhost bash test/integration/smoke.sh # 로컬 compose

set -uo pipefail

BASE="${BASE:-https://i15d201.p.ssafy.io}"
STORAGE="${STORAGE:-https://starttoo-storage.duckdns.org}"
ALT="${ALT:-https://starttoo.duckdns.org}"

PASS=0
FAIL=0
WARN=0

green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }
yellow(){ printf '\033[33m%s\033[0m' "$1"; }

# check <설명> <기대 HTTP 코드> <URL> [curl 추가옵션...]
check() {
  local label="$1" expect="$2" url="$3"; shift 3
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$@" "$url" 2>/dev/null)
  if [ "$code" = "$expect" ]; then
    printf '  [%s] %-46s %s\n' "$(green OK)" "$label" "$code"
    PASS=$((PASS+1))
  else
    printf '  [%s] %-46s %s (기대 %s)  %s\n' "$(red FAIL)" "$label" "${code:-no-response}" "$expect" "$url"
    FAIL=$((FAIL+1))
  fi
}

# check_body <설명> <URL> <본문에 포함되어야 할 문자열>
check_body() {
  local label="$1" url="$2" needle="$3"; shift 3
  local body
  body=$(curl -s --max-time 20 "$@" "$url" 2>/dev/null)
  if printf '%s' "$body" | grep -q "$needle"; then
    printf '  [%s] %-46s %s\n' "$(green OK)" "$label" "$(printf '%s' "$body" | head -c 90)"
    PASS=$((PASS+1))
  else
    printf '  [%s] %-46s %s\n' "$(red FAIL)" "$label" "${body:-no-response}"
    printf '        %s\n' "$url"
    FAIL=$((FAIL+1))
  fi
}

warn_body() {
  local label="$1" url="$2" needle="$3"; shift 3
  local body
  body=$(curl -s --max-time 20 "$@" "$url" 2>/dev/null)
  if printf '%s' "$body" | grep -q "$needle"; then
    printf '  [%s] %-46s %s\n' "$(green OK)" "$label" "$(printf '%s' "$body" | head -c 90)"
    PASS=$((PASS+1))
  else
    printf '  [%s] %-46s %s\n' "$(yellow WARN)" "$label" "${body:-no-response}"
    WARN=$((WARN+1))
  fi
}

echo
echo "대상: $BASE"
echo "──────────────────────────────────────────────────────────────────────"

echo
echo "[1] nginx / TLS"
check "HTTP -> HTTPS 리다이렉트"        301 "${BASE/https:/http:}"
check "TLS 핸드셰이크 + 프론트 200"      200 "$BASE/"
check "보조 도메인 (duckdns)"            200 "$ALT/"

# 인증서 만료일. 갱신 자동화가 아직 없으므로 매번 눈으로 확인한다.
if command -v openssl >/dev/null 2>&1; then
  host="${BASE#https://}"; host="${host%%/*}"
  expiry=$(echo | openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null \
           | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  if [ -n "$expiry" ]; then
    printf '  [%s] %-46s %s\n' "$(green ' i')" "인증서 만료일" "$expiry"
  fi
fi

echo
echo "[2] backend (Spring Boot)"
check_body "actuator/health"             "$BASE/actuator/health" '"status":"UP"'

# 백엔드 가동 시간. 이걸 제일 먼저 봐야 한다.
#
# 배포는 컨테이너를 재생성하므로 그때마다 WebSocket 세션이 전부 끊기고 클라이언트가
# 5초 간격으로 재연결한다(정상 동작). 이걸 모르고 로그를 보면 "6초마다 재연결하는
# 무한 루프 버그"로 읽힌다 — 실제로 그렇게 오해해서 한참 헤맸다.
# 재생성되면 docker logs 의 이전 기록도 함께 사라져서 사후 확인도 안 된다.
# 그러니 방금 배포된 상태면 테스트 결과를 믿지 말고 안정화를 기다린다.
#
# /actuator/metrics/process.uptime 은 쓸 수 없다. SecurityConfig 가 /actuator/health/**
# 만 공개하고 metrics 는 인증을 요구한다(JVM 내부 정보라 그게 맞는 설정이다).
# 그래서 서버에 직접 물어본다. SSH_HOST 가 없으면 이 검사만 건너뛴다.
#   SSH_HOST=d201 bash test/integration/smoke.sh
if [ -n "${SSH_HOST:-}" ]; then
  started=$(ssh -o BatchMode=yes -o ConnectTimeout=8 "$SSH_HOST" \
            "docker inspect starttoo-backend --format '{{.State.StartedAt}}'" 2>/dev/null \
            | tr -d '\r' | cut -d. -f1)
  start_epoch=$(date -d "${started}Z" +%s 2>/dev/null)
  if [ -n "$start_epoch" ]; then
    mins=$(( ( $(date +%s) - start_epoch ) / 60 ))
    if [ "$mins" -lt 5 ]; then
      printf '  [%s] %-46s %s분 전 기동 — 결과 신뢰 불가, 5분 뒤 재실행 권장\n' \
             "$(yellow WARN)" "백엔드 가동 시간" "$mins"
      WARN=$((WARN+1))
    else
      printf '  [%s] %-46s %s분\n' "$(green OK)" "백엔드 가동 시간" "$mins"
      PASS=$((PASS+1))
    fi
  else
    printf '  [%s] %-46s %s\n' "$(yellow WARN)" "백엔드 가동 시간" "SSH 조회 실패"
    WARN=$((WARN+1))
  fi
else
  printf '  [ i] %-46s %s\n' "백엔드 가동 시간" "생략 — SSH_HOST=d201 지정 시 자동 확인"
fi
check      "actuator/health/readiness"   200 "$BASE/actuator/health/readiness"
check      "인증 필요 API -> 401"         401 "$BASE/v1/users/me"
# 미매핑 경로도 401 이 정답이다. Security 필터 체인이 URL 매핑보다 먼저 돌기 때문에
# 경로 존재 여부가 밖으로 새지 않는다. 여기서 404 나 500 이 나오면 필터 설정이 바뀐 것이다.
check      "미매핑 경로도 필터가 먼저 차단" 401 "$BASE/v1/__no_such_endpoint__"

echo
echo "[3] frontend (SPA)"
check      "SPA 딥링크 fallback"          200 "$BASE/nonexistent-route"
check_body "index.html 번들 참조"          "$BASE/" 'assets/'

echo
echo "[4] AI - 커버업 검색 엔진 (ai:8000, /ai-service/)"
# 도달 여부와 준비 상태를 분리한다. ai 컨테이너는 nginx 의 depends_on(service_healthy)
# 때문에 항상 떠 있으므로, 여기서 200 이 아니면 컨테이너가 아니라 프록시 설정 문제다.
# 500 = proxy_pass upstream 변수가 비었음, 502 = 컨테이너 죽음.
check      "/ai-service/health 도달"       200 "$BASE/ai-service/health"
warn_body  "커버업 인덱스 워밍업 완료"     "$BASE/ai-service/health" '"ready":true'

echo
echo "[5] MinIO (스토리지 공개 호스트)"
check      "minio health/live"            200 "$STORAGE/minio/health/live"
# S3 API 는 /minio/ 를 "minio 라는 버킷"으로 읽고 AccessDenied 403 을 낸다.
# 200 이 나오면 버킷이 공개로 열린 것이고, 404 면 프록시 대상이 콘솔로 바뀐 것이다.
check      "S3 루트 접근 거부"             403 "$STORAGE/minio/"

echo
echo "──────────────────────────────────────────────────────────────────────"
printf '  PASS %s   FAIL %s   WARN %s\n\n' "$(green "$PASS")" "$(red "$FAIL")" "$(yellow "$WARN")"

[ "$FAIL" -eq 0 ]
