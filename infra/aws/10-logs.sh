#!/usr/bin/env bash
# CloudWatch Logs 그룹 생성(L4) — 컨테이너 stdout/stderr 중앙 수집용.
# user-data.sh가 awslogs 드라이버로 /siglens/app 그룹에 로그를 보낸다. 인스턴스가
# 종료돼도 로그가 보존되어 크래시 사후분석이 가능하다.
# create-log-group은 이미 존재하면 ResourceAlreadyExists를 던지므로 무시한다(멱등).
# put-retention-policy로 보존기간을 14일로 제한해 로그 비용이 무한 증가하지 않게 한다.
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"

LOG_GROUP=/siglens/app
RETENTION_DAYS=14

aws logs create-log-group --log-group-name "$LOG_GROUP" 2>/dev/null \
  || log "log group $LOG_GROUP already exists (ok)"
aws logs put-retention-policy --log-group-name "$LOG_GROUP" \
  --retention-in-days "$RETENTION_DAYS"

log "log group $LOG_GROUP ready (retention ${RETENTION_DAYS}d)"
