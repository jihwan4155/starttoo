#!/usr/bin/env bash
# API 플로우 통합 검증 — 스모크 다음 단계.
#
# 스모크가 "서비스가 살아있나"를 봤다면 여기서는 "데이터가 실제로 흐르나"를 본다.
# 서비스 하나만 보면 절대 안 드러나고 경계를 넘을 때만 드러나는 것들을 노린다:
#   - 게시물 응답의 이미지 URL이 진짜로 열리는가 (backend -> MinIO presign -> nginx)
#   - 한글 검색이 Redis 인덱스까지 반영돼 있는가 (backend -> Redis Search)
#   - 잘못된 입력이 500 이 아니라 400 으로 끊기는가 (검증 계층)
#
# 로그인은 Google·Kakao 소셜 전용이라 스크립트가 토큰을 스스로 발급할 수 없다.
# 그래서 인증 구간은 브라우저에서 뽑은 토큰을 주입해야 돈다.
#
# 사용법:
#   bash test/integration/api-flow.sh                 # 공개 API 만
#   TOKEN=eyJhbGci... bash test/integration/api-flow.sh   # 인증 구간까지
#
# 토큰 얻는 법: 로그인한 탭에서 F12 -> Application -> Local Storage -> accessToken
#              (또는 Network 탭의 아무 API 요청 -> Request Headers -> Authorization)

set -uo pipefail

BASE="${BASE:-https://i15d201.p.ssafy.io}"
API="$BASE/v1"
TOKEN="${TOKEN:-}"

PASS=0; FAIL=0; SKIP=0

# 토큰에 눈에 안 보이는 CR·개행이나 따옴표가 섞이면 Tomcat 이 Authorization 헤더를
# 거부하고 요청을 통째로 400 으로 끊는다. Spring 까지 못 가므로 응답이 JSON 이 아니라
# Tomcat HTML 오류 페이지이고, 토큰이 필요 없는 공개 API 까지 전부 400 이 된다.
# 그러면 원인이 토큰이라는 사실이 결과 어디에도 안 드러난다. 먼저 걸러낸다.
if [ -n "$TOKEN" ]; then
  TOKEN=$(printf '%s' "$TOKEN" | tr -d '\r\n' | sed 's/^"//; s/"$//; s/^Bearer //')
  if ! printf '%s' "$TOKEN" | grep -qE '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'; then
    echo
    echo "  토큰이 JWT 형식(a.b.c)이 아닙니다. 길이=$(printf '%s' "$TOKEN" | wc -c | tr -d ' ')"
    echo "  앞 40자: $(printf '%s' "$TOKEN" | head -c 40)"
    echo
    echo "  accessToken 의 '값'만 필요합니다. JSON 전체나 따옴표가 섞이지 않았는지 보세요."
    echo "  콘솔에서: copy(JSON.parse(localStorage.getItem(\"starttoo-auth\")).state.accessToken)"
    echo
    exit 1
  fi
fi
green() { printf '\033[32m%s\033[0m' "$1"; }
red()   { printf '\033[31m%s\033[0m' "$1"; }
gray()  { printf '\033[90m%s\033[0m' "$1"; }

ok()   { printf '  [%s] %-44s %s\n' "$(green OK)"   "$1" "${2:-}"; PASS=$((PASS+1)); }
bad()  { printf '  [%s] %-44s %s\n' "$(red FAIL)"   "$1" "${2:-}"; FAIL=$((FAIL+1)); }
skip() { printf '  [%s] %-44s %s\n' "$(gray SKIP)"  "$1" "${2:-}"; SKIP=$((SKIP+1)); }

# GET 해서 상태코드만 확인한다. 인증 헤더는 TOKEN 이 있을 때만 붙인다.
status() {
  local url="$1"
  if [ -n "$TOKEN" ]; then
    curl -s -o /dev/null -w '%{http_code}' --max-time 20 -H "Authorization: Bearer $TOKEN" "$url"
  else
    curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$url"
  fi
}

body() {
  local url="$1"
  if [ -n "$TOKEN" ]; then
    curl -s --max-time 20 -H "Authorization: Bearer $TOKEN" "$url"
  else
    curl -s --max-time 20 "$url"
  fi
}

expect() {  # expect <설명> <기대코드> <URL>
  local label="$1" want="$2" url="$3"
  local got; got=$(status "$url")
  if [ "$got" = "$want" ]; then ok "$label" "$got"; else bad "$label" "$got (기대 $want)"; fi
}

echo
echo "대상: $API"
if [ -n "$TOKEN" ]; then echo "인증: 토큰 주입됨"; else echo "인증: 없음 (공개 API 만 검사)"; fi
echo "──────────────────────────────────────────────────────────────────────"

