FROM python:3.11-slim
WORKDIR /app

RUN groupadd -r app && useradd -r -g app app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY coverup coverup

# 특징 파일이 사는 곳. compose 가 볼륨을 여기 마운트한다.
# non-root 로 실행하면서 색인 쓰기를 해야 하므로 소유권을 미리 넘긴다.
ENV COVERUP_STORE=/data/coverup_store
RUN mkdir -p /data/coverup_store && chown -R app:app /data
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
