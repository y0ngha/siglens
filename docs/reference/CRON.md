# Cron Operations

## `seo-prewarm` (AWS EventBridge)

`PATCH /api/cron/seo-prewarm`(spec `docs/superpowers/specs/2026-07-24-seo-recovery-bot-ssr-prewarm-design.md`)를 AWS **EventBridge classic Rule → API Destination**이 호출한다. 이 저장소 최초의 EventBridge 사용이다.

- **스케줄(UTC 고정)**: EventBridge classic Rules + API Destinations는 UTC 스케줄만 지원한다. 라우트는 ET 마감(16:00 ET) 기준 신선도로 자체 게이팅하므로 UTC 스케줄이어도 문제없다. **20:30–03:59 UTC** 사이 5분 간격으로 실행되며, EST(UTC-5)/EDT(UTC-4) 양쪽에서 16:00 ET 마감을 커버한다. UTC 자정을 걸치고, AWS cron이 "시간별로 다른 분(minute) 필터"를 표현할 수 없어(20시대만 :30부터 시작해야 함) 규칙을 3개로 쪼갠다:
  - `siglens-seo-prewarm-evening`: `cron(30,35,40,45,50,55 20 * * ? *)` (20:30–20:55 UTC)
  - `siglens-seo-prewarm-evening-late`: `cron(0/5 21-23 * * ? *)` (21:00–23:59 UTC)
  - `siglens-seo-prewarm-early`: `cron(0/5 0-3 * * ? *)` (00:00–03:59 UTC)
  - ⚠️ **FIX Z(감사) — 왜 20:00이 아니라 20:30 시작인가**: technical 캐시(anonymous/free 기준)는 KST 05:00 = **UTC 20:00**에 만료된다(`infrastructure/cache/config.js`). 원래 스케줄(20:00 시작)은 가장 많이 크롤되는 `/[symbol]` 루트 라우트가 cron의 첫 tick 시점에 거의 항상 캐시 MISS였다. 30분 지연 + 기존 30분 정착 버퍼(`SETTLE_BUFFER_MS`, `freshness.ts`)를 합쳐 캐시 만료·정착 버퍼 둘 다보다 뒤로 시작 시점을 민다.
- **인증**: EventBridge Connection(`siglens-seo-prewarm`, API_KEY 인증)이 `Authorization: Bearer <CRON_SECRET>` 헤더를 자동 주입한다. `CRON_SECRET`은 `.env.example`에 필수 키로 등록돼 있고, `04-params.sh`가 SSM `/siglens/CRON_SECRET`에 이미 게시한다(check-env.sh의 OPTIONAL_KEYS에 없음 — 배포 게이트가 강제). `13-seo-prewarm.sh`는 이 값을 SSM에서 읽기만 하고 새로 만들지 않는다.
- **202/after() 설계**: 라우트는 인증·락 확인 후 즉시 `202 Accepted`를 반환하고, 실제 배치(`runPrewarmBatch`)는 `next/server`의 `after()`로 백그라운드 실행된다. API Destination의 짧은 타임아웃(~5s)이나 ALB idle timeout(60s)에 걸리지 않기 위함. 중첩 실행은 Redis 루트 락이 차단하며, 락 보유 중이면 `204`(2xx라 EventBridge가 재시도 폭풍을 일으키지 않음)를 반환한다.
  - **FIX H(감사) — 락 획득 자체가 던지는 경우**: `getRedisClient()`는 연결 상태를 미리 검증하지 않으므로, Upstash 장애/타임아웃이면 `acquirePrewarmLock()`의 `redis.set()`이 REJECT할 수 있다(redis 미구성 시의 "fail-closed로 null 반환"과는 다른 경로). 이를 try/catch 없이 두면 예외가 라우트 밖으로 전파되어 500이 나가고, EventBridge는 5xx를 공격적으로 재시도한다(기본 최대 185회/24h) — 락 보유 중 204를 반환하는 설계 의도(재시도 폭풍 방지)와 정확히 반대다. `route.ts`는 이 예외를 잡아 `[seo-prewarm] redis unavailable — lock acquire threw:` 로그와 함께 204로 흡수한다(after는 예약되지 않는다).
