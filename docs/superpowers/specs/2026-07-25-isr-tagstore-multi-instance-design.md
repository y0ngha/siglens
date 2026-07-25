# ISR 태그 스토어 멀티 인스턴스 전파 설계

- 작성일: 2026-07-25
- 상태: 구현 완료
- 선행 문서: [`2026-06-28-isr-cache-handler-design.md`](./2026-06-28-isr-cache-handler-design.md) §8 확장 경로
- 실증: [`../../qa/2026-07-25-isr-tagstore-empirical-validation.md`](../../qa/2026-07-25-isr-tagstore-empirical-validation.md)
- 범위: `cache-handler/`, `infra/aws/07-alarms.sh`(알람 1건), `Dockerfile`(빌드 게이트 강화)

## 1. 문제

커스텀 ISR `cacheHandler`의 태그 무효화 스토어가 **in-process `Map`** 이었다. `revalidateTag`를
호출한 인스턴스에만 기록되므로, ASG가 2대 이상으로 늘어나면 나머지 인스턴스는 무효화를
인지하지 못하고 시간 `revalidate`(6~24h)가 돌 때까지 옛 HTML을 계속 서빙한다.

S3 캐시 엔트리는 인스턴스 간 **공유**되기 때문에 문제가 더 커진다. 신규 인스턴스는 다른
인스턴스가 이미 무효화한 엔트리를 S3에서 읽어 fresh로 오판한다.

결과적으로 `ASG desired=1`이 **코드로 강제되지 않는 암묵적 운영 가정**이 되어 있었다.
`06-alb-asg.sh`는 `--min-size 1 --max-size 4`에 타깃 트래킹(1000 req/target)을 걸어두었으므로
트래픽이 늘면 스케일아웃이 실제로 일어난다.

## 2. 설계 원칙

가장 중요한 제약은 **`maxRevalidatedAt`이 캐시 `get()`마다 불린다**는 것이다(`index.mjs`).
여기에 네트워크를 넣으면 모든 캐시 히트에 왕복이 붙는다. 따라서:

> **read 경로는 동기 + 로컬 전용으로 유지하고, 전파는 별도 경로로 붙인다.**

| 경로 | 동작 |
|---|---|
| **write** | `revalidateTag` → 로컬 Map 즉시 기록(read-your-writes) + Upstash 정렬셋에 durable 기록 |
| **read** | `get()`이 `ensureTagsFresh()` 호출 → 5초 간격으로 **지난 sync 이후 변경분만** 증분 조회해 로컬 Map에 병합 |

`maxRevalidatedAt`의 시그니처와 동기성은 그대로다. 실측 결과 부트스트랩 이후 판정 경로는
호출당 0.36µs로 기존 로컬 Map 접근과 사실상 동일하다.

## 3. 전송 계층 — 전역 `fetch`를 쓰지 않는다

**이 설계에서 가장 미묘하고 가장 중요한 결정이다.**

Next.js는 `patchFetch()`로 `globalThis.fetch`를 교체한다. 캐시 핸들러의 `get()`은 렌더의
`workUnitAsyncStorage` 컨텍스트 **안에서** 실행되므로, 여기서 전역 fetch를 호출하면 패치된
fetch가 이를 "페이지가 수행한 데이터 요청"으로 오인한다:

- `cache: 'no-store'` 같은 명시적 opt-out이 있으면 `DynamicServerError`를 던지는데,
  **던지기 전에 `workUnitStore.revalidate = 0`을 설정한다.** 예외를 `catch`로 삼켜도 부수효과는
  남아 해당 페이지가 **ISR 캐시에 기록되지 않고** no-store로 서빙된다 — 이 캐시 핸들러가
  존재하는 이유인 디스크 포화·Fast Origin Transfer 문제의 재발이다.
- `cacheComponents`(PPR) 활성 시에는 **영원히 settle되지 않는 promise**를 반환한다
  (`makeHangingPromise`). `AbortSignal`로도 구제되지 않아 전체 요청이 멈춘다.

그래서 `node:http`/`node:https`를 직접 쓴다 — `s3Store.mjs`가 AWS SDK(`node:http` 기반)를
쓰는 것과 같은 이유다. `s3Store`가 이 문제를 겪지 않은 것은 우연이 아니라 SDK가 `fetch`를
쓰지 않기 때문이며, 이 변경이 핸들러 안의 첫 `fetch` 사용이 될 뻔했다.

