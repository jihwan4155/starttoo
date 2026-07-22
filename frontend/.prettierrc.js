/**
 * @see <https://prettier.io/docs/configuration>
 * @type {import('prettier').Config}
 */
const config = {
	// 화살표 함수가 하나의 매개변수를 받을 때 괄호 사용 여부 - 괄호 사용
	arrowParens: "always",

	// 태그 > 다음 줄에 혼자 있는 대신, 여러 줄 JSX 요소를 마지막 줄 끝에 넣는다. - 줄넘김하지 않음
	bracketSameLine: true,

	// 개체 리터럴에서 대괄호 사이의 공백을 넣을지에 대한 여부 - 공백 o
	bracketSpacing: true,

	// 객체나 배열 작성 시, 데이터를 넣을 때 마지막에 후행 쉼표를 넣을지 여부 - 후행 쉼표 포함
	trailingComma: "es5",

	// 큰따옴표, 작은따옴표 여부 - 큰따옴표
	singleQuote: false,

	// 명령문 끝에 세미콜론 여부 - ; 추가
	semi: true,

	// 탭 사용 여부 - o
	useTabs: true,

	// 탭 들여쓰기 너비 수 : 2
	tabWidth: 2,

	// 코드 한 줄 너비 - 80
	printWidth: 80,

	// 파일 줄 끝에 사용하는 줄바꿈 문자 관리 설정 - EoF 방식
	endOfLine: "auto",
};

export default config;