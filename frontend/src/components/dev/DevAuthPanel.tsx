import { useState } from "react";
import useAuthStore from "../../store/useAuthStore";

/** 개발용 test login 계정 (POST /test/auth/login) */
const TEST_ACCOUNTS = [
	{ userId: 1, label: "일반회원", role: "USER" },
	{ userId: 2, label: "타투이스트", role: "ARTIST" },
	{ userId: 9, label: "관리자", role: "ADMIN" },
] as const;

/**
 * 개발 환경 전용 테스트 로그인 패널.
 * 우측 하단에 떠서 시드 계정(1/2/9)으로 즉시 로그인/로그아웃할 수 있다.
 * import.meta.env.DEV 에서만 렌더된다(운영 번들 제외).
 */
export default function DevAuthPanel() {
	const user = useAuthStore((s) => s.user);
	const accessToken = useAuthStore((s) => s.accessToken);
	const devLogin = useAuthStore((s) => s.devLogin);
	const logout = useAuthStore((s) => s.logout);

	const [open, setOpen] = useState(true);
	const [busy, setBusy] = useState<number | "logout" | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleLogin = async (userId: number) => {
		setBusy(userId);
		setError(null);
		try {
			await devLogin(userId);
		} catch (err) {
			setError(err instanceof Error ? err.message : "로그인 실패");
		} finally {
			setBusy(null);
		}
	};

	const handleLogout = async () => {
		setBusy("logout");
		setError(null);
		try {
			await logout();
		} catch (err) {
			setError(err instanceof Error ? err.message : "로그아웃 실패");
		} finally {
			setBusy(null);
		}
	};

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="fixed bottom-4 right-4 z-[9999] rounded-full bg-neutral-900 px-3 py-2 text-xs font-medium text-white shadow-lg"
			>
				DEV 로그인
			</button>
		);
	}

	return (
		<div className="fixed bottom-4 right-4 z-[9999] w-60 rounded-xl border border-neutral-200 bg-white p-3 shadow-xl">
			<div className="mb-2 flex items-center justify-between">
				<span className="text-xs font-semibold text-neutral-500">
					DEV 테스트 로그인
				</span>
				<button
					type="button"
					onClick={() => setOpen(false)}
					className="text-neutral-400 hover:text-neutral-700"
					aria-label="닫기"
				>
					✕
				</button>
			</div>

			<div className="mb-2 rounded-lg bg-neutral-50 px-2 py-1.5 text-xs">
				{accessToken && user ? (
					<span className="text-neutral-700">
						<b>{user.nickname}</b> · {user.role} · #{user.userId}
					</span>
				) : (
					<span className="text-neutral-400">로그아웃 상태</span>
				)}
			</div>

			<div className="grid grid-cols-3 gap-1.5">
				{TEST_ACCOUNTS.map((acc) => (
					<button
						key={acc.userId}
						type="button"
						disabled={busy !== null}
						onClick={() => handleLogin(acc.userId)}
						className="rounded-md bg-neutral-900 px-2 py-1.5 text-[11px] font-medium text-white disabled:opacity-40"
						title={`${acc.role} (userId=${acc.userId})`}
					>
						{busy === acc.userId ? "..." : acc.label}
					</button>
				))}
			</div>

			<button
				type="button"
				disabled={busy !== null || !accessToken}
				onClick={handleLogout}
				className="mt-1.5 w-full rounded-md border border-neutral-300 px-2 py-1.5 text-[11px] font-medium text-neutral-600 disabled:opacity-40"
			>
				{busy === "logout" ? "..." : "로그아웃"}
			</button>

			{error && <p className="mt-1.5 text-[11px] text-red-500">{error}</p>}
		</div>
	);
}
