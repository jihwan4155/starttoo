import { useMutation } from "@tanstack/react-query";
import { extractDesign } from "../../services/designExtractApi";

export default function useDesignExtractMutation() {
	return useMutation({
		mutationFn: extractDesign,
	});
}
