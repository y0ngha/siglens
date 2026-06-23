# Vercel → AWS 마이그레이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** siglens Next.js 앱을 Vercel에서 AWS(서울)의 단일 EC2 t4g.medium + ALB + 로컬 EBS로 이관하고, CloudFlare를 앞단으로 유지한 채 beta.siglens.io 검증 후 siglens.io로 무중단 컷오버한다.

**Architecture:** Docker(arm64, Next standalone) 이미지를 ECR에 보관, GitHub Actions가 `v*` 태그 push 시 빌드·푸시·ASG instance refresh로 배포. ISR 캐시는 로컬 EBS(과금 0). 시크릿은 SSM Parameter Store. IAM 주체는 사용자가 발급, 그 외 인프라는 AWS CLI 스크립트(`infra/aws/`)로 프로비저닝.

**Tech Stack:** Next.js 16.2 standalone, Docker(node:22-alpine, tini), AWS ECR/EC2/ALB/ASG/ACM/SSM/CloudWatch, GitHub Actions(OIDC), CloudFlare DNS/WAF.

**설계 출처:** `docs/superpowers/specs/2026-06-24-vercel-to-aws-migration-design.md`

---

## File Structure

신규/수정 파일과 책임:

| 파일 | 책임 |
|---|---|
| `src/app/api/health/route.ts` | ALB 헬스체크용 shallow 200 (신규) |
| `next.config.ts` | `output: 'standalone'` + `compress: false` (수정) |
| `package.json` | `sharp` deps 추가 (수정) |
| `Dockerfile` | arm64 멀티스테이지 standalone 빌드 (신규) |
| `.dockerignore` | 빌드 컨텍스트 축소 (신규) |
| `scripts/assert-standalone-skills.mjs` | 빌드 후 `skills/**` 포함 검증 (신규) |
| `infra/aws/iam/*.json` + `00-prereqs.md` | IAM 정책 + 사용자 발급 절차 (신규) |
| `infra/aws/01-ecr.sh` ~ `06-alb-asg.sh`, `deploy.sh`, `user-data.sh` | IaC 프로비저닝 (신규) |
| `infra/aws/env.example`, `infra/aws/lib.sh` | 공통 변수/헬퍼 (신규) |
| `.github/workflows/deploy.yml` | `v*` 태그 배포 (신규) |
| `docs/architecture/INFRA_AWS.md` 등 | 런북/문서 (신규/수정) |

**작업 순서**: Phase A(앱 코드, 독립 머지 가능) → Phase B(IAM, 사용자) → Phase C(IaC, Claude) → Phase D(CI) → Phase E(컷오버/문서).

---

# Phase A — 앱 코드 변경 (repo, 독립 테스트 가능)

## Task 1: 헬스체크 엔드포인트

**Files:**
- Create: `src/app/api/health/route.ts`
- Test: `src/app/api/health/route.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/app/api/health/route.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('GET /api/health', () => {
    it('200과 { status: "ok" }를 반환한다', async () => {
        const res = GET();
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ status: 'ok' });
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn vitest run src/app/api/health/route.test.ts`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: 최소 구현**

`src/app/api/health/route.ts`:
```ts
// ALB 타깃 그룹 헬스체크 전용. shallow — DB/Redis를 타지 않는다.
// (30초마다 호출되므로 외부 의존성 블립이 인스턴스를 죽이면 안 됨)
export const dynamic = 'force-dynamic';

export function GET() {
    return Response.json({ status: 'ok' }, { status: 200 });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn vitest run src/app/api/health/route.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/health/route.ts src/app/api/health/route.test.ts
git commit -m "feat(infra): add /api/health shallow endpoint for ALB"
```

---

## Task 2: next.config — standalone 출력 + 압축 비활성

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: `output`/`compress` 추가**

`next.config.ts`의 `nextConfig` 객체 최상단(`allowedDevOrigins` 위)에 추가:
```ts
    // self-host: Docker 최소 번들(.next/standalone + server.js)
    output: 'standalone',

    // 압축은 CloudFlare가 brotli로 엣지에서 수행 → Next의 gzip 이중압축 방지
    compress: false,
```

- [ ] **Step 2: 빌드로 standalone 출력 검증**

Run: `NEXT_PUBLIC_SITE_URL=https://siglens.io yarn build`
Expected: 빌드 성공 + `.next/standalone/server.js` 생성. 확인:
```bash
test -f .next/standalone/server.js && echo "standalone OK"
```
Expected: `standalone OK`

- [ ] **Step 3: 커밋**

```bash
git add next.config.ts
git commit -m "feat(infra): enable standalone output, disable compress (CF brotli)"
```

---

## Task 3: sharp 의존성 추가

**Files:**
- Modify: `package.json`, `yarn.lock`

- [ ] **Step 1: sharp 추가**

Run: `yarn add sharp`
(self-host `next/image` 런타임 최적화에 필요. Vercel은 자동 제공했음. Docker 빌드 시 linux-arm64 바이너리가 설치됨)

- [ ] **Step 2: 설치 확인**

Run: `node -e "console.log(require('./package.json').dependencies.sharp)"`
Expected: 버전 문자열 출력(예: `^0.34.x`)

- [ ] **Step 3: 커밋**

```bash
git add package.json yarn.lock
git commit -m "feat(infra): add sharp for self-hosted next/image optimization"
```

---

## Task 4: standalone skills 포함 검증 스크립트

**Files:**
- Create: `scripts/assert-standalone-skills.mjs`

`skills/**`는 런타임 `fs`로 읽혀 outputFileTracing이 누락할 수 있으므로 빌드 후 검증한다.

- [ ] **Step 1: 검증 스크립트 작성**

`scripts/assert-standalone-skills.mjs`:
```js
// 빌드 후 .next/standalone에 skills/ 파일이 포함됐는지 확인.
// outputFileTracingIncludes가 누락하면 런타임 Server Action이 skills를 못 읽는다.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const standaloneSkills = join(process.cwd(), '.next', 'standalone', 'skills');
const sourceSkills = join(process.cwd(), 'skills');

if (!existsSync(sourceSkills)) {
    console.error('FAIL: source skills/ 디렉토리가 없음');
    process.exit(1);
}
if (!existsSync(standaloneSkills)) {
    console.error('FAIL: .next/standalone/skills 가 없음 — outputFileTracingIncludes 확인 필요');
    process.exit(1);
}
const count = readdirSync(standaloneSkills, { recursive: true }).filter((f) => String(f).endsWith('.md')).length;
if (count === 0) {
    console.error('FAIL: standalone/skills 에 .md 파일이 0개');
    process.exit(1);
}
console.log(`OK: standalone/skills 에 .md ${count}개 포함`);
```

