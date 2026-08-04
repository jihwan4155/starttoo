import type { Artist, ArtistItem } from "../types/artist";

/**
 * Swagger ArtistListItem → UI Artist
 *
 * 응답의 숍 필드는 중첩 객체가 아니라 평평하다. 주소가 비어 있으면 도시·숍 이름을
 * 이어 붙여 최소한 어디인지는 보이게 한다.
 */
export function mapArtistItem(dto: ArtistItem): Artist {
	const address =
		dto.shopAddress?.trim() ||
		[dto.shopCity, dto.shopName].filter(Boolean).join(" · ") ||
		"";

	return {
		id: dto.userSeq,
		name: dto.nickname,
		isOpen: false,
		hoursLabel: dto.shopDetails?.trim() || "",
		distanceKm: null,
		address,
		categories: [],
		avatarUrl: dto.profileImageUrl ?? "",
		imageUrls: dto.posts.map((post) => post.imageUrl),
	};
}
