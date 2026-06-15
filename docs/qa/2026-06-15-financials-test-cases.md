# Financials 탭 — QA Test-Case Sheet (배포 전 실증)

> 대상: `/[symbol]/financials` 신규 탭 (PR #592, `feat/financials`)
> 기준 Spec: [`2026-06-15-financials-pre-deploy-qa-spec.md`](./2026-06-15-financials-pre-deploy-qa-spec.md)
> 작성일: 2026-06-15
> 목적: **수동 실증 QA** (curl + Chrome). E2E/단위 테스트가 커버하더라도 prod-like 빌드/실행에서 동작·SEO를 두 트랙으로 검증한다.
> 가정: dev/prod 서버가 `http://localhost:4200`에서 기동. curl 예시의 `BASE`는 `http://localhost:4200`.

---

## 0. 실행 전 준비 (Preconditions — 모든 케이스 공통)

- prod-like 빌드: `> /tmp/build.log 2>&1; echo $?` 로 exit code 직접 캡처 (파이프 금지). exit 0 확인.
- 워크트리 `node_modules`는 symlink 금지 (`cp -al` 하드링크 또는 독립 `yarn install`). `siglens-core` 0.22.0 핀 일치.
- `.env.local` / `.env.production` 키셋이 형제 워크트리와 일치 (QA env 스왑 복원 누락 주의).
- 서버 기동: `yarn build` → `yarn start`(prod 모드) 또는 `yarn dev`.
- **AI 분석 트랙 주의**: prod-like(`E2E_TEST` 미설정) 서버에서 AI 분석은 실제 LLM/worker를 거친다 — submit→poll(10s 간격, `ANALYSIS_POLL_INTERVAL_MS=10000`)→done. 결정적 fixture가 필요하면 `E2E_TEST=1` 서버를 별도 기동(FakeFinancialStatementsProvider + e2eCachedFinancials 스텁). 두 모드를 케이스별로 명시한다.
- 환경 변수 참고: `NEXT_PUBLIC_SITE_URL` 미설정 시 SEO URL은 `https://siglens.io` 기본값을 쓴다 → 로컬 메타의 canonical/og:url은 `https://siglens.io/...`로 박힐 수 있음(정상). 호스트 부분이 아니라 path/구조를 검증한다.

### 참고 상수 (검증 기준값)

| 항목 | 값 |
|---|---|
| `revalidate` (page) | `86400` (24h), `generateStaticParams = []` (on-demand ISR) |
| OG 이미지 | `dynamic='force-static'`, `revalidate=2592000`(30d), `image/png`, alt=`Siglens 미국 주식 재무제표` |
| `VALID_TICKER_RE` | `/^[A-Z][A-Z.-]{0,7}$/` (1~8자, 첫 글자 A–Z, 이후 A–Z/`.`/`-`) |
| AI 봇 정규식 | `AI_BOT_RE = /GPTBot\|ClaudeBot\|Claude-User\|Claude-SearchBot\|Google-CloudVertexBot\|Gemini-Deep-Research/i` |
| 분석 query key | `['financials-analysis', SYMBOL, modelId]` |
| 캐시 키(Redis) | `financials:<type>:<SYM>:<period>` (예 `financials:income:AAPL:annual`) |
| 캐시 키(Next data) | `['financials:income', SYMBOL, period]` … (6종) + tag `financials:${SYM}`, `symbol:${SYM}` |
| `ANNUAL_LIMIT` / `QUARTER_LIMIT` | 5 / 8 |
| 페이지 h1 | `{SYMBOL} 재무제표` (정상) / `{displayName} 재무제표` (degraded) |
| 스코어카드 축 라벨 | growth=성장성, quality=수익성·질, solvency=안정성, cash=현금창출력 |
| EmptySectionCard 메시지 | `데이터를 불러올 수 없습니다.` |
| Degraded 문구 | `재무 데이터를 일시적으로 불러올 수 없어요` |

---

## A. CURL 트랙 (응답값 / Status Code)

### TC-C01 — 정상 페이지 렌더 (AAPL)
- **ID**: TC-C01 · **Track**: curl · **Priority**: P0
- **Title**: `GET /AAPL/financials` 200 + h1 텍스트
- **Preconditions**: 서버 기동, AAPL profile 가용
- **Steps**:
  ```bash
  curl -s -o /tmp/aapl-fin.html -w "%{http_code}\n" "$BASE/AAPL/financials"
  grep -o "AAPL 재무제표" /tmp/aapl-fin.html | head -1
  grep -o "재무 종합 점수" /tmp/aapl-fin.html | head -1
  ```
- **Expected**: HTTP 200. HTML에 `<h1>...AAPL 재무제표</h1>` 포함, 스코어카드 섹션 제목 `재무 종합 점수` SSR 포함. 손익/재무상태/현금흐름 섹션 제목(`손익계산서`, `재무상태표`, `현금흐름표`)도 SSR로 존재.

### TC-C02 — JSON-LD 3종
- **ID**: TC-C02 · **Track**: curl · **Priority**: P0
- **Title**: WebPage·BreadcrumbList·FAQPage 구조화 데이터 존재 + 유효 JSON
- **Preconditions**: TC-C01 통과
- **Steps**:
  ```bash
  curl -s "$BASE/AAPL/financials" \
   | grep -o '"@type":"WebPage"\|"@type":"BreadcrumbList"\|"@type":"FAQPage"'
  # 각 <script type="application/ld+json"> 블록을 추출해 jq 로 파싱 가능 여부 확인
  ```
- **Expected**: 3개 `<script type="application/ld+json">` 존재 — `@type` WebPage, BreadcrumbList, FAQPage 각 1개. 모두 valid JSON. FAQPage `mainEntity`에 3개 Question(재무 건전성/성장 추세/현금 창출력). BreadcrumbList 첫 item=`Siglens`(position 1), 마지막=`재무제표`.

### TC-C03 — `<head>` 메타 (canonical / OG / twitter)
- **ID**: TC-C03 · **Track**: curl · **Priority**: P0
- **Title**: canonical·og:title·og:url·twitter card 정합
- **Preconditions**: 없음
- **Steps**:
  ```bash
  curl -s "$BASE/AAPL/financials" \
   | grep -o '<link rel="canonical"[^>]*>\|og:title[^>]*>\|og:url[^>]*>\|twitter:card[^>]*>'
  ```
- **Expected**: canonical = `${SITE_URL}/AAPL/financials`. og:title 포함 `AAPL 재무제표 — 매출·이익·현금흐름 5년 추이 | Siglens`. og:url = canonical. og:type=website, og:locale=ko_KR, og:siteName=Siglens. twitter:card=`summary_large_image`. title 태그 = `AAPL 재무제표 — 매출·이익·현금흐름 5년 추이`.

### TC-C04 — OG / Twitter 이미지
- **ID**: TC-C04 · **Track**: curl · **Priority**: P1
- **Title**: 동적 OG·Twitter 이미지 200 + image/png
- **Preconditions**: 없음
- **Steps**:
  ```bash
  curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "$BASE/AAPL/financials/opengraph-image"
  curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "$BASE/AAPL/financials/twitter-image"
  ```
- **Expected**: 둘 다 200, `content_type: image/png`. (캐시: force-static, 30d — 두 번째 호출도 동일.)

### TC-C05 — 봇 UA → AI 분석 미트리거, 페이지 200
- **ID**: TC-C05 · **Track**: curl · **Priority**: P0
- **Title**: AI 봇 User-Agent 요청 시 페이지 자체는 200(SSR 정상), AI 분석 잡 미트리거 경로
- **Preconditions**: prod-like(`E2E_TEST` 미설정) 서버
- **Steps**:
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" -H "User-Agent: ClaudeBot/1.0" "$BASE/AAPL/financials"
  curl -s -o /dev/null -w "%{http_code}\n" -H "User-Agent: GPTBot/1.0" "$BASE/AAPL/financials"
  ```
- **Expected**: 둘 다 200. 페이지 SSR(스코어카드/명세표)는 정상. AI 요약은 클라 트리거라 SSR HTML에는 결과 없음(스켈레톤만). 봇으로 클라 submit 시 `skipEnqueueIfMiss=true` → core `miss_no_trigger` → BotBlockedNotice 경로 (Chrome TC-B05c에서 시각 검증).

### TC-C06 — 잘못된 심볼 처리
- **ID**: TC-C06 · **Track**: curl · **Priority**: P0
- **Title**: 정규식 위반/미존재 심볼 → 404 또는 graceful, 500 없음
- **Preconditions**: 없음
- **Steps**:
  ```bash
  # 정규식 위반(9자) → notFound() → 404
  curl -s -o /dev/null -w "%{http_code}\n" "$BASE/ZZZZINVALID/financials"
  # 소문자(정규식 통과 안 함은 대문자화 후 검사) — 라우트는 upper() 후 검사
  curl -s -o /dev/null -w "%{http_code}\n" "$BASE/123/financials"          # 숫자 시작 → 404
  # 형식은 valid하나 미존재(FMP 200 + empty) → profile===null → 404
  curl -s -o /dev/null -w "%{http_code}\n" "$BASE/ZXQW/financials"
  ```
- **Expected**: `ZZZZINVALID`(9자) → 404, `123`(숫자 시작) → 404. 미존재 valid-format 심볼 → 404(`notFound`). **어떤 경우에도 500 없음.** 잘못된 심볼 메타는 noindex(`robots: index:false`, canonical null).

### TC-C07 — sitemap 포함
- **ID**: TC-C07 · **Track**: curl · **Priority**: P1
- **Title**: 인기 종목 `/financials` URL이 popular sub-sitemap에 포함
- **Preconditions**: 없음
- **Steps**:
  ```bash
  curl -s "$BASE/sitemap.xml" | grep -o "sitemap-popular.xml"        # 인덱스에 popular 포함
  curl -s "$BASE/sitemap-popular.xml" | grep -o "/AAPL/financials"   # financials URL 포함
  curl -s "$BASE/sitemap-popular.xml" | grep -A2 "/AAPL/financials"  # priority/changefreq 확인
  ```
- **Expected**: `/sitemap.xml`은 sitemapindex로 `sitemap-popular.xml`을 가리킴. `/sitemap-popular.xml`에 `${SITE_URL}/AAPL/financials` 포함 (changefreq=monthly, priority=0.73). 다른 인기 종목도 동일 패턴.

### TC-C08 — robots 정책 정합 (불변)
- **ID**: TC-C08 · **Track**: curl · **Priority**: P1
- **Title**: financials 경로는 `[symbol]` robots 규칙 상속, 기존 규칙 불변
- **Preconditions**: 없음
- **Steps**:
  ```bash
  curl -s "$BASE/robots.txt" | grep -i "Disallow: /api/"
  curl -s "$BASE/robots.txt" | grep -iE "GPTBot|Google-Extended|CCBot"   # 학습봇 그룹
  curl -s "$BASE/robots.txt" | grep -i "financials"                       # 전용 규칙 없음(기대)
  curl -s "$BASE/robots.txt" | grep -i "Sitemap:"
  ```
- **Expected**: `/financials` 전용 robots 규칙은 **없음**(`[symbol]` 규칙 상속). `/api/` 전역 Disallow. 학습봇(GPTBot/Google-Extended/CCBot 등) Disallow `/`. AI 검색봇(PerplexityBot/OAI-SearchBot) allow + crawlDelay 60. Sitemap 라인 = `${SITE_URL}/sitemap.xml`. 기존 robots 규칙이 financials 추가로 변형되지 않음.

### TC-C09 — overall 페이지 재무 요약 통합
- **ID**: TC-C09 · **Track**: curl · **Priority**: P1
- **Title**: `/AAPL/overall` 200, 재무 요약 섹션
- **Preconditions**: overall 분석이 done이어야 `재무 분석` 섹션 노출(클라 분석 done 시점). SSR만으로는 비어있을 수 있음 → 시각 검증은 TC-B12.
- **Steps**:
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" "$BASE/AAPL/overall"
  ```
- **Expected**: 200. (재무 요약 `재무 분석` 섹션은 `financialsBulletsKo.length>0`일 때 노출 — 클라 분석 done 후. Chrome TC-B12에서 실증.)

### TC-C10 — ETF/Index 엣지 (SPY)
- **ID**: TC-C10 · **Track**: curl · **Priority**: P1
- **Title**: ETF 심볼 200 + about 노드 생략 + 500 없음
- **Preconditions**: 없음
- **Steps**:
  ```bash
  curl -s -o /tmp/spy-fin.html -w "%{http_code}\n" "$BASE/SPY/financials"
  grep -o "SPY 재무제표" /tmp/spy-fin.html
  grep -o '"@type":"WebPage"' /tmp/spy-fin.html
  ```
- **Expected**: SPY가 FMP profile을 가지면 200, h1=`SPY 재무제표`. WebPage JSON-LD의 `about` 노드는 stock 분류 아니면 자연 생략(ETF). 재무제표 섹션은 데이터 희소 시 EmptySectionCard로 graceful — 500 없음. (SPY가 FMP에서 profile 없음/empty면 404가 정답.)

### TC-C11 — BRK.B 등 점/하이픈 심볼 (정규식 경계)
- **ID**: TC-C11 · **Track**: curl · **Priority**: P2
- **Title**: `.`·`-` 포함 valid 심볼 정상
- **Preconditions**: 없음
- **Steps**:
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" "$BASE/BRK.B/financials"
  ```
- **Expected**: `BRK.B`는 정규식(5자, `.` 허용) 통과 → FMP profile 있으면 200, 없으면 404. 500 없음.

### TC-C12 — ISR cold-gen 안정성 (캐시 미스 첫 요청)
- **ID**: TC-C12 · **Track**: curl · **Priority**: P0
- **Title**: 미캐시 cold render에서 500/DYNAMIC_SERVER_USAGE 없음
- **Preconditions**: prod-like `yarn start`. 캐시가 비워진 심볼(빌드 후 첫 방문) 선택. 서버 로그 모니터.
- **Steps**:
  ```bash
  # 빌드 직후 한 번도 방문 안 한 인기 심볼로 cold-gen 유도
  curl -s -o /dev/null -w "%{http_code}\n" "$BASE/MSFT/financials"
  # 서버 로그에 DYNAMIC_SERVER_USAGE / connection() 관련 에러 없는지 확인
  grep -i "DYNAMIC_SERVER_USAGE\|connection()" /tmp/start.log
  ```
- **Expected**: 첫(cold) 요청 200. 서버 로그에 `DYNAMIC_SERVER_USAGE` 0건, 500 0건. 두 번째 요청은 `x-nextjs-cache: HIT` 가능(ISR 캐시 적재).

### TC-C13 — 기존 탭 회귀 (chart/overall/fundamental/options/news)
- **ID**: TC-C13 · **Track**: curl · **Priority**: P0
- **Title**: 신규 탭 추가가 기존 라우트를 깨지 않음
- **Preconditions**: 없음
- **Steps**:
  ```bash
  for p in "" /overall /fundamental /options /news /fear-greed; do
    printf "%s " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "$BASE/AAPL$p"
  done
  ```
- **Expected**: 모두 200. 기존 탭 정상.

---

## B. CHROME 트랙 (시각 / 상호작용)

> 공통: DevTools Console + Network 탭 열고 시작. 각 케이스 종료 시 콘솔 에러 0 확인(TC-B10).

### TC-B01 — 페이지 렌더 (스코어카드 / 명세표 / 차트)
- **ID**: TC-B01 · **Track**: chrome · **Priority**: P0
- **Title**: 스코어카드(4축+composite 게이지), 4개 명세표, 트렌드 차트 시각 정상
- **Preconditions**: 서버 기동, `$BASE/AAPL/financials` 방문
- **Steps**: 1) 페이지 진입. 2) 스코어카드 섹션(`재무 종합 점수`) 확인. 3) 아래로 스크롤하며 손익/재무상태/현금흐름/성장 분석 섹션 확인.
- **Expected**:
  - 상단 `재무 종합 점수` 카드: composite 반원 게이지(needle + 0/25/50/75/100 눈금), 등급 문자(A~F, A=초록·F=빨강) + summary 한 줄.
  - 4축 카드 그리드(모바일 2열/데스크탑 4열): 성장성·수익성·질·안정성·현금창출력. 각 카드 등급 배지 + 점수(0~100) + 진행 막대 + 시그널 칩 + 지표 행.
  - 손익계산서: 2계열 막대(매출/순이익) + 8행 표(매출/매출총이익/영업이익/순이익/EPS/매출총이익률·영업이익률·순이익률).
  - 재무상태표: 3계열 막대(총자산/총부채/자본) + 표(총자산/총부채/순부채/현금/자본/유동비율).
  - 현금흐름표: 3계열 막대(영업CF/FCF/CapEx) + 표(영업현금흐름/CapEx/FCF/FCF마진/배당).
  - 성장 분석: YoY 4행(매출·순이익·EPS·FCF 성장) + 구분선 아래 장기 주당매출 3Y/5Y/10Y.
  - 레이아웃 깨짐 없음, 숫자는 `$391.0B` 형태 compact USD.

### TC-B02 — InfoTooltip
- **ID**: TC-B02 · **Track**: chrome · **Priority**: P1
- **Title**: 어려운 용어 hover/click 시 해설 노출
- **Preconditions**: TC-B01 상태
- **Steps**: 1) 손익계산서 `매출총이익률` 옆 info 아이콘 hover/click. 2) 재무상태표 `순부채`. 3) 현금흐름표 `CapEx`/`FCF`/`FCF마진`.
- **Expected**: 각 용어에 InfoTooltip 팝업: 매출총이익률→GrossMargin 해설, 순부채→NetDebt 해설(`음수면 순현금`), CapEx→CapEx 해설, FCF→FCF 해설, FCF마진→FcfMargin 해설. `~이에요`체, max-w-xs 안에 fit. 키보드 포커스/ESC로도 닫힘.

### TC-B03 — 분기 토글 (annual ↔ quarter lazy fetch)
- **ID**: TC-B03 · **Track**: chrome · **Priority**: P0
- **Title**: 연간↔분기 전환, quarter lazy fetch 후 표/차트 갱신
- **Preconditions**: TC-B01 상태, Network 탭 open
- **Steps**: 1) 기본=`연간` 선택(aria-pressed). 2) `분기` 클릭. 3) `불러오는 중...` 스피너 표시 관찰. 4) Network에서 `getFinancialsQuarterAction` server action 호출 1회 확인. 5) 데이터 갱신 후 다시 `연간` 클릭. 6) 재차 `분기` 클릭.
- **Expected**: `분기` 첫 클릭 시 `불러오는 중...`(role=status) 노출 → quarter 스냅샷 fetch(8분기) → 표·차트가 분기 데이터로 갱신(연도 라벨이 분기 형태). `연간`은 SSR 데이터라 즉시(추가 fetch 없음). 두 번째 `분기` 클릭은 캐시된 quarter 사용 → **fetch 없이 즉시 전환**(스피너 안 뜸). PeriodToggle `aria-pressed` 갱신.

### TC-B04 — 분기 fetch 실패/빈 데이터 → annual fallback
- **ID**: TC-B04 · **Track**: chrome · **Priority**: P1
- **Title**: quarter all-empty/reject 시 annual로 자동 복귀(빈 화면 아님)
- **Preconditions**: 분기 데이터가 빈 심볼(데이터 희소) 또는 네트워크 throttle/offline로 reject 유도. 또는 quarter 데이터 없는 ETF.
- **Steps**: 1) 데이터 희소 심볼 `/SYM/financials` 진입(연간 표시). 2) `분기` 클릭.
- **Expected**: quarter fetch가 all-empty로 resolve하거나 reject하면 `isEmptySnapshot` 감지 → `period`가 `annual`로 자동 복귀. 토글은 다시 `연간`이 pressed, 표/차트는 연간 데이터 유지(EmptySectionCard 도배 아님). 스피너는 finally로 해제. 콘솔에 `[fetchAndApplyQuarterSnapshot] ... falling back to annual` warn만(에러 아님).

### TC-B05a — AI 요약: 스켈레톤 → 결과 (실동작 happy path)
- **ID**: TC-B05a · **Track**: chrome · **Priority**: P0
- **Title**: AI 분석 submit→poll→결과 전체 플로우 실제 완료
- **Preconditions**: prod-like(`E2E_TEST` 미설정) 서버 + 유효 FMP/LLM 키. `$BASE/AAPL/financials` 진입.
- **Steps**: 1) 진입 직후 `AI 재무제표 분석` 카드의 스켈레톤(`AI 재무제표 분석 진행 중…` + 3줄 shimmer) 관찰. 2) Network에서 `submitFinancialsAnalysisAction` 1회 → 이후 `pollFinancialsAnalysisAction` 10초 간격 폴링 관찰. 3) 잡 done 시 결과 카드 렌더 대기.
- **Expected**: 스켈레톤 → (submit→poll loop, 10s 간격) → done 시 결과 카드: 감정 배지(긍정/중립/부정 색상), `overallConclusionKo` 본문, 축별 평가 리스트(성장성/수익성·질/안정성/현금창출력), `위험 요인` 리스트. 폴링이 done 받으면 추가 poll 중단. 분석 텍스트가 실제 노출됨(빈 카드 아님).

### TC-B05b — AI 요약: 에러 카드 + 재시도
- **ID**: TC-B05b · **Track**: chrome · **Priority**: P1
- **Title**: 분석 에러 시 에러 카드 + `다시 시도`로 복구
- **Preconditions**: `E2E_TEST=1` 서버 + 쿠키 `e2e_force_financials_error` 설정(결정적 에러 주입). 또는 prod에서 일시 장애 재현.
- **Steps**: 1) 쿠키 설정 후 `/AAPL/financials` 진입. 2) 에러 카드 관찰. 3) `다시 시도` 버튼 클릭(쿠키 제거 후) → 복구 관찰.
- **Expected**: 빨강 테두리(`border-ui-danger/30`) 카드, `role=alert` 메시지(FMP user-facing 또는 `분석 중 오류가 발생했습니다.`), `다시 시도` 버튼. 클릭 시 refetch → (정상 조건이면) 스켈레톤 → 결과로 복구. 에러 바운더리 무한 루프 없음.

### TC-B05c — AI 요약: 봇 차단 안내
- **ID**: TC-B05c · **Track**: chrome · **Priority**: P1
- **Title**: 봇 UA로 진입 시 BotBlockedNotice 노출
- **Preconditions**: Chrome DevTools에서 User-Agent를 `ClaudeBot/1.0`(또는 GPTBot)로 override 후 `/AAPL/financials` 진입. prod-like 서버.
- **Steps**: 1) UA override. 2) 진입. 3) AI 요약 영역 관찰.
- **Expected**: submit이 `miss_no_trigger` 반환 → `BotBlockedError` → `BotBlockedNotice` 카드 노출(분석 미트리거). 페이지 SSR(스코어카드/명세표)은 정상. 무한 폴링 없음.

### TC-B06 — ChatPanel 컨텍스트 전환 (★ 사용자 필수)
- **ID**: TC-B06 · **Track**: chrome · **Priority**: P0
- **Title**: 챗봇 켠 상태에서 financials 진입/타 탭 이동 시 컨텍스트가 재무제표로 정확히 전환(stale 없음), done 전 입력 disabled
- **Preconditions**: prod-like 서버(또는 E2E cached). AI 분석이 done 가능한 심볼.
- **Steps**:
  1. `/AAPL` (chart 탭) 진입 → FloatingChatButton 클릭해 챗봇 **ON**(ChatPanel 열림). 분석 done 후 입력 활성 확인, 질문 입력해 technical 컨텍스트로 답변되는지 확인.
  2. financials 탭으로 이동(`/AAPL/financials`). 챗봇 열린 상태 유지.
  3. 진입 직후(분석 loading 동안) 입력창 상태 확인.
  4. financials 분석 done 후 입력 활성 → 재무 관련 질문(예 "이 회사 부채 수준 어때?") → 답변이 재무제표 컨텍스트 기반인지 확인.
  5. 다시 chart 탭으로 이동 → 컨텍스트가 technical로 되돌아가는지 확인.
  6. overall 탭으로 이동 → overall 컨텍스트로 전환 확인.
- **Expected**:
  - financials 진입 시 `usePublishSymbolChat`이 `buildChatState(state)`를 publish. 분석 **loading/error/bot_blocked 동안** context=`null`, `isAnalysisReady=false` → 입력창 **disabled** + placeholder `분석이 완료된 후 질문할 수 있어요`. (이전 chart 탭의 technical 컨텍스트가 **잔존하지 않음**.)
  - 분석 **done** 시 context=`{ kind: 'financials', payload: result }`, 입력 활성 → 재무 질문에 재무 데이터 기반 답변.
  - 탭 이동 시마다 해당 탭 컨텍스트(technical/overall/financials)로 정확히 전환. **이전 탭 컨텍스트로 답변하는 stale 현상 없음.**
  - 언마운트 시 `clear()`로 context null.

### TC-B11 — 분석 이후 캐싱 (★ 사용자 필수)
- **ID**: TC-B11 · **Track**: chrome · **Priority**: P0
- **Title**: 분석 완료 후 동일 심볼 재진입/재요청 시 warm 캐시 히트(재트리거 없음), annual/quarter/overall 캐시 키 분리
- **Preconditions**: TC-B05a로 AAPL financials 분석 1회 done 완료(warm). Network 탭 open.
- **Steps**:
  1. AAPL financials 분석 done 후, 다른 탭 갔다가 `/AAPL/financials` **재진입**.
  2. AI 요약 카드가 스켈레톤 없이(또는 거의 즉시) 결과로 표시되는지 확인. submit이 `cached` 반환(poll 루프 없음)인지 Network 확인.
  3. 분기 토글 후 다시 연간 → quarter/annual 데이터 캐시 키 분리(각각 별도 fetch, 상호 오염 없음) 확인.
  4. `/AAPL/overall` 진입 → overall 분석이 별도 잡으로 동작(financials 잡 재사용 아님), 재무 요약 섹션 노출.
  5. (서버 로그) Redis 키 `financials:income:AAPL:annual` vs `:quarter` 분리, overall 캐시 키 별도.
  6. React Query: financials 분석 query key `['financials-analysis','AAPL',modelId]`가 hydrate되어 재진입 시 재페치 안 함.
- **Expected**:
  - 재진입 시 financials AI 분석 **재트리거 안 됨** — submit이 `cached` 즉시 반환, poll 루프 없음, 결과 즉시 노출.
  - annual·quarter 재무 데이터 캐시 키 분리(`:annual` vs `:quarter`), MAX-fetch+slice라 truncation 오염 없음.
  - overall 분석은 financials와 별개 잡/캐시 — 서로 덮어쓰지 않음.
  - 동일 세션 내 query key 일치로 React Query 캐시 히트(추가 submit 없음).

### TC-B07 — 음수 / 결측 / 빈 섹션
- **ID**: TC-B07 · **Track**: chrome · **Priority**: P1
- **Title**: 음수 막대 분기, null `—`, 데이터 없는 섹션 EmptySectionCard
- **Preconditions**: CapEx/배당 등 음수 값 존재하는 정상 심볼(AAPL). 일부 섹션 데이터 없는 심볼(ETF 등).
- **Steps**: 1) 현금흐름표 표에서 CapEx/배당 값 색·부호 확인. 2) 현금흐름 차트에서 CapEx 막대 방향 확인. 3) null 값 셀 표기 확인. 4) 데이터 없는 섹션(예 ETF의 성장 분석) 확인.
- **Expected**: 음수 값(CapEx `-$9.4B`, 배당) 표에서 빨강(`text-chart-bearish`), 양수는 초록(`text-chart-bullish`), null은 `—`(회색). 차트에서 음수 막대는 baseline 아래로(하향) 그려지고 항상 bearish 색. 데이터 0행 섹션은 `EmptySectionCard`(`데이터를 불러올 수 없습니다.`)로 동일 스타일 표시(빈 화면 아님).

### TC-B08 — 반응형 레이아웃
- **ID**: TC-B08 · **Track**: chrome · **Priority**: P1
- **Title**: 모바일/데스크탑 레이아웃 깨짐 없음
- **Preconditions**: TC-B01 상태
- **Steps**: 1) 데스크탑 폭(≥1024px): 4축 카드 4열. 2) DevTools device toolbar로 iPhone 폭(~390px): 4축 2열. 3) 표 가로 스크롤/overflow 확인. 4) 차트 SVG 폭 적응 확인.
- **Expected**: 데스크탑 4열, 모바일 2열 그리드. 표는 좁은 화면에서 가로 스크롤 또는 적절한 줄바꿈(라벨 nowrap). 차트가 컨테이너 폭에 맞게 스케일. 가로 overflow로 인한 좌우 스크롤(body) 없음(iOS Safari fixed overflow 주의).

### TC-B09 — 교차 링크 / 탭 네비게이션
- **ID**: TC-B09 · **Track**: chrome · **Priority**: P1
- **Title**: symbol-page 탭에 재무제표 노출, CrossLinkCards 링크 정상
- **Preconditions**: 없음
- **Steps**: 1) `/AAPL`에서 상단 탭에 `재무제표` 탭 존재(차트/뉴스/펀더멘털 다음) 확인 후 클릭 → financials 진입. 2) financials 페이지 하단 CrossLinkCards 확인. 3) financials 카드의 현재 상태 확인. 4) 다른 cross-link(차트/펀더멘털 등) 클릭해 이동 확인.
- **Expected**: symbolTabs 4번째에 `재무제표`(href `/AAPL/financials`). CrossLinkCards에 `재무제표` 카드(설명 `손익계산서·재무상태표·현금흐름표`). 현재 페이지(`current="financials"`)인 카드는 비-링크 `<div>` + `aria-current="page"` + 파란 테두리 + `지금 보는 페이지예요`. 다른 카드는 클릭 시 정상 이동.

### TC-B10 — 콘솔 에러/경고
- **ID**: TC-B10 · **Track**: chrome · **Priority**: P0
- **Title**: 런타임 콘솔 에러/경고 0(의도된 warn 제외)
- **Preconditions**: 위 모든 Chrome 케이스 수행 중 Console 모니터
- **Steps**: 1) 진입·토글·분석·챗봇·반응형 조작 전체 수행. 2) Console 확인.
- **Expected**: React hydration mismatch, key 경고, prop-type, uncaught error 0건. 허용되는 의도된 warn: quarter fallback warn(`[fetchAndApplyQuarterSnapshot] ...`), cancel 실패 warn(`[useFinancialsAnalysis] cancel failed`)는 해당 시나리오 한정. 그 외 에러/경고 없음.

### TC-B12 — overall 통합 재무 요약 (시각)
- **ID**: TC-B12 · **Track**: chrome · **Priority**: P1
- **Title**: overall 페이지에 `재무 분석` 섹션 SSR/CSR 노출
- **Preconditions**: `/AAPL/overall` 진입, overall 분석 done.
- **Steps**: 1) overall 진입. 2) 분석 done 대기. 3) `재무 분석` 섹션 확인.
- **Expected**: overall 분석 done(`financialsBulletsKo.length>0`) 시 `재무 분석` 섹션(불릿 리스트, MarkdownText)이 노출. bullets 0개면 섹션 자체가 렌더 안 됨(null). 봇은 financials scorecard fetch skip → bullets 없을 수 있음(정상).

### TC-B13 — 분석 진행 중 탭 이탈/이동 시 잡 cancel
- **ID**: TC-B13 · **Track**: chrome · **Priority**: P2
- **Title**: 분석 loading 중 다른 심볼/탭으로 이동 시 진행 잡 cancel
- **Preconditions**: prod-like, 분석이 오래 걸리는 상태(loading 중).
- **Steps**: 1) `/AAPL/financials` 진입, 분석 loading 중. 2) 다른 심볼 `/MSFT/financials`로 이동(또는 페이지 hide). 3) Network에서 `cancelFinancialsAnalysisJobAction` 호출 확인.
- **Expected**: symbol 변경(queryKey 교체)/unmount 시 진행 중 jobId가 있으면 `cancelFinancialsAnalysisJobAction` fire-and-forget 호출. cancel 실패해도 페이지는 정상(warn만). 새 심볼 분석이 이전 jobId를 null로 덮어쓰지 않음(race-guard).

---

## C. 안정성 / 회귀 매핑

| Spec ID | 커버하는 Test Case |
|---|---|
| S1 (ISR cold-gen) | TC-C12 |
| S2 (캐시 정합) | TC-B11, TC-B03 |
| S3 (기존 탭 회귀) | TC-C13, TC-B09 |
| S4 (빌드) | §0 Preconditions(exit 0) |

---

## D. 합격 기준 (Exit Criteria)

- Curl TC-C01~C13, Chrome TC-B01~B13 전부 PASS.
- prod build exit 0, 런타임 콘솔 에러 0(TC-B10).
- 잘못된 심볼/ETF/cold-gen에서 500 0건(TC-C06/C10/C12).
- ★ 필수 3종 PASS: 챗봇 컨텍스트 전환(TC-B06), AI 분석 실동작(TC-B05a), 분석 후 캐싱(TC-B11).