- [ ] **Step 2: 직전 빌드 산출물로 검증 실행**

Run: `node scripts/assert-standalone-skills.mjs`
Expected: `OK: standalone/skills 에 .md N개 포함`
(만약 FAIL이면 `next.config.ts`의 `outputFileTracingIncludes`가 standalone까지 복사하지 못한 것 — Dockerfile에서 `skills/`를 명시 복사하므로 Task 6에서 이중 보장)

- [ ] **Step 3: 커밋**

```bash
git add scripts/assert-standalone-skills.mjs
git commit -m "test(infra): assert skills/ landed in standalone output"
```

---

## Task 5: Dockerfile + .dockerignore

**Files:**
- Create: `Dockerfile`, `.dockerignore`

- [ ] **Step 1: .dockerignore 작성**

`.dockerignore`:
```
node_modules
.next
.git
.github
coverage
playwright-report
test-results
e2e
**/*.test.ts
**/*.test.tsx
**/__tests__
.env*
docs
```

- [ ] **Step 2: Dockerfile 작성**

`Dockerfile`:
```dockerfile
# syntax=docker/dockerfile:1

# ---- builder ----
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare yarn@4.12.0 --activate
WORKDIR /app

# 의존성 (private @y0ngha/siglens-core 설치에 토큰 필요)
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn ./.yarn
RUN --mount=type=secret,id=SIGLENS_GITHUB_TOKEN \
    SIGLENS_GITHUB_TOKEN="$(cat /run/secrets/SIGLENS_GITHUB_TOKEN)" \
    yarn install --immutable

# 소스 + 빌드 (NEXT_PUBLIC_*는 빌드타임 인라인)
COPY . .
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
ARG NEXT_PUBLIC_ADSENSE_ENABLED
ARG NEXT_PUBLIC_ADSENSE_PUBLISHER_ID
ARG NEXT_PUBLIC_ADSENSE_SLOT_PANEL_BOTTOM
ARG NEXT_PUBLIC_ADSENSE_SLOT_PROGRESS
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=$NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION \
    NEXT_PUBLIC_ADSENSE_ENABLED=$NEXT_PUBLIC_ADSENSE_ENABLED \
    NEXT_PUBLIC_ADSENSE_PUBLISHER_ID=$NEXT_PUBLIC_ADSENSE_PUBLISHER_ID \
    NEXT_PUBLIC_ADSENSE_SLOT_PANEL_BOTTOM=$NEXT_PUBLIC_ADSENSE_SLOT_PANEL_BOTTOM \
    NEXT_PUBLIC_ADSENSE_SLOT_PROGRESS=$NEXT_PUBLIC_ADSENSE_SLOT_PROGRESS
RUN yarn build
# skills 포함 검증 (실패 시 빌드 중단)
RUN node scripts/assert-standalone-skills.mjs

# ---- runner ----
FROM node:22-alpine AS runner
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# standalone 번들 + static + public + skills(명시 복사로 이중 보장)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/skills ./skills
# sharp가 standalone에 트레이싱됐는지 빌드타임 검증 (리서치 #1 함정: runner에서 sharp 누락)
# 실패 시: 아래 줄을 COPY --from=builder /app/node_modules/sharp ./node_modules/sharp +
#          /app/node_modules/@img 로 명시 복사하여 해결
RUN node -e "require.resolve('sharp')" || (echo 'FAIL: sharp가 standalone에 없음' && exit 1)
EXPOSE 3000
# tini로 SIGTERM을 PID1 node에 전달 → Next standalone이 in-flight 요청 드레인
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
```

- [ ] **Step 3: 로컬 빌드 (arm64)**

Run:
```bash
DOCKER_BUILDKIT=1 docker build --platform linux/arm64 \
  --secret id=SIGLENS_GITHUB_TOKEN,env=SIGLENS_GITHUB_TOKEN \
  --build-arg NEXT_PUBLIC_SITE_URL=https://siglens.io \
  -t siglens:local .
```
(사전: `export SIGLENS_GITHUB_TOKEN=<토큰>`)
Expected: 빌드 성공 + 빌드 로그에 `OK: standalone/skills 에 .md N개 포함`

> 참고: `.nvmrc`는 Node 25지만 컨테이너는 LTS `node:22-alpine`. 빌드 실패 시 node 버전을 맞춰 재시도하고 결과를 기록.

- [ ] **Step 4: 로컬 컨테이너 스모크 (헬스 + 그레이스풀 셧다운)**

Run:
```bash
docker run --rm -d --name siglens-smoke -p 3000:3000 \
  --env-file <(grep -E '^(DATABASE_URL|UPSTASH|OAUTH|FMP|GEMINI|RESEND|WORKER|LLM|TRANSLATE|EMAIL|CRON|GOOGLE_CLIENT|KAKAO|DIRECT)' .env.production) \
  siglens:local
sleep 5
curl -fsS http://localhost:3000/api/health
echo
# SIGTERM 그레이스풀 드레인 확인
time docker stop siglens-smoke
```
Expected: `{"status":"ok"}` 출력, `docker stop`이 30초 타임아웃 전에 정상 종료(in-flight 없으면 즉시)

- [ ] **Step 5: 커밋**

```bash
git add Dockerfile .dockerignore
git commit -m "feat(infra): add arm64 standalone Dockerfile with tini + sharp"
```

---

## Task 6: Phase A 머지

- [ ] **Step 1: 전체 테스트 + 린트**

Run: `yarn test && yarn lint`
Expected: PASS

- [ ] **Step 2: PR 생성 (git-agent 위임)**

Phase A는 앱 동작에 영향 없는 추가/설정이므로 `docs/aws-migration-spec`에 누적하거나 별도 `feat/aws-app-prep` 브랜치로 PR. (오케스트레이터가 git-agent에 위임)

---

# Phase B — IAM 사전작업 (사용자 발급, Claude는 정책/절차 제공)

## Task 7: IAM 정책 JSON + prereqs 문서

