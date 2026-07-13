#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"
TAG="${1:?usage: deploy.sh <image-tag>}"

# env 완전성 게이트(M5): .env.example의 모든 필수 키가 SSM /siglens/* 에 있는지
# 롤 이전에 확인한다. 누락 시 check-env.sh가 누락 키를 나열하고 비정상 종료해
# 여기서 set -e로 배포가 멈춘다. 비상시 SKIP_ENV_CHECK=1로 우회(권장하지 않음).
#
# 부트스트랩 의존성(중요): .env.example에 ISR_CACHE_BUCKET이 추가되면서, 이 게이트는
# /siglens/ISR_CACHE_BUCKET이 SSM에 존재해야 통과한다. 이 SSM 파라미터는
# infra/aws/12-isr-cache.sh가 게시한다(버킷 생성 + SSM put). 12-isr-cache.sh는
# 첫 태그 배포 전에 1회 수동 실행해야 한다(멱등). 실행하지 않으면 여기서 게이트가
# 누락 키로 배포를 중단시킨다. (DATABASE_URL처럼 하드 요구이며 의도된 것 —
# OPTIONAL_KEYS에 넣지 않는다.)
if [ "${SKIP_ENV_CHECK:-0}" != "1" ]; then
  bash "$(dirname "$0")/check-env.sh"
fi

bash "$(dirname "$0")/05-launch-template.sh" "$TAG"

log "rolling to $TAG (ASG already pinned to siglens-lt \$Latest)"

# Start an instance refresh with:
#   MinHealthyPercentage 100  — capacity must never drop below 100 % of desired during the
#                               refresh. With desired=2, at least two healthy instances must
#                               remain available before any old instance is drained.
#   MaxHealthyPercentage 200  — allows the ASG to temporarily exceed desired capacity by 1
#                               batch (desired=2 → max running=4) so replacements are launched
#                               and pass ELB health checks BEFORE old instances are drained.
#                               This avoids the healthy-target=0 gap that causes whole-site
#                               502s. ASG max-size=4, so the temporary surge is within limits.
#   InstanceWarmup 300        — > health-check-grace 240 s (see 06-alb-asg.sh) + ELB detection
#                               ~90 s; the refresh
#                               re-evaluates ELB health after grace expires before counting the
#                               new instance healthy, so a runtime-unhealthy new instance does
#                               NOT cause the old one to be terminated.
# No DesiredConfiguration — the ASG already references siglens-lt at Version=$Latest, and
# 05-launch-template.sh stamped the new image as $Latest before this script ran.
REFRESH_ID=$(aws autoscaling start-instance-refresh \
  --auto-scaling-group-name siglens-asg \
  --preferences '{"MinHealthyPercentage":100,"MaxHealthyPercentage":200,"InstanceWarmup":300}' \
  --query InstanceRefreshId \
  --output text)
log "instance refresh started for $TAG (refresh-id: $REFRESH_ID)"

# Poll until the refresh reaches a terminal state.
# Max ~20 minutes (60 iterations × 20 s = 1200 s).
MAX_ITERATIONS=60
SLEEP_SECONDS=20

for i in $(seq 1 "$MAX_ITERATIONS"); do
    if ! RESULT=$(aws autoscaling describe-instance-refreshes \
        --auto-scaling-group-name siglens-asg \
        --instance-refresh-ids "$REFRESH_ID" \
        --query 'InstanceRefreshes[0].[Status,PercentageComplete,StatusReason]' \
        --output text 2>/dev/null); then
        log "WARNING: describe-instance-refreshes failed (transient?), retrying..."
        sleep "$SLEEP_SECONDS"; continue
    fi

    # Parse the tab-separated fields (StatusReason may be empty/None).
    STATUS=$(printf '%s' "$RESULT" | cut -f1)
    PCT=$(printf '%s' "$RESULT" | cut -f2)
    REASON=$(printf '%s' "$RESULT" | cut -f3)

    log "refresh status: $STATUS ($PCT%) — $REASON"

    case "$STATUS" in
        Successful)
            log "instance refresh completed successfully for $TAG"
            aws ssm put-parameter --name /siglens/prev-isr-buildid --value "$TAG" --type String --overwrite >/dev/null 2>&1 || true
            exit 0
            ;;
        RollbackSuccessful)
            log "instance refresh rolled back to previous image — new image ($TAG) failed health checks. StatusReason: $REASON"
            exit 1
            ;;
        Failed)
            log "instance refresh FAILED for $TAG. StatusReason: $REASON"
            exit 1
            ;;
        Cancelled)
            log "instance refresh was CANCELLED for $TAG. StatusReason: $REASON"
            exit 1
            ;;
        RollbackInProgress)
            log "rollback in progress (new image unhealthy) — StatusReason: $REASON"
            # Not terminal yet; keep polling until RollbackSuccessful or RollbackFailed.
            ;;
        RollbackFailed)
            log "instance refresh rollback FAILED for $TAG. StatusReason: $REASON"
            exit 1
            ;;
    esac

    sleep "$SLEEP_SECONDS"
done

log "timed out waiting for instance refresh $REFRESH_ID after $((MAX_ITERATIONS * SLEEP_SECONDS)) seconds"
exit 1
