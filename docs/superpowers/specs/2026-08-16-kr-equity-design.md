# 한국 주식(KOSPI/KOSDAQ) 분석 지원 — 설계

**작성일**: 2026-08-16
**상태**: 설계 확정
**범위**: siglens (`kr-equity` marketProfile 신설). siglens-core 변경 없음.

---

## 1. 목표

`/005930.KS` 같은 한국 상장 종목에서 미국 주식과 동등한 분석 경험을 제공한다.
크립토(5탭) 이상, 미국 주식(9탭)에 최대한 근접하는 것이 성공 기준이다.

**비목표**: 실시간 호가/체결, 주문 실행, 파생상품.

---

## 2. 데이터 소스 선정

### 2.1 실측 근거

2026-08-16 `yahoo-finance2`(이미 `package.json`에 존재, 옵션체인이 사용 중)로
`005930.KS`(삼성전자, KOSPI) / `247540.KQ`(에코프로비엠, KOSDAQ) 직접 호출 실측:

| 항목 | 결과 |
|---|---|
| `quote('005930.KS')` | price 274500, currency `KRW`, exchange `KSE`, tz `Asia/Seoul` |
| `quote('247540.KQ')` | price 116700, exchange `KOSDAQ` |
| `chart` 일봉 | 71봉 정상, `gmtoffset` 32400, `currency` KRW |
| `chart` 인트라데이 | `5m`/`15m`/`30m`/`1h` 전부 정상. **`4h`는 yahoo 미지원** |
| `quoteSummary` | marketCap, ROE, 부채비율, 매출, 마진, 목표주가, 애널리스트 의견, 섹터/산업, 사업요약(1528자), 52주 고저 |
| `quoteSummary` 결측 | **`trailingPE` / `priceToBook` / `epsTrailingTwelveMonths` 전부 `undefined`** |
| `fundamentalsTimeSeries` | 연간 4개년 + 분기 5개. `financials` / `balance-sheet` / `cash-flow` 모듈 모두 동작 |
| 재무 필드 | `totalRevenue`, `netIncome`, `basicEPS`, `EBITDA`, `grossProfit`, `operatingIncome`, `stockholdersEquity`, `totalAssets`, `freeCashFlow` — 기존 FMP 스키마와 1:1 매핑 |
| `search('005930')` | `005930.KS` 반환 ✅ |
| `search('삼성전자')` | **`BadRequestError: Invalid Search Query`** — 한글 쿼리 거부 |
| `search(newsCount)` | 한국 종목과 **무관한 미국 일반 뉴스** 반환 — 사용 불가 |
| `quote('^KS11')` / `^KQ11` / `KRW=X` | 전부 정상 (KOSPI 6977.94, KOSDAQ 864.65, 환율 1412) |
| `options('005930.KS')` | 만기 0건 |

### 2.2 확정 매핑

| 기능 | 소스 | API 키 |
|---|---|---|
| 차트(bars), 시세(quote) | `yahoo-finance2` | 불필요 |
| 펀더멘털 | `yahoo-finance2` `quoteSummary` + PER/PBR 파생 계산 | 불필요 |
| 재무제표 | `yahoo-finance2` `fundamentalsTimeSeries` | 불필요 |
| 종목 검색(숫자 코드) | `yahoo-finance2` `search` | 불필요 |
| 종목 검색(한글), 종목 마스터 | KRX Data Marketplace OpenAPI | `KRX_AUTH_KEY` |
| 뉴스 | 네이버 검색 API | `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` |
| 공포·탐욕 | 자체 계산(bars 기반, 기존 로직 재사용) | 불필요 |
| AI 분석 / 챗 / 보유종목 | 기존 core 경로 그대로 | 불필요 |

### 2.3 탈락 후보와 근거

