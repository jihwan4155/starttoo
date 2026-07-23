import { Link } from "react-router-dom";
import { MOCK_EXPLORE_POSTS } from "../../mocks/community";

const PREVIEW_POSTS = MOCK_EXPLORE_POSTS.slice(0, 4);

export default function CommunitySection() {
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
				{PREVIEW_POSTS.map((post) => (
					<img
						key={post.id}
						src={post.imageUrl ?? undefined}
						alt={`${post.author.nickname}의 게시글`}
						className="h-[200px] w-[200px] shrink-0 rounded-[10px] bg-[#D9D9D9] object-cover"
					/>
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
