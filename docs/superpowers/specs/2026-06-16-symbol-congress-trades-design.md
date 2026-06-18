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
| FMP `/stable/senate-trades`·`/stable/house-trades`(symbol) fetch | **siglens** |
| Cached provider + 2계층 캐시 + ISR + 봇판정 | **siglens** |
| UI(탭 페이지·표·AI 해석·InfoTooltip) + tab nav 등록 + chat | **siglens** |

> core 변경은 worktree 로컬 build → node_modules 덮어쓰기 검증. 정식 publish는 사용자(메모리 `siglens_core_release_method`).

## 4. 라우트 & 페이지 구조
- **라우트**: `src/app/[symbol]/congress/page.tsx` (동적 세그먼트 → `generateStaticParams`=[] + `revalidate` 리터럴, financials와 동일).
- 탭 내비: `SymbolLayoutClient`의 탭 목록에 "의회 거래" 추가(aria-current 패턴 기존대로).
- 페이지(단일 1열, 기존 탭 일관):
  1. `<h1>` SSR (예: "{displayName} 의회 거래") — displayName 사용(SEO h1 계약).
  2. **AI 동향 해석** — Suspense + 클라 폴링(financials AI 요약 평행).
  3. **거래 표** — chamber(상원/하원)·의원·지역(주/선거구)·거래유형(매수/매도)·금액 구간·assetType(주식/옵션)·거래일·공시일 + owner·assetDescription·공시 원본 link. **transactionDate desc, 최근 50건**. SSR 텍스트. (정당 컬럼은 FMP 미제공으로 드롭 — 부록 D #1.)
  - 거래 0건(희소 종목) → **"거래 내역 없음" 정상 표시(200, 색인 허용)**. FMP 장애(HTTP throw)만 → **degrade 안내(200) + noindex**(financials `FinancialsDegraded` 평행). 0건↔장애 엄격 구분(부록 B.6).
- 위젯: `widgets/congress`(권장) — `CongressTradesTable`, `CongressTrendSummary`(AI).

## 5. 데이터 레이어
- FMP(**부록 B 실측 확정**): `/stable/senate-trades?symbol=` + `/stable/house-trades?symbol=`(v4 `senate-trading`/`house-disclosure`는 403 Legacy — 사용 불가). 두 결과를 core에서 `chamber` 필드로 통합 정규화 → `CongressTrade[]`(거래일 desc). 상·하원 wire 스키마 동일(16필드) → 단일 매퍼+chamber 인자.
- core: `normalizeCongressTrades(senate, house) → CongressTrade[]`. 금액은 FMP가 구간 문자열("$1,001 - $15,000")로 주므로 도메인에서 구조화(min/max/label).
- siglens: provider + `Cached*Provider`(React.cache) → `getOrSetCache`(Redis) → `unstable_cache`(staticSymbolCache, revalidate + `symbol:`/`congress:` 태그). 키 **2개 분리** `congress:senate:<SYM>` / `congress:house:<SYM>`(부록 D #5, `<SYM>`=대문자).
- **빈 결과 캐시오염 방지**: 거래 0건은 정상(희소)이므로 `cacheNonEmpty`를 **그대로 적용하지 않는다** — 0건과 "FMP 장애로 빈 결과"를 구분해야 한다. provider가 장애를 throw로 표면화(swallow 금지)하거나, 0건은 캐시 허용 + 장애는 캐시 스킵. **이 구분을 명시 설계**(financials는 0건=장애였지만 congress는 0건=정상). → degrade는 "장애"에만, 0건은 "거래 내역 없음" 정상 표시.
- 신선도: 공시 지연 45일 → revalidate 길게(예: 86400=24h, financials와 동일). 클라 refetch가 보조.

## 6. AI 동향 해석
- core: `buildCongressTrendPrompt`(거래 표 요약: **건수 기반 순매수/매도**(부록 D #3)+대표 구간 분포, 집중 의원, 최근성) + `normalizeCongressTrendResponse(raw→typed, throw 금지)`. `PROMPT_TEMPLATE_VERSION` 규약.
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
1. **Phase 0 — FMP 검증 ✅ 완료(2026-06-16, 부록 B)**: `/stable/senate-trades`·`/stable/house-trades`(symbol) endpoint·16필드·플랜(402 없음)·금액 구간·상하원 동일 스키마 실측 확정. 타입 확정됨.
2. **Phase 1 — core**: `CongressTrade`/`Chamber` 타입·정규화(senate+house 통합·금액 구조화)·동향 프롬프트/normalize. 단위 테스트. worktree build.
3. **Phase 2 — siglens 데이터**: FMP 클라(senate+house) + Cached provider + 2계층 캐시 + 0건/장애 구분 캐싱. Fake provider. 테스트.
4. **Phase 3 — AI 해석**: submit/poll + 클라 폴링 + 0건 생략. 봇 skipEnqueue. 테스트.
5. **Phase 4 — UI**: `widgets/congress` 표 + AI 해석 + InfoTooltip + degrade + tab nav 등록. `frontend-design`→`web-design-guidelines`.
6. **Phase 5 — 페이지·SEO·ISR**: `app/[symbol]/congress/page.tsx` + 메타·JSON-LD + revalidate 리터럴 + SSR 텍스트. `seo-audit`.
7. **Phase 6 — chat**: congress chatState 발행 + 컨텍스트 전환 검증.
8. **Phase 7 — E2E·실증**: Playwright happy/worst(거래 있음/0건/장애) + prod-like build 실측(curl+Chrome+DSU 0).
> 각 Phase: types 먼저 → 구현 → 테스트 동행. PR별 리뷰 루프. cross-repo는 core 먼저 릴리스(사용자) 후 siglens.

## 부록 A — FMP endpoint 검증 게이트 (Phase 0) ✅ 완료 → **부록 B로 대체**
> 아래는 검증 전 계획. **실측 결과는 부록 B가 source-of-truth**(endpoint명 정정: `senate-trading`→`senate-trades`, `house-disclosure`→`house-trades`).
실측 후 표로 기록:
- `senate-trading?symbol=` — 필드(의원·정당·transactionType·amount 구간·transactionDate·disclosureDate), per-symbol 조회.
- `house-disclosure?symbol=`(또는 실제 경로) — **하원 가용성·필드·상원과의 스키마 차이**.
- 플랜 tier 지원(402 여부 — `logFmpPaymentRequiredError`).
- 금액 구간 포맷(문자열 범위) → 도메인 구조화 규칙 확정.
결과로 §5 정규화·타입을 확정한다.

---

## 부록 B — Phase 0 실측 결과 (2026-06-16, FMP 라이브 호출 검증 완료)

> Phase 0 게이트 통과. **스펙 §4·§5의 endpoint·필드 가정 중 일부가 틀렸음을 실측으로 정정**한다. 아래가 구현의 source-of-truth.

### B.1 endpoint (정정 — 가장 중요)
- ❌ 스펙 가정 `senate-trading` / `house-disclosure` (FMP v4 경로) → **403 Legacy("no longer supported", 2025-08-31 이전 구독자 전용)**. 사용 불가.
- ✅ **실제 동작**: `/stable/senate-trades?symbol=` + `/stable/house-trades?symbol=` (둘 다 200). 레포는 이미 `FMP_STABLE_BASE`(`https://financialmodelingprep.com/stable`) + `fmpGet`를 쓰므로 그대로 적합. **현 플랜에서 402 없이 정상 호출**(financials와 동일 플랜).
- `symbol` 파라미터 **필수**: 누락 시 400. 무효 심볼(`ZZZZZ`)·거래 없는 심볼(`ABEO`,`CISO`)은 **`[]` + 200**. 거래 있는 심볼은 최대 100건 반환(default 페이지 크기로 추정).

### B.2 wire 스키마 (상·하원 **동일** 16필드 — 정규화 대폭 단순화)
```jsonc
{
  "symbol": "AAPL",
  "senateID": "C001047",          // 상원=의원ID 존재, 하원=null
  "disclosureDate": "2026-05-07", // 공시일
  "transactionDate": "2026-04-17",// 실제 거래일 (≈45일+ 지연; house는 1년+ 사례도)
  "firstName": "Shelley", "lastName": "Moore Capito",
  "office": "Shelley Moore Capito",
  "district": "WV",               // 상원=주(state), 하원=빈 문자열 사례 있음
  "owner": "Spouse",              // 분포: '' | 'Self' | 'Spouse' | 'Joint' | 'Child'
  "assetDescription": "Apple Inc",
  "assetType": "Stock",           // 분포: 'Stock' | 'Stock Option'
  "type": "Sale",                 // ⚠️ B.3 참조 (값 지저분)
  "amount": "$1,001 - $15,000",   // 구간 문자열 (B.4)
  "capitalGainsOver200USD": "False", // 문자열 'True'|'False'
  "comment": "", "link": "https://..."
}
```
- **chamber는 wire 필드가 아님** — senate-trades / house-trades **어느 endpoint에서 왔는지로 결정**(senateID 유무로 추정 금지: 하원도 senateID 키 자체는 존재하나 null).
- 상·하원 키 union이 완전히 같으므로 **단일 매퍼 + `chamber` 인자**로 정규화(senate·house 각각 별도 매퍼 불필요).

### B.3 ⚠️ `type` 값 비일관 (정규화 방어 필수 — §18 양방향 테스트 대상)
- 실측 distinct: 상원 `['Purchase','Sale','Sale (Full)','Sale (Partial)']`, **하원은 추가로 `'Sale Partial'`(괄호 없음)**.
- → 도메인 정규화 규칙: `'Purchase'`(정확 일치)=매수, **그 외 `Sale`로 시작/포함 = 매도**, 그 외 unknown은 `'unknown'` 보존(드롭 금지). `side: 'buy' | 'sell' | 'unknown'`로 구조화. **`Sale Partial`/`Sale (Partial)` 등 변종을 한 분류로 흡수**하는 테스트 케이스 필수.

### B.4 `amount` 구간 (도메인 구조화 규칙 확정)
- 실측 buckets: `$1,001 - $15,000` / `$15,001 - $50,000` / `$50,001 - $100,000` / `$100,001 - $250,000` / `$250,001 - $500,000` (상원 AAPL 표본). STOCK Act 표준 구간.
- → `amount: { min: number | null; max: number | null; label: string }`. 파싱은 `"$min - $max"` 정규식; 매칭 실패 시 `{min:null,max:null,label:원문}`(throw 금지). 상한 없는 구간(예: `$50,000,000 +`) 대비 max=null 허용.

### B.5 ⚠️ 정당(party) 필드 **부재** — 설계 정정 필요 (§C.2 결정)
- FMP `senate-trades`/`house-trades`는 **정당 필드를 주지 않는다**. 스펙 §4 "정당" 컬럼은 wire에 근거 없음. → 컬럼 드롭 또는 별도 소스 파생(후자는 본 스펙 비목표 성격). **브레인스토밍 결정 항목**.

### B.6 0건 vs 장애 구분 (§5 핵심 — 실측으로 구현 방향 확정)
- 0건(희소)·무효 심볼 모두 `[]`+200. 즉 **응답 본문만으로는 구분 불가**. 유일한 구분축 = **HTTP 성공 여부**: provider가 HTTP throw(429/5xx/timeout/402)일 때만 "장애 → degrade + 캐시 스킵", 정상 200 `[]`는 "거래 내역 없음(정상)"으로 **`[]` 캐시 허용**. financials의 `.catch(()=>[])` graceful-null 패턴을 쓰되, **장애와 정상-빈을 envelope로 구분**(예: fetch는 throw 표면화 → 데코레이터에서 장애 시 `null` 반환 / 정상 빈은 `[]`). degrade 판정은 이 신호로만.

---

## 부록 C — 코드 접지(financials 실측 구현 → congress 미러 맵)

> financials(PR #594/#596)의 **실제 머지된** 파일·식별자에 평행 매핑. 구현 시 이 표를 1:1 따른다.

### C.1 미러 대상 (financials 실파일 → congress 신규)
| financials (실재) | congress (신규) | 비고 |
|---|---|---|
| `shared/api/fmp/financialStatementsClient.ts` (`FmpFinancialStatementsClient`, `fmpGet`, `num()`) | `shared/api/fmp/congressTradesClient.ts` (`FmpCongressTradesClient`) | senate+house 2메서드 또는 `getTrades(symbol, chamber)` |
| `shared/api/fmp/CachedFinancialStatementsProvider.ts` (`React.cache`+`getOrSetCache`, throw→graceful, `MAX_STATEMENT_LIMIT=40`+slice, `.toUpperCase()`) | `shared/api/fmp/CachedCongressTradesProvider.ts` | 키 `congress:senate:<SYM>` / `congress:house:<SYM>`, 장애 시 null·정상빈 `[]` 구분(B.6) |
| `shared/api/fmp/getFinancialStatementsProvider.ts` (싱글톤+`isE2E()` 분기) | `shared/api/fmp/getCongressTradesProvider.ts` | |
| `shared/api/fmp/FakeFinancialStatementsProvider.ts` | `shared/api/fmp/FakeCongressTradesProvider.ts` | 결정론 픽스처(거래有·0건·장애 3패턴) |
| `entities/financials-statements/lib/getFinancialsSnapshot.ts` (normalize 위임) | `entities/congress-trades/lib/getCongressTrades.ts` | core `normalizeCongressTrades(senate, house)` 위임 |
| `app/[symbol]/financials/{page.tsx, financialData.ts, FinancialsDegraded.tsx}` (`revalidate=86400` 리터럴, `generateStaticParams=[]`, NOINDEX 분기, JsonLd WebPage+Breadcrumb+FAQ) | `app/[symbol]/congress/{page.tsx, congressData.ts, CongressDegraded.tsx}` | 빈("거래 없음")=색인 허용·장애=noindex(§8) |
| `widgets/financials/**` (`FinancialsAiSummary`+Skeleton/Error/View, `hooks/useFinancialsAnalysis.ts` submit/poll/cancel+`usePageHideCancel`, `utils/buildChatState.ts`) | `widgets/congress/**` (`CongressTrendSummary`+상태3종, `hooks/useCongressTrend.ts`, `CongressTradesTable.tsx`, `utils/buildChatState.ts`) | **표=동기 SSR(SEO content)**, AI 동향=클라폴링 |
| `entities/analysis/actions/{submit,poll,cancel}FinancialsAnalysisAction.ts` (+`actions.ts` barrel, `isBot`→`skipEnqueueIfMiss`, `resolveTierAndByok`, `isE2E` stub, `waitUntil`) | `…/{submit,poll,cancel}CongressTrendAction.ts` | **0건이면 submit 자체 생략**(§6) |
| `widgets/symbol-page/utils/symbolTabsConfig.ts` `TABS` (`{key,label,hrefBuilder}`) | 항목 추가 `{key:'congress', label:'의회 거래', hrefBuilder:s=>`/${s}/congress`}` | financials 다음 위치 |
| `shared/config/time.ts` `FMP_STATEMENTS_REVALIDATE_SECONDS=SECONDS_PER_DAY` | `CONGRESS_REVALIDATE_SECONDS=SECONDS_PER_DAY` (24h, 공시지연 45일) | |
| `shared/config/{queryConfig,pollingConfig}.ts` (`QUERY_KEYS.*`, `ANALYSIS_POLL_INTERVAL_MS` 재사용) | `QUERY_KEYS.congressTrend(symbol, modelId)` 추가, 폴링상수 재사용 | |

### C.2 인프라 재사용 (신규 작성 금지 — 그대로 사용)
- `shared/api/fmp/httpClient.ts`: `FMP_STABLE_BASE`, `fmpGet<T>(path, query, {revalidate})`, `withRetry(FMP_TRANSIENT_RETRY)`(429/5xx/네트워크/timeout 재시도).
- `shared/api/fmp/fmpUserMessage.ts`: `logFmpPaymentRequiredError`, `FMP_DATA_UNAVAILABLE_MESSAGE`(402).
- core import: `@y0ngha/siglens-core` barrel만(deep import 금지). 신규 export = `CongressTrade`/`Chamber`/`CongressTradeSide`/`CongressTrendResponse`/`Raw*` 타입 + `normalizeCongressTrades`/`buildCongressTrendPrompt`/`normalizeCongressTrendResponse`/`submit·pollCongressTrend`. **`PROMPT_TEMPLATE_VERSION` bump**.
- E2E: `FakeCongressTradesProvider` + `isE2E()` 분기 + 에러주입 쿠키(`E2E_FORCE_CONGRESS_ERROR_COOKIE`) — financials seam 평행.

---

## 부록 D — 브레인스토밍 확정 결정 (2026-06-16, 사용자 승인)

> Phase 0 후 열린 설계 선택을 `brainstorming` 스킬로 확정. 아래가 구현의 source-of-truth.
1. **정당 컬럼 — 드롭**(B.5). FMP 미제공·§2 비목표(과투자 방지) 부합. 대체 노출 = chamber(상원/하원)+의원명+지역(상원=주, 하원=선거구). 정당 파생은 별도 후속.
2. **assetType `Stock Option` 행 — 포함 + 라벨 노출**. 표에 `assetType` 배지(주식/옵션)로 구분. 필터링 시 옵션 베팅 신호 손실하므로 전부 표시.
3. **AI 순매수/순매도 — 건수 기반**. 매수 N건 vs 매도 M건으로 우세 판정(`netDirection`). 구간 amount는 정확 합산 불가하므로 중앙값 합산 미사용. AI 프롬프트엔 건수 + 대표 구간 분포를 전달(정직한 근사).
4. **표 정렬·상한 — transactionDate desc, 최근 50건**. FMP는 심볼당 최대 100건 반환 → 최근 50건만 표시(페이로드·DOM 과대 방지). SEO는 SSR 표 50행으로 충족.
5. **캐시 키 — senate/house 2키 분리**. `congress:senate:<SYM>` / `congress:house:<SYM>`. financials statement별 키 granularity 평행, 병렬 fetch, 한쪽 endpoint 장애 시 독립 처리(전체 캐시 오염 방지).
6. **추가 컬럼 — owner + 공시 원본 link + assetDescription 포함, comment 제외**. owner(Self/Spouse/Joint/Child, `''`은 미표기). link는 senate efdsearch / house disclosures-clerk PDF(`rel="noopener noreferrer"`, 외부). comment는 대부분 빈 문자열·노이즈라 드롭.