> 이 결함은 유닛 테스트(전역 `fetch` 스텁)로도, 별도 프로세스 실증(패치되지 않은 `fetch`)으로도
> 잡히지 않는다. 배포 안정성 감사가 실제 Next 소스를 읽고 `createPatchedFetcher`를 직접
> 구동해서야 드러났다.

### `@upstash/redis` 패키지를 쓰지 않는 이유

Dockerfile runner 스테이지는 `node_modules`에서 `sharp` / `@aws-sdk` / `@smithy` /
`@aws-crypto` / `tslib`만 명시 COPY한다(`Dockerfile:65-76`). 패키지를 쓰려면 COPY 목록과
`require.resolve` 게이트를 늘려야 하는데, 필요한 명령이 `ZADD` / `ZRANGE` /
`ZREMRANGEBYSCORE` / `EXPIRE` / `TIME` 뿐이라 직접 호출이 낫다. cache-handler는 번들 밖 평문
ESM이라 `src/`를 import할 수도 없다.

부수 효과로 패키지 클라이언트의 자동 `JSON.parse` 역직렬화 함정을 피한다 — SEO pre-warm 락에서
저장한 `'1'`이 숫자 `1`로 돌아와 비교 분기가 死코드가 된 사례가 있었다.

## 4. 저장소 선택

**Upstash Redis 정렬셋**(`siglens:isr:tags`, member=태그, score=무효화 시각 ms).

선행 스펙 §8은 "1차 → S3 태그 마커"를 예정했으나 **Redis로 변경**한다:

- S3는 태그당 객체 GET이 필요해 read 경로 레이턴시·요청 비용이 정렬셋 1회 조회보다 나쁘다
- Upstash는 이미 프로비저닝돼 있고(`UPSTASH_REDIS_REST_URL/TOKEN`이 `.env.example` →
  `check-env.sh` 필수키 → SSM `/siglens/*` → `user-data.sh`가 `--env-file`로 주입)
  **환경변수·IAM·보안그룹 변경이 0**이다
- 정렬셋은 `score >= 마지막 sync` 범위 조회로 **증분 동기화**가 공짜다. 무효화가 없는 정상
  상태에선 빈 배열이 온다

| 항목 | 값 |
|---|---|
| 키 | `siglens:isr:tags` (Sorted Set) |
| member | 태그 문자열 (`news:AAPL`, `seo-snapshot:AAPL`, `market-news:{sentinel}` …) |
| score | 무효화 시각 (epoch ms) |
| 쓰기 | `ZADD key GT {ts} {tag}` |
| 읽기 | `ZRANGE key {floor} +inf BYSCORE WITHSCORES` |
| 정리 | `ZREMRANGEBYSCORE key -inf ({serverNow - 7d})` + `EXPIRE key 30d` |

**`GT` 플래그가 핵심이다.** 여러 인스턴스가 동시에 쓸 때 늦게 도착한 오래된 타임스탬프가
최신값을 덮어쓰면 이미 무효화된 엔트리가 fresh로 되살아난다. 기본 `ZADD`는 실행 순서대로
덮어쓰므로 max semantics가 깨진다. 실제 Upstash 대상으로 검증했다(실증 W2/W3).

**배포(GIT_SHA)로 네임스페이스하지 않는다.** S3 엔트리는 `GIT_SHA` prefix로 갈리지만 태그 로그는
공유해야 롤링 배포 중 신·구 인스턴스가 서로의 무효화를 인지한다. 반대 방향(옛 태그가 새
엔트리를 잘못 무효화)은 불가능하다 — 새 엔트리의 `lastModified`가 보존된 모든 score보다 크다.

## 5. 동기화 규칙

| 상수 | 값 | 근거 |
|---|---|---|
| `REFRESH_INTERVAL_MS` | 5s | 인스턴스 간 전파 지연 상한. sync는 read에서만 트리거되므로 트래픽이 없으면 비용 0 |
| `RETRY_BASE_MS` → `RETRY_MAX_MS` | 1s → 60s | 연속 실패 시 지수 백오프. 첫 재시도가 1초라 부팅 직후 blip이 5초 맹점으로 굳지 않고, 지속 장애 시엔 60초까지 벌려 실패한 sync가 매 5초 7일치 전체 창을 재조회하는 낭비를 막는다 |
| `BOOTSTRAP_AWAIT_MS` | 1s | read 경로가 부트스트랩을 기다려주는 상한. 초과 시 백그라운드로 넘기고 요청은 통과 |
| `RETENTION_MS` | 7d | 아래 불변식 참조 |
| `SYNC_OVERLAP_MS` | 60s | sync **창**을 넓혀 쓰기 가시성 지연을 흡수. 겹쳐 읽어도 병합이 멱등(max)이라 무해 |
| `KEY_TTL_SECONDS` | 30d | 쓰기마다 갱신. 롤백으로 코드가 사라지면 키가 스스로 소멸 |
| `PRUNE_INTERVAL_MS` | 1h | 정리는 쓰기 경로에서 시간 게이트로 트리거되되 **await하지 않는다** |