- **배치 wall-clock 상한(FIX G, 감사)**: `runPrewarmBatch`는 `BATCH_DEADLINE_MS = 600_000`(10분)의 wall-clock 데드라인을 갖는다. FMP 429/5xx 폭풍 중엔 심볼당 최악 ~75s(10s 타임아웃 + 10/15/20s 재시도)가 들 수 있어, 데드라인 없이는 10심볼 배치가 락 TTL(900s)을 넘겨 락이 만료되고 다음 tick이 새 락으로 두 번째 배치를 동시에 띄우는 오버랩이 생길 수 있었다(CAS 락 해제는 락 "탈취"는 막지만 "오버랩"은 못 막는다). 유닛(심볼×탭) 하나는 `UNIT_TIMEOUT_MS`(120초)를 넘기면 **기다리기를 포기**하고 backoff 마커를 남긴 뒤 다음 유닛으로 넘어간다 — core `run*`에 AbortSignal을 넘기지 않으므로 그 호출 자체는 백그라운드에서 계속 돈다(락을 지키는 게 목적이지 작업을 회수하는 게 아니다). 배치 데드라인은 **청크 경계와 심볼 내부의 탭 경계 양쪽**에서 검사한다 — `run*`이 LLM 왕복만큼 블로킹하므로 청크 경계에서만 보면 마지막 청크가 탭을 연달아 돌며 락 TTL을 넘길 수 있다. 어느 쪽이든 진행 중인 유닛은 끝까지 완료하고(upsert 유실 없음) 멈추며, `[seo-prewarm] batch deadline reached — N symbols processed, M remaining` 로그를 남긴다. 못 다 한 심볼은 여전히 stale이므로 다음 tick이 자연스럽게 이어받는다.
- **모니터링 신호**:
  - 정상 완료: `[seo-prewarm] batch done: {counts}` (harvested/revalidated/remaining/fmpBudgetUsed)
  - 배치 전체 실패: `[seo-prewarm] batch failed: ...` → CloudWatch 알람 `siglens-seo-prewarm-batch-failed`(1시간 3회 초과 시)
  - redis 불가용(미구성 또는 락 획득 예외): `[seo-prewarm] redis unavailable ...` → CloudWatch 알람 `siglens-seo-prewarm-redis-unavailable`(1시간 1회 초과 시). 필터 패턴은 ASCII 접두 `"[seo-prewarm] redis unavailable"`만 쓴다(FIX F, 감사) — 원문 로그의 em-dash(—)가 CloudWatch Logs 필터의 따옴표 안 non-ASCII 토큰 매칭에서 검증되지 않은 동작이라 신뢰하지 않는다. `grep`으로 이 저장소에서 두 로그 라인(lock.ts 미구성 케이스 / route.ts 락 획득 예외 케이스)에만 등장함을 확인했다.
  - 배치 데드라인 도달(FIX G): `[seo-prewarm] batch deadline reached — N symbols processed, M remaining` — `siglens-seo-prewarm-deadline-reached` 알람이 붙어 있다(6시간 3건 초과). 산발적 1~2회는 느린 프로바이더로 정상 범위지만, 반복되면 커버리지가 줄고 있다는 뜻이라 `SYMBOL_CONCURRENCY`·스케줄 폭을 재검토해야 한다.
  - 심볼/탭 단위 실패는 fail-open으로 격리되어 배치를 중단시키지 않는다(`[seo-prewarm] unit-error ...`, `[seo-prewarm] fmp-402 ...`). 402는 심볼별 플랜/쿼터 이슈라 정책상 알람을 걸지 않는다.
  - 유닛 타임아웃: `[seo-prewarm] unit-timeout {symbol}:{tab} — ...` — 해당 유닛은 30분 backoff(일시적 실패로 간주 — 구조적 불가 유닛의 6시간 backoff는 상태 기반 경로가 담당). 반복되면 provider 지연이나 특정 심볼의 데이터 문제를 의심할 것.
  - terminal skip(backoff, FIX C 감사): `[seo-prewarm] skip {symbol}:{tab} — status=...`(또는 `— null result`)를 `console.warn`으로 남긴다(기존 `console.debug`는 로그 파이프라인에서 조용히 사라져 운영자가 "막힌" 유닛을 볼 수 없었다). 해당 (symbol, tab)은 6시간 backoff에 들어가 다음 몇 tick 동안 재선별되지 않는다 — **하룻밤에 이 로그가 몇 번 보이는 건 정상**이다(영구 실패 유닛도 있을 수 있다: 예 — 옵션 체인이 없는 심볼의 `options` 탭). 특정 (symbol, tab)이 여러 밤 연속 반복되면 원인(정규화 실패, no_trades 등)을 살펴볼 것.
  - FMP 429(rate limit)는 `fmpRetry.ts`가 10s/15s/20s로 자동 재시도하지만, 재시도 자체를 로그로 남기지 않는다 — 안정적인 429 로그 문자열이 없어 전용 알람은 아직 없다(best-effort, `13-seo-prewarm.sh`에 TODO로 남겨둠). 429가 배치에 영향을 줄 만큼 누적되면 batch-failed 알람이 구조적 실패로 잡아낸다.
  - **정상 vs 진짜로 막힌 상태 구분**(운영 참고): `harvested 0`인 tick 자체는 정상일 수 있다 — 그 tick의 후보 창에 신규 stale 심볼이 없었을 뿐이다. **진짜로 막힌 상태**는 다음 중 하나: (a) `remaining > 0`인데 `harvested`가 여러 tick 연속 계속 0이면서 `batch deadline reached`가 매번 찍힘(유닛이 LLM 마감까지 끌려가는 중 — provider 지연/키 문제 의심), (b) 같은 (symbol, tab)에 대해 `skip ... status=` 로그가 여러 밤 연속 반복(terminal skip이 self-heal 안 됨).
