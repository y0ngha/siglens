#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"
TAG="${1:?usage: deploy.sh <image-tag>}"

# env 완전성 게이트(M5): infra/aws/env-gate.txt의 모든 필수 키가 SSM /siglens/* 에 있는지
# 롤 이전에 확인한다. 누락 시 check-env.sh가 누락 키를 나열하고 비정상 종료해
# 여기서 set -e로 배포가 멈춘다. 비상시 SKIP_ENV_CHECK=1로 우회(권장하지 않음).
#
# 부트스트랩 의존성(중요): env-gate.txt에 ISR_CACHE_BUCKET이 required로 들어 있어, 이 게이트는
# /siglens/ISR_CACHE_BUCKET이 SSM에 존재해야 통과한다. 이 SSM 파라미터는
# infra/aws/12-isr-cache.sh가 게시한다(버킷 생성 + SSM put). 12-isr-cache.sh는
# 첫 태그 배포 전에 1회 수동 실행해야 한다(멱등). 실행하지 않으면 여기서 게이트가
# 누락 키로 배포를 중단시킨다. (DATABASE_URL처럼 하드 요구이며 의도된 것 —
# envRegistry.ts에서 optional로 내리지 않는다.)
if [ "${SKIP_ENV_CHECK:-0}" != "1" ]; then
  bash "$(dirname "$0")/check-env.sh"
fi

# 롤백 기준점. 05가 새 버전을 만들면 ASG가 따르는 `$Latest`가 이 태그의 이미지로 옮겨 간다.
# 마이그레이션 게이트가 이 배포를 막으면 refresh는 실패하지만 `$Latest`는 막힌 이미지에 남는다 —
# desired=min=1이라 그 뒤 인스턴스가 한 번이라도 교체되면 막힌 이미지가 ABANDON을 반복하며
# 인그레스가 0이 된다. 그래서 05 **전에** 지금의 최신 버전 번호를 적어 두었다가, refresh가
# Failed/Cancelled로 끝나면 그 버전에서 새 버전을 만들어 되돌린다(아래 revert_launch_template).
# 템플릿이 아직 없으면(첫 배포) 기준점이 없어 되돌리지 않는다.
PREV=$(aws ec2 describe-launch-templates --launch-template-names siglens-lt \
  --query 'LaunchTemplates[0].LatestVersionNumber' --output text 2>/dev/null) || PREV=""
[ "$PREV" = "None" ] && PREV=""
# 설명(= 05가 붙인 태그, 되돌린 버전이면 revert-after-<tag>)을 함께 남겨, 기준점 자체가 막혔던/되돌려진
# 버전이 아닌지 운영자가 로그에서 알아보게 한다. 읽기 전용 호출이고 CI 역할에 이미 허용돼 있다
# (ec2:DescribeLaunchTemplateVersions). 실패해도 배포는 계속한다.
PREV_DESC=""
if [ -n "$PREV" ]; then
  PREV_DESC=$(aws ec2 describe-launch-template-versions --launch-template-name siglens-lt \
    --versions "$PREV" --query 'LaunchTemplateVersions[0].VersionDescription' \
    --output text 2>/dev/null) || PREV_DESC=""
fi
log "launch template previous latest version: ${PREV:-none} (${PREV_DESC:-no description})"

# 05가 실패했을 때, 그리고 refresh가 끝났거나(Failed/Cancelled/Rollback*) 시작하지 못한 뒤에만 부른다:
# 기준점 버전에서 새 버전을 만들어 `$Latest`와 기본 버전을 05와 같은 방식(default-version '$Latest')으로 옛 이미지에 되돌린다.
# 실패해도 배포 결과(exit 1)는 바뀌지 않는다 — 되돌림 실패는 경고로 남기고 사람이 본다.
revert_launch_template() {
  if [ -z "$PREV" ]; then
    log "no previous launch template version recorded; not reverting siglens-lt"
    return 0
  fi
  # shellcheck disable=SC2016 # '$Latest'는 EC2 API의 리터럴 버전 지정자다
  if aws ec2 create-launch-template-version --launch-template-name siglens-lt \
      --source-version "$PREV" --version-description "revert-after-$TAG" \
      --launch-template-data '{}' >/dev/null &&
    aws ec2 modify-launch-template --launch-template-name siglens-lt \
      --default-version '$Latest' >/dev/null; then
    log "siglens-lt reverted: new latest version is a copy of version $PREV (${PREV_DESC:-no description}) as revert-after-$TAG"
  else
    log "WARNING: could not revert siglens-lt to version $PREV; \$Latest still points at $TAG. Restore it before any instance is replaced."
  fi
}

