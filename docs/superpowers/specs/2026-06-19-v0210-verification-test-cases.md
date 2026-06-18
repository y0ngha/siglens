# v0.21.0 → 현재(HEAD) 검수 — Test Case 시트

> 작성일: 2026-06-19 · 브랜치: `feat/v0210-nav-routing-seo-audit`
> source-of-truth(변경 범위): `docs/superpowers/specs/2026-06-19-v0210-to-current-verification-spec.md`
> 본 문서는 **별도의 실증 에이전트**(curl + Chrome 자동화)가 본 시트만 보고 PASS/FAIL을 기록할 수 있도록 작성한 자기완결형 Test Case 시트다.

---

## 0. 실증 환경 / 변수

| 변수 | 설명 |
|---|---|
| `BASE` | prod 서버 base URL. 예: `http://localhost:4300` (`next build && next start`). 이하 모든 curl/navigate는 `${BASE}` 기준. |
| 빌드 | `yarn build > /tmp/build-v0210.log 2>&1; echo "exit=$?"` — exit=0 + ISR 라우트가 `●`(SSG)로 표시되어야 함(`ƒ`=Dynamic이면 ISR 깨짐). 파이프 없이 exit code 직접 캡처. |
| 기동 확인 | `until curl -s -o /dev/null -w '%{http_code}' "${BASE}/" | grep -q 200; do sleep 1; done` |
| E2E_TEST | prod 실데이터 검수에서는 **반드시 unset**. Fake provider degrade-주입 검증(noindex 경로)만 별도 포트 + `E2E_TEST=1`로 기동. |

### Chrome MCP 도구 로드 (Chrome 테스트 전 1회)
```
ToolSearch(query="select:mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__get_page_text,mcp__claude-in-chrome__find,mcp__claude-in-chrome__read_console_messages,mcp__claude-in-chrome__read_network_requests,mcp__claude-in-chrome__resize_window,mcp__claude-in-chrome__javascript_tool")
```

### 신규 라우트 5종 (검수 대상)
| # | 라우트 | 예시 URL | ISR revalidate |
|---|---|---|---|
| R1 | `/news` (허브 인덱스) | `${BASE}/news` | 86400 (24h) |
| R2 | `/news/[category]` | `${BASE}/news/general` 등 5종 | 43200 (12h) |
| R3 | `/economy` | `${BASE}/economy` | 86400 (24h) |
| R4 | `/[symbol]/congress` | `${BASE}/AAPL/congress` | 86400 (24h) |
| R5 | `/[symbol]/financials` | `${BASE}/AAPL/financials` | 86400 (24h) |

### 정답 문자열 레퍼런스 (코드에서 추출 — 실측 비교용)
| 라우트 | `<title>` (브랜드 `| Siglens`는 root layout template이 append) | canonical |
|---|---|---|
| `/news` | `미국 마켓 뉴스 허브 — 카테고리별 최신 흐름 | Siglens` | `https://siglens.io/news` |
| `/news/general` | `미국 일반 시장 뉴스 — 최신 마켓 흐름과 AI 다이제스트 | Siglens` | `https://siglens.io/news/general` |
| `/news/stock` | `미국 주식 뉴스 — 최신 마켓 흐름과 AI 다이제스트 | Siglens` | `https://siglens.io/news/stock` |
| `/news/crypto` | `미국 암호화폐 뉴스 — 최신 마켓 흐름과 AI 다이제스트 | Siglens` | `https://siglens.io/news/crypto` |
| `/news/forex` | `미국 외환 뉴스 — 최신 마켓 흐름과 AI 다이제스트 | Siglens` | `https://siglens.io/news/forex` |
| `/news/articles` | `미국 마켓 아티클 뉴스 — 최신 마켓 흐름과 AI 다이제스트 | Siglens` | `https://siglens.io/news/articles` |
| `/economy` | `미국 경제 — 지표·캘린더 한눈에 | Siglens` | `https://siglens.io/economy` |
| `/AAPL/congress` | `AAPL 의회 거래 — 상원·하원 의원 매매 공시 | Siglens` | `https://siglens.io/AAPL/congress` |
| `/AAPL/financials` | `AAPL 재무제표 — 매출·이익·현금흐름 5년 추이 | Siglens` | `https://siglens.io/AAPL/financials` |

> ⚠️ `SITE_URL`은 `NEXT_PUBLIC_SITE_URL` env로 override 가능. env가 비면 기본값 `https://siglens.io`. 실증 환경의 env에 맞춰 canonical 도메인을 비교할 것(로컬이라도 canonical은 보통 `https://siglens.io`로 박힌다).
> ⚠️ 메타 description은 `clampSeoDescription` = **120 code-point 상한**(160 아님). description 길이 검증은 `≤ 120`을 기준으로 한다.

