# `/economy` — 미국 거시 흐름 페이지 설계 (Feature #1)

> 2026-06-16 · 신규 정적 라우트 `/economy`. 미국 거시 국면을 **거시 AI 브리핑 + 카테고리별 경제지표(검증 11종) + 경제 캘린더** 3축으로 제공한다. 브리핑·캐시·ISR은 `/market`(per-market) 레시피를 평행 적용한다(부록 B).
>
> **brainstorming 확정(2026-06-16)**: ① 브리핑 입력용 뉴스 헤드라인 **v1 보류**(지표+캘린더만, graceful) ② revalidate **전체 24h(86400) 단일** ③ 지표 5종 고정 → **카테고리 그룹 레지스트리**(FMP 실측 11종 — 부록 A). PCE·PPI·ISM PMI는 FMP 미지원 확인 → 가용 지표로 대체.

이 문서는 원래 설계의 **두 독립 프로젝트 중 1번**(미국 시장 흐름 페이지)에서 출발하되, 브레인스토밍 결과 **거시 데이터(지표·캘린더)와 뉴스를 응집도 기준으로 분리**하기로 했다. 본 스펙은 **거시 데이터 페이지(`/economy`)** 만 다룬다. 2번([symbol] 재무 강화 = financials)은 `docs/superpowers/specs/2026-06-15-symbol-financials-tab-design.md`로 완료됐다.

**분리 결정 (브레인스토밍 2026-06-16):**
- **시장 뉴스 허브** — 별도 스펙. 뉴스는 5+ 카테고리(일반·주식·암호화폐·외환·아티클)를 갖는 독립 서브시스템이고, 정성 정보 스트림이라 정량 거시 데이터와 응집도가 다르다. AI 분석 단위도 카드/카테고리별 요약이 맞다(per-symbol 뉴스 패턴). `/economy`의 거시 브리핑은 **뉴스 헤드라인 몇 개를 입력으로만** 끌어쓰고, 전체 뉴스 피드는 호스팅하지 않는다.
- **상원/하원 거래(senate-trades)** — 별도 스펙(센티먼트 성격 — financials 스펙 §비목표와 동일 판단).

> 새 세션이 이 스펙으로 구현을 이어받는다. §11(사전 점검 체크리스트)은 **Feature #2(PR #594) 리뷰에서 6라운드에 걸쳐 지적된 항목을 명문화**한 것이다 — 구현 중·후 반드시 대조해 같은 지적을 반복하지 않는다.

---

## 1. 배경 / 문제

기존 `/market`은 "오늘의 미국 주식, **섹터별 기술적 신호**"(market-summary 지수/섹터 ETF + sector-signal 스캐너)로, **기술적 신호** 중심이다. 거시 흐름(경제지표·발표 일정·시장 전체 뉴스)을 다루는 페이지는 없다. 사용자가 "지금 미국 시장이 어떤 거시 국면인가"를 한 페이지에서 파악할 진입점이 부재하다.

`/economy`는 이 공백을 채운다. `/market`(기술)과 명확히 분리된 **거시·흐름** 페이지로, SEO 키워드도 겹치지 않는다("미국 경제 지표", "FOMC 일정", "미국 증시 뉴스" 등).

## 2. 목표 / 비목표

### 목표
1. 신규 정적 라우트 `/economy`에서 3축을 단일 1열로 제공: **거시 AI 브리핑(상단) → 카테고리별 경제지표(금리/물가/성장·경기/고용) → 경제 캘린더**.
2. **core 순수 도메인**: 경제지표·캘린더 wire→domain 정규화 + AI 브리핑 프롬프트 빌더/정규화. **siglens I/O·UI**: FMP 어댑터 + 2계층 캐시 + ISR + 봇 차단.
3. **거시 AI 브리핑** 1개 — 지표 + 임박 캘린더 이벤트 종합(+ 선택적으로 일반/경제 뉴스 헤드라인 소량을 **입력으로만**). `fundamental`/`/market` 패턴대로 **클라 폴링**.
4. 기존 **캐시(2계층: Next Data Cache + Redis `getOrSetCache`, 단일 TTL 상수 공유)**, **ISR 4축 규약**, **봇 차단** 패턴을 그대로 따른다.
5. 어려운 용어는 house style(`~이에요`체) `InfoTooltip`로 풀어준다.
6. 테스트 **커버리지 90% 이상**(변경 전면), happy + worst case, 필요 시 Vitest·Playwright E2E.
7. SEO: 지표·캘린더 텍스트를 SSR HTML에 노출(크롤 가능). canonical/메타/JSON-LD 정상.