# 05가 새 버전을 만든 **뒤에** 실패해도(예: modify-launch-template) `$Latest`는 이미 옮겨 갔다.
if ! bash "$(dirname "$0")/05-launch-template.sh" "$TAG"; then
  log "05 failed for $TAG"
  revert_launch_template
  exit 1
fi

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
#                               옛 인스턴스는 그대로 남는다. 이미지가 기대하는 마이그레이션이
#                               DB에 없을 때(migration gate, user-data.sh의
#                               siglens-wait-migrations.sh)는 cloudflared가 뜨지 않고 훅이
#                               곧바로 ABANDON된다 — 같은 경로로 refresh가 실패한다.
#                               (ALB 제거 전에는 이 자리를 ELB health detection이 맡았다.)
# No DesiredConfiguration — the ASG already references siglens-lt at Version=$Latest, and
# 05-launch-template.sh stamped the new image as $Latest before this script ran.
HINT_GATE="check [migration-gate] in /siglens/app (ops stream) and 'yarn db:check:migrations'; a refresh still running after timeout must be cancelled by an operator: aws autoscaling cancel-instance-refresh --auto-scaling-group-name siglens-asg"
# 타임아웃은 refresh가 아직 돌고 있다는 뜻이라 템플릿을 되돌리지 않는다(돌고 있는 refresh 밑에서
# $Latest를 바꾸면 새로 뜨는 인스턴스의 이미지가 갈린다). 사람이 먼저 refresh를 취소해야 한다.
HINT_TIMEOUT="$HINT_GATE; siglens-lt \$Latest now points at $TAG; cancel the running refresh first, then apply the migration (or restore the template), then rerun"

# refresh를 시작하지 못하면(예: InstanceRefreshInProgress) 05가 이미 `$Latest`를 옮겼으므로
# `set -e`로 그냥 죽지 말고 되돌린 뒤 끝낸다.
if ! REFRESH_ID=$(aws autoscaling start-instance-refresh \
  --auto-scaling-group-name siglens-asg \
  --preferences '{"MinHealthyPercentage":100,"MaxHealthyPercentage":200,"InstanceWarmup":300}' \
  --query InstanceRefreshId \
  --output text); then
  log "could not start refresh for $TAG"
  revert_launch_template
  exit 1
fi
log "instance refresh started for $TAG (refresh-id: $REFRESH_ID)"

# Poll until the refresh reaches a terminal state.
# 상한 산정(Fix 3): 새 인스턴스 warmup(InstanceWarmup=300s) + deregistration(185s) +
# docker stop -t 185s = 최대 ~670s/인스턴스. desired=2일 때 ~1350s < 1800s(90×20s).
# Fix 3 이전(deregistration 30s + stop 30s)에는 최대 ~360s/인스턴스으로 1200s 안에
# 충분했지만 drain 예산이 늘어 여유를 30분으로 확장한다.
# Max ~30 minutes (90 iterations × 20 s = 1800 s).
MAX_ITERATIONS="${REFRESH_MAX_ITERATIONS:-90}"
SLEEP_SECONDS="${REFRESH_POLL_SECONDS:-20}"

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
            # AutoRollback을 켜지 않아 지금은 닿지 않는다. 켜면 ASG가 인스턴스는 되돌려도 템플릿
            # `$Latest`는 이 태그에 남으므로 다른 종료 상태와 같이 템플릿도 되돌린다.
            revert_launch_template
            exit 1
            ;;
        Failed)
            log "instance refresh FAILED for $TAG. StatusReason: $REASON"
            log "$HINT_GATE"
            revert_launch_template
            exit 1
            ;;
        Cancelled)
            log "instance refresh was CANCELLED for $TAG. StatusReason: $REASON"
            log "$HINT_GATE"
            revert_launch_template
            exit 1
            ;;
        RollbackInProgress)
            log "rollback in progress (new image unhealthy) — StatusReason: $REASON"
            # Not terminal yet; keep polling until RollbackSuccessful or RollbackFailed.
            ;;
        RollbackFailed)
            log "instance refresh rollback FAILED for $TAG. StatusReason: $REASON"
            # (RollbackSuccessful과 같은 이유로 지금은 닿지 않지만 일관되게 되돌린다.)
            revert_launch_template
            exit 1
            ;;
    esac

    sleep "$SLEEP_SECONDS"
done

log "timed out waiting for instance refresh $REFRESH_ID after $((MAX_ITERATIONS * SLEEP_SECONDS)) seconds"
log "$HINT_TIMEOUT"
exit 1
