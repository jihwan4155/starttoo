import { useNavigate, useParams } from "react-router-dom";
import PostDetailModal from "../components/community/PostDetailModal";
import StarttooLoader from "../components/loader/StarttooLoader";
import usePost from "../hooks/queries/usePost";
import { ApiError } from "../services/api";

/**
 * 게시글 단건 주소 — /posts/:postId
 *
 * 피드 안에서만 열리던 상세를 주소로도 열 수 있게 한다. DM으로 공유한 게시글이
 * 이 경로로 들어오고, 새로고침·링크 복사도 여기서 받는다.
 *
 * 화면은 피드에서 쓰는 상세 모달을 그대로 띄운다. 모달을 닫으면 커뮤니티로
 * 보낸다 — 링크로 바로 들어온 경우 뒤로 갈 곳이 없기 때문이다.
 */
export default function PostDetailPage() {
	const { postId } = useParams();
	const navigate = useNavigate();
	const parsed = Number(postId);
	const isValidId = Number.isInteger(parsed) && parsed > 0;

	const { data: post, isPending, isError, error } = usePost(
		isValidId ? parsed : undefined,
	);

	const close = () => navigate("/posts", { replace: true });

	if (!isValidId || isError) {
		const message =
			error instanceof ApiError
				? error.message
				: "게시글을 찾을 수 없습니다.";
		return (
			<div className="flex min-h-[calc(100vh-60px)] flex-col items-center justify-center gap-4 px-6">
				<p className="text-center text-[14px] text-black/60">
					{isValidId ? message : "잘못된 주소입니다."}
				</p>
				<button
					type="button"
					onClick={close}
					className="rounded-full border border-black/20 px-5 py-2 text-[13px] font-semibold transition hover:bg-black/5">
					커뮤니티로 가기
				</button>
			</div>
		);
	}

	if (isPending || !post) {
		return (
			<div className="min-h-[calc(100vh-60px)] py-20">
				<StarttooLoader variant="block" label="게시글을 불러오는 중…" />
			</div>
		);
	}

	return (
		<div className="min-h-[calc(100vh-60px)] bg-surface">
			<PostDetailModal post={post} onClose={close} />
		</div>
	);
}
