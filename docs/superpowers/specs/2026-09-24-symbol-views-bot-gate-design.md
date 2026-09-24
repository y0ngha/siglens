# 종목 조회수 수집 + 비콘 상호작용 게이트 설계

- 날짜: 2026-09-24
- 브랜치: `feat/symbol-views`
- 범위: siglens 단독 (분석 로직 아님 — 수집·스크립트. `SCOPE.md` core 대상 아님)

## 1. 배경

### 1.1 봇이 방문자 집계를 부풀리고 있다

`visitor_days`(9/11~9/24, UA가 저장된 1,591행) 실측:

| 지표 | KR (354) | KR 외 (1,237 — CN 952) |
|---|---|---|
| 모바일 비율 | 68% | 1.6% |
| 진입 경로 고유 수 | 162 | 1,172 (95%) |
| KST 시간대 | 07시~밤 집중 | 24시간 균등 |
| UA | 다양 (Samsung·Whale·iPhone·Chrome 153) | Mac/Win × Chrome 148·149·150 6종 순환 |

한 방문자가 한 롱테일 종목(`/BNO`, `/NVCT`, `/EMSHF` …)에 떨어지는 패턴 = 사이트 순회
크롤러. `navigator.webdriver`를 숨긴 stealth 헤드리스로 추정 — JS를 실행하므로 비콘
1층 필터(JS 필수)를 통과하고, 정상 브라우저 UA라 `isBot`도 통과한다. 실제 DAU는 KR 기준
하루 20~38명.

### 1.2 인기 목록에 사용자 수요 신호가 없다

`update-popular-tickers.ts`·`update-popular-cryptos.ts`는 FMP 거래량·시총만 본다. 실제
사용자가 찾는 종목이 목록(= sitemap·프리웜·색인 판정의 입력)에 들어갈 경로가 없다.

## 2. 목표 / 비목표

**목표**
1. 상호작용 없는 헤드리스 방문을 비콘 단계에서 걸러낸다 (`visitor_days`와 신규 조회수 모두).
2. 종목별 일자 조회수를 수집한다.
3. 세 스크립트 경로(US·KR·크립토)에서 최근 7일 조회수 상위 종목을 **추가 후보**로 쓴다.

**비목표**
- 조회수가 적은 기존 종목 제거 (sitemap·색인 축소 → SEO 영향. 추후 별도 결정)
- Cloudflare WAF 차단 (인프라 결정. AI 생성 비용 실측 후 별도 판단)
- 순방문자(해시) 기반 집계 (방침 개정 필요 — 조회수 + 임계값으로 결정됨)
- 기존 `visitor_days` 행 소급 정리

## 3. 설계

### 3.1 상호작용 게이트 — `shared/lib/onFirstInteraction.ts`

```ts
/** 첫 신뢰 입력 후 callback 1회 실행. 이미 입력이 있었으면 즉시 실행. 반환값은 해제 함수. */
export function onFirstInteraction(callback: () => void): () => void;
```

- 이벤트: `pointerdown`, `keydown`, `wheel` — `{ capture: true, passive: true }`. 터치는
  `pointerdown`이 덮는다 (iOS 13+), `touchstart` 불필요.
- `event.isTrusted === false`는 무시 (스크립트 `dispatchEvent` 합성 이벤트).
- `scroll` 제외 — 크롤러의 `window.scrollTo`도 발생시킨다. `wheel`은 실제 입력에서만 난다.
- 모듈 레벨 `interacted` 플래그: 한 번 인정되면 이후 호출은 즉시 실행. SPA 내부 이동
  (클릭 = 입력)으로 새 종목 페이지가 마운트되면 조회수 비콘이 바로 나간다.
  테스트는 모듈 상태가 테스트 간에 새므로 `vi.resetModules()` + 동적 import로 격리한다
  (테스트 전용 reset export를 만들지 않는다).
- 해제 함수는 대기 중 리스너를 전부 제거 (effect cleanup용).
- 한계(주석 명시): CDP `Input.dispatch*`로 입력을 흉내 내는 봇은 통과한다. 목표는 현재
  관측된 "렌더만 하고 떠나는" 크롤러.

### 3.2 `VisitorPing` 변경

