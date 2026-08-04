FROM python:3.11-slim
WORKDIR /app

RUN groupadd -r app && useradd -r -g app app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY api_server/requirements.txt ./api_server-requirements.txt
RUN pip install --no-cache-dir -r api_server-requirements.txt

COPY coverup coverup
COPY api_server api_server

# 특징 파일이 사는 곳. compose 가 볼륨을 여기 마운트한다.
# non-root 로 실행하면서 색인 쓰기를 해야 하므로 소유권을 미리 넘긴다.
ENV COVERUP_STORE=/data/coverup_store
# HOME 을 반드시 만들어 둬야 한다. useradd -r 은 -m 이 없으면 홈 디렉터리를 만들지 않는데
# /etc/passwd 에는 /home/app 으로 기록되므로, 없는 경로를 HOME 이 가리키게 된다. 그러면
# huggingface 다운로더가 ~/.cache 에 캐시를 못 만들어 SigLIP2 내려받기가
# Permission denied (os error 13) 로 죽는다.
ENV HOME=/home/app
# SigLIP2 가 사는 곳. compose 가 볼륨을 여기 마운트하므로 마운트 지점을 미리 app 소유로
# 만들어 둔다. 이미지에 없는 경로에 볼륨을 걸면 Docker 가 root 소유로 만들어 같은 권한 문제가 난다.
RUN mkdir -p /data/coverup_store /app/api_server/runtime /home/app \
        /app/api_server/vendor/tattoo_classifier_v3/siglip2-so400m-patch16-384 \
    && chown -R app:app /data /app /home/app
USER app

EXPOSE 8000

# 워밍업(인덱스 로드 + 더미 검색 1회)이 끝나야 ready=true 가 된다.
# 단순 200 확인이 아니라 ready 를 봐야 색인 미적재 상태로 트래픽을 받지 않는다.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import json,sys,urllib.request; \
sys.exit(0 if json.load(urllib.request.urlopen('http://localhost:8000/health'))['ready'] else 1)" || exit 1

# --workers 를 늘리지 마라. 특징 파일 쓰기(POST/DELETE /designs)가 단일 프로세스여야
# 한다 — 두 워커가 같은 파일에 동시에 append 하면 스토어가 깨진다.
CMD ["uvicorn", "coverup.app:app", "--host", "0.0.0.0", "--port", "8000"]
