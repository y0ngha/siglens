#!/usr/bin/env bash
#
# infra/aws/12-isr-cache.sh — ISR 캐시 S3 버킷 프로비저닝 (멱등)
#
# ISR 캐시 페이로드를 저장할 S3 버킷을 생성하고 퍼블릭 접근을 차단한다.
# 7일 lifecycle으로 미방문 캐시를 자동 정리해 디스크풀 재발을 방지한다.
# (순수 함수로 재생성이 저렴하므로 균일 만료로 단순화)
#
# 14일 → 7일로 줄인 이유: 캐시 키가 GIT_SHA(릴리스 버전) prefix로 갈리므로 배포 즉시
# 직전 prefix 전체가 영구 사문화된다 — 어떤 빌드도 다른 빌드의 prefix를 읽지 않는다.
# 14일이던 시절 죽은 prefix 16개가 83GB/100만 객체를 점유했다(2026-08 실측).
#
# 더 줄이지 않는 이유: S3 Expiration은 **객체 생성 시각** 기준이지 마지막 접근 기준이
# 아니다. ISR 페이지는 revalidate 창마다 다시 쓰이므로 대부분 문제가 안 되지만,
# `/[symbol]/{og,twitter}-image`는 revalidate가 30일이라 트래픽이 있어도 7일 안에
# 재기록되지 않는다 — 그것들만 만료 주기가 2배로 잦아진다(satori 콜드 렌더, 소셜
# 미리보기 지연뿐이며 랭킹 영향 없음). 7일은 태그 로그 보존(tagStore RETENTION_MS)과
# 같은 창이고, 더 줄이면 SEO pre-warm이 데워둔 롱테일이 크롤러보다 먼저 만료된다.
#
# 롤백 영향: prefix가 GIT_SHA로 갈리므로 7일보다 오래된 버전으로 롤백하면 그 prefix가
# 이미 비어 전 라우트 cold-gen이 된다(DEPLOY_RUNBOOK.md 참고). 릴리스 간격 중앙값이
# 0.3일이라 실무상 걸리는 경우는 장기 동결 후 롤백뿐이다.
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
# ⚠️ 버킷 이름은 infra/aws/12-isr-cache.sh, infra/aws/deploy.sh, .github/workflows/deploy.yml 3곳에서 동기화되어야 한다.
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

# 7일 만료 lifecycle (전체 prefix 균일 — 순수 함수라 재생성 저렴)
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "expire-7d",
      "Status": "Enabled",
      "Filter": { "Prefix": "" },
      "Expiration": { "Days": 7 },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 1 }
    }]
  }'

# 버킷 이름을 SSM에 게시 → user-data가 /siglens/* 를 fetch하므로 런타임 컨테이너 env에
# ISR_CACHE_BUCKET이 주입되어 cacheHandler가 활성화된다(빌드 타임 게이트는 build-arg가 담당).
aws ssm put-parameter --name /siglens/ISR_CACHE_BUCKET --value "$BUCKET" --type String --overwrite >/dev/null
log "published /siglens/ISR_CACHE_BUCKET=$BUCKET to SSM"

log "isr cache bucket ready: $BUCKET (7d lifecycle)"