**한국투자증권 KIS Developers — 탈락.**
REST/WebSocket으로 종목별 시세를 주지만 (a) 실계좌 개설이 전제이고 개인 계좌
기반 키의 상업 서비스 이용 약관이 불명확, (b) `EGW00201` 유량 제한(초당 20건)에
맞춘 별도 캐시/큐 레이어가 필요, (c) 액세스 토큰 재발급이 분당 1회로 서버리스
콜드스타트와 상성이 나쁘다. 그 대가로 얻는 것은 **실시간 틱뿐인데, 본 서비스는
분석 서비스라 실시간 호가가 필요 없다.** 일봉·분봉은 yahoo가 이미 제공한다.

**전자공시 OpenDART — 이번 범위에서 제외.**
`fnlttSinglAcntAll.json`으로 원문 XBRL 재무제표를 주고 정확도는 yahoo보다 높지만,
(a) 한국 계정과목 → 기존 도메인 스키마 매핑이 큰 작업이고, (b) `corp_code` ↔ 종목코드
매핑 테이블을 별도로 적재해야 하며, (c) **yahoo `fundamentalsTimeSeries`가 이미 기존
FMP 스키마와 1:1로 맞는 필드를 반환한다.** 정확도 이슈가 실제로 관측되면 그때
`KrFinancialStatementsProvider` 뒤에서 소스만 교체한다(어댑터 경계가 이미 그 지점).

**키움 OpenAPI+ / 대신 CYBOS — 탈락.** Windows 32bit COM. AWS 리눅스 배포 불가.

---

## 3. 심볼 규약

**canonical 심볼 = `005930.KS`(KOSPI) / `247540.KQ`(KOSDAQ).**

접미사를 심볼에 내장하는 이유:

1. **정적 분류가 가능하다.** `/^\d{6}\.K[SQ]$/` 정규식 하나로 DB 조회 없이
   `kr-equity` 판정이 끝난다. 크립토가 `crypto_assets` 멤버십 DB 조회
   (`isCryptoSymbol` + `isCryptoSymbolStatic` + `unstable_cache` 래핑)를 필요로
   하는 것과 대조적으로, 미들웨어·ISR cold-gen·탭 가드 전부가 순수 함수로 끝난다.
2. **yahoo passthrough.** `toProviderSymbol`이 항등 함수가 된다.
3. **미국 티커와 충돌 불가능.** 미국 티커는 첫 글자가 영문 대문자(`TICKER_RE`)다.
4. 거래소(KOSPI/KOSDAQ)가 심볼에서 바로 읽힌다.

### 3.1 `SUFFIX_ALLOWLIST` 충돌 — 별도 정규식으로 분리

`shared/config/ticker.ts`의 `SUFFIX_ALLOWLIST`는 `A`/`B`/`C`/`U`/`W`/`WS`만 허용하는
**미국 dual-class 구분자 전용 화이트리스트**다. 이는 `.L`/`.TO`/`.V`/`.CN` 같은 해외
거래소 접미사가 FMP 402를 유발해 하루 7,400회를 낭비하던 실측 문제를 막기 위해
의도적으로 좁게 유지되는 집합이다(해당 JSDoc 참조).

따라서 `KS`/`KQ`를 이 집합에 **추가하지 않는다.** 대신 독립 정규식을 둔다:

```ts
/** 한국 상장 종목 canonical 형상: 6자리 종목코드 + 거래소 접미사. */
export const KR_SYMBOL_RE = /^\d{6}\.K[SQ]$/;
```

`isAdmissibleSymbolShape`는 기존 미국/크립토 판정에 `KR_SYMBOL_RE` OR를 더한다.
두 규칙은 교집합이 공집합이므로(미국은 영문 시작, 한국은 숫자 6자리 고정) 서로의
동작을 바꾸지 않는다. `SYMBOL_EDGE_RE`(`/^[A-Z0-9][A-Z0-9.-]{0,15}$/`)는 이미
`005930.KS`를 통과시키므로 edge 레이어는 변경이 없다.

### 3.2 URL

`/005930.KS/chart` 형태를 canonical URL로 쓴다. 접미사 없는 `/005930`은 이번
범위에서 다루지 않는다 — KOSPI/KOSDAQ 판정을 위해 DB 조회가 되살아나 3.1의
장점이 사라진다. 필요하면 후속으로 301 redirect만 추가한다.