**Files:**
- Create: `infra/aws/iam/ec2-role-policy.json`, `infra/aws/iam/ci-deploy-trust.json`, `infra/aws/iam/ci-deploy-policy.json`, `infra/aws/iam/deployer-boundary.md`, `infra/aws/00-prereqs.md`

- [ ] **Step 1: EC2 인스턴스 역할 정책**

`infra/aws/iam/ec2-role-policy.json` (관리형 `AmazonSSMManagedInstanceCore`와 함께 부착):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EcrPull",
      "Effect": "Allow",
      "Action": ["ecr:GetAuthorizationToken", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"],
      "Resource": "*"
    },
    {
      "Sid": "ReadAppSecrets",
      "Effect": "Allow",
      "Action": ["ssm:GetParametersByPath", "ssm:GetParameters", "ssm:GetParameter"],
      "Resource": "arn:aws:ssm:ap-northeast-2:ACCOUNT_ID:parameter/siglens/*"
    },
    {
      "Sid": "DecryptSecrets",
      "Effect": "Allow",
      "Action": ["kms:Decrypt"],
      "Resource": "*"
    },
    {
      "Sid": "Logs",
      "Effect": "Allow",
      "Action": ["logs:CreateLogStream", "logs:PutLogEvents", "logs:CreateLogGroup"],
      "Resource": "arn:aws:logs:ap-northeast-2:ACCOUNT_ID:log-group:/siglens/*"
    }
  ]
}
```

- [ ] **Step 2: CI 배포 역할 신뢰 + 권한 정책**

`infra/aws/iam/ci-deploy-trust.json` (GitHub OIDC, 태그 push로 제한):
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike": { "token.actions.githubusercontent.com:sub": "repo:y0ngha/siglens:ref:refs/tags/v*" }
    }
  }]
}
```

`infra/aws/iam/ci-deploy-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EcrPush",
      "Effect": "Allow",
      "Action": ["ecr:GetAuthorizationToken", "ecr:BatchCheckLayerAvailability", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload", "ecr:PutImage"],
      "Resource": "*"
    },
    {
      "Sid": "Deploy",
      "Effect": "Allow",
      "Action": ["ec2:CreateLaunchTemplateVersion", "ec2:DescribeLaunchTemplates", "ec2:DescribeLaunchTemplateVersions", "autoscaling:StartInstanceRefresh", "autoscaling:DescribeInstanceRefreshes", "autoscaling:DescribeAutoScalingGroups", "autoscaling:UpdateAutoScalingGroup"],
      "Resource": "*"
    },
    {
      "Sid": "BuildTimeDbUrl",
      "Effect": "Allow",
      "Action": ["ssm:GetParameter"],
      "Resource": "arn:aws:ssm:ap-northeast-2:ACCOUNT_ID:parameter/siglens/DATABASE_URL"
    },
    {
      "Sid": "BuildTimeDbUrlDecrypt",
      "Effect": "Allow",
      "Action": ["kms:Decrypt"],
      "Resource": "*"
    }
  ]
}
```
> ⚠️ **빌드타임 DB 의존**: `yarn build`가 ISR prerender(`/news/[category]` 등)에서 DB를 호출하므로 Docker 빌드에 `DATABASE_URL`이 필요(Vercel은 빌드 시 전체 env가 있어 자동 충족). CI는 위 권한으로 SSM `/siglens/DATABASE_URL`을 읽어 **build secret(`--secret id=DATABASE_URL`)으로 주입**한다(build-arg 금지 — 로그 노출). Dockerfile은 이미 `--mount=type=secret,id=DATABASE_URL`로 받음.

- [ ] **Step 3: prereqs 문서 작성**

`infra/aws/00-prereqs.md` — 사용자가 순서대로 수행:
```markdown
# AWS 사전작업 (사용자 수행)

ACCOUNT_ID, 리전 ap-northeast-2 가정. ACCOUNT_ID는 `aws sts get-caller-identity` 로 확인.

## 1. 프로비저닝 IAM 사용자 (siglens-deployer)
- IAM 콘솔 → 사용자 생성 `siglens-deployer`, 프로그래밍 액세스
- 권한: AWS 관리형 `AmazonEC2FullAccess`, `AmazonECS_FullAccess`(불필요시 생략), `ElasticLoadBalancingFullAccess`, `AutoScalingFullAccess`, `AWSCertificateManagerFullAccess`, `AmazonSSMFullAccess`, `CloudWatchLogsFullAccess`, `AmazonEC2ContainerRegistryFullAccess`
- ⚠️ IAM 관련 관리형 정책은 **부착하지 말 것** (Claude CLI가 권한을 못 바꾸도록)
- access key 발급 → 로컬에서 `aws configure --profile siglens` 설정 (리전 ap-northeast-2)

## 2. EC2 인스턴스 역할 (siglens-ec2-role)
- 역할 생성, 신뢰 주체 = EC2
- 부착: 관리형 `AmazonSSMManagedInstanceCore` + 인라인 정책 `iam/ec2-role-policy.json` (ACCOUNT_ID 치환)
- 인스턴스 프로파일 자동 생성 확인

## 3. GitHub OIDC provider
- IAM → Identity providers → Add → OpenID Connect
- URL: https://token.actions.githubusercontent.com , Audience: sts.amazonaws.com

## 4. CI 배포 역할 (siglens-ci-deploy)
- 역할 생성, 신뢰 정책 = `iam/ci-deploy-trust.json` (ACCOUNT_ID 치환)
- 권한 = `iam/ci-deploy-policy.json`
- 역할 ARN 기록

## 5. GitHub repo secrets (y0ngha/siglens)
- `AWS_DEPLOY_ROLE_ARN` = 4번 역할 ARN
- `SIGLENS_GITHUB_TOKEN` = 기존 core 설치 토큰 (이미 있으면 확인)
```

- [ ] **Step 4: 커밋**

```bash
git add infra/aws/iam infra/aws/00-prereqs.md
git commit -m "docs(infra): IAM policies and AWS prerequisites for migration"
```

- [ ] **Step 5: 사용자 확인 게이트**

오케스트레이터는 사용자에게 00-prereqs.md 5단계 완료 + `aws --profile siglens sts get-caller-identity` 성공을 확인받은 뒤 Phase C 진행.

---

# Phase C — IaC 프로비저닝 (Claude가 `aws --profile siglens`로 실행)

