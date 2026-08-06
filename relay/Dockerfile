FROM alpine:3.22@sha256:14358309a308569c32bdc37e2e0e9694be33a9d99e68afb0f5ff33cc1f695dce

RUN apk add --no-cache socat \
    && addgroup -g 10001 relay \
    && adduser -D -H -u 10001 -G relay relay

USER 10001:10001

ENTRYPOINT ["socat"]
