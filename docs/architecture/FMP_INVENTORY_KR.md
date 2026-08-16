# FMP 데이터 전수조사 & 한국 주식 대응 인벤토리

**작성일**: 2026-08-16
**목적**: 현재 FMP로 받아오는 모든 데이터를 열거하고, 각각을 한국 주식에서 어떻게 조달할지 결론을 고정한다.

조사 방법: `fmpGet`/`fmpGetRaw`/직접 `fetch` 호출부를 코드 전수 검색해 엔드포인트를 추출한 뒤,
각 항목을 `005930.KS`(삼성전자)·`247540.KQ`(에코프로비엠)로 실제 호출해 대체 가능성을 실측했다.

---

## 0. 요약

| 상태 | 개수 | 의미 |
|---|---|---|
| ✅ 구현 완료 | 14 | 이미 한국 종목에서 동작 |
| 🟡 **미구현(가능)** | 3 | **yahoo가 데이터를 주는데 코드가 `null`을 반환 중** |
| 🔑 키 필요 | 5 | 무료 키 발급으로 해결 |
| ⚠️ 대체 불완전 | 5 | 대안은 있으나 품질·형태가 다름 |
| ❌ 원천 부재 | 6 | 한국에 제도·시장 자체가 없음 |

**가장 중요한 발견**: `analyst-estimates`, `earnings`(실적 캘린더/이력)는 **yahoo가 한국 종목에도 데이터를 주는데
현재 구현이 `null`을 반환**하고 있다. 코드만 고치면 되는 순손실이다.

---

## 1. 시세 · 차트

| FMP 엔드포인트 | 기능 | 한국 대응 | 상태 |
|---|---|---|---|
| `quote` | 현재가·등락률 | yahoo `quote()` | ✅ 구현 |
| `historical-price-eod/full` | 일봉 | yahoo `chart(interval:'1d')` | ✅ 구현 |
| `historical-price-eod/light` | 일봉 경량(공포·탐욕) | 동일 | ✅ 구현 |
| `historical-chart/5min\|15min\|30min\|1hour` | 분봉 | yahoo `5m/15m/30m/1h` | ✅ 구현 |
| `historical-chart/4hour` | 4시간봉 | **yahoo interval enum에 없음** | ❌ |

**⚠️ 실측 경고 — 20분 지연**

```
005930.KS  exchangeDataDelayedBy = 20
247540.KQ  exchangeDataDelayedBy = 20
AAPL       exchangeDataDelayedBy = 0
```

미국은 실시간, 한국은 20분 지연이다. 같은 화면에서 신뢰도가 다르므로 UI에 지연 배지가 필요하다.
실시간이 필요하면 KIS(한국투자증권) 실계좌 API가 유일한 경로다.

**데이터 품질 결함**: 일부 KOSDAQ 종목이 `quoteType: MUTUALFUND`로 오분류되고 회사명이 깨져 온다.
실측: `900140.KQ` → `longName = "900140.KQ,0P0000RVWF,493004"`. 어댑터에서 걸러내야 한다.

---

## 2. 펀더멘털

| FMP 엔드포인트 | 기능 | 한국 대응 | 상태 |
|---|---|---|---|
| `profile` | 기업 개요·섹터·시총 | `quoteSummary.assetProfile/price` | ✅ 구현 |
| `key-metrics-ttm` | PER·PBR·PSR·EPS | **파생 계산** (아래 주) | ✅ 구현 |
| `ratios-ttm` | ROE·ROA·마진·유동비율 | `quoteSummary.financialData` | ✅ 구현 |
| `grades-consensus` | 매수/보유/매도 컨센서스 | `recommendationTrend` | ✅ 구현 |
| `price-target-consensus` | 목표주가 고/저/중앙/평균 | `financialData.target*` | ✅ 구현 |
| **`analyst-estimates`** | **EPS·매출 추정치** | **`earningsTrend`** | 🟡 **미구현** |
| `financial-scores` | Altman Z·Piotroski F | yahoo 미제공 | ⚠️ 계산 가능(→core) |
| `stock-peers` | 동종업계 비교 | yahoo 미제공 | ⚠️ 섹터 마스터 필요 |
| `price-target-summary` | 1M/3M/12M 롤링 목표가 | yahoo는 단일 시점만 | ❌ |
| `sector-performance-snapshot` | 섹터별 등락 | `industryTrend` 빈 값 | ⚠️ 대안 있음 |

