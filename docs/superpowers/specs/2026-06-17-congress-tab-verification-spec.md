# `/[symbol]/congress` 탭 — production-like 빌드 실증 스펙

> 2026-06-17 · feat/symbol-congress-trades 브랜치(워크트리 `/Users/y0ngha/Project/siglens/.claude/worktrees/feat+symbol-congress`)의 prod build + start 환경에서, **사람 + 후속 Opus 에이전트**가 본 문서만 보고 엔드투엔드 실증을 끝낼 수 있도록 작성한 자기완결형 검증 스펙이다.
>
> 설계 source-of-truth: `docs/superpowers/specs/2026-06-16-symbol-congress-trades-design.md`
> 구현 계획서: `docs/superpowers/plans/2026-06-16-symbol-congress-trades.md`

---

## 0. 사전 준비 (실증 환경 조건)

### 0.1 워크트리·브랜치
- 워크트리: `/Users/y0ngha/Project/siglens/.claude/worktrees/feat+symbol-congress`
- 브랜치: `feat/symbol-congress-trades` (base: `master`)
- 마지막 커밋 시점: `3f164b09 fix(congress): PR #597 APPROVED suggestions …` 직후
- 변경 규모: 56 files, +5559 / -63

### 0.2 cross-repo 상태 (⚠️ 실증 전 반드시 확인)
- `package.json` 의존성: `"@y0ngha/siglens-core": "0.23.0"` — **레지스트리(GitHub Packages)에 publish된 최신은 여전히 0.23.0**
- 실제 워크트리 `node_modules/@y0ngha/siglens-core/package.json`도 `"version": "0.23.0"`이지만 **dist에 0.24.0 overlay가 적용되어** congress 관련 export(`CongressTrade` / `Chamber` / `normalizeCongressTrades` / `submitCongressTrend` / `pollCongressTrend` / `cancelCongressTrendJob` 등)가 이미 들어와 있다 (확인: `grep -h "Congress" node_modules/@y0ngha/siglens-core/dist/index.d.ts`)
- 즉 **현재 CI는 publish-blocked 상태**(0.24.0 미릴리스). 실증은 **로컬 overlay 기반**으로만 가능하며, 사용자가 siglens-core를 직접 publish하기 전까지 CI/Vercel은 빌드 실패한다. 이 스펙은 로컬(`yarn build && yarn start`) 실증 한정이다.
- ⚠️ 실증 도중 `yarn install --check-files` / `rm -rf node_modules && yarn install`을 절대 실행하지 말 것 — overlay가 날아가 빌드가 깨진다.

### 0.3 env 파일
- 워크트리 루트의 `.env.local` / `.env.production`이 존재하는지 확인. 없으면 형제 워크트리(master)에서 복원 후 검증한다.
- `E2E_TEST` 환경변수는 prod 빌드 검증에서 **반드시 unset**이어야 한다 (E2E_TEST=1이면 Fake provider가 활성화되어 FMP 실데이터 검증이 불가). 단, EMPTYX 검증만은 E2E_TEST=1 + Fake provider 조합으로 별도 검증한다(§5).

### 0.4 빌드 & 기동
```bash
# 워크트리 루트에서
cd /Users/y0ngha/Project/siglens/.claude/worktrees/feat+symbol-congress

# (1) prod build — 메모리에 따라 exit code를 파이프 없이 직접 캡처 (feedback_build_exit_code_pipe_masks_failure)
yarn build > /tmp/build-congress.log 2>&1; echo "build exit=$?"
# 기대: build exit=0, 로그 끝부분에 다음 라인 존재:
#   ● /[symbol]/congress  (SSG)   <size>  <chunk>
#   ƒ /[symbol]/congress  ← 이게 보이면 ISR 깨진 것(generateStaticParams=[] 누락 또는 revalidate 비-리터럴)

# (2) prod start (port 4200 기본 — 점유 시 PORT=4201 yarn start)
yarn start &
# 30초 대기 후 health check (curl 응답 OK까지 polling)
until curl -s -o /dev/null -w '%{http_code}' http://localhost:4200/ | grep -q 200; do sleep 1; done
```

### 0.5 Chrome MCP 준비
Chrome MCP 사용 시 항상 먼저 `ToolSearch` 로 도구 스키마를 로드한다:
```
ToolSearch(query="select:mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__find,mcp__claude-in-chrome__get_page_text,mcp__claude-in-chrome__read_console_messages,mcp__claude-in-chrome__read_network_requests,mcp__claude-in-chrome__tabs_create_mcp")
```

### 0.6 심볼 선정 근거
| 심볼 | 용도 | 기대 동작 |
|---|---|---|
| `AAPL` | 의회 거래 다수 보유 — happy path | 표 SSR + AI 동향 클라 폴링 |
| `EMPTYX` | `FakeCongressTradesProvider`가 양쪽 chamber에 대해 `[]` 반환 — 0건 정상 경로 | 표 = "거래 내역 없음" + 색인 허용 |
| `INVALID_NOPE_!@#` | `VALID_TICKER_RE` 실패 — 404 경로 | `notFound()` → 404 응답 |
| `ZZZZZZ` | FMP 200 + profile 미존재 → `profile === null` → `notFound()` | 404 응답 |

---

## 1. 변경 범위 요약 (Change Scope)

이 브랜치는 새 종목 탭 `/[symbol]/congress`를 추가하며, 행위 표면(behavioral surface)은 다음과 같이 분류된다.

