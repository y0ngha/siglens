# 포지션 빌딩 재설계 (아이소메트릭 "내 위치") — Design (rev.1)

> 상태: 사용자 검토 대기. 2026-07-18. rev.1 = 비판적 설계검토(Opus) 반영.
> 선행: A(portfolio-holdings, PR #691), B(portfolio-position-viz, PR #692), C(personalized-analysis, feat/personalized-analysis). 브랜치 `feat/position-building-redesign`.
> ⚠️ **브랜치 구조 미결**: 아래 §브랜치 전략 — 사용자 확인 필요.

## 배경 / 동기

B의 "내 위치" 세로 밴드 게이지가 (1) 분석 페이지를 너무 길게 만들고 (2) 시각적으로 약함. 사용자 결정:
1. **분석 페이지(ChartContent)에서 "내 위치" 제거** — 분석 전용.
2. **아이소메트릭 "빌딩"** 재설계 (순수 SVG — 아래 §렌더링 참조. 외부 3D 의존성 없음).
3. 배치 **둘 다**: 심볼 탭 `[symbol]/position`("내 위치") + 회원 `/portfolio`.
4. **모바일 정합**: 빌딩 + C "내 평단 기준으로 분석했어요" 배지.

## 스코프 펜스 (⛔ core 아님)

순수 표현(siglens-local). 매수/시그널/추천 의미 금지(그건 C 담당). `positionGeometry.ts`는 좌표·퍼센트만. **평가 문구 금지** — "저층=좋은 진입" 같은 good/bad entry 판단은 스코프 드리프트. 오직 위치 표현("범위 내 어디")만. core 변경·릴리스 없음.

## 메타포 매핑

빌딩 층 = 가격대. 건물은 최근 저점(1층)~최근 고점(옥상) 스팬(현재 타임프레임 252봉, "52주" 아님).
- 내 평단(avg) → ★ "내 매수 층", 현재가(current) → ● "현재 시세".
- **범위 밖 대칭 처리**: `avgClamped`/`currentClamped` **둘 다** 사용 — 'above'면 옥상 위(하늘/☁), 'below'면 지하(B1). avg뿐 아니라 **current도** 옥상/지하로(현재가가 최근 고점 돌파 시 ●가 옥상에 눌리는 것 방지).
- 수익/손실: returnPct 부호로 색+라벨(수익=상승계열, 손실=하락계열, 중립=secondary). **위치 서술만**, 매수 잘/못 판단 금지.

`computePosition(low52w, high52w, current, avg) → PositionModel`(avgPos/currentPos 0..1, 5밴드, returnPct/rangePositionPct/pctFromHigh/pctAboveLow, avgClamped/currentClamped) **그대로 재사용**. 순수·가드·테스트 완비.

## 렌더링: **SVG 아이소메트릭 (확정, CSS 3D 폐기)**

비판검토 결론 — CSS `preserve-3d`는 (a) 모바일에 필요한 `overflow:hidden` 조상이 3D 컨텍스트를 flatten, (b) rotateX/Z 위 텍스트 shear/blur, (c) z-order/라벨 겹침 뷰포트별 예측 불가, (d) jsdom이 transform 미계산→테스트 불가. **SVG로 확정**:
- 코드베이스 선례 그대로: `viewBox` + `role="img"` + `aria-label` + `currentColor`/토큰 className (PositionGauge·FearGreedGauge 패턴).
- 건물 **면(face)만** 아이소메트릭 폴리곤(skew)으로 장식. **층 라벨·★·● 마커 텍스트는 평평한 upright `<text>`**를 투영 좌표에 배치(절대 skew 안 함 — 가독성).
- viewBox 자동 스케일 → 모바일 오버플로우 없음. 토큰 색. `data-testid`로 rect/marker 결정적 테스트.
- PositionGauge의 `IN_SVG_COMPACT_THRESHOLD`($100K→$K 축약) 계승.
- **마커 dodge**: `|avgPos − currentPos| < 0.04`(break-even 흔함)일 때 ★/● 겹침 회피(기존 게이지 로직 계승·재해석). 같은 층에 두 마커 시 좌우 분리 + 라벨 스택.

## 아키텍처 / 컴포넌트

### widgets/portfolio-position

- **신규 `ui/PositionBuilding.tsx`** — 순수 프레젠테이션. props `{ model: PositionModel, avgPrice, currentPrice, low, high, className? }`. SVG 아이소메트릭 빌딩 + ★/● upright 마커 + a11y aria-label("내 평단 $150(범위 위치 …%), 현재가 $333, 수익률 +122.5%"). crypto는 정밀도 포맷 명시(PositionGauge는 §6에서 crypto 정밀도 punt — /portfolio·탭에 crypto 보유 렌더 시 `formatUsdPrice` 대신 crypto 정밀도 처리).
- **`ui/PositionGauge.tsx`** — 세로 밴드. **제거** + 테스트 삭제.
- **`ui/PositionCard.tsx`** — readout 재사용·정비(평단/현재가/최근 고·저 대비/수익률/범위 위치).
- **`ui/PositionSection.tsx`·`PositionSectionMounted.tsx`** — **제거**. 대신 탭/포트폴리오가 위젯 직접 사용. ⚠️ **게스트 code-split 게이트 계승**: PositionSectionMounted는 `useHydrated()`+`useCurrentUser()`로 게이트한 뒤 lazy-import(게스트는 청크 미다운로드+쿼리 미발화). 새 개인화 아일랜드도 동일하게 **lazy + hydration+user 게이트**(anon이 `useSymbolHolding` 즉시 발화 = 회귀).
- **`index.ts`** — export 정비.

### 배치 1: 심볼 탭 `[symbol]/position` ("내 위치")

- `src/app/[symbol]/position/page.tsx` — 심볼 탭 레시피. **AI 잡/core 포트 없음**(순수 표현).
  - **서버 데이터 = `getBarsStatic(ticker, DEFAULT_TIMEFRAME, fmpSymbol)` → quantize → `buildTechnicalFacts`** (low52w/high52w/lastClose 결정적, cookies 없음). ⚠️ **getBarsAction 금지**(cookies()→ISR cold-gen 500 함정).
  - **회원+보유** → 개인화 빌딩(★평단) + readout (client island, lazy+게이트).
  - **비회원/미보유** → 빌딩(가격 층만, ★없음) + CTA("보유종목 등록하면 내 매수 층이 표시돼요" → /onboarding). 가격 층은 공개 데이터.
  - **noindex 확정**: 수천 심볼 × (익명엔 얇은/차트와 중복인) 가격 층 → 크롤 예산 낭비·클러스터 희석. 탭은 개인화 surface(/account류)이므로 `generateMetadata`에서 `robots:{index:false}`. connection()/cookies() 금지.
  - **크롤 안전**: ★/수익률은 client(hydration+user 게이트)라 SSR HTML 부재.
- **탭 배선 4곳(전부 필요)**: `TabKey` union(`shared/config/marketProfile/types.ts`) + `TABS`(`symbolTabsConfig`) + 각 profile `tabs` 배열(`usEquity.ts`, crypto 보유 렌더 시 `crypto.ts`) + `isTabAllowedForSymbol` 가드 + `generateMetadata` noindex/crypto-hard-404 parity(fundamental 선례 — soft-404 index/notFound 불일치 회피).

### 배치 2: 회원 포트폴리오 페이지 `/portfolio`

- `src/app/portfolio/page.tsx` — **auth-guarded**, noindex.
  - **proxy.ts 2곳(둘 다 필수)**: `AUTH_REQUIRED_PATHS`에 `/portfolio` 추가(startsWith) + `RESERVED_FIRST_SEGMENTS`에 `'portfolio'` 추가. ⚠️ **RESERVED 누락 시 reserved 체크가 auth보다 먼저라 `/portfolio`→티커 오인→301 `/PORTFOLIO`→`[symbol]` 404**(이전 /onboarding 사고 재현). in-page `redirect('/login?next=/portfolio')` + `robots:{index:false}`도 방어로.
  - **데이터 = lazy per-card 클라 아일랜드(확정)**: 서버 페이지는 **순수 보유 DB 읽기**(findByUser)만. 각 빌딩은 **자기 종목의 범위를 lazy fetch**하는 client island(기존 React-Query dedupe/cache-warm bars 경로, 스크롤 시 지연로드). 서버 비용=DB 읽기로 bound, 캐시 warm, 카드별 degrade. ⚠️ 무한 서버 N-fetch 금지(비캐시 dynamic 페이지라 매 방문 N×252봉 FMP 호출 = 비용/지연/FMP 402 위험).
  - 보유 많을 때 pagination/지연로드. 빈 상태(0) → 등록 CTA. /account에서 진입 링크.

### 배치 3: 분석 페이지에서 제거

- `ChartContent.tsx` `PositionSectionMounted`(라인 240·259 desktop+mobile) 제거 + import.
- ⚠️ **고아 코드 함께 제거**: `facts` useMemo(214–217) + `buildTechnicalFacts` import + 해당 의존성 배열 항목은 **오직** `{facts && <PositionSectionMounted/>}`를 먹이기 위해 존재(`TechnicalFactsSummary`는 자체 재계산, `facts` 안 받음). 제거 안 하면 lint `no-unused` 실패.

### 모바일 정합

- **PositionBuilding**: viewBox 반응형(오버플로우 없음), 좁은 화면 라벨 겹침 방지(마커 라벨 빌딩 밖 정렬/스택).
- **C 배지 모바일**: `AnalysisPanel` 헤더는 이미 `flex-col sm:flex-row sm:justify-between` + 우측 그룹 `flex-wrap`으로 **이전 지그재그를 의도적으로 해결**(주석 983–985). ⚠️ **먼저 좁은 뷰포트 실제 재현/스크린샷으로 문제 확인 후**에만 손대고, col→row 스위치는 건드리지 않고 우측 그룹 **내부**로 한정(배지 순서/own-line). 이 브랜치는 분석 페이지를 유지하므로 배지 컨텍스트 불변 → 직교적 픽스.

## 데이터 흐름 요약

```
[symbol]/position (ISR, noindex):
  server: getBarsStatic → buildTechnicalFacts → low52w/high52w/lastClose (cookies 없음)
  client island (lazy, hydration+user 게이트): useSymbolHolding → 평단 → ★ (회원+보유만)
  computePosition(low, high, current, avg) → PositionModel → PositionBuilding + PositionCard

/portfolio (dynamic auth, noindex):
  server: findByUser (보유 DB만)
  각 종목 client island (lazy on scroll): bars fetch → computePosition → 미니 PositionBuilding, 카드별 degrade
```

## 에러/엣지

- computePosition null(고<=저, avg/current<=0, non-finite) → 빌딩 대신 readout/"데이터 부족".
- avg **및 current** 범위 밖 → clamp + 옥상/지하 라벨(avgClamped·currentClamped 둘 다).
- ★/● 같은 층(break-even) → dodge.
- 포트폴리오 종목 fetch 실패 → 카드 degrade, 페이지 유지.
- 비회원/미보유 탭 → 가격 층 teaser + CTA.
- crypto → 정밀도 포맷 명시.

## 테스트 (≥90%)

- `positionGeometry.test.ts` 유지.
- `PositionBuilding.test.tsx` — 층/마커 투영 좌표, avg·current clamped(옥상/지하) 대칭, 마커 dodge, 수익/손실 색·라벨, a11y aria-label, null 미렌더, compact 축약, crypto 포맷.
- `PositionCard.test.tsx` 갱신.
- `[symbol]/position` — 회원+보유/비회원/미보유 분기, **SSR에 ★/수익률 부재**, 셸에 **cookies()/connection() 없음**(ISR 500 가드), noindex 메타.
- `/portfolio` — auth 가드(RESERVED+AUTH_REQUIRED), 보유 그리드, 빈 상태, 카드 lazy/degrade, noindex.
- ChartContent — 위치 위젯+facts useMemo+import 제거 회귀.
- e2e: 탭(회원 보유→★, 미보유→CTA), /portfolio(회원 그리드/비로그인 리다이렉트), 분석 페이지 위치 부재, 배지 모바일.

## 브랜치 전략 (⚠️ 사용자 확인)

현 스택: B(#692, 게이지를 분석에 **추가**) ← C ← 이 브랜치(분석에서 **제거**). 비판검토 권장 = **B·C를 먼저 master 머지 후 이 재설계를 master에서 분기**(add-then-undo churn 회피, 이 PR을 깨끗한 forward diff로). 단 사용자 결정은 "위치 재설계까지 묶어서 리뷰". 
- **옵션 A(사용자 기존 결정 유지)**: 스택 유지, 최종 PR은 combined diff(master→재설계 tip)로 net 상태 리뷰. 중간 add/undo는 history일 뿐.
- **옵션 B(검토 권장)**: B(#692)·C 먼저 머지→재설계를 master에서 분기. C는 이미 감사·실증 완료라 즉시 머지 가능. 배지 모바일 픽스는 C에 귀속.
→ 사용자 선택 필요.

## 비-목표 (YAGNI)

WebGL/three.js 3D(SVG 확정). 회전/조명 없음(정적 아이소메트릭 + 미묘 hover). 층별 거래량/매물대(스코프 펜스). 다중 매수 평균(종목당 단일 평단 유지).
