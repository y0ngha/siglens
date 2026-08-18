# 3자산군(미국·한국·암호화폐) 동선 통합 설계

- 날짜: 2026-08-19
- 브랜치: `feat/asset-class-navigation`
- 기준 커밋: `2739fd65` (master, v0.56.0 + PR #744)

---

## 0. 문제

사이트는 미국 주식으로 출발해 암호화폐 → 한국 주식으로 확장됐다. 확장이
**미국 페이지 안쪽**으로 흡수되면서 동선이 어긋났다.

| 증상 | 실제 구조 |
|---|---|
| 암호화폐 뉴스를 보려면 "미국 시장 뉴스 허브"를 거쳐야 한다 | `/news`가 미국 허브인데 그 안에 `crypto` 카테고리가 들어 있다 |
| 시장 공포·탐욕 지수는 미국만 있다 | `/fear-greed`가 SPY/VIX/TLT/HYG/LQD/RSP 고정 |
| 마켓·경제도 미국만 있다 | `/market`, `/economy`가 미국 전용 |
| 홈 히어로 퀵링크 3개가 전부 미국 | `오늘 주목할 종목 / 미국 시장 뉴스 / 미국 경제` |

핵심은 **"자산군이 2차 개념으로 숨어 있다"**는 것이다. 자산군을 1차 축으로 끌어올린다.

---

## 1. 라우팅 원칙

> **미국은 지금 URL을 그대로 둔다. 다른 지역은 `/<region>` 자식으로 붙인다.**

`/market`·`/economy`·`/fear-greed`·`/news/{general,stock,crypto,forex,articles}`는
전부 색인돼 있고 순위를 갖고 있다. 이 URL의 의미를 바꾸면(예: 허브로 전환) 축적된
신호를 버린다. 그래서 **미국 = 기존 URL**을 불변으로 고정하고, 신규 지역만 추가한다.

### 1.1 최종 URL 맵

| 버티컬 | 미국 | 한국 | 암호화폐 |
|---|---|---|---|
| 시장 분석 | `/market` (기존) | `/market/kr` (신설) | — |
| 공포·탐욕 지수 | `/fear-greed` (기존) | `/fear-greed/kr` (신설) | — |
| 뉴스 | `/news/us` (신설 지역 허브)<br>`/news/{general,stock,forex,articles}` (기존) | `/news/kr` (신설) | `/news/crypto` (기존) |
| 경제 | `/economy` (기존) | `/economy/kr` (신설) | — |

`/news`만 예외적으로 **의미가 바뀐다**: 미국 허브 → 3지역 상위 허브.
`/news/us`가 오늘의 `/news` 역할(미국 5개 카테고리 카드)을 그대로 이어받는다.

- `/news`의 기존 유입은 손실이 아니라 한 단계 위로 올라간다 — 여전히 뉴스의
  진입점이고, 카드 클릭 한 번으로 같은 목적지에 닿는다.
- 중복 콘텐츠 방지: `/news`는 **지역 카드 3장만**(각 3줄 프리뷰) 렌더하고 카테고리
  카드는 렌더하지 않는다. `/news/us`가 카테고리 카드를 소유한다.

### 1.2 왜 `/fear-greed/us` 를 만들지 않는가

만들면 `/fear-greed`가 빈 허브가 되거나 `/fear-greed/us`로 301해야 하는데, 둘 다
지금 순위를 가진 URL을 흔든다. 대신 **지역 탭 스트립**을 페이지 상단에 놓아
`/fear-greed` ↔ `/fear-greed/kr`를 상호 링크한다. `/market`·`/economy`도 동일.

UX는 통일되고(어느 페이지에서도 상단 탭으로 지역 전환) URL은 흔들리지 않는다.

### 1.3 암호화폐를 뉴스에만 여는 이유

- **공포·탐욕**: core의 5개 요인이 `longTreasury`/`highYield`/`investmentGrade`를
  요구한다. 암호화폐에는 대응 자산군이 없다. 억지 매핑은 "무슨 지수인지 아무도
  설명할 수 없는 숫자"를 만든다 → 열지 않는다.
- **경제**: 암호화폐에 거시 지표 개념이 없다 → 해당 없음.
- **마켓(섹터 신호)**: 암호화폐 섹터 ETF가 없다. 홈의 `CryptoShowcase`가 이미
  같은 역할을 한다 → 후속 과제.

메뉴에 열지 않는 것은 §5 사용자 지시("수급이 어려우면 메뉴를 개방하지 않는다")를
그대로 적용한 결과다.

---

## 2. 내비게이션 컴포넌트

### 2.1 단일 소스 — `shared/config/assetClassNav.ts`

```ts
export type NavRegionId = 'us' | 'kr' | 'crypto';
export interface NavRegionLink { region: NavRegionId; label: string; href: string }
export interface NavVertical  { id: string; label: string; rootHref: string; regions: readonly NavRegionLink[] }
export const NAV_VERTICALS: readonly NavVertical[]
```

이 배열 하나를 아래 네 표면이 소비한다.

1. `widgets/layout/headerNavItems.ts` → 데스크톱 드롭다운 + 모바일 드로어
2. `widgets/layout/Footer.tsx` → 평탄화된 전체 링크
3. `shared/ui/RegionTabs.tsx` → 페이지 상단 지역 탭
4. `widgets/home/heroQuickLinks.ts` → 홈 퀵링크

**왜 단일 소스인가**: 2026-08 감사에서 헤더와 히어로가 같은 목적지를 다른 라벨로
가리키고 있었고 한쪽만 갱신된 이력이 있다(`heroQuickLinks.ts` 주석). 지역이
버티컬마다 다른(뉴스 3, 나머지 2) 지금은 드리프트 가능성이 더 크다.

### 2.2 헤더 라벨에서 "미국"을 뗀다

| 지금 | 바뀜 |
|---|---|
| 미국 시장 분석 | 시장 분석 ▾ (미국 / 한국) |
| 미국 공포·탐욕 지수 | 공포·탐욕 지수 ▾ (미국 / 한국) |
| 미국 시장 뉴스 | 뉴스 ▾ (미국 / 한국 / 암호화폐) |
| 미국 경제 | 경제 ▾ (미국 / 한국) |

부수 효과로 헤더 폭이 줄어든다. 지금 브레이크포인트가 `lg`(1024px)인 이유가
"미국"이 붙어 폭이 늘어서였으므로(`Header.tsx` 주석), 라벨 축소 후 `md`(768px)
복귀 가능 여부를 실측한다. **실측 전에는 `lg`를 유지한다.**

### 2.3 드롭다운은 DOM에 항상 존재한다

크롤러가 신규 지역 페이지로 가는 앵커를 봐야 한다. 하이드레이션 전에도 링크가
DOM에 있어야 하므로 `hidden` 속성이 아니라 **CSS 가시성**으로만 감춘다.
`prefetch={false}` — 목적지 하나당 진입 경로별 `_rsc` 키가 쌓이는 것을 막는다
(`docs/architecture/CDN_CACHING.md` §1).

a11y: 트리거는 `<button aria-expanded aria-controls>`, 패널은 `role="menu"`,
Esc 닫기 + 포커스 복귀 + 바깥 클릭 닫기. 호버만으로 여는 메뉴는 만들지 않는다
(터치·키보드에서 도달 불가).

---

## 3. 데이터 수급 — 실측 결과

전부 2026-08-18~19에 실제 호출로 확인했다.

### 3.1 한국 뉴스 — 네이버 검색 API ✅

시장 단위 질의가 그대로 동작한다.

```
GET naverapihub.apigw.ntruss.com/search/v1/news?query=코스피 증시&display=5&sort=sim
→ 200, total=1,039,100
```

기존 `NaverNewsClient`는 심볼 단위(`resolveQuery(symbol)`)라 그대로는 못 쓴다.
**시장 단위 질의 상수**를 주입하는 얇은 경로를 추가한다.

- `sort=sim` 고정 — 최신순은 종목명이 스쳐 지나가는 무관 기사를 상위에 올린다
  (기존 클라이언트 주석의 실측 근거 그대로).
- 본문 미제공은 동일 한계. `bodyEn`에 요약이 들어간다.

### 3.2 한국 시장 공포·탐욕 지수 — yahoo ETF ✅ (변동성만 파생)

core는 `MarketFearGreedSeriesKey`를 **의미(semantic)** 로 정의하고 티커 매핑은
소비자 몫이라고 명시한다:

> Keys are intentionally *semantic* rather than ticker symbols: core owns the
> contract, the consumer owns the data source. … a consumer backed by another
> provider is free to map differently as long as the economic meaning holds.

따라서 **core 변경 없이** KR 매핑 테이블만 추가한다.

| core 키 | 미국(기존) | 한국(신규) | 실측 |
|---|---|---|---|
| `sp500` | SPY | `069500.KS` KODEX 200 | 722행 |
| `vix` | ^VIX | **KOSPI 20일 실현변동성(파생)** | ^VKOSPI = `No data found` |
| `longTreasury` | TLT | `439870.KS` KODEX 국고채30년 | 722행 |
| `highYield` | HYG | `136340.KS` KStar 회사채 | 722행 |
| `investmentGrade` | LQD | `148070.KS` KOSEF 국고채10년 | 722행 |
| `equalWeight` | RSP | `252650.KS` KODEX 200 동일가중 | 720행 |

**변동성 파생의 근거.** VKOSPI는 yahoo에 없고(실측 실패), 공공데이터포털
지수시세 서비스는 현재 서비스키로 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`(403)다
— 기존 키는 KRX상장종목정보 서비스에만 등록돼 있다(대조군 200 확인).
그래서 KOSPI 종가에서 **20일 로그수익률 표준편차 × √252**를 산출해 `vix` 슬롯에
넣는다. core의 `volatility` 요인은 "레벨 시리즈의 50일 이동평균 대비 거리를
부호 반전"이므로, 실현변동성 레벨을 넣어도 경제적 의미가 정확히 보존된다.

이 파생은 **지표 계산식(→ core)이 아니라 데이터 소스 적응(→ siglens)**이다.
미국 쪽이 `^GSPC` 대신 SPY를 고른 판단과 같은 층이다
(`marketFearGreedSymbols.ts` 주석: "data-source knowledge belongs to the consumer").
페이지 FAQ에 파생 사실을 명시한다 — 감춘 채 "변동성"이라고만 쓰지 않는다.

**신용 요인 매핑 근거.** 한국에는 유동성 있는 하이일드 ETF가 없다. 회사채(신용위험
있는 쪽) − 국고채10년(무위험)의 스프레드가 `junk_bond` 요인이 측정하는 것과
같은 것(신용 위험선호)을 잡는다. 듀레이션을 맞추려고 국고채**10년**을 골랐다
(회사채 ETF가 중장기물). `longTreasury`는 30년물이라 세 시리즈가 서로 겹치지 않는다.

### 3.3 한국 마켓 — yahoo 지수 + 섹터 ETF ✅

| 항목 | 심볼 | 실측 |
|---|---|---|
| 코스피 | `^KS11` | INDEX, 726행, 20분 지연 |
| 코스닥 | `^KQ11` | INDEX, 726행, 20분 지연 |
| 원/달러 | `KRW=X` | CURRENCY, 777행, 지연 0 |

`^KS200`은 마지막 종가가 2026-07-16로 정체돼 있어 **쓰지 않는다**.

섹터 ETF 6종 — 홈의 `kr-*` 카테고리 6개와 1:1 대응시킨다.

| 섹터 | ETF | 확인된 이름 |
|---|---|---|
| 반도체·IT | `091160.KS` | Kodex Semicon |
| 자동차·2차전지 | `091180.KS` | Kodex Autos |
| 바이오·헬스케어 | `244580.KS` | KODEX Biotech |
| 인터넷·플랫폼 | `266360.KS` | KODEX IT Software |
| 금융·지주 | `091170.KS` | Kodex Banks |
| 코스닥 | `229200.KS` | KODEX KOSDAQ 150 |

신호 스캔 종목은 **기존 `POPULAR_TICKERS` KR 블록 20종 그대로** 쓴다. 새 심볼을
넣으면 한글명 시드·사이트맵 범위·prewarm 회전까지 파생 작업이 붙는데, 그건 이
작업의 목적(동선)과 무관하다. 섹터당 2~5종으로 얇지만 정직하다 — 확장은 후속.

`getMarketSummary(provider, indices, etfs)` / `getSectorSignals(provider, stocks, tf)`
둘 다 provider와 설정을 인자로 받으므로 **core 변경 없이** `YahooMarketProvider`를
주입하면 끝난다.

### 3.4 한국 경제 — FMP economic-calendar ✅ (신규 자격증명 불필요)

FMP 경제 캘린더가 한국을 **완전히** 커버한다(3개월 5,893건 중 KR 88건).
180일 조회 시 KR 94건 / actual 채워진 것 63건. 365일은 플랜 제한(402).

실측된 KR 지표(2026-06~08 actual):

| 카테고리 | 이벤트 | 최근 actual |
|---|---|---|
| 금리 | Interest Rate Decision | 2.75 % |
| 금리 | 3·10·30년 KTB Auction | 3.78 / 4.415 / 4.505 % |
| 물가 | Inflation Rate YoY | 2.8 % |
| 물가 | Producer Price Index YoY | 8.6 % |
| 성장 | GDP Growth Rate YoY / QoQ | 3.7 / 0.6 % |
| 성장 | Industrial Production YoY | 5.8 % |
| 성장 | Exports YoY / Balance of Trade | 62.8 % / 30.32 B |
| 고용 | Unemployment Rate | 2.8 % |
| 심리 | Consumer / Business Confidence | 106.8 / 82 |

DB 스키마 `economic_calendar`는 이미 `country` 컬럼 + `(country, date_et)` 인덱스를
갖고 있다("현재 US만 저장"). **KR 수집을 켜고 읽기에서 country로 가르면 된다.**

한계와 처리:
- 시계열이 180일뿐이라 초기 미니 추세는 월간 지표 기준 5~6포인트다. DB에 누적되면
  자연히 길어진다. **없는 구간을 지어내지 않는다** — 포인트가 부족하면 추세선을 숨긴다.
- 한국은행 ECOS는 별도 키가 필요하고, 공공데이터포털 추가 서비스도 개별 신청이
  필요하다. 지금 키로 되는 범위에서 최대치를 뽑고, 부족분은 후속으로 남긴다.
- 이벤트명 한국어화는 기존 `resolveIndicatorLabels`(사전 → DB 캐시 → AI) 체인을 재사용.

---

## 4. 항목 6 — AI 분석 오류 (원인 규명 완료)

**증상**: localhost:4200 `/economy`의 거시 브리핑이 스켈레톤에서 멈춤.

**근본 원인**: core `BRIEFING_MODEL_ID = 'deepseek-v4-flash'` →
`resolveServerApiKey('deepseek')` → `process.env.DEEPSEEK_API_KEY` 요구 → **로컬
`.env.local`에 없음**(있는 것은 `DEEPSEEK_CHAT_API_KEY`로 이름이 다르다).
`resolveServerApiKey`는 없으면 throw하고, 그 예외가 SSE 경로에서 삼켜져 스켈레톤이
영구 유지됐다.

**프로덕션은 무사하다** — SSM에 `/siglens/DEEPSEEK_API_KEY`가 존재한다(확인).
즉 이 건은 **로컬 환경 변수 누락**이지 코드 결함이 아니다.

**조치**: `.env.local`(메인 레포 + 워크트리)에 SSM 값을 추가. 재현 후 거시 브리핑이
실제 AI 본문(“둔화” 배지 + 5개 불릿 + 생성 시각)으로 렌더되는 것을 크롬으로 확인했다.
`POST /api/analysis/stream 200 in 6.1s`(콜드) → `200 in 216ms`(캐시).

**후속으로 남기는 위험**: 브리핑 계열 4경로(거시/시장/뉴스 다이제스트/경제 이벤트)가
전부 단일 provider 키에 묶여 있고, 키가 없을 때 화면은 무한 스켈레톤이다.
"조용한 실패"를 없애려면 오류 배너로 떨어져야 한다. 본 PR 범위에서 확인만 하고,
UI degrade 개선은 별도 이슈로 뺀다.

---

## 5. 홈 퀵링크 (항목 4)

```
지금:  오늘 주목할 종목 →   미국 시장 뉴스 →   미국 경제 →
바뀜:  미국 시장 →   한국 시장 →   시장 뉴스 →   경제 지표 →
```

앞의 둘은 지역 진입점(`/market`, `/market/kr`), 뒤의 둘은 버티컬 진입점
(`/news`, `/economy`)이다. `NAV_VERTICALS`에서 파생하므로 헤더와 어긋날 수 없다.

---

## 6. SEO 처리

| 사안 | 처리 |
|---|---|
| 신규 5개 URL | `buildStaticEntries`에 추가. `/news/us` 0.8, `/news/kr` 0.8, `/market/kr` 0.9, `/fear-greed/kr` 0.8, `/economy/kr` 0.8 |
| `/news` 의미 변경 | title/description/h1을 3지역 커버리지로 갱신. 구 질의 보존용 키워드(`미국 시장 뉴스`, `미국 마켓 뉴스`)는 `/news/us`가 승계 |
| canonical | 신규 페이지 전부 self-canonical. degrade 시 `canonical: null` + `noindex, follow` — 기존 4개 페이지와 동일 규약 |
| JSON-LD | 각 신규 페이지 WebPage + BreadcrumbList. 지역 계층을 breadcrumb로 명시(`뉴스 허브 > 한국 시장 뉴스`) |
| hreflang | 넣지 않는다. 전 페이지가 `ko`이고 지역은 *다루는 시장*이지 *독자 언어*가 아니다. `hreflang="ko-KR"`을 두 URL에 붙이면 중복 신호가 된다 |
| 자산군 문구 커버리지 | `SUPPORTED_ASSET_TERMS` 테스트가 신규 페이지 카피에도 걸리도록 확장 |

---

## 7. 레이어 배치

```
shared/config/assetClassNav.ts          내비 단일 소스
shared/config/marketFearGreedKr.ts      KR F&G 심볼 테이블 + 실현변동성 파생
shared/config/dashboard-tickers.kr.ts   KR 지수/섹터ETF/신호종목
shared/ui/RegionTabs.tsx                지역 탭 스트립(프레젠테이션)

entities/market-fear-greed/api/…Kr…     KR 뷰 캐시 (yahoo → core compute)
entities/market-news/…                  KR 시장 뉴스 카테고리 config + 수집
entities/economy/api/…Kr…               country=KR 캘린더 리더 + 지표 파생
entities/market-summary|sector-signal   KR provider 주입 변형

widgets/layout/Header*                  드롭다운
app/{market,economy,fear-greed}/kr/     신규 라우트
app/news/{us,kr}/                       신규 라우트
```

`@y0ngha/siglens-core` **변경 없음**. 전부 데이터 소스 매핑·UI·라우팅이라
`docs/architecture/SCOPE.md` §0 기준 siglens 영역이다. 유일한 경계 사안은
`runMarketNewsDigest({ category })`가 core union `NewsFeedCategory`를 요구한다는
점 — 그 값은 core 내부에서 **Redis 캐시 키 스코핑에만** 쓰이고 프롬프트는
`categoryLabel`만 본다(`buildMarketNewsDigestPrompt` 확인). KR 전용 값을 캐스트로
넘기고 근거를 주석으로 고정한다. union 확장은 core 후속 과제로 기록.

---

## 8. 범위 밖(명시)

- 암호화폐 시장 공포·탐욕 지수 / 암호화폐 마켓 페이지
- KR 종목 목록 확장(사이트맵·prewarm 파생 작업 동반)
- ECOS·KOSIS 연동을 통한 KR 거시 시계열 장기화
- 브리핑 실패 시 UI degrade 개선(§4 후속)
- 헤더 브레이크포인트 `lg` → `md` 복귀(실측 후 별도 판단)