## Task 8: 공통 변수/헬퍼 + ECR

**Files:**
- Create: `infra/aws/env.example`, `infra/aws/lib.sh`, `infra/aws/01-ecr.sh`

- [ ] **Step 1: 공통 env/헬퍼**

`infra/aws/env.example` (복사해 `infra/aws/.env`로 사용, .gitignore):
```bash
export AWS_PROFILE=siglens
export AWS_REGION=ap-northeast-2
export APP=siglens
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ECR_REPO=siglens
export DOMAINS="beta.siglens.io siglens.io www.siglens.io"
export INSTANCE_TYPE=t4g.medium
export EC2_ROLE=siglens-ec2-role
```

`infra/aws/lib.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
here() { cd "$(dirname "${BASH_SOURCE[0]}")"; }
log() { echo "[infra] $*"; }
require() { command -v "$1" >/dev/null || { echo "need $1"; exit 1; }; }
```

- [ ] **Step 2: ECR 스크립트 (리포 + keep-3)**

`infra/aws/01-ecr.sh`:
```bash
#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"
require aws
aws ecr describe-repositories --repository-names "$ECR_REPO" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "$ECR_REPO" \
       --image-scanning-configuration scanOnPush=true
aws ecr put-lifecycle-policy --repository-name "$ECR_REPO" --lifecycle-policy-text '{
  "rules":[{"rulePriority":1,"description":"keep last 3",
    "selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":3},
    "action":{"type":"expire"}}]}'
log "ECR ready: $(aws ecr describe-repositories --repository-names "$ECR_REPO" --query 'repositories[0].repositoryUri' --output text)"
```

- [ ] **Step 3: 실행 + 검증**

Run: `bash infra/aws/01-ecr.sh`
Expected: `ECR ready: ACCOUNT_ID.dkr.ecr.ap-northeast-2.amazonaws.com/siglens`

- [ ] **Step 4: 커밋**

```bash
git add infra/aws/env.example infra/aws/lib.sh infra/aws/01-ecr.sh
echo "infra/aws/.env" >> .gitignore
git add .gitignore
git commit -m "feat(infra): ECR repo with keep-last-3 lifecycle"
```

---

## Task 9: 보안그룹 (ALB=CF IP, EC2=ALB)

**Files:**
- Create: `infra/aws/02-network.sh`

- [ ] **Step 1: 스크립트 작성**

`infra/aws/02-network.sh`:
```bash
#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"

VPC_ID=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)
log "VPC: $VPC_ID"

# ALB SG
ALB_SG=$(aws ec2 create-security-group --group-name siglens-alb-sg \
  --description "siglens ALB - CF IPs only" --vpc-id "$VPC_ID" --query GroupId --output text 2>/dev/null \
  || aws ec2 describe-security-groups --filters Name=group-name,Values=siglens-alb-sg --query 'SecurityGroups[0].GroupId' --output text)

# CloudFlare IPv4 대역만 443 인바운드
for cidr in $(curl -fsS https://www.cloudflare.com/ips-v4); do
  aws ec2 authorize-security-group-ingress --group-id "$ALB_SG" \
    --protocol tcp --port 443 --cidr "$cidr" 2>/dev/null || true
done

# EC2 SG (3000 ← ALB SG)
EC2_SG=$(aws ec2 create-security-group --group-name siglens-ec2-sg \
  --description "siglens EC2 - from ALB" --vpc-id "$VPC_ID" --query GroupId --output text 2>/dev/null \
  || aws ec2 describe-security-groups --filters Name=group-name,Values=siglens-ec2-sg --query 'SecurityGroups[0].GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id "$EC2_SG" \
  --protocol tcp --port 3000 --source-group "$ALB_SG" 2>/dev/null || true

cat > "$(dirname "$0")/.ids" <<EOF
export VPC_ID=$VPC_ID
export ALB_SG=$ALB_SG
export EC2_SG=$EC2_SG
EOF
log "ALB_SG=$ALB_SG EC2_SG=$EC2_SG (saved to .ids)"
```

- [ ] **Step 2: 실행 + 검증**

Run: `bash infra/aws/02-network.sh`
Expected: `ALB_SG=sg-... EC2_SG=sg-...`, `.ids` 파일 생성. CF 룰 확인:
```bash
source infra/aws/.ids
aws ec2 describe-security-groups --group-ids "$ALB_SG" --query 'SecurityGroups[0].IpPermissions[0].IpRanges | length(@)'
```
Expected: 15 내외(CF IPv4 대역 수)

- [ ] **Step 3: 커밋**

```bash
echo "infra/aws/.ids" >> .gitignore
git add infra/aws/02-network.sh .gitignore
git commit -m "feat(infra): security groups (ALB=CloudFlare IPs, EC2=from ALB)"
```

---

## Task 10: ACM 인증서 + DNS 검증

**Files:**
- Create: `infra/aws/03-acm.sh`

- [ ] **Step 1: 스크립트 작성**

`infra/aws/03-acm.sh`:
```bash
#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"
PRIMARY=siglens.io
SANS=(beta.siglens.io www.siglens.io)
CERT_ARN=$(aws acm request-certificate --domain-name "$PRIMARY" \
  --subject-alternative-names "${SANS[@]}" --validation-method DNS \
  --query CertificateArn --output text)
echo "export CERT_ARN=$CERT_ARN" >> "$(dirname "$0")/.ids"
log "Cert requested: $CERT_ARN"
sleep 5
log "다음 CNAME을 CloudFlare에 grey-cloud로 추가하세요:"
aws acm describe-certificate --certificate-arn "$CERT_ARN" \
  --query 'Certificate.DomainValidationOptions[].ResourceRecord' --output table
```

- [ ] **Step 2: 실행**

Run: `bash infra/aws/03-acm.sh`
Expected: CNAME 검증 레코드 테이블 출력

- [ ] **Step 3: CloudFlare에 검증 CNAME 추가 (Chrome 또는 사용자)**

오케스트레이터가 Chrome으로 CF DNS에 출력된 CNAME들을 grey-cloud(DNS-only)로 추가. 그 후 검증 대기:
```bash
source infra/aws/.ids
aws acm wait certificate-validated --certificate-arn "$CERT_ARN" && echo "ISSUED"
```
Expected: 수 분 내 `ISSUED`

- [ ] **Step 4: 커밋**

