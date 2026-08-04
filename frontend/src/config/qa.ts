/**
 * 빈 API 응답 대신 QA용 목업 데이터를 표시할지 여부.
 * 개발 서버에서도 명시적으로 환경변수를 켠 경우에만 활성화한다.
 */
export const QA_MOCK_DATA_ENABLED =
	import.meta.env.DEV && import.meta.env.VITE_ENABLE_QA_MOCK_DATA === "true";
