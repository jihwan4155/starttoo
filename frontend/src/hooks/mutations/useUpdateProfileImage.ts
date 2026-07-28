import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PROFILE_UPLOAD_PURPOSE } from "../../constants/upload";
import { updateProfileImage } from "../../services/userApi";
import { uploadImage } from "../../services/uploadApi";
import { meQueryKey } from "../queries/useMe";

/** presigned 업로드 → PUT /users/me/profile-image */
export default function useUpdateProfileImage() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (file: File) => {
			const objectKey = await uploadImage(file, PROFILE_UPLOAD_PURPOSE);
			return updateProfileImage({ profileImageObjectKey: objectKey });
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: meQueryKey });
		},
	});
}
