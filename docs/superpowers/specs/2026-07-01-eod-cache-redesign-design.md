# EOD 일봉 캐시 재설계 (앵커드 2-tier) — 설계

- 작성일: 2026-07-01
- 스코프: siglens I/O 레이어 — `src/shared/api/market/CachedMarketDataProvider.ts`, `src/shared/cache/getOrSetCache.ts`
- core(`@y0ngha/siglens-core`)·`FmpMarketProvider` **무변경**
- 상태: 설계 승인 대기

---

## 1. 배경 (실측)

v0.32.0에서 도입한 EOD split이 **호출수를 줄이기는커녕 늘렸다**. 배포 ~10시간 후·미국 장 마감 중(00:00 UTC) 측정:

| Endpoint | 배포 전 | 배포 후 |
|---|---:|---:|
| `historical-price-eod/full` calls | 117 | **325** |
| `historical-price-eod/full` egress | 6.59 MB | **9.75 MB** |
| `quote` calls | 117 | 169 |

(valuation은 성공: `ratios-ttm` 383→43. 이 재설계 대상 아님.)

### 근본 원인 (코드 확인)

현재 `CachedMarketDataProvider.getCachedDailyBars`의 캐시 키에 **rolling 날짜**가 박혀 있다:
- history: `bars:eodhist:<SYM>:<from=now-730d>:<histTo=now-7d>`
- recent: `bars:eodrecent:<SYM>:<recentFrom=now-10d>`

`from`/`histTo`/`recentFrom`가 **매일(특히 UTC 자정에 `now-730d` 날짜가 롤) 바뀌어 키가 갱신**된다 → 같은 심볼도 자정 이후 첫 접근 시 **전체 재fetch**. 여기에 split이 요청당 EOD를 **2회**(hist + recent) 부른다. 측정 시각(00:00 UTC)은 자정 키롤 + 2× fetch가 겹친 최악 구간이었다.

핵심: **캐시 키에서 날짜를 제거**하면 자정 롤·반복 크롤 재fetch가 사라진다.

### 사용자 신선도 (불변)
- 오늘 봉/가격: live tail(recent, 세션 TTL 장중 60s) + 클라 refetch(30s). 그대로 유지.
- 과거 일봉: 불변. long-cache해도 사용자 영향 0.

---

## 2. 목표 / 비목표

### 목표
1. EOD(`historical-price-eod/full`) **호출수·egress 실질 감소** — 자정 키롤 및 반복 크롤 재fetch 제거.
2. 사용자 화면·차트·오늘 봉 신선도 **무변경**.
3. 기존 캐시 계약(poison 방지·`shouldCache`·graceful fallback) 유지.

### 비목표 (제외)
- **증분 append** — recent 윈도우가 최근 구간을 backfill하므로 history는 겹침 유지용 full-refetch-on-stale로 충분(사용자 결정). read-modify-write 복잡성 회피.
- DB 영속, 워밍 잡(cron), `FmpMarketProvider`/core 변경.

---

## 3. 설계 — 앵커드 2-tier

`1Day && before===undefined && isLongDailyWindow` 경로에서만 적용(가드는 현행 유지). 두 캐시 키 **모두 날짜 없는 심볼-앵커**로 변경한다.

### Tier 1 — history (`bars:eodhist:<SYM>`)
- 불변 과거 일봉. **키에 날짜 없음** → 자정 롤 없음.
- 값: `Bar[]` (fetch 시점 `options.from`부터 `histTo`까지).
- TTL: `EOD_HIST_TTL_SECONDS = SECONDS_PER_DAY * 30` (30일). 갱신은 TTL이 아니라 staleness가 주도.
- **staleness (full-refetch-on-stale)**: 캐시된 최신 봉이 recent 윈도우와 겹치면(`newest.time >= recentFromThreshold`) fresh → 그대로 사용(0 fetch). 아니면 stale → `inner.getBars({ ...options, before: histTo })`로 **전체 재fetch** 후 저장.
  - 겹침 = `EOD_RECENT_FROM_DAYS - EOD_HIST_TO_DAYS`(=5일) → history 재fetch는 **최소 ~5일당 1회**로 수렴(자정마다 X). 5일 겹침은 최대 4일 연속 휴장(공휴일+주말 인접)에도 겹침이 사라지지 않아 per-request 재fetch thrash를 방지한다(감사 반영).

