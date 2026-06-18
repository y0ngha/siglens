# `/[symbol]/congress` — production-like 실증 테스트 케이스

> 2026-06-17 · `feat/symbol-congress-trades` 브랜치 prod-like 빌드 실증용 self-contained test sheet.
> 이 시트만 보고 사람 또는 후속 Opus 에이전트가 끝까지 실행 가능하도록 작성했다.
>
> 소스 오브 트루스:
> - 검증 스펙: `docs/superpowers/specs/2026-06-17-congress-tab-verification-spec.md`
> - 설계 스펙: `docs/superpowers/specs/2026-06-16-symbol-congress-trades-design.md`
>
> ⚠️ **금지**: 실증 도중 `yarn install` / `rm -rf node_modules` / `yarn install --check-files` —
> siglens-core 0.24.0 dist overlay가 node_modules에 적용된 상태이며, 재설치 시 0.23.0으로 덮여
> congress export가 사라져 빌드가 깨진다. 의존성 변경이 필요하면 별도 PR로 분리.

---

## 0. Sequencing & port map

두 개의 서버를 띄워 시나리오별로 분리한다. 같은 호스트에서 동시에 떠 있어도 무방하나, 실행 순서는 아래를 권장.

| 포트 | 빌드 모드 | 데이터 소스 | 용도 | 다루는 TC |
|---|---|---|---|---|
| **4300** | `yarn build && PORT=4300 yarn start` (E2E_TEST unset) | 실제 FMP API | happy / SEO / bot / cache / 404 / 회귀 | TC-01 ~ TC-06, TC-13, TC-14, TC-16 ~ TC-21 |
| **4201** | `E2E_TEST=1 yarn build && PORT=4201 E2E_TEST=1 yarn start` | Fake providers + 픽스처 | 0건(EMPTYX) / 강제 AI 에러 쿠키 | TC-07 ~ TC-09, TC-15 |
| 4300 (변형) | `.env.local`의 FMP_API_KEY를 잘못된 값으로 임시 변경 후 재기동 | FMP 강제 장애 | degraded noindex 분기 | TC-11, TC-12 |

### 권장 실행 순서

1. **부트스트랩 A** (port 4300, prod) — Bootstrap 부록 §1 따라 빌드+기동.
2. **TC-01 → TC-06, TC-13, TC-14, TC-16 ~ TC-21** (port 4300 전용 시나리오)
3. **부트스트랩 B** (port 4201, E2E_TEST=1) — Bootstrap 부록 §2 따라 빌드+기동.
4. **TC-07 ~ TC-09, TC-15** (port 4201 전용 시나리오)
5. **부트스트랩 C** (port 4300 재기동, FMP_API_KEY 손상) — Bootstrap 부록 §3 따라 진행.
6. **TC-11** 수행 후 **TC-12** 로 복구 확인 (.env.local 원복 — 메모리 `env_local_restore_after_qa_swap` 준수).
7. **Teardown** 부록 따라 양 서버 종료.

### 기대 텍스트 사전 (구현에서 추출, 변경 시 reconciliation 필요)

| 키 | 실측 문자열 | 위치 |
|---|---|---|
| h1 | `<displayName> 의회 거래` | `page.tsx:184` |
| sr-only h2 | `<displayName> 의회 의원 매매 공시 개요` | `page.tsx:186` |
| 표 caption | `의회 거래 공시 목록` | `CongressTradesTable.tsx:172` |
| 표 헤더 10종 | `구분 / 의원 / 매수/매도 / 금액 구간 / 종류 / 거래일 / 공시일 / 보유자 / 자산 설명 / 공시` | `CongressTradesTable.tsx:179~237` |
| 거래 0건 카드(표 영역) | `거래 내역 없음` | `CongressTradesEmpty.tsx:15` |
| AI 0건 카드(no_trades) | `최근 의회 거래가 없어 동향 해석을 생성하지 않았어요.` | `CongressTrendSummaryEmpty.tsx:22` |
| AI 봇 메시지 | `봇 트래픽으로 보여 분석 결과를 표시하지 않았어요.` | `BotBlockedNotice.tsx:25` |
| AI 에러 헤딩 | `AI 동향 해석` + `다시 시도` 버튼 | `CongressTrendSummaryError.tsx` |
| AI 로딩 카피 | `AI 동향 해석 진행 중…` | `CongressTrendSummarySkeleton.tsx` |
| degrade 카피 | `의회 거래 데이터를 일시적으로 불러올 수 없어요` | `CongressDegraded.tsx:33` |
| 타이틀 | `<TICKER> 의회 거래 — 상원·하원 의원 매매 공시 \| Siglens` | `seo.ts:281` |
| description | `미국 상원·하원 의원의 <subject> 매매 공시 내역을 공시지연 약 45일을 감안해 AI가 동향으로 요약합니다.` (clamp 120) | `seo.ts:297` |
| 픽스처 summaryKo (E2E only) | `최근 의회 거래는 매수 우세예요.` | `e2e/fixtures/analysis.json` |

---

## TC-01 — `/AAPL/congress` 200 + h1 + 표 + indexable

**Surface**: 검색 크롤러 + 일반 방문자가 보는 SSR 출력
**Scope**: 검증 스펙 §2 (ISR 4축), §7 (SEO), §9 (표)
**Pre-conditions**: port 4300 prod build 기동 중 (Bootstrap §1). FMP_API_KEY 정상.

