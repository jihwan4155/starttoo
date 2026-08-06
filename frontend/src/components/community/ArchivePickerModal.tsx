import { createPortal } from "react-dom";
import { CloseIcon } from "./icons";
import StarttooLoader from "../loader/StarttooLoader";
import useArchive from "../../hooks/queries/useArchive";
import useBackClose from "../../hooks/useBackClose";
import { ApiError } from "../../services/api";
import type { ArchiveItem } from "../../types/archive";

type ArchivePickerModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onSelect: (item: ArchiveItem) => void;
	title?: string;
};

/** 보관함 이미지 선택 모달 */
export default function ArchivePickerModal({
	isOpen,
	onClose,
	onSelect,
	title = "보관함에서 선택",
}: ArchivePickerModalProps) {
	const { data, isPending, isError, error } = useArchive({ size: 30 });
	const items = data?.pages.flatMap((page) => page.items) ?? [];

	// 뒤로가기는 페이지를 떠나는 대신 이 창만 닫는다
	useBackClose(isOpen, onClose);

	if (!isOpen) return null;

	const errorMessage =
		error instanceof ApiError
			? error.message
			: "보관함을 불러오지 못했습니다.";

	return createPortal(
		<div
			className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-3 sm:p-6"
			onClick={onClose}
			role="presentation">
			<div
				className="flex max-h-[85vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-white"
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label={title}>
				<div className="flex items-center justify-between border-b border-black/10 px-4 py-3 sm:px-5 sm:py-4">
					<p className="text-[15px] font-semibold text-black">{title}</p>
					<button
						type="button"
						aria-label="닫기"
						onClick={onClose}
						className="text-black/60 transition hover:text-black">
						<CloseIcon size={18} />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto p-3 sm:p-5">
					{isPending && (
						<StarttooLoader
							variant="block"
							size={170}
							label="보관함을 불러오는 중…"
						/>
					)}
					{isError && (
						<p className="py-10 text-center text-[13px] text-black/60">
							{errorMessage}
						</p>
					)}
					{!isPending && !isError && items.length === 0 && (
						<p className="py-10 text-center text-[13px] text-black/40">
							보관함에 저장된 도안이 없습니다.
						</p>
					)}
					{items.length > 0 && (
						<div className="grid grid-cols-3 gap-2 sm:gap-3">
							{items.map((item) => (
								<button
									key={item.tattooId}
									type="button"
									onClick={() => {
										onSelect(item);
										onClose();
									}}
									className="aspect-square overflow-hidden rounded-[8px] bg-[#D9D9D9] transition hover:opacity-90">
									<img
										src={item.designImageUrl || item.originalImageUrl}
										alt=""
										className="h-full w-full object-cover"
									/>
								</button>
							))}
						</div>
					)}
				</div>
			</div>
		</div>,
		document.body,
	);
}
