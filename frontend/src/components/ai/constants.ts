import demoTattoo from "../../assets/images/demo-tattoo.png";

export type GenreTag = {
	id: string;
	label: string;
	image: string;
};

export const GENRE_TAGS: GenreTag[] = [
	{ id: "old-school", label: "올드스쿨", image: demoTattoo },
	{ id: "new-school", label: "뉴스쿨", image: demoTattoo },
	{ id: "minimal", label: "미니멀", image: demoTattoo },
	{ id: "blackwork", label: "블랙워크", image: demoTattoo },
	{ id: "lettering", label: "레터링", image: demoTattoo },
	{ id: "tribal", label: "트라이벌", image: demoTattoo },
	{ id: "watercolor", label: "워터컬러", image: demoTattoo },
	{ id: "geometric", label: "지오메트릭", image: demoTattoo },
];

export const MAX_GENRE_SELECTION = 2;
export const MAX_REFERENCE_IMAGES = 3;
