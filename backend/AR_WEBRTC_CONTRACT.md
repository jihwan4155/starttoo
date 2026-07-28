# 모바일 웹 카메라 WebRTC 연결 계약

Spring Boot는 영상 바이트를 중계하지 않고 세션과 WebRTC 시그널만 전달한다.

1. 데스크톱 웹이 `POST /v1/simulations/ar-sessions`로 세션을 만든다.
2. 응답의 QR은 `mobileCaptureUrl`을 가리킨다.
3. 모바일 브라우저가 HTTPS 페이지에서 `navigator.mediaDevices.getUserMedia({video:true})`로 카메라 권한을 받는다.
4. 모바일이 connectToken으로 세션을 연결한다.
5. 양쪽이 `/v1/ws/ar`에 접속해 Offer, Answer, ICE candidate JSON을 교환한다.
6. 실제 영상 트랙은 브라우저끼리 WebRTC P2P로 흐른다.

WebSocket query:

```text
sessionId={sessionId}&peer=desktop&token={desktopSignalingToken}
sessionId={sessionId}&peer=mobile&token={mobileSignalingToken}
```

운영에서는 모바일 페이지와 WebSocket 모두 HTTPS/WSS가 필요하다. 현재 세션은 단일 서버 메모리에 있으므로 다중 인스턴스 배포 전 Redis와 TTL 저장소로 교체해야 한다.