- **부트스트랩(수동, 1회)**: 첫 태그 배포 전에 다음을 순서대로 수행한다.
  1. **DB 마이그레이션** — `seo_analysis_snapshots` 테이블(마이그레이션 `0027`)을 적용한다. `yarn db:migrate`는 내부적으로 `dotenv -e .env.local`을 거치므로 **`.env.local`의 `DATABASE_URL`이 반드시 prod를 가리키게** 한 뒤 실행할 것 — 그렇지 않으면 로컬/개발 DB가 조용히 마이그레이션된다. 실행 후 `psql`로 `\d seo_analysis_snapshots`를 조회해 테이블이 실제 prod에 생겼는지 확인한다. 중복 실행 무해(이미 있으면 no-op). 이 테이블 없이 배치를 돌리면 select/upsert가 즉시 실패한다.
  2. **`infra/aws/.env` 전제조건** — `13-seo-prewarm.sh`는 `set -u` 하에서 이 파일을 `source`하므로, 파일이 없으면 즉시 hard-fail한다(다른 `infra/aws/*.sh` 스크립트가 이미 만들어뒀어야 한다).
  3. **로그 그룹 순서** — `13-seo-prewarm.sh`의 `put-metric-filter` 호출은 로그 그룹 `/siglens/app`이 이미 존재한다는 전제다(`10-logs.sh` 또는 첫 인스턴스 부팅이 생성). 그룹이 아직 없으면 `put-metric-filter`가 에러를 던지지만 스크립트는 `|| true`로 조용히 무시하므로 **필터가 하나도 안 걸린 채로 스크립트가 "성공"한 것처럼 보인다**. 첫 배포에서는 `10-logs.sh`(또는 첫 인스턴스 부팅)가 먼저 돈 뒤 **`13-seo-prewarm.sh`를 반드시 재실행**할 것 — 재실행은 멱등이라 안전하다. 검증: `aws logs describe-metric-filters --log-group-name /siglens/app --filter-name-prefix siglens-seo-prewarm` → 필터 4개(`siglens-seo-prewarm-batch-failed`, `-redis-unavailable`, `-unit-error`, `-deadline-reached`)가 나와야 한다.
  4. `bash infra/aws/13-seo-prewarm.sh`를 수동 실행해 IAM 역할·Connection·API Destination·Rule 3개·타겟·알람(FailedInvocations ×3 + batch-failed + redis-unavailable)을 생성한다(멱등, 재실행 가능). deploy 파이프라인 어디서도 자동 호출하지 않는다.
  5. **알람 구독 확인(FIX E, 감사)** — `13-seo-prewarm.sh`는 `07-alarms.sh`와 동일하게 `ALARM_EMAIL`이 설정돼 있으면 `siglens-alerts` SNS 토픽에 이메일을 구독한다(idempotent). 이 스크립트가 토픽을 처음 만드는 실행 순서(예: `07-alarms.sh`를 아직 안 돌린 상태)라면 구독자 없이 알람만 만들어지는 사각지대가 있었다 — 2026-06-28 디스크풀 인시던트와 같은 종류("액션 없는 알람")다. 검증: `aws sns list-subscriptions-by-topic --topic-arn <siglens-alerts ARN>` → 최소 1개 구독이 `SubscriptionArn`이 `PendingConfirmation`이 아니라(즉 이메일의 confirm 링크를 클릭해) **Confirmed** 상태여야 한다.

  **이 레포 최초의 EventBridge 사용이므로, 스크립트 실행 직후 딜리버리 스파이크(수동 invoke 또는 실제 스케줄 1회 대기)로 202가 실제로 오는지 검증하기 전까지는 스케줄을 신뢰하지 말 것.** `put-targets`의 `HttpParameters` wiring은 실전 미검증 상태다. `13-seo-prewarm.sh`는 Connection이 `AUTHORIZED` 상태에 도달할 때까지 짧게 폴링(최대 12회 × 5s)한다 — 시간 내 도달하지 못해도 스크립트를 죽이지 않고 경고만 남기므로, 로그에 `WARNING: connection ... did not reach AUTHORIZED`가 보이면 수동으로 `aws events describe-connection --name siglens-seo-prewarm --query ConnectionState`를 재확인할 것.