---

## 4. 아키텍처

### 4.1 marketProfile 확장

`shared/config/marketProfile/types.ts`는 이미 `'kr-equity'`를 예약해 두었다
(`MarketProfileId` JSDoc: *"Korean stocks slot in later as `'kr-equity'`"*).

```ts
MarketProfileId  += 'kr-equity'
MarketRegion     += 'kr'
SessionModel     += 'kr-equity-kst'
PriceFormatConfig.currency: 'USD' → 'USD' | 'KRW'
MarketProfileDescriptor.dataProvider: 'fmp' → 'fmp' | 'yahoo'
searchSource     += 'kr-store'
newsSource       += 'naver'
```

`KR_EQUITY_DESCRIPTOR`:

| 필드 | 값 | 근거 |
|---|---|---|
| `priceFormat` | `{ currency: 'KRW', locale: 'ko-KR', precision: { kind: 'integer' } }` | 원화는 소수점 없음. `PricePrecision`에 `'integer'` 변형이 **이미 존재** |
| `sessionModel` | `'kr-equity-kst'` | |
| `toProviderSymbol` | 항등 | yahoo가 canonical을 그대로 받음 |
| `exchangeWhitelist` | `null` | 접미사가 이미 거래소를 결정 |
| `tabs` | `chart, news, fundamental, financials, fear-greed, overall, position` | options/congress 제외(§4.4) |
| `defaultTimeframe` | `'1Day'` | |
| `allowedTimeframes` | `5Min, 15Min, 30Min, 1Hour, 1Day` | `4Hour`는 yahoo 미지원(§2.1 실측) |
| `seo.aboutNodeType` | `'Corporation'` | 개별 상장기업 |
| `sitemapLastmod` | `'kr-close'` | KST 15:30 종가 기준 |

### 4.2 세션 스펙 — siglens 로컬 정의 (core 변경 불필요)

core의 `MarketSessionSpec`은 **순수 데이터 유니온**이다:

```ts
{ kind: 'always-open' } | { kind: 'scheduled'; timeZone; openMinute; closeMinute; weekendDays }
```

계산 로직이 아니라 시장 메타데이터 값이므로 siglens에서 리터럴로 만들 수 있다.
`SCOPE.md §0`의 core 트리거(지표 계산식·신호 임계값·프롬프트·캐시 정책)에 해당하지
않는다. **core 릴리스를 기다리지 않고 진행한다.**

```ts
// shared/api/market/sessionSpecFor.ts
const KR_EQUITY_SESSION: MarketSessionSpec = {
    kind: 'scheduled',
    timeZone: 'Asia/Seoul',
    openMinute: 540,   // 09:00
    closeMinute: 930,  // 15:30
    weekendDays: [0, 6],
};
```

`sessionSpecFor`의 switch는 exhaustive guard(`const _exhaustive: never`)가 걸려 있어
`SessionModel`에 `'kr-equity-kst'`를 추가하면 **컴파일 에러로 이 지점을 강제**한다.
설계 의도대로 동작하는 안전망이다.

한국 공휴일(설·추석 등)은 `weekendDays`로 표현되지 않는다. 휴장일에는 yahoo가 봉을
반환하지 않으므로 차트는 정상이고, 영향 범위는 캐시 TTL이 장중으로 오판되어 짧아지는
것뿐이다(비용 소폭 증가, 오답 없음). 공휴일 캘린더는 이번 범위 밖으로 둔다.

### 4.3 Provider 라우팅

현재 `getMarketDataProvider()`는 인자 없는 싱글톤이고 FMP 하나만 반환한다.
`getCachedMarketDataProvider(session)`가 `CRYPTO_SESSION` 참조 동일성으로 크립토
싱글톤을 분기하는 기존 패턴을 그대로 확장한다 — `KR_EQUITY_SESSION`도 모듈 레벨
상수이므로 같은 참조 동일성 분기가 성립한다.