### Tier 2 — live tail (`bars:eodrecent:<SYM>`)
- 최근 ~`EOD_RECENT_FROM_DAYS`일 + 오늘 봉. **키에 날짜 없음** → 자정 롤 없음.
- 값: `inner.getBars({ ...options, from: recentFrom })` (FmpMarketProvider가 `endDate===undefined`일 때 오늘 봉을 quote로 append — 기존 동작).
- TTL: `computeBarsEffectiveTtl('1Day', now, session)` — **장중 60s(live), 장외 다음 개장까지**(밤사이 재fetch 0).

### 병합
`mergeBarsByTime(history, recent)`(기존 재사용, recent 우선 dedup) → `options.from` 기준 슬라이스(`b.time >= fromThreshold`; `from` 없으면 슬라이스 생략)로 단일 `getBars(from)`와 동일 집합 보장.

### 상수 (현행 값 유지)
- `EOD_HIST_TO_DAYS = 5`, `EOD_RECENT_FROM_DAYS = 10`(겹침 5일 — 최대 4일 연속 휴장 tolerant), `EOD_HIST_TTL_SECONDS = SECONDS_PER_DAY * 30`.
- `recentFromThreshold` = `recentFrom`(YYYY-MM-DD) → `Date.parse(recentFrom + 'T00:00:00Z')/1000` (Bar.time은 UTC 자정 unix초).

### `getOrSetCache` 확장 (staleness 지원)
현재 `getOrSetCache(key, ttl, fetcher, shouldCache?)`에 **선택적 5번째 인자 `isFresh?: (cached: T) => boolean`**(기본 `() => true`)를 추가한다:
- 캐시 hit(envelope)이어도 `isFresh(data) === false`면 miss처럼 취급 → fetcher 재호출 + set.
- 기존 호출부 무영향(기본값 always-fresh). Tier 1 history가 이 인자로 겹침-staleness를 표현한다.

### getBars 분기 (요약)
```ts
if (timeframe === '1Day' && before === undefined && isLongDailyWindow(from)) {
  const history = getOrSetCache(
    `bars:eodhist:${SYM}`, EOD_HIST_TTL_SECONDS,
    () => inner.getBars({ ...options, before: histTo }),
    bars => bars.length > 0,                                   // shouldCache
    bars => bars.length > 0 && bars.at(-1)!.time >= recentFromThreshold  // isFresh
  );
  const recent = getOrSetCache(
    `bars:eodrecent:${SYM}`, this.ttl('1Day'),
    () => inner.getBars({ ...options, from: recentFrom }),
    bars => bars.length > 0
  );
  return sliceFrom(mergeBarsByTime(await history, await recent), from);
}
// else: 기존 단일 bars:raw 경로 (인트라데이·짧은 lookback·before 지정)
```

---

## 4. 동작별 호출 (개선)

| 상황 | 현재 | 재설계 |
|---|---|---|
| 밤사이 반복 크롤(같은 심볼) | 자정롤 + 2× full 재fetch | history 캐시 hit + recent 장외 캐시 → **~0** |
| cold 최초 심볼 | 2 (full+recent) | 2 (full+recent), 1회뿐 |
| 새 세션(다음 날) | 심볼당 full 재fetch | recent(작음)만; history는 ~3일당 1회 |
| 인트라데이·짧은 lookback·before 지정 | 단일 경로 | 단일 경로(불변) |

→ 00:00 UTC 자정 스파이크 제거, 밤 크롤은 신규 cold 심볼만 → **호출·egress 동반 감소**.

---