### 비목표 (이번 범위 밖)
- **시장 뉴스 피드/허브** — 별도 스펙(§배경 분리 결정). `/economy`는 뉴스를 호스팅하지 않으며, 거시 브리핑 입력용 헤드라인만 소량 사용한다.
- **senate-trades / house-trades** — 별도 스펙.
- **per-symbol overall·ChatPanel 통합** — `/economy`는 종목 페이지가 아니므로 종목 overall 종합 분석·종목 ChatPanel 컨텍스트 전환과 무관. (financials는 종목 탭이라 통합했지만 여기선 해당 없음.)
- **FMP 미지원 지표(PCE·PPI·ISM PMI) / 실적·배당 캘린더** — economic-indicators 가용 11종 + 국채 + 경제 캘린더만. 미지원 지표는 graceful omission, 추후 FMP 외 소스 도입 시 확장.
- **tier 게이팅** — 현재 미작동(메모리)이라 전체 공개.
- 기존 `/market` 동작 변경 — 회귀 위험 0. `/economy`는 신규 독립 라우트.

## 3. 레포 분담 (SCOPE)

`docs/architecture/SCOPE.md` 원칙 — **도메인 로직=core, 외부 I/O·UI=siglens**.

| 항목 | 레포 | 비고 |
|---|---|---|
| `EconomicIndicator`/`EconomicCalendarEvent`/`MarketFlowBriefing` 타입 | core | 도메인 모델 |
| FMP wire→domain 정규화(필드 매핑·단위·부호) | core | financials `normalizeFinancialsSnapshot` 평행 |
| AI 브리핑 프롬프트 빌더 + `normalizeMarketFlowBriefing`(raw→typed) | core | `marketBriefing`/`peekBriefingCache` 평행 |
| FMP `/stable/*` fetch(클라이언트) | **siglens** | I/O는 siglens 책임(메모리 `core_domain_only_siglens_io`) |
| Redis `getOrSetCache` + Next `unstable_cache` + ISR + 봇판정 | **siglens** | 인프라 |
| (브리핑 입력용) 뉴스 헤드라인 소량 조회 | **siglens** | 전체 뉴스 피드 아님 — 헤드라인 N개만. 뉴스 허브는 별도 스펙 |
| UI(페이지·위젯·섹션·InfoTooltip) | **siglens** | |

> ⚠️ core 변경은 **worktree에서 로컬 build → `node_modules/@y0ngha/siglens-core` 덮어쓰기**로 검증(메모리 `siglens_core_release_method`). 정식 publish(GitHub Packages + `v*` tag)는 **사용자가** 수행. cross-repo는 overlay 로컬검증 → core tag 릴리스 → siglens 버전 갱신 + clean install.

## 4. 라우트 & 페이지 구조

- **라우트**: `src/app/economy/page.tsx` (정적 라우트 — 동적 세그먼트 아님 → `generateStaticParams` 불필요, `export const revalidate` 리터럴만).
- **레이아웃 A — 단일 1열 스택**(기존 페이지 일관): 위→아래
  1. `<h1>` SSR (예: "미국 경제 — 지표·캘린더 한눈에") — SEO h1 계약, JS 없이 노출.
  2. **거시 AI 브리핑** — `Suspense` + 클라 폴링. SSR seed는 §6 참조.
  3. **핵심 경제지표 5종** — 카드 그리드(반응형, 모바일 1열). 각 카드: 지표명 + 최신값 + 전기대비(부호색) + 미니 추세 + `InfoTooltip`.
  4. **경제 캘린더** — 다가오는 US 지표 발표(날짜·지표·중요도·예상치·이전치). SSR 텍스트.
- 위젯 슬라이스: `src/widgets/economy/`(권장) — sections/ 하위에 `MacroBriefing`, `EconomicIndicatorGrid`, `EconomicCalendar`. FSD: app이 composition root.

## 5. 데이터 레이어

### 5.1 경제지표 — 카테고리 그룹 레지스트리 (FMP 실측 11종)
brainstorming + FMP 실 API 검증(부록 A) 결과 확정. **카테고리 섹션 그룹**(평면 5카드 아님).

| 카테고리 | 지표(`name`) | 출처 |
|---|---|---|
| 금리 | `federalFunds`(정책금리), 국채 `year2`·`year10` | economic-indicators + treasury-rates |
| 물가 | `inflationRate`(YoY %), `CPI`(레벨) | economic-indicators |
| 성장·경기 | `GDP`, `industrialProductionTotalIndex`(선행), `smoothedUSRecessionProbabilities`(경기침체 확률) | economic-indicators |
| 고용 | `unemploymentRate`, `totalNonfarmPayroll`, `initialClaims` | economic-indicators |