### 1.1 새 라우트 / 페이지
- `src/app/[symbol]/congress/page.tsx` — RSC, `revalidate=86400` 리터럴, `generateStaticParams=[]`, `notFound()` + 4종 noindex 분기 + 1종 indexable 분기 보유
- `src/app/[symbol]/congress/congressData.ts` — 페이지가 호출하는 thin wrapper (`getCongressTradesResilient` 위임)
- `src/app/[symbol]/congress/CongressDegraded.tsx` — FMP 인프라 장애 시 soft-200 degraded UI
- `src/app/[symbol]/congress/opengraph-image.tsx` — `dynamic='force-static'`, `revalidate=2592000` (30d)
- `src/app/[symbol]/congress/twitter-image.tsx` — opengraph-image re-export

### 1.2 새 데이터 레이어
- `src/shared/api/fmp/congressTradesClient.ts` — `FmpCongressTradesClient` (FMP `/stable/senate-trades` + `/stable/house-trades` 어댑터)
- `src/shared/api/fmp/CachedCongressTradesProvider.ts` — 2계층 캐시 + per-chamber 단일 키 (`congress:senate:<SYM>` / `congress:house:<SYM>`), MAX-fetch + read-time-slice 패턴
- `src/shared/api/fmp/FakeCongressTradesProvider.ts` — E2E 전용 픽스처 provider (EMPTYX 분기)
- `src/shared/api/fmp/getCongressTradesProvider.ts` — 싱글톤 팩토리 + `isE2E()` 분기
- `src/entities/congress-trades/lib/getCongressTrades.ts` — `staticSymbolCache` + core `normalizeCongressTrades` 위임, `CONGRESS_TRADE_LIMIT=50` export
- `src/entities/congress-trades/lib/getCongressTradesResilient.ts` — React.cache 래퍼, FMP throw → `degraded:true`, 정상 `[]` → `degraded:false`
- `src/entities/congress-trades/index.ts` — barrel

### 1.3 새 AI Server Actions
- `src/entities/analysis/actions/submitCongressTrendAction.ts` — core `submitCongressTrend` 위임, 봇 `skipEnqueueIfMiss`, E2E force-error 쿠키 분기
- `src/entities/analysis/actions/pollCongressTrendAction.ts` — core `pollCongressTrend` 위임 + try/catch 표면화
- `src/entities/analysis/actions/cancelCongressTrendJobAction.ts` — best-effort cancel
- `src/entities/analysis/actions.ts` — 위 3개 actions barrel re-export

### 1.4 새 위젯
- `src/widgets/congress/CongressTradesTable.tsx` — SSR 표 (chamber/의원/매수매도/금액/종류/거래일/공시일/보유자/자산설명/공시 link), MAX_ROWS=50
- `src/widgets/congress/CongressTradesEmpty.tsx` — 0건 표시 ("거래 내역 없음")
- `src/widgets/congress/CongressTrendSummary.tsx` — 5-state union 분기 클라 컴포넌트 + `usePublishSymbolChat`
- `src/widgets/congress/CongressTrendSummaryView.tsx` / `Skeleton.tsx` / `Error.tsx` / `Empty.tsx` — 상태별 렌더
- `src/widgets/congress/hooks/useCongressTrend.ts` — submit→poll→cancel(pagehide) 훅, `NoCongressTradesError` 센티넬
- `src/widgets/congress/utils/buildChatState.ts` — chat 컨텍스트 발행
- `src/widgets/congress/congressTooltips.tsx` — InfoTooltip 컨텐츠(chamber/금액/공시지연)
- `src/widgets/congress/index.ts` — barrel

### 1.5 SEO 빌더 확장
- `src/shared/lib/seo.ts` — `buildSymbolCongressSeoContent()` 신규 (description, keywords, canonical, title 등)

### 1.6 통합 surfaces (기존 파일 수정)
- `src/widgets/symbol-page/utils/symbolTabsConfig.ts` — `TABS` 배열 **position 4**(0-indexed)에 `{key:'congress', label:'의회 거래', hrefBuilder}` 추가 (financials 다음, options 앞)
- `src/widgets/symbol-page/CrossLinkCards.tsx` — `ALL_PAGES` / `LABEL` / `DESCRIPTION` / `HREF`에 `congress` 추가 (배열 **position 6**)
- `src/app/api/jobs/cancel/route.ts` — `VALID_JOB_TYPES`에 `'congress'` 추가 + switch case 라우팅
- `src/shared/config/queryConfig.ts` — `QUERY_KEYS.congressTrend(symbol, modelId)` 추가
- `src/shared/config/time.ts` — `CONGRESS_REVALIDATE_SECONDS = SECONDS_PER_DAY` 추가
- `src/shared/lib/types.ts` — `JobType` union에 `'congress'` 추가
- `src/shared/api/e2eAnalysisStub.ts` — `E2E_FORCE_CONGRESS_ERROR_COOKIE` / `e2eCachedCongressTrend()` / `e2eForcedCongressError()` 추가
- `eslint.config.mjs` — `entities/congress-trades` 슬라이스 등록 (예상; 확인 필요)
- `docs/architecture/ISR_REVALIDATE.md` — congress 행 추가

### 1.7 E2E 스펙
- `e2e/specs/congress.spec.ts` — happy/0건/강제 장애/봇 4개 시나리오 (260줄)
- `e2e/fixtures/analysis.json` — `congressTrend` 픽스처 추가 (summaryKo="최근 의회 거래는 매수 우세예요.")

---

## 2. ISR 4축 계약 — 빌드 결과 + 런타임 실측 (필수 PASS 게이트)

(a) **검증 대상**: `/[symbol]/congress` 라우트가 ISR로 동작하고 (`generateStaticParams=[]`, `revalidate=86400` 리터럴), 4종 noindex 분기 + 1종 indexable 분기가 모두 의도대로 떨어지는지.

