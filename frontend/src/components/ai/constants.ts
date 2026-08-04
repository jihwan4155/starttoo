import demoTattoo from "../../assets/images/demo-tattoo.png";

export type GenreTag = {
	id: string;
	label: string;
	image: string;
	apiStyle: string;
};

export const GENRE_TAGS: GenreTag[] = [
	{ id: "abstract", label: "추상", image: demoTattoo, apiStyle: "abstract_experimental" },
	{ id: "geometric-ornamental", label: "지오메트릭·오너멘탈", image: demoTattoo, apiStyle: "geometric_ornamental" },
	{ id: "lettering", label: "레터링", image: demoTattoo, apiStyle: "lettering" },
	{ id: "illustration", label: "일러스트", image: demoTattoo, apiStyle: "graphic_illustrative" },
	{ id: "japanese", label: "재패니즈", image: demoTattoo, apiStyle: "japanese" },
	{ id: "minimal", label: "미니멀", image: demoTattoo, apiStyle: "minimal" },
	{ id: "new-school", label: "뉴스쿨", image: demoTattoo, apiStyle: "new_school" },
	{ id: "realism", label: "리얼리즘", image: demoTattoo, apiStyle: "realism" },
	{ id: "tribal", label: "트라이벌", image: demoTattoo, apiStyle: "tribal_indigenous" },
	{ id: "old-school", label: "올드스쿨", image: demoTattoo, apiStyle: "western_traditional" },
];

export const MAX_GENRE_SELECTION = 2;
export const MAX_REFERENCE_IMAGES = 1;