---

## A. 헤더 네비게이션 (요구사항 #1)

> 단일 source: `src/widgets/layout/headerNavItems.ts` `NAV_ITEMS` = `[{/market, 시장 분석}, {/news, 마켓 뉴스}, {/economy, 미국 경제}]`. 데스크탑(`HeaderNav` active=`usePathname`, PPR fallback `HeaderNavStatic`)·모바일(`HeaderMobileMenu`)이 모두 이 배열을 소비.

| ID | Category | Precondition | Steps | Expected Result | Method |
|---|---|---|---|---|---|
| A-01 | Desktop nav 존재 | 데스크탑 viewport (≥1024px) | `navigate(${BASE}/market)` → `get_page_text()` / DOM에서 `<header>` 내부 `<nav aria-label="주요 네비게이션">` 확인 | nav 안에 정확히 3개 링크: `시장 분석`(href=`/market`), `마켓 뉴스`(href=`/news`), `미국 경제`(href=`/economy`). 순서 좌→우 동일. | CHROME |
| A-02 | Desktop nav SSR 노출 | — | `curl -s "${BASE}/market"` → 본문에서 `href="/economy"` + 텍스트 `미국 경제` grep | `미국 경제` 링크가 SSR HTML에 존재(`grep -c 'href="/economy"'` ≥ 1). PPR fallback(`HeaderNavStatic`)도 동일 3링크를 SSR에 박으므로 JS 없이도 발견 가능. | CURL |
| A-03 | /market active | 데스크탑 | `navigate(${BASE}/market)` → `시장 분석` 링크의 `aria-current` 검사 | `시장 분석` 링크만 `aria-current="page"`; `마켓 뉴스`/`미국 경제`는 `aria-current` 없음. | CHROME |
| A-04 | /news active | 데스크탑 | `navigate(${BASE}/news)` | `마켓 뉴스` 링크가 `aria-current="page"`. (active 판정 = `pathname===href || startsWith(href+'/')`) | CHROME |
| A-05 | /economy active | 데스크탑 | `navigate(${BASE}/economy)` | `미국 경제` 링크가 `aria-current="page"`; 나머지 둘은 없음. | CHROME |
| A-06 | /news/[cat] 하위 active | 데스크탑 | `navigate(${BASE}/news/stock)` | `마켓 뉴스`가 `aria-current="page"`(startsWith `/news/` 매칭). | CHROME |
| A-07 | /economy 도달성 | — | `curl -s -o /dev/null -w '%{http_code}' "${BASE}/economy"` | HTTP 200. (단, degrade 시에도 200 — D 섹션 참조) | CURL |
| A-08 | 모바일 햄버거 존재 | 375px viewport | `resize_window(375, 812)` → `navigate(${BASE}/)` → `find('메뉴 열기')` | 햄버거 버튼 존재: `<button aria-label="메뉴 열기" aria-expanded="false" aria-controls="mobile-nav-drawer">`, 데스크탑 nav(`md:flex`)는 숨김. | CHROME |
| A-09 | 모바일 드로어 3항목 | 375px, 위 상태 | 햄버거 클릭 → 드로어(`#mobile-nav-drawer`) 검사 | 드로어 안에 3개 링크: `시장 분석`/`마켓 뉴스`/`미국 경제`. **`/economy`(미국 경제) 반드시 포함**. 버튼 `aria-expanded="true"`, 드로어 `aria-modal="true"` `aria-hidden` 제거됨. | CHROME |
| A-10 | 모바일 드로어 active | 375px | `navigate(${BASE}/economy)` → 햄버거 오픈 | `미국 경제` 링크 `aria-current="page"`. | CHROME |
| A-11 | Escape 닫힘 | 375px, 드로어 open | 키보드 `Escape` 전송 | 드로어 닫힘(`translate-x-full`), 버튼 `aria-expanded="false"`, 포커스가 햄버거 트리거로 복귀. | CHROME |
| A-12 | Backdrop 닫힘 | 375px, 드로어 open | `[data-testid="mobile-nav-backdrop"]` 클릭 | 드로어 닫힘. | CHROME |
| A-13 | Focus trap | 375px, 드로어 open | Tab 반복 전송 | 포커스가 드로어(닫기 버튼 + 3 링크) 내부에서만 순환, 드로어 밖 요소로 새지 않음(`useFocusTrap`). | CHROME |
| A-14 | Body scroll lock | 375px, 드로어 open | `javascript_tool`: `getComputedStyle(document.body).overflow` | `"hidden"`. 드로어 닫으면 이전 값으로 복원. | CHROME |
| A-15 | 링크 이동 후 닫힘 | 375px, 드로어 open | 드로어의 `미국 경제` 링크 클릭 | `/economy`로 이동 + 드로어 닫힘(`onClick=close`). | CHROME |
| A-16 | nav 탭 타깃 ≥44px | 데스크탑 & 375px | nav 링크의 렌더 높이 측정(`getBoundingClientRect().height`) | 각 nav 링크/햄버거 ≥ 44px(`min-h-11`=44px). | CHROME |

