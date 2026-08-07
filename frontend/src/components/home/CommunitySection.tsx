import { useMemo } from "react";
import { Link } from "react-router-dom";
import usePosts from "../../hooks/queries/usePosts";
import useHiddenIdsForUser from "../../hooks/useHiddenIdsForUser";
import { filterVisiblePosts } from "../../utils/filterPosts";

/** 홈 커뮤니티 미리보기 — GET /posts 최신 4건 */
export default function CommunitySection() {
	const { data } = usePosts({ size: 4 });
	const hiddenIds = useHiddenIdsForUser();
	const previewPosts = useMemo(() => {
		const items = data?.pages[0]?.items ?? [];
		return filterVisiblePosts(items, hiddenIds);
	}, [data?.pages, hiddenIds]);

	return (
		<section
			id="community"
			className="mx-auto flex w-full max-w-[1199px] flex-col items-center px-5 pb-13 pt-12 lg:px-0 lg:pb-24 lg:pt-20">
			<p className="text-center text-[16px] font-normal leading-6 text-brand lg:text-[24px] lg:leading-7">
				COMMUNITY
			</p>
			<h2 className="mt-2.5 text-center text-[27px] font-extrabold leading-[34px] tracking-[-0.04em] text-black lg:mt-3 lg:text-[48px] lg:leading-[57px]">
				다른 사람들은 어떻게 그렸을까요?
			</h2>
			<p className="mt-3 text-center text-[15px] font-light leading-6 text-black/70 lg:mt-4 lg:text-[18px] lg:leading-[21px] lg:text-black">
				커뮤니티에서 도안과 후기를 나눠보세요
			</p>

			<div className="mt-8 grid w-full grid-cols-2 gap-3 lg:mt-10 lg:flex lg:w-auto lg:gap-[34px]">
				{previewPosts.length === 0
					? Array.from({ length: 4 }).map((_, index) => (
							<div
								key={index}
								className="aspect-square h-auto w-full shrink-0 rounded-[10px] bg-[#D9D9D9] lg:h-[200px] lg:w-[200px]"
							/>
						))
					: previewPosts.map((post) => (
							<Link
								key={post.id}
								to="/posts"
								className="block shrink-0 transition hover:opacity-90">
								<img
									src={post.imageUrl ?? undefined}
									alt={`${post.author.nickname}의 피드`}
									className="aspect-square h-auto w-full rounded-[10px] bg-[#D9D9D9] object-cover lg:h-[200px] lg:w-[200px]"
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