- 기존 로직(날짜 비교 → `fetch('/api/presence')`)을 `onFirstInteraction` 콜백 안으로 이동.
- effect cleanup에서 해제 함수 호출.
- 서버 `/api/presence`는 무변경.
- `visitor_days` 스키마 JSDoc에 게이트 전환일 기록 — 전환일 전후 DAU는 직접 비교 불가.

### 3.3 조회수 테이블 — `symbol_views_daily`

```ts
export const symbolViewsDaily = pgTable(
    'symbol_views_daily',
    {
        /** KST `YYYY-MM-DD`. */
        date: date('date').notNull(),
        symbol: varchar('symbol', { length: SYMBOL_MAX_LENGTH }).notNull(),
        views: integer('views').notNull().default(1),
    },
    table => [primaryKey({ columns: [table.date, table.symbol] })]
);
```

- 개인 식별 정보 없음 (IP·UA·해시 저장 안 함) → 개인정보처리방침 개정 불필요.
- 보존 90일. 스크립트는 7일만 읽는다. 여유분은 사후 검수용.
- 마이그레이션: `yarn db:generate`로 `drizzle/0037_*.sql` 생성. **운영 적용은 사용자**
  (`.env.local` = 운영 Neon. 구현 중 `db:migrate` 실행 금지).

### 3.4 Entity — `entities/symbol-view`

```
entities/symbol-view/
  api.ts      # 'server-only'. DrizzleSymbolViewRepository
  types.ts    # SymbolViewTally
  index.ts
  __tests__/api.test.ts
```

```ts
export interface SymbolViewTally { readonly symbol: string; readonly views: number }

export interface SymbolViewRepository {
    /** (date, symbol) upsert, views += 1. */
    recordView(date: string, symbol: string): Promise<void>;
    /** cutoffDate 이전 행 삭제. */
    pruneOlderThan(cutoffDate: string): Promise<void>;
    /** fromDate 이후 SUM(views) ≥ minViews, 내림차순. */
    topViewed(fromDate: string, minViews: number): Promise<SymbolViewTally[]>;
}
```

- 쓰기 메서드는 `visitor` entity와 같이 `withRetry(..., NEON_TRANSIENT_RETRY)`.
- upsert: `insert().values({date, symbol}).onConflictDoUpdate({ target: [date, symbol], set: { views: sql\`${views} + 1\` } })`.

### 3.5 라우트 — `POST /api/presence/symbol`

경로는 `presence` 하위 — `analytics`·`track`·`collect`·`view` 계열은 EasyList가 막는다.

순서:
1. `isBot(headers)` → 204.
2. `NODE_ENV !== 'production'` → 204.
3. 본문 JSON `{ symbol: string }` 파싱. 실패·비문자열 → 400.
4. `symbol.toUpperCase()` 후 `isAdmissibleSymbolShape` 불통과 → 400.
5. `recordView(kstDateKey(now), symbol)`. 실패 시 `console.error` 후 204 (화면 무영향).
6. 인스턴스당 KST 하루 1회 `after()`로 `pruneOlderThan(today - 90일)` — `/api/presence`와 동일 패턴.

존재하지 않는 심볼(형상만 맞는 쓰레기)은 저장된다. 임계값 아래에 머물고, 스크립트가 FMP로
검증하므로 무해. 행 수는 90일 보존으로 상한.

### 3.6 클라이언트 — `features/visitor-ping/ui/SymbolViewPing.tsx`

```ts
export function SymbolViewPing({ symbol }: { symbol: string }): null;
```

- `navigator.webdriver` → 종료.
- `onFirstInteraction` 콜백에서: `localStorage['siglens:symbol-views']` =
  `{ date: string; symbols: string[] }`. `date !== today`면 초기화. `symbols`에 있으면 종료.
