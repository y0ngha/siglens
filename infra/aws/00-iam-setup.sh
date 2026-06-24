#!/usr/bin/env bash
#
# infra/aws/00-iam-setup.sh — Vercel→AWS 마이그레이션 IAM 부트스트랩
#
# 사용자가 ADMIN 자격증명으로 1회 실행한다:
#     ! bash infra/aws/00-iam-setup.sh
#
# 전제: 현재 셸에 IAM을 만들 수 있는 AWS 자격증명(admin)이 설정돼 있어야 함
#       (기본 프로파일, 또는 AWS_PROFILE / AWS_ACCESS_KEY_ID+SECRET 환경변수).
#       확인: aws sts get-caller-identity 가 admin 계정을 반환해야 함.
#
# 결과:
#   - siglens-deployer (IAM 사용자, 인프라 프로비저닝용 / IAM 관리 권한 없음)
#   - siglens-ec2-role (+ instance profile)  — EC2가 ECR pull·SSM·로그
#   - siglens-ci-deploy (역할)               — GitHub Actions(OIDC)가 ECR push·배포
#   - GitHub OIDC provider
#   - deployer access key를 'siglens' 프로파일에 자동 기록 (SECRET은 출력하지 않음)
#
# 멱등성: 이미 존재하면 건너뛰거나 갱신한다. 안전하게 재실행 가능.
#
set -euo pipefail

REGION="${AWS_REGION:-ap-northeast-2}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IAM_DIR="$DIR/iam"

DEPLOYER=siglens-deployer
EC2_ROLE=siglens-ec2-role
CI_ROLE=siglens-ci-deploy

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
CALLER="$(aws sts get-caller-identity --query Arn --output text)"
echo "[iam] account=$ACCOUNT_ID region=$REGION"
echo "[iam] 실행 주체=$CALLER"
echo

# ACCOUNT_ID 치환 헬퍼 (정책 JSON 템플릿 → 실제 값)
sub() { sed "s/ACCOUNT_ID/$ACCOUNT_ID/g" "$1"; }

### 0) 서비스 연결 역할 (이미 있으면 무시) ###
aws iam create-service-linked-role --aws-service-name autoscaling.amazonaws.com >/dev/null 2>&1 || true
aws iam create-service-linked-role --aws-service-name elasticloadbalancing.amazonaws.com >/dev/null 2>&1 || true

### 1) 프로비저닝 사용자 siglens-deployer ###
aws iam get-user --user-name "$DEPLOYER" >/dev/null 2>&1 \
  || aws iam create-user --user-name "$DEPLOYER" >/dev/null
for P in AmazonEC2FullAccess AmazonEC2ContainerRegistryFullAccess \
         ElasticLoadBalancingFullAccess AutoScalingFullAccess \
         AWSCertificateManagerFullAccess AmazonSSMFullAccess \
         CloudWatchFullAccess CloudWatchLogsFullAccess; do
  aws iam attach-user-policy --user-name "$DEPLOYER" \
    --policy-arn "arn:aws:iam::aws:policy/$P"
done
# 인스턴스에 ec2 역할을 붙이려면 PassRole이 필요 — 그 역할 하나로만 한정(IAM 관리 권한 아님)
aws iam put-user-policy --user-name "$DEPLOYER" --policy-name siglens-passrole \
  --policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[{\"Effect\":\"Allow\",
      \"Action\":[\"iam:PassRole\",\"iam:GetInstanceProfile\"],
      \"Resource\":[\"arn:aws:iam::$ACCOUNT_ID:role/$EC2_ROLE\",
                    \"arn:aws:iam::$ACCOUNT_ID:instance-profile/$EC2_ROLE\"]}]
  }"
echo "[iam] user $DEPLOYER ready (+ 8 managed policies, scoped PassRole)"

### 2) EC2 인스턴스 역할 + 인스턴스 프로파일 ###
aws iam get-role --role-name "$EC2_ROLE" >/dev/null 2>&1 \
  || aws iam create-role --role-name "$EC2_ROLE" --assume-role-policy-document '{
       "Version":"2012-10-17",
       "Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]
     }' >/dev/null