(b) **위치 (코드)**:
- `src/app/[symbol]/congress/page.tsx`
  - line 32: `export const revalidate = 86400; // 24h` ← **반드시 리터럴**. 식이면 ISR 깨짐
  - line 36-38: `export async function generateStaticParams(): Promise<SymbolRouteParams[]> { return []; }`
  - line 48-50: `if (!VALID_TICKER_RE.test(upper)) return NOINDEX_SYMBOL_METADATA;` (invalid ticker → noindex)
  - line 52-54: `if (degraded)` (assetInfo degraded → noindex)
  - line 60-64: `if (profileDegraded || profile === null)` (profile null/degraded → noindex)
  - line 68-72: `if (tradesDegraded)` (congress provider degraded → noindex) — **financials와의 의도적 비대칭**
  - line 107-109: `if (!VALID_TICKER_RE.test(upper)) notFound();` (본문에서도 404)
  - line 127-129: `if (profileDegraded) return <CongressDegraded .../>;` (soft-200)
  - line 132-134: `if (profile === null) notFound();`
  - line 142-144: `if (tradesDegraded) return <CongressDegraded .../>;`

(c) **검증 방법**:

```bash
# C1. 빌드 로그에서 ● (SSG) 마커 확인
grep -E '/\[symbol\]/congress' /tmp/build-congress.log
# 기대: 라인이 ●(SSG)로 시작. ƒ(Dynamic)으로 표시되면 ISR 깨짐.

# C2. revalidate 리터럴 검증 (정적 분석)
grep -n 'export const revalidate' src/app/\[symbol\]/congress/page.tsx
# 기대: `export const revalidate = 86400; // 24h` 정확히 이 형태. 상수 import 금지.

# C3. AAPL ISR HIT 검증 (cold → warm)
curl -s -o /dev/null -D - http://localhost:4200/AAPL/congress | grep -iE 'x-nextjs-cache|cache-control|x-vercel'
# 첫 요청: x-nextjs-cache: MISS 또는 STALE → 응답 후 캐시 적재
sleep 2
curl -s -o /dev/null -D - http://localhost:4200/AAPL/congress | grep -i 'x-nextjs-cache'
# 기대(두 번째): x-nextjs-cache: HIT

# C4. noindex 분기 4종 + indexable 1종
# (a) invalid ticker → 404 (본문) + noindex (메타) — 이건 404 본문이라 robots 미렌더, 404 코드로 검증
curl -s -o /dev/null -w '%{http_code}' "http://localhost:4200/INVALID_NOPE_/congress"
# 기대: 404
# (b) profile === null → 404
curl -s -o /dev/null -w '%{http_code}' "http://localhost:4200/ZZZZZZ/congress"
# 기대: 404
# (c) AAPL happy → 200 + robots = index,follow
curl -s "http://localhost:4200/AAPL/congress" | grep -oE '<meta name="robots" content="[^"]*"'
# 기대: index, follow (또는 robots 메타 자체 없음 = 기본 indexable). 'noindex'가 포함되면 FAIL.
# (d) EMPTYX (E2E_TEST=1로 별도 기동 — §5 참조) → 200 + indexable

# C5. tradesDegraded → noindex (이 분기는 FMP 강제 장애가 필요해 prod 빌드에서 자연 재현 어려움 → 단위/통합 테스트로 대체 검증)
yarn vitest run src/entities/congress-trades/lib/__tests__/getCongressTradesResilient.test.ts
# 기대: PASS. 특히 "FMP throw → degraded:true" 케이스 PASS.
```

Chrome MCP:
1. `navigate(url='http://localhost:4200/AAPL/congress')`
2. `read_network_requests` → `/AAPL/congress` 응답 헤더에 `x-nextjs-cache: HIT` (두 번째 방문)
3. `get_page_text()` → `<meta name="robots">`에 `noindex` 미포함
4. `navigate(url='http://localhost:4200/INVALID_NOPE_/congress')` → 404 페이지 표시
5. `navigate(url='http://localhost:4200/ZZZZZZ/congress')` → 404 페이지 표시

(d) **기대 결과**:
- 빌드 로그: `●` (SSG)
- AAPL warm 요청: `x-nextjs-cache: HIT`, robots noindex 없음
- INVALID / ZZZZZZ: HTTP 404
- vitest resilient 테스트 PASS

---

## 3. 0건 vs 장애 비대칭 (§B.6 — 이 브랜치의 핵심 deviation)

(a) **검증 대상**: financials는 "0건 = 장애 = noindex"였지만, congress는 **0건 = 정상 = indexable**, **FMP infra throw만 = degraded = noindex** 라는 비대칭이 의도대로 구현되었는지.

(b) **위치**:
- `src/entities/congress-trades/lib/getCongressTradesResilient.ts` line 33-50
  - `try { return { trades: …, degraded: false } } catch { return { trades: [], degraded: true } }`
  - 정상 `[]` 응답은 **try의 success path를 통과**해 `degraded:false`로 반환됨 ← 핵심
- `src/app/[symbol]/congress/page.tsx` line 65-72 (generateMetadata에서 0건은 noindex 분기 미진입)
- `src/app/[symbol]/congress/page.tsx` line 139-144 (본문에서 tradesDegraded만 CongressDegraded)
- `src/app/[symbol]/congress/CongressDegraded.tsx` line 9-23 JSDoc 명시: "A zero-trade result is NOT a degrade signal"
- `src/widgets/congress/CongressTradesTable.tsx` line 162: `if (trades.length === 0) return <CongressTradesEmpty />`

(c) **검증 방법**:

```bash
# (E2E_TEST=1 별도 기동 필요 — §5 절차 참고)
# EMPTYX = Fake provider가 [] 반환 → degraded:false 경로 → page body에 거래 내역 없음 카드
# AAPL과 EMPTYX 모두 200, 둘 다 robots noindex 없음
PORT=4201 E2E_TEST=1 yarn start &
until curl -s -o /dev/null -w '%{http_code}' http://localhost:4201/ | grep -q 200; do sleep 1; done

