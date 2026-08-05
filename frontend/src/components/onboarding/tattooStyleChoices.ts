/**
 * 온보딩 스타일 설문에 쓰는 대표 이미지.
 *
 * 파일은 public/images/tattoo-styles 아래에 있고, code는 백엔드
 * primary_styles.style_code와 맞춘다. seq는 DB가 매기는 값이라 여기 두지 않고
 * GET /classifications/primary-styles 응답에서 code로 찾아 쓴다.
 *
 * 서버에 있는 11개 스타일 중 abstract_experimental만 대표 이미지가 없어 빠져
 * 있다. 이미지가 생기면 여기에 한 줄 추가하면 된다.
 */
export type TattooStyleChoice = {
	/** primary_styles.style_code */
	code: string;
	label: string;
	imageUrl: string;
};

/** 파일명이 style_code와 다른 경우가 있어(onamental) 경로를 따로 적는다 */
export const TATTOO_STYLE_CHOICES: TattooStyleChoice[] = [
	{
		code: "minimal",
		label: "미니멀",
		imageUrl: "/images/tattoo-styles/minimal.png",
	},
	{
		code: "japanese",
		label: "재패니즈",
		imageUrl: "/images/tattoo-styles/japanese.png",
	},
	{
		code: "realism",
		label: "리얼리즘",
		imageUrl: "/images/tattoo-styles/realism.png",
	},
	{
		code: "geometric",
		label: "지오메트릭",
		imageUrl: "/images/tattoo-styles/geometric.png",
	},
	{
		code: "lettering",
		label: "레터링",
		imageUrl: "/images/tattoo-styles/lettering.png",
	},
	{
		code: "new_school",
		label: "뉴스쿨",
		imageUrl: "/images/tattoo-styles/new_school.png",
	},
	{
		code: "western_traditional",
		label: "트래디셔널",
		imageUrl: "/images/tattoo-styles/western_traditional.png",
	},
	{
		// 서버 code는 ornamental인데 넘겨받은 파일명이 onamental이다
		code: "ornamental",
		label: "오너멘탈",
		imageUrl: "/images/tattoo-styles/onamental.png",
	},
	{
		code: "tribal_indigenous",
		label: "트라이벌",
		imageUrl: "/images/tattoo-styles/tribal.png",
	},
	{
		code: "graphic_illustrative",
		label: "그래픽",
		imageUrl: "/images/tattoo-styles/graphic_illustrative.png",
	},
];
