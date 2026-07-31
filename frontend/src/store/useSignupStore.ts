import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * 소셜 로그인에서 signupRequired=true를 받은 뒤 가입 완료까지 이어지는 상태.
 *
 * 가입 플로우가 여러 화면에 걸쳐 있어 새로고침에도 살아남아야 하므로 sessionStorage에 둔다.
 * 탭을 닫으면 사라지는 편이 안전해서 localStorage는 쓰지 않는다.
 */
type SignupState = {
	/** POST /auth/social/login 응답의 단기 가입 토큰 */
	signupToken: string | null;
	setSignupToken: (token: string) => void;
	clearSignup: () => void;
};

const useSignupStore = create<SignupState>()(
	persist(
		(set) => ({
			signupToken: null,
			setSignupToken: (token) => set({ signupToken: token }),
			clearSignup: () => set({ signupToken: null }),
		}),
		{
			name: "starttoo-signup",
			storage: createJSONStorage(() => sessionStorage),
		},
	),
);

export default useSignupStore;