```bash
git add infra/aws/03-acm.sh
git commit -m "feat(infra): ACM cert request for siglens.io + beta + www (DNS validation)"
```

---

## Task 11: SSM 파라미터 적재

**Files:**
- Create: `infra/aws/04-params.sh`

- [ ] **Step 1: 스크립트 작성**

`infra/aws/04-params.sh` (런타임 서버 env만 — `NEXT_PUBLIC_*`/`SIGLENS_GITHUB_TOKEN` 제외):
```bash
#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"
SRC="${1:?usage: 04-params.sh <env-file>}"   # 예: .env.production
# 런타임에 필요 없는 키 제외
EXCLUDE='^(NEXT_PUBLIC_|SIGLENS_GITHUB_TOKEN)'
while IFS='=' read -r key val; do
  [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
  [[ "$key" =~ $EXCLUDE ]] && continue
  val="${val%\"}"; val="${val#\"}"
  aws ssm put-parameter --name "/siglens/$key" --type SecureString \
    --value "$val" --overwrite >/dev/null
  log "put /siglens/$key"
done < <(grep -E '^[A-Z]' "$SRC")
log "done"
```

- [ ] **Step 2: OAuth redirect 값 확인 (D10 — 고정 siglens.io)**

Run: `grep '^OAUTH_REDIRECT_BASE_URL=' .env.production`
Expected: `OAUTH_REDIRECT_BASE_URL="https://siglens.io"` (beta가 아니라 prod 도메인 고정. 다르면 수정 후 진행 — 컷오버 후 OAuth가 정상 동작하려면 siglens.io여야 함)

- [ ] **Step 3: 실행 + 검증**

Run: `bash infra/aws/04-params.sh .env.production`
Expected: 각 키 `put /siglens/<KEY>`. 확인:
```bash
aws ssm get-parameters-by-path --path /siglens/ --query 'Parameters | length(@)'
```
Expected: ~24 (28개 중 NEXT_PUBLIC 6 + 토큰 제외)

- [ ] **Step 4: 커밋**

```bash
git add infra/aws/04-params.sh
git commit -m "feat(infra): load runtime secrets into SSM Parameter Store"
```

---

## Task 12: Launch Template + user-data

**Files:**
- Create: `infra/aws/user-data.sh`, `infra/aws/05-launch-template.sh`

- [ ] **Step 1: user-data 작성**

`infra/aws/user-data.sh` (인스턴스 부팅 시: docker 설치, SSM env fetch, ECR 로그인, 컨테이너 실행):
```bash
#!/usr/bin/env bash
set -euxo pipefail
dnf install -y docker || yum install -y docker
systemctl enable --now docker
REGION=ap-northeast-2
ACCOUNT_ID=$(curl -s http://169.254.169.254/latest/dynamic/instance-identity/document | grep accountId | cut -d'"' -f4)
ECR="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

# SSM → env-file
mkdir -p /run/siglens
aws ssm get-parameters-by-path --region "$REGION" --path /siglens/ --with-decryption \
  --query 'Parameters[].[Name,Value]' --output text \
  | sed 's#/siglens/##' | awk -F'\t' '{print $1"="$2}' > /run/siglens/env

# ECR 로그인 + 최신 이미지 (태그는 launch template 갱신 시 치환됨)
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ECR"
IMAGE="$ECR/siglens:__IMAGE_TAG__"
docker pull "$IMAGE"

# systemd 유닛으로 컨테이너 관리 (graceful stop 30s)
cat > /etc/systemd/system/siglens.service <<UNIT
[Unit]
Description=siglens
After=docker.service
Requires=docker.service
[Service]
TimeoutStopSec=35
ExecStartPre=-/usr/bin/docker rm -f siglens
ExecStart=/usr/bin/docker run --rm --name siglens -p 3000:3000 --env-file /run/siglens/env $IMAGE
ExecStop=/usr/bin/docker stop -t 30 siglens
Restart=always
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now siglens
```

- [ ] **Step 2: launch template 스크립트**

`infra/aws/05-launch-template.sh`:
```bash
#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"; source "$(dirname "$0")/.ids"
TAG="${1:?usage: 05-launch-template.sh <image-tag>}"   # 예: v0.26.0
AMI=$(aws ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 --query 'Parameter.Value' --output text)
UD=$(sed "s/__IMAGE_TAG__/$TAG/" "$(dirname "$0")/user-data.sh" | base64)

aws ec2 create-launch-template --launch-template-name siglens-lt \
  --version-description "$TAG" \
  --launch-template-data "{
    \"ImageId\":\"$AMI\",
    \"InstanceType\":\"$INSTANCE_TYPE\",
    \"IamInstanceProfile\":{\"Name\":\"$EC2_ROLE\"},
    \"SecurityGroupIds\":[\"$EC2_SG\"],
    \"BlockDeviceMappings\":[{\"DeviceName\":\"/dev/xvda\",\"Ebs\":{\"VolumeSize\":30,\"VolumeType\":\"gp3\"}}],
    \"UserData\":\"$UD\",
    \"TagSpecifications\":[{\"ResourceType\":\"instance\",\"Tags\":[{\"Key\":\"Name\",\"Value\":\"siglens\"}]}]
  }" 2>/dev/null \
  || aws ec2 create-launch-template-version --launch-template-name siglens-lt \
       --version-description "$TAG" \
       --launch-template-data "{\"ImageId\":\"$AMI\",\"UserData\":\"$UD\"}"
log "launch template ready @ $TAG"
```

- [ ] **Step 3: 첫 이미지 빌드·푸시 후 LT 생성** (Task 14의 CI 전, 부트스트랩용 수동 1회)

Run (로컬에서 첫 이미지 푸시):
```bash
source infra/aws/.env
aws ecr get-login-password | docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
docker tag siglens:local "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/siglens:bootstrap"
docker push "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/siglens:bootstrap"
bash infra/aws/05-launch-template.sh bootstrap
```
Expected: `launch template ready @ bootstrap`

- [ ] **Step 4: 커밋**

```bash
git add infra/aws/user-data.sh infra/aws/05-launch-template.sh
git commit -m "feat(infra): launch template + user-data (SSM env, systemd, graceful stop)"
```

---

## Task 13: ALB + Target Group + ASG

**Files:**
- Create: `infra/aws/06-alb-asg.sh`