# 200 + indexable 확인
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:4201/EMPTYX/congress"
# 기대: 200
curl -s "http://localhost:4201/EMPTYX/congress" | grep -E '거래 내역 없음|noindex' | head -5
# 기대: "거래 내역 없음" 포함 / "noindex" 미포함

# 단위 테스트로 분기 양방향 확인 (실제 FMP throw 강제는 어려움)
yarn vitest run src/entities/congress-trades/lib/__tests__/getCongressTradesResilient.test.ts \
  src/app/\[symbol\]/congress/__tests__/page.metadata.test.ts
# 기대: 모든 "0 trades = indexable" / "infra throw = noindex" 분기 PASS
```

Chrome MCP (E2E_TEST=1 모드, port 4201):
1. `navigate(url='http://localhost:4201/EMPTYX/congress')`
2. `find(query='거래 내역 없음')` → 매치
3. `get_page_text()` → meta robots에 `noindex` 미포함
4. `find(query='의회 거래 데이터를 일시적으로 불러올 수 없어요')` → **미매치** (이건 degrade 카피)

(d) **기대 결과**:
- EMPTYX 200 + "거래 내역 없음" + indexable
- vitest 분기 양방향 PASS
- CongressDegraded(degrade 카피)는 EMPTYX 페이지에 등장하지 않음

---

## 4. 봇 동작 (SSR 표 + AI skipEnqueue)

(a) **검증 대상**: 크롤러(bot UA)가 들어와도 (1) SSR 표가 그대로 노출되며 (SEO 신호 보존), (2) AI 동향 LLM 잡은 enqueue되지 않는다 (`isBot(headers)` → `skipEnqueueIfMiss=true`).

(b) **위치**:
- `src/entities/analysis/actions/submitCongressTrendAction.ts` line 52: `const skipEnqueueIfMiss = isBot(requestHeaders);`
- line 54-60: `submitCongressTrend({..., skipEnqueueIfMiss})` core 위임
- core 동작: skipEnqueue 시 캐시 미스면 `{status:'miss_no_trigger'}` 반환
- `src/widgets/congress/hooks/useCongressTrend.ts` line 55-57: `if (submitted.status === 'miss_no_trigger') throw new BotBlockedError();`
- `src/widgets/congress/CongressTrendSummary.tsx` line 37-39: `bot_blocked` → `<BotBlockedNotice />`

(c) **검증 방법**:

```bash
# AAPL을 봇 UA로 요청 → SSR 표는 그대로, AI 동향 영역은 폴링 후 봇 차단 메시지
curl -s -A 'Googlebot/2.1 (+http://www.google.com/bot.html)' \
  "http://localhost:4200/AAPL/congress" -o /tmp/bot-congress.html
# 기대: HTTP 200
echo "HTTP=$(curl -s -A 'Googlebot/2.1' -o /dev/null -w '%{http_code}' http://localhost:4200/AAPL/congress)"

# 표 SSR 텍스트 확인 — 컬럼 헤더 "구분"/"의원"/"매수/매도"/"금액 구간"/"거래일"/"공시일" 모두 박혀있어야 함
grep -E '구분|매수/매도|금액 구간|거래일|공시일' /tmp/bot-congress.html | head
# 기대: 6개 컬럼 헤더 모두 매치

# AI 동향 영역은 클라 폴링이라 HTML에 'AI 동향 해석' 셀 자체는 있으나 결과는 비어있음 — SSR 단계에선 검증 불가, Chrome MCP 단계에서 검증
```

Chrome MCP (봇 UA로 새 탭):
1. `tabs_create_mcp` 또는 user-agent 변경 후 `navigate(url='http://localhost:4200/AAPL/congress')` (Chrome DevTools UA override가 더 정확)
2. `find(query='AAPL 의회 거래')` → h1 매치
3. `find(query='상원')` 또는 `find(query='하원')` → 표 행 매치
4. 약 3초 대기 후 `find(query='봇 트래픽으로 보여 분석 결과를 표시하지 않았어요.')` → 매치 (BotBlockedNotice)
5. `read_network_requests` → `submitCongressTrendAction` 응답 본문에 `miss_no_trigger` (또는 cached일 수도 있음 — warm cache는 cached로 통과시킴)

(d) **기대 결과**:
- 봇 UA 요청도 200 + SSR 표 노출
- `BotBlockedNotice` 또는 (warm cache hit 시) `CongressTrendSummaryView`가 노출, 둘 중 하나
- 절대 LLM 잡 enqueue 발생 안 함 (`miss_no_trigger` 또는 `cached`만 가능, `submitted` 상태 금지)

---

## 5. 캐시 TTL, 캐시 키 유일성 (2-key + MAX-fetch + read-time-slice)

(a) **검증 대상**:
- Redis 키 2개 분리: `congress:senate:<SYM>` / `congress:house:<SYM>` (예: `congress:senate:AAPL`)
- TTL = `CONGRESS_REVALIDATE_SECONDS = 86400s = 24h`
- inner 호출은 항상 `CONGRESS_MAX_TRADES=100`로 fetch하고, 호출자의 `limit`은 **읽을 때 `.slice(0, limit)`** 으로 적용 (truncation 버그 방지)
- 정상 빈 `[]`는 캐시, throw는 캐시 안 함 (re-throw)

(b) **위치**:
- `src/shared/api/fmp/CachedCongressTradesProvider.ts` line 11 (`TTL = CONGRESS_REVALIDATE_SECONDS`), line 23 (`CONGRESS_MAX_TRADES=100`), line 48-61 (key 스킴 + slice 패턴)
- `src/shared/config/time.ts` line 20: `CONGRESS_REVALIDATE_SECONDS = SECONDS_PER_DAY; // 24h`
- `src/entities/congress-trades/lib/getCongressTrades.ts` line 8 (`CONGRESS_TRADE_LIMIT=50`), line 24-37 (per-chamber 키 + `congress:${upper}` group tag)