aws iam attach-role-policy --role-name "$EC2_ROLE" \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws iam put-role-policy --role-name "$EC2_ROLE" --policy-name siglens-ec2-inline \
  --policy-document "$(sub "$IAM_DIR/ec2-role-policy.json")"
aws iam get-instance-profile --instance-profile-name "$EC2_ROLE" >/dev/null 2>&1 \
  || aws iam create-instance-profile --instance-profile-name "$EC2_ROLE" >/dev/null
aws iam add-role-to-instance-profile --instance-profile-name "$EC2_ROLE" --role-name "$EC2_ROLE" 2>/dev/null \
  || true   # 이미 추가돼 있으면 LimitExceeded — 무시
echo "[iam] role $EC2_ROLE + instance profile ready"

### 3) GitHub OIDC provider ###
OIDC_ARN="arn:aws:iam::$ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" >/dev/null 2>&1 \
  || aws iam create-open-id-connect-provider \
       --url https://token.actions.githubusercontent.com \
       --client-id-list sts.amazonaws.com \
       --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 1c58a3a8518e8759bf075b76b750d4f2df264fcd >/dev/null
echo "[iam] GitHub OIDC provider ready"

### 4) CI 배포 역할 (OIDC 신뢰, 태그 push로 제한) ###
if aws iam get-role --role-name "$CI_ROLE" >/dev/null 2>&1; then
  aws iam update-assume-role-policy --role-name "$CI_ROLE" \
    --policy-document "$(sub "$IAM_DIR/ci-deploy-trust.json")"
else
  aws iam create-role --role-name "$CI_ROLE" \
    --assume-role-policy-document "$(sub "$IAM_DIR/ci-deploy-trust.json")" >/dev/null
fi
aws iam put-role-policy --role-name "$CI_ROLE" --policy-name siglens-ci-inline \
  --policy-document "$(sub "$IAM_DIR/ci-deploy-policy.json")"
CI_ARN="$(aws iam get-role --role-name "$CI_ROLE" --query 'Role.Arn' --output text)"
echo "[iam] role $CI_ROLE ready"

### 5) deployer access key → 'siglens' 프로파일 자동 구성 (SECRET 미출력) ###
if aws configure get aws_access_key_id --profile siglens >/dev/null 2>&1; then
  echo "[iam] 'siglens' 프로파일이 이미 있음 — access key 생성 건너뜀"
else
  # create-access-key는 SECRET을 1회만 반환한다. 탭 구분으로 받아 변수에만 저장하고 출력하지 않는다.
  PAIR="$(aws iam create-access-key --user-name "$DEPLOYER" \
            --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text)"
  AKID="$(printf '%s' "$PAIR" | cut -f1)"
  SECRET="$(printf '%s' "$PAIR" | cut -f2)"
  aws configure set aws_access_key_id "$AKID" --profile siglens
  aws configure set aws_secret_access_key "$SECRET" --profile siglens
  aws configure set region "$REGION" --profile siglens
  aws configure set output json --profile siglens
  unset PAIR SECRET
  echo "[iam] 'siglens' 프로파일 구성 완료 (access key id=$AKID, secret은 출력하지 않음)"
fi

cat <<EOF

==================== 완료 — 다음 단계 ====================
1) GitHub repo secret 등록 (Settings → Secrets and variables → Actions):
     AWS_DEPLOY_ROLE_ARN = $CI_ARN
     SIGLENS_GITHUB_TOKEN = (없으면, core 비공개 패키지용 기존 토큰)
2) 프로파일 검증:
     aws --profile siglens sts get-caller-identity
   → siglens-deployer 사용자가 나오면 성공.
3) 이후 Claude가 Phase C(ECR·보안그룹·ACM·SSM·ALB·ASG·알람)를
   --profile siglens 로 프로비저닝합니다.
=========================================================
EOF
