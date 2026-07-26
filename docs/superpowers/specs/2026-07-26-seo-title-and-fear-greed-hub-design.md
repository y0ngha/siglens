# SEO 랭킹 회복 — title 수술 + fear-greed 허브

- 작성일: 2026-07-26
- 상태: 설계 승인 대기
- 선행: v0.47.1 (soft 404 제거 + 해외 거래소 접미사 차단) 배포 완료

## 1. 배경 — 측정된 사실만

2026-07-26 GSC 전수 조사 결과다. 추정이 아니라 실측이다.

### 1.1 기술 SEO는 이미 깨끗하다

수동 조치 없음, 보안 문제 없음, HTTPS 아닌 URL 0, 사이트맵 정상(오늘 읽힘, 2,099페이지), 탐색경로 구조화 데이터 오류 0. **기술적 결함을 더 찾는 건 시간 낭비다.**

### 1.2 실적 — 노출과 순위가 함께 나빠졌다

3개월 총계와 28일 총계에서 급락 전 구간을 역산했다.

| 지표 | 4/25~6/26 (63일) | 6/27~7/24 (28일) | 변화 |
| --- | --- | --- | --- |
| 노출 | 28,020 (445/일) | 2,680 (96/일) | −78% |
| 클릭 | 320 (5.1/일) | 87 (3.1/일) | −39% |
| CTR | 1.14% | 3.2% | +181% |
| 평균 게재순위 | 13.0 | 18.7 | 5.7 악화 |

사라진 노출의 평균 순위를 역산하면 **12.4**다(`13.0×28,020 = P×25,340 + 18.7×2,680`). 남은 것(18.7)보다 **좋았다**. 즉 Google이 잘 나가던 롱테일을 스스로 내렸다.

**타임라인 정정**: noindex 화이트리스트 게이트는 v0.36.1(2026-07-08) 배포다. 노출 급락은 6/26~7/1로 **일주일 앞선다**. 게이트는 원인이 아니라 대응이었다. 따라서 화이트리스트를 되돌려도 그 노출은 돌아오지 않는다.

### 1.3 무엇이 랭킹을 만들고 있는가

최근 28일 클릭 상위 10개 중 **8개가 `/[symbol]/fear-greed`**다.

| 페이지 | 클릭 | CTR | 순위 |
| --- | --- | --- | --- |
| `/` | 31 | 63.3% | 3.0 |
| `/SNDK/fear-greed` | 14 | 73.7% | 2.5 |
| `/MSFT/fear-greed` | 8 | 100% | 1.8 |
| `/SOXL/fear-greed` | 6 | 42.9% | 5.7 |
| `/MX`·`/MU`·`/QLD`·`/NVDA`·`/IBM` fear-greed | 각 2 | 33~100% | 2.0~5.7 |

**분량은 랭킹과 무관하다.** fear-greed는 1,741자로 얇은 축인데 2위고, `/congress`(6,912자)·`/options`(6,257자)·`/news`(4,331자)는 클릭이 0에 수렴한다.

갈린 이유는 **탭이 한국어 개념과 매칭되는지**다. `공포 탐욕 지수`는 한국어 헤드 용어라 `{종목} 공포탐욕지수` 롱테일이 볼륨을 상속받는다. `AAPL 의회 거래`를 검색하는 사람은 없다 — 실제 수요는 `미국 의회 의원 주식 매매`처럼 개념 단위다.

### 1.4 두 개의 구조적 공백

**공백 1 — 주식 title에 한국어 회사명이 없다.**

```
/NVDA     NVDA 주가 분석 — 차트와 매매 신호, 지지선·저항선 | Siglens
/BTCUSD   BTCUSD 시세 분석 — 비트코인, Bitcoin USD (BTCUSD) 차트와 매매 신호 | Siglens
```

크립토는 되는데 주식만 누락이다. 메커니즘은 이미 있고 적용만 안 됐다. 한국 사용자는 `엔비디아 주가`로 검색하지 `NVDA 주가`로 검색하지 않는다. 화이트리스트 265종목의 **한국어명 보유율은 264/265(99.6%)** 로, 데이터는 이미 준비돼 있다.