```
getCachedMarketDataProvider(session)
  ├─ session === KR_EQUITY_SESSION → CachedMarketDataProvider(YahooMarketProvider, KR_EQUITY_SESSION)
  ├─ session === CRYPTO_SESSION    → CachedMarketDataProvider(FmpMarketProvider,   CRYPTO_SESSION)
  └─ 기본                           → CachedMarketDataProvider(FmpMarketProvider)
```

`YahooMarketProvider`는 `SiglensMarketProvider`(= core `MarketDataProvider` +
`getTodayBar`)를 구현한다. 위치는 `shared/api/yahoo/YahooMarketProvider.ts` —
기존 `shared/api/fmp/` 와 형제. 옵션체인의 `YahooOptionsAdapter`가 이미 검증한
`suppressNotices: ['yahooSurvey']` 설정과 스키마 검증 노이즈 억제를 재사용한다.

시간대 변환은 FMP 어댑터의 ET/DST 계산(`getEtOffsetHours`)이 전혀 필요 없다.
**KST는 DST가 없는 고정 UTC+9**이고, yahoo `chart`는 이미 epoch 기반 `date`를
반환한다. FMP 어댑터 대비 대폭 단순해진다.

### 4.4 탭 매트릭스

| 탭 | kr-equity | 근거 |
|---|---|---|
| chart | ✅ | yahoo (실측) |
| overall (AI 분석) | ✅ | bars만 있으면 core가 처리 |
| position (보유종목) | ✅ | 평단/현재가만 필요 |
| fear-greed | ✅ | bars 기반 자체 계산 |
| fundamental | ✅ | yahoo `quoteSummary` + PER/PBR 파생 |
| financials | ✅ | yahoo `fundamentalsTimeSeries` |
| news | ✅ | 네이버 API (키 필요) |
| **options** | ❌ | 국내 개별주식옵션은 유동성이 사실상 없다. 상장된 것은 KOSPI200 지수옵션이며 개별 종목 페이지에 놓을 대상이 아니다 |
| **congress** | ❌ | 공직자 주식 백지신탁은 관보 PDF로만 공개되며 API가 없다 |

**7/9 탭 확보** — 크립토(5탭)를 넘어선다.

### 4.5 PER / PBR 파생 계산

yahoo는 한국 종목에 `trailingPE` / `priceToBook`를 주지 않는다(§2.1 실측).
어댑터 내부에서 이미 확보한 필드로 채운다:

```
PER = price / basicEPS                                  (basicEPS: financials 모듈)
BPS = stockholdersEquity / sharesOutstanding            (balance-sheet + quote)
PBR = price / BPS
```

이는 **지표 계산식이 아니라 provider 어댑터의 필드 정규화**다 — FMP가 응답으로
주던 필드를 다른 소스로 채우는 것뿐이며, `SCOPE.md`가 core로 보내는 "새 보조지표
추가 / 계산식 변경"에 해당하지 않는다. 분모가 0이거나 결측이면 `undefined`를
반환해 기존 결측 렌더 경로를 그대로 탄다(음수 EPS는 그대로 음수 PER로 노출 —
FMP도 동일하게 동작한다).

### 4.6 검색 — 기존 `korean_tickers` 테이블 재사용

크립토는 `crypto_assets` 테이블 + `DrizzleCryptoAssetRepository` + `cryptoAssetStore`를
새로 만들었지만, **한국 주식은 그럴 필요가 없다.** `korean_tickers` 테이블이 이미
정확히 필요한 형상이다:

```
korean_tickers (symbol PK, korean_name, name, exchange, exchange_full_name, updated_at)
```

`searchTicker`의 한글 분기가 호출하는 `searchByKoreanName`이 그대로 동작한다.
행을 넣기만 하면 "삼성전자" 검색이 공짜로 동작한다.

- **한글 쿼리** → `searchByKoreanName` (기존 경로, 변경 없음)
- **숫자 쿼리**(`005930`) → yahoo `search` (신규 분기)
- **영문 쿼리** → 기존 FMP 경로 유지 (미국 종목)