---

## B. 뉴스 카테고리 네비게이션 (요구사항 #2)

> `src/widgets/news-hub/NewsCategoryTabs.tsx`: 5탭 URL 기반 nav(`<nav aria-label="뉴스 카테고리">`, `overflow-x-auto`). 탭 라벨(TAB_LABELS): general=`일반`, stock=`주식`, crypto=`암호화폐`, forex=`외환`, articles=`아티클`. 각 href=`/news/<category>`. degrade(빈 데이터) 경로에서도 항상 렌더(dead-end 방지).

| ID | Category | Precondition | Steps | Expected Result | Method |
|---|---|---|---|---|---|
| B-01 | 탭바 렌더(general) | — | `curl -s "${BASE}/news/general"` → `aria-label="뉴스 카테고리"` nav grep | nav 존재 + 5개 링크(`일반`/`주식`/`암호화폐`/`외환`/`아티클`), 각 href `/news/general`·`/news/stock`·`/news/crypto`·`/news/forex`·`/news/articles`. | CURL |
| B-02 | active=general | — | `${BASE}/news/general` HTML에서 active 탭 검사 | `일반` 탭(`href="/news/general"`)만 `aria-current="page"`; 나머지 4개 없음. | CURL |
| B-03 | active=stock | — | `curl -s "${BASE}/news/stock"` | `주식` 탭이 `aria-current="page"`. | CURL |
| B-04 | active=crypto | — | `curl -s "${BASE}/news/crypto"` | `암호화폐` 탭 `aria-current="page"`. | CURL |
| B-05 | active=forex | — | `curl -s "${BASE}/news/forex"` | `외환` 탭 `aria-current="page"`. | CURL |
| B-06 | active=articles | — | `curl -s "${BASE}/news/articles"` | `아티클` 탭 `aria-current="page"`. | CURL |
| B-07 | 허브 미경유 카테고리 이동 | — | `navigate(${BASE}/news/general)` → `주식` 탭 클릭 | `/news/stock`으로 직접 이동(중간에 `/news` 허브 미경유). URL = `${BASE}/news/stock`, `주식` 탭 active 전환. | CHROME |
| B-08 | degrade 경로에서도 탭 존재 | 빈 데이터 카테고리(아래 §C noindex 또는 `E2E_TEST=1` Fake degrade) | degrade된 카테고리 페이지 로드 | 본문이 degrade 카드("…불러오지 못했어요")여도 상단에 5탭 nav 존재(dead-end 아님). | CURL / CHROME |
| B-09 | 375px 가로 스크롤 | 375px | `resize_window(375,812)` → `navigate(${BASE}/news/general)` → tab nav 컨테이너의 `scrollWidth`/`clientWidth` 측정 | tab nav가 `overflow-x-auto`로 가로 스크롤(`scrollWidth > clientWidth` 허용). **단 body는 가로 스크롤 없음**(§F 참조). 탭 라벨 줄바꿈/잘림 없음(`whitespace-nowrap`). | CHROME |
| B-10 | 탭 탭타깃 ≥44px | 375px | 각 탭 링크 높이 측정 | ≥44px(`min-h-11`). | CHROME |
| B-11 | 탭 키보드 포커스 | — | 탭에 Tab 포커스 | `focus-visible:ring` 표시, Enter로 이동 동작. | CHROME |

---

## C. SEO (요구사항 #3)

> 공통 검증 헬퍼:
> ```bash
> u="${BASE}/news/general"; curl -s "$u" > /tmp/p.html
> grep -oE '<title>[^<]+</title>' /tmp/p.html
> grep -oE '<meta name="description" content="[^"]*"' /tmp/p.html
> grep -oE '<link rel="canonical" href="[^"]*"' /tmp/p.html
> grep -oE '<meta name="robots" content="[^"]*"' /tmp/p.html
> grep -oE 'property="og:[^"]+" content="[^"]*"' /tmp/p.html
> grep -oE 'name="twitter:[^"]+" content="[^"]*"' /tmp/p.html
> grep -c '<script type="application/ld+json">' /tmp/p.html
> grep -oE '<h1[^>]*>[^<]*</h1>' /tmp/p.html | wc -l   # 정확히 1
> ```

