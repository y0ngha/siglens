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
#                               and clear the launch lifecycle hook BEFORE old instances are
#                               drained. This avoids the zero-serving-replica gap that causes
#                               whole-site 502s. ASG max-size=4, so the surge is within limits.
#                               During that overlap two cloudflared replicas are attached to
#                               the same tunnel and Cloudflare routes to either — identical to
#                               what the ALB already did, and safe because all state is
#                               external (Neon / Upstash / S3 ISR cache).
#   InstanceWarmup 300        — 이제는 2차 게이트다. 1차 게이트는 `siglens-launch-gate`
#                               라이프사이클 훅이다: user-data가 앱(/api/health)과
#                               터널(cloudflared /ready)이 **둘 다** 살아났음을 증명할
#                               때까지 인스턴스는 Pending:Wait에 머문다(= InService 아님
#                               = MinHealthyPercentage 미충족). 따라서 런타임에서 죽은 새
#                               인스턴스가 옛 인스턴스를 종료시키는 일은 여전히 없다 —
#                               훅이 600초 뒤 ABANDON으로 떨어지고 refresh가 실패하며
#                               옛 인스턴스는 그대로 남는다.
#                               (ALB 제거 전에는 이 자리를 ELB health detection이 맡았다.)
# No DesiredConfiguration — the ASG already references siglens-lt at Version=$Latest, and
# 05-launch-template.sh stamped the new image as $Latest before this script ran.
REFRESH_ID=$(aws autoscaling start-instance-refresh \
  --auto-scaling-group-name siglens-asg \
  --preferences '{"MinHealthyPercentage":100,"MaxHealthyPercentage":200,"InstanceWarmup":300}' \
  --query InstanceRefreshId \
  --output text)
log "instance refresh started for $TAG (refresh-id: $REFRESH_ID)"

# Poll until the refresh reaches a terminal state.
# 상한 산정(Fix 3): 새 인스턴스 warmup(InstanceWarmup=300s) + deregistration(185s) +
# docker stop -t 185s = 최대 ~670s/인스턴스. desired=2일 때 ~1350s < 1800s(90×20s).
# Fix 3 이전(deregistration 30s + stop 30s)에는 최대 ~360s/인스턴스으로 1200s 안에
# 충분했지만 drain 예산이 늘어 여유를 30분으로 확장한다.
# Max ~30 minutes (90 iterations × 20 s = 1800 s).
MAX_ITERATIONS=90
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
            # 직전 빌드의 ISR prefix(`siglens-isr/<GIT_SHA>/`)는 여기서 지우지 않는다 —
            # 12-isr-cache.sh의 7일 lifecycle이 정리한다. 예전엔 이 자리에서
            # SSM `/siglens/prev-isr-buildid`에 태그를 썼지만 그 값을 읽는 곳이 없었고,
            # `/siglens/*`는 user-data가 통째로 컨테이너 env로 퍼 넣으므로 쓸모없는 키가
            # 런타임 env에 새고 있었다. 즉시 삭제를 택하지 않은 이유:
            #   - 직전 prefix는 1단계 롤백의 웜 캐시다. 지우면 롤백이 전 라우트 cold-gen이 된다.
            #   - 수십만 객체 삭제는 CI 시간을 분 단위로 잡아먹고, 반쯤 지운 채 실패할 수 있다.
            #   - 7일 lifecycle 아래 죽은 prefix의 저장비는 월 $1 안팎이다.
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
