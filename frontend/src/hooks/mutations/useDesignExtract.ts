import { useMutation } from "@tanstack/react-query";
import { getStoredDesign } from "../../services/designExtractApi";

const MIN_LOADING_MS = 1_000;
const MAX_LOADING_MS = 5_000;

function waitForSimulatedExtraction(): Promise<void> {
	const duration =
		MIN_LOADING_MS +
		Math.floor(Math.random() * (MAX_LOADING_MS - MIN_LOADING_MS + 1));

	return new Promise((resolve) => {
		window.setTimeout(resolve, duration);
	});
}

export default function useDesignExtractMutation() {
	return useMutation({
		mutationFn: async (tattooSeq: number) => {
			const [result] = await Promise.all([
				getStoredDesign(tattooSeq),
				waitForSimulatedExtraction(),
			]);
			return result;
		},
	});
}