`koreanEntryToSearchResult`는 `symbol`이 `KR_SYMBOL_RE`에 매칭되면
`marketProfile: 'kr-equity'`를 붙인다 — 정적 판정이므로 DB 왕복이 없다.

시드는 KRX 종목기본정보 API(`stk_isu_base_info`)로 KOSPI/KOSDAQ 전 종목을 하루 1회
적재한다. **키가 없는 동안에도 숫자 코드 검색과 직접 URL 접근은 동작하므로,
`KRX_AUTH_KEY`는 한글 검색 품질을 올리는 증분 기능이지 차단 요소가 아니다.**

### 4.7 뉴스

```
GET https://openapi.naver.com/v1/search/news.json?query=<한글종목명>&display=20&sort=date
Headers: X-Naver-Client-Id, X-Naver-Client-Secret
```

일 25,000콜. 쿼리는 `korean_tickers.korean_name`(없으면 yahoo `longName`)을 쓴다.
응답의 `title`/`description`에 `<b>` 태그와 HTML 엔티티가 섞여 오므로 어댑터에서
제거한다.

**알려진 한계**: 네이버는 제목 + 요약만 주고 본문은 주지 않으며 본문 크롤링은
약관 위반이다. 따라서 kr-equity의 뉴스 기반 AI 분석은 미국 주식보다 입력이 얕다.
본문이 필요해지면 빅카인즈/딥서치 유료 API로 교체한다(어댑터 경계 동일).

두 환경변수가 없으면 뉴스 탭은 빈 상태로 degrade하고 다른 탭은 영향받지 않는다.

---

## 5. 단계 분할

각 단계는 독립 배포 가능하며, 앞 단계가 뒤 단계 없이도 사용자에게 가치를 준다.

| Phase | 내용 | 필요 키 | 상태 |
|---|---|---|---|
| **P1** | marketProfile + 심볼 형상 + 세션 스펙 + `YahooMarketProvider` + 라우팅 → **chart / overall / position / fear-greed 동작** | **없음** | ✅ 완료 |
| **P2** | fundamental + financials 어댑터 (PER/PBR 파생 포함) | 없음 | ✅ 완료 |
| **P3** | 검색 — yahoo 숫자 검색, `getAssetInfo` kr 분기 | 없음 | ✅ 완료 |
| **P4** | 네이버 뉴스 provider | 네이버 | ✅ 코드 완료 (키 대기) |
| **P5** | SEO allowlist / sitemap / prewarm 탭 | 없음 | ✅ 완료 |

**P1~P3·P5가 API 키 0개로 완결된다.** P4는 코드가 들어가 있고 자격증명이 설정되는
즉시 동작한다 — 그 전까지 뉴스 탭만 비고 다른 탭은 영향받지 않는다.

### 구현 중 확정된 사항 (설계와의 차이)

- **KRX 마스터 시드는 불필요해졌다.** 기존 `translateCompanyNames`(Gemini) 경로가
  종목 방문 시 한글명을 만들어 `korean_tickers`에 적재하므로 한글 검색이 자가
  부트스트랩된다(§4.6). KRX 시드는 "첫 방문 전에도 검색되게" 하는 최적화로 격하됐고,
  이번 범위에서 제외했다. `KRX_AUTH_KEY`는 현재 쓰이지 않는다.
- **한국 종목 20개를 `POPULAR_TICKERS`에 등록**했다. 이 목록에 없으면
  `evaluateSymbolIndexability`가 `longtail-default-blocked`로 판정해 noindex가 되고
  sitemap에도 실리지 않는다. 20종목 전부 yahoo quote로 상장 상태를 실증 검증했다.
- **sitemap·prewarm에서 한국 종목의 `congress`를 제외**했다. 그대로 두면 404 URL이
  sitemap에 실리고, 매일 밤 prewarm이 존재하지 않는 탭을 분석하려 시도한다.
