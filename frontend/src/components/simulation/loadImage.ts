/**
 * 캔버스에서 픽셀을 읽을 수 있는 형태로 이미지를 불러온다.
 *
 * 도안·사진은 MinIO 공개 호스트(starttoo-storage.duckdns.org)에서 오고 페이지는
 * 서비스 도메인에서 뜨므로 항상 교차 출처다. 그냥 `image.src = url` 로 받으면
 * 브라우저가 CORS 요청을 보내지 않고, 그렇게 받은 이미지를 그린 캔버스는 오염돼서
 * getImageData/cv.imread 가 SecurityError 로 죽는다.
 *   SecurityError: The canvas has been tainted by cross-origin data
 *
 * 서버가 Access-Control-Allow-Origin 을 주더라도 클라이언트가 CORS 로 요청해야만
 * 오염을 피할 수 있다. 여기서는 fetch 로 받아 blob URL 로 바꿔 넘긴다.
 * blob URL 은 동일 출처로 취급되므로 이후 캔버스 조작이 자유롭다.
 *
 * 이 함수는 한곳에만 둔다. 예전에 ArLiveStage 가 같은 이름의 단순 구현을 따로
 * 가지고 있었고, 그쪽만 이 처리를 못 받아서 AR 라이브의 도안 로드가 통째로 실패했다.
 */
function isCrossOrigin(url: string): boolean {
	if (!/^https?:/i.test(url)) return false;
	try {
		return new URL(url, window.location.href).origin !== window.location.origin;
	} catch {
		return false;
	}
}

export async function loadImage(url: string): Promise<HTMLImageElement> {
	let objectUrl: string | null = null;
	if (isCrossOrigin(url)) {
		const response = await fetch(url, { mode: "cors" });
		if (!response.ok) throw new Error("이미지를 불러오지 못했습니다.");
		objectUrl = URL.createObjectURL(await response.blob());
	}

	const source = objectUrl ?? url;
	try {
		return await new Promise<HTMLImageElement>((resolve, reject) => {
			const image = new Image();
			image.onload = () => resolve(image);
			image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
			image.src = source;
		});
	} finally {
		if (objectUrl) URL.revokeObjectURL(objectUrl);
	}
}