- [ ] **Step 1: 스크립트 작성**

`infra/aws/06-alb-asg.sh`:
```bash
#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"; source "$(dirname "$0")/.ids"
SUBNETS=$(aws ec2 describe-subnets --filters Name=vpc-id,Values=$VPC_ID Name=default-for-az,Values=true \
  --query 'Subnets[].SubnetId' --output text)

# ALB
ALB_ARN=$(aws elbv2 create-load-balancer --name siglens-alb --type application --scheme internet-facing \
  --security-groups "$ALB_SG" --subnets $SUBNETS --query 'LoadBalancers[0].LoadBalancerArn' --output text)
# Target Group (헬스체크 /api/health)
TG_ARN=$(aws elbv2 create-target-group --name siglens-tg --protocol HTTP --port 3000 --vpc-id "$VPC_ID" \
  --target-type instance --health-check-path /api/health --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 --query 'TargetGroups[0].TargetGroupArn' --output text)
# HTTPS 리스너 (ACM)
aws elbv2 create-listener --load-balancer-arn "$ALB_ARN" --protocol HTTPS --port 443 \
  --certificates CertificateArn="$CERT_ARN" \
  --default-actions Type=forward,TargetGroupArn="$TG_ARN" >/dev/null

# ASG (min1/max2, instance refresh 대상)
aws autoscaling create-auto-scaling-group --auto-scaling-group-name siglens-asg \
  --launch-template "LaunchTemplateName=siglens-lt,Version=\$Latest" \
  --min-size 1 --max-size 2 --desired-capacity 1 \
  --vpc-zone-identifier "$(echo $SUBNETS | tr ' ' ',')" \
  --target-group-arns "$TG_ARN" \
  --health-check-type ELB --health-check-grace-period 120

ALB_DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" --query 'LoadBalancers[0].DNSName' --output text)
cat >> "$(dirname "$0")/.ids" <<EOF
export ALB_ARN=$ALB_ARN
export TG_ARN=$TG_ARN
export ALB_DNS=$ALB_DNS
EOF
log "ALB_DNS=$ALB_DNS"
```

- [ ] **Step 2: 실행 + 헬스 검증**

Run: `bash infra/aws/06-alb-asg.sh`
Expected: `ALB_DNS=siglens-alb-...elb.amazonaws.com`. 인스턴스 부팅 후(~2분) 타깃 헬시:
```bash
source infra/aws/.ids
aws elbv2 describe-target-health --target-group-arn "$TG_ARN" --query 'TargetHealthDescriptions[].TargetHealth.State'
curl -fsS "https://$ALB_DNS/api/health" -H "Host: siglens.io" --resolve "siglens.io:443:$(dig +short $ALB_DNS | head -1)" || true
```
Expected: `["healthy"]`

- [ ] **Step 3: 커밋**

```bash
git add infra/aws/06-alb-asg.sh
git commit -m "feat(infra): ALB + target group (/api/health) + ASG min1/max2"
```

---

## Task 14: deploy.sh (instance refresh)

**Files:**
- Create: `infra/aws/deploy.sh`

- [ ] **Step 1: 스크립트 작성**

`infra/aws/deploy.sh`:
```bash
#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"
TAG="${1:?usage: deploy.sh <image-tag>}"
bash "$(dirname "$0")/05-launch-template.sh" "$TAG"
aws autoscaling start-instance-refresh --auto-scaling-group-name siglens-asg \
  --preferences '{"MinHealthyPercentage":100,"InstanceWarmup":120}'
log "instance refresh started for $TAG"
```

- [ ] **Step 2: 부트스트랩 이미지로 refresh 검증**

Run: `bash infra/aws/deploy.sh bootstrap`
Expected: `instance refresh started`. 진행 확인:
```bash
aws autoscaling describe-instance-refreshes --auto-scaling-group-name siglens-asg --query 'InstanceRefreshes[0].Status'
```
Expected: `InProgress` → `Successful`

- [ ] **Step 3: 커밋**

```bash
git add infra/aws/deploy.sh
git commit -m "feat(infra): deploy.sh — launch template version + instance refresh"
```

---

## Task 14b: CloudWatch 알람 (설계 §15)

**Files:**
- Create: `infra/aws/07-alarms.sh`

ALB/ASG가 떠 있어야 알람 대상이 존재하므로 Task 13 이후 실행.

- [ ] **Step 1: 스크립트 작성**

`infra/aws/07-alarms.sh` (SNS 토픽은 선택 — `ALARM_SNS` 있으면 알림):
```bash
#!/usr/bin/env bash
source "$(dirname "$0")/lib.sh"; source "$(dirname "$0")/.env"; source "$(dirname "$0")/.ids"
ACTIONS=""; [[ -n "${ALARM_SNS:-}" ]] && ACTIONS="--alarm-actions $ALARM_SNS"
ALB_SUFFIX=$(echo "$ALB_ARN" | sed 's#.*:loadbalancer/##')
TG_SUFFIX=$(echo "$TG_ARN" | sed 's#.*:##')

# 1) ALB 5xx
aws cloudwatch put-metric-alarm --alarm-name siglens-alb-5xx \
  --namespace AWS/ApplicationELB --metric-name HTTPCode_ELB_5XX_Count \
  --dimensions Name=LoadBalancer,Value=$ALB_SUFFIX \
  --statistic Sum --period 300 --evaluation-periods 1 --threshold 10 \
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching $ACTIONS

# 2) 타깃 unhealthy
aws cloudwatch put-metric-alarm --alarm-name siglens-unhealthy-targets \
  --namespace AWS/ApplicationELB --metric-name UnHealthyHostCount \
  --dimensions Name=LoadBalancer,Value=$ALB_SUFFIX Name=TargetGroup,Value=$TG_SUFFIX \
  --statistic Maximum --period 60 --evaluation-periods 3 --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold --treat-missing-data breaching $ACTIONS

# 3) t4g CPU 크레딧 잔량 (소진 방지)
aws cloudwatch put-metric-alarm --alarm-name siglens-cpu-credits-low \
  --namespace AWS/EC2 --metric-name CPUCreditBalance \
  --dimensions Name=AutoScalingGroupName,Value=siglens-asg \
  --statistic Minimum --period 300 --evaluation-periods 2 --threshold 30 \
  --comparison-operator LessThanThreshold --treat-missing-data notBreaching $ACTIONS
log "alarms created (5xx, unhealthy, cpu-credits)"
```

