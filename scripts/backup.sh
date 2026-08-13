#!/usr/bin/env bash
# Starttoo 운영 데이터 백업 스크립트
#
# 백업 대상:
#   1. PostgreSQL  - pg_dump 논리 백업 (복원 호환성이 좋아 볼륨 tar보다 안전)
#   2. MinIO       - minio-data 볼륨 전체 tar
#   3. Redis       - redis-data 볼륨(AOF) 전체 tar
#
# 사용법:
#   ./scripts/backup.sh              # /home/ubuntu/backups 에 저장
#   BACKUP_DIR=/mnt/x ./scripts/backup.sh   # 저장 위치 변경
#
# cron 등록 예 (매일 새벽 4시, KST 기준 서버 타임존 확인 필요):
#   crontab -e
#   0 4 * * * /home/ubuntu/S15P11D201/scripts/backup.sh >> /home/ubuntu/backups/backup.log 2>&1
#
# 복원 방법은 이 파일 맨 아래 주석 참고.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/home/ubuntu/backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"
STAMP="$(date +%Y%m%d-%H%M%S)"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-s15p11d201}"

mkdir -p "$BACKUP_DIR"

echo "[$(date '+%F %T')] backup start -> $BACKUP_DIR"

# ---------- 1. PostgreSQL (pg_dump) ----------
# 컨테이너 안의 pg_dump를 사용. 환경변수는 postgres 컨테이너 것을 그대로 쓴다.
docker exec starttoo-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
  | gzip > "$BACKUP_DIR/postgres-$STAMP.sql.gz"
echo "  postgres dump: $(du -h "$BACKUP_DIR/postgres-$STAMP.sql.gz" | cut -f1)"

# ---------- 2. MinIO 볼륨 ----------
# 실행 중인 컨테이너를 건드리지 않고 볼륨을 임시 컨테이너로 읽어 tar로 뜬다.
docker run --rm \
  -v "${COMPOSE_PROJECT}_minio-data:/data:ro" \
  -v "$BACKUP_DIR:/backup" \
  alpine tar czf "/backup/minio-data-$STAMP.tar.gz" -C /data .
echo "  minio volume:  $(du -h "$BACKUP_DIR/minio-data-$STAMP.tar.gz" | cut -f1)"

# ---------- 3. Redis 볼륨 (AOF) ----------
docker run --rm \
  -v "${COMPOSE_PROJECT}_redis-data:/data:ro" \
  -v "$BACKUP_DIR:/backup" \
  alpine tar czf "/backup/redis-data-$STAMP.tar.gz" -C /data .
echo "  redis volume:  $(du -h "$BACKUP_DIR/redis-data-$STAMP.tar.gz" | cut -f1)"

# ---------- 오래된 백업 정리 ----------
find "$BACKUP_DIR" -name "postgres-*.sql.gz"    -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name "minio-data-*.tar.gz"  -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name "redis-data-*.tar.gz"  -mtime +"$KEEP_DAYS" -delete

echo "[$(date '+%F %T')] backup done. current files:"
ls -lh "$BACKUP_DIR" | tail -n +2

# ======================================================================
# 복원 방법 (참고)
#
# PostgreSQL:
#   gunzip -c postgres-YYYYMMDD-HHMMSS.sql.gz \
#     | docker exec -i starttoo-postgres psql -U starttoo -d starttoo
#   (기존 데이터가 있는 DB에 덮어 복원하려면 먼저 DB를 비우거나 새 DB에 복원할 것)
#
# MinIO / Redis 볼륨:
#   docker compose stop minio   # (redis도 동일)
#   docker run --rm -v s15p11d201_minio-data:/data -v /home/ubuntu/backups:/backup \
#     alpine sh -c "rm -rf /data/* && tar xzf /backup/minio-data-YYYYMMDD-HHMMSS.tar.gz -C /data"
#   docker compose start minio
# ======================================================================