- `fetch('/api/presence/symbol', { method: 'POST', keepalive: true, body: JSON.stringify({symbol}), headers: {'content-type': 'application/json'}, signal: AbortSignal.timeout(5000) })`.
- 응답 ok일 때만 `symbols`에 추가 저장. `localStorage` 예외는 삼킨다 (VisitorPing과 동일).
- effect deps `[symbol]`. cleanup에서 게이트 해제.
- 마운트 위치: `app/[locale]/[symbol]/layout.tsx`의 `<SymbolLayoutProviders>` 안,
  `notFound()` 판정 통과 뒤 — `<SymbolViewPing symbol={ticker} />` (`ticker` =
  `symbol.toUpperCase()`, 레이아웃이 이미 계산). 없는 종목은 조회수가 쌓이지 않는다.
  탭 이동(같은 종목)에서는 레이아웃이 유지돼 재전송 안 함. 크립토의 soft-404 탭
  (options 등)도 레이아웃은 렌더되므로 집계된다 — 종목 자체는 실재하므로 무해.
- `/ai` 서브앱에는 마운트하지 않는다 (종목 페이지 아님).

### 3.7 스크립트 공통 — 후보 선정

순수 함수 (스크립트 옆 `scripts/lib/visitCandidates.ts`, 테스트 동반):

```ts
export type AssetClass = 'us' | 'kr' | 'crypto';

export const VISIT_LOOKBACK_DAYS = 7;
export const MIN_WEEKLY_VIEWS = 3;
export const MAX_VISIT_CANDIDATES_PER_CLASS = 5;

export function classifyVisitSymbol(symbol: string, cryptoSymbols: ReadonlySet<string>): AssetClass;
//  /\.K[SQ]$/ → 'kr', cryptoSymbols.has → 'crypto', 그 외 'us'

export function selectVisitCandidates(
    tallies: readonly SymbolViewTally[],
    assetClass: AssetClass,
    existing: ReadonlySet<string>,
    classify: (symbol: string) => AssetClass
): SymbolViewTally[];
//  classify === assetClass && !existing.has → views 내림차순 → 상위 MAX_VISIT_CANDIDATES_PER_CLASS
//  (views를 같이 돌려줘 콘솔에 근거로 출력한다)
```

- DB 조회는 `DrizzleSymbolViewRepository.topViewed(kstDateKeyDaysBefore(today, 7), MIN_WEEKLY_VIEWS)`.
- `existing` 집합은 자산군별로 따로 만든다. **기존 `extractExistingTickers`는 KR 심볼을
  못 본다** — 정규식이 `[A-Z]`로 시작해 `005930.KS`가 빠진다. KR 기존 집합은
  `POPULAR_TICKERS` 선언 이후 구간에서 `/['"](\d{6}\.K[SQ])['"]/g`로 따로 추출한다.
- `server-only` 통과를 위해 두 스크립트 명령을
  `NODE_OPTIONS=--conditions=react-server dotenv -e .env.local -- node_modules/.bin/tsx ...`로 변경
  (`db:seed:terms`와 동일 방식). DB 접근은 SELECT만. `react-server` 조건이 스크립트의 기존
  import(`yahoo-finance2` 등) 해석을 바꾸지 않는지 구현 시 import 스모크로 확인
  (`main`은 `require.main === module` 가드라 import만으로는 실행되지 않는다).
  vitest는 `server-only`를 스텁으로 alias하므로 기존 스크립트 테스트는 영향 없음.
- DB 조회 실패 시 경고 출력 후 방문 후보 없이 기존 흐름 계속 (스크립트의 주 기능을 막지 않음).
- 방문 후보는 기존 거래량·시총 후보와 **별도 할당** — 기존 `MAX_NEW_TICKERS`를 잠식하지 않는다.
- 콘솔에 방문 후보별 `views`와 필터 탈락 사유를 출력 — 사람이 diff 검토 시 판단 근거.

`ponytail:` 주석: 비콘은 인증이 없어 curl 반복으로 부풀릴 수 있다. 방어선은 시장 필터 +
사람의 diff 검토. 조작이 관측되면 Redis `SET NX`로 (IP 해시, 심볼, 날짜) 중복 제거 추가.

### 3.8 US — `update-popular-tickers.ts`

- 방문 후보(US) 각각 FMP `profile`(가격·시총·ETF 여부·거래 활성)과 기존 `fetchEodBars`로 검사.
- 필터: 가격 ≥ `MIN_PRICE`(5), 시총 ≥ `SCREENER_MIN_MARKET_CAP`(2B), 최대 일간 등락
  ≤ `MAX_DAILY_CHANGE_PCT`(20), `EXCLUDED_TICKERS` 아님, ETF는 `--include-etf`일 때만.
  거래량 기준(`SCREENER_MIN_VOLUME`)은 적용하지 않는다 — 수요 신호가 이미 조회수다.