**PER/PBR 파생 근거**: yahoo는 KRX 종목에 `trailingPE`/`priceToBook`/`trailingEps`를 **주지 않는다**(실측).
`sharesOutstanding`(5,764,191,903)과 `ordinarySharesNumber`(5,792,563,304)가 서로 달라 주식수를 거치면
지표가 흔들리므로, 같은 기준으로 산출된 값끼리 나눈다:

```
PER = marketCap / netIncomeToCommon      → 실측 12.04
PBR = marketCap / stockholdersEquity     → 실측 4.25
```

**🟡 `analyst-estimates` 실측 — 데이터가 있는데 안 쓰고 있다**

```
earningsTrend.trend:
  0q   epsAvg=14,227원   revAvg=208.9조   growth=+6.90%
  +1q  epsAvg=15,443원   revAvg=221.0조   growth=+4.31%
  0y   epsAvg=48,526원   revAvg=732.9조   growth=+6.35%
```

현재 `YahooFundamentalProvider.getAnalystEstimates()`가 `null`을 반환한다. → **수정 대상**

**`sector-performance-snapshot` 대안**: `^KS11`/`^KQ11`/`^KS200` 지수는 조회된다(실측).
업종별 세분화가 필요하면 공공데이터포털 [금융위원회_지수시세정보](https://www.data.go.kr/data/15094807/openapi.do)의
KRX 업종지수를 쓴다.

---

## 3. 재무제표

| FMP 엔드포인트 | 한국 대응 | 상태 |
|---|---|---|
| `income-statement` | yahoo `fundamentalsTimeSeries('financials')` | ✅ 구현 |
| `balance-sheet-statement` | `fundamentalsTimeSeries('balance-sheet')` | ✅ 구현 |
| `cash-flow-statement` | `fundamentalsTimeSeries('cash-flow')` | ✅ 구현 |
| `income-statement-growth` | 인접 회계연도 파생 | ✅ 구현 |
| `financial-growth` | 파생 | ✅ 구현 |
| `cash-flow-statement-growth` | 파생 | ✅ 구현 |
| └ 3Y/5Y/10Y 주당매출 성장률 | 과거 주식수 부정확 | ❌ 제외 |

연간 4개년 + 분기 5~6개 확보. 분기 성장률은 **4행 앞(전년 동기)** 과 비교해 YoY를 유지한다 —
인접 분기와 비교하면 계절성이 성장률로 둔갑한다(반도체 업종에서 특히 왜곡).

정확도가 문제되면 **DART**(`opendart.fss.or.kr/api/fnlttSinglAcntAll.json`, 무료 2만콜/일)로
어댑터만 교체한다. 계정과목 매핑 작업이 크지만 원문 XBRL이라 가장 정확하다.

---

## 4. 실적 발표

| FMP 엔드포인트 | 기능 | 한국 대응 | 상태 |
|---|---|---|---|
| **`earnings`** | **발표 예정일·서프라이즈** | **`calendarEvents` + `earningsHistory`** | 🟡 **미구현** |

**실측 — 여기도 데이터가 있는데 `null`을 반환 중이다**

```
calendarEvents.earnings:
  earningsDate = 2026-10-28   (isEarningsDateEstimate: true)
  earningsAverage = 14,227원   revenueAverage = 208.9조

earningsHistory.history:
  2025-09-30  actual 1,802  est 1,436  surprise +25.5%
  2025-12-31  actual 2,909  est 2,361  surprise +23.2%
  2026-03-31  actual 7,123  est 5,089  surprise +39.9%
```

→ **수정 대상**. 단 `isEarningsDateEstimate: true`는 추정일이므로 UI에 "예정(추정)" 표기가 필요하다.

---

## 5. 뉴스

| FMP 엔드포인트 | 기능 | 한국 대응 | 상태 |
|---|---|---|---|
| `news/stock` | 종목 뉴스 | 네이버 검색 API | 🔑 코드 완료·키 대기 |
| `news/crypto` | 크립토 뉴스 | 한국 무관 | — |
| `news/general-latest` | 시장 뉴스(종합) | 네이버(카테고리 매핑 필요) | ⚠️ |
| `news/stock-latest` | 시장 뉴스(증시) | 동일 | ⚠️ |
| `news/crypto-latest` · `news/forex-latest` | 크립토·외환 | 한국 무관 | — |
| `fmp-articles` | FMP 자체 기사 | 대응 없음 | — |

**네이버 한계**: 제목 + 요약만 제공하고 본문은 없다(본문 크롤링은 약관 위반).
국내 종목의 뉴스 기반 AI 분석은 미국보다 입력이 얕다. 본문이 필요하면 빅카인즈·딥서치 유료 API로 교체.

일 25,000콜, `X-Naver-Client-Id` / `X-Naver-Client-Secret`.

---

## 6. 검색 · 종목 마스터 ← **가장 큰 공백**

| FMP 엔드포인트 | 기능 | 현재 한국 동작 | 상태 |
|---|---|---|---|
| `search-symbol` | 코드 검색 | yahoo `search()` — 6자리 코드만 | ⚠️ |
| `search-name` | 회사명 검색 | **한글·영문 모두 0건** | ❌ |
| `cryptocurrency-list` | 크립토 유니버스 | 한국 무관 | — |

**실측한 현재 동작**

| 입력 | 결과 |
|---|---|
| `005930` | ✅ 삼성전자 |
| `069500` (ETF) | ✅ KODEX 200 |
| `삼성전자` | ❌ 0건 — `korean_tickers` DB에 행이 있어야 하는데, 그 행은 누군가 방문해야 생긴다 |
| `Samsung` | ❌ 0건 — yahoo는 한국 종목 4개를 반환하는데 6자리 게이팅이 버린다 |

yahoo `search()`는 **한글 쿼리를 거부**한다(`BadRequestError: Invalid Search Query`).
따라서 한글 검색은 yahoo로 절대 해결되지 않으며 **자체 종목 마스터가 필수**다.

### 해결책: 공공데이터포털 KRX상장종목정보

```
GET http://apis.data.go.kr/1160100/service/GetKrxListedInfoService/getItemInfo
    ?serviceKey=...&resultType=json&numOfRows=100&pageNo=1&basDt=YYYYMMDD
```

| 항목 | 값 |
|---|---|
| 응답 필드 | 기준일자, **단축코드**, ISIN코드, **시장구분**(KOSPI/KOSDAQ/KONEX), **종목명(한글)**, 법인명 |
| 비용 | 무료 |
| 트래픽 | 개발 10,000콜/일, 운영 100,000콜/일 (활용사례 등록 시 증액) |
| **상업 이용** | **"이용허락범위 제한 없음"** ← 명시 허용 |
| 갱신 | 일 1회 (기준일 다음 영업일 13시 이후) |

**KRX OpenAPI(`data-dbg.krx.co.kr`)보다 이쪽이 낫다** — 상업 이용이 명문화되어 있고 트래픽이 크다.

시드하면 얻는 것:
- 한글 검색 전 종목(~2,700) 커버
- KONEX 지원 (현재 `.KN` 미지원)
- 상장/폐지 동기화 → sitemap 404 방지
- `korean_tickers` 자가 부트스트랩의 닭-달걀 문제 해소

보조: [금융위원회_주식시세정보](https://www.data.go.kr/data/15094808/openapi.do)(15094808)로
일별 시세 백필·교차검증 가능(같은 조건).

---

## 7. 의회 거래 — 원천 부재

| FMP 엔드포인트 | 한국 대응 |
|---|---|
| `house-trades` · `senate-trades` | ❌ 없음 |

미국 STOCK Act에 해당하는 제도가 한국에 없다. 공직자 주식 백지신탁은 관보 PDF로만 공개되며 API가 없다.
`KR_EQUITY_DESCRIPTOR.tabs`에서 제외했고 sitemap·prewarm에서도 뺐다.

---

## 8. 거시경제

| FMP 엔드포인트 | 기능 | 한국 대응 | 상태 |
|---|---|---|---|
| `economic-indicators` | GDP·CPI·실업률 | 한국은행 ECOS OpenAPI | 🔑 |
| `treasury-rates` | 국채 금리 | ECOS 국고채 수익률 | 🔑 |
| `economic-calendar` | 경제 지표 발표 일정 | 대응 없음 | ❌ |

`/economy` 페이지는 현재 미국 전용이다. 한국 거시 탭을 별도로 만들 때만 필요하며,
종목 페이지 기능과는 독립이다. ECOS는 무료(https://ecos.bok.or.kr/api/).

---

## 9. 조치 계획

### 완료 (키 불필요)

1. ✅ **`getAnalystEstimates`** — `earningsTrend` 매핑. 당분기(`0q`) 기준
2. ✅ **`getEarningsReport`/`getEarningsReports`** — `calendarEvents`(예정) + `earningsHistory`(과거) 병합.
   추정 예정일은 `rawPayload.isEstimate`로 구분해 확정 공시처럼 보이지 않게 한다
3. ✅ **검색 게이팅 완화** — 영문 회사명 질의를 yahoo로 보낸다. 한글은 여전히 제외
   (yahoo가 `BadRequestError`로 거부하므로 호출해도 낭비)
4. ✅ **깨진 `longName` 필터** — `displayName.ts`. 판별은 "심볼 뒤에 콤마가 바로 붙음"으로,
   `HPSP Co., Ltd.`처럼 사명이 곧 티커인 종목의 오탐을 피한다
5. ✅ **20분 지연 표기** — `MarketProfileDescriptor.quoteDelayMinutes`로 프로필이 값을 들고,
   `TechnicalFactsSummary`가 "현재가 (20분 지연)"으로 렌더

### 완료 (구현만 — 키 대기)

6. ✅ **공공데이터포털 KRX상장종목정보 클라이언트 + 시드**
   - `src/shared/api/dataGoKr/krxListedInfoClient.ts`, `scripts/seed-kr-listed-names.ts`
   - 실행: `yarn db:seed:kr-names` · 필요: `DATA_GO_KR_SERVICE_KEY`
   - KONEX는 시드에서 제외한다 — yahoo에 KONEX 시세가 없어(실측) 검색에만 뜨고 클릭하면
     404가 나는 죽은 링크가 된다
7. ✅ **네이버 뉴스 클라이언트** — `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET`

키가 없으면 6·7 모두 빈 결과로 degrade하며 앱은 정상 동작한다.

### 보류 (필요성 재검토)

8. `financial-scores` — Altman Z·Piotroski는 재무제표로 계산 가능하나 **계산식은 `siglens-core` 영역**(`SCOPE.md`)
9. `stock-peers` — 6번 시드 후 섹터 분류로 구성 가능
10. `sector-performance-snapshot` — 지수시세정보 API 또는 KRX 업종지수
11. DART 재무제표 전환 — yahoo 정확도 문제가 실제로 관측되면
12. 4시간봉 — 1시간봉 집계로 만들 수 있으나 수요 불명

### 불가

13. `price-target-summary` 롤링 목표가, `economic-calendar`, 의회 거래, KONEX 시세,
    실시간 시세(KIS 실계좌 없이)
