# 배포·인시던트 런북

이 문서는 **운영 중 문제가 생겼을 때 가장 먼저 여는 문서**다. 배포 절차, 롤백, 알람 대응, 증상별 트리아지를 담는다.

서브시스템별 상세 런북은 이미 따로 있다. 이 문서는 그것들을 대체하지 않고 **어디로 갈지 안내**한다.

| 서브시스템 | 문서 |
|---|---|
| AWS 스크립트, 골든 AMI, env 완전성 게이트, graceful drain | [`infra/aws/README.md`](../../infra/aws/README.md) |
| S3 ISR 캐시 핸들러, 킬 스위치, 태그 스토어, 수동 캐시 정리 | [ISR_CACHE_HANDLER.md](./ISR_CACHE_HANDLER.md) |
| 페이지별 revalidate 정책 | [ISR_REVALIDATE.md](./ISR_REVALIDATE.md) |
| Cloudflare 캐싱·WAF·봇 보호 | [CDN_CACHING.md](./CDN_CACHING.md) |
| seo-prewarm 크론, 배치 알람, 크론 킬 스위치 | [CRON.md](../reference/CRON.md) |

**고정 좌표**: 리전 `ap-northeast-2` · ASG `siglens-asg` · 인스턴스 `t4g.medium`(arm64) · ECR 레포 `siglens` · ISR 캐시 버킷 `siglens-isr-cache` · 로그 그룹 `/siglens/app` · SNS 토픽 `siglens-alerts`.

---

## 1. 정상 배포

배포 트리거는 **`v*` 태그 push 하나뿐이다.** `.github/workflows/deploy.yml`은 `workflow_dispatch`를 의도적으로 뺐다 — OIDC 신뢰 정책이 `refs/tags/v*`만 허용하므로 브랜치에서의 수동 실행은 403으로 실패한다.

```bash
yarn release          # release-it: 버전 범프 + CHANGELOG + 커밋 + 태그 (SIGLENS_RELEASE_E2E=1 → e2e 포함)
git push              # 커밋 push
git push --tags       # ← 이 순간 배포가 시작된다
```

`concurrency: {group: deploy, cancel-in-progress: false}`이므로 두 태그가 겹치면 **취소가 아니라 대기**한다. 부분 롤아웃이 대기보다 나쁘기 때문이다.

### 파이프라인이 실제로 하는 일

1. **test-gate** — `yarn typecheck` + `yarn test`. e2e는 여기서 돌지 않는다(핫패스에 너무 느림, PR CI에서 이미 검증). 게이트가 빨갛면 `needs: test-gate`로 롤아웃 전체가 막힌다.
2. **이미지 빌드** — `linux/arm64` 네이티브 빌드, `--load`로 러너 데몬에 적재. 시크릿은 BuildKit secret mount로 주입되어 레이어·로그에 남지 않는다.
3. **스모크 테스트** — arm64 이미지 안에서 `/sbin/tini`로 `node -e`를 실행. amd64 이미지를 Graviton에 배포했을 때의 exec-format 에러를 **push 전에** 잡는다.
4. **ECR push** — 불변 버전 태그만(`:0.48.0`). `:latest`는 의도적으로 push하지 않는다(런타임은 명시 태그를 핀하고, ECR lifecycle은 최근 3개 태그만 보존).
5. **ASG 롤** — `infra/aws/deploy.sh`. `check-env.sh`로 SSM env 완전성을 먼저 검증한 뒤 instance refresh(`MinHealthyPercentage 100` / `MaxHealthyPercentage 200` / `InstanceWarmup 300`)를 시작하고, 터미널 상태까지 최대 ~20분 폴링한다. 실패 시 non-zero로 종료한다.
6. **Cloudflare 퍼지** — `purge_everything`. `continue-on-error: true`이므로 **퍼지 실패는 이미 끝난 롤아웃을 실패로 만들지 않는다.** 대신 배포는 성공했는데 구 HTML이 서빙될 수 있으니, 워크플로 로그에 `⚠️ Cloudflare purge failed`가 있으면 수동 퍼지할 것.

### 빌드타임에 env가 필요한 이유

`/economy`·`/market`·`news/[category]`·법적 페이지는 **빌드 타임에 prerender**된다. 그래서 `DATABASE_URL`과 `FMP_API_KEY`는 런타임 SSM만으로 부족하고, GitHub Actions secret → `--secret` 마운트로 **빌드 타임에도** 있어야 한다. 없으면 degraded 페이지가 이미지에 baked되어 revalidate 주기(최대 24h)까지 그대로 서빙된다.

검증: 이미지의 페이지 크기를 비교한다(정상 수백 KB vs degraded 수십 KB).

### 배포 후 확인