### C.1 Healthy 페이지 — 메타/canonical/OG/Twitter/h1

| ID | Category | Precondition | Steps | Expected Result | Method |
|---|---|---|---|---|---|
| C-01 | /news 200 + 메타 | 데이터 정상 | 위 헬퍼를 `${BASE}/news`에 적용 | HTTP 200; `<title>`=`미국 마켓 뉴스 허브 — 카테고리별 최신 흐름 | Siglens`; description 존재 & 길이 ≤120; canonical `https://siglens.io/news`; robots noindex **없음**; `<h1>마켓 뉴스 허브</h1>` 정확히 1개. | CURL |
| C-02 | /news OG/Twitter | — | OG/Twitter grep | `og:type=website`, `og:site_name=Siglens`, `og:title`, `og:description`, `og:url=https://siglens.io/news`, `og:locale=ko_KR`; `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`. | CURL |
| C-03 | /news JSON-LD | — | `ld+json` 블록 파싱 | 2개 블록: `@type=WebPage`(@id `…/news#webpage`) + `@type=BreadcrumbList`(itemListElement: `마켓 뉴스 허브`). 각 블록이 `JSON.parse` valid. | CURL |
| C-04 | /news/[cat] 메타 (5종) | 각 카테고리 데이터 정상 | 5개 슬러그 각각 헬퍼 적용 | §0 레퍼런스 표의 title/canonical과 정확히 일치; description ≤120; robots noindex 없음; `<h1>{koLabel} 뉴스</h1>` 1개(예: `미국 일반 시장 뉴스`). | CURL |
| C-05 | /news/[cat] OG/Twitter | healthy | OG/Twitter grep (general) | `og:url=https://siglens.io/news/general`, `og:locale=ko_KR`, `og:site_name=Siglens`; twitter 3종. | CURL |
| C-06 | /news/[cat] JSON-LD | healthy + 기사 ≥1 | `ld+json` 파싱 (general) | 3개 블록: `WebPage` + `BreadcrumbList`(`마켓 뉴스 허브` → koLabel) + `ItemList`(itemListElement ≤10, 각 item `@type=Article` headline/url/datePublished/author/publisher 보유). 모두 valid JSON. | CURL |
| C-07 | /economy 200 + 메타 | 스냅샷 정상 | 헬퍼를 `${BASE}/economy` 적용 | `<title>`=`미국 경제 — 지표·캘린더 한눈에 | Siglens`; description ≤120; canonical `https://siglens.io/economy`; robots noindex 없음; `<h1>미국 경제 — 지표·캘린더 한눈에</h1>` 1개. | CURL |
| C-08 | /economy OG + 이미지 | — | OG grep + `curl -I ${BASE}/og-image.png` | `og:url=https://siglens.io/economy`, `og:image` = `/og-image.png`(1200×630), twitter image 동일. | CURL |
| C-09 | /economy JSON-LD 4종 | healthy | `ld+json` 파싱 | 4개 블록: `WebPage` + `BreadcrumbList`(`미국 경제`) + `Dataset` + `FAQPage`(mainEntity 4 Q&A). 모두 valid JSON. | CURL |
| C-10 | /[symbol]/congress 메타 | AAPL profile 존재 | 헬퍼를 `${BASE}/AAPL/congress` 적용 | `<title>`=`AAPL 의회 거래 — 상원·하원 의원 매매 공시 | Siglens`; canonical `https://siglens.io/AAPL/congress`; robots noindex 없음(happy); `<h1>` 1개(displayName + ` 의회 거래`, 느슨 매치 `의회 거래`). | CURL |
| C-11 | congress JSON-LD | healthy | `ld+json` 파싱 | `WebPage` + `BreadcrumbList`(`AAPL` → `의회 거래`) + `FAQPage`(3 Q&A). valid JSON. | CURL |
| C-12 | congress OG 이미지 | — | `curl -I "${BASE}/AAPL/congress/opengraph-image"` 및 `…/twitter-image` | 둘 다 200 + `content-type: image/png`. | CURL |
| C-13 | /[symbol]/financials 메타 | AAPL 재무 정상 | 헬퍼를 `${BASE}/AAPL/financials` 적용 | `<title>`=`AAPL 재무제표 — 매출·이익·현금흐름 5년 추이 | Siglens`; canonical `https://siglens.io/AAPL/financials`; robots noindex 없음; `<h1>`(displayName + ` 재무제표`) 1개. | CURL |
| C-14 | financials JSON-LD | healthy | `ld+json` 파싱 | `WebPage` + `BreadcrumbList`(`AAPL` → `재무제표`) + `FAQPage`(3 Q&A). valid JSON. | CURL |
| C-15 | financials OG 이미지 | — | `curl -I "${BASE}/AAPL/financials/opengraph-image"` 및 twitter | 200 + image/png(존재 시). 없으면 layout OG 상속 확인. | CURL |
| C-16 | h1 유일성 (전 라우트) | — | 각 신규 라우트에서 `grep -c '<h1'` | 모든 신규 라우트가 `<h1>` **정확히 1개**. | CURL |
| C-17 | description ≤120 (전 라우트) | — | 각 라우트 description code-point 길이 측정 | 모든 description ≤ 120 code-point(`clampSeoDescription` 상한). | CURL |

