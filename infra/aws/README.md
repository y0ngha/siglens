# infra/aws — 운영 스크립트 가이드

SigLens는 AWS(ASG / EC2 `t4g.medium` arm64)에서 서빙되고, 인그레스는 **Cloudflare
Tunnel(cloudflared)**이다. ALB는 2026-08에 제거했다 — 타깃 1대에 로드밸런싱을 하지
않았고, 두 알람 모두 60일간 실질 사고를 잡은 적이 없으며, 월 $25.6~26.5가 들었다.
cloudflared는 밖으로 다이얼하므로 **EC2 보안그룹에 인그레스 규칙이 없다**(ACM 인증서,
Cloudflare IP 허용목록도 함께 사라졌다). 런타임은
`docker run ... node server.js`(Next.js standalone)이고, `v*` 태그 push 시
`.github/workflows/deploy.yml`이 이미지 빌드/푸시 후 ASG instance refresh로 롤한다.

스크립트는 `00`~`10` 순번 + `deploy.sh` + `check-env.sh` + `user-data.sh` + `lib.sh`.
`.env` / `.ids` / `.ami`는 gitignore(로컬·account 종속). CI는 deploy.yml에서 재생성.

## 헬스 vs 레디니스 (liveness vs readiness)

| 엔드포인트     | 깊이                 | 누가 폴링하나                          |
| -------------- | -------------------- | -------------------------------------- |
| `/api/health`  | shallow (`{status:'ok'}`만) | **온박스 헬스 게이트 + selfcheck 타이머**(liveness) |
| `/api/ready`   | deep (DB+Redis 핑)   | **현재: 컨테이너 로그 경유만** — 아래 참고 |

`/api/health`는 의존성 블립이 인스턴스를 죽이지 않도록 의도적으로 shallow.
`/api/ready`는 Neon DB + Upstash Redis 도달성을 확인해 200(ready)/503(not_ready)을
반환한다(짧은 타임아웃·병렬 핑).

> **현재 상태**: `/api/ready`는 CloudWatch Synthetics 카나리나 알람이 직접 폴링하지 않는다.
> 레디니스 신호는 CloudWatch Logs `/siglens/app`의 컨테이너 로그에서만 관찰할 수 있다.
> 하드 장애는 `07-alarms.sh`의 로그 기반 알람들이 커버하지만, **DB/Redis 레디니스
> 장애는 현재 능동적으로 알람하지 않는다.**
> 액티브 레디니스 모니터링을 활성화하려면 opt-in 스크립트를 참고:
> `infra/aws/11-readiness-canary.sh` (빌링 리소스 생성 — 자동 실행 아님).

## SIGTERM graceful drain (H1)

`src/instrumentation.ts`의 `register()`가 Node 서버 부팅 시 SIGTERM/SIGINT 핸들러를
등록한다. 배포 롤로 `docker stop -t 185` → 컨테이너 SIGTERM 수신 시:

1. 신규 백그라운드 작업(`fireAndForget`) 수락 중단
2. 추적 중인 in-flight 작업과 **진행 중인 SSE 분석 스트림**을 180s deadline까지 drain
3. `process.exit(0)`

worker 제거로 LLM 호출이 앱 요청 안에서 돌기 때문에 예산을 30s대에서 180s대로 올렸다 —
그 전 값이면 배포할 때마다 진행 중이던 분석이 전부 죽고(캐시 write는 LLM await 뒤에 있어
그 비용이 통째로 버려진다), 사용자는 `분석 연결이 완료 전에 끊겼습니다`만 본다.

타임 예산 정합(넷이 맞물림):

- systemd `ExecStop=docker stop -t 185` (185s 후 SIGKILL), `TimeoutStopSec=190`
- instrumentation drain deadline **180s** (< 185s)
- cloudflared `TUNNEL_GRACE_PERIOD=180s` (user-data.sh) — ALB `deregistration_delay=185`를
  대체. **180초가 cloudflared 하드 상한**이라 185s를 주면 기동 자체가 거부된다
  (`grace-period must be equal or less than 3m0s`).
- ASG 라이프사이클 훅 `siglens-drain-gate` heartbeat **420s** ≥ 180 + 190 + 여유 (06-asg.sh)

> 드레인 예산은 ALB 때보다 오히려 넉넉하다. ALB는 등록해제 185초가 **끝난 뒤** 앱에
> SIGTERM을 보냈지만, 지금은 systemd가 cloudflared를 먼저 내리고(최대 180초 인플라이트
> 배수, 이때 앱은 살아 있다) 그 다음 앱을 내린다 — 둘이 순차라 합이 최대 ~365초다.
- 라우트 상한 `STREAM_DEADLINE_MS` **5분** — drain(180s)보다 길다. 즉 3분을 넘긴
  분석은 배포 시 잘릴 수 있다(허용된 트레이드오프). 배포를 더 안전하게 하려면
  STREAM_DEADLINE을 낮추거나 drain을 5분으로 올려야 하는데, 후자는 인스턴스당
  롤 시간이 그만큼 늘어난다(`deploy.sh`의 폴 상한 1800s와 함께 봐야 함).

in-flight SSE 스트림 수는 `src/shared/lib/sse/activeStreams.ts`가 센다 —
`heartbeatStream`이 시작/종료(done·error·cancel) 시점에 증감시킨다.

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

`06-asg.sh`가 max-size=4를 단일 소스로 설정한다. `08-scaling.sh`는 더 이상
max-size를 건드리지 않는다(이전 06=2/08=4 표류 제거).
