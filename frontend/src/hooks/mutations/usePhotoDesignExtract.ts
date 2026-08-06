import { useMutation } from "@tanstack/react-query";
import { extractDesignFromPhoto } from "../../services/photoExtractApi";
import type { DesignExtractResult } from "../../types/designExtract";

/**
 * 올린 사진 → 도안 PNG.
 *
 * 결과는 objectURL이라 화면에서 다 쓰고 나면 반드시 revoke해야 한다
 * (호출하는 쪽에서 이전 결과를 정리한다).
 */
export default function usePhotoDesignExtractMutation() {
	return useMutation({
		mutationFn: async (file: File): Promise<DesignExtractResult> => {
			const blob = await extractDesignFromPhoto(file);
			const objectUrl = URL.createObjectURL(blob);
			return { previewUrl: objectUrl, downloadUrl: objectUrl };
		},
	});
}
