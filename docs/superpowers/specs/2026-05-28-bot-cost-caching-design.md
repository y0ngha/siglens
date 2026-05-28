# 봇 크롤링 비용 절감 — 데이터 레이어 캐싱 복원 설계

- 작성일: 2026-05-28
- 상태: 설계 승인 대기
- 관련: #439(PPR resumable slots), `2026-05-11-bot-redis-trigger-block-design.md`(isBot LLM 게이팅), `2026-05-07-news-card-cache-to-db-design.md`

## 1. 배경 / 문제

실 사용자 대비 서버 비용이 과도하다(Vercel compute/transfer, Upstash Redis, Neon DB, FMP In/Outbound transfer). 크롤러 봇이 다수의 ticker 페이지를 크롤링하면서 비용을 증폭시킨다.

근본 원인은 LLM이 아니다. `isBot()` LLM 게이팅은 이미 분석 액션 전반에 적절히 적용돼 있다. 진짜 누수는 **PPR(cacheComponents)을 #439로 비활성화하면서 `'use cache'` 기반 cross-request 데이터 캐싱이 함께 제거됐고, 그 캐싱이 PPR-독립적 수단으로 복원되지 않은 것**이다. 그 결과 봇 크롤링 1건마다 외부 fetch / DB write가 매번 실행된다.

확인된 비-LLM 누수:

- **bars/OHLCV 무캐싱** — `getBarsAction`이 매 요청 fresh fetch(`'use cache'` 제거됨). `app/[symbol]/layout.tsx`가 6개 탭 전부에서 기본 TF bars를 prefetch하고 `page.tsx`가 추가 TF를 prefetch → 봇이 한 종목의 여러 탭을 크롤링하면 대용량 OHLCV를 수 회 재fetch. **최대 누수.**
- **FMP fundamental 무캐싱** — `shared/api/fmp/httpClient.ts`의 `fmpGet`이 `cache:'no-store'`. fundamental 페이지가 ~14개 FMP 엔드포인트를 매 렌더 재호출.
- **뉴스 fetch + N건 DB upsert 무가드** — `ensureNewsCardsAnalyzedAction`이 봇(`skipAnalysis=true`)에도 FMP 뉴스 fetch + 뉴스 항목 수만큼 Neon upsert를 매 렌더 실행(신선도 가드 없음).

## 2. 제약 / 원칙

