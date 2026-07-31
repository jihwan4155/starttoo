import { useMutation, useQueryClient } from "@tanstack/react-query";
import { POST_UPLOAD_PURPOSE } from "../../constants/upload";
import { postsQueryKey } from "../queries/usePosts";
import { createPost } from "../../services/communityApi";
import { uploadImage } from "../../services/uploadApi";
import { mapPostResponse } from "../../utils/mapPost";

type CreatePostVariables = {
	files: File[];
	caption: string;
};

/** POST /posts — 이미지 presigned 업로드 후 게시글 생성 */
export default function useCreatePost() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ files, caption }: CreatePostVariables) => {
			const imageSeqs = await Promise.all(
				files.map((file) => uploadImage(file, POST_UPLOAD_PURPOSE)),
			);
			const trimmed = caption.trim();
			const response = await createPost({
				content: trimmed || undefined,
				imageSeqs,
			});
			return mapPostResponse(response);
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: postsQueryKey });
		},
	});
}