**공백 2 — 헤드 쿼리를 받을 허브가 없다.**

`/fear-greed`는 404다. 265종목 개별 페이지만 있고 이를 묶는 카테고리 페이지가 없어 `공포탐욕지수` 같은 헤드 쿼리를 받을 수 없다.

## 2. 목표와 비목표

**목표**: 비브랜드 쿼리의 평균 게재순위를 회복한다. 측정 지표는 GSC 평균 게재순위(18.7 기준선)와 비브랜드 노출량이다.

**비목표**:

- 백링크 확보 — 소프트웨어가 아니라 아웃리치 영역이다. 외부 링크 3개가 구조적 천장인 건 맞지만 이 스펙의 대상이 아니다.
- 색인 화이트리스트 확대 — §1.2에서 보듯 되돌려도 노출이 안 돌아온다. 콘텐츠 품질이 순위에서 확인된 뒤에 별도로 다룬다.
- Core Web Vitals — CrUX 데이터 부족은 트래픽이 적어서 생긴 **결과**다. 노출이 회복되기 전엔 손댈 수 없다.
- `/congress`·`/options` 허브 — 같은 논리로 가치가 있으나, fear-greed로 허브 가설을 먼저 검증한 뒤 확장한다.

## 3. Part A — title 수술

### 3.1 짧은 제목용 주어 신설

현행 `buildDisplayName`은 `애플, Apple Inc. (AAPL)`(21자 / 23 폭단위)을 만든다. H1·본문에는 맞지만 title에는 길다.

**`src/shared/lib/seo.ts` 안에 `buildTitleSubject(ticker, koreanName?)`를 둔다.**

```
koreanName 있음 → 애플(AAPL)     9 폭단위
koreanName 없음 → AAPL           4 폭단위
```

`entities/ticker`가 아니라 `seo.ts`에 두는 이유: **12개 빌더가 전부 `BuildSymbolSeoOptions`(또는 이를 extends한 타입)를 받고 그 안에 `koreanName`이 이미 있다.** 따라서 호출부 시그니처를 하나도 바꾸지 않고 `seo.ts` 내부에서 완결된다. 별도 모듈에 두면 12개 호출부로 값을 다시 실어 날라야 해서 변경 표면만 넓어진다.

`buildDisplayName`은 건드리지 않는다. 두 함수는 용도가 다르다.

### 3.2 폭 계산과 클램프

SERP에서 한글은 2단위를 차지한다. 현재 `/AAPL` title은 이미 **58 폭단위**로 데스크톱 예산(~58~60)의 경계에 있다. 여기에 한국어명을 더하려면 자리를 만들어야 한다.

`src/shared/lib/seo.ts`에 `clampSeoDescription` 옆으로 추가한다.

```
seoTitleWidth(s)        한글·전각 2, 그 외 1로 가중 합산
clampSeoTitle(t, 55)    초과 시 어절 경계에서 절단
```

상한 55는 예산 58~60에서 안전 여유를 둔 값이다. 이 상한은 **안전망**이지 상시 절단 수단이 아니다 — 정상 템플릿은 §3.3의 3단 조합으로 클램프 없이 통과하고, 클램프는 그마저 넘는 극단적 입력에서만 발동한다.

⚠️ Ambiguous 폭 문자(`·` U+00B7, `—` U+2014, `…` U+2026)는 한국어 로케일 SERP에서 넓게 렌더되지만 이 함수는 1로 센다. `—`와 `·`가 거의 모든 템플릿에 들어가므로 약 2 폭단위 과소 측정이다. 55와 58~60 사이 여유 안에 들어가고 Google의 실제 절단은 픽셀 기준이라 어떤 단위 모델도 근사이므로, 의도적으로 좁게 둔다.

### 3.3 템플릿 12개 통일 — core/tail 3단 조합

> ⚠️ 이 절은 **구현 중 실측으로 재설계됐다.** 초안은 접미사를 한 덩어리 문자열로 뒀는데,
> 실제 한국어명을 측정하니 그 설계가 3분의 1에서 무너졌다.