- **딜리버리 부재 알람(OPS-1)**: 배치 내부 실패(`batch failed` 로그)는 `siglens-seo-prewarm-batch-failed`가 잡지만, EventBridge가 애초에 타겟 호출 자체를 실패하면(Connection 미인증, IAM, API Destination 오류 등) 앱 로그에는 아무 흔적도 남지 않는다. `13-seo-prewarm.sh`가 Rule별로(evening/evening-late/early 3개 모두) `AWS/Events` `FailedInvocations`(dimension `RuleName`) 알람(`siglens-seo-prewarm-{evening,evening-late,early}-failed`, 5분간 1건 초과)을 함께 생성해 이 공백을 커버한다.

- **롤백 / kill-switch**: cron을 즉시 끄려면 3개 Rule을 모두 비활성화한다(인스턴트, 멱등, 재실행 가능):
  ```bash
  aws events disable-rule --name siglens-seo-prewarm-evening
  aws events disable-rule --name siglens-seo-prewarm-evening-late
  aws events disable-rule --name siglens-seo-prewarm-early
  ```
  다시 켤 때는 `enable-rule`로 동일하게 되돌린다. 리소스 자체(Connection/API Destination/Role)는 그대로 남으므로 재프로비저닝이 필요 없다. **`disable-rule`은 그 자체로 알람을 발생시키지 않는다(silent by design)** — 의도적으로 끈 건지 사고로 끈 건지는 로그(그 이후 `batch done`/`batch failed`가 안 보임)로만 알 수 있다.
  - 프로세스가 배치 도중 죽으면(예: 배포 중 인스턴스 교체) Redis 락이 최대 `LOCK_TTL_SECONDS`(15분)까지 유지된다 — 그 사이엔 새 tick이 락을 못 잡고 204만 반환한다. 급하면 수동으로 `DEL seo-prewarm:lock`.

- **하트비트 알람은 첫 성공 실행 후에 추가할 것**: `[seo-prewarm] batch done` 로그에 대한 metric filter + "N시간 무성공" 알람은 매력적이지만, 배포 직후(첫 스케줄 실행 전)에 만들면 정상적인 "아직 한 번도 안 돎" 상태를 즉시 알람으로 오탐한다. 딜리버리 스파이크로 첫 202/`batch done`을 확인한 뒤에 추가한다.

### 공정 선별(select) 정책 — FIX A/C/Z(감사)

`runPrewarmBatch`의 select 단계는 세 가지를 함께 해결한다(`selectFairBatch`/`classifySymbol`, `runPrewarmBatch.ts`):

