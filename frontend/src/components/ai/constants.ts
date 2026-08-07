export type GenreTag = {
	id: string;
	label: string;
	image: string;
	/** 도안 이미지 모서리에서 샘플링한 배경색 */
	bgColor: string;
	apiStyle: string;
	description: string;
};

/** 화면에 놓이는 차례가 곧 이 배열의 차례다 — 기획에서 정한 순서를 그대로 둔다 */
export const GENRE_TAGS: GenreTag[] = [
	{
		id: "minimal",
		label: "미니멀",
		image: "/images/tattoo-styles/minimal.png",
		bgColor: "#f7f7f2",
		apiStyle: "minimal",
		description:
			"얇은 라인과 단순한 요소로 깔끔하고 세련되게 포인트를 주는 심플한 타투 스타일입니다.",
	},
	{
		id: "tribal",
		label: "트라이벌",
		image: "/images/tattoo-styles/tribal.png",
		bgColor: "#f5f5f2",
		apiStyle: "tribal_indigenous",
		description:
			"고대 부족의 문양에서 유래된 스타일로, 두껍고 강렬한 검은색 면과 패턴을 통해 강인함과 생동감을 연출합니다.",
	},
	{
		id: "realism",
		label: "리얼리즘",
		image: "/images/tattoo-styles/realism.png",
		bgColor: "#f5f5f1",
		apiStyle: "realism",
		description:
			"정교한 섀도잉과 섬세한 디테일 표현을 통해 실물이나 사진을 있는 그대로 옮겨 놓은 듯한 포토 타투 스타일입니다.",
	},
	{
		id: "geometric",
		label: "지오메트릭",
		image: "/images/tattoo-styles/geometric.png",
		bgColor: "#f5f5f1",
		apiStyle: "geometric_ornamental",
		description:
			"직선과 곡선, 완벽한 도형의 조화로 규칙적이고 감각적인 수학적 미학을 표현하는 스타일입니다.",
	},
	{
		id: "graphic-illustrative",
		label: "그래픽 일러스트",
		image: "/images/tattoo-styles/graphic_illustrative.png",
		bgColor: "#f7f8f4",
		apiStyle: "graphic_illustrative",
		description:
			"한 편의 그림이나 웹툰, 일러스트처럼 타투이스트 개개인의 독창적인 드로잉 느낌을 살려 표현하는 스타일입니다.",
	},
	{
		id: "new-school",
		label: "뉴스쿨",
		image: "/images/tattoo-styles/new_school.png",
		bgColor: "#f5f5f2",
		apiStyle: "new_school",
		description:
			"만화적 캐릭터, 과감한 디포르메(변형), 입체적이고 자유분방한 컬러감으로 개성을 극대화한 스타일입니다.",
	},
	{
		id: "western",
		label: "웨스턴",
		image: "/images/tattoo-styles/western_traditional.png",
		bgColor: "#f5f5f1",
		apiStyle: "western_traditional",
		description:
			"두꺼운 아웃라인과 단순하지만 명확한 원색 컬러, 클래식한 아이콘(용의주도한 배, 앵커, 장미 등)이 특징인 빈티지 장르입니다.",
	},
	{
		id: "lettering",
		label: "레터링",
		image: "/images/tattoo-styles/lettering.png",
		bgColor: "#f6f6f2",
		apiStyle: "lettering",
		description:
			"폰트, 흘림체, 캘리그래피 등을 활용해 자신만의 특별한 문구나 명언, 의미 있는 숫자를 글로 새기는 스타일입니다.",
	},
	{
		id: "japanese",
		label: "재패니즈",
		image: "/images/tattoo-styles/japanese.png",
		bgColor: "#f5f5f2",
		apiStyle: "japanese",
		description:
			"용, 해태, 뱀 등 동양적인 영물과 정교한 배경 패턴을 활용해 화려하고 웅장하게 표현하는 전통 장르입니다.",
	},
];

export const MAX_GENRE_SELECTION = 2;
export const MAX_REFERENCE_IMAGES = 1;
