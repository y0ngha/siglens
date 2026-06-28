#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"
TAG="${1:?usage: deploy.sh <image-tag>}"

# env 완전성 게이트(M5): .env.example의 모든 필수 키가 SSM /siglens/* 에 있는지
# 롤 이전에 확인한다. 누락 시 check-env.sh가 누락 키를 나열하고 비정상 종료해
# 여기서 set -e로 배포가 멈춘다. 비상시 SKIP_ENV_CHECK=1로 우회(권장하지 않음).
if [ "${SKIP_ENV_CHECK:-0}" != "1" ]; then
  bash "$(dirname "$0")/check-env.sh"
fi

bash "$(dirname "$0")/05-launch-template.sh" "$TAG"

log "rolling to $TAG (ASG already pinned to siglens-lt \$Latest)"

# Start an instance refresh with:
#   MinHealthyPercentage 100  — capacity must never drop below 100 % of desired during the
#                               refresh, so the old instance is kept alive until the new one
#                               is fully healthy.
#   MaxHealthyPercentage 200  — allows the ASG to temporarily exceed desired capacity by 1
#                               (desired=1 → max running=2) so the replacement is LAUNCHED
#                               and passes ELB health checks BEFORE the old instance is
#                               drained/terminated.  Without this, AWS cannot add a new
#                               instance while MinHealthyPercentage=100 is already satisfied
#                               by the single existing instance, so it terminates first —
#                               causing the ~90 s gap we measured.  ASG max-size=4, so
#                               briefly running 2 instances is within limits.
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
            # 직전 buildId(=직전 태그) prefix의 S3 캐시를 정리(storage 회수). lifecycle 14일이 백업.
            # 현재 태그는 보존. 정리 실패는 배포를 막지 않는다(best-effort).
            PREV_TAG=$(aws ssm get-parameter --name /siglens/prev-isr-buildid --query Parameter.Value --output text 2>/dev/null || echo "")
            if [ -n "$PREV_TAG" ] && [ "$PREV_TAG" != "$TAG" ]; then
              aws s3 rm "s3://${ISR_CACHE_BUCKET:-siglens-isr-cache}/siglens-isr/${PREV_TAG}/" --recursive >/dev/null 2>&1 || true
              log "purged old ISR cache prefix: $PREV_TAG"
            fi
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