- [ ] **Step 2: 실행 + 검증**

Run: `bash infra/aws/07-alarms.sh`
Expected: `alarms created`. 확인:
```bash
aws cloudwatch describe-alarms --alarm-name-prefix siglens- --query 'MetricAlarms[].AlarmName'
```
Expected: 3개 알람 이름 출력

> 메모리 알람은 CloudWatch agent로 RSS 수집 후 추가(right-sizing 단계). SNS→이메일은 `ALARM_SNS` 설정 시.

- [ ] **Step 3: 커밋**

```bash
git add infra/aws/07-alarms.sh
git commit -m "feat(infra): CloudWatch alarms (ALB 5xx, unhealthy targets, CPU credits)"
```

---

# Phase D — CI/CD

## Task 15: GitHub Actions 배포 워크플로

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: 워크플로 작성**

`.github/workflows/deploy.yml`:
```yaml
name: deploy
on:
  push:
    tags: ['v*']
permissions:
  id-token: write
  contents: read
concurrency:
  group: deploy
  cancel-in-progress: false
jobs:
  build-deploy:
    runs-on: ubuntu-24.04-arm   # arm64 네이티브 러너
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ap-northeast-2
      - uses: aws-actions/amazon-ecr-login@v2
        id: ecr
      - name: Build & push
        env:
          ECR: ${{ steps.ecr.outputs.registry }}
          TAG: ${{ github.ref_name }}
        run: |
          echo "${{ secrets.SIGLENS_GITHUB_TOKEN }}" > /tmp/gh_token
          # 빌드타임 ISR prerender가 DB를 호출 → SSM에서 DATABASE_URL을 읽어 build secret으로 주입
          aws ssm get-parameter --name /siglens/DATABASE_URL --with-decryption \
            --query 'Parameter.Value' --output text > /tmp/db_url
          DOCKER_BUILDKIT=1 docker build \
            --secret id=SIGLENS_GITHUB_TOKEN,src=/tmp/gh_token \
            --secret id=DATABASE_URL,src=/tmp/db_url \
            --build-arg NEXT_PUBLIC_SITE_URL=https://siglens.io \
            -t "$ECR/siglens:$TAG" -t "$ECR/siglens:latest" .
          rm -f /tmp/gh_token /tmp/db_url
          docker push "$ECR/siglens:$TAG"
          docker push "$ECR/siglens:latest"
      - name: Deploy (launch template + instance refresh)
        env:
          TAG: ${{ github.ref_name }}
        run: |
          AMI=$(aws ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 --query 'Parameter.Value' --output text)
          UD=$(sed "s/__IMAGE_TAG__/$TAG/" infra/aws/user-data.sh | base64 -w0)
          aws ec2 create-launch-template-version --launch-template-name siglens-lt \
            --version-description "$TAG" \
            --launch-template-data "{\"ImageId\":\"$AMI\",\"UserData\":\"$UD\"}"
          aws autoscaling start-instance-refresh --auto-scaling-group-name siglens-asg \
            --preferences '{"MinHealthyPercentage":100,"InstanceWarmup":120}'
```

- [ ] **Step 2: 워크플로 문법 검증**

Run: `yarn dlx @action-validator/cli .github/workflows/deploy.yml || npx -y action-validator .github/workflows/deploy.yml`
Expected: 검증 통과 (없으면 YAML lint로 대체)

- [ ] **Step 3: 커밋 + 실배포 테스트**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat(ci): deploy on v* tag — buildx arm64 → ECR → instance refresh"
```
이후 `yarn release:patch`로 태그 푸시 → Actions가 빌드·배포하는지 확인. 타깃 헬시 + `Successful` 확인.

---

# Phase E — 수동 선배포 → beta 실증 → CI/CD 검증 → 컷오버

> **전제**: Phase A PR이 **master에 머지**돼 master가 컨테이너 빌드 가능해야 함(Dockerfile·standalone·health·sharp 포함). 수동 배포는 그 시점 master(아마 PR #633 포함, 버전 상승)를 빌드한다.

## Task 16: 수동 선배포 (master 빌드 → AWS)

- [ ] **Step 1: master 최신화 + 이미지 빌드·푸시**

```bash
git checkout master && git pull
source infra/aws/.env
export SIGLENS_GITHUB_TOKEN="$(grep '^SIGLENS_GITHUB_TOKEN=' /Users/y0ngha/Project/siglens/.env.production | cut -d= -f2- | tr -d '\"')"
export DATABASE_URL="$(aws ssm get-parameter --name /siglens/DATABASE_URL --with-decryption --query Parameter.Value --output text)"
TAG="manual-$(git rev-parse --short HEAD)"
ECR_HOST="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
aws ecr get-login-password | docker login --username AWS --password-stdin "$ECR_HOST"
DOCKER_BUILDKIT=1 docker build --platform linux/arm64 \
  --secret id=SIGLENS_GITHUB_TOKEN,env=SIGLENS_GITHUB_TOKEN \
  --secret id=DATABASE_URL,env=DATABASE_URL \
  --build-arg NEXT_PUBLIC_SITE_URL=https://siglens.io \
  -t "$ECR_HOST/siglens:$TAG" .
