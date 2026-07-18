# 포지션 빌딩 재설계 — 변경 범위(Change Scope) + 실증 테스트 케이스

> 상태: 구현 완료(브랜치 `feat/position-building-redesign`, base `feat/personalized-analysis`). 2026-07-18.
> 목적: 최종 수동 검증(실증) 드라이버. prod-like 빌드 대상 `curl` + 실제 브라우저로 확인.
> 선행 설계: [`2026-07-18-position-building-redesign-design.md`](./2026-07-18-position-building-redesign-design.md) (rev.1)
> 스코프 펜스: **siglens-local 순수 표현만**. `@y0ngha/siglens-core` 변경 없음 · DB 마이그레이션 없음 · 신규 env 없음.

---

## 0. 한 줄 요약

분석 페이지에 있던 세로 밴드 "내 위치" 게이지를 제거하고, **아이소메트릭 SVG "빌딩"**(최근 [저점,고점] 범위를 5층으로 매핑, ★=평단·●=현재가)으로 재설계해 두 곳으로 이전한다:
(a) 신규 심볼 탭 `[symbol]/position`("내 위치", ISR·noindex, 개인화 부분은 client-only),
(b) 신규 auth-guarded 회원 페이지 `/portfolio`(noindex, 카드 그리드, 카드별 lazy range fetch).
추가로 모바일 심볼-헤더 컨트롤 터치타깃/wrap 정비 + 차트 지표설정 톱니 위치 이동.

---

## 1. 변경 범위 (Change Scope)

### 1.1 신규 컴포넌트 (widgets/portfolio-position)

| 파일 | 내용 |
|---|---|
| `src/widgets/portfolio-position/ui/PositionBuilding.tsx` | **신규.** 순수 SVG 아이소메트릭 빌딩(viewBox `0 0 360 360`, `role="img"` + `aria-label`). 5층(`model.bands`) = 20% 가격 구간. ★=평단 마커(다이아몬드), ●=현재가 마커(원, 손익 색). 층 면(face)만 아이소메트릭 폴리곤(창문·음영), **마커/라벨 텍스트는 항상 upright**. avg·current 둘 다 범위 밖이면 옥상(☁)/지하(▽B1) 클램프. avg≈current 시 좌우 dodge(`DODGE_EPSILON`). in-SVG 라벨은 `$K` 축약(고가 방어), aria-label은 항상 전체값. 하단 `return-readout`(수익률 + 범위 %지점). |
| `src/widgets/portfolio-position/ui/PositionTabContent.tsx` | **신규(client).** 심볼 탭 게이트. `useHydrated()` + `useCurrentUser()`로 게이트 후 회원만 `PositionTabMemberContent`를 `next/dynamic({ssr:false})` lazy-import. 비하이드레이션=null, 로딩=고정크기 스켈레톤(no CLS), 게스트=`PositionCta` 직접 렌더(청크·holdings 쿼리 미발화). |
| `src/widgets/portfolio-position/ui/PositionTabMemberContent.tsx` | **신규(client, lazy).** `useSymbolHolding(symbol)`로 평단 조회 → `computePosition` → `PositionBuilding` + `PositionCard`. 보유 없음/조회 실패=CTA로 수렴, low/high/lastClose null=`DataInsufficientNote`, model null=`DataInsufficientNote`. |
| `src/widgets/portfolio-position/ui/PositionCta.tsx` | **신규.** 익명·미보유 공용 CTA(→`/onboarding`). 훅 없는 순수 컴포넌트. `low52w/high52w` 있으면 "최근 범위 $lo ~ $hi" 표시(공개 데이터만, ★/수익률 없음). |
| `src/widgets/portfolio-position/ui/PositionCard.tsx` | **정비.** readout 카드(최근 고/저·현재가·내 평단·고점대비·저점대비·수익률·범위 위치). `formatSignedPercent` 공용 헬퍼로 전환. |

### 1.2 제거 (분석 페이지 + 옛 위젯)

| 파일 | 내용 |
|---|---|
| `src/views/symbol/ChartContent.tsx` | `PositionSectionMounted` 렌더 2곳(desktop+mobile) + import 제거. 고아 `facts` `useMemo` + `buildTechnicalFacts` import + dep 배열 항목 제거(오직 위젯을 먹이던 코드, lint no-unused 회피). |
| `ui/PositionGauge.tsx` · `ui/PositionSection.tsx` · `ui/PositionSectionMounted.tsx` | **삭제** + 각 테스트 삭제(`PositionGauge.test.tsx`, `PositionSectionMounted.test.tsx`). |
| `index.ts` | export 정비 — `PositionBuilding`/`PositionTabContent`/`PositionCard`/`computePosition` export, Gauge/Section export 제거. |