**`RETENTION_MS` 불변식**: 보존 기간은 **태그가 달린** 캐시 엔트리의 최대 `revalidate`보다
커야 한다. 그보다 오래된 무효화 시각은 어떤 엔트리의 `lastModified`보다도 앞설 수 없어 판정에
영향을 주지 않기 때문이다. 현재 태그가 달리는 APP_PAGE의 최대 `revalidate`는 24h다.
og/twitter APP_ROUTE는 30d이지만 순수 함수라 태그가 붙은 fetch가 없다.
> ⚠️ **`revalidate > 7d`인 태그 달린 캐시를 새로 만들면 soft invalidation이 조용히 깨진다.**
> 그런 변경을 할 때 이 상수를 함께 조정할 것.

**부트스트랩**: 첫 sync는 보존 기간 전체(`now - 7d`)를 읽는다. 콜드 인스턴스가 공유 S3 엔트리를
fresh로 오판하지 않으려면 기존 무효화를 모두 학습해야 하기 때문이다. 이때 `get()`이 기다리는데,
**부트스트랩 중 도착한 요청은 모두 같은 promise를 공유하며 최대 1초까지만 기다린다**. 초과하면
sync는 백그라운드에서 계속되고 요청은 통과한다(fail-open). 이 상한이 스케일아웃 직후 첫 요청
버스트가 통째로 묶여 대기하는 것을 막고, 동시에 sync가 어떤 이유로든 settle되지 않아도 read가
잠기지 않도록 **구조적으로** 보장한다.

**워터마크**: `syncedThrough`는 sync가 **성공했을 때만** 전진한다. 실패 후 다음 sync가 보존
기간 전체를 다시 읽어 놓친 무효화를 복구할 수 있어야 하기 때문이다.

**메모리 상한**: 로컬 Map은 `revalidateTag`에 실제로 전달되는 태그 종류 수로 묶인다(현재
`news:{SYMBOL}`, market-news 5종, economy·indicator 고정 태그, pre-warm의 `seo-snapshot:{SYMBOL}`).
캐시 **쓰기** 태그(`symbol:{TICKER}` 등)는 `revalidateTag`로 전달되지 않으므로 들어오지 않는다.
추가로 sync마다 보존 기간이 지난 엔트리를 정리한다(실측 20k 엔트리 기준 0.38ms, 5초에 1회).

## 6. 시계 가정 (신규 의존)

score와 `entry.lastModified`는 **서로 다른 인스턴스의 벽시계**에서 나온다. 따라서 판정
`maxRevalidatedAt > lastModified`의 정확성은 **인스턴스 시계가 NTP 동기화돼 있다**는 가정에
의존한다(AL2023 골든 AMI의 chrony/Amazon Time Sync). 이 변경 이전에는 두 값이 같은 시계에서
나왔으므로 **새로 생긴 의존**이다.

- 쓰는 쪽이 60초 이상 **느리면**: 읽는 쪽의 다음 floor가 그 score를 지나쳐 무효화를 놓친다
  (재시작 시 7일 부트스트랩으로만 복구). `SYNC_OVERLAP_MS`가 허용 오차의 천장이다.
- 쓰는 쪽이 **빠르면**: 병합된 score가 이후 모든 재생성의 `lastModified`보다 커서 **매 요청
  재생성 루프**에 빠진다.

`SYNC_OVERLAP_MS`는 sync 창만 넓힐 뿐 위 비교에는 영향이 없다 — 둘을 혼동하지 말 것.
후자는 조용히 CPU·S3 쓰기만 늘리므로, 10초 이상 미래의 score를 병합하면 스로틀 경고를 남긴다.

## 7. 보장되지 않는 것 — 재생성 중 무효화 창

**인스턴스 A가 페이지를 렌더하는 도중(수 초) 인스턴스 B가 그 태그를 무효화하면, A의 `set()`은
렌더 완료 시각을 `lastModified`로 기록한다.** 이 값이 무효화 시각보다 크므로 방금 저장된(이미
낡은) HTML이 `revalidate` TTL(6~24h) 동안 fresh로 판정된다 — **모든 인스턴스가 그 무효화를
알고 있어도** 그렇다.