echo
echo "[A-1] 게시물 조회"
posts=$(body "$API/posts?size=5")
if printf '%s' "$posts" | grep -q '"postSeq"'; then
  count=$(printf '%s' "$posts" | grep -o '"postSeq"' | wc -l | tr -d ' ')
  ok "GET /posts 목록" "게시물 ${count}건"
else
  bad "GET /posts 목록" "$(printf '%s' "$posts" | head -c 120)"
fi

post_seq=$(printf '%s' "$posts" | grep -o '"postSeq":[0-9]*' | head -1 | cut -d: -f2)
if [ -n "$post_seq" ]; then
  expect "GET /posts/{seq} 단건" 200 "$API/posts/$post_seq"
else
  skip "GET /posts/{seq} 단건" "목록이 비어 있어 건너뜀"
fi

echo
echo "[A-2] 이미지 URL 실제 도달 여부  ← backend -> MinIO -> nginx 경계"
# 여기가 이 스크립트의 핵심이다. 게시물 응답에 URL 이 담겨 있어도 그 URL 이 실제로
# 열리는지는 별개 문제다. presigned URL 은 서명에 호스트가 들어가서, 서버의
# MINIO_PUBLIC_ENDPOINT 가 실제 서비스 도메인과 어긋나면 목록은 200 인데
# 이미지만 전부 깨진다. 화면으로는 "사진이 안 뜨네" 로만 보이는 전형적 통합 버그다.
img_url=$(printf '%s' "$posts" | grep -o 'https://[^"]*' | grep -iE 'storage|minio|\.(jpg|jpeg|png|webp)' | head -1)
if [ -z "$img_url" ]; then
  skip "이미지 URL 추출" "응답에 이미지 URL 없음"
else
  host=$(printf '%s' "$img_url" | sed -E 's#^https://([^/]+)/.*#\1#')
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "$img_url")
  if [ "$code" = "200" ]; then
    ok "이미지 URL 열림" "$host -> 200"
  else
    bad "이미지 URL 열림" "$host -> $code  (MINIO_PUBLIC_ENDPOINT 확인)"
  fi
fi

echo
echo "[A-3] 검색  ← backend -> Redis Search 인덱스"
# 인덱스가 비어 있어도 200 이 나오므로 상태코드만으로는 부족하다. 응답 형태까지 본다.
# 한글은 미리 퍼센트 인코딩해 둔다. 셸에서 즉석 인코딩하면 로케일에 따라 결과가
# 달라져서 테스트가 환경마다 흔들린다. (%ED%83%80%ED%88%AC = "타투")
#
# 영문 질의가 0건인 것은 정상이다. subject 데이터가 전부 한글이라 매칭될 것이 없다.
# 여기서는 결과 개수가 아니라 "엔드포인트가 응답 형태를 지키는가"만 본다.
for pair in "타투:%ED%83%80%ED%88%AC" "tattoo:tattoo"; do
  label="${pair%%:*}"; enc="${pair##*:}"
  r=$(body "$API/search/posts?q=$enc")
  if printf '%s' "$r" | grep -qE '\{|\['; then
    ok "게시물 검색 q=$label" "$(printf '%s' "$r" | head -c 60)"
  else
    bad "게시물 검색 q=$label" "$(printf '%s' "$r" | head -c 100)"
  fi
done
expect "계정 자동완성 (한글 자모)" 200 "$API/search/accounts/autocomplete?q=%E3%85%8C"
expect "아티스트 검색"             200 "$API/search/artists?q=tattoo"

echo
echo "[A-4] 목록 API"
expect "GET /artists"                200 "$API/artists?size=5"
# /classifications 자체에는 핸들러가 없다. 하위 경로만 매핑돼 있어서 여기를 부르면 404 다.
expect "GET /classifications/primary-styles"   200 "$API/classifications/primary-styles"
expect "GET /classifications/colors"           200 "$API/classifications/colors"

echo
echo "[A-5] 실패 경로  ← 여기서 500 이 나오면 검증 계층에 구멍이 있다"
expect "size 초과 -> 400"         400 "$API/posts?size=999"
expect "없는 게시물 -> 404"        404 "$API/posts/99999999"
expect "검색어 특수문자 -> 400"    400 "$API/search/posts?q=%3Cscript%3E"

echo
echo "[B] 인증 구간"
if [ -z "$TOKEN" ]; then
  skip "인증 API 전체" "TOKEN 미지정 — 아래 안내 참고"