### C.2 noindex 일관성 (degrade / 빈 데이터)

| ID | Category | Precondition | Steps | Expected Result | Method |
|---|---|---|---|---|---|
| C-20 | 잘못된 news slug | — | `curl -s -o /dev/null -w '%{http_code}' "${BASE}/news/bogus"` + 본문 robots grep | `categoryFromSlug('bogus')===null` → 본문 `notFound()` → **HTTP 404**. generateMetadata는 `robots: index:false, follow:false` + canonical null 반환(404 셸이라 메타 미렌더일 수 있음 — 404 코드가 1차 판정). | CURL |
| C-21 | 빈 데이터 news 카테고리 noindex | `E2E_TEST=1` Fake degrade 또는 실제 빈 카테고리(별도 포트 기동) | degrade 카테고리 페이지 robots grep | `<meta name="robots" content="noindex...">` (index:false,follow:false), canonical 미설정(null). 본문 = "…최근 뉴스를 불러오지 못했어요" degrade 카드. JSON-LD(WebPage/Breadcrumb/ItemList) **미렌더**(noindex 페이지엔 schema 생략). | CURL |
| C-22 | /economy degrade noindex | 빈 스냅샷(`E2E_TEST=1` Fake 또는 Redis 비움) | degrade `/economy` robots grep | `robots content="noindex"`(index:false, **follow:true**), canonical null. 본문 = `EconomyDegraded`. h1(`미국 경제 — 지표·캘린더 한눈에`)은 여전히 1개(Suspense 위에 렌더). | CURL |
| C-23 | congress FMP infra 장애 noindex | 데이터 레이어 degrade(prod 자연 재현 난해 → 단위테스트 보강) | `${BASE}/INVALID_NOPE_/congress` 404 + 단위테스트 | invalid ticker → 404; profile null(`ZZZZZZ`) → 404; FMP infra throw 시 `getCongressTradesResilient`가 `degraded:true` → noindex(아래 단위테스트로 검증). | CURL + 단위 |
| C-24 | congress 0건은 indexable | `E2E_TEST=1` `EMPTYX`(Fake 빈 배열) 별도 포트 | `EMPTYX/congress` 로드 | **200 + noindex 없음**(0건=정상=색인 허용, financials와 의도적 비대칭). 본문 "거래 내역 없음"; degrade 카피("일시적으로 불러올 수 없어요") 미출현. | CURL |
| C-25 | financials all-empty noindex | profile 정상 + 6종 재무 전부 비움(FMP 장애 / `E2E_TEST=1`) | degrade `/SYM/financials` robots grep | `isEmptyFinancialsSnapshot` true → 본문 `FinancialsDegraded` + 메타 `NOINDEX_SYMBOL_METADATA`(noindex). congress와 달리 financials는 0건=장애=noindex. | CURL + 단위 |
| C-26 | 잘못된 ticker financials | — | `curl -w '%{http_code}' "${BASE}/INVALID_NOPE_/financials"` + `${BASE}/ZZZZZZ/financials` | 둘 다 404(invalid 정규식 / profile null). | CURL |
| C-27 | noindex 분기 단위테스트 | 워크트리 빌드 환경 | `yarn vitest run` (congress·financials page.metadata 및 resilient 테스트) | congress "0건=indexable" + "infra throw=noindex", financials "all-empty=noindex" 분기 모두 PASS. | (vitest) |

### C.3 sitemap / robots