docker push "$ECR_HOST/siglens:$TAG"
```
Expected: 이미지 push 성공.

- [ ] **Step 2: launch template + ASG 배포**

```bash
bash infra/aws/05-launch-template.sh "$TAG"
bash infra/aws/deploy.sh "$TAG"      # ASG가 Task 13에서 이미 떠 있으면 instance refresh
source infra/aws/.ids
aws elbv2 describe-target-health --target-group-arn "$TG_ARN" --query 'TargetHealthDescriptions[].TargetHealth.State'
```
Expected: `["healthy"]`.

- [ ] **Step 3: beta DNS 연결 (Chrome)**

CF DNS에 `beta.siglens.io` CNAME → `$ALB_DNS`(orange) + Transform Rule로 beta host에 `X-Robots-Tag: noindex` 주입.

## Task 17: beta.siglens.io 실증 스모크

- [ ] **Step 1: 자동 스모크**

```bash
curl -fsS https://beta.siglens.io/api/health
curl -fsS https://beta.siglens.io/ -o /dev/null -w '%{http_code}\n'
curl -fsS https://beta.siglens.io/AAPL/overall -o /dev/null -w '%{http_code}\n'
```
Expected: 각 200.

- [ ] **Step 2: 주요 기능 수동 체크 (Chrome)**

핵심 기능 위주: **① AI 분석 동작**(분석 잡 제출→완료, Worker 연결) · **② 데이터 로딩**(차트·지표·재무·뉴스) · 심볼/탭 렌더 · ISR 재생성(CloudWatch 로그) · next/image · CF 캐시 헤더. (OAuth 로그인은 미검증 — 설계 D10)

- [ ] **Step 3: 롤백 드릴**

beta 레코드를 잠시 제거→복원해 CF flip 절차를 1회 연습하고 기록.

## Task 18: CI/CD 검증 (`yarn release`)

- [ ] **Step 1: 릴리스로 자동 배포 트리거**

beta 실증이 통과한 뒤, 자동 파이프라인을 검증한다:
```bash
yarn release:patch        # release-it: bump + "chore: release vX.Y.Z" + vX.Y.Z 태그 push
```
Expected: GitHub Actions `deploy` 워크플로가 `v*` 태그로 발화 → buildx 빌드 → ECR push → instance refresh.

- [ ] **Step 2: 파이프라인 정상 연결 확인**

```bash
gh run list --workflow=deploy.yml --limit 1
source infra/aws/.ids
aws autoscaling describe-instance-refreshes --auto-scaling-group-name siglens-asg --query 'InstanceRefreshes[0].Status'
aws elbv2 describe-target-health --target-group-arn "$TG_ARN" --query 'TargetHealthDescriptions[].TargetHealth.State'
```
Expected: 워크플로 success, refresh `Successful`, 타깃 `healthy`. → 자동 배포 파이프라인 검증 완료.

## Task 19: siglens.io 컷오버

- [ ] **Step 1: 저트래픽 윈도우에 siglens.io repoint (Chrome)**

CF DNS `siglens.io`(CNAME flattening) + `www` 타깃을 Vercel → `$ALB_DNS`로 변경(orange 유지). Vercel은 유지(롤백용).

- [ ] **Step 2: 컷오버 스모크**

```bash
curl -fsS https://siglens.io/api/health
curl -fsS https://www.siglens.io/ -o /dev/null -w '%{http_code}\n'
```
Expected: 200. **+ 브라우저로 OAuth 로그인 1건 최우선 확인**. ALB 5xx·지연 모니터.

- [ ] **Step 3: 롤백 조건 명시**

5xx 급증/핵심 플로우 손상/OOM 시 CF `siglens.io`→Vercel 즉시 repoint.

## Task 20: 안정화 후 해제 + 문서

- [ ] **Step 1: 문서 작성/갱신**

- `docs/architecture/INFRA_AWS.md` 신규(런북: 프로비전 순서, 배포, 롤백, 시크릿 로테이션, right-sizing, Savings Plan 구매)
- `docs/architecture/CDN_CACHING.md`: origin Vercel→ALB
- `docs/architecture/ISR_REVALIDATE.md`: ISR 캐시=로컬 EBS, Vercel ISR Writes 과금 소멸
- `docs/architecture/PERFORMANCE_BASELINE.md`: 호스팅·비용 baseline
- `CLAUDE.md`: 호스팅=AWS, 배포 트리거(`v*` 태그→GH Actions)

- [ ] **Step 2: Vercel 해제 (안정 N일 후, 사용자 확인)**

`vercel.json` 제거 + Vercel git 연동 해제(대시보드). 커밋:
```bash
git rm vercel.json
git add docs CLAUDE.md
git commit -m "chore(infra): decommission Vercel, document AWS hosting"
```

- [ ] **Step 3: right-sizing 작업 등록**

1~2주 CloudWatch RSS/CPU 실측 → medium→small 검토 + 1yr Compute Savings Plan 구매(후속 작업).

---

## Self-Review 메모

- **Spec 커버리지**: 설계 §5(IAM)→Task 7, §6(패키징/CI)→Task 5·8·15, §7(네트워킹/TLS/DNS)→Task 9·10·13·16·19, §8(시크릿/env)→Task 11, §9(parity 6항목)→Task 1·2·3·4·5, §10(컷오버/롤백)→Task 19, §11(코드변경)→Task 1~5, §12(IaC)→Task 8~14, §13(문서)→Task 20, §14(테스트)→각 태스크 분산, **§15(모니터링)→Task 14b**, §16(후속)→Task 20 Step3. 전 섹션 매핑됨.
- **Phase E 흐름(사용자 확정)**: Task 16 수동 선배포(master 빌드) → Task 17 beta.siglens.io 실증(AI 분석·데이터 로딩) → Task 18 `yarn release` CI/CD 검증 → Task 19 siglens.io 컷오버 → Task 20 해제. 전제: Phase A PR이 master 머지되어야 함.
- **빌드타임 DB 의존**: `yarn build`가 ISR prerender에서 DB 호출 → Dockerfile `--mount=type=secret,id=DATABASE_URL`, CI/수동배포는 SSM `/siglens/DATABASE_URL`을 build secret으로 주입(build-arg 금지). CI 역할에 `ssm:GetParameter` 추가(Task 7).
- **D1~D13 결정 매핑**: D1·D12·D13→Task 12·13, D2→env 리전+SSM DATABASE_URL, D3→Task 5·8·11, D4·D5→Task 14·15, D6→Phase B·C, D7→Task 10·16·17(Route53 없음), D8·D9→Task 11, **D10→Task 11 Step2(OAUTH 값 검증)+Task 16**, D11→Task 18 Step3.
- **의도적 선택(설계상 "권장"이라 plan 미포함, 필요 시 추가)**: §7.2 origin 비밀헤더 이중잠금(CF IP 대역만으로 1차 충분), §9-6 sharp glibc jemalloc 튜닝(이미지 多 시에만). 둘 다 옵션.
- **후속(별도)**: 워커 이관(siglens-worker→Fargate)은 본 계획 범위 외, 별도 spec.
- **알려진 미지수**: 서울 ALB/EBS 정확 단가는 콘솔 확인(설계 §4 주). Node 22 vs 25 컨테이너는 Task 5 빌드 스모크에서 확정. sharp standalone 트레이싱은 Dockerfile runner의 `require.resolve('sharp')` assertion으로 빌드타임 게이트.
