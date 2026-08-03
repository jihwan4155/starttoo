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
	/** 일반 회원의 인증 뱃지 신청 */
	onRequestArtistBadge?: () => void;
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
	onRequestArtistBadge,
}: MyPageHeaderProps) {
	const displayAvatar = resolveAvatar(avatarUrl, nickname);

	const formatCount = (count?: number) =>
		isLoading && count == null ? "—" : `${(count ?? 0).toLocaleString()}명`;

	return (
		<div className="flex items-end justify-between">
			<div className="flex items-center gap-6">
				<img
					src={displayAvatar}
					alt={`${nickname || "내"} 프로필 이미지`}
					className="size-[100px] shrink-0 rounded-full bg-[#D9D9D9] object-cover"
				/>
				<div className="min-w-0">
					<p className="flex items-center gap-2 text-[22px] font-bold text-black">
						<span className="truncate">
							{isLoading && !nickname ? "불러오는 중…" : nickname || "—"}
						</span>
						{isArtist && <ArtistBadge size={18} />}
					</p>
					<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] font-light text-black/60">
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

			<div className="flex flex-col items-end gap-2">
				<Link
					to="/mypage/edit"
					className="rounded-full bg-brand px-6 py-1.5 text-[14px] font-semibold text-white transition hover:brightness-95">
					프로필 수정
				</Link>
				{!isArtist && (
					<button
						type="button"
						onClick={onRequestArtistBadge}
						className="text-[13px] font-light text-black/50 underline-offset-4 transition hover:text-black hover:underline">
						타투이스트 인증 뱃지 신청
					</button>
				)}
			</div>
		</div>
	);
}