### 1.3 신규 라우트

| 파일 | 내용 |
|---|---|
| `src/app/[symbol]/position/page.tsx` | **신규 심볼 탭.** `revalidate=43200`(12h) ISR, `generateStaticParams()=[]`(on-demand). 서버 데이터=`getBarsStatic → quantize → buildTechnicalFacts`로 low52w/high52w/lastClose만 계산(cookies 없음 — `getBarsAction` 금지, ISR cold-gen 500 회피). 실패=null degrade. `generateMetadata`는 항상 `NOINDEX_SYMBOL_METADATA` 기반 + fundamental 선례대로 `isTabAllowedForSymbol` parity. `sr-only` 개요(개인화 데이터 없음). `<PositionTabContent>`에 range prop 스레딩. |
| `src/app/portfolio/page.tsx` | **신규 회원 페이지.** `metadata.robots={index:false,follow:false}`. `PortfolioGuard`(Suspense 내부)=`getCurrentUser()` → 없으면 `redirect('/login?next=/portfolio')`, 있으면 `DrizzlePortfolioRepository.findByUser`(단일 DB 읽기, per-holding range fetch 안 함) → 정렬 후 그리드. 빈 보유=`PortfolioEmptyState` CTA, DB 읽기 실패=`PortfolioErrorState`(페이지 유지). |
| `src/app/portfolio/PositionHoldingCard.tsx` | **신규(client).** 그리드 셀 하나. 전체가 `/[symbol]/position`로 가는 `<Link>`. `useInViewOnce`(IntersectionObserver, rootMargin 200px, 미지원=즉시 visible) → 뷰포트 진입 시에만 `getBarsAction` React-Query fetch(기존 `QUERY_KEYS.bars` 캐시 공유). `computePosition` → 미니 `PositionBuilding` + dl(평단/현재가/수익률). fetch/기하 실패=`CardDegraded`(평단만 표시, 그리드 유지). `CARD_BODY_MIN_H`로 lazy-resolve CLS 방어. |

### 1.4 탭 배선 (심볼 탭 등록 4곳)

| 파일 | 변경 |
|---|---|
| `src/shared/config/marketProfile/types.ts` | `TabKey` union에 `'position'` 추가. |
| `src/views/symbol/utils/symbolTabsConfig.ts` | `TABS`에 `{key:'position', label:'내 위치', hrefBuilder: s=>`/${s}/position`}` 추가(맨 끝). |
| `src/shared/config/marketProfile/usEquity.ts` | `tabs` 배열에 `'position'` 추가. |
| `src/shared/config/marketProfile/crypto.ts` | `tabs` 배열에 `'position'` 추가(크립토 보유도 평단/현재가 해석 가능). |

### 1.5 proxy (auth 가드 + reserved 라우팅)

| 파일 | 변경 |
|---|---|
| `src/proxy.ts` | `AUTH_REQUIRED_PATHS`에 `'/portfolio'` 추가(startsWith 전방가드 → `/login?next=<pathname>`). `RESERVED_FIRST_SEGMENTS`에 `'portfolio'` 추가(**필수** — 없으면 reserved 체크가 auth보다 먼저라 `/portfolio`를 티커로 오인해 301 `/PORTFOLIO` → `[symbol]` 404). |

### 1.6 모바일 심볼-헤더 컨트롤 정비 (레이아웃-중립 터치타깃)

| 파일 | 변경 |
|---|---|
| `src/features/reasoning-toggle/ui/ReasoningToggle.tsx` | 시각 pill은 `h-5 w-9` 유지, 탭 영역은 **out-of-flow** `before:` 의사요소(`before:-inset-x-1 before:-inset-y-1`)로만 확장 → 헤더 행 높이 미증가. `-inset-y-1`(4px/side, `gap-y-2` 이내) = ~28px 히트영역(WCAG 2.5.8 AA 24px 통과). `-inset-y-3`(44px AAA)는 인접 행 침범해 webkit에서 탭 nav를 채팅 패널 오버랩 밴드로 밀어 회귀 → 채택 안 함. `locked` 스타일 분리, thumb에 `pointer-events-none`. |
| `src/views/symbol/SymbolLayoutHeader.tsx` | "AI 분석 모델" 라벨 + `ModelSelector`를 `<div flex shrink-0>`로 묶어 한 유닛 wrap(라벨 orphan 방지). |
| `src/widgets/analysis/ModelSelector.tsx` | 트리거에 `min-h-11 touch-manipulation`, `min-w-0` + label `truncate`(좁은 화면 오버플로우 방지). |
| `src/widgets/share/ui/ShareButton.tsx` | `size-9 min-h-11` → `size-11`(정사각 44px 터치타깃 정규화). |

