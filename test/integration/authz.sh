#!/usr/bin/env bash
# 인가(권한) 경계 검증 — "남의 것을 건드리면 막히는가".
#
# 지금까지의 테스트는 전부 "내 계정으로 내 것을 다루는" 정상 경로였다. 여기서는 그 반대만
# 본다. 코드에 FORBIDDEN 검사가 있고 단위 테스트도 일부 있지만, 실제 배포 환경에서 HTTP 로
# 확인한 적은 없다. 시큐리티 설정이나 라우팅에서 구멍이 나는 건 단위 테스트가 잡지 못한다.
#
# 사용법:
#   TOKEN_A=<A계정토큰> TOKEN_B=<B계정토큰> WRITE=1 bash test/integration/authz.sh
#
# WRITE=1 이 필요한 이유: 공격 대상이 될 게시물을 A 계정으로 하나 만든다. 실제 사용자
# 게시물을 대상으로 삼으면, 권한 검사에 구멍이 있을 때 진짜 데이터가 지워진다.
# 만들어진 게시물은 끝에서 지운다.
#
# 판정 기준은 "정확히 403" 이 아니라 "성공하면 안 된다" 이다. 404 로 존재 자체를 감추는
# 것도 올바른 구현이므로 401/403/404 를 모두 통과로 본다. 반대로 5xx 는 검사에서 걸러진
# 것이 아니라 처리 중 터진 것이므로 통과로 보지 않는다.

set -uo pipefail

BASE="${BASE:-https://i15d201.p.ssafy.io}"
API="$BASE/v1"
TOKEN_A="${TOKEN_A:-}"
TOKEN_B="${TOKEN_B:-}"

PASS=0; FAIL=0; SKIP=0; INCONC=0
green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }
gray()  { printf '\033[90m%s\033[0m' "$1"; }

ok()   { printf '  [%s] %-52s %s\n' "$(green OK)"   "$1" "${2:-}"; PASS=$((PASS+1)); }
bad()  { printf '  [%s] %-52s %s\n' "$(red FAIL)"   "$1" "${2:-}"; FAIL=$((FAIL+1)); }
skip() { printf '  [%s] %-52s %s\n' "$(gray SKIP)"  "$1" "${2:-}"; SKIP=$((SKIP+1)); }

clean_token() { printf '%s' "$1" | tr -d '\r\n' | sed 's/^"//; s/"$//; s/^Bearer //'; }

for v in A B; do
  eval "t=\$TOKEN_$v"
  if [ -z "$t" ]; then
    echo; echo "  TOKEN_$v 가 없습니다. 서로 다른 두 계정의 토큰이 필요합니다."
    echo "    read -r TOKEN_A && export TOKEN_A     # A 계정 창에서 복사한 값"
    echo "    read -r TOKEN_B && export TOKEN_B     # B 계정(시크릿 창) 값"
    echo; exit 1
  fi
  eval "TOKEN_$v=\$(clean_token \"\$t\")"
done

# 두 토큰이 같은 계정이면 이 테스트는 아무 의미가 없다. 서명 앞 payload 의 sub 를 비교한다.
sub_of() {
  printf '%s' "$1" | cut -d. -f2 | tr '_-' '/+' \
    | awk '{ n=length($0)%4; if(n) printf "%s%s", $0, substr("===",1,4-n); else print $0 }' \
    | base64 -d 2>/dev/null | grep -o '"sub":"[^"]*"' | cut -d'"' -f4
}
SUB_A=$(sub_of "$TOKEN_A"); SUB_B=$(sub_of "$TOKEN_B")

echo
echo "대상: $API"
echo "계정: A=userSeq ${SUB_A:-?}   B=userSeq ${SUB_B:-?}"
if [ -n "$SUB_A" ] && [ "$SUB_A" = "$SUB_B" ]; then
  echo
  echo "  두 토큰이 같은 계정입니다. 서로 다른 계정이어야 인가 검증이 성립합니다."
  echo; exit 1
fi
echo "──────────────────────────────────────────────────────────────────────────────"

