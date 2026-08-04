import type { Post } from "../../types/community";

type PostThumbnailGridProps = {
	posts: Post[];
	onOpen: (post: Post) => void;
};

export default function PostThumbnailGrid({
	posts,
	onOpen,
}: PostThumbnailGridProps) {
	return (
		<div className="grid grid-cols-3 gap-0.5 px-4 lg:grid-cols-4 lg:gap-1 lg:px-0">
			{posts.map((post) => (
				<button
					key={post.id}
					type="button"
					onClick={() => onOpen(post)}
					aria-label={`${post.author.nickname}의 게시글`}
					className="aspect-square overflow-hidden bg-[#D9D9D9] transition hover:opacity-90 lg:rounded-[6px]">
					{post.imageUrl && (
						<img
							src={post.imageUrl}
							alt=""
							className="size-full object-cover"
						/>
					)}
				</button>
			))}
		</div>
	);
}