### 1.7 차트 지표설정 톱니 재배치

| 파일 | 변경 |
|---|---|
| `src/widgets/chart/StockChart.tsx` | 톱니 컨테이너 `right-2` → `right-14`(우측 price-scale 라벨 열 안쪽으로 → 가격 눈금 숫자와 겹침 해소). |
| `src/widgets/chart/ui/IndicatorSettingsModal.tsx` | 톱니 버튼 `h-8 w-8` → `h-11 w-11`(44px 터치타깃) + `bg-secondary-900/85 backdrop-blur-sm`(가독성). |

### 1.8 기타

| 파일 | 변경 |
|---|---|
| `src/shared/lib/priceFormat.ts` | `formatSignedPercent(value)` 신규(rule-of-three, 3곳 중복 제거). |
| `src/app/account/page.tsx` | `/portfolio` 진입 링크("내 포트폴리오 위치 보기") 추가. |
| `e2e/specs/portfolio-position.spec.ts` | 옛 "게이지가 `/AAPL`에 렌더" 단언 → 새 배치(분석페이지 부재 + 탭 + `/portfolio`)로 재작성. |

---

## 2. 불변식 / 비-회귀 (Invariants / Non-regressions)

| # | 불변식 | 확인 포인트 |
|---|---|---|
| I1 | 분석 페이지 `/[symbol]`는 더 이상 위치 위젯을 렌더하지 않는다(**그러나 페이지 자체는 정상 렌더**). | `position-building` testid 0개, `region[name="내 위치"]` 0개. 회원 보유 상태에서도 부재. |
| I2 | 두 신규 라우트는 **noindex** + **sitemap 미포함**. | `[symbol]/position`·`/portfolio` HTML `<meta name="robots" content="noindex...">`. sitemap.xml에 `/position`·`/portfolio` 경로 없음. |
| I3 | 개인화 ★/수익률은 **SSR/크롤 HTML에 절대 없다**. | raw `curl`(+봇 UA)한 `[symbol]/position` 응답 HTML에 `평단`값/`수익률`/★ 마커/`position-building` 없음(개인화는 client-only, hydration+user 게이트). CTA/`sr-only` 개요만 존재. |
| I4 | `/portfolio`는 auth-guarded — proxy `RESERVED_FIRST_SEGMENTS` + `AUTH_REQUIRED_PATHS` + in-page `redirect(?next=)` 3중 방어. | 익명 요청 → 307 `Location: /login?next=/portfolio`. `/PORTFOLIO`로 티커 오인 301 **없음**. |
| I5 | core 변경 · 신규 env · DB 마이그레이션 **없음**. | `package.json` siglens-core dep 불변, `.env*` 신규 키 없음, drizzle 마이그레이션 파일 신규 없음. |
| I6 | webkit 모바일 헤더 픽스 — 헤더 높이 **미증가**, 탭 nav가 채팅 패널에 가려지지 않음. | ReasoningToggle 터치영역은 out-of-flow `before:`만, 시각 pill은 `h-5 w-9` 유지. 좁은 뷰포트에서 탭 바 클릭 가능. |
| I7 | 익명/미하이드레이션 시 holdings 쿼리·member 청크 미발화(성능 회귀 방지). | 게스트로 `[symbol]/position` 방문 시 `getPortfolioHoldingsAction`/`useSymbolHolding` 네트워크 미발생, member chunk 미다운로드. |
| I8 | 심볼 탭이 탭 바에 노출("내 위치"), crypto 포함. | `/[symbol]` 탭 바에 "내 위치" 탭 존재, 클릭 시 `/[symbol]/position` 이동. |

---

## 3. 테스트 케이스 (실증)

> prod-like 빌드 전제. `curl`은 원시 SSR HTML(JS 미실행) 검사용, 브라우저는 hydration 후 시각/상호작용 검사용.
> 회원 케이스는 로그인 세션(authed) 필요. 고가 종목 라벨 클립 검사는 육안 확인이 핵심.