# deny <설명> <메서드> <URL> [토큰] [본문]
# 성공(2xx)하면 FAIL. 401/403/404 면 PASS. 그 외(5xx 등)도 FAIL 로 본다.
deny() {
  local label="$1" method="$2" url="$3" token="${4:-}" data="${5:-}"
  local args=(-s -o /dev/null -w '%{http_code}' --max-time 20 -X "$method")
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  if [ -n "$data" ]; then
    local f="${TMPDIR:-/tmp}/authz-body.json"
    printf '%s' "$data" > "$f"
    args+=(-H "Content-Type: application/json" --data-binary "@$f")
  fi
  local code; code=$(curl "${args[@]}" "$url")
  case "$code" in
    401|403|404) ok "$label" "$code (차단됨)" ;;
    2*)          bad "$label" "$code ← 요청이 통과했습니다" ;;
    # 400 은 인가 이전에 본문 검증에서 끊긴 것이다. 막혔다고도, 뚫렸다고도 할 수 없다.
    # 제품 문제가 아니라 이 스크립트가 보내는 본문을 고쳐야 한다는 신호다.
    400)         printf '  [%s] %-52s %s\n' "$(gray '----')" "$label" \
                        "400 ← 본문 검증에서 끊겨 인가 확인 불가"; INCONC=$((INCONC+1)) ;;
    *)           bad "$label" "$code ← 검사가 아니라 오류로 끝났습니다" ;;
  esac
}

# allow <설명> <메서드> <URL> <토큰> [본문] — 대조군. 정상 요청은 통과해야 한다.
allow() {
  local label="$1" method="$2" url="$3" token="$4" data="${5:-}"
  local args=(-s -o /dev/null -w '%{http_code}' --max-time 20 -X "$method"
              -H "Authorization: Bearer $token")
  if [ -n "$data" ]; then
    local f="${TMPDIR:-/tmp}/authz-body.json"
    printf '%s' "$data" > "$f"
    args+=(-H "Content-Type: application/json" --data-binary "@$f")
  fi
  local code; code=$(curl "${args[@]}" "$url")
  case "$code" in
    2*) ok "$label" "$code" ;;
    *)  bad "$label" "$code ← 정상 요청까지 막혔습니다" ;;
  esac
}

echo
echo "[1] 인증 없음 — 토큰을 아예 안 붙였을 때"
deny "토큰 없이 게시물 생성"            POST   "$API/posts" "" '{"content":"x","imageSeqs":[1]}'
deny "토큰 없이 내 정보 조회"            GET    "$API/users/me"
deny "토큰 없이 DM 방 목록"              GET    "$API/dm/rooms"
deny "토큰 없이 알림 목록"               GET    "$API/notifications"

echo
echo "[2] 변조 토큰 — 서명이 깨진 토큰"
BAD_TOKEN="${TOKEN_A%???}AAA"
deny "서명 변조 토큰으로 내 정보 조회"    GET    "$API/users/me" "$BAD_TOKEN"
deny "서명 변조 토큰으로 게시물 생성"     POST   "$API/posts" "$BAD_TOKEN" '{"content":"x","imageSeqs":[1]}'

echo
echo "[3] 남의 리소스 — B 토큰으로 A 의 것을 건드린다"

if [ "${WRITE:-0}" != "1" ]; then
  skip "게시물 관련 검사 전체" "WRITE=1 지정 시 실행 (A 계정으로 일회용 게시물 생성)"
