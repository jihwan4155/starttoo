import { useMemo } from "react";
import { MAX_ARCHIVE_DESIGNS } from "../../constants/archive";
import useArchive from "./useArchive";

/**
 * 도안 보관함 용량 — 저장 전에 가득 찼는지 확인할 때 쓴다.
 *
 * size=MAX로 첫 페이지만 본다. 20개면 가득 찬 것이고, 이미 저장된 seq인지도
 * 이 목록에서 판별한다(가득 찬 상태면 전 항목이 한 페이지에 들어온다).
 */
export default function useArchiveCapacity() {
	const query = useArchive({ size: MAX_ARCHIVE_DESIGNS });
	const items = useMemo(
		() => query.data?.pages.flatMap((page) => page.items) ?? [],
		[query.data?.pages],
	);
	const count = items.length;
	const isFull = count >= MAX_ARCHIVE_DESIGNS;

	const hasTattoo = (tattooSeq: number) =>
		items.some((item) => item.tattooId === tattooSeq);

	return {
		count,
		isFull,
		max: MAX_ARCHIVE_DESIGNS,
		hasTattoo,
		isPending: query.isPending,
		isError: query.isError,
	};
}
