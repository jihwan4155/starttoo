import demoTattoo from "../../assets/images/demo-tattoo.png";

export type GenreTag = {
	id: string;
	label: string;
	image: string;
};

export const GENRE_TAGS: GenreTag[] = [
	{ id: "abstract", label: "추상", image: demoTattoo },
	{ id: "geometric", label: "지오메트릭", image: demoTattoo },
	{ id: "illustration", label: "일러스트", image: demoTattoo },
	{ id: "japanese", label: "재패니즈", image: demoTattoo },
	{ id: "minimal", label: "미니멀", image: demoTattoo },
	{ id: "new-school", label: "뉴스쿨", image: demoTattoo },
	{ id: "realism", label: "리얼리즘", image: demoTattoo },
	{ id: "tribal", label: "트라이벌", image: demoTattoo },
	{ id: "old-school", label: "올드스쿨", image: demoTattoo },
];

export const MAX_GENRE_SELECTION = 2;
export const MAX_REFERENCE_IMAGES = 1;