(c) **검증 방법**:

```bash
# 단위 테스트로 키 스킴/MAX/slice/null 비대칭 검증
yarn vitest run \
  src/shared/api/fmp/__tests__/CachedCongressTradesProvider.test.ts \
  src/entities/congress-trades/lib/__tests__/getCongressTrades.test.ts
# 기대: 모든 케이스 PASS, 특히 다음 케이스:
#   - "uses key congress:senate:<SYM>" / "uses key congress:house:<SYM>"
#   - "always fetches with MAX, slices to caller limit on read"
#   - "rethrows on inner throw (does not cache failures)"

# 실제 prod 빌드에서 캐시 키 확인 (Redis 직접 접근 가능한 환경에서)
# (선택) Upstash CLI 또는 redis-cli:
#   keys "congress:*"
# 기대: AAPL 방문 후 congress:senate:AAPL, congress:house:AAPL 2개 존재

# AAPL 첫 방문(cold) vs 두 번째 방문(warm) 응답시간 차이 확인
time curl -s -o /dev/null "http://localhost:4200/AAPL/congress"
time curl -s -o /dev/null "http://localhost:4200/AAPL/congress"
# 기대: 두 번째 호출이 첫 번째보다 빠름 (Redis HIT)
```

Chrome MCP — 캐시 키는 직접 관찰 불가하므로 단위 테스트로 대체.

(d) **기대 결과**:
- vitest 캐시 테스트 전부 PASS
- (Redis 접근 가능 시) `keys congress:*` 결과에 chamber별 키 2개 존재
- warm 요청이 cold보다 명백히 빠름

---

## 6. AI 잡 lifecycle (submit → poll → cancel + 5-state union)

(a) **검증 대상**:
- 5개 상태 `loading | done | no_trades | bot_blocked | error` 분기가 모두 정상 렌더된다
- `pagehide` 이벤트에 jobId가 sendBeacon으로 `/api/jobs/cancel`에 전달되고, `type:'congress'` 라우팅으로 core `cancelCongressTrendJob`가 호출된다
- 0건은 LLM 잡 자체를 dispatch하지 않는다 (`NoCongressTradesError` 센티넬)
- modelId/symbol 변경 시 이전 jobId가 cancel되고 currentJobIdRef가 깔끔히 비워진다

(b) **위치**:
- `src/widgets/congress/hooks/useCongressTrend.ts` (전체)
  - line 29-34: `NoCongressTradesError` 센티넬 클래스
  - line 36-41: `CongressTrendState` union 5종
  - line 46-86: `fetchCongressTrend` submit→poll 루프
  - line 128-134: `getPageHideJobs` → `usePageHideCancel`
  - line 147-157: unmount cleanup에서 `cancelCongressTrendJobAction` 호출
- `src/entities/analysis/actions/cancelCongressTrendJobAction.ts` (best-effort cancel)
- `src/app/api/jobs/cancel/route.ts` line 26 (VALID_JOB_TYPES), line 66-67 (switch case 'congress')

(c) **검증 방법**:

```bash
# 단위 테스트로 5-state 분기 + cancel 라우팅 검증
yarn vitest run \
  src/widgets/congress/hooks/__tests__/useCongressTrend.test.tsx \
  src/entities/analysis/actions/__tests__/submitCongressTrendAction.test.ts
# 기대: PASS — 특히 다음:
#   - "loading → done on cached submit"
#   - "loading → done on submitted+poll loop"
#   - "submitted miss_no_trigger → bot_blocked"
#   - "submitted no_trades → no_trades"
#   - "poll error → error"
#   - "cancel on unmount"
#   - "pagehide cancel routes type='congress'"
```

Chrome MCP (실제 페이지 동작):
1. `navigate(url='http://localhost:4200/AAPL/congress')`
2. `read_network_requests` 즉시 호출 → `submitCongressTrendAction` 요청 발견
3. 1-2초 후 `read_network_requests` → `pollCongressTrendAction` 폴링 (cached가 아닌 경우)
4. `find(query='최근 의회 거래는')` 또는 `find(query='AI 동향 해석')` → 결과 렌더링 확인
5. `navigate(url='http://localhost:4200/MSFT/congress')` (다른 종목 이동)
6. `read_network_requests` → `/api/jobs/cancel` POST 호출, body에 `type:"congress"` 포함 검증 (이전 jobId가 있을 때만)

(d) **기대 결과**:
- vitest 훅 테스트 전부 PASS
- 브라우저: submit → (poll loop or cached) → AI 카드 렌더
- 종목 이동 시 `/api/jobs/cancel`에 `[{jobId, type:'congress'}]` POST됨 (jobId가 있던 경우)

---

## 7. SEO 표면 (title / description / canonical / OG / Twitter / BreadcrumbList / h1)

(a) **검증 대상**:
- `<title>`: `AAPL 의회 거래 — 상원·하원 의원 매매 공시 | Siglens`
- `<meta name="description">`: 약 90~115자 + `clampSeoDescription(120)` 적용
- `<link rel="canonical" href="https://siglens.io/AAPL/congress">`
- OG: `og:type=website`, `og:site_name=Siglens`, `og:title`, `og:description`, `og:url`, `og:locale=ko_KR`
- Twitter: `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`
- BreadcrumbList JSON-LD: `Siglens` → `AAPL` → `의회 거래` (3 levels)
- WebPage JSON-LD (`@type=WebPage`)
- `<h1>`: `{displayName} 의회 거래` (displayName = "AAPL" fallback 또는 "Apple Inc. (AAPL)" 등)
- OG/Twitter 이미지: `/AAPL/congress/opengraph-image` + `/AAPL/congress/twitter-image` 모두 PNG 응답

