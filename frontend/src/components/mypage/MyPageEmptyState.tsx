type MyPageEmptyStateProps = {
	message: string;
	actionLabel?: string;
	onAction?: () => void;
};

export default function MyPageEmptyState({
	message,
	actionLabel,
	onAction,
}: MyPageEmptyStateProps) {
	return (
		<div className="flex flex-col items-center gap-6 py-24">
			<p className="text-[15px] font-light text-black/50">{message}</p>
			{actionLabel && onAction && (
				<button
					type="button"
					onClick={onAction}
					className="rounded-full bg-brand px-8 py-3 text-[15px] font-semibold text-white transition hover:brightness-95">
					{actionLabel}
				</button>
			)}
		</div>
	);
}
