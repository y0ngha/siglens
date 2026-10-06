#!/usr/bin/env bash
#
# infra/aws/16-prune-amis.sh — 골든 AMI 보존 정리 (기본 dry-run)
#
# 09-bake-ami.sh는 베이크마다 AMI 하나와 EBS 스냅샷(8GB)을 남기는데, 지금까지 아무것도
# 그것을 지우지 않았다 — 스냅샷이 베이크 횟수만큼 쌓여 과금된다($0.05/GB-월). 이
# 스크립트는 최근 N개(기본 3)만 남기고 나머지를 deregister한 뒤 그 스냅샷을 지운다.
#
# 대상 선정(명시적 태그 필터): **self 소유 + 태그 `siglens:role=golden-ami`** 인 AMI만 본다.
# 이름 패턴만으로 고르지 않는 이유 — 이름은 누구나 붙일 수 있고, 잘못 매칭되면 되돌릴 수
# 없는 삭제가 일어난다. 09-bake-ami.sh가 이제 AMI와 스냅샷에 이 태그를 붙인다.
# 태그 도입 이전에 구운 AMI는 `--adopt-legacy`로 한 번 태그를 붙여야 대상이 된다
# (이름 `siglens-golden-*` **그리고** 설명 `siglens golden AMI*` 둘 다 맞는 self 소유 AMI만).
#
# 절대 지우지 않는 것(보존 수 N과 무관):
#   - PINNED_AMI (env 또는 infra/aws/.ami) — 다음 배포가 쓸 AMI
#   - 런치 템플릿 siglens-lt의 $Latest / $Default 버전이 가리키는 AMI — ASG가 지금 쓰는 것
#   - 이 리전에서 종료되지 않은 인스턴스가 하나라도 쓰고 있는 AMI
#   ⚠️ CI의 repo variable `vars.PINNED_AMI`는 여기서 읽을 수 없다. 그 값이 .ami와 다르면
#      (예: 새로 구웠는데 아직 CI 변수를 안 바꿨다) PINNED_AMI=<CI 값>으로 넘겨 함께 보호할 것.
#      다만 $Latest 보호가 직전 배포의 AMI를 이미 덮는다.
#
# 사용법:
#     bash infra/aws/16-prune-amis.sh                    # dry-run: 무엇을 지울지 출력만
#     bash infra/aws/16-prune-amis.sh --apply            # 실제 deregister + 스냅샷 삭제
#     bash infra/aws/16-prune-amis.sh --keep 5           # 보존 수 변경(기본 3, 최소 1)
#     bash infra/aws/16-prune-amis.sh --adopt-legacy     # 태그 이전 AMI 목록 출력(+ --apply면 태그 부착)
#                                                        # 입양만 하고 끝난다 — 정리는 다음 실행에서 따로 검토
#     bash infra/aws/16-prune-amis.sh --allow-no-pin     # PINNED_AMI 없이 실행(비권장, 아래 참고)
#
# PINNED_AMI(env 또는 .ami)가 없으면 기본적으로 중단한다. 핀 보호가 조용히 빠진 채
# 지우지 않게 하려는 것이다 — 핀을 정말 모르는 상황이면 --allow-no-pin을 명시한다.
#
# 권한: ec2:DescribeImages/DescribeInstances/DescribeLaunchTemplateVersions,
#       ec2:CreateTags, ec2:DeregisterImage, ec2:DeleteSnapshot. 운영자(siglens-deployer)가
#       수동 실행한다 — deploy 어디서도 호출하지 않는다.
set -euo pipefail
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"
require aws

REGION="${AWS_REGION:-ap-northeast-2}"
AMI_FILE="$(dirname "$0")/.ami"
TAG_KEY="siglens:role"
TAG_VALUE="golden-ami"
LT_NAME="siglens-lt"

KEEP=3
APPLY=false
ADOPT=false
ALLOW_NO_PIN=false
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=true ;;
    --keep) KEEP="${2:?--keep needs a number}"; shift ;;
    --adopt-legacy) ADOPT=true ;;
    --allow-no-pin) ALLOW_NO_PIN=true ;;
    *) log "unknown arg: $1"; exit 2 ;;
  esac
  shift
done
[[ "$KEEP" =~ ^[0-9]+$ ]] && [ "$KEEP" -ge 1 ] || { log "ERROR: --keep must be an integer >= 1 (got $KEEP)"; exit 2; }

run() {
  if [ "$APPLY" = true ]; then "$@"; else log "DRY-RUN: $*"; fi
}

# ── 태그 이전 AMI 입양 ──────────────────────────────────────────────────────
if [ "$ADOPT" = true ]; then
  LEGACY=$(aws ec2 describe-images --region "$REGION" --owners self \
    --filters "Name=name,Values=siglens-golden-*" "Name=description,Values=siglens golden AMI*" \
    --query "Images[?!(Tags[?Key=='$TAG_KEY'])].[ImageId, join(' ', BlockDeviceMappings[].Ebs.SnapshotId || \`[]\`)]" \
    --output text)
  if [ -z "$LEGACY" ]; then
    log "adopt-legacy: no untagged siglens golden AMIs"
  else
    while read -r IMG SNAPS; do
      [ -n "$IMG" ] || continue
      log "adopt-legacy: tagging $IMG (+ snapshots: ${SNAPS:-none})"
      # shellcheck disable=SC2086  # 의도적 단어 분할: 스냅샷 ID를 개별 리소스로 넘긴다
      run aws ec2 create-tags --region "$REGION" --resources "$IMG" $SNAPS \
        --tags "Key=$TAG_KEY,Value=$TAG_VALUE"
    done <<< "$LEGACY"
  fi
  # 입양과 정리는 **별도 실행**이다. 같은 실행에서 이어 정리하면 방금 태그를 붙인 옛 AMI들이
  # 검토 없이 곧바로 삭제 후보가 된다(--apply가 둘 다에 걸린다).
  log "adopt-legacy done. Now run without --adopt-legacy to review prune candidates (dry-run first)."
  exit 0
