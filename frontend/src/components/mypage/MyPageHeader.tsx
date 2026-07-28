import { Link } from "react-router-dom";
import ArtistBadge from "../common/ArtistBadge";
import { resolveAvatar } from "../../utils/profile";

type MyPageHeaderProps = {
	nickname: string;
	avatarUrl: string | null;
	followerCount?: number;
	followingCount?: number;
	isLoading?: boolean;
	/** GET /users/me — role === "ARTIST" */
	isArtist?: boolean;
};

export default function MyPageHeader({
	nickname,
	avatarUrl,
	followerCount,
	followingCount,
	isLoading = false,
	isArtist = false,
}: MyPageHeaderProps) {
	const displayAvatar = resolveAvatar(avatarUrl, nickname);

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
						<span>
							팔로워{" "}
							{isLoading && followerCount == null
								? "—"
								: `${(followerCount ?? 0).toLocaleString()}명`}
						</span>
						<span>
							팔로잉{" "}
							{isLoading && followingCount == null
								? "—"
								: `${(followingCount ?? 0).toLocaleString()}명`}
						</span>
					</div>
				</div>
			</div>

			<div className="flex flex-col items-end gap-4">
				<Link
					to="/mypage/edit"
					className="rounded-full bg-brand px-6 py-1.5 text-[14px] font-semibold text-white transition hover:brightness-95">
					프로필 수정
				</Link>
			</div>
		</div>
	);
}
