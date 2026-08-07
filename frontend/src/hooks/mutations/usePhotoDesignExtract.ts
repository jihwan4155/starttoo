import { useMutation } from "@tanstack/react-query";
import { extractDesignFromPhoto } from "../../services/photoExtractApi";
/** 올린 사진 → 타투 판정 → 도안 추출 → 저장 가능한 서버 도안 등록. */
export default function usePhotoDesignExtractMutation() {
	return useMutation({
		mutationFn: extractDesignFromPhoto,
	});
}
