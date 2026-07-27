import type { Artist, ArtistItem } from "../types/artist";

/** Swagger ArtistItem → UI Artist */
export function mapArtistItem(dto: ArtistItem): Artist {
	const shop = dto.shop;
	const address =
		shop?.shopAddress?.trim() ||
		[shop?.shopCity, shop?.shopName].filter(Boolean).join(" · ") ||
		"";

	return {
		id: dto.userId,
		name: dto.nickname,
		isOpen: false,
		hoursLabel: shop?.businessHours?.trim() || "",
		distanceKm: null,
		address,
		categories: [],
		avatarUrl: dto.profileImageUrl ?? "",
		imageUrls: dto.feedPreviews.map((preview) => preview.imageUrl),
	};
}