```bash
# 1) 워크플로가 "instance refresh completed successfully"까지 갔는지
gh run list --workflow=deploy.yml --limit 3

# 2) 실제 서빙 버전
curl -sI https://siglens.io | head -20

# 3) 타깃 헬스
aws elbv2 describe-target-health --target-group-arn <TG_ARN> --profile siglens

# 4) 컨테이너 로그에 부팅 에러가 없는지 (CloudWatch Logs Insights, /siglens/app)
```

---

## 2. 롤백

### 코드 롤백 — 이전 태그를 다시 배포

`workflow_dispatch`가 없으므로 방법은 둘뿐이다.

1. **이전 태그의 완료된 워크플로 run을 re-run** (가장 빠름)
   ```bash
   gh run list --workflow=deploy.yml --limit 10   # 되돌릴 태그의 run ID 확인
   gh run rerun <RUN_ID>
   ```
2. **새 태그를 앞으로 자르기** — revert 커밋 후 `v0.48.1` 같은 새 태그를 push. 히스토리가 선형으로 남으므로 원인이 코드에 있을 때 선호.

⚠️ **ISR 캐시는 롤백을 따라오지 않는다.** S3 캐시 prefix는 `GIT_SHA`(=릴리스 버전)로 분리되므로, 이전 버전으로 되돌리면 그 버전 prefix의 캐시가 이미 lifecycle(14일)로 지워졌을 수 있다. 그 경우 롤백 직후 전 라우트가 cold-gen이 되어 origin 부하가 튄다 — 정상이며 몇 분 내 안정된다. SSM `prev-isr-buildid` 드리프트는 [ISR_CACHE_HANDLER.md](./ISR_CACHE_HANDLER.md) §5 참고.

### 인프라 롤백 — 인스턴스 교체

코드가 아니라 인스턴스 상태가 망가진 경우(디스크, FS read-only, 부팅 실패):

```bash
aws autoscaling start-instance-refresh --auto-scaling-group-name siglens-asg \
  --preferences MinHealthyPercentage=100,MaxHealthyPercentage=200,InstanceWarmup=300 \
  --profile siglens
```

인스턴스에 SSH/SSM으로 들어갈 수 없는 상태여도 이 방법은 동작한다. **진입 불가 상태에서 시간을 쓰지 말고 교체가 먼저다.**

### 캐시 롤백 — Cloudflare 수동 퍼지

배포는 성공했는데 구 HTML이 보이면:

```bash
curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

### 기능 단위 킬 스위치

전체 롤백보다 좁게 끄는 편이 나을 때가 많다.

| 끄고 싶은 것 | 방법 | 즉시 적용? |
|---|---|---|
| S3 ISR 캐시 외부화 | SSM `ISR_CACHE_DISABLED` + instance refresh | ❌ refresh 필요 |
| ISR 태그 동기화만 | SSM `ISR_TAG_SYNC_DISABLED` + instance refresh | ❌ refresh 필요 |
| seo-prewarm 크론 | EventBridge Rule 3개 `disable-rule` | ✅ 즉시 |

세부 절차는 각각 [ISR_CACHE_HANDLER.md](./ISR_CACHE_HANDLER.md) §1, [CRON.md](../reference/CRON.md)에 있다.

---

## 3. 알람 대응

알람은 `07-alarms.sh`(인프라·ISR)와 `13-seo-prewarm.sh`(크론)가 생성하고, 전부 SNS 토픽 `siglens-alerts`로 간다. **알람·정상복구 양방향으로 통지**한다.

> ⚠️ 알람이 있어도 `siglens-alerts` 구독이 `PendingConfirmation`이면 아무 메일도 오지 않는다. 2026-06-28 디스크풀이 조용히 진행된 원인이 정확히 이것("액션 없는 알람")이었다. 정기적으로 확인할 것:
> ```bash
> aws sns list-subscriptions-by-topic --topic-arn <siglens-alerts ARN> --profile siglens
> ```

| 알람 | 발화 조건(실측) | 1차 대응 |
|---|---|---|
| `siglens-alb-5xx` | ELB 5xx 5분 합계 > 10 | Logs Insights에서 스택트레이스 확인. 배포 직후면 롤백 판단, 아니면 의존성(DB/Redis/FMP) 블립 확인. 단발 블립은 알려진 노이즈 |
| `siglens-unhealthy-targets` | UnHealthyHostCount ≥ 1이 60초×3주기 | `/api/health`는 shallow이므로 이게 뜨면 프로세스 자체가 죽은 것. 컨테이너 로그 → 복구 안 되면 instance refresh |
| `siglens-cpu-credits-low` | CPUCreditBalance < 30 (5분 Min ×2) | t4g 버스트 소진 임박. 배포·빌드가 유발했는지 먼저 확인(정상 회복). 지속되면 인스턴스 타입 재검토 |
| `siglens-mem-high` | mem_used_percent > 90 (5분 Avg ×3) | OOM 전 경고. 컨테이너 메모리 확인 → 재시작으로 완화, 반복되면 누수 조사 |
| `siglens-disk-high` | disk_used_percent > 85 (5분 Max ×2) | **ISR 외부화 회귀 카나리다.** 캐시가 S3로 안 나가고 로컬에 쌓인다는 뜻 → `siglens-isr-cache-failures`와 함께 보고 [ISR_CACHE_HANDLER.md](./ISR_CACHE_HANDLER.md)로 |
| `siglens-isr-cache-failures` | IsrCacheFailures 5분 합계 > 5 | S3 권한/버킷/IMDS 확인. fail-open이라 사이트는 살아 있지만 캐시는 사실상 죽은 상태 |
| `siglens-isr-tag-failures` | IsrTagFailures 15분 합계 ≥ 5 ×2주기 | 태그 동기화 실패 = 다른 인스턴스의 무효화를 놓쳐 **stale HTML을 revalidate TTL(6~24h) 동안 서빙**. 조용히 degrade하므로 이 알람이 유일한 신호 |
| `siglens-seo-prewarm-batch-failed` | `[seo-prewarm] batch failed` 1시간 3회 초과 | [CRON.md](../reference/CRON.md) — 배치 내부 실패 |
| `siglens-seo-prewarm-redis-unavailable` | `[seo-prewarm] redis unavailable` 1시간 1회 초과 | Upstash 도달성 확인 |
| `siglens-seo-prewarm-{evening,evening-late,early}-failed` | EventBridge FailedInvocations 5분 1건 초과 | 타겟 호출 자체가 실패 — Connection `AUTHORIZED` 상태, IAM, API Destination 확인 |

---

## 4. 증상별 트리아지

알람이 아니라 사람이 먼저 발견했을 때, 증상에서 문서로 가는 표.

| 증상 | 먼저 볼 것 |
|---|---|
| 사이트 전체 5xx / 접속 불가 | 타깃 헬스 → 컨테이너 로그 → §2 인프라 롤백(instance refresh) |
| 배포는 성공인데 변경이 안 보인다 | Cloudflare 퍼지 실패 여부(워크플로 로그) → §2 수동 퍼지 → [CDN_CACHING.md](./CDN_CACHING.md) |
| 특정 페이지만 빈 화면/degraded | 빌드타임 env 누락 의심(§1) → ISR 빈 캐시 동결 이력 참고(§6) |
| 한 페이지가 오래된 내용을 계속 보여준다 | `siglens-isr-tag-failures` 확인 → [ISR_CACHE_HANDLER.md](./ISR_CACHE_HANDLER.md), 그다음 [ISR_REVALIDATE.md](./ISR_REVALIDATE.md)로 의도된 TTL인지 확인 |
| 디스크가 다시 차오른다 | `siglens-disk-high` 행 참고 — 캐시 외부화가 무력화된 것 |
| SSH·SSM·EC2 Instance Connect 전부 안 된다 | 진입 복구를 시도하지 말고 §2 instance refresh. golden AMI가 minimal이면 접속 도구 자체가 없다(현재는 SSM param standard + 패키지 명시 설치로 수정됨) |
| 분석이 계속 pending / 결과가 안 온다 | 외부 worker(`WORKER_URL`) 상태 — 공유 worker 레이트리밋은 플랫폼과 무관 |
| 크론이 돌지 않는 것 같다 | [CRON.md](../reference/CRON.md)의 "정상 vs 진짜 막힌 상태" 절 — `submitted 0` 연속은 정상일 수 있다 |
| 배포가 env 누락으로 중단됐다 | `check-env.sh`가 나열한 키를 `04-params.sh`로 SSM 적재. 비상시 `SKIP_ENV_CHECK=1`(권장하지 않음) |

---

## 5. 진단 접근

인스턴스에 직접 붙어야 할 때. 로컬에서는 `siglens` AWS 프로파일을 쓴다.

```bash
# 인스턴스 목록
aws ec2 describe-instances --profile siglens \
  --filters Name=tag:aws:autoscaling:groupName,Values=siglens-asg Name=instance-state-name,Values=running \
  --query 'Reservations[].Instances[].[InstanceId,PrivateIpAddress,LaunchTime]' --output table

# SSM으로 명령 실행 (SSH 불필요)
aws ssm send-command --profile siglens \
  --instance-ids i-xxxxxxxx --document-name AWS-RunShellScript \
  --parameters 'commands=["df -h","docker ps","du -sh /app/.next/server 2>/dev/null"]' \
  --query 'Command.CommandId' --output text

aws ssm get-command-invocation --profile siglens \
  --instance-id i-xxxxxxxx --command-id <CMD_ID> --query StandardOutputContent --output text