- 통과 심볼은 거래량 후보와 합쳐 같은 날짜의 `insertTrendingSection` 한 번으로 삽입.

### 3.9 KR — `update-popular-tickers.ts` + 새 카테고리 `kr-trending`

KR 불변식: `POPULAR_TICKERS`의 KR 심볼 집합 = `KR_CATEGORY_IDS` 카테고리 합집합
(`popular-tickers.test.ts`가 검사). 홈 그리드가 한국 종목 페이지로 가는 유일한 크롤 가능
링크이기 때문.

**정적 변경 (1회)** — 카테고리 **객체는 넣지 않는다**
- `popular-tickers.test.ts`가 모든 카테고리의 `items.length > 0`을 검사한다. 빈
  `kr-trending`을 미리 두면 그 테스트가 깨지고, 빈 카드 렌더도 따로 막아야 한다. 그래서
  카테고리 객체는 스크립트가 첫 KR 후보를 넣을 때 생성한다. 정적으로는 타입·표시만 준비:
- `CategoryId` 유니온에 `'kr-trending'` 추가 (`shared/lib/types.ts`).
- `KR_CATEGORY_IDS`에 `'kr-trending'` 추가 (없는 id가 집합에 있어도 무해 — `has` 판정만 한다).
- `widgets/home/TickerCategories.tsx`의 `CATEGORY_STYLES`(`Record<CategoryId, …>`)에 스타일.
- `shared/config/tickerCategoryLabel.ts`의 `TICKER_CATEGORY_LABEL_KEY`·
  `TICKER_CATEGORY_DESCRIPTION_KEY`에 `'관심 급상승'` 키, `messages/{ko,en,ja,zh}.json`에
  라벨·설명 (`categoryDescriptionCoverage.test.ts`가 검사).
- `shared/config/relatedSymbols.ts`의 `THEME_GROUPS`에서 `kr-trending` 제외. 이 카테고리는
  업종이 아니라 수요 묶음이라, 넣으면 서로 무관한 종목이 "관련 종목" 칩으로 연결된다.
  (`internalLinksArePrewarmed` 가드는 영향 없음 — 제외는 링크를 줄이는 방향.)

**스크립트 동작**
- 방문 후보(KR) 각각:
  1. `korean_tickers`에서 `delisted_at IS NULL`인 행 조회. 없으면 탈락.
  2. 한글명 = `CANONICAL_KOREAN_NAMES.get(symbol) ?? korean_name`
     (`canonical-korean-names.test.ts`가 홈 카드 이름 ≠ 정규명을 잡는다).
  3. 시총 필터: 스크립트가 이미 쓰는 `yahoo-finance2` quote의 `marketCap`(KRW) ≥
     `MIN_VISIT_KR_MARKET_CAP_KRW`(1조). KR 후보는 곧 sitemap·색인 판정·프리웜 대상이
     되므로 소형주 롱테일 재개방을 막는다 (US의 $2B 기준에 대응). quote 실패 시 탈락.
- 통과 항목을 두 곳에 삽입:
  1. `TICKER_CATEGORIES`: `kr-trending` 객체가 있으면 `items` 끝에
     `{ symbol: '…', name: '…' },` 추가, 없으면 배열 끝(`];` 직전)에 카테고리 객체 생성.
  2. `POPULAR_TICKERS`: KR 블록의 마지막 KR 심볼 줄 뒤에 `'…', // 한글명`.
     KR 블록 뒤에 US Trending 섹션이 이어지므로 배열 끝이 아니다.
- 텍스트 편집 함수 `insertKrTrendingItems(content, items)`: 앵커 문자열 기반, 앵커 부재 시
  throw (라인 번호 슬라이싱 금지). 이미 있는 심볼은 건너뛴다(멱등). 순수 함수로 테스트.
- 기존 원자적 쓰기(`commitArtifactPairAtomically`) 경로를 그대로 탄다.

### 3.10 크립토 — `update-popular-cryptos.ts`

