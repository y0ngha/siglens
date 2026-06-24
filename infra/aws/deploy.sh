#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"
TAG="${1:?usage: deploy.sh <image-tag>}"
bash "$(dirname "$0")/05-launch-template.sh" "$TAG"

# Capture the version number that 05-launch-template.sh just stamped as $Latest.
# DesiredConfiguration requires an explicit version string (not the "$Latest" alias)
# so that AutoRollback knows exactly which version to revert to on health failure.
NEW_VER=$(aws ec2 describe-launch-template-versions \
  --launch-template-name siglens-lt \
  --versions '$Latest' \
  --query 'LaunchTemplateVersions[0].VersionNumber' \
  --output text)
log "rolling to launch template version $NEW_VER ($TAG)"

# Start an instance refresh with:
#   MinHealthyPercentage 100 — ASG adds the new instance before terminating the old one
#                              (capacity never drops below 100 % of desired = zero downtime).
#   InstanceWarmup 300       — give the new instance 5 min to pass ELB health checks.
#   AutoRollback true        — if the new instance never becomes healthy, ASG automatically
#                              reverts to the previous launch-template version (the last
#                              working image) instead of leaving the service degraded.
REFRESH_ID=$(aws autoscaling start-instance-refresh \
  --auto-scaling-group-name siglens-asg \
  --desired-configuration "{\"LaunchTemplate\":{\"LaunchTemplateName\":\"siglens-lt\",\"Version\":\"$NEW_VER\"}}" \
  --preferences '{"MinHealthyPercentage":100,"InstanceWarmup":300,"AutoRollback":true}' \
  --query InstanceRefreshId \
  --output text)
log "instance refresh started for $TAG (refresh-id: $REFRESH_ID)"

# Poll until the refresh reaches a terminal state.
# Max ~20 minutes (60 iterations × 20 s = 1200 s).
MAX_ITERATIONS=60
SLEEP_SECONDS=20

for i in $(seq 1 "$MAX_ITERATIONS"); do
    RESULT=$(aws autoscaling describe-instance-refreshes \
        --auto-scaling-group-name siglens-asg \
        --instance-refresh-ids "$REFRESH_ID" \
        --query 'InstanceRefreshes[0].[Status,PercentageComplete,StatusReason]' \
        --output text)

    # Parse the tab-separated fields (StatusReason may be empty/None).
    STATUS=$(printf '%s' "$RESULT" | cut -f1)
    PCT=$(printf '%s' "$RESULT" | cut -f2)
    REASON=$(printf '%s' "$RESULT" | cut -f3)

    log "refresh status: $STATUS ($PCT%) — $REASON"

    case "$STATUS" in
        Successful)
            log "instance refresh completed successfully for $TAG"
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