```

컨테이너 안을 봐야 하면 `docker ps`로 이름을 먼저 확인한 뒤 `docker exec`한다.

**⚠️ 컨테이너 env 확인은 `printenv`로 한다.** `sh -c 'echo $VAR'`는 호스트 셸에서 먼저 확장될 수 있어 값이 있는데 없다고(혹은 반대로) 오판하게 된다.

로그는 CloudWatch Logs Insights에서 `/siglens/app`(스트림 = 인스턴스 ID). 인스턴스가 교체돼도 로그는 14일 보존되므로 사후분석이 가능하다.

---

## 6. 첫 배포 / 재프로비저닝 부트스트랩

**계정을 새로 세팅하거나 리소스를 재생성했을 때만** 해당한다. 순서가 중요하고, 빠뜨리면 배포가 조용히 무력화된다.

| # | 실행 | 빠뜨리면 |
|---|---|---|
| 1 | `bash infra/aws/00-iam-setup.sh` (admin 자격증명으로 1회) | 인스턴스 역할에 S3 권한이 없어 ISR 캐시가 AccessDenied로 죽는다(fail-open이라 조용함) |
| 2 | `bash infra/aws/12-isr-cache.sh` | `/siglens/ISR_CACHE_BUCKET`이 없어 `check-env.sh`가 배포를 중단시킨다 |
| 3 | `bash infra/aws/04-params.sh <env-file>` | 런타임 env 누락 |
| 4 | `bash infra/aws/10-logs.sh` | 로그 그룹 부재 → 다음 단계의 metric filter가 조용히 안 걸린다 |
| 5 | `bash infra/aws/07-alarms.sh` | 알람 없음. `ALARM_EMAIL` 설정 후 **confirm 메일 클릭까지** 해야 통지가 온다 |
| 6 | `bash infra/aws/13-seo-prewarm.sh` (**10-logs.sh 이후 반드시 재실행**) | metric filter가 하나도 안 걸린 채 "성공"으로 보인다 |
| 7 | `bash infra/aws/09-bake-ami.sh` → `vars.PINNED_AMI` 갱신 | `PINNED_AMI`가 없으면 배포는 **실패**한다(latest로 조용히 떨어지지 않음) |

검증 포인트:

```bash
# metric filter 2개가 실제로 걸렸는지
aws logs describe-metric-filters --log-group-name /siglens/app \
  --filter-name-prefix siglens-seo-prewarm --profile siglens

# SNS 구독이 Confirmed인지 (PendingConfirmation이면 알림 안 옴)
aws sns list-subscriptions-by-topic --topic-arn <siglens-alerts ARN> --profile siglens
```

세부 사항과 각 스크립트의 전제조건은 [`infra/aws/README.md`](../../infra/aws/README.md)와 [CRON.md](../reference/CRON.md) "부트스트랩" 절에 있다.

---

## 7. 과거 인시던트에서 남은 규칙

같은 실수를 되풀이하지 않기 위한 요약. 상세 기록은 `docs/qa/`의 날짜별 문서에 있다.

**빈 ISR 캐시 동결 (2026-06-26)** — 외부 API 402가 24시간 재검증 중에 uncaught로 throw되어 `/`·`/economy`가 0-byte 캐시로 굳었다. `error.tsx`는 ISR prerender의 빈 캐시를 막지 못한다. → **모든 로더는 catch해서 degrade**하고, 복구는 instance refresh + CF 퍼지.

**디스크풀 → FS read-only (2026-06-28)** — Next의 ISR/fetch 캐시가 시간당 수 GB씩 쌓여 루트 디스크를 채웠고, 재부팅 시 xfs가 read-only로 올라와 SSH/SSM/EIC가 전부 막혔다. 게다가 golden AMI가 **minimal** 변종이어서 접속 도구 자체가 없었다. → 캐시는 **S3로 외부화**(현재 상태), AMI는 SSM param standard 기반으로 수정, **진입 복구보다 인스턴스 교체가 먼저**.

**알람에 액션이 없었다 (같은 사건)** — 알람은 있었지만 `AlarmActions=[]`여서 디스크 100%가 아무 통지 없이 진행됐다. → 토픽 생성이 `07-alarms.sh`에 내장됐고, **구독 Confirmed 여부를 주기적으로 확인**한다.

**외부화가 조용히 무력화된 첫 배포** — 버킷/SSM 미생성, IAM 권한 누락, `GIT_SHA` 누락으로 buildId 충돌 등 네 가지가 겹쳐 캐시 외부화가 동작하지 않는데도 배포는 성공으로 보였다. → §6 부트스트랩 체크리스트가 이 사건의 산물이다. fail-open 설계는 사이트를 지키지만 **실패를 조용하게 만든다** — 알람과 실측이 유일한 신호다.