| ID | Category | Precondition | Steps | Expected Result | Method |
|---|---|---|---|---|---|
| C-30 | sitemap-static 신규 라우트 | — | `curl -s "${BASE}/sitemap-static.xml"` | `<loc>`에 `…/economy`, `…/news`, `…/news/general`, `…/news/stock`, `…/news/crypto`, `…/news/forex`, `…/news/articles` 7개 URL 모두 포함. (`buildStaticEntries`) | CURL |
| C-31 | sitemap index 유효 | — | `curl -s "${BASE}/sitemap.xml"` | `<sitemapindex>` XML, sub-sitemap `sitemap-static.xml`/`sitemap-popular.xml`/`sitemap-longtail-*.xml` 가리킴, valid XML. (`congress`/`financials`는 long-tail 종목별 메인 라우트 정책상 별도 추가 안 함 — 정책 확인용 참고) | CURL |
| C-32 | robots.txt sane | — | `curl -s "${BASE}/robots.txt"` | `User-agent: *` `Allow: /` `Disallow: /api/`; `Sitemap: https://siglens.io/sitemap.xml`; 검색봇(Googlebot/Yeti/Bingbot/Daumoa)은 Disallow `/` **미포함**; 기생봇/AI학습봇 그룹은 Disallow `/`. | CURL |
| C-33 | sitemap XML 파싱 | — | static·index를 xmllint/파서로 검증 | 5종 신규 라우트가 모두 well-formed `<url><loc>…</loc></url>`. | CURL |

---

## D. 페이지 렌더링 & 런타임 안정성 (요구사항 #4, #5)

> 알려진 실패 모드: ISR cold-gen에서 dynamic API(`cookies`/`headers`/`connection()`) 사용 시 `DYNAMIC_SERVER_USAGE` → 500. 신규 라우트는 `staticSymbolCache`/`getEconomySnapshotStatic` 등 정적화 캐시를 써 이를 회피해야 함.

| ID | Category | Precondition | Steps | Expected Result | Method |
|---|---|---|---|---|---|
| D-01 | 5종 라우트 200 | cold start 직후 | `for u in /news /news/general /news/stock /news/crypto /news/forex /news/articles /economy /AAPL/congress /AAPL/financials; do echo "$u $(curl -s -o /dev/null -w '%{http_code}' ${BASE}$u)"; done` | 모두 200(404/500 없음). degrade도 200. | CURL |
| D-02 | cold-gen 500 없음 | 서버 로그 tail | 위 라우트 첫 요청 후 빌드/런타임 로그 검사 | 로그에 `DYNAMIC_SERVER_USAGE` / `Route … couldn't be rendered statically` / 500 stack **0건**. | CURL + 로그 |
| D-03 | 콘솔 에러 0 (5종) | — | 각 라우트 `navigate` 후 `read_console_messages` | error/uncaught 0건. (degrade 경로의 의도적 `console.error`는 서버 로그이며 브라우저 콘솔 아님 — 브라우저 콘솔만 0 기준) | CHROME |
| D-04 | `x-nextjs-cache` HIT (ISR) | `[symbol]` 라우트 | `curl -D - "${BASE}/AAPL/congress"` 2회(2초 간격), `${BASE}/AAPL/financials` 동일 | 2회차 `x-nextjs-cache: HIT`(1회차 MISS/STALE 허용). ISR 정상 캐싱. | CURL |
| D-05 | `x-nextjs-cache` (news/economy) | top-level ISR | `curl -D - "${BASE}/news/general"`, `${BASE}/economy` 2회 | 2회차 캐시 HIT 또는 정적 prerender(빌드 SSG) 표시. dynamic 강제 흔적 없음. | CURL |
| D-06 | 빌드 SSG 마커 | 빌드 로그 | `grep -E '/news|/economy|/\[symbol\]/congress|/\[symbol\]/financials' /tmp/build-v0210.log` | 각 라우트가 `●`(SSG) 또는 `○`(Static)로 표시. `ƒ`(Dynamic)이면 FAIL(ISR 깨짐). | (빌드) |
| D-07 | degrade = crash 아님 | degrade 주입 | degrade 라우트 로드(C-21/22/24/25) | 친화 메시지 카드 렌더, 500/빈 화면/React error boundary 없음. h1 유지. | CHROME |
| D-08 | congress AI 잡 폴링 | AAPL warm | `navigate(${BASE}/AAPL/congress)` → `read_network_requests` | `submitCongressTrendAction` 호출, (cached 아니면) `pollCongressTrendAction` 폴링, AI 동향 카드 렌더 또는 봇 차단/0건 분기. 무한 폴링/에러루프 없음. | CHROME |
| D-09 | financials AI 잡 폴링 | AAPL warm | `navigate(${BASE}/AAPL/financials)` → `read_network_requests` | `FinancialsAiSummary` submit→poll 정상, 콘솔 에러 0. | CHROME |
| D-10 | economy 브리핑 폴링 | `/economy` healthy | `navigate(${BASE}/economy)` → network | `MacroBriefing` peek seed 또는 submit→poll, 렌더 정상. | CHROME |

---

## E. 홈 화면 라우팅 (요구사항 #6)