### Steps
1. `curl -s -D /tmp/aapl-headers.txt -o /tmp/aapl-congress.html http://localhost:4300/AAPL/congress`
2. 응답 코드 / 헤더 / 본문에서 다음 단언:
   - HTTP 200
   - `<title>` 에 `AAPL 의회 거래 — 상원·하원 의원 매매 공시 | Siglens` 포함
   - `<h1` 에 `의회 거래` 포함 (displayName 한국명 fallback 허용 — 정확한 prefix는 검증 스펙 §13 #6 참조)
   - `<meta name="robots"` 가 없거나 noindex 미포함
3. 동일 URL 재요청하여 `x-nextjs-cache: HIT` 검증.

### Expected
- HTTP 200
- HTML에 `<h1...>...의회 거래</h1>` 단 1개
- `<table>` + `<tbody>` 적어도 1개 행 (AAPL 활성 종목)
- 2회차 요청 응답 헤더 `x-nextjs-cache: HIT`
- `<meta name="robots" content="noindex` 미존재

### How to verify (curl)
```bash
# 1회차
curl -s -o /tmp/aapl-congress.html -D /tmp/aapl-h1.txt -w 'HTTP=%{http_code}\n' \
  http://localhost:4300/AAPL/congress
grep -oE '<title>[^<]+</title>' /tmp/aapl-congress.html
#   → <title>AAPL 의회 거래 — 상원·하원 의원 매매 공시 | Siglens</title>
grep -c '<h1' /tmp/aapl-congress.html
#   → 1
grep -E 'name="robots".*noindex' /tmp/aapl-congress.html | head -1
#   → (empty)
sleep 2
# 2회차 (warm)
curl -s -o /dev/null -D - http://localhost:4300/AAPL/congress | grep -i 'x-nextjs-cache'
#   → x-nextjs-cache: HIT
```

### How to verify (Chrome MCP)
- `mcp__claude-in-chrome__navigate(url='http://localhost:4300/AAPL/congress')`
- `mcp__claude-in-chrome__get_page_text()` → assert substring `의회 거래`
- `mcp__claude-in-chrome__find(query='의회 거래')` → match
- `mcp__claude-in-chrome__read_network_requests()` → entry for `/AAPL/congress` 응답 헤더 `x-nextjs-cache: HIT` (재방문 후)
- `mcp__claude-in-chrome__javascript_tool(code='document.querySelectorAll("h1").length')` → 1

### Pass/Fail recording
- [ ] curl pass
- [ ] Chrome pass
- Notes:

---

## TC-02 — 탭 바를 통한 cross-tab 클라이언트 네비게이션

**Surface**: 종목 페이지 탭 네비
**Scope**: 검증 스펙 §8 (cross-tab 통합)
**Pre-conditions**: port 4300 기동 중.

### Steps
1. Chrome MCP로 `/AAPL` 진입.
2. 탭바에서 `의회 거래` 텍스트의 링크를 클릭(또는 keyboard Enter).
3. URL 변경 확인 + 풀 리로드 없음 + active `aria-current="page"` 가 `의회 거래` 탭으로 옮겨감.

### Expected
- 클라이언트 라우팅 (Next.js Link) — full reload 없이 URL `/AAPL/congress` 로 변경
- 새 탭의 `<a>` 또는 `<div>` 가 `aria-current="page"` 보유
- 콘솔 에러 0

### How to verify (curl)
```bash
# 탭 정의에 congress가 position 4 (0-indexed)인지 정적 검증
grep -nE "key: '(chart|news|fundamental|financials|congress|options|fear-greed|overall)'" \
  src/widgets/symbol-page/utils/symbolTabsConfig.ts
#   → congress가 5번째 항목 (chart, news, fundamental, financials, congress, options, ...)
# 페이지 HTML에 aria-current=page + 의회 거래 매치
curl -s http://localhost:4300/AAPL/congress | grep -oE 'aria-current="page"[^>]*>[^<]+' | head -3
```

### How to verify (Chrome MCP)
- `mcp__claude-in-chrome__navigate(url='http://localhost:4300/AAPL')`
- `mcp__claude-in-chrome__find(query='의회 거래')` → 탭바에 매치
- `mcp__claude-in-chrome__javascript_tool(code="document.querySelector('a[href=\"/AAPL/congress\"]').click(); window.location.pathname")` →
  잠시 대기 후 `/AAPL/congress` 검증
- `mcp__claude-in-chrome__javascript_tool(code="performance.getEntriesByType('navigation')[0].type")` → `'navigate'` 가 아닌 SPA(`back_forward`/`reload` 아님) 검증
- `mcp__claude-in-chrome__read_console_messages()` → 에러 0

### Pass/Fail recording
- [ ] curl pass
- [ ] Chrome pass
- Notes:

---

## TC-03 — `CongressTrendSummary` skeleton → polling → done 전이

**Surface**: 클라이언트 폴링 훅(`useCongressTrend`)
**Scope**: 검증 스펙 §6 (AI 잡 lifecycle)
**Pre-conditions**: port 4300, 첫 방문(콜드)이라면 LLM 잡 폴링이 일어남. warm cache면 `cached` 즉시 done.

### Steps
1. `curl`로 SSR HTML을 받아 `AI 동향 해석 진행 중…` 또는 헤딩 `AI 동향 해석` 의 skeleton 자리가 존재함을 확인.
2. Chrome MCP로 페이지 진입 후 3~5초 대기.
3. `read_network_requests` 로 `submitCongressTrendAction` (그리고 cached 아니면 `pollCongressTrendAction`) 호출 확인.
4. DOM에 `AI 동향 해석` 헤딩이 done view(`CongressTrendSummaryView`) 형태로 안착되는지 확인.

### Expected
- 초기 HTML에 skeleton 또는 `AI 동향 해석` heading 1개 (loading state)
- 약 3초 내 done state 전이 → 결과 문장 노출 (cached 또는 폴링 후)
- 콘솔 에러 0

### How to verify (curl)
```bash
curl -s http://localhost:4300/AAPL/congress > /tmp/aapl.html
grep -c 'AI 동향 해석' /tmp/aapl.html
#   → 1 이상 (skeleton 헤딩 포함)
```

### How to verify (Chrome MCP)
- `mcp__claude-in-chrome__navigate(url='http://localhost:4300/AAPL/congress')`
- `mcp__claude-in-chrome__javascript_tool(code="document.querySelector('[aria-busy=\"true\"]') !== null")` → 초기 true 가능
- 3초 대기 후
- `mcp__claude-in-chrome__find(query='AI 동향 해석')` → 헤딩 매치
- `mcp__claude-in-chrome__read_network_requests()` → `submitCongressTrendAction` action POST 발견
- `mcp__claude-in-chrome__javascript_tool(code="document.querySelector('section[aria-labelledby*=\"congress-trend-summary\"]')?.innerText")` → 결과 텍스트 노출

### Pass/Fail recording
- [ ] curl pass
- [ ] Chrome pass
- Notes:

---

## TC-04 — JSON-LD WebPage + BreadcrumbList, canonical, OG 이미지 200

**Surface**: 검색 크롤러 / SNS 미리보기
**Scope**: 검증 스펙 §7 (SEO 표면)
**Pre-conditions**: port 4300.

### Steps
1. HTML curl로 가져와 JSON-LD `<script>` 2개 확인.
2. canonical link 확인.
3. opengraph-image / twitter-image 엔드포인트가 PNG 200 응답.

### Expected
- `<script type="application/ld+json">` 2개 — 하나는 `"@type":"WebPage"`, 다른 하나는 `"@type":"BreadcrumbList"`
- BreadcrumbList의 itemListElement 3 레벨 (Siglens 또는 site 항목 포함 여부는 `buildBreadcrumbJsonLd` 구현에 따름; AAPL + `의회 거래` 두 항목이 반드시 포함)
- `<link rel="canonical" href="https://siglens.io/AAPL/congress">`
- OG 이미지 + Twitter 이미지: HTTP 200, Content-Type `image/png`

### How to verify (curl)
```bash
curl -s http://localhost:4300/AAPL/congress > /tmp/aapl.html
grep -c 'application/ld+json' /tmp/aapl.html
#   → 2
grep -oE '<link rel="canonical" href="[^"]+"' /tmp/aapl.html
#   → href="https://siglens.io/AAPL/congress"
curl -s -o /dev/null -w 'OG=%{http_code} %{content_type}\n' \
  http://localhost:4300/AAPL/congress/opengraph-image
#   → OG=200 image/png
curl -s -o /dev/null -w 'TW=%{http_code} %{content_type}\n' \
  http://localhost:4300/AAPL/congress/twitter-image
#   → TW=200 image/png
```

### How to verify (Chrome MCP)
- `mcp__claude-in-chrome__navigate(url='http://localhost:4300/AAPL/congress')`
- `mcp__claude-in-chrome__javascript_tool(code="[...document.querySelectorAll('script[type=\"application/ld+json\"]')].map(s => JSON.parse(s.textContent)['@type'])")` →
  `['WebPage', 'BreadcrumbList']` 또는 반대 순서
- `mcp__claude-in-chrome__javascript_tool(code="document.querySelector('link[rel=canonical]').href")` → `https://siglens.io/AAPL/congress`

### Pass/Fail recording
- [ ] curl pass
- [ ] Chrome pass
- Notes:

---

## TC-05 — a11y/SEO 스모크: h1 단일, table scope, 외부 link 보안 속성

**Surface**: 스크린리더 / 검색 엔진
**Scope**: 검증 스펙 §7, §9, 부록 D #6
**Pre-conditions**: port 4300. AAPL은 보통 트레이드 다수 — 0건이면 TC-22로 reconciliation 메모 필요.

### Steps
1. HTML에서 `<h1>` 단 1개 검증.
2. `<thead>` 내부 `<th scope="col">` 10개 검증.
3. 표 안의 외부 disclosure link 에 `target="_blank"` + `rel="noopener noreferrer"` 모두 보유.

### Expected
- `<h1>` 단 1개 (CrossLinkCards 안에는 `<h3>`만 사용 — 부록 §C.1)
- `<th scope="col">` 카운트 10
- `efdsearch.senate.gov` 또는 `disclosures-clerk.house.gov` 또는 기타 FMP 제공 link 가 `rel="noopener noreferrer"` + `target="_blank"`

### How to verify (curl)
```bash
curl -s http://localhost:4300/AAPL/congress > /tmp/aapl.html
echo "h1 count=$(grep -oE '<h1[^>]*>' /tmp/aapl.html | wc -l)"
#   → h1 count=1
echo "th scope=col count=$(grep -oE '<th[^>]*scope="col"' /tmp/aapl.html | wc -l)"
#   → ≥ 10
grep -oE 'rel="noopener noreferrer"' /tmp/aapl.html | head -1
#   → match
grep -oE 'target="_blank"' /tmp/aapl.html | head -1
#   → match
```

### How to verify (Chrome MCP)
- `mcp__claude-in-chrome__navigate(url='http://localhost:4300/AAPL/congress')`
- `mcp__claude-in-chrome__javascript_tool(code="document.querySelectorAll('h1').length")` → 1
- `mcp__claude-in-chrome__javascript_tool(code="document.querySelectorAll('th[scope=col]').length")` → 10
- `mcp__claude-in-chrome__javascript_tool(code="[...document.querySelectorAll('a[href*=\"senate.gov\"], a[href*=\"house.gov\"], a[target=\"_blank\"]')].every(a => a.rel.includes('noopener') && a.rel.includes('noreferrer'))")` → true

### Pass/Fail recording
- [ ] curl pass
- [ ] Chrome pass
- Notes: AAPL 표 0건 시 외부 link 검증 불가 → 다른 활성 심볼(예: NVDA, TSLA, MSFT)로 fallback.

---

## TC-06 — InfoTooltip 키보드 접근성

**Surface**: 키보드 탐색 / 스크린 리더
**Scope**: 검증 스펙 §9 (표), 설계 §10 Phase 4 (frontend-design + web-design-guidelines)
**Pre-conditions**: port 4300, AAPL 거래 행이 있는 상태.

### Steps
1. 페이지 진입 후 Tab 키로 `InfoTooltip` trigger (chamber, 금액 구간, 공시 지연)에 도달 가능한지 확인.
2. trigger에 도달했을 때 트리거 button(또는 trigger element)이 focusable.
3. 스크린리더용 텍스트(aria-label 또는 자식 텍스트)가 존재.

### Expected
- chamber 행의 `상원` / `하원` 배지 옆 InfoTooltip 1개씩
- 금액 구간 헤더에 InfoTooltip 1개
- 공시일 헤더에 InfoTooltip 1개
- 모두 키보드 Tab으로 진입 가능

### How to verify (curl)
```bash
# 표 헤더의 툴팁 트리거 수: InfoTooltip은 일반적으로 <button>으로 렌더
# (정적 분석으로는 카운트만 확인)
curl -s http://localhost:4300/AAPL/congress | grep -oE 'aria-label="[^"]*tooltip' | wc -l
# Note: implementation detail — InfoTooltip aria-label은 컴포넌트별로 다를 수 있음.
# 정확한 카운트는 Chrome MCP에서 직접 검증.
```

### How to verify (Chrome MCP)
- `mcp__claude-in-chrome__navigate(url='http://localhost:4300/AAPL/congress')`
- `mcp__claude-in-chrome__javascript_tool(code="document.querySelectorAll('[aria-label*=\"안내\"], [aria-label*=\"info\"], button[aria-haspopup]').length")` → ≥ 3
- 키보드 시뮬레이션: `mcp__claude-in-chrome__javascript_tool(code="const btns = [...document.querySelectorAll('button')].filter(b => b.tabIndex >= 0); btns.length")` → ≥ 3

### Pass/Fail recording
- [ ] curl pass (정적 분석 한정)
- [ ] Chrome pass
- Notes: InfoTooltip 마크업 디테일은 `shared/ui/InfoTooltip` 구현에 의존. 정확 매칭 안 되면 reconciliation 필요.

---

## TC-07 — `/EMPTYX/congress` 200 (FakeCongressTradesProvider, port 4201)

**Surface**: 0-trades 종목 (sparse)
**Scope**: 검증 스펙 §3 (0건 vs 장애 비대칭) §B.6
**Pre-conditions**: port 4201, `E2E_TEST=1 yarn start` 기동 중 (Bootstrap §2).

### Steps
1. `curl -w '%{http_code}' http://localhost:4201/EMPTYX/congress` → 200.
2. HTML에 `거래 내역 없음` 정확히 1회 노출.

### Expected
- HTTP 200 (404 / 500 아님)
- 본문에 `거래 내역 없음` 1회
- 본문에 `의회 거래 데이터를 일시적으로 불러올 수 없어요` **미포함** (이건 degrade 카피)

### How to verify (curl)
```bash
curl -s -o /tmp/emptyx.html -w 'HTTP=%{http_code}\n' http://localhost:4201/EMPTYX/congress
#   → HTTP=200
grep -c '거래 내역 없음' /tmp/emptyx.html
#   → 1
grep -c '의회 거래 데이터를 일시적으로 불러올 수 없어요' /tmp/emptyx.html
#   → 0
```

### How to verify (Chrome MCP)
- `mcp__claude-in-chrome__navigate(url='http://localhost:4201/EMPTYX/congress')`
- `mcp__claude-in-chrome__find(query='거래 내역 없음')` → match (count=1)
- `mcp__claude-in-chrome__find(query='데이터를 일시적으로 불러올 수 없어요')` → no match
- `mcp__claude-in-chrome__javascript_tool(code="document.querySelectorAll('[role=status]').length")` → ≥ 1 (CongressTradesEmpty는 role=status)

### Pass/Fail recording
- [ ] curl pass
- [ ] Chrome pass
- Notes:

---

## TC-08 — EMPTYX는 noindex가 아니다 (§B.6 KEY DEVIATION)

**Surface**: 검색 크롤러
**Scope**: 검증 스펙 §3 (0건 정상 = indexable), 설계 §5 / 부록 B.6
**Pre-conditions**: port 4201.

### Steps
1. EMPTYX/congress 메타에 `noindex` 미포함 확인.

### Expected
- `<meta name="robots" content="noindex` 미존재
- 또는 robots 메타 자체가 없음 (Next 기본은 indexable)

### How to verify (curl)
```bash
curl -s http://localhost:4201/EMPTYX/congress > /tmp/emptyx.html
grep -E 'name="robots".*noindex' /tmp/emptyx.html | head -1
#   → (empty)
echo "noindex_count=$(grep -c 'noindex' /tmp/emptyx.html)"
#   → noindex_count=0
```

### How to verify (Chrome MCP)
- `mcp__claude-in-chrome__navigate(url='http://localhost:4201/EMPTYX/congress')`
- `mcp__claude-in-chrome__javascript_tool(code="(document.querySelector('meta[name=robots]')?.content || 'none').includes('noindex')")` → false

### Pass/Fail recording
- [ ] curl pass
- [ ] Chrome pass
- Notes:

---

## TC-09 — EMPTYX의 AI summary는 `no_trades` 카피

**Surface**: 클라 폴링 후 AI 카드
**Scope**: 설계 §6 (AI 0건 생략), `CongressTrendSummaryEmpty`
**Pre-conditions**: port 4201, EMPTYX 페이지에 진입한 상태.

### Steps
1. Chrome MCP로 페이지 진입 후 5초 대기.
2. AI 카드 영역에 `최근 의회 거래가 없어 동향 해석을 생성하지 않았어요.` 노출 확인.

### Expected
- AI 카드 본문에 `최근 의회 거래가 없어 동향 해석을 생성하지 않았어요.`
- AI 카드에 heading `AI 동향 해석` 단 1회

### How to verify (curl)
SSR만으로는 hook의 final state(no_trades)를 강제할 수 없음 — 검증은 Chrome MCP 단계에서 진행.

```bash
# 정적 분석으로 픽스처 또는 코드의 텍스트 매치 검증 (sanity)
grep -r '최근 의회 거래가 없어' /Users/y0ngha/Project/siglens/.claude/worktrees/feat+symbol-congress/src/widgets/congress
#   → CongressTrendSummaryEmpty.tsx 매치
```

### How to verify (Chrome MCP)
- `mcp__claude-in-chrome__navigate(url='http://localhost:4201/EMPTYX/congress')`
- 5초 대기 (state 안정화)
- `mcp__claude-in-chrome__find(query='최근 의회 거래가 없어 동향 해석을 생성하지 않았어요')` → match
- `mcp__claude-in-chrome__javascript_tool(code="document.body.innerText.includes('최근 의회 거래가 없어 동향 해석을 생성하지 않았어요')")` → true

### Pass/Fail recording
- [ ] curl pass
- [ ] Chrome pass
- Notes: Fake provider가 EMPTYX 처리 시 0건을 반환 → submit action이 `no_trades` 상태 반환 → 훅이 `NoCongressTradesError` 던짐 → `CongressTrendSummaryEmpty` 렌더. 픽스처 기반 `e2eCachedCongressTrend()`가 우선 매치되는 시나리오(symbol과 무관)도 있을 수 있으므로 만약 픽스처 `summaryKo` (`최근 의회 거래는 매수 우세예요.`)가 보이면 `no_trades` 경로가 우회된 것 → reconciliation 메모.

---

## TC-10 — Sitemap inclusion 정책 검증

**Surface**: 검색엔진 sitemap discovery
**Scope**: 검증 스펙 §11 (회귀), `next-best-practices`
**Pre-conditions**: port 4300.

### Steps
1. `/api/sitemap/popular` (또는 실제 sitemap route)에 `/AAPL/congress`가 포함되는지 확인.
2. EMPTYX/congress는 포함되지 않아야 함 (popular 기준에 해당하지 않음).

### Expected (Documented finding mode)
이 시점의 구현 실측을 그대로 기록한다 — fail로 단정하지 않는다.

- AAPL/congress가 popular sitemap에 포함되어 있으면 **PASS-included** 로 기록.
- 포함되어 있지 않으면 **DOCUMENTED-MISSING** 으로 기록(설계 audit-2/audit-4 finding 잔여 가능).
- EMPTYX/congress는 어떤 경우에도 포함 안 됨이 정상.

### How to verify (curl)
```bash
# sitemap endpoint 후보 탐색
curl -s -o /tmp/sitemap-popular.xml -w 'HTTP=%{http_code}\n' \
  http://localhost:4300/api/sitemap/popular
# 또는 robots.txt 확인하여 정확한 sitemap URL 추출
curl -s http://localhost:4300/robots.txt | grep -i sitemap
# AAPL/congress 포함 여부
grep -c '/AAPL/congress' /tmp/sitemap-popular.xml
grep -c '/EMPTYX/congress' /tmp/sitemap-popular.xml
#   EMPTYX: 0이 기대값
```

### How to verify (Chrome MCP)
- `mcp__claude-in-chrome__navigate(url='http://localhost:4300/api/sitemap/popular')`
- `mcp__claude-in-chrome__get_page_text()` → AAPL/congress 검색

### Pass/Fail recording
- [ ] curl pass (Documented finding)
- [ ] Chrome pass (Documented finding)
- Notes: AAPL/congress 포함/제외 상태를 명시 기록. 제외라면 후속 sitemap PR로 이슈화.

---

## TC-11 — FMP 강제 장애 시 degraded UI + noindex

**Surface**: FMP infra failure 시 사용자/크롤러 경험
**Scope**: 검증 스펙 §2 C5 (tradesDegraded → noindex), §3, `CongressDegraded.tsx`
**Pre-conditions**: port 4300 prod build 정지. `.env.local` 백업 후 `FMP_API_KEY=INVALID_TEST_KEY_DO_NOT_USE` 로 임시 변경 후 재기동 (Bootstrap §3).

### Steps
1. `.env.local` 백업: `cp .env.local /tmp/env-local-tc11-backup`
2. `.env.local`의 `FMP_API_KEY` 줄을 `FMP_API_KEY=INVALID_KEY_TC11` 로 임시 교체.
3. prod 서버 재기동 후 30초 대기.
4. `/AAPL/congress` 요청 → 200 + degrade 카피 + `noindex` 검증.

### Expected
- HTTP 200 (5xx 아님 — soft-200)
- HTML에 `의회 거래 데이터를 일시적으로 불러올 수 없어요` 정확히 1회
- `<meta name="robots" content="noindex` 포함
- `<h1>` 단 1개 + CrossLinkCards 정상 렌더

### How to verify (curl)
```bash
# Pre: backup
cp /Users/y0ngha/Project/siglens/.claude/worktrees/feat+symbol-congress/.env.local /tmp/env-local-tc11-backup
# (사용자가 직접 .env.local 편집 후 yarn build && yarn start 재기동)
curl -s -o /tmp/aapl-degraded.html -w 'HTTP=%{http_code}\n' http://localhost:4300/AAPL/congress
#   → HTTP=200
grep -c '의회 거래 데이터를 일시적으로 불러올 수 없어요' /tmp/aapl-degraded.html
#   → 1
grep -E 'name="robots".*noindex' /tmp/aapl-degraded.html | head -1
#   → match (noindex 포함)
```

### How to verify (Chrome MCP)
- `mcp__claude-in-chrome__navigate(url='http://localhost:4300/AAPL/congress')`
- `mcp__claude-in-chrome__find(query='의회 거래 데이터를 일시적으로 불러올 수 없어요')` → match
- `mcp__claude-in-chrome__javascript_tool(code="(document.querySelector('meta[name=robots]')?.content || '').includes('noindex')")` → true

### Pass/Fail recording
- [ ] curl pass
- [ ] Chrome pass
- Notes: ⚠️ 메모리 `env_local_restore_after_qa_swap` — 작업 종료 시 반드시 .env.local 원복(TC-12). prod 빌드의 데이터 캐시(Redis)는 invalid key 도입 직후 TTL 안에 있을 수 있으니, 새 심볼(예: `MSFT`) 또는 `revalidateTag` 호출이 필요할 수 있음.

---

## TC-12 — `.env.local` 복원 후 indexable 복귀

**Surface**: 인프라 복구 후 사용자 경험
**Scope**: 검증 스펙 §3, TC-11 페어
**Pre-conditions**: TC-11 수행 후, `.env.local` 원본 복원, 서버 재기동.

### Steps
1. `cp /tmp/env-local-tc11-backup .env.local` 로 원복.
2. 서버 재빌드+재기동.
3. `/AAPL/congress` 요청 → 200 + degrade 카피 미존재 + indexable.

### Expected
- HTTP 200
- HTML에 `의회 거래 데이터를 일시적으로 불러올 수 없어요` 0회
- `noindex` 미포함

### How to verify (curl)
```bash
# 복원 검증
diff /tmp/env-local-tc11-backup /Users/y0ngha/Project/siglens/.claude/worktrees/feat+symbol-congress/.env.local
#   → no diff

curl -s -o /tmp/aapl-restored.html -w 'HTTP=%{http_code}\n' http://localhost:4300/AAPL/congress
#   → HTTP=200
grep -c '의회 거래 데이터를 일시적으로 불러올 수 없어요' /tmp/aapl-restored.html
#   → 0
grep -E 'name="robots".*noindex' /tmp/aapl-restored.html | head -1
#   → (empty)
```

### How to verify (Chrome MCP)
- `mcp__claude-in-chrome__navigate(url='http://localhost:4300/AAPL/congress')`
- `mcp__claude-in-chrome__javascript_tool(code="(document.querySelector('meta[name=robots]')?.content || '').includes('noindex')")` → false
- `mcp__claude-in-chrome__find(query='데이터를 일시적으로 불러올 수 없어요')` → no match

### Pass/Fail recording
- [ ] curl pass
- [ ] Chrome pass
- Notes: ⚠️ 작업 완료 후 형제 워크트리(master)와 키 목록 diff로 누락 확인.

---

## TC-13 — Bot UA (`GPTBot`) — SSR 표 노출 + AI enqueue 회피

**Surface**: 검색 크롤러
**Scope**: 검증 스펙 §4 (봇 동작)
**Pre-conditions**: port 4300.

### Steps
1. `curl -A 'GPTBot/1.0' /AAPL/congress` 으로 SSR HTML 받기.
2. 표 컬럼 헤더 6개(구분/매수/매도/금액 구간/거래일/공시일 등) 노출 확인.
3. 5xx 미발생.
4. 봇 응답에서 LLM 잡 enqueue 없음 (네트워크/로그 직접 관찰은 어려우므로 컴포넌트 카피로 간접 확인 — Chrome MCP UA override 단계에서 추가 검증).

### Expected
- HTTP 200
- SSR 표 헤더: `구분`, `의원`, `매수/매도`, `금액 구간`, `거래일`, `공시일`, `보유자`, `자산 설명`, `공시` 모두 포함

### How to verify (curl)
```bash
curl -s -A 'GPTBot/1.0' -o /tmp/bot-aapl.html -w 'HTTP=%{http_code}\n' \
  http://localhost:4300/AAPL/congress
#   → HTTP=200
for col in '구분' '의원' '매수/매도' '금액 구간' '거래일' '공시일' '보유자' '자산 설명' '공시'; do
  count=$(grep -c "$col" /tmp/bot-aapl.html)
  echo "$col: $count"
done
#   → 각 컬럼 ≥ 1
```

### How to verify (Chrome MCP)
- Chrome DevTools UA override: `mcp__claude-in-chrome__javascript_tool(code="navigator.userAgent")` 확인 후 (Chrome MCP UA override는 환경 의존)
- `mcp__claude-in-chrome__navigate(url='http://localhost:4300/AAPL/congress')` (재요청)
- `mcp__claude-in-chrome__read_network_requests()` → `submitCongressTrendAction` 응답에 `submitted` status가 **없어야** 함 (`cached` 또는 `miss_no_trigger`만 허용)
- 또는 `mcp__claude-in-chrome__find(query='봇 트래픽으로 보여 분석 결과를 표시하지 않았어요')` → match (캐시 miss 시)

### Pass/Fail recording
- [ ] curl pass
- [ ] Chrome pass
- Notes: warm cache 상태에선 봇도 `cached`로 통과 — 이 경우 BotBlockedNotice 미렌더가 정상.

---

## TC-14 — Bot UA (`ClaudeBot`) — 같은 동작

**Surface**: 다른 LLM 봇 UA 분기 (isBot 정규식 커버리지)
**Scope**: 검증 스펙 §4, `src/shared/api/isBot.ts`
**Pre-conditions**: port 4300.

### Steps
1. `curl -A 'ClaudeBot/1.0 (+https://www.anthropic.com)' /AAPL/congress`.
2. 200 + 표 헤더 확인 + LLM 잡 enqueue 회피.

### Expected
- HTTP 200
- 표 컬럼 헤더 모두 노출
- 콘솔 에러 0 (TC-13과 동일 contract)

### How to verify (curl)
```bash
curl -s -A 'ClaudeBot/1.0 (+https://www.anthropic.com)' -o /tmp/claudebot.html \
  -w 'HTTP=%{http_code}\n' http://localhost:4300/AAPL/congress
#   → HTTP=200
grep -c '구분' /tmp/claudebot.html
#   → 1 이상
```

### How to verify (Chrome MCP)
- Chrome MCP UA override 후 reload 시:
- `mcp__claude-in-chrome__find(query='봇 트래픽으로 보여')` 또는 cached 시 정상 결과 노출
- `mcp__claude-in-chrome__read_network_requests()` 에 `submitted` status 없음

### Pass/Fail recording
- [ ] curl pass
- [ ] Chrome pass
- Notes:

---

## TC-15 — `e2e_force_congress_error=1` 쿠키 — AI 에러 + 표 정상

**Surface**: AI 동향 분석 강제 실패 경로 (resilience)
**Scope**: 검증 스펙 §5 (Group E 추가 시나리오)
**Pre-conditions**: port 4201, `E2E_TEST=1` 빌드 + 기동.

### Steps
1. 쿠키 설정: `curl -b 'e2e_force_congress_error=1' http://localhost:4201/AAPL/congress`
   또는 Chrome MCP의 `javascript_tool` 로 `document.cookie = 'e2e_force_congress_error=1; path=/'` 설정 후 리로드.
2. AI summary 카드: error 상태 (`AI 동향 해석` 헤딩 + 에러 메시지 + `다시 시도` 버튼).
3. 표(`CongressTradesTable`)는 정상 렌더 (쿠키는 AI action만 영향 — 데이터 레이어 미영향).
4. 쿠키 해제 후 리로드 → AI summary가 cached/done 상태로 복귀.

### Expected
- HTTP 200
- AI 카드 영역: error state (`E2E 강제 congress 동향 분석 실패` 또는 user-facing 변환된 메시지 + `다시 시도` 버튼)
- 표 영역: 정상 (행 0건이면 `거래 내역 없음` 카드 — fake provider가 AAPL에 대해 무엇을 반환하는지에 따름)
- 쿠키 해제 후 정상화

### How to verify (curl)
```bash
# SSR 단계에선 쿠키만으로 AI 상태가 안 보이므로(클라 폴링) HTTP 200 + 표 영역만 검증
curl -s -b 'e2e_force_congress_error=1' -o /tmp/e2e-aapl.html \
  -w 'HTTP=%{http_code}\n' http://localhost:4201/AAPL/congress
#   → HTTP=200
grep -c 'AI 동향 해석' /tmp/e2e-aapl.html
#   → ≥ 1 (heading)
```

### How to verify (Chrome MCP)
- `mcp__claude-in-chrome__navigate(url='http://localhost:4201/AAPL/congress')`
- `mcp__claude-in-chrome__javascript_tool(code="document.cookie='e2e_force_congress_error=1; path=/'; location.reload()")`
- 3초 대기
- `mcp__claude-in-chrome__find(query='다시 시도')` → match (버튼)
- `mcp__claude-in-chrome__javascript_tool(code="document.querySelector('button')?.innerText.includes('다시 시도')")` → true
- 쿠키 해제: `mcp__claude-in-chrome__javascript_tool(code="document.cookie='e2e_force_congress_error=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'; location.reload()")`
- 3초 대기
- `mcp__claude-in-chrome__find(query='최근 의회 거래는 매수 우세예요')` → match (픽스처 summaryKo)

### Pass/Fail recording
- [ ] curl pass
- [ ] Chrome pass
- Notes:

---

## TC-16 — 캐시 동작: MISS → HIT

**Surface**: ISR HTML 캐시 (Next.js x-nextjs-cache)
**Scope**: 검증 스펙 §2 C3, 메모리 `isr_revalidate_tuned`
**Pre-conditions**: port 4300, 첫 방문이거나 캐시 만료 직후.

### Steps
1. `curl -D - http://localhost:4300/AAPL/congress` 2회 연속 수행.
2. 1회차: `x-nextjs-cache: MISS` 또는 `STALE` 또는 부재 (cold gen).
3. 2회차: `x-nextjs-cache: HIT`.
4. ETag(또는 비슷한 동결 헤더)가 reproducible(같은 내용 → 같은 ETag).

### Expected
- 1회차: cold(가능 값: `MISS` / 부재 / `STALE`)
- 2회차: `x-nextjs-cache: HIT`

### How to verify (curl)
```bash
echo "--- 1st request ---"
curl -s -o /dev/null -D - http://localhost:4300/AAPL/congress | grep -iE 'x-nextjs-cache|etag|cache-control'
echo "--- waiting ---"
sleep 2
echo "--- 2nd request ---"
curl -s -o /dev/null -D - http://localhost:4300/AAPL/congress | grep -iE 'x-nextjs-cache|etag|cache-control'
#   → 2번째 응답에서 x-nextjs-cache: HIT
```

### How to verify (Chrome MCP)
- `mcp__claude-in-chrome__navigate(url='http://localhost:4300/AAPL/congress')`
- 한 번 더 navigate (또는 reload)
- `mcp__claude-in-chrome__read_network_requests()` → `/AAPL/congress` 두 번째 응답 header에 `x-nextjs-cache: HIT`

### Pass/Fail recording
- [ ] curl pass
- [ ] Chrome pass
- Notes: Vercel이 아닌 로컬 self-hosted Next start 환경에선 `x-nextjs-cache` 헤더가 노출됨. CDN 앞단 캐시(CF)는 별도.

---

## TC-17 — Cache key 2-key 분리 (senate/house)

**Surface**: Redis 키 스킴
**Scope**: 검증 스펙 §5 (2-key + MAX-fetch + read-time-slice)
**Pre-conditions**: port 4300, Redis 접근 가능 시 직접 확인. 없으면 단위 테스트로 대체.

### Steps
1. (Redis 가능 시) `redis-cli keys 'congress:*' | sort` 로 키 목록 조회.
2. AAPL 방문 후 `congress:senate:AAPL`, `congress:house:AAPL` 두 키 존재 확인.
3. `revalidateTag` 엔드포인트가 있으면 invalidate 시도 — 없으면 expectation 문서화.

### Expected
- (Redis 접근 시) `congress:senate:AAPL` + `congress:house:AAPL` 두 키 존재
- (Redis 없이) 단위 테스트 PASS

### How to verify (curl)
```bash
# 단위 테스트로 대체
yarn vitest run \
  src/shared/api/fmp/__tests__/CachedCongressTradesProvider.test.ts \
  src/entities/congress-trades/lib/__tests__/getCongressTrades.test.ts
#   → 모든 케이스 PASS, 특히 키 스킴 검증 케이스

# Redis 가능 시
redis-cli -u "$UPSTASH_REDIS_REST_URL" keys 'congress:*' | sort
#   → congress:house:AAPL
#     congress:senate:AAPL
```

### How to verify (Chrome MCP)
N/A — Redis 키는 브라우저로 관찰 불가. 페이지 응답 시간으로 cold vs warm을 간접 확인:
- `mcp__claude-in-chrome__javascript_tool(code="performance.now()")` 측정
- 동일 URL 재방문 시 응답 시간 단축 확인

### Pass/Fail recording
- [ ] curl pass
- [ ] Chrome pass
- Notes: Redis 직접 접근 없으면 unit test로 대체 — fail 처리 금지.

---

## TC-18 — Invalid ticker `/INVALID_NOPE_!@#/congress` → 404

**Surface**: `notFound()` boundary
**Scope**: 검증 스펙 §2 (noindex 분기), `VALID_TICKER_RE` 게이트
**Pre-conditions**: port 4300.

### Steps
1. URL 인코딩 주의: `!@#` 는 reserved chars → `%21%40%23` 로 인코딩.
2. `curl -w '%{http_code}\n' http://localhost:4300/INVALID_NOPE_%21%40%23/congress` → 404.

### Expected
- HTTP 404 (Next.js notFound 처리)
- `<meta name="robots" content="noindex` 포함 (또는 Next 기본 404가 noindex 처리)

### How to verify (curl)
```bash
curl -s -o /tmp/invalid.html -w 'HTTP=%{http_code}\n' \
  'http://localhost:4300/INVALID_NOPE_%21%40%23/congress'
#   → HTTP=404
# 더 간단한 invalid ticker
curl -s -o /dev/null -w 'HTTP=%{http_code}\n' http://localhost:4300/INVALID_NOPE_/congress
#   → HTTP=404 (underscore 자체가 VALID_TICKER_RE 실패라면)
```

### How to verify (Chrome MCP)
- `mcp__claude-in-chrome__navigate(url='http://localhost:4300/INVALID_NOPE_/congress')`
- `mcp__claude-in-chrome__find(query='404')` 또는 notFound page 콘텐츠 검색
- `mcp__claude-in-chrome__javascript_tool(code="document.title")` → Next 기본 404 타이틀 또는 커스텀

### Pass/Fail recording
- [ ] curl pass
- [ ] Chrome pass
- Notes: `VALID_TICKER_RE` 패턴 확인 — `src/shared/config/market.ts`. underscore 포함이 invalid가 아닐 수도 있어 보완 심볼(`!@#`)으로도 검증.

---

## TC-19 — `/ZZZZZZ/congress` (Unknown ticker) → 404

**Surface**: profile === null 경로
**Scope**: 검증 스펙 §0.6 심볼 선정, page.tsx line 132-134
**Pre-conditions**: port 4300, FMP_API_KEY 정상.

### Steps
1. `/ZZZZZZ/congress` 요청.
2. FMP가 profile 데이터를 반환하지 않음 → profile === null → `notFound()` → HTTP 404.

### Expected
- HTTP 404

### How to verify (curl)
```bash
curl -s -o /dev/null -w 'HTTP=%{http_code}\n' http://localhost:4300/ZZZZZZ/congress
#   → HTTP=404
# 추가: 무효 심볼 (FMP 200 + 빈)도 404
curl -s -o /dev/null -w 'HTTP=%{http_code}\n' http://localhost:4300/NONEXISTENT/congress
#   → HTTP=404
```

### How to verify (Chrome MCP)
- `mcp__claude-in-chrome__navigate(url='http://localhost:4300/ZZZZZZ/congress')`
- `mcp__claude-in-chrome__javascript_tool(code="document.title.toLowerCase()")` → 'not found' 또는 사용자 404 텍스트

### Pass/Fail recording
- [ ] curl pass
- [ ] Chrome pass
- Notes: 만약 200(degraded indexable)로 응답한다면 design intent와 다른 결과 — page.tsx의 profile null 분기를 reconciliation.

---

## TC-20 — 빠른 cross-tab 네비게이션 회귀(console / leak / cancel)

**Surface**: SPA 라우팅에서의 훅 cleanup
**Scope**: 검증 스펙 §6 (cancel on unmount + pagehide)
**Pre-conditions**: port 4300.

### Steps
1. `/AAPL/financials` 진입 → 3초 대기.
2. `/AAPL/congress` 이동 → 3초 대기.
3. `/AAPL/options` 이동 → 3초 대기.
4. 콘솔 에러/경고 0건.
5. `/api/jobs/cancel` 호출이 type:`congress` 페이로드로 발생했는지(이전 jobId가 있던 경우만) 확인.

### Expected
- 콘솔 에러 0, "leaked" / "unmounted" warning 0
- congress → 다른 탭 이동 시 (LLM 잡 진행 중이었다면) `/api/jobs/cancel` 호출에 `type: 'congress'` 포함

### How to verify (curl)
N/A — SPA 라우팅은 Chrome에서만 실증.

### How to verify (Chrome MCP)
- `mcp__claude-in-chrome__navigate(url='http://localhost:4300/AAPL/financials')`
- 3초 대기
- `mcp__claude-in-chrome__javascript_tool(code="document.querySelector('a[href=\"/AAPL/congress\"]').click()")`
- 3초 대기
- `mcp__claude-in-chrome__javascript_tool(code="document.querySelector('a[href=\"/AAPL/options\"]').click()")`
- 3초 대기
- `mcp__claude-in-chrome__read_console_messages()` → 에러/경고 0
- `mcp__claude-in-chrome__read_network_requests()` → 'api/jobs/cancel' POST 발견 시 body 내 `type` 값에 `congress` 포함되는지

### Pass/Fail recording
- [ ] curl pass
- [ ] Chrome pass
- Notes: AAPL이 warm cache여서 cached로 즉시 done이면 jobId가 없어 cancel POST 안 일어남 — 이는 정상.

---

## TC-21 — ChatPanel 컨텍스트 통합

**Surface**: 챗봇 사이드패널 (전역)
**Scope**: 검증 스펙 §10 (챗봇 컨텍스트), 설계 §7
**Pre-conditions**: port 4300, AAPL/congress 페이지에서 AI summary done 상태.

### Steps
1. 페이지 진입 → 5초 대기 (AI summary done까지).
2. 챗봇 패널 열기 (`FloatingChatButton`).
3. 입력 placeholder / 추천 질문에 congress 컨텍스트 반영 (e.g. "의회 거래에 대해..."류).
4. 다른 탭 이동 후 재진입 → context publish 재발생.

### Expected
- 챗봇 입력창 활성화 (`isAnalysisReady=true`)
- congress context publish 흔적: 채팅 패널 추천 질문 / placeholder가 congress-aware
- DOM에서 chat state에 `kind: 'congress'` 정보가 노출되는 경우 직접 확인

### How to verify (curl)
N/A.

### How to verify (Chrome MCP)
- `mcp__claude-in-chrome__navigate(url='http://localhost:4300/AAPL/congress')`
- 5초 대기
- `mcp__claude-in-chrome__javascript_tool(code="document.querySelector('[aria-label*=\"챗\"], [data-testid*=\"chat\"], button[aria-label*=\"chat\"]')?.click()")` → 챗봇 열기
- `mcp__claude-in-chrome__find(query='의회')` → 챗봇 영역에 congress 컨텍스트 단서
- `mcp__claude-in-chrome__javascript_tool(code="document.querySelector('textarea, input[type=text]')?.placeholder")` → placeholder 텍스트 확인

### Pass/Fail recording
- [ ] curl pass
- [ ] Chrome pass (deferred 가능)
- Notes: ChatPanel 마크업/selector는 구현 의존. 실제 chatState publish 여부는 `widgets/congress/utils/buildChatState.ts` 단위 테스트로 보조 검증 가능.

---

## 부록 A — Bootstrap (서버 기동)

### §1. port 4300 — prod build (Group A, D, F, G — real FMP)

```bash
cd /Users/y0ngha/Project/siglens/.claude/worktrees/feat+symbol-congress

# (사전) overlay 유지 — yarn install 금지
ls node_modules/@y0ngha/siglens-core/dist/index.d.ts || echo "❌ overlay 누락 — 진행 중단"

# (사전) E2E_TEST 환경변수 unset 확인
unset E2E_TEST
[ -z "$E2E_TEST" ] && echo "✓ E2E_TEST unset"

# (1) build
NODE_OPTIONS=--max-old-space-size=8192 yarn build > /tmp/build-4300.log 2>&1; echo "build exit=$?"
grep -E '/\[symbol\]/congress' /tmp/build-4300.log
#   → ●(SSG) 마커. ƒ(Dynamic)이면 ISR 깨짐.

# (2) start (background)
PORT=4300 yarn start > /tmp/start-4300.log 2>&1 &
echo "PID=$!" > /tmp/4300.pid

# (3) health check
until curl -s -o /dev/null -w '%{http_code}' http://localhost:4300/ | grep -q 200; do
  sleep 1
done
echo "✓ port 4300 ready"
```

### §2. port 4201 — E2E_TEST=1 build (Group B, E — Fake provider)

```bash
cd /Users/y0ngha/Project/siglens/.claude/worktrees/feat+symbol-congress

# (1) build with E2E_TEST=1
E2E_TEST=1 NODE_OPTIONS=--max-old-space-size=8192 yarn build > /tmp/build-4201.log 2>&1
echo "build-e2e exit=$?"

# (2) start
PORT=4201 E2E_TEST=1 yarn start > /tmp/start-4201.log 2>&1 &
echo "PID=$!" > /tmp/4201.pid

# (3) health
until curl -s -o /dev/null -w '%{http_code}' http://localhost:4201/ | grep -q 200; do
  sleep 1
done
echo "✓ port 4201 ready"
```

### §3. port 4300 재기동 — FMP_API_KEY 강제 손상 (TC-11)

```bash
cd /Users/y0ngha/Project/siglens/.claude/worktrees/feat+symbol-congress

# (1) backup
cp .env.local /tmp/env-local-tc11-backup
echo "✓ .env.local backed up to /tmp/env-local-tc11-backup"

# (2) FMP_API_KEY 손상
# .env.local 의 FMP_API_KEY= 줄을 다음 값으로 교체 (사용자가 직접 편집 또는 sed)
# FMP_API_KEY=INVALID_KEY_TC11
# (sed 예시 — 환경에 맞게 조정)
# sed -i.bak -E 's/^FMP_API_KEY=.*/FMP_API_KEY=INVALID_KEY_TC11/' .env.local

# (3) 기존 4300 종료
kill "$(cat /tmp/4300.pid)" 2>/dev/null
wait 2>/dev/null

# (4) re-build + start (Redis 캐시 비우기 권장 — 가능 시 별도 심볼 사용)
NODE_OPTIONS=--max-old-space-size=8192 yarn build > /tmp/build-4300-degraded.log 2>&1
PORT=4300 yarn start > /tmp/start-4300-degraded.log 2>&1 &
echo "PID=$!" > /tmp/4300.pid
until curl -s -o /dev/null -w '%{http_code}' http://localhost:4300/ | grep -q 200; do sleep 1; done
echo "✓ port 4300 (degraded mode) ready"
```

> ⚠️ Redis Cached provider가 이전 정상 데이터를 캐시 중이면 invalid key 효과가 안 보일 수 있다.
> 별도 심볼(예: `MSFT` 또는 `NVDA`) 또는 prod build 시 Redis 캐시 강제 비우기(별도 절차) 필요.

---

## 부록 B — Teardown

```bash
# 4300 / 4201 서버 종료
for pidfile in /tmp/4300.pid /tmp/4201.pid; do
  if [ -f "$pidfile" ]; then
    pid=$(cat "$pidfile")
    kill "$pid" 2>/dev/null && echo "✓ killed $pid (from $pidfile)"
    rm -f "$pidfile"
  fi
done

# .env.local 복원 검증 (TC-11/TC-12 이후 필수)
if [ -f /tmp/env-local-tc11-backup ]; then
  diff /tmp/env-local-tc11-backup .env.local
  #   → no diff 가 정상
  echo "⚠️  diff가 비어있지 않으면 .env.local 수동 복원 필요"
fi

# 빌드/시작 로그 정리 (보존하려면 별도 위치로 이동)
ls -la /tmp/build-*.log /tmp/start-*.log 2>/dev/null
```

⚠️ 마지막에 반드시 형제 워크트리(master)의 `.env.local` 키셋과 diff하여 누락된 키가 없는지 확인 — 메모리 `env_local_restore_after_qa_swap`.

---

## 부록 C — Reconciliation notes (사전 식별된 불일치 후보)

이 시트 작성 중 검증 스펙과 구현 사이에서 발견한 잠재적 불일치(후속 검증 시 우선 확인):

1. **검증 스펙 §4 (d)** — 봇 차단 카피로 `"봇 트래픽으로 보여 분석 결과를 표시하지 않았어요."` 명시.
   `BotBlockedNotice.tsx:25`도 동일 — 일치 ✓.

2. **검증 스펙 §3 (c)** — EMPTYX의 "AI 동향 해석" 부재 카피.
   `CongressTrendSummaryEmpty.tsx:22`: `최근 의회 거래가 없어 동향 해석을 생성하지 않았어요.` — 검증 스펙 본문은 같은 의미를 인용했으므로 일치.
   단, 픽스처 `e2eCachedCongressTrend()`가 우선 매치되는 코드 경로(EMPTYX가 e2e stub 직진)면 픽스처 `summaryKo` (`최근 의회 거래는 매수 우세예요.`)가 보일 수 있음 — `submitCongressTrendAction` 의 E2E 분기 코드에선 모든 심볼이 `e2eCachedCongressTrend()`로 통일 처리됨(symbol 무관). 결과적으로 EMPTYX의 AI 카드는 **`no_trades` 상태가 아니라 `cached`(픽스처) 상태**가 나올 가능성 큼.
   → **TC-09는 이를 실증으로 확인하고, 픽스처 텍스트가 보이면 코드 경로를 검증 후 reconciliation 메모로 기록**.

3. **검증 스펙 §2 (c) C5 (tradesDegraded)** — vitest로 대체 검증. 실제 prod 빌드에서 자연 재현이 어렵다고 명시. TC-11에서 `FMP_API_KEY` 손상으로 우회 실증을 시도하나, Redis 캐시 잔존 시 효과가 안 나타날 수 있음 — 검증 시 새 심볼 또는 cache invalidation 병행.

4. **검증 스펙 §10 (챗봇 컨텍스트)** — Chrome MCP DOM 검증은 ChatPanel 마크업/selector에 의존. 정확한 selector가 명시되지 않아 TC-21은 "deferred 가능" 마킹.

5. **검증 스펙 §0.6 (ZZZZZZ → notFound)** — 페이지의 `profile === null` 분기에 도달하려면 FMP가 200 + 빈 profile을 반환해야 함. FMP가 다른 응답을 줄 가능성이 있음 — TC-19에서 실측 후 결과에 맞춰 기록.

6. **Sitemap inclusion (TC-10)** — 검증 스펙에 명시적 entry는 없음. 본 시트는 documented-finding 모드로 처리.

7. **CrossLinkCards 카드 수** — 검증 스펙 §8은 8 카드 명시. 구현(`CrossLinkCards.tsx:4-13`)도 8개 (`chart, news, fundamental, financials, options, fear-greed, congress, overall`) — 일치 ✓. 단, congress의 ALL_PAGES 배열 내 위치는 **position 6** (0-indexed) — symbolTabsConfig의 탭 순서와 다른 정렬 — 의도된 설계.

8. **InfoTooltip aria-label** (TC-06) — `shared/ui/InfoTooltip` 구현이 정확한 aria 속성을 어떻게 노출하는지 미확인. 정적 selector가 안 맞으면 reconciliation.