else
  # A 계정으로 공격 대상 게시물을 하나 만든다.
  png="${TMPDIR:-/tmp}/authz-1x1.png"
  printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' \
    | base64 -d > "$png" 2>/dev/null
  fsize=$(wc -c < "$png" | tr -d ' ')

  pres=$(curl -s --max-time 20 -X POST "$API/images/uploads/presign" \
         -H "Authorization: Bearer $TOKEN_A" -H "Content-Type: application/json" \
         -d "{\"purpose\":\"POST\",\"contentType\":\"image/png\",\"originalFilename\":\"authz.png\",\"fileSize\":$fsize}")
  up=$(printf '%s' "$pres" | sed -n 's/.*"uploadUrl":"\([^"]*\)".*/\1/p')
  key=$(printf '%s' "$pres" | sed -n 's/.*"objectKey":"\([^"]*\)".*/\1/p')
  curl -s -o /dev/null --max-time 30 -X PUT -H "Content-Type: image/png" \
       --data-binary "@$png" "$up"
  cmp=$(curl -s --max-time 20 -X POST "$API/images/uploads/complete" \
        -H "Authorization: Bearer $TOKEN_A" -H "Content-Type: application/json" \
        -d "{\"objectKey\":\"$key\"}")
  IMG_A=$(printf '%s' "$cmp" | sed -n 's/.*"imageSeq":\([0-9]*\).*/\1/p')

  bodyfile="${TMPDIR:-/tmp}/authz-post.json"
  printf '{"content":"%s","imageSeqs":[%s]}' "[인가테스트] 자동 생성 — 곧 삭제됩니다" "$IMG_A" > "$bodyfile"
  created=$(curl -s --max-time 30 -X POST "$API/posts" \
            -H "Authorization: Bearer $TOKEN_A" \
            -H "Content-Type: application/json; charset=UTF-8" \
            --data-binary "@$bodyfile")
  POST_A=$(printf '%s' "$created" | sed -n 's/.*"postSeq":\([0-9]*\).*/\1/p')

  if [ -z "$POST_A" ]; then
    bad "A 계정 테스트 게시물 준비" "$(printf '%s' "$created" | head -c 150)"
  else
    ok "A 계정 테스트 게시물 준비" "postSeq=$POST_A imageSeq=$IMG_A"

    # 파괴적이지 않은 것부터. 삭제는 마지막에 시도해야 앞 검사가 살아남는다.
    deny "B 가 A 게시물 수정"          PATCH  "$API/posts/$POST_A" "$TOKEN_B" '{"content":"B가 수정함"}'
    deny "B 가 A 의 이미지로 게시물 생성" POST "$API/posts" "$TOKEN_B" "{\"content\":\"stolen\",\"imageSeqs\":[$IMG_A]}"
    deny "B 가 A 게시물 삭제"          DELETE "$API/posts/$POST_A" "$TOKEN_B"
    deny "토큰 없이 A 게시물 삭제"      DELETE "$API/posts/$POST_A"

    # 대조군 — 주인은 되어야 한다. 권한 검사가 과하게 막고 있지 않은지 확인한다.
    allow "A 가 자기 게시물 수정 (대조군)" PATCH "$API/posts/$POST_A" "$TOKEN_A" '{"content":"[인가테스트] 수정 확인"}'

    # 정리
    del=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X DELETE \
          -H "Authorization: Bearer $TOKEN_A" "$API/posts/$POST_A")
    case "$del" in
      2*) ok "테스트 게시물 정리" "$del" ;;
      *)  bad "테스트 게시물 정리" "$del ← postSeq=$POST_A 수동 삭제 필요" ;;
    esac
  fi
fi

echo
echo "[4] 남의 DM — 대화 내용은 가장 민감하다"
ROOM_A=$(curl -s --max-time 20 -H "Authorization: Bearer $TOKEN_A" "$API/dm/rooms" \
         | grep -o '"dmRoomSeq":[0-9]*' | head -1 | cut -d: -f2)
if [ -z "$ROOM_A" ]; then
  ROOM_A=$(curl -s --max-time 20 -H "Authorization: Bearer $TOKEN_A" "$API/dm/rooms" \
           | grep -o '"roomSeq":[0-9]*' | head -1 | cut -d: -f2)
fi
if [ -z "$ROOM_A" ]; then
  skip "DM 관련 검사 전체" "A 계정에 DM 방이 없어 건너뜀"
else
  echo "  (A 의 DM 방: roomSeq=$ROOM_A)"
  deny "B 가 A 의 대화 내용 조회"     GET    "$API/dm/rooms/$ROOM_A/messages" "$TOKEN_B"
  deny "B 가 A 의 방에 메시지 전송"    POST   "$API/dm/rooms/$ROOM_A/messages" "$TOKEN_B" '{"textContent":"침입"}'
  deny "B 가 A 의 방을 읽음 처리"      PATCH  "$API/dm/rooms/$ROOM_A/read" "$TOKEN_B"
  deny "B 가 A 의 방 삭제"            DELETE "$API/dm/rooms/$ROOM_A" "$TOKEN_B"
  deny "토큰 없이 A 의 대화 조회"      GET    "$API/dm/rooms/$ROOM_A/messages"
fi

echo
echo "[5] 남의 컬렉션"
COL_A=$(curl -s --max-time 20 -H "Authorization: Bearer $TOKEN_A" "$API/collections" \
        | grep -o '"collectionSeq":[0-9]*' | head -1 | cut -d: -f2)
if [ -z "$COL_A" ]; then
  skip "컬렉션 검사" "A 계정에 컬렉션이 없어 건너뜀"
else
  deny "B 가 A 의 컬렉션 삭제"        DELETE "$API/collections/$COL_A" "$TOKEN_B"
fi

echo
echo "──────────────────────────────────────────────────────────────────────────────"
printf '  PASS %s   FAIL %s   SKIP %s\n' "$(green "$PASS")" "$(red "$FAIL")" "$(gray "$SKIP")"
if [ "$FAIL" -gt 0 ]; then
  echo
  echo "  FAIL 이 하나라도 있으면 다른 사용자의 데이터에 접근할 수 있다는 뜻입니다."
  echo "  전화번호·사진이 걸린 문제이므로 발표보다 우선해서 확인하세요."
fi
echo

[ "$FAIL" -eq 0 ]
