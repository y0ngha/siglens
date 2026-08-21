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
bash infra/aws/07-alarms.sh   # 알람에 변경이 있는 릴리스라면 태그 **전에** (멱등)
yarn release          # release-it: 버전 범프 + CHANGELOG + 커밋 + 태그 (SIGLENS_RELEASE_E2E=1 → e2e 포함)
git push              # 커밋 push
git push --tags       # ← 이 순간 배포가 시작된다
```

> ⚠️ **`infra/aws/06`·`07`·`08`은 파이프라인이 돌리지 않는다.** `deploy.sh`는
> `check-env.sh`와 `05-launch-template.sh`만 실행한다. 즉 ASG 용량·라이프사이클 훅,
> CloudWatch 알람, 스케일링 정책은 **태그를 밀어도 반영되지 않는다.**
>
> 코드와 인프라 타이밍이 맞물리는 변경(예: graceful drain 예산 조정)을 배포할 때는
> 태그 push **전에** 해당 스크립트를 수동 실행할 것. 안 하면 컨테이너는 180초를
> 기다리는데 ALB는 30초에 연결을 끊는 식으로 양쪽 설정이 어긋나고, 그 상태는
> 어떤 알람에도 안 잡힌다(전부 멱등이라 재실행 안전).
>
> ```bash
> # 0. provider 키 4종을 SSM에 올린다. check-env.sh가 이 넷을 필수로 요구하고,
> #    그 게이트는 Docker 빌드 **앞**에서 돌기 때문에 없으면 첫 태그 배포가 즉시 실패한다.
> bash infra/aws/04-params.sh <env-file>
>
> bash infra/aws/00-iam-setup.sh   # ⚠️ 06보다 **먼저**. AsgLifecycle 권한이 없으면
>                                 #    launch 훅이 600초 뒤 ABANDON → 모든 배포 실패
> bash infra/aws/06-asg.sh        # ASG 용량 + 라이프사이클 훅
> bash infra/aws/07-alarms.sh     # 알람 (analysis-stream-failed, fear-greed-loader-failed,
> #                                 fear-greed-kr-loader-failed, naver-news-failed,
> #                                 market-kr-loader-failed, kr-calendar-horizon-expired 포함)
> bash infra/aws/08-scaling.sh    # 스케일링 정책 (요청수 + CPU)
> bash infra/aws/13-seo-prewarm.sh # 크론 알람 (unit-error/unit-timeout 포함)
> ```
>
> 워커 제거 릴리스가 한 번 이상 안정화된 뒤에는 죽은 SSM 파라미터도 정리한다
> (그 전엔 **삭제 금지** — 이전 릴리스로 롤백하면 `check-env.sh`가 요구한다):
>
> ```bash
> aws ssm delete-parameters --names /siglens/WORKER_URL /siglens/WORKER_SECRET
> ```

`concurrency: {group: deploy, cancel-in-progress: false}`이므로 두 태그가 겹치면 **취소가 아니라 대기**한다. 부분 롤아웃이 대기보다 나쁘기 때문이다.

### 파이프라인이 실제로 하는 일

1. **test-gate** — `yarn typecheck` + `yarn test`. e2e는 여기서 돌지 않는다(핫패스에 너무 느림, PR CI에서 이미 검증). 게이트가 빨갛면 `needs: test-gate`로 롤아웃 전체가 막힌다.
2. **이미지 빌드** — `linux/arm64` 네이티브 빌드, `--load`로 러너 데몬에 적재. 시크릿은 BuildKit secret mount로 주입되어 레이어·로그에 남지 않는다.
3. **스모크 테스트** — arm64 이미지 안에서 `/sbin/tini`로 `node -e`를 실행. amd64 이미지를 Graviton에 배포했을 때의 exec-format 에러를 **push 전에** 잡는다.
4. **ECR push** — 불변 버전 태그만(`:0.48.0`). `:latest`는 의도적으로 push하지 않는다(런타임은 명시 태그를 핀하고, ECR lifecycle은 최근 3개 태그만 보존).
5. **ASG 롤** — `infra/aws/deploy.sh`. `check-env.sh`로 SSM env 완전성을 먼저 검증한 뒤 instance refresh(`MinHealthyPercentage 100` / `MaxHealthyPercentage 200` / `InstanceWarmup 300`)를 시작하고, 터미널 상태까지 최대 ~30분 폴링한다. 실패 시 non-zero로 종료한다.
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
# ALB 제거 후: 타깃 헬스 대신 터널 연결 상태를 본다.
aws ssm send-command --profile siglens --instance-ids <IID> \
  --document-name AWS-RunShellScript --parameters 'commands=[
    "systemctl is-active siglens cloudflared",
    "curl -s http://127.0.0.1:2000/ready",
    "curl -s http://127.0.0.1:2000/metrics | grep ha_connections"
  ]'

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

⚠️ **ISR 캐시는 롤백을 따라오지 않는다.** S3 캐시 prefix는 `GIT_SHA`(=릴리스 버전)로 분리되므로, 이전 버전으로 되돌리면 그 버전 prefix의 캐시가 이미 lifecycle(7일)로 지워졌을 수 있다 — 롤백 안전 창이 14일에서 7일로 줄었다. 그 경우 롤백 직후 전 라우트가 cold-gen이 되어 origin 부하가 튄다 — 정상이며 몇 분 내 안정된다. SSM `prev-isr-buildid` 드리프트는 [ISR_CACHE_HANDLER.md](./ISR_CACHE_HANDLER.md) §5 참고.

⚠️ **3자산군 릴리스(v0.57.0~) 이전으로 롤백할 땐 KR 캘린더 행을 지워야 한다.**

`/economy/kr`이 `economic_calendar`에 `country='KR'` 행을 넣는데, 그 릴리스 **이전**
코드의 `listInRange`에는 country 필터가 없다. 롤백하면 `/economy`(미국) 캘린더에
`Interest Rate Decision (KR)`, `국고채 낙찰금리` 같은 한국 발표가 섞여 나오고,
200에 에러도 알람도 없어 조용히 계속된다.

```bash
psql "$DATABASE_URL" -c "DELETE FROM economic_calendar WHERE country = 'KR';"
```

행이 지워져도 `/economy/kr`은 다음 방문에서 다시 수집하므로 앞으로 재배포할 때
손실은 없다(과거 180일 창을 다시 당겨온다).

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
| DB 콘텐츠 다국어 | SSM `DB_CONTENT_LOCALE` 삭제 + instance refresh | ❌ refresh 필요 |

세부 절차는 각각 [ISR_CACHE_HANDLER.md](./ISR_CACHE_HANDLER.md) §1, [CRON.md](../reference/CRON.md)에 있다.

### ⛔ `.env.local`은 **운영 DB**를 가리킨다

`yarn db:*` 스크립트는 전부 `dotenv -e .env.local`로 실행된다. 그 파일의
`DATABASE_URL`/`DIRECT_DATABASE_URL`은 **운영 Neon 인스턴스**다. 즉 아무 플래그
없이 `yarn db:migrate`를 치면 기본값이 운영 스키마 변경이다.

그래서 쓰기 작업은 **원격 대상일 때 기본 거부**한다
(`db/scripts/lib/dbTarget.ts`). 막히는 것:

| 명령 | 원격 대상일 때 |
|---|---|
| `yarn db:migrate` | ⛔ 거부 (exit 1) |
| `yarn db:backfill:content-locale --apply` | ⛔ 거부 |
| `yarn db:translate:content-locale --apply` | ⛔ 거부 |
| `yarn db:verify:content-locale` | ✅ 허용 (읽기 전용) |

모든 스크립트가 시작할 때 `[db] target: <host>/<db> (local|REMOTE)`를 찍는다 —
어느 DB를 봤는지 모르는 채로 "정상"이라 보고하는 것이 가장 위험하다.

**운영에 정말 적용해야 할 때만** `ALLOW_REMOTE_DB_WRITE=1`을 명시한다:

```bash
ALLOW_REMOTE_DB_WRITE=1 yarn db:migrate
```

`true`·`yes`·`1` 외의 값으로는 열리지 않는다. 배포 파이프라인은 이 스크립트들을
부르지 않으므로(마이그레이션은 수동 운영) 이 가드가 자동 배포를 막지 않는다.

**로컬에서 돌리려면** `DATABASE_URL`을 덮어쓴다:

```bash
docker compose -f docker-compose.e2e.yml up -d postgres
DIRECT_DATABASE_URL='postgresql://siglens:siglens@localhost:5433/siglens_e2e' \
  node_modules/.bin/tsx db/scripts/migrate.ts