- **레지스트리 패턴**: 지표 메타(name·카테고리·라벨·단위·툴팁)를 한 곳(core 또는 siglens config)에 정의해 그리드가 순회. 새 지표 추가 = 레지스트리 1행.
- **PCE·PPI·ISM PMI는 FMP `Invalid name`(부록 A)** → 미포함. 향후 추가 시 `graceful omission`(미가용 지표는 카드만 빠지고 페이지는 정상) 원칙.
- FMP: `/stable/economic-indicators?name=<NAME>`(지표별 단일 `value` 시계열, `name`+`date`+`value`, 최신→과거 정렬). 지표별 호출.
- 국채: `/stable/treasury-rates`(latest `month1~year30`). 1 호출로 `year2`·`year10` 동시 취득 → **2s10s 스프레드**는 core 파생값(`year10 - year2`).
- core: `normalizeEconomicIndicator(raw) → EconomicIndicator`(최신값 + 직전값 + 추세 포인트 N개), `normalizeTreasuryRates(raw) → TreasuryRateSnapshot`, `computeYieldSpread(snapshot) → number`(2s10s).
- siglens: provider + `Cached*Provider`(React.cache 요청 내 dedup) → `getOrSetCache`(Redis) → `unstable_cache`(Next ISR). 키 지표별 `economy:indicator:<name>`, 국채 `economy:treasury`. 태그 `economy:indicators`.

### 5.2 경제 캘린더
- FMP: `/stable/economic-calendar?from=&to=`. US·중요도 필터(core 도메인 필터 함수). 다가오는 ~2주 윈도.
- core: `normalizeEconomicCalendar(raw) → EconomicCalendarEvent[]`(날짜·지표·중요도·actual/estimate/previous).
- siglens: 캐시 키 `economy:calendar:<ISO주차>`, 태그 `economy:calendar`. TTL = `SECONDS_PER_DAY`(86400, §8 전체 단일과 동일). 발표 직후 `actual` 갱신 지연은 24h 한도 — 사용자 확정(전체 24h 단일). 즉시 반영이 필요하면 `revalidateTag('economy:calendar')` on-demand 훅 후속.

### 5.3 빈 결과 캐시 오염 방지
- financials `cacheNonEmpty` 패턴 적용: provider가 FMP 일시 장애를 swallow해 `[]`를 resolve할 때 그 `[]`를 캐싱하면 revalidate까지 빈 데이터가 고정된다. fetcher 안에서 **빈 결과면 전용 에러(예: `EmptyResultError extends Error`) throw → `unstable_cache`가 set 건너뜀 → 바깥 catch에서 `[]` graceful degrade**. (메시지 문자열 비교 금지 — `instanceof`. §11 참조.)

### 5.4 2계층 캐시 단일 TTL
- TTL 상수는 **한 곳에서 정의해 양 계층이 공유**(중복 계산·드리프트 금지 — §11 §16.5). config fingerprint를 키에 박는 경우 상수를 export해 static/runtime 캐시가 import 재사용.

## 6. 거시 AI 브리핑 (per-market — `/market` 미러링, 부록 B.0)
- **브리핑 입력 = 경제지표 스냅샷 + 임박 캘린더 이벤트**(뉴스 헤드라인 **v1 보류** — brainstorming 확정). 종목 없는 시장 브리핑이라 financials per-symbol 패턴이 아닌 `/market` `submitMarketBriefingAction`/`useBriefing`/`peekBriefingStatic` 구조를 미러링.
- core: 프롬프트 빌더(지표 스냅샷 + 캘린더 임박 이벤트) + `normalizeMacroBriefing(raw→typed)`. `PROMPT_TEMPLATE_VERSION` 캐시 키 규약 준수(메모리 `prompt_template_cache_version`).
  - 뉴스 헤드라인 입력은 v1 미포함. 후속 추가 시 빌더가 헤드라인 N개를 **입력 텍스트로만** 수용(페이지가 뉴스를 렌더하지 않음), 조회 실패 graceful — 빌더 시그니처를 선택적 인자로 열어 둠.