이는 단일 인스턴스에서도 동일하게 존재하던 선행 레이스이며 이 변경이 만든 것이 아니지만,
스케일아웃에서 더 자주 발생한다(야간 pre-warm이 B에서 돌고 A가 크롤러를 서빙하는 조합).
핸들러는 렌더 **시작** 시각을 알 수 없어 이 계층에서 정확히 고칠 수 없다.

따라서 "무효화가 5초 내 전파된다"는 **기존 캐시 엔트리에 대한 판정**에만 해당하며, 무효화
시점에 재생성 중이던 엔트리에는 해당하지 않는다.

## 8. 실패 처리 (fail-open)

어떤 경우에도 캐시 read/write 경로는 throw하지 않는다. 모든 실패는 **기존 로컬 전용 동작으로
degrade**하며, 이는 이 변경 이전 상태와 정확히 동일하다.

| 상황 | 동작 |
|---|---|
| Upstash 미설정 | 전 경로 no-op. **빌드 타임 prerender가 여기 해당** — Dockerfile에 UPSTASH secret mount가 없다 |
| `ISR_TAG_SYNC_DISABLED=true` | 동일하게 no-op. 재배포 없이 이 기능만 끄는 운영 레버 |
| sync 실패 | 로컬 맵 유지, 워터마크 미전진, 백오프 후 재시도, 스코프별 60초 스로틀 로그 |
| publish 실패 | 1회 재시도 후 포기. 로컬 맵에는 이미 기록됨 → 이 인스턴스는 정상, 다른 인스턴스만 놓침 |
| 정리 실패 | 무해 — 다음 게이트에서 재시도 |
| 손상된 정렬셋 엔트리 | 조용히 버림. 단 **원소는 있는데 해석된 쌍이 0이면** 와이어 포맷 변경으로 보고 경고(무동작 상태 조기 발견) |

로그 스로틀은 **스코프별**이다. 단일 커서를 쓰면 5초마다 도는 sync 실패가 창을 독점해 더
심각한 publish 실패(다른 인스턴스가 무효화를 영구히 놓침)가 묻힌다.

## 9. 운영

- **알람 신설** — `infra/aws/07-alarms.sh`에 `siglens-isr-tag-failures` 추가. 기존 필터는
  `[isr-cache] s3 get/set failed` 리터럴만 잡아 새 로그가 걸리지 않았다. 또한 스코프당 60초
  스로틀 때문에 완전 장애여도 300초에 5줄뿐이라 기존 알람의 "5 초과" 조건에 영원히 도달하지
  못한다 → `period 900` + `threshold ≥5` + 2주기(지속 장애 시 약 30분 내 발화)
- **Redis 명령량** — 트래픽이 있을 때 인스턴스당 5초에 1회 조회(≈17k/일/인스턴스, 4대 기준
  ≈2.07M/월). 앱이 쓰는 것과 **같은 Upstash DB**이므로, 무료 플랜이라면 이 sync 루프만으로
  일일 한도를 넘겨 앱 기능까지 실패한다. **배포 전 플랜이 유료인지 확인할 것.** 여유가 빠듯하면
  `REFRESH_INTERVAL_MS`를 늘린다
- **`ASG desired=1` 제약 해제** — 스케일아웃이 설정 변경 없이 안전해진다(§7 창 제외)
- **롤백** — `cache-handler/`를 되돌리면 즉시 로컬 전용으로 복귀. 태그 로그 키는 30d TTL로
  스스로 소멸하나, 즉시 정리하려면 `DEL siglens:isr:tags`

## 10. 테스트

`cache-handler/__tests__/` — `tagStore.test.mjs`, `upstashRest.test.mjs`, `index.test.mjs`.

`upstashRest`는 전송 계층을 **실제 `node:http` 서버**를 띄워 검증한다(모킹된 전송이 바로 §3
결함을 통과시킨 원인이므로). `tagStore`/`index`는 `upstashRest`를 mock한다.

> ⚠️ `index.test.mjs`·`tagStore.test.mjs`의 `vi.mock('../upstashRest.mjs')`는 편의가 아니라
> **프로덕션 안전장치**다. 없으면 `yarn release`(= `dotenv -e .env.local -- release-it` → push →
> pre-push의 `yarn test`)가 `.env.local`의 **실 프로덕션 Upstash 자격증명**을 물고 유닛 테스트를
> 돌려, 태그 로그에 실제 쓰기와 파괴적 `ZREMRANGEBYSCORE`를 수행한다. 절대 제거하지 말 것.