- **재무제표 금액 통화가 하드코딩되어 있었다.** `usdFormatter` 싱글턴이
  `StatementTable`/`FinancialTrendChart`/`AxisScoreCard`에 박혀 있어 한국 종목 재무가
  `$333T`로 표시됐다. 통화별 포맷터로 바꾸고 `FinancialsStatements`가 심볼에서
  통화를 유도해 내려보낸다(로케일까지 함께 바꿔야 `₩333조`가 된다 — `en-US`로
  KRW를 포맷하면 `₩333T`가 나온다).

---

## 6. 환경변수

| 변수 | 필수 | 없을 때 동작 |
|---|---|---|
| `NAVER_CLIENT_ID` | 아니오 | 뉴스 탭 빈 상태. 나머지 탭은 정상 |
| `NAVER_CLIENT_SECRET` | 아니오 | 위와 동일 |
| `DATA_GO_KR_SERVICE_KEY` | 아니오 | 한글 종목명 검색이 큐레이션 9종목으로 제한. 코드·영문 검색은 정상 |

`KRX_AUTH_KEY`(KRX Data Marketplace)는 쓰지 않는다 — 공공데이터포털 쪽이 상업 이용을
"이용허락범위 제한 없음"으로 명문화하고 트래픽도 크다(§10).

셋 다 **부재가 크래시를 유발하지 않는다.** DeepSeek 프로바이더 추가 때 겪은
"키 미설정 = startup 크래시" 회귀를 반복하지 않기 위한 명시적 요구사항이다.

---

## 7. 테스트

- `KR_SYMBOL_RE` 경계: `005930.KS` ✅ / `005930.KQ` ✅ / `005930` ❌ / `05930.KS` ❌ / `AAPL.KS` ❌ / `005930.KX` ❌
- `sessionSpecFor('kr-equity')` → `Asia/Seoul` 540~930
- `YahooMarketProvider`: yahoo 응답 fixture → `Bar[]` 매핑, 빈 응답 → `[]`, quote 실패 → `null`
- PER/PBR 파생: EPS 0 / 결측 / 음수 케이스
- 프로필 라우팅: `.KS` 심볼이 FMP가 아닌 yahoo로 가는지
- 탭 가드: kr-equity에서 `/options`, `/congress` → 404
- KRW 정수 포맷: `274500` → `274,500원` (소수점 없음)
- 네이버 어댑터: `<b>` 태그·HTML 엔티티 제거, 키 부재 시 빈 배열

기존 커버리지 목표(`docs/conventions/CONVENTIONS.md`)를 따른다.

---

## 8. 리스크

| 리스크 | 완화 |
|---|---|
| `yahoo-finance2`는 비공식 API — rate limit·스키마가 예고 없이 바뀔 수 있다 | 이미 옵션체인이 프로덕션에서 의존 중이라 **신규 리스크가 아니다.** 기존 Redis 캐시 레이어(`CachedMarketDataProvider`)가 호출량을 흡수한다. provider 인터페이스 뒤에 있어 교체 지점이 1곳 |
| 한국 공휴일 미반영 | 휴장일엔 봉이 없어 차트는 정상. 캐시 TTL만 짧아짐(비용 소폭↑, 오답 없음) |
| 뉴스 본문 부재로 AI 분석 입력이 얕음 | §4.7에 명시. 유료 API 교체 경로 확보 |
| yahoo 재무 데이터 정확도가 DART 원문보다 낮을 수 있음 | provider 어댑터 경계에서 소스만 교체 가능(§2.3) |
| 종목명이 영문으로 표시됨 | `korean_tickers` 시드(P3)로 해결. 그 전까지 영문 노출 |

---

## 9. SCOPE 판정

| 항목 | 소속 | 근거 |
|---|---|---|
| `KR_EQUITY_SESSION` 상수 | siglens | `MarketSessionSpec`은 순수 데이터. 계산식 아님 |
| `YahooMarketProvider` | siglens | SCOPE: *"MarketDataProvider 구현체 — 실제 호출 코드"* → siglens |
| 네이버/KRX 어댑터 | siglens | 동일 |
| PER/PBR 파생 | siglens | provider 필드 정규화(§4.5) |
| 지표 계산·AI 프롬프트 | core (변경 없음) | 시장 무관하게 bars만 받으면 동작 |

