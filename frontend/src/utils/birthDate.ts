/**
 * 생년월일 8자리 입력의 표시·검증.
 *
 * 날짜 선택기(input type="date") 대신 숫자 8자리를 직접 받는다. 생년월일은 몇십 년을
 * 거슬러야 해서 달력으로 고르면 클릭이 수십 번 필요하고, 연/월/일 드롭다운도 연도 목록이
 * 100개가 넘는다. 8자리를 그냥 치는 것이 가장 빠르다.
 */

/**
 * 가입 가능한 최소 나이(만).
 *
 * 타투는 미성년자에게 시술할 수 없어 계정 자체를 성년부터 받는다.
 * 19는 한국 민법상 성년 기준 — 흔히 말하는 "20살"(세는나이)이 만 19세다.
 */
export const MIN_AGE = 19;

/** 생년월일로 받아 줄 가장 이른 연도 — 오타로 들어온 0001년 같은 값을 걸러낸다 */
const MIN_BIRTH_YEAR = 1900;

/**
 * 입력한 숫자를 YYYY-MM-DD 모양으로 보여준다. 하이픈은 자릿수가 차면 자동으로 끼우므로
 * 사용자는 숫자만 누르면 된다. 8자리가 다 차면 그대로 서버가 받는 형식이 된다.
 */
export function formatBirthDigits(digits: string): string {
	return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)]
		.filter(Boolean)
		.join("-");
}

/**
 * 8자리를 실제 달력에 있는 날짜로만 통과시킨다.
 *
 * Date는 2월 30일을 3월 2일로 넘겨 버리므로, 되돌려 읽은 값이 입력과 같은지
 * 확인해야 존재하지 않는 날짜를 걸러낼 수 있다.
 */
export function parseBirthDigits(digits: string): Date | null {
	if (digits.length !== 8) return null;
	const year = Number(digits.slice(0, 4));
	const month = Number(digits.slice(4, 6));
	const day = Number(digits.slice(6, 8));
	if (year < MIN_BIRTH_YEAR) return null;
	const date = new Date(year, month - 1, day);
	if (
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day
	) {
		return null;
	}
	return date;
}

/**
 * 만 나이가 MIN_AGE에 닿았는지 — 생일 당일부터 통과한다.
 *
 * `now`는 테스트에서 기준 시각을 고정하기 위한 것으로, 화면에서는 넘기지 않는다.
 */
export function isOldEnough(birth: Date, now: Date = new Date()): boolean {
	const eligibleFrom = new Date(
		birth.getFullYear() + MIN_AGE,
		birth.getMonth(),
		birth.getDate(),
	);
	return eligibleFrom.getTime() <= now.getTime();
}

/**
 * 생년월일 입력의 문제를 한 줄로 알려준다. 문제가 없으면 null.
 *
 * 8자리를 다 넣기 전에는 아무 말도 하지 않는다 — 타이핑하는 동안 경고가
 * 깜빡이면 오히려 방해가 된다.
 */
export function birthDateMessage(
	digits: string,
	now: Date = new Date(),
): string | null {
	if (digits.length !== 8) return null;
	const date = parseBirthDigits(digits);
	if (!date) return "달력에 없는 날짜예요. 다시 확인해주세요.";
	if (date.getTime() > now.getTime()) return "미래 날짜는 입력할 수 없어요.";
	if (!isOldEnough(date, now)) return `만 ${MIN_AGE}세 이상만 가입할 수 있어요.`;
	return null;
}
