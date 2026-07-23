import { useMutation } from "@tanstack/react-query";
import { requestCoverupRecommendation } from "../../services/coverupApi";

export default function useCoverupRecommendationMutation() {
	return useMutation({
		mutationFn: requestCoverupRecommendation,
	});
}