- siglens: submit/poll Server Action + 클라 폴링 훅. **봇은 skipEnqueue**(메모리 봇 비용 캐싱). 잡 lifecycle·쿨다운은 기존 분석 패턴 재사용(코어 도메인).
- SSR seed: `/market`의 `peekBriefingStatic`처럼 cached 브리핑을 **읽기 전용** peek로 SSR 노출(side-effect 없음) 또는 미사용(지표·캘린더 텍스트가 이미 SEO 충족). **구현 시 택1** — 기본은 peek seed 노출(`/market` 일관성). cold-gen에서 `connection()`/`cookies()`/`headers()` **금지**(메모리 `isr_connection_coldgen_500` — ISR cold-gen DSU→500).

> **시장 뉴스 허브는 별도 스펙**(§배경 분리 결정). 5+ 카테고리(일반·주식·암호화폐·외환·아티클) 구조, 카테고리별 AI 요약, `news-article` DB 파이프라인 확장(시장 버킷)은 그 스펙에서 설계한다.

## 7. SEO / ISR (4축 규약 — `src/app/CLAUDE.md`)
- **축 0**: 공유 셸 `cookies()`/`headers()` 금지(이미 충족 — 확인만). 봇 판정은 클라/액션 트리거로.
- **축 1**: redis/DB/FMP는 `unstable_cache`로 정적화(revalidate + 태그).
- **축 2**: `useSearchParams` 쓰는 클라 위젯이 있으면 SSR 크롤 텍스트를 서버컴포넌트로 분리. `/economy`는 searchParams 의존이 없을 가능성이 높음 — 있으면 적용.
- **축 3**: 정적 라우트라 `export const revalidate = <리터럴>`만(`generateStaticParams` 불필요). **리터럴 강제**(import 상수·식 금지 → config 무시되어 ISR 깨짐, §10). 확정값 **86400(24h)** — brainstorming 확정. 지표·셔는 월·분기 단위로 느리게 변하고 신선도는 클라 refetch가 책임(`/economy`는 시장요약처럼 분초 변동 없어 클라 refetch도 가벼움). 페이지 리터럴 + 양 데이터축 `unstable_cache` revalidate **모두 86400 단일**(`SECONDS_PER_DAY` 공유).
- 메타데이터: title/description(clampSeoDescription)/keywords/canonical(`/economy`)/OG/Twitter. JSON-LD: WebPage + BreadcrumbList. 빈/degrade 시 noindex 일치(§9).
- og 이미지 정적화(`dynamic='force-static'`) 패턴 따름.
- **검증**: `prod build` output(`● SSG`/ISR) + `curl -I`(`x-nextjs-cache: HIT`) + 런타임 로그(`DYNAMIC_SERVER_USAGE` 0) + Chrome로 SSR HTML/메타/JSON-LD 실측(메모리 `worktree_node_modules_prod_verify`).

## 8. 에러 처리 / degrade
- FMP 일시 장애: 5xx/빈결과는 **degrade 안내(200)** 렌더 + 해당 섹션 noindex 정합(financials `FinancialsDegraded` 패턴). 전 축 동시 실패 시 페이지 degrade.
- 섹션별 독립 degrade(지표 실패해도 캘린더는 표시) — `Promise.all` 각 분기 graceful.
- 클라이언트 노출 에러는 generic 메시지.

## 9. overall/chat 통합
- 해당 없음(§2 비목표). `/economy`는 시장 페이지로 종목 도메인과 분리.

## 10. 사전 점검 체크리스트 (Feature #2 / PR #594 리뷰 지적 명문화) ⚠️필수
구현 중·후 이 표와 대조한다. (괄호 = MISTAKES.md 조항 / 발생 라운드)

