import type { Gender } from "../store/useUserStore";

/**
 * 서버 성별 코드는 M · F 두 값이다 (SignupRequest.gender, UpdateProfileRequest.gender
 * 모두 pattern "M|F"). 과거 값 MALE·FEMALE도 관대하게 받아 둔다.
 */
export function apiGenderToUi(gender: string | null | undefined): Gender {
	if (gender === "M" || gender === "MALE") return "male";
	if (gender === "F" || gender === "FEMALE") return "female";
	return null;
}

/** UI 선택값 → PATCH /users/me gender */
export function uiGenderToApi(gender: Gender): "M" | "F" | undefined {
	if (gender === "male") return "M";
	if (gender === "female") return "F";
	return undefined;
}
