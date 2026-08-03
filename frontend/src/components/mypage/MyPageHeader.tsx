import { Link } from "react-router-dom";
import ArtistBadge from "../common/ArtistBadge";
import type { FollowListKind } from "../../hooks/queries/useFollowList";
import { resolveAvatar } from "../../utils/profile";

type MyPageHeaderProps = {
	nickname: string;
	avatarUrl: string | null;
	/** 불러온 내 게시글 수 — 아직 세지 못했으면 undefined */
	postCount?: number;
	followerCount?: number;
	followingCount?: number;
	isLoading?: boolean;
	/** GET /users/me — role === "ARTIST" */
	isArtist?: boolean;
	/** 팔로워·팔로우 숫자 클릭 — 목록 모달을 연다 */
	onOpenFollowList?: (kind: FollowListKind) => void;
};

export default function MyPageHeader({
	nickname,
	avatarUrl,
	postCount,
	followerCount,
	followingCount,
	isLoading = false,
	isArtist = false,
	onOpenFollowList,
}: MyPageHeaderProps) {
	const displayAvatar = resolveAvatar(avatarUrl, nickname);

	const formatCount = (count?: number) =>
		isLoading && count == null ? "—" : `${(count ?? 0).toLocaleString()}명`;

	return (
		<div className="relative flex items-end justify-between rounded-[12px] bg-white p-4 lg:rounded-none lg:bg-transparent lg:p-0">
			<div className="flex items-center gap-4 lg:gap-6">
				<img
					src={displayAvatar}
					alt={`${nickname || "내"} 프로필 이미지`}
					className="size-[58px] shrink-0 rounded-full bg-[#D9D9D9] object-cover lg:size-[100px]"
				/>
				<div className="min-w-0">
					<p className="flex items-center gap-2 text-[18px] font-bold text-black lg:text-[22px]">
						<span className="truncate">
							{isLoading && !nickname ? "불러오는 중…" : nickname || "—"}
						</span>
						{isArtist && <ArtistBadge size={18} />}
					</p>
					<div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-light text-black/55 lg:mt-2 lg:text-[15px]">
						{/* 게시물은 목록이 따로 없어 상대 프로필과 마찬가지로 클릭 대상이 아니다 */}
						<span>
							게시물 {postCount == null ? "—" : postCount.toLocaleString()}
						</span>
						<button
							type="button"
							onClick={() => onOpenFollowList?.("followers")}
							className="rounded transition hover:text-black">
							팔로워 {formatCount(followerCount)}
						</button>
						<button
							type="button"
							onClick={() => onOpenFollowList?.("following")}
							className="rounded transition hover:text-black">
							팔로우 {formatCount(followingCount)}
						</button>
					</div>
				</div>
			</div>

			<div className="flex flex-col items-end gap-4">
				<Link
					to="/mypage/edit"
					aria-label="프로필 수정"
					className="absolute right-3 top-3 flex size-8 items-center justify-center text-brand transition hover:brightness-95 lg:static lg:size-auto lg:rounded-full lg:bg-brand lg:px-6 lg:py-1.5 lg:text-[14px] lg:font-semibold lg:text-white">
					<svg className="lg:hidden" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 17.5V20h2.5L18.8 7.7l-2.5-2.5L4 17.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="m14.8 6.7 2.5 2.5" stroke="currentColor" strokeWidth="2"/></svg><span className="hidden lg:inline">프로필 수정</span>
				</Link>
			</div>
		</div>
	);
}
