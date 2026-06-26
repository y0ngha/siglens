# infra/aws — 운영 스크립트 가이드

SigLens는 AWS(ALB + ASG / EC2 `t4g.medium` arm64)에서 서빙된다. 런타임은
`docker run ... node server.js`(Next.js standalone)이고, `v*` 태그 push 시
`.github/workflows/deploy.yml`이 이미지 빌드/푸시 후 ASG instance refresh로 롤한다.

스크립트는 `00`~`10` 순번 + `deploy.sh` + `check-env.sh` + `user-data.sh` + `lib.sh`.
`.env` / `.ids` / `.ami`는 gitignore(로컬·account 종속). CI는 deploy.yml에서 재생성.

## 헬스 vs 레디니스 (liveness vs readiness)

| 엔드포인트     | 깊이                 | 누가 폴링하나                          |
| -------------- | -------------------- | -------------------------------------- |
| `/api/health`  | shallow (`{status:'ok'}`만) | **ALB 타깃 그룹 헬스체크**(liveness) |
| `/api/ready`   | deep (DB+Redis 핑)   | **CloudWatch/알람**(readiness)         |

`/api/health`는 의존성 블립이 인스턴스를 죽이지 않도록 의도적으로 shallow.
`/api/ready`는 Neon DB + Upstash Redis 도달성을 확인해 200(ready)/503(not_ready)을
반환한다(짧은 타임아웃·병렬 핑). 알람은 `/ready`를 폴링해 의존성 장애를 감지하되,
ALB 헬스체크(`/health`)와 분리해 데이터 의존성 장애로 타깃이 빠지는 것을 막는다.

## SIGTERM graceful drain (H1)

`src/instrumentation.ts`의 `register()`가 Node 서버 부팅 시 SIGTERM/SIGINT 핸들러를
등록한다. 배포 롤로 `docker stop -t 30` → 컨테이너 SIGTERM 수신 시:

1. 신규 백그라운드 작업(`fireAndForget`) 수락 중단
2. 추적 중인 in-flight 작업을 25s deadline까지 drain
3. `process.exit(0)`

타임 예산 정합(셋이 맞물림):

- systemd `ExecStop=docker stop -t 30` (30s 후 SIGKILL)
- instrumentation drain deadline **25s** (< 30s)
- ALB `deregistration_delay.timeout_seconds=30` (06-alb-asg.sh, H2)

## 골든 AMI 베이크 → 핀 → 배포 (M1/M2)

`05-launch-template.sh`는 **핀된 AMI**(`PINNED_AMI`)만 쓴다 — 매 배포마다 "latest
AL2023"를 새로 resolve하지 않는다(베이스 이미지 표류 차단). 핀 출처:

1. 환경변수 `PINNED_AMI` (CI: deploy.yml이 repo variable `vars.PINNED_AMI` 주입)
2. `infra/aws/.ami` 파일 (`export PINNED_AMI=ami-...`, 로컬 운영자)

둘 다 없으면 배포는 **실패**한다("latest"로 조용히 떨어지지 않음).

### 베이크 → 핀 → 배포 흐름

```bash
# 1) 골든 AMI 베이크: docker+jq+cloudwatch-agent를 미리 설치한 AMI를 굽는다.
#    부팅이 "env-fetch + docker pull(델타) + run"으로 줄어 빠르고 결정적.
#    결과 AMI ID를 .ami(PINNED_AMI)에 자동 기록한다.
bash infra/aws/09-bake-ami.sh
# → "golden AMI ready: ami-XXXX" 출력

# 2) (CI 사용 시) repo Settings → Secrets and variables → Actions → Variables 의
#    PINNED_AMI 를 출력된 ami-XXXX 로 갱신.

# 3) v* 태그 push → deploy.yml 이 PINNED_AMI 로 launch template 갱신 후 ASG roll.
git tag v0.x.y && git push --tags
```

골든 AMI는 `/etc/siglens-golden-ami` 마커를 갖는다. `user-data.sh`는 이 마커를 보고
부팅 시 `dnf install`을 건너뛴다(없으면 base AL2023처럼 부팅 시 설치).

### base AL2023를 의도적으로 갱신(핀 bump)

```bash
AMI=$(aws ssm get-parameter \
  --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 \
  --query 'Parameter.Value' --output text)
echo "export PINNED_AMI=$AMI" > infra/aws/.ami   # 로컬
# CI는 vars.PINNED_AMI 도 함께 갱신
```

## env 완전성 게이트 (M5)

`deploy.sh`는 롤 이전에 `check-env.sh`를 호출한다. `.env.example`의 모든 필수 키
(`NEXT_PUBLIC_*`·`SIGLENS_GITHUB_TOKEN`·주석 제외)가 SSM `/siglens/*`에 있는지
확인하고, 누락 시 키 목록을 출력하며 배포를 중단한다. 비상시 `SKIP_ENV_CHECK=1`.

키 적재는 `04-params.sh <env-file>` (SSM SecureString upsert).

## CloudWatch Logs (L4)

컨테이너 stdout/stderr를 `awslogs` 드라이버로 로그 그룹 `/siglens/app`에 보낸다
(스트림 = 인스턴스 ID). 인스턴스가 ASG roll/스케일인으로 종료돼도 로그가 보존되어
크래시 사후분석이 가능하다. 로그 그룹은 `10-logs.sh`가 생성(보존 14일)하고,
`user-data.sh`도 부팅 시 멱등 생성한다.

**필요 IAM**: 인스턴스 역할의 `logs:CreateLogGroup/CreateLogStream/PutLogEvents`
(`iam/ec2-role-policy.json`의 `Logs` 스테이트먼트에 이미 `/siglens/*` 스코프로 존재).

## env-fetch 파싱 (M6)

`siglens-fetch-env.sh`는 `--output json | jq`로 SSM 파라미터를 파싱한다(이전
`--output text | awk -F'\t'`는 값에 탭/개행이 있으면 손상). `--max-items` 미지정 시
AWS CLI v2가 자동 페이지네이션하므로 수동 페이징은 불필요.

## ASG max-size 단일 소스 (L1)

`06-alb-asg.sh`가 max-size=4를 단일 소스로 설정한다. `08-scaling.sh`는 더 이상
max-size를 건드리지 않는다(이전 06=2/08=4 표류 제거).
