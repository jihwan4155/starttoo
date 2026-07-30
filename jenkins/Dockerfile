FROM jenkins/jenkins:lts

USER root

# Docker CLI + Compose 플러그인 설치 (호스트의 Docker 데몬을 그대로 쓰는 DooD 구조)
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
        > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

# 호스트의 docker 그룹 GID와 맞춰야 /var/run/docker.sock 접근 가능하다.
# i15d201.p.ssafy.io 서버 기준 GID=113 (다른 서버에 옮기면 `getent group docker`로 다시 확인해서 맞출 것)
ARG DOCKER_GID=113
RUN groupadd -g ${DOCKER_GID} docker \
    && usermod -aG docker jenkins

USER jenkins