(b) **위치**:
- `src/app/[symbol]/congress/page.tsx`
  - line 44-101: generateMetadata
  - line 162-177: WebPage + BreadcrumbList JSON-LD
  - line 183-184: `<SymbolPageHeading>{displayName} 의회 거래</SymbolPageHeading>`
- `src/shared/lib/seo.ts` line 273-327: `buildSymbolCongressSeoContent` / description / keywords
- `src/app/[symbol]/congress/opengraph-image.tsx`, `twitter-image.tsx`

(c) **검증 방법**:

```bash
# title / canonical / robots / og / twitter
curl -s "http://localhost:4200/AAPL/congress" > /tmp/aapl-congress.html

grep -oE '<title>[^<]+</title>' /tmp/aapl-congress.html
# 기대: <title>AAPL 의회 거래 — 상원·하원 의원 매매 공시 | Siglens</title>

grep -oE '<meta name="description" content="[^"]+"' /tmp/aapl-congress.html
# 기대: 95~115자 정도, "미국 상원·하원" 포함, "AI" 포함, 끝에 …없거나 있어도 정상

grep -oE '<link rel="canonical" href="[^"]+"' /tmp/aapl-congress.html
# 기대: href="https://siglens.io/AAPL/congress"

grep -oE 'property="og:[^"]+" content="[^"]+"' /tmp/aapl-congress.html | head -10
# 기대: og:type=website, og:site_name=Siglens, og:title, og:description, og:url, og:locale=ko_KR

grep -oE 'name="twitter:[^"]+" content="[^"]+"' /tmp/aapl-congress.html | head -5
# 기대: twitter:card=summary_large_image, twitter:title, twitter:description

# JSON-LD 2개 (WebPage + BreadcrumbList)
grep -oE '<script type="application/ld\+json">[^<]+' /tmp/aapl-congress.html | head -5
# 기대: 2개 script. 하나는 "@type":"WebPage", 다른 하나는 "@type":"BreadcrumbList".
#       BreadcrumbList의 itemListElement는 [Siglens, AAPL, 의회 거래] 순.

# h1 SSR
grep -oE '<h1[^>]*>[^<]+</h1>' /tmp/aapl-congress.html
# 기대: <h1...>AAPL 의회 거래</h1> 또는 displayName에 한국명 포함 시 "애플... 의회 거래"

# OG/Twitter 이미지 — PNG 200
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' "http://localhost:4200/AAPL/congress/opengraph-image"
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' "http://localhost:4200/AAPL/congress/twitter-image"
# 기대: 200 image/png (둘 다)
```

Chrome MCP:
1. `navigate(url='http://localhost:4200/AAPL/congress')`
2. `get_page_text()` → 위 SEO 요소 모두 확인 (위 curl과 동일)
3. `find(query='AAPL 의회 거래')` → h1 매치 (level=1 heading 1개만 존재)
4. (선택) DevTools Lighthouse SEO 점수 90+ 권고

(d) **기대 결과**:
- 위 grep 8개 모두 기대 패턴 매치
- OG/Twitter 이미지 200 + image/png
- h1이 페이지에 단 1개만 존재 (CongressDegraded도 동일하게 SymbolPageHeading 1개 — `notFound()` 케이스만 SymbolPageHeading 미렌더)

---

## 8. Cross-tab 통합 (탭 네비 + CrossLinkCards)

(a) **검증 대상**:
- `symbolTabsConfig.ts` `TABS` 배열에 `congress`가 **position 4** (0-indexed; chart, news, fundamental, financials, **congress**, options, fear-greed, overall 순)
- `CrossLinkCards.tsx` `ALL_PAGES`에 `congress`가 8개 항목 중 위치는 무관하나 존재 (chart, news, fundamental, financials, options, fear-greed, congress, overall 순 — 이 경우 position **6**)
- 탭 네비에서 `의회 거래` 탭이 `aria-current="page"`
- AAPL/congress 페이지 하단 CrossLinkCards에 다른 7개 탭이 링크로 노출되고 본인은 `aria-current="page"` div로 표시 + "지금 보는 페이지예요" 카피

(b) **위치**:
- `src/widgets/symbol-page/utils/symbolTabsConfig.ts` line 25-28
- `src/widgets/symbol-page/CrossLinkCards.tsx` line 4-13 (`ALL_PAGES`), line 19, 24, 36 (LABEL/DESC/HREF 매핑)

(c) **검증 방법**:

```bash
# TABS 배열에 congress가 5번째 (0-indexed=4)
grep -nE "^\s+\{" src/widgets/symbol-page/utils/symbolTabsConfig.ts
# 기대: 5번째 객체가 congress

# CrossLinkCards ALL_PAGES에 congress 존재
grep -nE "'congress'" src/widgets/symbol-page/CrossLinkCards.tsx
# 기대: 매치 (ALL_PAGES, LABEL, DESCRIPTION, HREF 4곳)

# 실제 페이지 HTML 검증
curl -s "http://localhost:4200/AAPL/congress" | grep -oE 'aria-current="page"[^>]*>[^<]+' | head -5
# 기대: "의회 거래" 텍스트가 aria-current=page에 매치 (탭 네비)
#       + CrossLinkCards에 "지금 보는 페이지예요" 마커

curl -s "http://localhost:4200/AAPL/congress" | grep -c "의회 거래"
# 기대: 4 이상 (h1, 탭, CrossLink, sr-only 등)
```