| # | 규칙 | 적용 |
|---|---|---|
| 1 | **named 반환 타입**(§5.3 / R3) | 함수 반환 타입에 인라인 객체 리터럴 금지 → `interface`/`type` 명명 |
| 2 | **매직넘버 상수화**(§15 / R1·R4) | 리터럴 하드코딩 금지 → 명명 상수. 테스트도 fixture `.length` 등으로 동기화 |
| 3 | **route config는 리터럴 예외**(§15 / app CLAUDE) | `export const revalidate`는 **리터럴 유지**(상수 추출 금지 — ISR 깨짐) |
| 4 | **WHAT 주석 금지**(§15.3 / R3·R5) | 코드가 말하는 것 반복 금지. WHY만, non-obvious할 때만 |
| 5 | **false/부정확 WHY 주석 금지**(§15.6 / R4·R5) | 캐시·`React.cache` 등 클레임은 **실제 구현과 일치 검증** 후 작성. empty/non-empty 경로 구분 정확히 |
| 6 | **fingerprint/상수 중복 계산 금지**(§16.5 / R3) | 공유 가능하면 export+import 재사용(static/runtime 캐시 한 곳 정의) |
| 7 | **side-effect util은 `utils/`**(§0.6 / R3) | `window` 읽는 등 유틸은 슬라이스 `utils/` 하위로 분리 |
| 8 | **새 분기 양방향 테스트**(Tests §18 / R3) | threshold/conditional은 true·false 모두 |
| 9 | **미검증 분기 금지**(Tests §22 / R4·R5) | sentinel throw→catch, graceful degrade 경로 직접 테스트 |
| 10 | **`as never` 금지**(TS §7 / R5) | bottom-type 우회 금지 → `as unknown as <Type>`(또는 제네릭 헬퍼). Vitest 예외는 `fn as MockedFunction`에만 |
| 11 | **role ↔ aria-hidden 모순 금지**(a11y §3 / R5) | 마우스 전용 요소는 `role` 빼고 `aria-hidden` + `data-testid`로 테스트 |
| 12 | **단일 it() 복수 단언 지양**(R5) | facet별 `it()` 분리(공유 `beforeEach` 렌더) |
| 13 | **동어반복 단언 금지**(Tests §13 / R1) | `expect(CONST).toBe(리터럴)` 류 제거 → 동작 검증 |
| 14 | **커스텀 에러 클래스**(R4) | sentinel은 메시지 문자열 비교 말고 `instanceof` |
| 15 | **2계층 캐시 단일 TTL**(financials) | TTL 상수 공유 |
| 16 | **AI 클라 폴링 / cold-gen 안전**(메모리) | `connection()`/`cookies()`/`headers()` ISR cold-gen 금지(500) |
| 17 | **봇 skipEnqueue**(메모리) | AI 잡 봇 비용 차단 |
| 18 | **빈 결과 캐시 오염 방지**(§5.3 본문) | `cacheNonEmpty` 패턴 |
| 19 | **empty/degrade → noindex 일치**(financials) | 메타와 본문 판정 동일 소스 |
| 20 | **커버리지 90%+ happy+worst**(목표 7) | 변경 전면 |

## 11. 구현 순서 (Phase 분해 — 새 세션용)
0. **전제 — 패턴 핀 읽기**: §부록 B(코드베이스 패턴 핀)를 먼저 읽는다. 브리핑은 `/market`(per-market) 패턴 미러링(financials per-symbol 아님), 뉴스 헤드라인 입력은 v1 보류 기본값임을 인지하고 시작.
1. **Phase 0 — FMP 검증**: §부록 A 실 API 호출로 economic-indicators/economic-calendar(+선택: 시장 헤드라인 endpoint) 필드·플랜 확인. 결과로 §5 타입 확정.
2. **Phase 1 — core 도메인**: 타입 + 정규화 + 브리핑 프롬프트/normalize + 캘린더 US·중요도 필터. 단위 테스트. worktree 로컬 build.
3. **Phase 2 — siglens 데이터**: FMP 클라이언트 + Cached provider + 2계층 캐시 + `cacheNonEmpty`. Fake provider(E2E). 테스트.
4. **Phase 3 — 거시 AI 브리핑**: submit/poll action + 클라 폴링 훅 + (peek seed) + 브리핑 입력용 헤드라인 소량 조회. 봇 skipEnqueue. 테스트.
5. **Phase 4 — UI**: `widgets/economy` 섹션 3종(브리핑·지표·캘린더) + InfoTooltip + degrade. `frontend-design`→`web-design-guidelines` 스킬.
6. **Phase 5 — 페이지·SEO·ISR**: `app/economy/page.tsx` + 메타·JSON-LD + revalidate 리터럴 + SSR 텍스트. `seo-audit` 스킬.
7. **Phase 6 — E2E·실증**: Playwright happy/worst + prod-like build 실측(curl + Chrome + DSU 0).
> 각 Phase: 인터페이스(types) 먼저 → 구현 → 테스트 동행. PR별 리뷰 루프(claude-code-review).

