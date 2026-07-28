import type { Gender } from "../store/useUserStore";

/** API gender → UI 선택값 */
export function apiGenderToUi(gender: string | null | undefined): Gender {
	if (gender === "MALE") return "male";
	if (gender === "FEMALE") return "female";
	return null;
}

/** UI 선택값 → PATCH /users/me gender */
export function uiGenderToApi(gender: Gender): string | undefined {
	if (gender === "male") return "MALE";
	if (gender === "female") return "FEMALE";
	return undefined;
}