Chrome MCP:
1. `navigate(url='http://localhost:4200/AAPL')`
2. `find(query='의회 거래')` → 탭 네비에 링크로 노출
3. 탭 클릭 후 (또는 직접 `navigate(url='http://localhost:4200/AAPL/congress')`)
4. `get_page_text()` 또는 DOM 검사로 탭 네비의 "의회 거래" 링크가 `aria-current="page"` 보유
5. 스크롤 다운하여 CrossLinkCards 영역 확인 → 8개 카드, "의회 거래"는 비활성 div + "지금 보는 페이지예요" 카피, 나머지 7개는 Link
6. CrossLinkCards에서 "재무제표" 카드 클릭 → `/AAPL/financials` 이동 정상

(d) **기대 결과**:
- 위 grep 매치
- 탭 위치 5번째 (chart, news, fundamental, financials, **의회 거래**, options, fear-greed, overall)
- CrossLinkCards 8장 (자기 자신 1장은 비활성 + 나머지 7장은 Link)

---

## 9. 표 내용 검증 (실측 데이터로)

(a) **검증 대상**: AAPL congress 표가 실제 FMP 데이터로 렌더링되며, 컬럼 10종(구분/의원/매수매도/금액 구간/종류/거래일/공시일/보유자/자산설명/공시 link) 모두 의도대로 표시된다.

(b) **위치**: `src/widgets/congress/CongressTradesTable.tsx` line 161-320

(c) **검증 방법**:

```bash
# FMP에서 AAPL의 senate/house 거래가 있는지 직접 확인 (참고용)
# FMP_API_KEY는 .env.local에서 가져오기
# 만약 FMP_API_KEY 미설정 환경이면 이 단계 스킵하고 Chrome MCP만 사용
source .env.local 2>/dev/null
if [ -n "$FMP_API_KEY" ]; then
  curl -s "https://financialmodelingprep.com/stable/senate-trades?symbol=AAPL&apikey=$FMP_API_KEY" | jq 'length'
  curl -s "https://financialmodelingprep.com/stable/house-trades?symbol=AAPL&apikey=$FMP_API_KEY" | jq 'length'
fi
# 기대: 둘 다 1 이상 (AAPL은 활발한 거래 종목)

# 페이지 HTML에 senate/house 어느 한쪽이라도 행이 있는지
curl -s "http://localhost:4200/AAPL/congress" > /tmp/aapl-table.html
grep -cE '상원|하원' /tmp/aapl-table.html
# 기대: 2 이상 (chamber 라벨 + 툴팁 내용)
grep -cE '<tbody>|<tr ' /tmp/aapl-table.html
# 기대: 거래 행이 있을 때 다수
```

Chrome MCP:
1. `navigate(url='http://localhost:4200/AAPL/congress')`
2. `find(query='상원')` 또는 `find(query='하원')` → 매치
3. `find(query='$')` → 금액 구간(예: "$1,001 - $15,000") 매치
4. `find(query='매수')` 또는 `find(query='매도')` → 사이드 라벨 매치
5. 표 헤더 컬럼 10개 (구분/의원/매수/매도/금액 구간/종류/거래일/공시일/보유자/자산 설명/공시) 모두 노출
6. "공시" 링크 항목 → 외부 도메인 (`efdsearch.senate.gov` 또는 `disclosures-clerk.house.gov`)으로 `target="_blank" rel="noopener noreferrer"` 보유
7. 거래일 / 공시일 컬럼은 ISO 형식 (YYYY-MM-DD)
8. `read_console_messages` → 에러/경고 0건

(d) **기대 결과**:
- 표에 최소 1행 이상 (AAPL은 활발 종목이라 보통 수 개 이상)
- 컬럼 10개 모두 노출
- 공시 link는 외부 도메인 + 보안 속성
- 콘솔 에러 없음

---

## 10. 챗봇 컨텍스트 (chatState)

(a) **검증 대상**: congress 탭에서 챗봇 입력창에 `congress` context가 publish되어 챗봇이 이 페이지의 거래/AI 동향을 인지한다.

(b) **위치**: `src/widgets/congress/utils/buildChatState.ts` (`context: { kind: 'congress', payload: result }`)

(c) **검증 방법**:

```bash
# 단위 테스트
yarn vitest run src/widgets/congress/utils/__tests__/buildChatState.test.ts
# 기대: PASS — "done state → kind:congress payload", "non-done state → context:null"
```

Chrome MCP:
1. `navigate(url='http://localhost:4200/AAPL/congress')`
2. AI 동향 카드가 렌더된 후 (3초 대기)
3. 챗봇 플로팅 버튼 (`FloatingChatButton`) 열기
4. `find(query='의회 거래에 대해')` 류의 추천 질문 또는 챗봇 placeholder가 congress 컨텍스트 인식 (적절한 가이드 문구) 확인
5. 챗봇 인풋이 활성화 (isAnalysisReady=true)
6. 다른 탭(예: /AAPL/financials)로 이동 후 재진입 → 이전 stale context가 없는지 (loading 동안 context:null) 확인

(d) **기대 결과**:
- vitest PASS
- 챗봇 입력창 활성화 (loading/error/no_trades 동안엔 비활성)
- context는 done 상태에서만 `kind:'congress'`

---

## 11. 부수 검증 (전체 회귀 0)

(a) **검증 대상**: congress 탭 추가가 기존 탭/페이지 동작에 영향을 주지 않는다 (회귀 0).

(b) **검증 방법**:

```bash
# 기존 탭 모두 200
for tab in '' /news /fundamental /financials /options /fear-greed /overall; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:4200/AAPL$tab")
  echo "AAPL$tab → $code"
done
# 기대: 모두 200

# 빌드 로그에서 다른 라우트의 ●(SSG) 표시 유지 확인
grep -E '/\[symbol\]' /tmp/build-congress.log | grep -v congress
# 기대: 다른 탭들도 모두 ●(SSG)

# 전체 단위 테스트 PASS
yarn test
# 기대: PASS

# Lint
yarn lint
# 기대: PASS (boundaries 규칙 위반 0)
```

