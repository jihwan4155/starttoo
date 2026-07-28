import { Link } from "react-router-dom";
import usePosts from "../../hooks/queries/usePosts";

/** 홈 커뮤니티 미리보기 — GET /posts 최신 4건 */
export default function CommunitySection() {
	const { data } = usePosts({ size: 4, sort: "LATEST" });
	const previewPosts = data?.pages[0]?.items ?? [];

	return (
		<section
			id="community"
			className="mx-auto flex w-full max-w-[1199px] flex-col items-center px-0 pb-24 pt-20">
			<p className="text-[24px] font-normal leading-7 text-brand">COMMUNITY</p>
			<h2 className="mt-3 text-center text-[48px] font-extrabold leading-[57px] text-black">
				다른 사람들은 어떻게 그렸을까요?
			</h2>
			<p className="mt-4 text-center text-[18px] font-light leading-[21px] text-black">
				커뮤니티에서 도안과 후기를 나눠보세요
			</p>

			<div className="mt-10 flex gap-[34px]">
				{previewPosts.length === 0
					? Array.from({ length: 4 }).map((_, index) => (
							<div
								key={index}
								className="h-[200px] w-[200px] shrink-0 rounded-[10px] bg-[#D9D9D9]"
							/>
						))
					: previewPosts.map((post) => (
							<Link
								key={post.id}
								to="/posts"
								className="block shrink-0 transition hover:opacity-90">
								<img
									src={post.imageUrl ?? undefined}
									alt={`${post.author.nickname}의 게시글`}
									className="h-[200px] w-[200px] rounded-[10px] bg-[#D9D9D9] object-cover"
								/>
							</Link>
						))}
			</div>

			<Link
				to="/posts"
				className="mt-8 text-[16px] font-light text-black/60 transition hover:text-black">
				→ 피드 보러가기
			</Link>
		</section>
	);
}
