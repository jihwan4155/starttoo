import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
	setAccessToken,
	setRefreshHandler,
	setUnauthorizedHandler,
} from "../services/api";
import { queryClient } from "../services/queryClient";
import useCommunityStore from "./useCommunityStore";
import useUserStore from "./useUserStore";
import {
	logout as logoutRequest,
	refreshToken as refreshTokenRequest,
} from "../services/authApi";
import type { UserSummary } from "../types/auth";

type SessionUser = UserSummary | null;

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
	/**
	 * GET /users/me 응답으로 세션 사용자를 채운다.
	 *
	 * 로그인·가입 응답(TokenResponse)에는 사용자 정보가 없어서 토큰만으로 세션이
	 * 시작된다. userId를 아는 시점이 여기뿐이라, /users/me 이외의 "내 것" 조회는
	 * 모두 이 호출 뒤에야 켜진다. (useSyncMeProfile이 호출)
	 */
	setUser: (user: UserSummary) => void;
	/** 로컬 세션만 초기화 (서버 호출 없음) */
	clearSession: () => void;
	/** 서버 로그아웃 호출 후 로컬 세션 초기화 */
	logout: () => Promise<void>;
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

			setUser: (user) => {
				const prevUserId = get().user?.userId;
				set({ user });
				if (user.userId !== prevUserId) {
					useCommunityStore.getState().clearEngagement();
				}
			},

			clearSession: () => {
				setAccessToken(null);
				set({ accessToken: null, refreshToken: null, user: null });
				useCommunityStore.getState().clearEngagement();
				useUserStore.getState().clearProfile();
				// 다음 계정 화면에 이전 계정의 응답이 비치지 않도록 캐시를 비운다.
				queryClient.clear();
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

// 401 시 axios 인터셉터가 호출 — refreshToken으로 토큰 쌍을 재발급한다.
// 실패(리프레시 만료·무효) 시 null을 돌려주고, 세션 정리는 인터셉터 쪽
// unauthorized 흐름에 맡긴다.
setRefreshHandler(async () => {
	const { refreshToken } = useAuthStore.getState();
	if (!refreshToken) return null;
	try {
		const tokens = await refreshTokenRequest({ refreshToken });
		useAuthStore.getState().setSession({
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
		});
		return tokens.accessToken;
	} catch {
		return null;
	}
});

export default useAuthStore;
