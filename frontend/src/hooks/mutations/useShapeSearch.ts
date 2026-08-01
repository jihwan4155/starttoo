import { useMutation } from "@tanstack/react-query";
import { searchByShape } from "../../services/shapeSearchApi";
import type { SearchMode } from "../../types/shapeSearch";

type ShapeSearchVariables = {
	maskPngB64: string;
	mode: SearchMode;
};

/** POST /designs/search-by-shape */
export default function useShapeSearchMutation() {
	return useMutation({
		mutationFn: ({ maskPngB64, mode }: ShapeSearchVariables) =>
			searchByShape(maskPngB64, mode),
	});
}