| 대상 | `seo.ts` 위치 |
| --- | --- |
| 주식 8개 | 322(chart) · 488(financials) · 546(congress) · 602(fundamental) · 678(options) · 729(news) · 793(overall) · 1126(fear-greed) |
| 크립토 4개 | 876(chart) · 936(news) · 999(overall) · 1059(fear-greed) |

**실측(2026-07-26, `asset_translations` 264개 전량)**: 주어 `한국어명(TICKER)`의 폭은
중앙값 14 · 평균 17이지만 꼬리가 길다.

```
47  그래닛셰어스 2배 레버리지 NVDA 데일리 ETF(NVDL)
42  디렉션 데일리 S&P 바이오텍 불 3X ETF(LABU)
36  트럼프 미디어 & 테크놀로지 그룹(DJT)
```

접미사를 한 덩어리(`뉴스 — 호재 분위기와 애널리스트 등급` = 37 폭단위)로 두면 주어 예산이
18뿐이라 **264개 중 90개(34%)가 초과**한다. 그리고 클램프는 뒤에서 자르므로 하필 검색 매칭을
만드는 키워드가 날아간다 — 이 작업의 목적 자체가 무너진다.

그래서 접미사를 둘로 쪼갠다.

- **core** — 매칭을 만드는 키워드. 티커를 줄여서라도 보존한다. 예: `공포 탐욕 지수`
- **tail** — 서술. 예산이 모자라면 가장 먼저 버린다. 예: `0~100 점수와 5단계`

`composeSymbolTitle`이 3단으로 물러난다.

| 단계 | 형태 | 실측 해당 수 |
| --- | --- | --- |
| 1 | `한국어명(TICKER) core — tail` | 174 / 264 |
| 2 | `한국어명(TICKER) core` | 88 / 264 |
| 3 | `TICKER core — tail` (한국어명 폐기) | **2 / 264** (NVDL, LABU) |

**262개가 한국어명을 온전히 유지하고, 264개 전부가 core를 지킨다.**

3단에서 이름을 자르지 않고 **버리는** 이유: NVDL·LABU는 레버리지 ETF라 실제 검색어가 티커다.
중간에서 잘린 `그래닛셰어스 2배 레버…`는 SERP에서 읽히지도 않고 검색어와도 맞지 않는다.

core 문구는 검색 의도를 드러내는 한국어 헤드 용어를 쓴다(`주가 전망`, `공포 탐욕 지수`,
`의회 거래` 등). 최대 core는 `공포 탐욕 지수`의 14 폭단위다.

### 3.4 `| Siglens` 접미사 제거

`symbolMetadataFromSeo`가 `title: { absolute: title }`을 반환하도록 바꾼다. `/backtesting`이 이미 쓰는 패턴이라 새로운 것이 아니다.

브랜드 쿼리 `siglens`는 이미 순위 2.0으로 이겼다. 2,247개 URL의 title 예산을 이미 이긴 용어에 쓰는 건 낭비다.

**OG·Twitter는 `fullTitle`(접미사 포함)을 유지한다.** 소셜 공유 카드에선 브랜드가 유용하고 SERP 폭 제약과 무관하다.

### 3.5 회귀 가드

title 변경은 순위에 즉시 영향을 주지만 되돌리는 데는 재크롤이 필요해 느리다. 다음을 테스트로 고정한다.

- 전 템플릿 × 긴 한국어명(`ASE 테크놀로지 홀딩스`) 조합에서 55 폭단위 이하
- `koreanName` 부재 시 ticker-only로 degrade
- 주식·크립토 대칭성 — 한쪽만 바뀌는 상황이 애초 원인이었다
- `absolute` 반환으로 접미사가 실제로 빠지는지
- OG·Twitter는 접미사를 **유지**하는지

## 4. Part B — fear-greed 허브

### 4.1 데이터 파이프라인

`computeFearGreedIndex`(core 0.39.0)는 200영업일 bars를 입력으로 받는다. 개별 페이지는 `getBarsStatic`으로 서버측 계산을 이미 하고 있다(`src/app/[symbol]/fear-greed/page.tsx:171`).