- 방문 후보(crypto) = `classifyVisitSymbol`에서 `cryptoSymbols`(`crypto_assets` 테이블
  심볼 집합 — US 스크립트와 같은 로더 `scripts/lib/visitSources.ts`) 기준. 상장 여부는 이미
  받아오는 FMP `cryptocurrency-list`로 `filterValidCandidates`가 판정.
- 필터: 스테이블코인 아님(`STABLECOINS`, `USD` 접미사 제거 후 비교), 단건 quote 시총 ≥
  `MIN_VISIT_CRYPTO_MARKET_CAP`($1B).
- 통과 심볼은 시총 상위 신규 심볼과 합쳐 같은 날짜 Trending 섹션에 삽입.
- US 스크립트도 같은 `cryptoSymbols`로 크립토를 US 후보에서 제외한다 (FMP 호출 추가 없음).

## 4. 오류 처리 요약

| 지점 | 실패 | 동작 |
|---|---|---|
| 비콘 fetch | 차단·타임아웃·비ok | 삼킴. `localStorage` 미기록 → 다음 로드에 재시도 |
| `/api/presence/symbol` DB | 예외 | `console.error` + 204 |
| 라우트 본문 | 파싱·형상 불량 | 400 |
| 스크립트 DB 조회 | 예외 | 경고 후 방문 후보 0으로 진행 |
| 스크립트 FMP 검증 | 개별 실패 | 해당 후보만 탈락, 사유 출력 |
| KR 텍스트 앵커 | 부재 | throw — 파일 무변경 (원자적 쓰기 이전 단계) |

## 5. 테스트

- `onFirstInteraction`: trusted 이벤트 1회 실행 / untrusted 무시 / 이미 입력 후 즉시 실행 /
  해제 후 미실행 / 리스너 전부 제거.
- `VisitorPing`: 입력 전 fetch 없음, 입력 후 1회.
- `SymbolViewPing`: 입력 후 전송, 같은 날 같은 심볼 재전송 없음, 날짜 바뀌면 초기화, 비ok면 미기록.
- 라우트: 봇 204, 비프로덕션 204, 잘못된 본문 400, 형상 불량 400, 정상 시 `recordView` 인자
  (소문자 입력 → 대문자), DB 실패 204.
- Repository: upsert가 `views + 1` 충돌 갱신을 쓰는지, `topViewed`의 `HAVING` 임계값.
- `selectVisitCandidates`·`classifyVisitSymbol`: 임계값·기존 제외·자산군 분리·개수 상한.
- `insertKrTrendingItems`: 카테고리 부재 시 생성 / 존재 시 items 추가, `POPULAR_TICKERS` KR
  블록 끝 삽입(US Trending 섹션 앞), 중복 무시, 앵커 부재 throw. 실제
  `popular-tickers.ts` 원문에 적용한 결과로 KR 합집합 불변식을 검사 (손으로 만든 픽스처 금지).
- KR 기존 집합 추출: `005930.KS` 포함, US 심볼 미포함.
- `relatedSymbols`: `kr-trending` 항목끼리 피어로 묶이지 않음.
- 테스트 fetch 스파이는 거부 구현 지정 (실제 호출 유출 방지).

## 6. 배포 후 판정

- 배포 +3일 `visitor_days`: KR 외 데스크톱 Chrome 148~150 행이 ≈0, KR 행은 전환 전 대비 대부분
  유지 → 게이트 성공.
- `symbol_views_daily`: KR 외 롱테일 1회성 행이 소수, 인기 종목에 조회 집중 → 수집 정상.
- 첫 스크립트 실행 결과의 방문 후보 목록을 사람이 검토 후 커밋.

## 7. 비용 영향

`POPULAR_TICKERS`·`POPULAR_CRYPTOS`는 프리웜 유니버스(`runPrewarmBatch`)의 입력이다.
방문 후보는 실행당 최대 15종(자산군별 5) 추가 → 야간 프리웜 LLM 호출이 그만큼 영구 증가
(목록은 append-only). 스크립트 종료 로그에 자산군별 추가 수와 목록 총 크기를 출력해
사람이 커밋 전에 본다.

## 8. 사용자 몫

- 마이그레이션 `0037` 운영 적용.
- 게이트 배포 후 DAU 불연속 수용.
- 스크립트 실행 결과 diff 검토·커밋.
