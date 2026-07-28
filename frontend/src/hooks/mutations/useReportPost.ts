import { useMutation } from "@tanstack/react-query";
import { reportPost } from "../../services/communityApi";
import type { ReportReasonCode } from "../../types/community";

type ReportPostVariables = {
	postId: number;
	reasonCode: ReportReasonCode;
	reasonDetail?: string;
};

/** POST /posts/{postId}/reports */
export default function useReportPost() {
	return useMutation({
		mutationFn: ({ postId, reasonCode, reasonDetail }: ReportPostVariables) =>
			reportPost(postId, { reasonCode, reasonDetail }),
	});
}