**이번 작업에 siglens-core 변경은 없다.**

---

## 10. 2차 실측으로 뒤집힌 결론

초기 설계의 세 판단이 FMP 전수조사(`docs/architecture/FMP_INVENTORY_KR.md`)와
추가 실측에서 틀린 것으로 드러나 수정했다.

### 10.1 "KRX 마스터 시드 불필요" — 철회

§4.6에서 기존 `translateCompanyNames` 경로가 한글 검색을 자가 부트스트랩한다고 판단했으나,
그 경로는 **누군가 그 종목을 이미 방문했을 때만** 행을 만든다. 첫 사용자에게는 검색 결과가
비어 있는 닭-달걀 문제다. yahoo `search`는 한글 질의를 구조적으로 거부하므로
(`BadRequestError: Invalid Search Query`) 자체 마스터 없이는 해결되지 않는다.

**공공데이터포털 KRX상장종목정보**를 채택했다:

```
GET https://apis.data.go.kr/1160100/service/GetKrxListedInfoService/getItemInfo
```

| 항목 | 값 |
|---|---|
| 응답 | 단축코드 · 한글 종목명 · 시장구분 · ISIN · 법인명 |
| 비용 | 무료 (운영 10만 콜/일) |
| 상업 이용 | **"이용허락범위 제한 없음"** — 명문 허용 |

KRX Data Marketplace(`data-dbg.krx.co.kr`)보다 이쪽을 고른 이유가 이 명문화와 트래픽이다.

### 10.2 "KONEX 지원" — 불가로 확정

yahoo에 KONEX 데이터가 없다(2026-08-16 실측: `.KN` 심볼 검색 0건, 후보 코드는 전부
`.KQ`로만 해석됨). `KR_SYMBOL_RE`에 `.KN`을 넣지 않고, 시드에서도 KONEX 행을 버린다 —
검색에는 뜨는데 클릭하면 404가 나는 죽은 링크를 만들지 않기 위해서다.

### 10.3 "analyst-estimates·earnings는 yahoo 미제공" — 오판

`null`을 반환하도록 구현했으나 실측하니 KRX 종목에도 값이 있었다:

| 모듈 | 실측(005930.KS) |
|---|---|
| `earningsTrend` | 당분기 epsAvg 14,227원 / revAvg 208.9조 |
| `calendarEvents` | 예정일 2026-10-28 (`isEarningsDateEstimate: true`) |
| `earningsHistory` | 2026-03-31 실제 7,123 vs 추정 5,089 (+39.9%) |

세 모듈을 `quoteSummary`에 추가하고 매핑했다. 예정일이 yahoo **추정**인 경우
`rawPayload.isEstimate`로 표시해 확정 공시일처럼 렌더되지 않게 한다.

### 10.4 시세 20분 지연 (신규 고지)

`exchangeDataDelayedBy`가 KRX는 20, 미국은 0이다. 같은 화면에서 신뢰도가 다르므로
`MarketProfileDescriptor.quoteDelayMinutes`로 프로필이 값을 들고 UI가 "(20분 지연)"을
표기한다. 실시간이 필요하면 KIS 실계좌 API가 유일한 경로이며, 그 경우 §2.3의
KIS 탈락 근거("실시간은 불필요")를 재검토해야 한다.

### 10.5 깨진 회사명

일부 KRX 종목이 사명 대신 코드 나열을 돌려준다(실측: `900140.KQ` →
`"900140.KQ,0P0000RVWF,493004"`, `quoteType`도 `MUTUALFUND`로 오분류).
`shared/api/yahoo/displayName.ts`가 **심볼 바로 뒤에 콤마가 붙는 형태**만 걸러낸다 —
"콤마 포함"이나 "심볼로 시작"으로 판정하면 `Samsung Electronics Co., Ltd.`나
`HPSP Co., Ltd.` 같은 정상 사명이 함께 버려진다.