### Cross-repo 작업 프로토콜 (사용자 확정 2026-06-16)
core 변경이 선행하는 Phase(1·3의 도메인 부분)는 **siglens-core를 먼저 작업한다.** 병목 최소화를 위해 **정식 publish를 기다리지 않고** 로컬 빌드 overlay로 siglens 작업을 이어간다:
1. siglens-core 워크트리에서 도메인 구현 + 단위 테스트 + `yarn build`(tsc+tsc-alias).
2. 빌드 산출물(`dist/`)을 siglens `node_modules/@y0ngha/siglens-core/`에 **overlay 덮어쓰기** → siglens가 신규 core API를 즉시 import 가능.
3. siglens 측 어댑터·UI 작업 진행(overlay 기준 빌드/테스트).
4. **siglens-core 정식 배포(GitHub Packages + `v*` tag)는 사용자가 직접 수행** — Claude는 publish 명령을 실행하지 않는다(메모리 `user_handles_core_publish`).
5. 배포 후 siglens `package.json`의 core 버전 핀 갱신 + clean install로 CI 정합 확보. (overlay는 로컬 검증 전용 — 버전 핀 갱신 전까지 siglens CI는 신 core를 못 봄, 메모리 `siglens_core_release_method`.)
> ⚠️ overlay 후 워크트리 node_modules는 `cp -al` 하드링크 주의(symlink 금지) + core 버전 핀 불일치 트랩(메모리 `worktree_node_modules_prod_verify`·`worktree_core_version_mismatch`).

## 부록 A — FMP endpoint 검증 결과 (Phase 0 — 2026-06-16 실측 완료)
`.env.local`의 `FMP_API_KEY`로 실 API 호출 검증함(현 플랜에서 402 없음 — 전부 200).

### A.1 economic-indicators — `name` 가용성
`GET /stable/economic-indicators?name=<NAME>` → 응답은 `[{ name, date, value }]` 단일 값 시계열(최신→과거 정렬, 추세 포인트 free).

| name | 결과 | 채택 |
|---|---|---|
| `federalFunds` | ✅ value(%, 월간) | ✅ 금리 |
| `inflationRate` | ✅ value(YoY %) | ✅ 물가 |
| `CPI` | ✅ value(지수 레벨) | ✅ 물가 |
| `GDP` / `realGDP` | ✅ value(분기) | ✅ 성장 (GDP) |
| `industrialProductionTotalIndex` | ✅ value(지수) | ✅ 성장·경기 |
| `smoothedUSRecessionProbabilities` | ✅ value(확률) | ✅ 성장·경기 |
| `unemploymentRate` | ✅ value(%) | ✅ 고용 |
| `totalNonfarmPayroll` | ✅ value(천명) | ✅ 고용 |
| `initialClaims` | ✅ value(주간) | ✅ 고용 |
| `consumerSentiment`·`retailSales`·`durableGoods`·`totalVehicleSales`·`newPrivatelyOwnedHousingUnitsStartedTotalUnits`·`30YearFixedRateMortgageAverage` | ✅ (가용, 확장 후보) | ⬜ v1 미채택 |
| **`PCE`·`PPI`·`ISM PMI`**(모든 표기) | ❌ `Invalid name` | ❌ 대체로 처리 |

### A.2 treasury-rates
`GET /stable/treasury-rates` → `[{ date, month1, month2, month3, month6, year1, year2, year3, year5, year7, year10, year20, year30 }]`. ✅ `year2`·`year10`로 2s10s 스프레드 파생.

### A.3 economic-calendar
`GET /stable/economic-calendar?from=&to=` → `[{ date, country, event, currency, previous, estimate, actual, change, impact, changePercentage, unit }]`. `impact` = `Low`/`Medium`/`High`. ✅ `country==='US'` + impact 필터(core 도메인 함수). from/to 미지정 시 전 국가 반환 → **반드시 from/to + US 필터**.

### A.4 뉴스 헤드라인
시장 전체(symbol 무관) 헤드라인은 v1 보류(§6) → 본 Phase 0 범위 제외. 후속 도입 시 `news/general` 등 별도 검증.

---

## 부록 B — 코드베이스 패턴 핀 (탐색 결과 2026-06-16)

> 본 스펙의 추상 참조("financials 평행", "`/market` 레시피")를 **실제 파일·시그니처**로 고정한다. 구현자는 §5·§6·§7 작업 전 이 표를 읽고 어느 패턴을 미러링할지 확정한다. (탐색 3종: financials 구현 / `/market` 브리핑·ISR / FMP·core 구조.)

### B.0 ⚠️ 결정적 발견 — 구현 전 반드시 인지