(d) **기대 결과**:
- 기존 7개 탭 200
- 전체 단위 테스트 PASS
- lint PASS

---

## 12. 검증 결과 체크리스트 (사람이 한 번에 보는 요약)

| # | 검증 항목 | 명령/도구 | PASS 조건 |
|---|---|---|---|
| 1 | ISR 빌드: `●` (SSG) | `grep '/\[symbol\]/congress' /tmp/build-congress.log` | `●` 마커 |
| 2 | revalidate 리터럴 | `grep 'export const revalidate' page.tsx` | `86400` 정확히 |
| 3 | AAPL warm cache HIT | `curl -D - /AAPL/congress` (2회) | 2회차 `x-nextjs-cache: HIT` |
| 4 | INVALID 404 | `curl /INVALID_NOPE_/congress` | 404 |
| 5 | ZZZZZZ 404 | `curl /ZZZZZZ/congress` | 404 |
| 6 | AAPL noindex 없음 | `grep robots /AAPL/congress` | noindex 미포함 |
| 7 | EMPTYX 200 + indexable | E2E_TEST=1 모드 4201 port | 200 + "거래 내역 없음" + noindex 없음 |
| 8 | EMPTYX degrade 카피 없음 | E2E_TEST=1 | "데이터를 일시적으로 불러올 수 없어요" 미매치 |
| 9 | 봇 UA 표 SSR | `curl -A Googlebot` | 200 + 컬럼 6개 매치 |
| 10 | 봇 AI skipEnqueue | Chrome MCP DevTools UA override | `submitted` 상태 미발생 |
| 11 | Redis 키 2개 | (Redis 접근 시) `keys congress:*` | `congress:senate:AAPL` + `congress:house:AAPL` |
| 12 | title 일치 | `grep title` | `AAPL 의회 거래 — 상원·하원 의원 매매 공시 \| Siglens` |
| 13 | canonical 일치 | `grep canonical` | `https://siglens.io/AAPL/congress` |
| 14 | OG 5종 | `grep og:` | type/site_name/title/description/url/locale |
| 15 | Twitter 3종 | `grep twitter:` | card/title/description |
| 16 | JSON-LD 2개 | `grep ld+json` | WebPage + BreadcrumbList |
| 17 | h1 SSR | `grep '<h1'` | 1개만 + 텍스트 일치 |
| 18 | OG 이미지 PNG | `curl /AAPL/congress/opengraph-image` | 200 + image/png |
| 19 | Twitter 이미지 PNG | `curl /AAPL/congress/twitter-image` | 200 + image/png |
| 20 | 탭 5번째 | TABS 배열 위치 | financials 다음, options 앞 |
| 21 | CrossLink 8개 | 페이지 하단 | 자기 자신 비활성, 7개 Link |
| 22 | 표 컬럼 10개 | Chrome MCP find | 10개 헤더 모두 노출 |
| 23 | 공시 link 외부 | Chrome MCP | target=_blank + rel=noopener |
| 24 | 챗봇 컨텍스트 | Chrome MCP 플로팅 챗봇 | done 상태에서 context publish |
| 25 | 종목 이동 시 cancel | Chrome MCP read_network | `/api/jobs/cancel` POST + type:'congress' |
| 26 | 기존 탭 회귀 0 | 7개 탭 curl | 모두 200 |
| 27 | vitest 전체 PASS | `yarn test` | PASS |
| 28 | lint PASS | `yarn lint` | PASS |

---

## 13. ⚠️ Controller에 보고해야 할 사항

1. **cross-repo 잠금**: siglens-core 0.24.0이 GitHub Packages에 publish되기 전까지 CI/Vercel 빌드는 불가. 본 실증은 로컬 overlay 한정. 실증 PASS 후 사용자가 core 0.24.0 release → siglens package.json 의존성 갱신 → master merge 순서 필요.
2. **`yarn install` 금지 경고**: overlay 보존을 위해 실증 도중 의존성 재설치 절대 금지. 만약 lockfile 변경이 필요하면 별도 PR로 분리.
3. **EMPTYX 검증은 prod 빌드에서 자연 재현 불가**: FakeCongressTradesProvider는 `E2E_TEST=1`에서만 활성. 실증 시 별도 포트(4201)에서 E2E_TEST=1로 추가 기동 필요.
4. **AAPL 표 행 0건 회귀 위험**: FMP가 AAPL 거래를 일시적으로 0건 반환하면 happy path 표 SSR 검증이 false-pass된다. §9의 FMP 직접 curl 단계를 반드시 실행해 1건 이상임을 확인 후 진행.
5. **tradesDegraded(FMP infra 장애 → noindex) 분기는 prod 빌드에서 자연 재현 어려움**. vitest로만 분기 양방향 검증 가능. 실제 FMP 인프라 장애 주입은 별도 `E2E_FORCE_CONGRESS_ERROR_COOKIE`가 있으나 이는 LLM submit action만 영향을 주고 데이터 레이어(getCongressTrades)는 cookie를 읽지 않음. 데이터 레이어 degrade 시뮬레이션은 **유닛테스트만으로 충족**으로 결론.
6. **`SymbolPageHeading` h1 텍스트 가정**: displayName이 한국명까지 포함될 수 있어 `AAPL 의회 거래`로 정확 매치 안 될 수 있음 (예: "애플, Apple Inc. (AAPL) 의회 거래"). curl grep은 `의회 거래`로 느슨하게 매치 권장.
7. **`yarn build` 메모리 이슈 경계**: 워크트리 빌드 시 OOM 가능 — `NODE_OPTIONS=--max-old-space-size=8192 yarn build` 고려.