1. **회전 오프셋** — "이번 tick 기준 전 탭이 fresh로 완료된 심볼 수"(freshCount)를 유니버스 배열의 시작 오프셋으로 쓴다. 밤 동안 처리가 진행될수록 offset이 단조 증가해 매 tick 시작점이 앞으로 흘러가고, 다음날 boundary가 넘어가 전부 stale로 리셋되면 offset도 자연히 0으로 리셋된다. `Math.random`이나 별도 Redis 커서 없이 결정적이다. 이 덕분에 유니버스 tail(`POPULAR_CRYPTOS` 29종, `buildPrewarmUniverse`가 배열 끝에 붙임)이 평일에도 도달 가능해졌다(이전엔 항상 index 0부터 시작해 tail이 영원히 배제됐다).
2. **blocked 배제** — stale 탭이 전부 in-flight 마커 또는 backoff로 막힌 심볼은 배치 슬롯을 소비하지 않게 제외한다(`classifySymbol`). 워커 시절의 "resumable 우선"(전 tick이 submit만 하고 못 끝낸 jobId를 먼저 채우기)은 poll 재개가 사라지면서 함께 없어졌다.
3. **backoff 배제** — 모든 stale 탭이 6시간 backoff(FIX C, terminal skip) 중인 심볼은 배제한다.

Redis 비용은 bounded 후보 창(`SYMBOLS_PER_TICK * 3` = 18개 심볼)으로 제한된다 — worst case 18 × 7탭 × 2회(in-flight 마커 조회 + skip 조회) = 252회/tick(유니버스 전체를 걸면 ~1900회/tick이 든다).

### 콜드 캐시 실제 워밍 — FIX Z(감사)

워커·Redis 신호 제거 전에는 `submit`만 하고 `submitted` 상태를 방치해, 실제 방문자가 같은 캐시 키를 데우기 전까지 pre-warm이 아무것도 채우지 못했다. 그 뒤 submit + `poll*` 재개 루프를 얹어 메웠지만, 지금은 **submit/poll 자체가 없다**: core의 `run*` 함수가 LLM 응답까지 블로킹으로 기다렸다가 결과를 그대로 돌려주므로, 한 번의 seam 호출이 곧 워밍 완료다(`TAB_SEAMS`, `runPrewarmBatch.ts`). 그래서 `pollUntilSettled`·jobId·poll 캡 개념이 모두 사라졌다.

in-flight 마커는 남아 있지만 역할이 바뀌었다 — 재개 지점(jobId)을 들고 있는 게 아니라, 같은 (symbol, tab)에 대해 **두 tick이 동시에 LLM을 태우는 것만** 막는다(TTL 30분, 완료 즉시 해제).

`run*`이 LLM 응답까지 블로킹해 심볼당 소요 시간이 길어져 `SYMBOLS_PER_TICK`을 10 → **6**으로 낮췄다. 스케줄이 20:30 시작으로 30분 밀리면서(위 FIX Z 참고) 하룻밤 tick 수는 `(20:30–23:59)+(00:00–03:59)` ≈ 90회(5분 간격). tick당 6심볼을 "이번 tick 안에" 목표로 하면(캐시가 이미 대부분 warm인 흔한 경우 대다수 유닛이 즉시 끝난다) 하룻밤 처리량은 유니버스(290심볼)를 여유 있게 커버할 수 있는 규모다(90 tick × 6 = 540 심볼-시도/night, 약 1.5~2배 여유). 이전 head-of-line 방식의 실측 처리량(~160심볼/night, 그마저도 유니버스 head에 편중)과 대비된다 — 정확한 실측치는 배포 후 `SELECT count(*), count(DISTINCT symbol) FROM seo_analysis_snapshots`로 재확인할 것.

### Phase 2 — SSR prewarm rendering 배포 런북

Phase 1(위 `seo-prewarm` cron — 스냅샷을 `seo_analysis_snapshots`에 적재)과 Phase 2(적재된 스냅샷을 `[symbol]` 라우트 SSR에서 렌더 — `TechnicalSnapshotProse` 등 7개 탭 렌더러)는 별도 배포 단위다. Phase 2는 Phase 1이 채운 데이터에 의존하므로 배포 순서를 지켜야 한다.

**배포 순서**:

