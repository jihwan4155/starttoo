import { useNavigate } from "react-router-dom";
import ArtistBadge from "../common/ArtistBadge";
import usePost from "../../hooks/queries/usePost";
import { resolveAvatar } from "../../utils/profile";
import { getPostImageUrls } from "../../utils/mapPost";

type SharedPostCardProps = {
	postId: number;
	/** 내 말풍선인지 — 테두리 대비만 다르게 준다 */
	mine: boolean;
};

/**
 * DM에 공유된 피드 카드.
 *
 * DM 메시지에 피드를 첨부하는 타입이 없어 본문에 주소를 실어 보낸다.
 * 받는 쪽에서 그 주소를 알아보고 GET /posts/{id}로 내용을 채워 카드로 그린다.
 * 카드를 누르면 피드 상세(/posts/:postId)로 간다.
 *
 * 삭제된 피드가면 조회가 실패한다. 말풍선 자체는 남겨야 대화가 끊기지 않으므로
 * 카드 자리에 안내만 남기고 이동은 막는다.
 */
export default function SharedPostCard({ postId, mine }: SharedPostCardProps) {
	const navigate = useNavigate();
	const { data: post, isPending, isError } = usePost(postId);

	// 말풍선이 max-w-75%라 좁은 화면에서는 240px를 다 못 준다 — max-w-full로 접히게 둔다.
	// 내 말풍선(브랜드색) 안에서도 카드는 흰 배경으로 두어 피드 미리보기가 또렷하게 보이게 한다.
	const frameClass = `block w-[240px] max-w-full overflow-hidden rounded-[14px] border text-left transition ${
		mine ? "border-white/40 bg-white" : "border-black/10 bg-white"
	}`;

	if (isPending) {
		return (
			<div className={frameClass}>
				<div className="aspect-[4/5] w-full animate-pulse bg-black/10" />
				<div className="px-3 py-2.5">
					<div className="h-3 w-24 animate-pulse rounded bg-black/10" />
				</div>
			</div>
		);
	}

	if (isError || !post) {
		return (
			<div className={`${frameClass} px-3 py-4`}>
				<p className="text-[12px] font-light leading-5 text-black/45">
					삭제되었거나 볼 수 없는 피드예요.
				</p>
			</div>
		);
	}

	const thumbnail = getPostImageUrls(post)[0] ?? post.imageUrl;

	return (
		<button
			type="button"
			onClick={() => navigate(`/posts/${post.id}`)}
			aria-label={`${post.author.nickname}의 피드 보기`}
			className={`${frameClass} hover:brightness-95`}>
			{thumbnail ? (
				<img
					src={thumbnail}
					alt=""
					className="aspect-[4/5] w-full bg-black/5 object-cover"
				/>
			) : (
				<div className="flex aspect-[4/5] w-full items-center justify-center bg-black/5 text-[12px] font-light text-black/35">
					이미지 없음
				</div>
			)}

			<div
				className={`flex items-center gap-2 px-3 pt-2.5 ${
					post.caption ? "" : "pb-2.5"
				}`}>
				<img
					src={resolveAvatar(post.author.avatarUrl, post.author.nickname)}
					alt=""
					className="size-5 shrink-0 rounded-full bg-black/10 object-cover"
				/>
				<span className="min-w-0 truncate text-[12px] font-semibold text-black">
					{post.author.nickname}
				</span>
				{post.author.isArtist && <ArtistBadge size={13} />}
			</div>

			{post.caption && (
				<p className="line-clamp-2 px-3 pb-2.5 pt-1 text-[12px] font-light leading-4 text-black/60">
					{post.caption}
				</p>
			)}
		</button>
	);
}