fi

# ── 보호 집합 ───────────────────────────────────────────────────────────────
if [ -z "${PINNED_AMI:-}" ] && [ -f "$AMI_FILE" ]; then
  # shellcheck source=/dev/null
  source "$AMI_FILE"
fi
if [ -n "${PINNED_AMI:-}" ]; then
  [[ "$PINNED_AMI" =~ ^ami-[0-9a-f]+$ ]] || { log "ERROR: PINNED_AMI is not an AMI id: '$PINNED_AMI'"; exit 1; }
elif [ "$ALLOW_NO_PIN" != true ]; then
  log "ERROR: no PINNED_AMI (env or $AMI_FILE) — refusing to prune without the pin guard."
  log "       Set PINNED_AMI=ami-... (the CI vars.PINNED_AMI value), or pass --allow-no-pin explicitly."
  exit 1
else
  log "WARNING: --allow-no-pin — pruning without PINNED_AMI protection"
fi
PROTECTED="${PINNED_AMI:-}"
for V in '$Latest' '$Default'; do
  LT_AMI=$(aws ec2 describe-launch-template-versions --region "$REGION" \
    --launch-template-name "$LT_NAME" --versions "$V" \
    --query 'LaunchTemplateVersions[0].LaunchTemplateData.ImageId' --output text 2>/dev/null) || {
      # 런치 템플릿을 못 읽으면 "지금 쓰는 AMI"를 모르는 채로 지우게 된다 — 중단한다.
      log "ERROR: cannot read $LT_NAME $V — refusing to prune without knowing the in-use AMI"; exit 1; }
  # 'None'/빈 값이면(예: ImageId가 `resolve:ssm:` 별칭인 런치 템플릿) 지금 쓰는 AMI를 모른다 — 중단.
  [[ "$LT_AMI" =~ ^ami-[0-9a-f]+$ ]] || {
    log "ERROR: $LT_NAME $V ImageId is not an AMI id ('$LT_AMI') — refusing to prune"; exit 1; }
  PROTECTED="$PROTECTED $LT_AMI"
done
IN_USE=$(aws ec2 describe-instances --region "$REGION" \
  --filters "Name=instance-state-name,Values=pending,running,stopping,stopped,shutting-down" \
  --query 'Reservations[].Instances[].ImageId' --output text)
PROTECTED="$PROTECTED $IN_USE"
log "protected AMIs: $(echo "$PROTECTED" | tr ' \t' '\n\n' | grep -E '^ami-' | sort -u | tr '\n' ' ')"

is_protected() {
  local id="$1" p
  for p in $PROTECTED; do [ "$p" = "$id" ] && return 0; done
  return 1
}

# ── 후보: 태그 필터 + 최신순 ───────────────────────────────────────────────
# 출력: ImageId <tab> CreationDate <tab> Name, CreationDate 내림차순.
IMAGES=$(aws ec2 describe-images --region "$REGION" --owners self \
  --filters "Name=tag:$TAG_KEY,Values=$TAG_VALUE" \
  --query 'reverse(sort_by(Images, &CreationDate))[].[ImageId, CreationDate, Name]' \
  --output text)
if [ -z "$IMAGES" ]; then
  log "no AMIs tagged $TAG_KEY=$TAG_VALUE — nothing to do (run --adopt-legacy --apply for pre-tag bakes)"
  exit 0
fi

RANK=0
PRUNED=0
while IFS=$'\t' read -r IMG CREATED NAME; do
  [ -n "$IMG" ] || continue
  RANK=$((RANK + 1))
  if [ "$RANK" -le "$KEEP" ]; then
    log "keep   $IMG $CREATED $NAME (newest $RANK/$KEEP)"; continue
  fi
  if is_protected "$IMG"; then
    log "keep   $IMG $CREATED $NAME (protected: pinned / launch template / in use)"; continue
  fi
  # 스냅샷 ID는 deregister **전에** 읽는다 — 이후엔 이미지가 사라져 조회할 수 없다.
  SNAPS=$(aws ec2 describe-images --region "$REGION" --image-ids "$IMG" \
    --query 'Images[0].BlockDeviceMappings[].Ebs.SnapshotId' --output text)
  log "prune  $IMG $CREATED $NAME (snapshots: ${SNAPS:-none})"
  run aws ec2 deregister-image --region "$REGION" --image-id "$IMG"
  for S in $SNAPS; do
    [ "$S" = "None" ] && continue
    # 다른 AMI가 같은 스냅샷을 참조하면 삭제가 InvalidSnapshot.InUse로 실패한다 — 그건 맞는 결과다.
    run aws ec2 delete-snapshot --region "$REGION" --snapshot-id "$S" \
      || log "WARNING: could not delete snapshot $S (in use by another image?) — left in place"
  done
  PRUNED=$((PRUNED + 1))
done <<< "$IMAGES"

if [ "$APPLY" = true ]; then
  log "pruned $PRUNED AMI(s); kept newest $KEEP + protected"
else
  log "dry-run: would prune $PRUNED AMI(s). Re-run with --apply to execute."
fi