- **PPR(cacheComponents)은 못 켠다** (#439, 여러 시도 실패). `htmlLimitedBots: /.*/`는 유지(streaming metadata 대응, PPR과 독립).
- **SEO·서비스 품질 저하 금지.** 봇을 데이터에서 차단하지 않는다. 동일 콘텐츠를 캐시에서 재사용할 뿐 — 콘텐츠 동일, SEO 무해, TTFB 개선으로 오히려 유리.
- 캐싱은 PPR-독립적 수단(Redis, Next Data Cache)으로만 한다.

## 3. 범위

- 포함: (1) bars Redis 캐싱, (2) FMP fundamental fetch 캐싱, (3) 뉴스 freshness guard(봇 경로만).
- 제외: market summary 시세 캐싱 → **siglens-core 별도 작업**으로 확정(`getMarketSummary`는 core use-case, 형제 `getSectorSignals`가 이미 core에서 Redis 캐싱).

## 4. 메커니즘 선택

데이터 레이어 캐싱을 데이터 특성에 맞게 혼합한다.

- bars: **Redis**. TTL이 시장 세션에 따라 동적(개장 중 짧게, 장외엔 다음 개장까지)이라 정적 `revalidate`로 표현 불가.
- fundamentals: **Next Data Cache**(`next:{revalidate}`). 14개 엔드포인트가 URL로 자동 키잉되고 정적 TTL로 충분.
- news: **Redis 플래그**. 핵심이 DB write 중복 차단이라 fetch 캐시로는 불충분.

라우트 레벨 ISR(`revalidate`+`generateStaticParams`)은 compute까지 없애 더 크지만, dynamic API(`headers()`) 사용과 #439 전력상 라우트 렌더링 변경 리스크가 커서 **보류**한다.

## 5. siglens-core 변경 (먼저 진행)

> SCOPE §0: "분석 캐시 TTL → core". 세션-경계 TTL 정책은 core가 소유한다. core는 이미 DST-safe ET 로직 패턴을 보유(`domain/options/expirationSlots.ts`의 `Intl.DateTimeFormat('en-US',{timeZone:'America/New_York'})`), siglens를 import하지 않고 자체 계산한다.

### 5.1 ET 세션 헬퍼 (DST-safe, 신규)

`expirationSlots.ts`의 ET-parts 패턴을 미러링한다.

- `isEtRegularSessionOpen(now): boolean` — 평일 09:30–16:00 ET.
- `secondsUntilNextEtSessionOpen(now): number` — 다음 평일 09:30 ET까지 남은 초. 개장 전(오늘 개장)·개장 후(다음 평일)·금요일 마감→월요일·주말을 처리. 분 단위 해상도(캐시 TTL 용도라 무해).
- 미 증시 휴장일 캘린더는 도입하지 않는다(기존 options/analysis 캐시와 동일). 휴장일엔 개장으로 간주 → 불필요 재fetch 소수 발생하나 stale-into-open 위험 없음.

### 5.2 `computeBarsEffectiveTtl(timeframe, now): number` (신규, `infrastructure/cache/config.ts`)

- 개장 중: `BARS_OPEN_TTL_SECONDS`(= 60초).
- 그 외(장외/주말): `Math.min(BARS_OFFHOURS_TTL_CEILING_SECONDS(= 24h), secondsUntilNextEtSessionOpen(now))`.
- 근거: 마감 후 완성된 봉은 다음 개장까지 변하지 않으므로 "다음 개장 직전"까지 캐시. 모든 timeframe에 균일 적용(장외엔 어느 TF도 새 봉이 형성되지 않음).
- **기존 `computeEffectiveTtl`·`CACHE_EXPIRY_HOUR_KST`·분석 결과 캐시는 변경하지 않는다.**

### 5.3 export + 테스트

- `src/index.ts`에서 `computeBarsEffectiveTtl`(+ 필요한 상수) public export.
- 테스트: 개장 직전/직후 경계, 금요일 마감→월요일, 주말, EDT/EST(서머타임) 전환 시 개장 시각 변동, off-hours 24h 캡.

## 6. siglens 변경 (core 빌드/publish 후)

### 6.1 `src/entities/bars/lib/barsDataCache.ts` (신규)

`optionsDataCache.ts`를 미러링한다.

- `'server-only'`, lazy Redis singleton(동일 패턴), `React.cache`로 요청 내 dedup, Redis 미설정 시 graceful fallback(현재 동작 유지).
- 캐시 키: `bars:<SYMBOL>:<TIMEFRAME>[:<FMPSYMBOL>]` — `fmpSymbol`이 결과를 바꾸므로(예: `^SPX` vs `SPX`) 키에 포함.
- `getCachedBarsWithIndicators(symbol, timeframe, fmpSymbol?)`: Redis get → miss 시 `withRetry(() => fetchBarsWithIndicators(...), BARS_FMP_RETRY)` → 결과가 빈 봉(`bars.length === 0`)이 아니면 `redis.set(key, val, { ex: computeBarsEffectiveTtl(timeframe, new Date()) })`.
- 에러는 캐시하지 않는다(throw가 set 이전에 전파). 빈 결과도 캐시하지 않는다(transient 장애 굳힘 방지 — options의 null-caution과 동일).
- `withRetry`/`BARS_FMP_RETRY` 호출을 캐시 모듈로 이동.

### 6.2 `src/entities/bars/actions/getBarsAction.ts`

- `getCachedBarsWithIndicators`에 위임. 기존 FMP 에러 매핑(`logFmpPaymentRequiredError`, `getFmpUserFacingMessage`)은 액션에 유지.
- `'use server'` 파일은 async function만 export하므로 캐시 헬퍼는 lib 모듈에 둔다(entities 규약).

### 6.3 `src/shared/api/fmp/httpClient.ts` — `fmpGet` (item 2)

- optional `revalidate?: number` 인자 추가. **제공 시** `next:{ revalidate }`, **미제공 시 기존 `cache:'no-store'` 유지**(news/earnings 호출 무회귀).
- `fmpGet`은 `fundamentalClient.ts`(profile/ratios/scores/peers/estimates/grades/consensus/price-target/sector/earnings)와 `fmpNewsClient.ts`에만 쓰여 실시간 시세·bars엔 무관 → 캐싱 안전.
- fundamental 클라이언트만 명시적으로 **3600초(1h)** 전달. `fmpNewsClient`는 미전달(no-store 유지) — 뉴스 비용은 §6.4 봇 가드가 담당. 봇 1회 크롤링당 fundamental 14개 FMP 호출 → TTL당 1회로 수렴.
- Next Data Cache는 cacheComponents OFF여도, dynamic 라우트에서도 동작.

### 6.4 `src/entities/news-article/actions/ensureNewsCardsAnalyzedAction.ts` (item 3) — **봇 경로만 가드**

- Redis 플래그 `news:refresh:<SYMBOL>` TTL **600초(10분)**.
- **가드 체크(early return)는 `skipAnalysis === true`(봇)일 때만**: 플래그가 있으면 FMP 뉴스 fetch + N건 DB upsert를 스킵하고 즉시 return. 봇은 DB의 기존 뉴스를 그대로 읽으므로 SEO 무해.
- **플래그 SET은 성공적 upsert 후 무조건**(봇/사람 무관) — 사람의 fetch도 봇용 플래그를 warm해 다음 봇 크롤링이 스킵되게 한다.
- **사람 경로 동작은 완전 불변** — 항상 fresh fetch + upsert + 미분석 카드 분석.

### 6.5 테스트

- `barsDataCache.test.ts`(신규): Redis hit/miss, get/set 예외 흡수 fallback, 빈 결과 비캐싱, TTL이 `computeBarsEffectiveTtl`에서 옴 — `optionsDataCache.test.ts` 미러링(`'server-only'`/`@upstash/redis` mock, env 토글 `loadWithEnv`).
- `getBarsAction.test.ts`(갱신): `'server-only'`/`@upstash/redis` mock 추가(Redis env unset→fallback), 위임 + 에러 매핑 검증.
- `httpClient`/`fundamentalClient` 테스트: `revalidate` 전달 검증.
- news action 테스트: 봇+플래그→스킵(fetch/upsert 미호출), 봇+무플래그→fetch+upsert+set, 사람→불변.

## 7. 워크플로 / 순서

SCOPE §5 "core → siglens" 준수.

1. core: 헬퍼 + `computeBarsEffectiveTtl` 추가 → export → 테스트 → `yarn build`.
2. core 변경을 siglens에서 쓰려면 로컬 설치/링크 또는 publish + siglens 버전 bump 필요(별도 안내).
3. siglens: 6.1~6.5 적용.

## 8. 비-목표 (YAGNI)

- 미 증시 휴장일 캘린더 도입 안 함.
- 라우트 레벨 ISR/`generateStaticParams` 안 함(#439 리스크).
- market summary 캐싱(core 별도 작업).
- 사람 경로 뉴스 캐싱 안 함(봇 경로만 가드).
- 기존 분석 결과 캐시 TTL/경계 변경 안 함.

## 9. 리스크 / 완화

- **캐시 키 오류로 다른 ticker 데이터 서빙(치명적 품질 버그)** → 키에 symbol+timeframe+fmpSymbol 포함, 단위 테스트로 검증.
- **Redis 장애** → graceful fallback(직행), 기존 동작 유지.
- **DST 경계 오차** → ET-anchored(`America/New_York`) 계산으로 정확. 분 단위 해상도는 캐시 TTL 용도라 무해.
- **core/siglens 버전 불일치** → core publish/bump 순서 준수, siglens는 새 export 존재 확인 후 import.

## 10. 검증

- 양 레포 `yarn typecheck`, `yarn lint`, `yarn test`.
- 가능하면 로컬에서 봇 UA로 동일 ticker의 여러 탭 요청 → Redis 캐시 히트 / FMP 호출 감소 관찰.
