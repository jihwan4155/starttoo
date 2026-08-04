import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "./icons";
import useUpdatePost from "../../hooks/mutations/useUpdatePost";
import usePost from "../../hooks/queries/usePost";
import { ApiError } from "../../services/api";
import { getPostImageUrls } from "../../utils/mapPost";
import type { Post } from "../../types/community";

const MAX_CAPTION_LENGTH = 100;

type EditPostModalProps = {
	post: Post;
	isOpen: boolean;
	onClose: () => void;
};

/** PATCH /posts/{postId} — 캡션 수정 (기존 이미지 유지) */
export default function EditPostModal({
	post,
	isOpen,
	onClose,
}: EditPostModalProps) {
	const { data: detailPost } = usePost(isOpen ? post.id : undefined);
	const source = detailPost ?? post;
	const imageUrls = getPostImageUrls(source);

	const [caption, setCaption] = useState(source.caption);
	const [error, setError] = useState<string | null>(null);
	const { mutateAsync: updatePostMutate, isPending } = useUpdatePost();

	useEffect(() => {
		if (!isOpen) return;
		setCaption(source.caption);
		setError(null);
	}, [isOpen, source.caption]);

	if (!isOpen) return null;

	const handleClose = () => {
		if (isPending) return;
		onClose();
	};

	const handleSubmit = async () => {
		setError(null);
		try {
			await updatePostMutate({
				postId: source.id,
				caption,
			});
			onClose();
		} catch (err) {
			setError(
				err instanceof ApiError
					? err.message
					: err instanceof Error
						? err.message
						: "수정에 실패했습니다.",
			);
		}
	};

	return createPortal(
		<div
			className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-6 max-lg:bg-surface max-lg:p-0"
			onClick={handleClose}
			role="presentation">
			<div
				className="w-full max-w-[640px] overflow-hidden rounded-2xl bg-white max-lg:min-h-dvh max-lg:max-w-none max-lg:rounded-none max-lg:bg-surface"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label="게시글 수정">
				<div className="relative flex h-[52px] items-center justify-center border-b border-black/10 px-4">
					<p className="text-[15px] font-semibold text-black">게시글 수정</p>
					<button
						type="button"
						aria-label="닫기"
						onClick={handleClose}
						disabled={isPending}
						className="absolute right-4 text-black/60 transition hover:text-black disabled:opacity-50">
						<CloseIcon size={18} />
					</button>
				</div>

				<div className="flex gap-5 p-6 max-lg:flex-col max-lg:px-5 max-lg:pt-20">
					<div className="w-[240px] shrink-0 max-lg:hidden">
						<div className="aspect-[3/4] overflow-hidden rounded-[10px] bg-[#D9D9D9]">
							{imageUrls[0] ? (
								<img
									src={imageUrls[0]}
									alt=""
									className="size-full object-cover"
								/>
							) : null}
						</div>
						{imageUrls.length > 1 && (
							<p className="mt-2 text-center text-[12px] font-light text-black/40">
								사진 {imageUrls.length}장 (수정 시 유지)
							</p>
						)}
					</div>

					<div className="flex min-w-0 flex-1 flex-col">
						<label className="text-[13px] font-semibold text-black/60">
							문구
						</label>
						<div className="relative mt-2 flex-1">
							<textarea
								value={caption}
								onChange={(e) =>
									setCaption(
										e.target.value.slice(0, MAX_CAPTION_LENGTH),
									)
								}
								placeholder="문구를 입력해주세요..."
								className="h-full min-h-[220px] w-full resize-none rounded-[10px] border border-black/15 p-3 text-[13px] font-light leading-5 text-black outline-none placeholder:text-black/35 focus:border-brand/50"
							/>
							<span className="absolute bottom-2.5 right-3 text-[11px] font-light text-black/35">
								{caption.length}/{MAX_CAPTION_LENGTH}
							</span>
						</div>
						{error && (
							<p className="mt-2 text-[12px] text-brand">{error}</p>
						)}
						<button
							type="button"
							onClick={() => void handleSubmit()}
							disabled={isPending}
							className="mt-4 h-[44px] rounded-full bg-brand text-[14px] font-semibold text-white transition hover:brightness-95 disabled:opacity-50 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20 max-lg:h-[60px] max-lg:rounded-b-none max-lg:rounded-t-[10px] max-lg:text-[20px]">
							{isPending ? "저장 중…" : "저장"}
						</button>
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
}
