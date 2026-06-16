# `/economy` — 미국 거시 흐름 페이지 설계 (Feature #1)

> 2026-06-16 · 신규 정적 라우트 `/economy`. 미국 거시 국면을 **거시 AI 브리핑 + 핵심 경제지표 5종 + 경제 캘린더** 3축으로 제공한다. financials(#2)·`/market` ISR 레시피를 완전 평행 적용한다.

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
1. 신규 정적 라우트 `/economy`에서 3축을 단일 1열로 제공: **거시 AI 브리핑(상단) → 핵심 경제지표 5종 → 경제 캘린더**.
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
- **경제지표 6종+ 확장 / 실적·배당 캘린더** — 핵심 5종 + 경제 캘린더만. 추후 확장.
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

### 5.1 경제지표 5종
- 대상: **연방기금금리, CPI(인플레이션), 실업률, GDP 성장률, 10년물 국채수익률**.
- FMP: `/stable/economic-indicators?name=<INDICATOR>`(지표별 시계열). 5종 → 5 호출(또는 배치). **구현 게이트**: 실제 endpoint·필드·플랜 지원을 **실 API 호출로 검증**(§부록 A, financials §부록 A 선례).
- core: `normalizeEconomicIndicator(raw) → EconomicIndicator`(최신값 + 직전값 + 추세 포인트 N개).
- siglens: provider + `Cached*Provider`(React.cache 요청 내 dedup) → `getOrSetCache`(Redis) → `unstable_cache`(Next ISR). 키 `economy:indicator:<name>`, 태그 `economy:indicators`.

### 5.2 경제 캘린더
- FMP: `/stable/economic-calendar?from=&to=`. US·중요도 필터(core 도메인 필터 함수). 다가오는 ~2주 윈도.
- core: `normalizeEconomicCalendar(raw) → EconomicCalendarEvent[]`(날짜·지표·중요도·actual/estimate/previous).
- siglens: 캐시 키 `economy:calendar:<ISO주차>`, 태그 `economy:calendar`. TTL은 캘린더 신선도(발표 갱신) 고려 — §8 revalidate와 정합.

### 5.3 빈 결과 캐시 오염 방지
- financials `cacheNonEmpty` 패턴 적용: provider가 FMP 일시 장애를 swallow해 `[]`를 resolve할 때 그 `[]`를 캐싱하면 revalidate까지 빈 데이터가 고정된다. fetcher 안에서 **빈 결과면 전용 에러(예: `EmptyResultError extends Error`) throw → `unstable_cache`가 set 건너뜀 → 바깥 catch에서 `[]` graceful degrade**. (메시지 문자열 비교 금지 — `instanceof`. §11 참조.)

### 5.4 2계층 캐시 단일 TTL
- TTL 상수는 **한 곳에서 정의해 양 계층이 공유**(중복 계산·드리프트 금지 — §11 §16.5). config fingerprint를 키에 박는 경우 상수를 export해 static/runtime 캐시가 import 재사용.

## 6. 거시 AI 브리핑
- core: 프롬프트 빌더(지표 스냅샷 + 캘린더 임박 이벤트 + **선택적으로** 일반/경제 뉴스 헤드라인 N개) + `normalizeMacroBriefing(raw→typed)`. `PROMPT_TEMPLATE_VERSION` 캐시 키 규약 준수(메모리 `prompt_template_cache_version`).
  - 뉴스 헤드라인은 **입력 텍스트로만** 사용(페이지가 뉴스를 렌더하지 않음). 헤드라인 조회 실패 시 지표+캘린더만으로 브리핑(graceful).
- siglens: submit/poll Server Action + 클라 폴링 훅. **봇은 skipEnqueue**(메모리 봇 비용 캐싱). 잡 lifecycle·쿨다운은 기존 분석 패턴 재사용(코어 도메인).
- SSR seed: `/market`의 `peekBriefingStatic`처럼 cached 브리핑을 **읽기 전용** peek로 SSR 노출(side-effect 없음) 또는 미사용(지표·캘린더 텍스트가 이미 SEO 충족). **구현 시 택1** — 기본은 peek seed 노출(`/market` 일관성). cold-gen에서 `connection()`/`cookies()`/`headers()` **금지**(메모리 `isr_connection_coldgen_500` — ISR cold-gen DSU→500).

> **시장 뉴스 허브는 별도 스펙**(§배경 분리 결정). 5+ 카테고리(일반·주식·암호화폐·외환·아티클) 구조, 카테고리별 AI 요약, `news-article` DB 파이프라인 확장(시장 버킷)은 그 스펙에서 설계한다.

## 7. SEO / ISR (4축 규약 — `src/app/CLAUDE.md`)
- **축 0**: 공유 셸 `cookies()`/`headers()` 금지(이미 충족 — 확인만). 봇 판정은 클라/액션 트리거로.
- **축 1**: redis/DB/FMP는 `unstable_cache`로 정적화(revalidate + 태그).
- **축 2**: `useSearchParams` 쓰는 클라 위젯이 있으면 SSR 크롤 텍스트를 서버컴포넌트로 분리. `/economy`는 searchParams 의존이 없을 가능성이 높음 — 있으면 적용.
- **축 3**: 정적 라우트라 `export const revalidate = <리터럴>`만(`generateStaticParams` 불필요). **리터럴 강제**(import 상수·식 금지 → config 무시되어 ISR 깨짐, §10). 권장값 **3600(1h)** — 캘린더 신선도 기준, 단일 페이지라 재생성 비용 작음(`/market`과 동일 근거).
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
1. **Phase 0 — FMP 검증**: §부록 A 실 API 호출로 economic-indicators/economic-calendar(+브리핑 입력용 헤드라인) endpoint·필드·플랜 확인. 결과로 §5 타입 확정.
2. **Phase 1 — core 도메인**: 타입 + 정규화 + 브리핑 프롬프트/normalize + 캘린더 US·중요도 필터. 단위 테스트. worktree 로컬 build.
3. **Phase 2 — siglens 데이터**: FMP 클라이언트 + Cached provider + 2계층 캐시 + `cacheNonEmpty`. Fake provider(E2E). 테스트.
4. **Phase 3 — 거시 AI 브리핑**: submit/poll action + 클라 폴링 훅 + (peek seed) + 브리핑 입력용 헤드라인 소량 조회. 봇 skipEnqueue. 테스트.
5. **Phase 4 — UI**: `widgets/economy` 섹션 3종(브리핑·지표·캘린더) + InfoTooltip + degrade. `frontend-design`→`web-design-guidelines` 스킬.
6. **Phase 5 — 페이지·SEO·ISR**: `app/economy/page.tsx` + 메타·JSON-LD + revalidate 리터럴 + SSR 텍스트. `seo-audit` 스킬.
7. **Phase 6 — E2E·실증**: Playwright happy/worst + prod-like build 실측(curl + Chrome + DSU 0).
> 각 Phase: 인터페이스(types) 먼저 → 구현 → 테스트 동행. PR별 리뷰 루프(claude-code-review). cross-repo는 core 먼저 릴리스(사용자) 후 siglens.

## 부록 A — FMP endpoint 검증 게이트 (Phase 0)
구현 전 실 API 호출로 확인할 것:
- `GET /stable/economic-indicators?name=GDP|CPI|unemploymentRate|federalFunds|...` — 정확한 `name` 파라미터 값/응답 시계열 필드.
- `GET /stable/economic-calendar?from=&to=` — country 필터·`impact`/`estimate`/`previous`/`actual` 필드.
- (브리핑 입력용) 일반/경제 뉴스 헤드라인 endpoint — 기존 `fmpNewsClient`가 쓰는 endpoint로 시장 전체(symbol 무관) 헤드라인 N개 조회 가능 여부. **전체 뉴스 피드는 본 스펙 범위 아님**(뉴스 허브 별도 스펙).
- 플랜 tier가 위 endpoint를 지원하는지(402 Payment Required 여부 — `logFmpPaymentRequiredError` 참고).
결과를 이 부록에 표로 기록하고 §5 타입을 확정한다.