| ID | 시나리오 | 사전조건/셋업 | 절차 | 기대(관측 가능) 결과 | 확인 방법 |
|---|---|---|---|---|---|
| **T1** | 심볼 탭 — 회원 + 보유 → 빌딩 렌더 | 로그인 회원, 해당 심볼(예: AAPL) 보유(평단 $192 등록) | `/AAPL/position` 접속 → hydration 대기 | `position-building` SVG 렌더. ★평단·●현재 마커가 각각 올바른 층에 위치(★는 평단, ●는 현재가 층). 우측 `PositionCard` readout(최근 고/저·현재가·내 평단·수익률·범위 위치). `role="img"` aria-label = `AAPL 내 위치: 평단 $192, 현재가 $…, 수익률 ±…%, 최근 범위의 …% 지점`. | 브라우저 |
| **T2** | 심볼 탭 — 회원 미보유 / 익명 → CTA, 빌딩 없음, SSR에 ★/수익률 없음 | (a) 로그인 회원 but 미보유, (b) 익명 | (a)(b) `/AAPL/position` 접속. 추가로 `curl -s https://<host>/AAPL/position`, 봇 UA(`-A "Googlebot/2.1"`)로도. | 브라우저: `position-cta`(→`/onboarding` 링크) 표시, `position-building` 0개. curl: 응답 HTML에 `position-building`/★/`평단 $`값/`수익률` **없음**, `sr-only` 개요 + CTA만. `<meta name="robots">`에 `noindex`. | curl + 브라우저 |
| **T3** | **고가 종목 라벨 클립(HIGH 픽스, 핵심 회귀)** | 로그인 회원, $1,000–$5,000대 종목(예: 평단·현재가 4자리 $) 보유 | 해당 종목 `/<SYM>/position` 접속, 빌딩 육안 확인. 필요 시 $100K+ 종목(BRK.A 등)도. | ★평단/●현재 in-SVG 가격 라벨이 viewBox 밖으로 **잘리지 않음**(4자리+ 가격에서도 좌/우 여백 안에 수용). $100K 이상은 `$…K` 축약으로 표시(aria-label은 전체값 유지). | 브라우저(육안) |
| **T4** | `/portfolio` 회원 → 빌딩 카드 그리드, lazy, 카드 클릭 이동 | 로그인 회원, 1+ 보유 | `/portfolio` 접속, 스크롤 | `portfolio-holding-grid` + 보유당 `portfolio-holding-card`(각 미니 `position-building`). 각 카드는 `/<SYM>/position`로 가는 `<Link>`(클릭 시 이동). 뷰포트 진입 전 카드는 스켈레톤, 진입 시 bars fetch 후 렌더(스크롤로 확인). | 브라우저 |
| **T5** | `/portfolio` 빈 보유 → CTA | 로그인 회원, 보유 0 | `/portfolio` 접속 | `portfolio-empty-state`("아직 등록한 보유종목이 없어요" + `/onboarding` 링크). 크래시/빈 화면 없음. | 브라우저 |
| **T6** | `/portfolio` 카드 range fetch 실패 → degrade(크래시 아님) | 로그인 회원, bars fetch가 실패하는 심볼(또는 네트워크 차단으로 유도) | `/portfolio` 접속, 해당 카드 뷰포트 진입 | 해당 카드만 `holding-card-degraded`("범위 데이터를 불러오지 못했어요" + 평단). **그리드 전체·페이지는 유지**(다른 카드 정상). | 브라우저 |
| **T7** | `/portfolio` 익명 → 로그인 리다이렉트 | 세션 쿠키 없음 | `curl -sI https://<host>/portfolio` (리다이렉트 미추적) | **307** + `Location: /login?next=/portfolio`. | curl |
| **T8** | `/portfolio` 티커 오인 라우팅 없음 | — | `curl -sI https://<host>/portfolio` | 301 `/PORTFOLIO`로 **정규화되지 않음**(RESERVED 등록 확인). 익명이면 T7의 307, 회원이면 200. | curl |
| **T9** | 분석 페이지 `/[symbol]` → 위치 위젯 부재 + "내 위치" 탭 존재 + 톱니 미겹침 | 로그인 회원 + 해당 심볼 보유(worst case) | `/AAPL` 접속 | 페이지 정상 렌더(차트/분석). `position-building` 0개, `region[name="내 위치"]` 0개. 탭 바에 "내 위치" 탭 present. 차트 우상단 지표설정 톱니가 **우측 price-scale 눈금 숫자와 겹치지 않음**(`right-14`). | 브라우저 |
| **T10** | 모바일(≤390px) — 빌딩 스케일·라벨·헤더 wrap·탭 nav 비가림 | 모바일 뷰포트(예: 375×667), 회원 보유 | `/AAPL/position`(빌딩)·`/AAPL`(헤더/탭) 각각 확인 | 빌딩 오버플로우 없이 축소·라벨 가독. 헤더 컨트롤(ShareButton/모델셀렉터/ReasoningToggle) wrap·정렬 정상 + 충분한 터치타깃(Share/톱니 44px, ReasoningToggle ~28px). **탭 nav가 채팅 패널에 가려지지 않고 탭 클릭 가능**(webkit 회귀 고정 유지). | 브라우저(모바일/webkit) |
| **T11** | 데스크톱 탭 레이아웃 — dead-space 없음 | 데스크톱 뷰포트, 회원 보유 | `/AAPL/position` 접속 | 빌딩 + readout 카드가 `sm:flex-row`로 나란히, 큰 빈 여백(gutter) 없이 배치(빌딩 `sm:shrink-0`, 카드 `sm:flex-1`). | 브라우저 |
| **T12** | 마커 dodge / 범위 밖 클램프(엣지) | 회원, break-even 근접 종목(평단≈현재가) 및/또는 현재가가 최근 고점 돌파 종목 | 해당 종목 `/<SYM>/position` | 평단≈현재가: ★/● 좌우로 벌어져 구분됨(겹치지 않음). 현재가 > 최근 고점: ● 옥상 위(☁ "최근 고점보다 높은 곳") 라벨. avg가 범위 밖도 동일(★ ☁/▽B1). | 브라우저 |
| **T13** | noindex + sitemap 부재 | — | `curl -s .../AAPL/position | grep robots`; `curl -s .../portfolio | grep robots`; `curl -s .../sitemap.xml | grep -E 'position|portfolio'` | 두 라우트 모두 `noindex`. sitemap에 `/position`·`/portfolio` **없음**. | curl |
| **T14** | 익명 성능 게이트 — holdings 쿼리·member 청크 미발화 | 익명 | `/AAPL/position` 접속, 네트워크 탭 관찰 | `getPortfolioHoldingsAction`/holdings 쿼리 요청 **없음**, member content 청크 미다운로드. CTA만 렌더. | 브라우저(네트워크) |