1. `yarn db:migrate` — migration `0027`(`seo_analysis_snapshots` 테이블)을 적용한다(위 부트스트랩 §1의 `DATABASE_URL` 경고 참고). 중복 실행 무해.
2. `bash infra/aws/13-seo-prewarm.sh` 수동 실행(`.env` 전제조건·로그 그룹 순서·알람 구독은 위 부트스트랩 §2~§5 참고) + "부트스트랩" 절차의 딜리버리 스파이크로 202가 실제로 오는지 검증한다.
3. Phase 1 앱을 배포한다(cron이 스냅샷을 적재하기 시작).
4. **cron이 최소 2번의 완전한 밤(≥2 full nights) 동안 돌게 두고** 행이 쌓이는지 확인한다:
   ```sql
   SELECT count(*), count(DISTINCT symbol) FROM seo_analysis_snapshots;
   ```
   유니버스는 290개 심볼 / 1913개 심볼×탭 조합이다. 공정 선별(위 §"공정 선별") 적용 후 steady state에서는 하룻밤에 유니버스 전체를 커버할 수 있어야 한다(정확한 실측치는 위 참고).
5. Phase 2를 배포한다.

**Phase 2를 일찍 배포해도 안전하다** — fail-open 설계(`getSeoSnapshotsStatic`가 읽기 실패·빈 결과 시 `[]`로 degrade)라 행이 없으면 각 렌더러가 `null`을 반환해 기존 placeholder(peek/FactsSummary 등)로 자연스럽게 폴백한다. 다만 행이 쌓이기 전까지는 아무것도 렌더하지 않는다 — "안전"과 "효과 있음"은 다른 질문이다.

**읽기 경로 max-age 게이트(FIX D, 감사)**: `getSeoSnapshotsStatic`(`src/entities/seo-snapshot/lib/getSnapshotStatic.ts`)는 `generatedAt`이 `SNAPSHOT_MAX_AGE_MS`(7일, `model.ts`)보다 오래된 행을 반환 전에 걸러낸다. cron이 며칠간 죽어 있어도 "전일 장마감 기준" 캡션과 함께 몇 주 전 분석이 서빙되는 걸 막는 방어선이다(정확성/E-E-A-T 리스크). 필터링으로 행이 드롭되면 `[getSeoSnapshotsStatic] {SYMBOL}: dropped N row(s) older than ...`가 `console.warn`으로 남는다 — 이 로그가 (특히 여러 심볼에 걸쳐) 보이기 시작하면 cron이 죽은 지 오래됐다는 뜻이니 위 모니터링 신호를 확인할 것. 드롭된 결과는 기존 fail-open 경로([]  → placeholder)를 그대로 타므로 새로운 실패 모드는 아니다.

**배포 후 검증(이것이 기능이 실제로 작동하는지 확인하는 유일한 신호 — 아래 FIX 7 로그 참고)**:

```bash
# UI audit FIX 6: SnapshotSummarySection's per-tab `title` prop is wired up now
# (previously dead code — every tab shared the default '최근 분석 요약'), so
# each tab renders its OWN heading (TechnicalSnapshotProse/OverallSnapshotProse/
# etc.). Pair each path with its tab-specific marker instead of one shared string.
declare -A SNAPSHOT_HEADING=(
  [""]="기술적 분석 요약"
  ["/overall"]="종합 분석 결론"
  ["/news"]="뉴스 종합 심리"
  ["/fundamental"]="펀더멘털 종합 평가"
  ["/financials"]="재무제표 종합 평가"
  ["/congress"]="의회 거래 동향 요약"
  ["/options"]="옵션 시장 요약"
)
for p in "" /overall /news /fundamental /financials /congress /options; do
  printf '%s: ' "$p"
  curl -s "https://siglens.io/AAPL$p?cb=$(date +%s)" | grep -c "${SNAPSHOT_HEADING[$p]}"
done   # expect 1 per tab that has a row; a row of zeros = silently dead
curl -s "https://siglens.io/AAPL/overall?cb=$(date +%s)" | grep -o '<meta name="description"[^>]*>'   # must NOT be the templated copy
curl -s https://siglens.io/robots.txt   # Googlebot group present WITH the /api/ baseline
curl -sI "https://siglens.io/AAPL" | grep -i 'x-nextjs-cache'   # ISR still caching, not no-store
curl -s https://siglens.io/ZZZZ | grep 'name="robots"'   # noindex, nofollow (degrade invariant)
```

ISR 캐시 키는 `GIT_SHA` prefix가 붙어 매 릴리스마다 cold-start한다 — 위 curl은 배포 직후 **첫 요청**에서 바로 프로즈가 보여야 한다(TTL 대기 불필요).

