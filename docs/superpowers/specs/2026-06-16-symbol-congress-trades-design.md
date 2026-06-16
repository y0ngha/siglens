# `/[symbol]/congress` — 의회 거래 탭 설계 (senate + house)

> 2026-06-16 · 신규 종목 탭 `/[symbol]/congress`. 미국 **상원+하원 의원의 해당 종목 거래 공시**를 표로 열람하고, **AI 동향 해석**을 단다. financials 탭(#2) 레시피를 완전 평행 적용한다(per-symbol ISR/SEO/캐시/봇/클라폴링).

이 문서는 financials 스펙(`2026-06-15-symbol-financials-tab-design.md`) §비목표에서 "센티먼트 성격 — 별도 스펙"으로 분리한 **의회 거래** 기능의 설계다. 거시(`/economy`)·뉴스 허브(`/news`)와 함께 원래 "시장 흐름" 구상에서 응집도 기준으로 분리된 산출물 중 하나다.

> 새 세션이 이 스펙으로 구현을 이어받는다. §9(사전 점검 체크리스트)은 Feature #2(PR #594) 리뷰 6라운드 지적을 명문화한 것 — 구현 중·후 반드시 대조한다.

---

## 1. 배경 / 문제
의원(상·하원)의 주식 거래는 **STOCK Act** 공시 대상이며, 시장에서 주목받는 **센티먼트/정보 신호**다(예: 특정 종목에 의원 매수 집중). 현재 SigLens엔 이 데이터가 없다. financials와 응집도가 달라(회계 데이터 ≠ 정치인 거래) 별도 탭으로 둔다.

특성상 주의점: **공시 지연(약 45일)**, **종목별 희소**(거래 없는 종목 다수). → 빈/degrade 처리가 핵심.

## 2. 목표 / 비목표
### 목표
1. 신규 종목 탭 `/[symbol]/congress`에서 **상원+하원** 거래 공시를 표로 열람(의원·정당·chamber·매수/매도·금액 구간·거래일·공시일).
2. **AI 동향 해석** 1개 — "최근 순매수 우세, N명 집중" 류. financials AI 요약 평행, **클라 폴링**.
3. core=도메인(타입·정규화·동향 프롬프트), siglens=I/O(FMP senate/house fetch·캐시·ISR·봇).
4. **ChatPanel 컨텍스트 전환**(congress 탭 → 의회 거래 컨텍스트). financials `buildChatState` 평행.
5. 2계층 캐시·ISR 4축·봇 차단·클라 폴링 준수. 빈 결과 캐시오염 방지.
6. 테스트 90%+(변경 전면), happy+worst, Vitest·Playwright E2E.
7. SEO: 거래 표·AI 해석 SSR 노출, 빈/degrade→noindex 일치.

### 비목표
- **overall 종합분석 점수 축 통합** — 제외. 의회 거래는 희소·지연 데이터라 정량 스코어화 부적절(과투자 방지). (financials는 통합했으나 여기선 chat만.)
- **시장 전체 의회 거래 피드/리더보드** — 본 스펙은 per-symbol 탭만. 시장 피드는 추후 별도.
- **tier 게이팅** — 전체 공개.
- 기존 탭 동작 변경 — congress 탭 추가만(회귀 0).

## 3. 레포 분담 (SCOPE)
| 항목 | 레포 |
|---|---|
| `CongressTrade`/`Chamber` 타입 + wire→domain 정규화 + 동향 프롬프트/normalize | core |
| FMP `senate-trading`/`house-disclosure`(symbol) fetch | **siglens** |
| Cached provider + 2계층 캐시 + ISR + 봇판정 | **siglens** |
| UI(탭 페이지·표·AI 해석·InfoTooltip) + tab nav 등록 + chat | **siglens** |

> core 변경은 worktree 로컬 build → node_modules 덮어쓰기 검증. 정식 publish는 사용자(메모리 `siglens_core_release_method`).

## 4. 라우트 & 페이지 구조
- **라우트**: `src/app/[symbol]/congress/page.tsx` (동적 세그먼트 → `generateStaticParams`=[] + `revalidate` 리터럴, financials와 동일).
- 탭 내비: `SymbolLayoutClient`의 탭 목록에 "의회 거래" 추가(aria-current 패턴 기존대로).
- 페이지(단일 1열, 기존 탭 일관):
  1. `<h1>` SSR (예: "{displayName} 의회 거래") — displayName 사용(SEO h1 계약).
  2. **AI 동향 해석** — Suspense + 클라 폴링(financials AI 요약 평행).
  3. **거래 표** — chamber·의원·정당·거래유형(매수/매도)·금액 구간·거래일·공시일. 최신순. SSR 텍스트.
  - 거래 0건(희소 종목) / FMP 장애 → **degrade 안내(200)** + noindex(financials `FinancialsDegraded` 평행).
- 위젯: `widgets/congress`(권장) — `CongressTradesTable`, `CongressTrendSummary`(AI).

## 5. 데이터 레이어
- FMP: `senate-trading?symbol=` + `house-disclosure?symbol=`(또는 실제 경로 — §부록 A 실측). 두 결과를 core에서 `chamber` 필드로 통합 정규화 → `CongressTrade[]`(거래일 desc).
- core: `normalizeCongressTrades(senate, house) → CongressTrade[]`. 금액은 FMP가 구간 문자열("$1,001 - $15,000")로 주므로 도메인에서 구조화(min/max/label).
- siglens: provider + `Cached*Provider`(React.cache) → `getOrSetCache`(Redis) → `unstable_cache`(staticSymbolCache, revalidate + `symbol:`/`congress:` 태그). 키 `congress:<symbol>`.
- **빈 결과 캐시오염 방지**: 거래 0건은 정상(희소)이므로 `cacheNonEmpty`를 **그대로 적용하지 않는다** — 0건과 "FMP 장애로 빈 결과"를 구분해야 한다. provider가 장애를 throw로 표면화(swallow 금지)하거나, 0건은 캐시 허용 + 장애는 캐시 스킵. **이 구분을 명시 설계**(financials는 0건=장애였지만 congress는 0건=정상). → degrade는 "장애"에만, 0건은 "거래 내역 없음" 정상 표시.
- 신선도: 공시 지연 45일 → revalidate 길게(예: 86400=24h, financials와 동일). 클라 refetch가 보조.

## 6. AI 동향 해석
- core: 프롬프트 빌더(거래 표 요약: 순매수/매도, 집중 의원, 최근성) + `normalizeCongressTrend(raw→typed)`. `PROMPT_TEMPLATE_VERSION` 규약.
- siglens: submit/poll action + 클라 폴링 훅(financials 평행). **봇 skipEnqueue**. 거래 0건이면 AI 호출 자체 생략(불필요 비용 차단).
- cold-gen `connection()`/`cookies()`/`headers()` 금지(메모리 `isr_connection_coldgen_500`).

## 7. ChatPanel 통합
- congress 탭에서 `usePublishSymbolChat`로 chatState 발행(financials `buildChatState` 평행) — 거래 요약을 컨텍스트로. overall 점수 축 통합은 §2 비목표.

## 8. SEO / ISR (4축 규약 — `src/app/CLAUDE.md`)
- 축 0: 공유 셸 `cookies()`/`headers()` 금지(이미 충족, 확인). 봇 판정 클라/액션.
- 축 1: FMP/redis는 `staticSymbolCache`(unstable_cache) 정적화.
- 축 2: `useSearchParams` 쓰는 클라 위젯 있으면 SSR 크롤 텍스트 서버컴포넌트 분리(congress는 없을 가능성 — 있으면 적용).
- 축 3: `generateStaticParams=[]` + `revalidate` 리터럴(import 금지 — ISR 깨짐). 메타이미지 `force-static`.
- 메타: title/description/keywords/canonical(`/[symbol]/congress`)/OG/Twitter, h1=displayName. JSON-LD: WebPage + BreadcrumbList. 빈("거래 없음")은 색인 허용 가능하나 **장애 degrade는 noindex**(generateMetadata와 본문 판정 동일 소스).
- 검증: `prod build`(`● SSG`/ISR) + `curl`(`x-nextjs-cache: HIT`) + DSU 0 + Chrome 실측.

## 9. 사전 점검 체크리스트 (Feature #2 / PR #594 리뷰 지적) ⚠️필수
`/economy` 스펙 §10과 동일 표 적용(요지): named 반환타입(§5.3) · 매직넘버 상수화(§15, route config 리터럴 예외) · WHAT 주석 금지(§15.3) · false/부정확 WHY 주석 금지(§15.6, 캐시·React.cache 클레임 실측) · 상수/fingerprint 중복 금지(§16.5) · side-effect util은 `utils/`(§0.6) · 새 분기 양방향 테스트(§18) · 미검증 분기 금지(§22) · `as never` 금지(TS §7) · role↔aria-hidden 모순 금지·`data-testid`(a11y §3) · 단일 it() 복수단언 분리 · 동어반복·imprecise matcher 지양(§13) · 커스텀 에러 클래스(instanceof) · 동일 슬라이스 relative import(테스트 포함) · 2계층 캐시 단일 TTL · AI 클라폴링/cold-gen 안전 · 봇 skipEnqueue · empty/degrade→noindex 일치 · 커버리지 90%+ happy+worst.
> **congress 특화 주의**: "거래 0건(정상)"과 "FMP 장애(degrade)"를 §5대로 명확히 구분 — 이 분기 양방향 테스트(§18) 필수.

## 10. 구현 순서 (Phase 분해)
1. **Phase 0 — FMP 검증**: `senate-trading`/`house-disclosure`(symbol) endpoint·필드·플랜·금액 포맷·하원 가용성 실측(§부록 A). 결과로 타입 확정.
2. **Phase 1 — core**: `CongressTrade`/`Chamber` 타입·정규화(senate+house 통합·금액 구조화)·동향 프롬프트/normalize. 단위 테스트. worktree build.
3. **Phase 2 — siglens 데이터**: FMP 클라(senate+house) + Cached provider + 2계층 캐시 + 0건/장애 구분 캐싱. Fake provider. 테스트.
4. **Phase 3 — AI 해석**: submit/poll + 클라 폴링 + 0건 생략. 봇 skipEnqueue. 테스트.
5. **Phase 4 — UI**: `widgets/congress` 표 + AI 해석 + InfoTooltip + degrade + tab nav 등록. `frontend-design`→`web-design-guidelines`.
6. **Phase 5 — 페이지·SEO·ISR**: `app/[symbol]/congress/page.tsx` + 메타·JSON-LD + revalidate 리터럴 + SSR 텍스트. `seo-audit`.
7. **Phase 6 — chat**: congress chatState 발행 + 컨텍스트 전환 검증.
8. **Phase 7 — E2E·실증**: Playwright happy/worst(거래 있음/0건/장애) + prod-like build 실측(curl+Chrome+DSU 0).
> 각 Phase: types 먼저 → 구현 → 테스트 동행. PR별 리뷰 루프. cross-repo는 core 먼저 릴리스(사용자) 후 siglens.

## 부록 A — FMP endpoint 검증 게이트 (Phase 0)
실측 후 표로 기록:
- `senate-trading?symbol=` — 필드(의원·정당·transactionType·amount 구간·transactionDate·disclosureDate), per-symbol 조회.
- `house-disclosure?symbol=`(또는 실제 경로) — **하원 가용성·필드·상원과의 스키마 차이**.
- 플랜 tier 지원(402 여부 — `logFmpPaymentRequiredError`).
- 금액 구간 포맷(문자열 범위) → 도메인 구조화 규칙 확정.
결과로 §5 정규화·타입을 확정한다.