> 사실 기록(spec §1.1): 홈 가시적 링크 = `/market`("오늘 주목할 종목 →"), `/backtesting`("백테스팅 결과 보기 →") 2개뿐. `/news`·`/economy`로의 가시적 홈 CTA 없음(헤더 nav·푸터로만 발견). FAQ JSON-LD 본문엔 `/TSLA/news` 등 텍스트 언급 있으나 클릭 링크 아님.

| ID | Category | Precondition | Steps | Expected Result | Method |
|---|---|---|---|---|---|
| E-01 | 홈 가시 CTA 인벤토리 | — | `curl -s "${BASE}/" `에서 `<main>` 내부 `<a href>`/`<Link>` 수집 | 가시 본문 CTA: `/market`, `/backtesting`, `#search`(skip link), 티커 검색 패널. `/news`·`/economy` 직접 CTA **부재**(현황 기록 — FAIL 아님, 발견성 평가 입력값). | CURL |
| E-02 | /news·/economy 홈 본문 부재 확인 | — | 홈 `<main>` HTML에서 `href="/news"`(헤더 제외)·`href="/economy"`(헤더 제외) grep | 헤더 nav 외 본문에는 `/news`·`/economy` 링크 없음(현황). | CURL |
| E-03 | 발견성 적절성 판정 | E-01/02 결과 | 전역 발견 경로(헤더 nav 3링크 + 모바일 드로어 + 푸터 + sitemap) 종합 | **판정 기록**: 헤더 nav가 전 페이지 전역 발견을 보장하므로 최소 요건 충족. 홈 본문 CTA 추가 여부는 감사 결과/사용자 결정에 위임(권고 가능, blocker 아님). | (분석) |
| E-04 | 푸터 신규 링크 | 푸터 존재 시 | 홈/임의 페이지 `<footer>` 링크 수집 | 푸터에 `/news`·`/economy` 포함 여부 기록(있으면 발견성 보강, 없으면 헤더 단독 의존). | CURL |

---

## F. 모바일 375px 오버플로우 스윕

> 측정 헬퍼(`javascript_tool`): `({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth})`. 합격 = `sw ≤ cw + 1`(서브픽셀 1px 허용).

| ID | Category | Precondition | Steps | Expected Result | Method |
|---|---|---|---|---|---|
| F-01 | /news 오버플로우 | 375px | `resize_window(375,812)` → `navigate(${BASE}/news)` → 측정 헬퍼 | `scrollWidth ≤ clientWidth + 1`. 헤더/카드 그리드 잘림 없음. 가로 스크롤바 없음. | CHROME |
| F-02 | /news/[cat] 오버플로우 | 375px | 5개 카테고리 각각(`general`/`stock`/`crypto`/`forex`/`articles`) navigate → 측정 | 각 페이지 `sw ≤ cw+1`. **탭바 자체는 내부 가로 스크롤 허용**이나 그것이 body 가로 스크롤을 유발하면 안 됨(`overflow-x-auto`가 컨테이너에 한정). | CHROME |
| F-03 | /economy 오버플로우 | 375px | `navigate(${BASE}/economy)` → 측정 | `sw ≤ cw+1`. 지표 그리드/캘린더 테이블이 컨테이너 내 스크롤로 처리(body 넘침 X). | CHROME |
| F-04 | /[symbol]/congress 오버플로우 | 375px | `navigate(${BASE}/AAPL/congress)` → 측정 | `sw ≤ cw+1`. 거래 표(10컬럼)가 컨테이너 가로 스크롤로 수용, body 넘침 X. | CHROME |
| F-05 | /[symbol]/financials 오버플로우 | 375px | `navigate(${BASE}/AAPL/financials)` → 측정 | `sw ≤ cw+1`. 재무제표 표/차트 컨테이너 내 수용. | CHROME |
| F-06 | 헤더 클리핑 없음 | 375px, 각 라우트 | 헤더 sticky bar 시각 검사(screenshot) | 로고/검색/햄버거가 한 줄에 클리핑 없이 배치(`h-14`). 텍스트 잘림 없음. | CHROME |
| F-07 | nav 탭타깃 ≥44px | 375px | 햄버거 + 드로어 링크 + (카테고리 페이지) 탭 높이 측정 | 모두 ≥44px. | CHROME |
| F-08 | 오버플로우 원인 추적 | F-01~05 중 FAIL 시 | `javascript_tool`로 `document.body.offsetWidth` 초과 요소 탐색(각 요소 `scrollWidth > clientWidth` 스캔) | FAIL이면 넘치는 요소 selector를 보고(예: 절대폭 요소/sr-only 미축소). FAIL 없으면 N/A. | CHROME |

