import { Link } from "react-router-dom";

type MyPageHeaderProps = {
	nickname: string;
	avatarUrl: string | null;
};

export default function MyPageHeader({
	nickname,
	avatarUrl,
}: MyPageHeaderProps) {
	return (
		<div className="flex items-end justify-between">
			<div className="flex items-center gap-6">
				{avatarUrl ? (
					<img
						src={avatarUrl}
						alt={`${nickname}의 프로필 이미지`}
						className="size-[100px] shrink-0 rounded-full object-cover"
					/>
				) : (
					<span className="size-[100px] shrink-0 rounded-full bg-[#D9D9D9]" />
				)}
				<div>
					<p className="text-[22px] font-bold text-black">{nickname}</p>
					<div className="mt-2 flex items-center gap-4 text-[15px] font-light text-black/60">
						<span>팔로워 321명</span>
						<span>팔로잉 123명</span>
					</div>
				</div>
			</div>

			<div className="flex flex-col items-end gap-4">
				<Link
					to="/mypage/edit"
					className="rounded-full bg-brand px-6 py-1.5 text-[14px] font-semibold text-white transition hover:brightness-95">
					프로필 수정
				</Link>
				{/* TODO: 타투이스트 인증 신청 플로우 연동 */}
				<button
					type="button"
					className="text-[13px] font-light text-black/40 underline underline-offset-2 transition hover:text-black/60">
					타투이스트 인증 뱃지 신청
				</button>
			</div>
		</div>
	);
}