```

---

### DB 콘텐츠 다국어 스위치 (`DB_CONTENT_LOCALE`)

뉴스·공지·약관 등 **DB에 저장된 문구**를 로케일별로 서빙하는 스위치.
`'1'`일 때만 켜지고, 그 외 모든 값(미설정 포함)은 꺼짐이다.

**순서 — 스키마 먼저, 코드 나중 (expand/contract)**

| # | 작업 | 왜 이 순서인가 |
|---|---|---|
| 1 | `ALLOW_REMOTE_DB_WRITE=1 yarn db:migrate --until 0029_content_locale` | **코드보다 먼저.** 0029는 additive다(컬럼·인덱스 추가, 기존 unique 유지) — 배포된 구 코드는 `locale`을 모르고 INSERT에서 빼는데 DB 기본값이 채우고, `ON CONFLICT (symbol, tab)`도 그대로 매칭된다(로컬 Postgres 17 실증). `--until`이 없으면 0030까지 적용된다. |
| 2 | 코드 배포 | 이 시점에 컬럼과 3열 unique가 이미 있다. |
| 3 | `ALLOW_REMOTE_DB_WRITE=1 yarn db:migrate` (0030) | 전 인스턴스가 새 코드다 = `ON CONFLICT` 타깃이 `(symbol, tab, locale)`뿐이다. 이제 구 unique를 지워도 안전하고, **비-ko 스냅샷이 쓰이기 전에 지워야** 한다. |
| 4 | `yarn db:backfill:content-locale --apply` | 한국어 컬럼 → 사이드카 `ko` 행. |
| 5 | `yarn db:translate:content-locale --locale <en\|ja\|zh> --apply` | **비-ko 행을 만드는 유일한 단계.** `GEMINI_API_KEY` 필요. |
| 6 | `yarn db:verify:content-locale` | 읽기 전용 점검. 실패 시 exit 1이라 게이트로 쓴다. |
| 7 | SSM `DB_CONTENT_LOCALE=1` → instance refresh | 사이드카 읽기 + ISR 키 분리 시작. |

⛔ **2번을 1번보다 먼저 하면 안 된다.** Drizzle은 스키마에 있는 컬럼을 values에서
빼도 `default`로 **항상 INSERT에 넣는다**(실측: `values({...}).toSQL()`). 즉
스위치로는 마이그레이션 전 배포를 보호할 수 없다 — 공유 스냅샷 생성과 프리웜
크론이 `column "locale" does not exist`로 죽는다. 보호는 순서가 한다.
회귀 가드: `src/entities/seo-snapshot/__tests__/upsertSql.test.ts`가 **프로덕션
repository가 만든 SQL**을 직접 검사한다(values 객체를 보는 mock 테스트는 이
결함을 못 잡았다).

⛔ **3번을 2번보다 먼저 하면 안 된다.** 배포된 구 코드는 `ON CONFLICT
(symbol, tab)`을 쓰는데, 0030이 그 인덱스를 지운다 — 프리웜이 42P10(`no unique
or exclusion constraint matching the ON CONFLICT specification`)으로 죽는다.

⛔ **3번을 7번 뒤로 미루면 안 된다.** 구 unique `(symbol, tab)`가 살아 있는 동안
같은 `(symbol, tab)`에 두 번째 로케일 행을 넣으면 **23505**로 죽는다(로컬 실증).
스위치를 켜는 순간 비-ko 프리웜이 시작되므로, 그 전에 지워져 있어야 한다.

**되돌리기.** 3번을 적용하기 전까지는 코드 롤백이 안전하다. 3번 이후에는
구 코드로 롤백하면 안 된다 — `ON CONFLICT (symbol, tab)`이 가리킬 인덱스가 없다.
스위치(`DB_CONTENT_LOCALE`)는 읽기만 가리므로 언제든 내릴 수 있다.

⚠️ **4·5번 없이 7번을 켜도** 화면은 멀쩡하다(사이드카가 비어 폴백). 무동작이지
오작동이 아니므로, "켰는데 아무것도 안 바뀐다"면 6번 점검으로 백필(4)이
빠졌는지 번역(5)이 빠졌는지 가른다.

⚠️ **약관은 AI 번역 대상이 아니다.** 오역이 곧 의무의 변경이라 읽기 경로가
`source='human'` 행만 신뢰한다. 사람이 넣어야 한다. 종목명·지표명은 애초에
사이드카에 등록하지 않는다 — 비-ko 표시 경로가 이미 영문 원본을 쓴다.

⚠️ **ISR write 비용**: 켜면 뉴스 목록의 `unstable_cache` 키에 로케일이 붙어
ISR write가 로케일 수만큼 늘어난다. 이 레포에서 ISR write는 실제 비용 항목이다
([ISR_REVALIDATE.md](./ISR_REVALIDATE.md)).

---

## 2.5 롤백 (ALB 제거 이후)

> ⛔ **0단계를 건너뛰지 말 것.**
>
> ```bash
> aws autoscaling delete-lifecycle-hook --profile siglens \
>   --auto-scaling-group-name siglens-asg --lifecycle-hook-name siglens-launch-gate
> ```
>
> 훅이 살아 있는 상태로 **예전 태그를 배포하면 안 된다.** `05-launch-template.sh`는
> 체크아웃된 태그의 `user-data.sh`로 런치 템플릿을 다시 만드는데, cloudflared 전환
> 이전 태그에는 `complete-lifecycle-action`을 부르는 스크립트가 없다. 그러면 훅이
> 600초 뒤 ABANDON으로 떨어지고, ASG의 `TerminateHookAbandon: terminate` 정책이
> 인스턴스를 죽이고, `min-size 1`이 같은 실패를 무한 반복한다(서빙 용량 0).
> 훅 삭제는 5초면 된다. 되돌린 뒤 `06-asg.sh`로 다시 만든다.

| 단계 | 되돌리는 법 | 소요 |
|---|---|---|
| DNS 전환 | Cloudflare에서 `siglens.io`/`www` CNAME을 ALB DNS로 되돌린다(프록시 레코드라 클라이언트 TTL 무관) | **1~2분 — 가장 빠른 레버** |
| 타깃그룹 분리 / health-check EC2 | `attach-load-balancer-target-groups` + `--health-check-type ELB` | ~3분 |
| ALB 삭제 | **되돌리는 스크립트가 레포에 없다.** `git show <전환 이전 SHA>:infra/aws/06-alb-asg.sh`와 `:infra/aws/03-acm.sh`로 복구해 수동 재생성 | 10~15분 |

**진짜 되돌릴 수 없는 지점은 ALB 삭제다** — 대체 인그레스가 사라지는 동시에 재생성
스크립트도 같은 PR에서 삭제됐기 때문이다. 그 전 단계는 전부 20분 안에 되돌아간다.

## 3. 알람 대응

알람은 `07-alarms.sh`(인프라·ISR)와 `13-seo-prewarm.sh`(크론)가 생성하고, 전부 SNS 토픽 `siglens-alerts`로 간다. **알람·정상복구 양방향으로 통지**한다.

> ⚠️ 알람이 있어도 `siglens-alerts` 구독이 `PendingConfirmation`이면 아무 메일도 오지 않는다. 2026-06-28 디스크풀이 조용히 진행된 원인이 정확히 이것("액션 없는 알람")이었다. 정기적으로 확인할 것:
> ```bash
> aws sns list-subscriptions-by-topic --topic-arn <siglens-alerts ARN> --profile siglens
> ```

| 알람 | 발화 조건(실측) | 1차 대응 |
|---|---|---|
| `siglens-tunnel-down` | `[cloudflared-down]` 로그 5분 합계 ≥ 1 | 인그레스 전멸이다. `systemctl status cloudflared` → 토큰(SSM `/siglens/TUNNEL_TOKEN`)·아웃바운드 7844 확인. 복구 안 되면 DNS를 잠시 되돌릴 수 없으니(ALB 없음) instance refresh |
| `siglens-app-unhealthy` | `[selfcheck]` 로그 5분 합계 ≥ 1 | 온박스 selfcheck가 인스턴스를 Unhealthy로 표시했다는 뜻 = ASG가 교체 중. 교체가 반복되면 컨테이너 로그부터 |
| `siglens-cpu-credits-low` | CPUCreditBalance < 30 (5분 Min ×2) | t4g 버스트 소진 임박. 배포·빌드가 유발했는지 먼저 확인(정상 회복). 지속되면 인스턴스 타입 재검토 |
| `siglens-mem-high` | mem_used_percent > 90 (5분 Avg ×3) | OOM 전 경고. 컨테이너 메모리 확인 → 재시작으로 완화, 반복되면 누수 조사 |
| `siglens-disk-high` | disk_used_percent > 85 (5분 Max ×2) | **ISR 외부화 회귀 카나리다.** 캐시가 S3로 안 나가고 로컬에 쌓인다는 뜻 → `siglens-isr-cache-failures`와 함께 보고 [ISR_CACHE_HANDLER.md](./ISR_CACHE_HANDLER.md)로 |
| `siglens-isr-cache-failures` | IsrCacheFailures 5분 합계 > 5 | S3 권한/버킷/IMDS 확인. fail-open이라 사이트는 살아 있지만 캐시는 사실상 죽은 상태 |
| `siglens-isr-tag-failures` | IsrTagFailures 15분 합계 ≥ 5 ×2주기 | 태그 동기화 실패 = 다른 인스턴스의 무효화를 놓쳐 **stale HTML을 revalidate TTL(6~24h) 동안 서빙**. 조용히 degrade하므로 이 알람이 유일한 신호 |
| `siglens-analysis-stream-failed` | `[analysis-stream] failed` 15분 합계 > 2가 연속 2주기 | **분석 전면 장애의 유일한 신호다.** SSE는 실패해도 HTTP 200이라 5xx 알람이 안 뜬다. 1순위 의심: 프로바이더 키(SSM `/siglens/{DEEPSEEK,GEMINI,ANTHROPIC,OPENAI}_API_KEY`) 누락·만료. Logs Insights에서 `[analysis-stream] failed` 원문 확인 → 키 문제면 SSM 갱신 후 인스턴스 재시작, 프로바이더 장애면 회복 대기 |
| `siglens-node-heap-oom` | `JavaScript heap out of memory` 1시간 1건 초과 | 앱 프로세스가 힙 상한(1.5GiB)에 닿아 죽었다 = 진행 중이던 분석 전멸 후 systemd 재시작. worker 제거로 LLM 호출이 앱 안에서 돌면서 생긴 실패 모드다. 동시 분석 상한(24)이 뚫렸는지, 특정 심볼의 bars가 비정상적으로 큰지 확인. 반복되면 인스턴스 타입 상향 또는 상한 하향 |
| `siglens-fear-greed-loader-failed` | `[FearGreedRoute] getMarketFearGreedStatic failed` 1시간 합계 > 4가 연속 2주기 (실패 1회당 로그 2줄 — metadata + 본문이 각각 catch하므로 실질 "시간당 실패 2회 초과") | `/fear-greed` 로더가 계속 실패 중. **fail-open이라 이게 유일한 신호다** — 페이지는 200 + "표본이 부족합니다"를 렌더하고 그 HTML이 ISR/S3에 저장돼 5xx도 헬스체크 실패도 안 뜬다. FMP 402/403처럼 재시도 대상이 아닌 오류면 매시 재생성이 똑같이 실패해 **빈 페이지가 영구화**된다. Logs Insights로 원문 확인 → FMP 키/플랜(SSM `/siglens/FMP_API_KEY`) 우선 의심. 복구 후에는 다음 revalidate(최대 1h)에 자동 정상화 |
| `siglens-fear-greed-kr-loader-failed` | `[FearGreedKrRoute] getMarketFearGreedKrStatic failed` 1시간 합계 > 4가 연속 2주기 | 미국판과 같은 fail-open 구조. 소스가 **무인증 yahoo**라 429가 주된 원인이고, KRX ETF 상장폐지도 같은 증상을 낸다. Logs Insights 원문 → 429면 회복 대기, 심볼 오류면 `marketFearGreedKrSymbols.ts` 갱신 |
| `siglens-market-kr-loader-failed` | `[MarketContent:kr]` 1시간 합계 > 4가 연속 2주기 | `/market/kr`이 빈 배열로 fail-open 중 = canonical null + noindex가 ISR에 굳는다. 지수 3 + ETF 6 + 종목 20을 yahoo로 긁으므로 429가 1순위. 캐시 쓰기 가드가 지수 기준이라, 지수까지 빠지면 캐시가 아예 안 써져 부하가 더 커진다 |
| `siglens-naver-news-failed` | `NAVER_CLIENT_ID/SECRET` 또는 `non-OK response` 1시간 1건 초과 | `/news/kr`의 **유일한** 소스다. 키 회수·NCP 구독 만료·일일 쿼터 소진이 전부 여기로 온다. SSM `/siglens/NAVER_CLIENT_ID`·`NAVER_CLIENT_SECRET` 확인 → NCP 콘솔에서 API HUB 구독 상태 확인 |
| `siglens-kr-calendar-horizon-expired` | `[KR_EQUITY_SESSION]` 1시간 1건 초과 | **KRX 휴장 캘린더가 만료됐다.** `src/shared/api/market/sessionSpecFor.ts`의 `KR_MARKET_HOLIDAYS`에 다음 해 고시 휴장일을 추가하고 `KR_CALENDAR_HORIZON`을 함께 늘린다. 방치하면 휴장일에 장중 TTL로 yahoo를 긁고 `/fear-greed/kr` 사이트맵이 없던 변경을 주장한다 |
| `siglens-seo-prewarm-unit-error` | `[seo-prewarm] unit-error` 또는 `unit-timeout` 15분 20건 초과 ×2주기 | 야간 prewarm 유닛이 대량 실패 중. 배치는 fail-open이라 `batch failed`가 안 뜨므로 이게 유일한 신호다. 프로바이더 키·장애를 먼저 의심 |
| `siglens-seo-prewarm-deadline-reached` | `[seo-prewarm] batch deadline reached` 6시간 3건 초과 | 배치가 데드라인에 걸려 심볼을 버리고 있다 = 커버리지가 조용히 줄고 있다. `SYMBOL_CONCURRENCY`/스케줄 폭 재검토, 유닛 지연 실측 |
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
| 분석이 계속 pending / 결과가 안 온다 | **ALB의 60초 벽은 없어졌다**(2026-08 cloudflared 전환, 터널로 600초 완주 실측). 남은 상한은 Cloudflare Proxy Read Timeout이고 25초 heartbeat가 그 아래다. 이제 이 증상은 대체로 서버 측이다 — CloudWatch Logs에서 `[streamAnalysisRoute]` 검색 |
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
