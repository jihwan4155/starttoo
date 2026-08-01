import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * 소셜 로그인에서 signupRequired=true를 받은 뒤 가입 완료까지 이어지는 상태.
 *
 * 가입 플로우가 여러 화면에 걸쳐 있어 새로고침에도 살아남아야 하므로 sessionStorage에 둔다.
 * 탭을 닫으면 사라지는 편이 안전해서 localStorage는 쓰지 않는다.
 * 어디까지 진행했는지는 별도 단계 값 없이 채워진 항목으로 판단한다.
 */
type SignupState = {
	/** POST /auth/social/login 응답의 단기 가입 토큰 */
	signupToken: string | null;
	/** 서버가 +82 E.164로 정규화해 돌려준 번호 */
	phoneNumber: string | null;
	nickname: string | null;
	setSignupToken: (token: string) => void;
	setPhoneNumber: (phoneNumber: string) => void;
	setNickname: (nickname: string) => void;
	clearSignup: () => void;
};

const useSignupStore = create<SignupState>()(
	persist(
		(set) => ({
			signupToken: null,
			phoneNumber: null,
			nickname: null,
			setSignupToken: (signupToken) => set({ signupToken }),
			setPhoneNumber: (phoneNumber) => set({ phoneNumber }),
			setNickname: (nickname) => set({ nickname }),
			clearSignup: () =>
				set({ signupToken: null, phoneNumber: null, nickname: null }),
		}),
		{
			name: "starttoo-signup",
			storage: createJSONStorage(() => sessionStorage),
		},
	),
);

export default useSignupStore;
