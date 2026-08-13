/*
 * 부하 테스트 — 동시 사용자 30명 기준, 읽기 전용.
 *
 * 실행 (로컬 PC 에서. 서버에서 돌리면 부하 주는 쪽과 받는 쪽이 자원을 나눠 써서 측정이 왜곡된다):
 *   docker run --rm -i grafana/k6 run - < test/integration/load.js
 *
 * 동시 사용자 수를 바꾸려면:
 *   docker run --rm -i -e VUS=50 grafana/k6 run - < test/integration/load.js
 *
 * 읽기만 한다. 쓰기 부하는 일부러 넣지 않았다 — 운영 DB 에 게시물이 수천 개 쌓이고
 * 지우기도 번거롭다. AI 생성도 제외했다. 추론 슬롯이 전역 1개라 동시성이 원천적으로
 * 1이고, 노트북 한 대에서 도는 터라 부하를 걸면 팀원 시연까지 막힌다.
 *
 * 돌리는 동안 서버에서 이걸 같이 띄워 두면 어디가 먼저 힘들어지는지 보인다:
 *   docker stats
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

const BASE = __ENV.BASE || "https://i15d201.p.ssafy.io";
const API = `${BASE}/v1`;
const VUS = parseInt(__ENV.VUS || "30", 10);

/*
 * 레이트 리밋 면제 계정의 토큰.
 *
 * 없으면 비로그인으로 도는데, 그러면 IP 기준 60건/분에 걸려서 부하를 실을 수가 없다.
 * 서버 용량이 아니라 정책 한도를 측정하게 된다(실측: 5 VU 만으로 46% 가 429).
 *
 * RateLimitFilter 의 exempt() 는 인증된 요청의 userSeq 가 app.rate-limit.exempt-user-seqs
 * 에 있으면 한도를 통째로 건너뛴다. 주석에도 "부하 시연·데모용"이라고 적혀 있다.
 * 서버에 설정된 값 확인:  docker exec starttoo-backend printenv | grep RATE_LIMIT_EXEMPT
 */
const TOKEN = __ENV.TOKEN || "";
const PARAMS = TOKEN ? { headers: { Authorization: `Bearer ${TOKEN}` } } : {};

function req(url, name) {
	return http.get(url, { ...PARAMS, tags: { name } });
}

// 엔드포인트별로 따로 본다. 전체 평균만 보면 느린 하나가 빠른 여럿에 묻힌다.
const feedTime = new Trend("t_feed", true);
const detailTime = new Trend("t_detail", true);
const searchTime = new Trend("t_search", true);
const artistTime = new Trend("t_artists", true);
const imageTime = new Trend("t_image", true);
const imageFail = new Rate("image_fail");
// 429 가 하나라도 잡히면 면제가 안 먹고 있다는 뜻이다. 그 상태의 수치는 서버 용량이
// 아니라 레이트 리밋 정책을 측정한 것이므로 결과를 믿으면 안 된다.
const rateLimited = new Counter("rate_limited_429");

export const options = {
	stages: [
		{ duration: "30s", target: VUS }, // 서서히 올린다. 한 번에 던지면 워밍업 효과를 못 본다
		{ duration: "2m", target: VUS },  // 유지 구간 — 이 구간 수치가 본 결과다
		{ duration: "30s", target: 0 },
	],
	thresholds: {
		// 실패율이 1% 를 넘으면 그 자체로 문제다.
		http_req_failed: ["rate<0.01"],
		// 사람이 "느리다"고 느끼기 시작하는 지점을 1초로 잡았다.
		// 평균이 아니라 p95 를 본다 — 20명 중 1명이 겪는 최악이 체감을 결정한다.
		"t_feed": ["p(95)<1000"],
		"t_detail": ["p(95)<1000"],
		"t_search": ["p(95)<1000"],
		// 이미지는 용량이 커서 기준을 따로 둔다.
		"t_image": ["p(95)<3000"],
		image_fail: ["rate<0.01"],
		// 429 는 한 건도 없어야 한다. 있으면 측정 자체가 무효다.
		rate_limited_429: ["count==0"],
	},
	summaryTrendStats: ["avg", "p(90)", "p(95)", "p(99)", "max"],
};

const SEARCH_TERMS = ["호랑이", "꽃", "용", "나비", "장미"];

export default function () {
	// 1) 피드 조회 — 가장 흔한 동작. 이미지마다 presigned URL 서명을 새로 만들기 때문에
	//    단순 조회처럼 보여도 서버 CPU 를 쓴다.
	const feed = req(`${API}/posts?size=20`, "feed");
	feedTime.add(feed.timings.duration);
	if (feed.status === 429) rateLimited.add(1);
	check(feed, { "피드 200": (r) => r.status === 200 });

	let items = [];
	try {
		items = feed.json("data.items") || [];
	} catch (e) {
		items = [];
	}
	sleep(randomBetween(1, 3)); // 사용자가 피드를 훑어보는 시간

	if (items.length > 0) {
		const post = items[Math.floor(Math.random() * items.length)];

		// 2) 게시물 상세
		const detail = req(`${API}/posts/${post.postSeq}`, "detail");
		detailTime.add(detail.timings.duration);
		if (detail.status === 429) rateLimited.add(1);
		check(detail, { "상세 200": (r) => r.status === 200 });

		// 3) 이미지 실제 다운로드 — 실무에서 대역폭을 가장 많이 먹는 구간이다.
		//    한 게시물의 첫 장만 받는다. 전부 받으면 실제 사용자보다 과장된 부하가 된다.
		//
		//    NO_IMAGE=1 로 끄면 대역폭을 거의 안 쓰고 API 부하만 남는다.
		//    서버 CPU 가 여유로운데 응답이 느릴 때, 병목이 서버 처리인지 회선인지를
		//    가르는 데 쓴다. 이미지를 뺐는데도 느리면 서버, 빨라지면 대역폭이다.
		const imageUrl =
			__ENV.NO_IMAGE === "1"
				? null
				: post.images && post.images[0] && post.images[0].imageUrl;
		if (imageUrl) {
			const img = http.get(imageUrl, { tags: { name: "image" } });
			imageTime.add(img.timings.duration);
			imageFail.add(img.status !== 200);
			check(img, { "이미지 200": (r) => r.status === 200 });
		}
		sleep(randomBetween(2, 4)); // 게시물을 보는 시간
	}

	// 4) 검색 — Redis Search 를 태운다. CPU 바운드다.
	const term = SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)];
	const search = req(`${API}/search/posts?q=${encodeURIComponent(term)}`, "search");
	searchTime.add(search.timings.duration);
	if (search.status === 429) rateLimited.add(1);
	check(search, { "검색 200": (r) => r.status === 200 });
	sleep(randomBetween(1, 2));

	// 5) 아티스트 목록
	const artists = req(`${API}/artists?size=20`, "artists");
	artistTime.add(artists.timings.duration);
	if (artists.status === 429) rateLimited.add(1);
	check(artists, { "아티스트 200": (r) => r.status === 200 });
	sleep(randomBetween(2, 5)); // 다음 행동까지 쉬는 시간
}

function randomBetween(min, max) {
	return Math.random() * (max - min) + min;
}