1. **`/economy` 브리핑은 `/market`(per-market) 패턴이지 financials(per-symbol) 패턴이 아니다.**
   - `/economy`는 종목이 없는 시장 페이지다. 브리핑은 종목별 분석이 아니라 **시장 스냅샷(지표+캘린더) 1개 입력 → 브리핑 1개**다.
   - 따라서 §6·§Phase 3은 `/market` 브리핑 스택을 미러링한다 (financials의 per-symbol submit/poll/cancel + chat + overall 통합은 **해당 없음** — §9와 일치).
   - 미러링 대상 실제 파일:
     - submit action: `src/entities/market-summary/actions/submitMarketBriefingAction.ts` — `isBot(headers)` 시 `{ briefing: null, botBlocked: true }` 즉시 반환(잡 미제출=skipEnqueue 역할), 캐시된 시장 스냅샷을 입력으로 core `submitBriefing(summary)` 위임.
     - poll action: `pollBriefingAction` (5s 폴링, `useBriefing.ts`의 `POLL_INTERVAL_MS = 5_000`).
     - 폴링 훅: `src/widgets/dashboard/hooks/useBriefing.ts` + `useMarketBriefing.ts`(peekSeed prop 수용, `done` 시 `refetchInterval=false`, `staleTime: Infinity`).
     - peek seed: `src/entities/market-summary/api/briefingStaticCache.ts`의 `peekBriefingStatic(summary, dateHour)` → core `peekBriefingCache()`(read-only, side-effect 없음) → `unstable_cache([], ['briefing-peek-static', dateHour], { revalidate: SECONDS_PER_HOUR, tags: ['market:briefing'] })`. 페이지에서 `.catch(() => null)` 무음 miss.
   - **economy 브리핑 입력 = 경제지표 스냅샷 + 임박 캘린더 이벤트**(+선택적 헤드라인 — B.0.2 참조). `submitEconomyBriefingAction`는 `getCachedEconomy*()`를 입력으로 받아 core 브리핑 빌더에 넘긴다.

2. **시장 전체 뉴스 헤드라인 endpoint가 코드베이스에 미통합 — §부록 A 전제가 틀림.**
   - 기존 `src/entities/news-article/lib/fmpNewsClient.ts`는 `news/stock?symbols=<SYM>`로 **symbol 필수**다. symbol-agnostic(시장 전체) 헤드라인 메서드가 없다.
   - 따라서 "기존 fmpNewsClient endpoint로 시장 전체 헤드라인 조회"는 **불가**. 선택지:
     - **(A) v1에서 헤드라인 입력 보류** — 지표+캘린더만으로 브리핑(스펙이 이미 graceful degrade로 허용, §6). **권장 기본값** — 스코프 최소화, 뉴스 허브 별도 스펙과 충돌 방지.
     - **(B) Phase 0에서 FMP general-news endpoint(예: `news/general`/`fmp-articles`/`news/stock-latest`) 실검증** 후 신규 siglens 클라이언트(I/O) 추가. 플랜 지원·402 확인 필수.
   - **결정 사항(브레인스토밍에서 확정할 것)**: A로 출발하고 B는 후속. 헤드라인은 어차피 "입력으로만"이고 실패 시 graceful이므로 v1 미포함이 응집도·리스크 면에서 유리.

3. **경제지표·캘린더는 완전 그린필드** — `economic-indicators`/`economic-calendar`/`federalFunds`/`CPI` grep 결과 코드베이스에 흔적 0. 재사용할 어댑터 없음 → §5 전부 신규.

### B.1 캐시 2계층 — 실제 미러링 대상

`/market`의 market-summary 스택이 정확한 템플릿(per-market, 종목 무관):

| 계층 | financials(per-symbol) | **market-summary(per-market) ← economy 미러링** |
|---|---|---|
| React.cache 요청 dedup + Redis `getOrSetCache` | `entities/financials-statements/lib/getFinancialsSnapshot.ts` | `entities/market-summary/api/marketSummaryCache.ts`의 `getCachedMarketSummary = cache(...)` |
| Next `unstable_cache`(ISR) | `app/[symbol]/financials/...` | `entities/market-summary/api/marketSummaryStaticCache.ts` — `unstable_cache(fn, ['market-summary-static', FINGERPRINT], { revalidate: SECONDS_PER_HOUR, tags: ['market:summary'] })` |
| shouldCache 가드(빈결과 미오염) | `cacheNonEmpty` + `EmptyResultError`(`getFinancialsSnapshot`) | `allQuotesPresent`(0 quote 거부) / sector는 `stocks.length > 0` |
| config fingerprint | — | `createCacheConfigFingerprint(JSON.stringify(config))` 키에 임베드, 변경 시 자동 무효 |