265종목을 한 렌더에서 계산하는 건 불가능하다. 야간에 미리 계산해 저장한다.

**새 테이블 `fear_greed_snapshots`** — `seo_analysis_snapshots` 패턴을 따른다.

```
symbol      varchar(SYMBOL_MAX_LENGTH)  not null
score       integer                      not null   0~100
label       varchar(16)                  not null   극공포/공포/중립/탐욕/극탐욕
groups      jsonb                        not null   { flow, trend }
confidence  varchar(16)                  not null
computedAt  timestamptz                  not null
updatedAt   timestamptz                  not null default now()

uniqueIndex(symbol)
index(score)   -- 랭킹 정렬용
```

**채우기**: `seo-prewarm` 크론에 fear-greed 계산 단계를 추가한다. 크론은 이미 야간 창(20:30–03:59 UTC)에 전 유니버스를 순회하며 bars 캐시를 예열하므로 **추가 FMP 호출이 사실상 0**이다.

배치 예산 보호를 위해 다음을 지킨다.

- **분석 잡의 poll 루프 밖**에 둔다. 잡 제출·수확이 끝난 심볼에 대해 `getBarsStatic`(캐시 HIT) → `computeFearGreedIndex` → upsert를 수행한다. 외부 대기가 없는 순수 계산이므로 `BATCH_DEADLINE_MS` 예산을 사실상 소비하지 않는다.
- 실패는 **non-fatal**이다. 해당 심볼만 건너뛰고 로그를 남기며, 배치 진행과 `counts.remaining` 계산에 영향을 주지 않는다.
- bars가 캐시에 없어 실제 fetch가 필요한 경우에도 그 심볼은 건너뛴다. 크론이 FMP 호출을 새로 유발해선 안 된다.

### 4.2 라우트

`src/app/fear-greed/page.tsx` — `/market`·`/economy`와 같은 구조(page.tsx + error.tsx + constants.ts).

```
export const revalidate = 86400;   // 24h — 데이터가 야간 1회 갱신되므로 그보다 짧을 이유가 없다
```

**⚠️ 필수 선행 작업**: `src/proxy.ts`의 `RESERVED_FIRST_SEGMENTS`에 `'fear-greed'`를 추가한다. 빠뜨리면 `SYMBOL_EDGE_RE`가 `FEAR-GREED`를 심볼로 인식해 301 → 404가 된다. 현재 `/fear-greed`가 정확히 그 상태다.

### 4.3 콘텐츠 구성

크롤러가 완전한 HTML을 받아야 한다. 전부 서버 렌더다.

1. **H1 + 개요** — 지표가 무엇이고 어떻게 산출되는지
2. **시장 전체 분포** — 5단계별 종목 수 (극공포 n개 / 공포 n개 / …)
3. **랭킹 테이블** — 극공포 Top 20 · 극탐욕 Top 20 · 전체 목록. 각 행이 `/{symbol}/fear-greed`로 링크
4. **해설** — 개별 페이지의 "어떻게 봐야 할까"를 시장 관점으로 재작성. CNN Fear & Greed와의 차이(종목 자체 분포 기반)를 명시

3번이 부수 효과로 내부 링크 문제도 완화한다. 현재 265종목 중 161개(61%)가 내부 링크 0이고 사이트맵으로만 도달 가능한데, 허브가 전부를 링크한다.

### 4.4 구조화 데이터

- **`ItemList`** — 랭킹 테이블. 순위가 있는 목록의 표준 타입이다.
- **`Dataset`** — 일별 0~100 점수, 문서화된 5팩터 방법론. `/economy`·`/backtesting`이 이미 쓰는 패턴이고, Google Dataset Search는 한국 금융 분야 경쟁이 희박하다.

### 4.5 사이트맵

`src/entities/sitemap-entry/lib/buildStaticEntries.ts`에 `/fear-greed`를 추가한다. priority는 `/market`(허브 성격)과 맞춘다.

### 4.6 Degrade

스냅샷이 0행이면 `/economy` 패턴을 그대로 따른다.

```
alternates: { canonical: degraded ? null : FEAR_GREED_URL }
robots:     degraded ? { index: false, follow: true } : undefined
```