---

## 4. 알려진 한계 / 수용된 트레이드오프

| # | 항목 | 근거 |
|---|---|---|
| L1 | **ReasoningToggle 탭 영역 ~28px** (WCAG 2.5.8 AA 24px 충족, 2.5.5 AAA 44px 미달) | 44px(`-inset-y-3`)는 `gap-y-2`(8px)를 넘어 인접 wrap 행을 침범 → webkit에서 탭 nav를 채팅 패널 오버랩 밴드로 밀어내는 회귀. 헤더/webkit 픽스 보존을 위해 AAA 포기, out-of-flow 4px/side로 제한. |
| L2 | **`/portfolio` 카드에서 빌딩 ~20% 좁게 렌더**(`max-w-[200px]`) | 컴팩트 그리드 셀 크기 제약. viewBox는 라벨용 side padding을 이미 포함하므로 축소해도 클립 없음, 여유 폭은 라벨로 환원. |
| L3 | **`/portfolio` 카드별 bars fetch 비용** | dynamic(비캐시) 페이지라 매 방문 fetch 가능성. **뷰포트 진입 시 1회 lazy** + 기존 `QUERY_KEYS.bars` 캐시 공유 + 실패 시 카드 degrade로 bound. 서버는 단일 holdings DB 읽기만(N-fetch 팬아웃 없음). |
| L4 | 심볼 탭 SSR range(low/high/lastClose)는 `quantizeBarsDataToLastClosed`로 live 세션 중 마지막 봉을 드롭 → 실행 시각 의존(테스트에서 리터럴 pin 불가, shape-only 단언). | 결정적 SSR 캐시(cookies 없음) 유지가 우선. avg만 사용자 입력이라 pin 가능. |
| L5 | 심볼 탭은 항상 noindex — 익명에겐 차트와 중복인 얇은 가격 층. | 개인화 surface(/account류), 수천 심볼 × 얇은 콘텐츠 = 크롤 예산 낭비·클러스터 희석. |

---

## 5. 실증 체크리스트 (요약)

1. prod-like 빌드 기동.
2. `curl`: T2(SSR ★/수익률 부재 + noindex) · T7/T8(auth 리다이렉트·티커 오인 없음) · T13(noindex/sitemap).
3. 브라우저(데스크톱, 회원): T1 · T4 · T9 · T11 · T12.
4. 브라우저(고가 종목): **T3(라벨 클립 육안 — 핵심)**.
5. 브라우저(모바일/webkit): T10.
6. 브라우저(익명/네트워크): T14 · T5/T6 degrade.