---

## G. 회귀 / 부수 (요구사항 #4 전수)

| ID | Category | Precondition | Steps | Expected Result | Method |
|---|---|---|---|---|---|
| G-01 | 기존 라우트 회귀 0 | — | `for u in / /market /backtesting /AAPL /AAPL/news /AAPL/fundamental /AAPL/options /AAPL/fear-greed /AAPL/overall; do echo "$u $(curl -s -o /dev/null -w '%{http_code}' ${BASE}$u)"; done` | 모두 200. 헤더 nav 추가가 기존 페이지 깨뜨리지 않음. | CURL |
| G-02 | vitest 전 스위트 | 워크트리 | `yarn test` | GREEN(전체 PASS). | (vitest) |
| G-03 | lint | — | `yarn lint` | PASS(boundaries 위반 0). | (lint) |
| G-04 | 빌드 성공 | — | `yarn build > /tmp/build-v0210.log 2>&1; echo exit=$?` | exit=0, 신규 라우트 `●`(SSG). | (빌드) |

---

## H. 결과 요약 체크리스트 (사람이 한 번에 보는 요약)

| # | 항목 | Test ID | PASS 조건 |
|---|---|---|---|
| 1 | 데스크탑 헤더 3링크 + /economy active | A-01~07 | 3링크 SSR + aria-current 정확 |
| 2 | 모바일 드로어 /economy + 접근성 | A-08~16 | 드로어 3항목·focus trap·escape·backdrop·scroll-lock |
| 3 | 뉴스 카테고리 탭 5종 + 허브 미경유 이동 | B-01~11 | 5탭·aria-current·375px 가로스크롤(body 넘침X) |
| 4 | SEO healthy(메타/canonical/OG/JSON-LD/h1유일) | C-01~17 | 정답표 일치 + h1 1개 + desc ≤120 |
| 5 | noindex 일관성(빈 데이터/잘못된 slug) | C-20~27 | degrade=noindex, 0건congress=indexable, bogus=404 |
| 6 | sitemap/robots | C-30~33 | static에 7신규URL, robots sane |
| 7 | 런타임 안정성(500/콘솔/cache) | D-01~10 | DYNAMIC_SERVER_USAGE 0, 콘솔 0, ISR HIT |
| 8 | 홈 라우팅 발견성 | E-01~04 | 헤더 전역발견 충족(홈 CTA는 권고) |
| 9 | 375px 오버플로우 스윕 | F-01~08 | 전 신규라우트 sw≤cw+1 |
| 10 | 회귀 0 + 빌드/테스트/lint | G-01~04 | 기존 200, GREEN, exit=0 |

---

## I. ⚠️ Controller 보고 사항 / 알려진 함정

1. **cross-repo core 잠금**: 신규 도메인 export(congress/financials/economy/market-news)가 `@y0ngha/siglens-core`에 의존. 레지스트리 publish 전이면 로컬 overlay 한정 실증 — 실증 중 `yarn install` 금지(overlay 소실 → 빌드 깨짐).
2. **degrade noindex 경로는 prod 자연 재현 난해**: economy 빈 스냅샷·financials all-empty·congress FMP infra throw는 `E2E_TEST=1` Fake provider(별도 포트) 또는 단위테스트로 검증(C-21~27). curl 단독으로는 healthy만 관찰될 수 있음 — false-pass 주의.
3. **congress vs financials 비대칭**(핵심): congress 0건=indexable, financials all-empty=noindex. C-24/C-25에서 이 비대칭이 의도대로인지 반드시 양방향 확인.
4. **canonical 도메인**: `NEXT_PUBLIC_SITE_URL` env에 따라 달라짐. 로컬 실증이라도 canonical은 보통 `https://siglens.io`. 실증 env 값을 먼저 확인 후 비교.
5. **description 상한 120**(160 아님): `clampSeoDescription` = 120 code-point. C-17은 120 기준.
6. **h1 displayName 변동**: congress/financials h1은 `displayName`(한국명 포함 가능)이라 `AAPL 의회 거래`로 정확 매치 안 될 수 있음 — 느슨하게 `의회 거래`/`재무제표`로 grep.
7. **AAPL 표 0건 회귀 위험**: FMP가 일시적으로 AAPL congress/financials 0건 반환 시 happy-path가 false-pass(0건→degrade 또는 빈 표). 실데이터 검수 전 FMP 직접 curl로 1건+ 확인 권장.
8. **홈 CTA 부재는 현황**(FAIL 아님): E-03 판정대로 헤더 nav가 전역 발견 보장. 홈 본문 CTA 추가는 권고 사항이며 blocker로 올리지 말 것.