`follow: true`를 유지해 링크 주스는 계속 흐르게 한다. 빈 페이지가 색인되는 것만 막는다.

## 5. Part C — 개별 페이지 심화

Part B의 스냅샷 테이블이 생기면 거의 공짜로 얻는 것만 넣는다. 범위를 좁게 유지한다.

- **시장 대비 위치** — "265종목 중 상위 12%" 같은 한 문장. 허브 데이터 재사용이라 추가 계산이 없다.
- **허브로의 링크** — 양방향 연결로 허브 권위를 강화한다.

히스토리 차트·동종업계 비교는 이미 위젯이 존재하지만(`FearGreedHistoricalChart`, `FearGreedComparisonGauges`) **이번 범위에서 제외**한다. 둘 다 클라이언트 렌더라 크롤러에 텍스트를 주지 못해 이 스펙의 목표에 기여하지 않는다.

## 6. 에러 처리

| 실패 지점 | 동작 |
| --- | --- |
| 크론의 fear-greed 계산 실패 | 해당 심볼만 건너뛰고 로그. 배치는 계속 진행 |
| 허브의 스냅샷 read 실패 | 빈 배열로 degrade → noindex + canonical null |
| 스냅샷 0행 | 위와 동일 |
| `koreanName` 부재 | title이 ticker-only로 degrade |
| 개별 페이지의 시장 대비 위치 조회 실패 | 해당 문장만 생략, 페이지는 정상 렌더 |

원칙은 기존과 같다. 부분 실패가 페이지 전체를 깨뜨리지 않고, 불완전한 상태는 색인되지 않는다.

## 7. 테스트

**Part A**

- `seoTitleWidth` — 한글/라틴/혼합 폭 계산
- `clampSeoTitle` — 경계값, 어절 경계 절단
- 템플릿 12개 × 긴 한국어명 → 55 폭단위 이하
- `koreanName` 부재 → ticker-only
- `symbolMetadataFromSeo` → `absolute` 반환, OG는 접미사 유지

**Part B**

- 스냅샷 read 실패 → degrade
- 0행 → noindex + canonical null
- 랭킹 정렬·상위 N 절단
- `ItemList`·`Dataset` JSON-LD 형태
- **proxy 회귀 가드** — `/fear-greed`가 301되지 않는다. 이 가드가 없으면 `RESERVED_FIRST_SEGMENTS` 누락이 조용히 재발한다
- 사이트맵에 `/fear-greed` 포함

**e2e**

- `/fear-greed` → 200 + 랭킹 테이블 렌더 + `index, follow`
- 개별 페이지 → 허브 링크 존재

## 8. 배포 순서

1. Part A 배포 → 2~3주 GSC 평균 게재순위 관찰
2. Part B 배포 → `/fear-greed` 색인·순위 관찰
3. 효과 확인 시 `/congress` 허브와 10개 테마 허브(`TICKER_CATEGORIES`에 한국어 라벨이 이미 있다)로 확장

Part A를 먼저 배포하는 이유는 인과를 분리하기 위해서다. 둘을 동시에 내보내면 어느 쪽이 효과를 냈는지 알 수 없다.

## 9. 위험

| 위험 | 완화 |
| --- | --- |
| title 변경이 2,247 URL에 동시 적용되고 되돌리기가 느리다 | 폭 가드 + degrade 테스트. 근거는 크립토가 이미 증명 |
| 허브가 또 하나의 얇은 페이지가 된다 | 서버 렌더 + 265행 랭킹 + 해설. degrade 시 noindex |
| 크론 배치 예산 초과 | 경량 단계로 분리, 실패 non-fatal. `counts.remaining` 관찰 |
| `RESERVED_FIRST_SEGMENTS` 누락 | 회귀 테스트로 고정 |

## 10. 참고

- 감사 원본 근거: 2026-07-26 GSC 전수 조사 + 코드베이스 SEO 감사
- 선행 배포: v0.47.1 — soft 404 제거로 롱테일 페이지가 봇에 677자만 노출되던 결함이 해소됐다. 이 스펙은 그 위에 얹힌다.
