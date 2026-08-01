import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setAccessToken, setUnauthorizedHandler } from "../services/api";
import useCommunityStore from "./useCommunityStore";
import useUserStore from "./useUserStore";
import {
	logout as logoutRequest,
	testLogin as testLoginRequest,
} from "../services/authApi";
import type { TestUser, UserSummary } from "../types/auth";

type SessionUser = UserSummary | TestUser | null;

type AuthState = {
	accessToken: string | null;
	refreshToken: string | null;
	user: SessionUser;
	/** 로그인·회원가입 성공 시 토큰/유저를 저장하고 axios에 주입 */
	setSession: (session: {
		accessToken: string;
		refreshToken?: string | null;
		user?: SessionUser;
	}) => void;
	/** 로컬 세션만 초기화 (서버 호출 없음) */
	clearSession: () => void;
	/** 서버 로그아웃 호출 후 로컬 세션 초기화 */
	logout: () => Promise<void>;
	/** 개발용 테스트 로그인 (POST /test/auth/login) */
	devLogin: (userId: number) => Promise<void>;
};

const useAuthStore = create<AuthState>()(
	persist(
		(set, get) => ({
			accessToken: null,
			refreshToken: null,
			user: null,

			setSession: ({ accessToken, refreshToken, user }) => {
				const prevUserId = get().user?.userId;
				setAccessToken(accessToken);
				const nextUser = user ?? get().user;
				set({
					accessToken,
					refreshToken: refreshToken ?? null,
					user: nextUser,
				});
				if (nextUser?.userId != null && nextUser.userId !== prevUserId) {
					useCommunityStore.getState().clearEngagement();
				}
			},

			clearSession: () => {
				setAccessToken(null);
				set({ accessToken: null, refreshToken: null, user: null });
				useCommunityStore.getState().clearEngagement();
				useUserStore.getState().clearProfile();
			},

			logout: async () => {
				const { refreshToken } = get();
				try {
					// 서버 로그아웃은 refreshToken이 필수 — 없으면 로컬 세션만 정리한다.
					if (refreshToken) {
						await logoutRequest({ refreshToken });
					}
				} finally {
					get().clearSession();
				}
			},

			devLogin: async (userId) => {
				setAccessToken(null);
				const res = await testLoginRequest({ userId });
				get().setSession({
					accessToken: res.accessToken,
					user: res.user,
				});
			},
		}),
		{
			name: "starttoo-auth",
			partialize: (state) => ({
				accessToken: state.accessToken,
				refreshToken: state.refreshToken,
				user: state.user,
			}),
			// 새로고침 후 저장된 토큰을 axios 인스턴스에 다시 주입
			onRehydrateStorage: () => (state) => {
				if (state?.accessToken) {
					setAccessToken(state.accessToken);
				}
			},
		},
	),
);

setUnauthorizedHandler(() => {
	useAuthStore.getState().clearSession();
});

export default useAuthStore;