## 5. 에러 처리 (기존 계약 보존)
- `inner.getBars` throw → `getOrSetCache` set 전에 전파(poison 방지). 두 tier 중 하나가 throw하면 `getBars` reject(현행과 동일 실패 의미론).
- 빈 배열은 `shouldCache`(`bars.length>0`)로 미캐싱.
- Redis 미설정/장애 → `getOrSetCache` graceful fallback(inner 직접 호출). `isFresh`도 Redis 경로 안에서만 평가되므로 fallback 시 항상 fetch.

---

## 6. 테스트
- **앵커 키(자정 롤 없음)**: 같은 심볼, 시스템 시각을 하루 넘겨도(`vi.setSystemTime`) history 키 동일 → 재fetch 안 함(fresh면).
- **history staleness**: 캐시 newest >= recentFrom → 0 fetch; newest < recentFrom(겹침 소실) → full 재fetch 1회.
- **recent 세션 TTL**: 장중 60s / 장외 다음 개장까지(open·closed·weekend 시각 고정).
- **merge 동일성**: history+recent 병합·슬라이스가 단일 `getBars(from)`와 동일 집합(겹침/주말 갭 픽스처).
- **cold=2 / repeat=0**: 최초 접근 2 fetch, 재접근(캐시 hit) 0.
- **guard 분기**: 1Day+before 지정, 짧은 lookback, 인트라데이 → 단일 경로.
- **getOrSetCache `isFresh`**: hit이어도 isFresh=false면 refetch+set; 기본값(미지정) 시 기존 동작.
- 시간 의존은 `vi.setSystemTime`로 결정화.

---

## 7. 롤아웃 · 전제 · 고려사항
- **옛 키 orphan(안전)**: v0.32.0의 날짜-포함 키(`bars:eodhist:<SYM>:<from>:<histTo>`, `bars:eodrecent:<SYM>:<recentFrom>`)는 배포 후 아무도 읽지 않는다. TTL(hist 2d, recent 60s/off-hours)로 자연 만료 → 형식 충돌·수동 정리 불필요. 새 앵커 키(`bars:eodhist:<SYM>`, `bars:eodrecent:<SYM>`)는 네임스페이스가 겹치지만 세그먼트 수가 달라 충돌 없음. 롤백 시에도 새 키는 만료되며 무해.
- **앵커 키 전제(불변식)**: `bars:eodhist:<SYM>` 키에서 `from`을 뺄 수 있는 근거는 **모든 long-1Day 호출부가 core `TIMEFRAME_LOOKBACK_DAYS['1Day']`(=730d) 단일 lookback을 공유**하기 때문. 서로 다른 `from`을 쓰는 짧은 lookback은 `isLongDailyWindow` 가드가 단일 경로로 보낸다. core lookback이 바뀌면 이 전제도 함께 갱신(주석 명시).
- **Redis 저장 증가(허용)**: history TTL 2d→30d로 심볼당 히스토리(~수십~110KB)가 더 오래 상주. 절감(호출·egress) 대비 미미. Upstash 용량 여유 내.
- **E2E 무영향**: `getCachedMarketDataProvider`가 E2E에서 raw provider 반환(데코레이터 우회) — 현행과 동일, 이 재설계 미적용.
- **crypto**: `CRYPTO_SESSION`(24/7)도 1Day 분리 경로를 탄다. `computeBarsEffectiveTtl`이 crypto엔 항상 60s(off-hours 없음) 반환 → recent tail이 상시 60s. 정상 동작(심볼-무관 로직).

## 8. 영향 파일
- `src/shared/cache/getOrSetCache.ts` — 선택적 `isFresh` 인자 추가.
- `src/shared/api/market/CachedMarketDataProvider.ts` — `getCachedDailyBars` 재작성(앵커 키, staleness, 슬라이스), 상수/헬퍼(`recentFromThreshold`, `sliceFrom`). 두 tier는 `Promise.all`로 병렬 fetch.
- `src/shared/api/market/mergeBarsByTime.ts` — 재사용(무변경).
- 각 colocated `__tests__` + `getOrSetCache` 테스트.