**롤백**: Phase 2 되돌리기는 순수 read-path 변경(스키마/인프라 변경 없음)이라 Phase 1과 독립적이고 깨끗하다. 단, Google이 robots.txt를 ~24h 캐싱하므로 롤백 후에도 OG-block(있었다면)이 잠깐 유지될 수 있다.

**추적할 알려진 갭(여기서 고치지 않음)**: `cache-handler/tagStore.mjs`는 in-process Map이다(ASG desired=1 가정 하에 문서화됨). Phase 2로 `seo-snapshot:{SYM}` 태그에 실제 consumer가 생겼으므로, ASG가 1을 넘어 스케일하면 서빙하지 않는 인스턴스는 자기 TTL까지 무효화되지 않는다. 별도 follow-up 이슈로 추적할 것.

## Pending Follow-ups

| 테이블 | 작업 | 상태 |
|---|---|---|
| `shared_analyses` | 만료 행(`expires_at < NOW()`) 주기적 물리 삭제 | ⏳ 미구현 — 현재는 앱 레벨 `isExpired()` 필터로 읽기 시 걸러짐. 행이 누적되어 문제가 될 경우 아래 패턴에 따라 cron 라우트를 추가. |

어닝 데이터는 사용자가 종목의 뉴스 페이지에 진입할 때 on-demand 방식으로 FMP에서 fetch해 `earnings_reports` 테이블에 upsert된다(`src/app/[symbol]/news/newsData.ts`의 `getEarningsReportComparison`) — cron 아님.

## 새 Cron 추가 패턴 (AWS EventBridge)

Vercel/GitHub-Actions 시절 패턴은 폐기됐다(Vercel은 AWS로 마이그레이션 완료, GitHub Actions cron은 미사용). 새 cron을 추가할 때 따를 패턴:

1. `src/app/api/cron/<name>/route.ts` — `PATCH`(idempotent batch) 핸들러. `process.env.CRON_SECRET`으로 Bearer 인증(`timingSafeEqual` 상수시간 비교, `seo-prewarm/route.ts`의 `safeBearerCompare` 참고). 배치가 오래 걸리면 즉시 202를 반환하고 `after()`로 백그라운드 실행 + Redis 락으로 중첩 실행 차단(`seo-prewarm` 참고). 락 획득 호출은 반드시 try/catch로 감싸 어떤 예외든 204로 흡수할 것(FIX H) — 그렇지 않으면 500이 EventBridge 재시도 폭풍을 유발한다. 배치 자체에도 wall-clock 데드라인을 둘 것(FIX G) — 락 TTL을 넘기면 다음 tick이 새 락으로 배치를 중복 실행한다.
2. `infra/aws/<NN>-<name>.sh` — `13-seo-prewarm.sh`를 템플릿으로 삼아 IAM 역할(`events.amazonaws.com` trust + `events:InvokeApiDestination` inline policy) + Connection(API_KEY, `Authorization: Bearer ${CRON_SECRET}`) + API Destination(PATCH 대상 URL) + Rule(UTC cron expression, 자정 걸치거나 분(minute) 표현이 시간별로 달라야 하면 여러 개로 분리) + `put-targets`로 wiring한다. 알람용 SNS 토픽은 `07-alarms.sh`와 동일하게 `ALARM_EMAIL` 이메일 구독(idempotent)까지 포함할 것(FIX E) — 토픽만 만들고 구독을 빼먹으면 알람이 액션 없이 매달린다. 전부 idempotent(existence check 또는 `|| true`). CloudWatch metric filter 패턴에 non-ASCII(em-dash 등)를 쓰지 말 것(FIX F) — ASCII만 남긴 고유 접두로 자른다.
3. 배포 파이프라인 어디서도 자동 호출하지 않는다 — 첫 배포 전 수동 1회 실행 + 딜리버리 스파이크로 검증.
4. 본 문서에 entry 추가(스케줄·인증·모니터링 신호·부트스트랩 방법).
5. `CRON_SECRET`은 이미 SSM `/siglens/CRON_SECRET`에 게시돼 있으므로 재사용하면 되고, 새 cron 전용 시크릿이 필요하면 `.env.example`에 키를 추가해 `04-params.sh`(자동 SSM 게시) + `check-env.sh`(자동 필수 키 검증)에 편입시킨다.
