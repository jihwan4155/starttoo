export default function PlaceholderPage({ title }: { title: string }) {
	return (
		<div className="flex min-h-[calc(100vh-60px)] items-center justify-center bg-surface">
			<h1 className="text-[32px] font-extrabold text-black">{title}</h1>
		</div>
	);
}