- **economy 적용**: `economy:indicator:<name>` / `economy:calendar:<ISO주차>` 키, 태그 `economy:indicators` / `economy:calendar`(독립 revalidateTag 위해 분리 — `/market`이 `market:summary`/`market:briefing`/`sector:signals` 3분리한 것과 동일 이유).
- **단일 TTL 상수**: `src/shared/config/time.ts`의 `SECONDS_PER_HOUR = 3600`(=`/market` revalidate)·`SECONDS_PER_DAY = 86400`(=financials)에서 import. economy 권장 = `SECONDS_PER_HOUR`(§8 3600 근거와 일치). 양 계층(`unstable_cache` revalidate + `getOrSetCache` TTL)이 **같은 상수 참조**(§10 #6·#15).

### B.2 FMP I/O — 실제 인프라

- HTTP 클라이언트: `src/shared/api/fmp/httpClient.ts` — base `https://financialmodelingprep.com/stable`, `fmpGet<T>(path, query, { revalidate })`, 10s timeout, `readFmpConfig()`(core)로 API 키, 429/5xx/timeout 3회 재시도(`fmpRetry.ts`).
- 402 처리: `src/shared/api/fmp/fmpUserMessage.ts`의 `logFmpPaymentRequiredError()`(WeakSet dedup, `FmpHttpError.status===402`). economy provider도 동일 사용.
- 어댑터 패턴(미러링): `FmpMarketProvider.ts`(클라이언트) → `getMarketDataProvider.ts`(factory, E2E 시 `FakeMarketProvider` dynamic require). economy = `FmpEconomyProvider` + `getEconomyProvider()` + `FakeEconomyProvider`(결정적 fixture).
- 환경변수: `FMP_API_KEY`(`.env.local`에 존재 확인). 신규 env 불필요.

### B.3 core 0.23.0 — 도메인 추가 패턴

- 위치: source `/Users/y0ngha/Project/siglens-core/`(sibling), 설치 `node_modules/@y0ngha/siglens-core@0.23.0`. **barrel import만**(`@y0ngha/siglens-core`), deep import 금지.
- 정규화 템플릿: `siglens-core/src/domain/analysis/normalizeFinancials.ts` + primitive coercer `normalizePrimitives.ts`(`asString`/`asNumber`/`asEnum`/`asArray`/`asIsoDate`/`compact`). LLM/wire `unknown` 입력 → 방어적 타입 출력, malformed child drop, JSON 파싱 실패만 throw.
- 추가 절차: ① `domain/types.ts`에 `EconomicIndicator`/`EconomicCalendarEvent`/`MarketFlowBriefing` 정의 → ② `domain/analysis/normalizeEconomic.ts` 신규 → ③ `src/index.ts` 배럴 export.
- 검증 플로우(메모리 `siglens_core_release_method`): worktree 로컬 `yarn build`(tsc+tsc-alias) → siglens `node_modules/@y0ngha/siglens-core/dist` 덮어쓰기로 overlay 검증 → 정식 publish(GitHub Packages + `v*` tag)는 **사용자**가 → siglens `package.json` 버전 핀 갱신 + clean install. (정식 publish 없이는 siglens CI가 신버전 못 봄.)

### B.4 페이지·SEO·ISR — 실제 템플릿

- 라우트 템플릿: `src/app/market/page.tsx` — `export const revalidate = 3600;`(**리터럴**, `// 1h — ISR.` 인라인), searchParams 미사용(timeframe/sector는 위젯 CSR `useSearchParams`).
- `generateMetadata`: `clampSeoDescription()`(120자), `keywords: [...ROOT_KEYWORDS, ...]`, `alternates.canonical`(쿼리 없는 clean URL), `openGraph`(locale `ko_KR`, `OG_IMAGE_WIDTH/HEIGHT`), `twitter`. title은 "| Siglens" 없이(root layout이 append).
- 축 2(SSR 크롤 텍스트): `useSearchParams` 쓰는 CSR 위젯의 Suspense fallback에 서버 렌더 크롤 텍스트(`SectorFactsSummary`/`TechnicalFactsSummary` 선례). `/economy`는 searchParams 의존 없을 가능성 높음 → 지표·캘린더 서버컴포넌트 텍스트가 이미 충족.
- og 이미지: `export const dynamic = 'force-static'`(params는 유지, cookies/headers/searchParams 금지).
- InfoTooltip: `src/shared/ui/InfoTooltip.tsx`, house style `~이에요`체(정의→해석→주의, `max-w-xs`). 선례: `SectorSignalPanel.tsx`.
- 봇: `src/shared/api/isBot.ts`의 `isBot()`(UA regex + Next `userAgent()`) — 잡 제출만 차단, 데이터 read는 통과.
