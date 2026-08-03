import LoginPanel from "../components/auth/LoginPanel";

/**
 * 로그인 화면(/login).
 *
 * 평소 로그인은 TopNav에서 모달로 뜨고, 이 경로는 로그인 필요 페이지에서 튕겨졌을 때·
 * 링크로 직접 들어왔을 때의 착지점으로 남겨 둔다. 버튼은 모달과 같은 것을 쓴다.
 */
export default function LoginPage() {
	return (
		<div className="flex min-h-[calc(100vh-60px)] flex-col items-center justify-center px-6">
			<h1 className="text-[28px] font-extrabold text-black">로그인</h1>

			<div className="mt-10 w-full max-w-[320px]">
				<LoginPanel />
			</div>
		</div>
	);
}
