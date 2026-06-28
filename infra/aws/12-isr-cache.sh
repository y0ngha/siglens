#!/usr/bin/env bash
#
# infra/aws/12-isr-cache.sh — ISR 캐시 S3 버킷 프로비저닝 (멱등)
#
# ISR 캐시 페이로드를 저장할 S3 버킷을 생성하고 퍼블릭 접근을 차단한다.
# 14일 lifecycle으로 미방문 캐시를 자동 정리해 디스크풀 재발을 방지한다.
# (순수 함수로 재생성이 저렴하므로 균일 만료로 단순화)
#
# ⚠️ 부트스트랩 순서(중요): 이 스크립트는 첫 태그 배포 전에 1회 수동 실행해야 한다.
#    버킷을 만들고 /siglens/ISR_CACHE_BUCKET을 SSM에 게시한다(멱등). deploy.sh의
#    env 완전성 게이트(check-env.sh)가 .env.example의 ISR_CACHE_BUCKET 때문에 이
#    SSM 파라미터를 요구하므로, 미실행 시 배포가 누락 키로 중단된다. deploy 어디서도
#    이 스크립트를 자동 호출하지 않는다(인프라 부트스트랩은 수동).
#
# 사용법:
#     bash infra/aws/12-isr-cache.sh
#
# 전제: --profile siglens (또는 AWS_PROFILE) 로 충분한 권한이 있어야 함.
#       EC2 역할 권한(IsrCacheS3)은 infra/aws/iam/ec2-role-policy.json 참고.
#
set -euo pipefail

source "$(dirname "$0")/lib.sh"
source "$(dirname "$0")/.env"

REGION="${AWS_REGION:-ap-northeast-2}"
BUCKET="${ISR_CACHE_BUCKET:-siglens-isr-cache}"

# 버킷 생성 (없을 때만)
if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"
  log "created bucket $BUCKET"
fi

# 퍼블릭 접근 차단
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# 14일 만료 lifecycle (전체 prefix 균일 — 순수 함수라 재생성 저렴)
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "expire-14d",
      "Status": "Enabled",
      "Filter": { "Prefix": "" },
      "Expiration": { "Days": 14 }
    }]
  }'

# 버킷 이름을 SSM에 게시 → user-data가 /siglens/* 를 fetch하므로 런타임 컨테이너 env에
# ISR_CACHE_BUCKET이 주입되어 cacheHandler가 활성화된다(빌드 타임 게이트는 build-arg가 담당).
aws ssm put-parameter --name /siglens/ISR_CACHE_BUCKET --value "$BUCKET" --type String --overwrite >/dev/null
log "published /siglens/ISR_CACHE_BUCKET=$BUCKET to SSM"

log "isr cache bucket ready: $BUCKET (14d lifecycle)"