else
  expect "GET /users/me"        200 "$API/users/me"
  expect "GET /posts/me"        200 "$API/posts/me"
  expect "GET /posts/bookmarked" 200 "$API/posts/bookmarked"
  expect "GET /posts/following"  200 "$API/posts/following"
  expect "GET /notifications"    200 "$API/notifications?size=10"

  # ── 쓰기 플로우 ───────────────────────────────────────────────────────
  # 운영 서버에 실제 게시물이 만들어지고 공개 피드에 잠깐 노출된다. 팔로워 알림이나
  # AI 분류 같은 후속 처리도 실제로 돈다. 그래서 WRITE=1 을 명시할 때만 돈다.
  #   TOKEN=... WRITE=1 bash test/integration/api-flow.sh
  # 끝에서 게시물은 지우지만 업로드된 이미지는 남는다(이미지 삭제 API 가 없다).
  if [ "${WRITE:-0}" != "1" ]; then
    skip "쓰기 플로우 (업로드->게시물)" "WRITE=1 지정 시 실행"
  else
    echo "  ── 쓰기 플로우 (운영 데이터 생성) ──"

    # 1x1 투명 PNG. 실제 바이트를 올려야 MinIO 서명 검증까지 함께 확인된다.
    png="${TMPDIR:-/tmp}/starttoo-integration-1x1.png"
    printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' \
      | base64 -d > "$png" 2>/dev/null
    fsize=$(wc -c < "$png" | tr -d ' ')

    presign=$(curl -s --max-time 20 -X POST "$API/images/uploads/presign" \
              -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
              -d "{\"purpose\":\"POST\",\"contentType\":\"image/png\",\"originalFilename\":\"integration-test.png\",\"fileSize\":$fsize}")
    upload_url=$(printf '%s' "$presign" | sed -n 's/.*"uploadUrl":"\([^"]*\)".*/\1/p')
    object_key=$(printf '%s' "$presign" | sed -n 's/.*"objectKey":"\([^"]*\)".*/\1/p')

    if [ -z "$upload_url" ]; then
      bad "presign 발급" "$(printf '%s' "$presign" | head -c 200)"
    else
      ok "presign 발급" "objectKey=${object_key:0:40}..."

      # requiredHeaders 를 그대로 붙여야 서명이 맞는다. 보통 Content-Type 하나다.
      hdrs=()
      raw=$(printf '%s' "$presign" | sed -n 's/.*"requiredHeaders":{\([^}]*\)}.*/\1/p')
      while IFS= read -r pair; do
        k=$(printf '%s' "$pair" | sed -n 's/^ *"\([^"]*\)" *: *"\([^"]*\)" *$/\1/p')
        v=$(printf '%s' "$pair" | sed -n 's/^ *"\([^"]*\)" *: *"\([^"]*\)" *$/\2/p')
        [ -n "$k" ] && hdrs+=(-H "$k: $v")
      done < <(printf '%s' "$raw" | tr ',' '\n')
      [ ${#hdrs[@]} -eq 0 ] && hdrs=(-H "Content-Type: image/png")

      put_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 \
                 -X PUT "${hdrs[@]}" --data-binary "@$png" "$upload_url")
      case "$put_code" in
        200|204) ok "MinIO 직접 업로드 (PUT)" "$put_code" ;;
        *)       bad "MinIO 직접 업로드 (PUT)" "$put_code — presign 서명·헤더 불일치 의심" ;;
      esac

      complete=$(curl -s --max-time 20 -X POST "$API/images/uploads/complete" \
                 -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
                 -d "{\"objectKey\":\"$object_key\"}")
      image_seq=$(printf '%s' "$complete" | sed -n 's/.*"imageSeq":\([0-9]*\).*/\1/p')
      download_url=$(printf '%s' "$complete" | sed -n 's/.*"downloadUrl":"\([^"]*\)".*/\1/p')

      if [ -n "$image_seq" ]; then
        ok "업로드 complete 등록" "imageSeq=$image_seq"
        dl=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$download_url")
        [ "$dl" = "200" ] && ok "방금 올린 이미지 다시 받기" "200" \
                          || bad "방금 올린 이미지 다시 받기" "$dl"
      else
        bad "업로드 complete 등록" "$(printf '%s' "$complete" | head -c 200)"
      fi

      # 영문 본문과 한글 본문을 따로 올린다. 둘을 한 번에 섞으면, 실패했을 때
      # 요청 형태가 틀린 것인지 한글 인코딩이 깨지는 것인지 구분할 수 없다.
      # 한글이 실패한다면 한국어 서비스로서 치명적인 버그이므로 반드시 갈라내야 한다.
      # 게시물마다 이미지를 새로 올린다. 같은 imageSeq 를 두 게시물에 쓰면 "이미 사용된
      # 이미지" 로 거절될 수 있는데, 그러면 실패 원인이 인코딩인지 이미지 재사용인지
      # 구분이 안 된다. 검증 출력 없이 조용히 한 장 더 만든다.
      fresh_image() {
        local p c k u seq
        p=$(curl -s --max-time 20 -X POST "$API/images/uploads/presign" \
            -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
            -d "{\"purpose\":\"POST\",\"contentType\":\"image/png\",\"originalFilename\":\"integration-test.png\",\"fileSize\":$fsize}")
        u=$(printf '%s' "$p" | sed -n 's/.*"uploadUrl":"\([^"]*\)".*/\1/p')
        k=$(printf '%s' "$p" | sed -n 's/.*"objectKey":"\([^"]*\)".*/\1/p')
        [ -z "$u" ] && return 1
        curl -s -o /dev/null --max-time 30 -X PUT "${hdrs[@]}" --data-binary "@$png" "$u"
        c=$(curl -s --max-time 20 -X POST "$API/images/uploads/complete" \
            -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
            -d "{\"objectKey\":\"$k\"}")
        seq=$(printf '%s' "$c" | sed -n 's/.*"imageSeq":\([0-9]*\).*/\1/p')
        [ -z "$seq" ] && return 1
        printf '%s' "$seq"
      }

      create_post() {  # create_post <라벨> <본문> <imageSeq>
        local label="$1" content="$2" img="$3" created new_seq del
        if [ -z "$img" ]; then
          bad "게시물 생성 ($label)" "이미지 준비 실패"
          return
        fi
        # 본문을 인자로 넘기지 않고 파일로 건넨다.
        # Git Bash 의 curl 은 /mingw64/bin 의 네이티브 Windows 실행 파일이라, MSYS2 가
        # 셸 -> exe 로 인자를 넘길 때 Windows 코드페이지를 거치면서 UTF-8 바이트가 깨진다.
        # 그러면 서버는 깨진 바이트를 받아 JSON 파싱에 실패하고 INVALID_REQUEST 를 낸다.
        # printf 는 bash 내장이라 리다이렉트로 쓰면 바이트가 그대로 보존된다.
        local bodyfile="${TMPDIR:-/tmp}/starttoo-post-body.json"
        printf '{"content":"%s","imageSeqs":[%s]}' "$content" "$img" > "$bodyfile"
        created=$(curl -s --max-time 30 -X POST "$API/posts" \
                  -H "Authorization: Bearer $TOKEN" \
                  -H "Content-Type: application/json; charset=UTF-8" \
                  --data-binary "@$bodyfile")
        new_seq=$(printf '%s' "$created" | sed -n 's/.*"postSeq":\([0-9]*\).*/\1/p')
        if [ -z "$new_seq" ]; then
          bad "게시물 생성 ($label)" "$(printf '%s' "$created" | head -c 180)"
          return
        fi
        ok "게시물 생성 ($label)" "postSeq=$new_seq"
        expect "생성한 게시물 조회 ($label)" 200 "$API/posts/$new_seq"

        # 응답 본문이 보낸 것과 같은지. 여기서 깨지면 저장·조회 중 인코딩이 손상된 것이다.
        if printf '%s' "$created" | grep -qF "$content"; then
          ok "본문 왕복 일치 ($label)" "인코딩 손상 없음"
        else
          bad "본문 왕복 일치 ($label)" "보낸 본문과 응답이 다르다"
        fi

        # 분류는 비동기다. 여기서 tattooSeq 가 null 인 것은 정상이며 나중에 채워진다.
        # 다만 키 자체는 항상 있어야 한다(전역 non_null 직렬화 때문에 빠질 수 있어서
        # PostImageResponse 가 JsonInclude.ALWAYS 로 막아 둔 부분이다).
        if printf '%s' "$created" | grep -q '"tattooSeq"'; then
          ok "tattooSeq 키 항상 포함 ($label)" "비동기 분류 대기"
        else
          bad "tattooSeq 키 항상 포함 ($label)" "키 누락 — 프론트가 undefined 를 만난다"
        fi

        del=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
              -X DELETE -H "Authorization: Bearer $TOKEN" "$API/posts/$new_seq")
        if [ "$del" = "200" ] || [ "$del" = "204" ]; then
          ok "테스트 게시물 정리 ($label)" "$del"
        else
          bad "테스트 게시물 정리 ($label)" "$del — postSeq=$new_seq 수동 삭제 필요"
        fi
      }

      if [ -n "$image_seq" ]; then
        create_post "영문" "[integration-test] auto-generated, will be deleted" "$image_seq"
        create_post "한글" "[통합테스트] 한글 본문 확인용, 곧 삭제됩니다" "$(fresh_image || true)"
      fi
    fi
  fi
fi

echo
echo "──────────────────────────────────────────────────────────────────────"
printf '  PASS %s   FAIL %s   SKIP %s\n' "$(green "$PASS")" "$(red "$FAIL")" "$(gray "$SKIP")"
if [ -z "$TOKEN" ]; then
  echo
  echo "  인증 구간까지 돌리려면:"
  echo "    1) 로그인한 탭에서 F12 -> Application -> Local Storage -> accessToken 복사"
  echo "    2) TOKEN=<붙여넣기> bash test/integration/api-flow.sh"
fi
echo

[ "$FAIL" -eq 0 ]
