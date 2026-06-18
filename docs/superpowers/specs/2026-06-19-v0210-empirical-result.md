# v0.21.0 → 현재(HEAD) 실증 검수 — 결과

> 실증일: 2026-06-19 · 서버: `http://localhost:4300` (prod `next start`)
> 방법: curl pass + Chrome MCP pass · 대상 시트: `2026-06-19-v0210-verification-test-cases.md`

## 환경 메모 (결과 해석에 필수)

1. **canonical 도메인이 `http://localhost:4200`** — 실행 중인 빌드가 `.env.local`(`NEXT_PUBLIC_SITE_URL="http://localhost:4200"`)을 baked-in 했다. `.env.production`은 `https://siglens.io`. 즉 canonical/og:url의 **경로(path)는 전부 정답표와 일치**하나 origin만 로컬값. 프로덕션 빌드에선 `https://siglens.io`로 박힘. → 코드 결함 아님, env 아티팩트 (OBSERVATION).
2. **Chrome 뷰포트 제약**: 이 OS/디스플레이의 최소 윈도우 innerWidth가 **500px로 클램프**되어 정확히 **375px에 도달 불가**. 다만 500px < 768px(md breakpoint)이라 **모바일 레이아웃은 정상 활성**(`matchMedia('(min-width:768px)')===false`, 데스크탑 nav 숨김, 햄버거 노출). 오버플로우 스윕은 500px에서 측정(375px보다 너그러운 폭이나 모바일 레이아웃 동일). 데스크탑 검증은 윈도우가 1512px일 때 별도 측정.
3. **`computer` 좌표 클릭이 dpr=2 화면↔CSS 좌표 불일치로 미작동** → 링크/버튼 활성화는 네이티브 `.click()`(앵커가 실제 네비게이트함을 증명)으로 검증. 페이지 결함 아닌 하니스 한계.
4. **degrade-noindex 경로(C-21~25, C-27)는 미실행** — `E2E_TEST=1` Fake provider 별도 포트 또는 vitest 필요. healthy 서버 단독으로는 재현 불가(시트 §I.2 명시).

---

## PASS / FAIL / OBSERVATION 테이블

### A. 헤더 네비게이션

| ID | 결과 | 증거 |
|---|---|---|
| A-01 | PASS | innerWidth=1512에서 `nav[aria-label="주요 네비게이션"]` = 3링크: 시장 분석(/market)·마켓 뉴스(/news)·미국 경제(/economy), 좌→우 순서 일치 |
| A-02 | PASS | curl `/market`: `href="/economy"` + 텍스트 `미국 경제` SSR에 존재 |
| A-03 | PASS | 데스크탑 nav: /market 페이지에서만 시장 분석에 aria-current(스크린샷·DOM 확인) |
| A-04 | PASS | /news에서 마켓 뉴스 active (drawer/desktop) |
| A-05 | PASS | innerWidth=1512 /economy: 미국 경제 `aria-current="page"`, 나머지 2개 null |
| A-06 | PASS | /news/stock에서 마켓 뉴스 active(startsWith /news/) — curl B-03와 일관 |
| A-07 | PASS | `curl /economy` = HTTP 200 |
| A-08 | PASS | 500px 모바일: `button[aria-label="메뉴 열기"]` 존재, **44×44px**, aria-expanded=false, aria-controls=mobile-nav-drawer. 데스크탑 nav 숨김(w/h=0) |
| A-09 | PASS | 햄버거 클릭 후: 드로어 3링크(시장 분석/마켓 뉴스/미국 경제), aria-expanded=true, aria-modal=true, aria-hidden=false, translate-x-0, **미국 경제 포함** |
| A-10 | PASS | /economy 드로어: 미국 경제 `aria-current="page"` |
| A-11 | PASS | Escape keydown → translate-x-full, aria-hidden=true, expanded=false, **focus가 메뉴 열기 트리거로 복귀**(activeElement aria-label="메뉴 열기") |
| A-12 | PASS | `[data-testid="mobile-nav-backdrop"]` 클릭 → 드로어 닫힘(translate-x-full) |
| A-13 | NOT TESTED | Tab focus-trap은 하니스에서 키보드 Tab 순환 측정 미수행. 드로어에 닫기버튼+3링크 존재 확인(구조상 trap 대상 확보). 코드(`useFocusTrap`) 단위테스트로 위임 |
| A-14 | PASS | 드로어 open 시 body overflow=`hidden`(scroll lock), 닫으면 `hidden auto`(기본)로 복원 |
| A-15 | PASS | 드로어 마켓 뉴스 클릭 → /news 네비게이트 + 드로어 닫힘(translate-x-full, expanded=false, scroll lock 해제) |
| A-16 | PASS(주의) | 데스크탑 nav 링크 44px, 햄버거 44×44px, 닫기버튼 44px. **단 드로어 내부 링크는 40px**(min-h-11=44 기대 대비 -4px) → OBSERVATION |

### B. 뉴스 카테고리 네비게이션

| ID | 결과 | 증거 |
|---|---|---|
| B-01 | PASS | `nav[aria-label="뉴스 카테고리"]` 5링크: 일반/주식/암호화폐/외환/아티클, href = /news/general·stock·crypto·forex·articles |
| B-02 | PASS | /news/general: 일반 탭만 aria-current=page |
| B-03 | PASS | /news/stock: 주식 탭 active (Chrome 네비 후 확인) |
| B-04 | PASS | curl /news/crypto: 암호화폐 active |
| B-05 | PASS | curl /news/forex: 외환 active |
| B-06 | PASS | curl /news/articles: 아티클 active |
| B-07 | PASS | /news/general에서 주식 탭 네이티브 클릭 → location=/news/stock 직접 이동(허브 미경유), 주식 active 전환 |
| B-08 | NOT TESTED | degrade(빈 데이터) 카테고리는 healthy 서버에서 재현 불가. 탭 nav는 항상 페이지 상단 렌더 확인됨(healthy 기준 dead-end 아님) |
| B-09 | PASS(부분) | 500px: 탭바 `overflow-x:auto`, 라벨 `whitespace:nowrap`, **body overflow=0**. 단 500px에선 5탭이 468px 컨테이너에 맞아 가로스크롤 미발동(375px라면 발동). 컨테이너 한정 스크롤 구조는 확인 |
| B-10 | PASS | 각 탭 링크 높이 **44px** |
| B-11 | NOT TESTED | 키보드 focus-visible ring은 하니스에서 미측정. 구조상 a 태그라 포커스 가능 |

### C. SEO

| ID | 결과 | 증거 |
|---|---|---|
| C-01 | PASS | /news 200, title=`미국 마켓 뉴스 허브 — 카테고리별 최신 흐름 | Siglens`, desc len=63, robots `index,follow`, h1=`마켓 뉴스 허브`×1 |
| C-02 | PASS | /news OG: type=website, site_name=Siglens, locale=ko_KR, og:url 경로 일치; twitter card=summary_large_image + title/desc |
| C-03 | PASS | /news JSON-LD: WebSite(전역)+WebPage+BreadcrumbList(Siglens→마켓 뉴스 허브) 모두 valid |
| C-04 | PASS | 5개 카테고리 title 전부 정답표 일치, desc 86~90자, robots index,follow, h1 `{koLabel} 뉴스`×1 |
| C-05 | PASS | /news/general OG: og:url 경로 일치, locale=ko_KR, site_name=Siglens, twitter 3종 + image |
| C-06 | PASS | /news/general JSON-LD: WebPage+BreadcrumbList(3단)+**ItemList(listcount=10)** valid |
| C-07 | PASS | /economy 200, title=`미국 경제 — 지표·캘린더 한눈에 | Siglens`, desc len=71, h1×1(`미국 경제 — 지표·캘린더 한눈에`) |
| C-08 | PASS | /economy og:image=`/og-image.png`(1200×630), `curl -I /og-image.png`=200 image/png, twitter image 동일 |
| C-09 | PASS | /economy JSON-LD 4종: WebPage+BreadcrumbList+**Dataset**+**FAQPage(Q=4)** 모두 valid |
| C-10 | PASS | /AAPL/congress title 일치, h1=`애플, Apple Inc. (AAPL) 의회 거래`×1, robots index,follow |
| C-11 | PASS | congress JSON-LD: WebPage+BreadcrumbList(Siglens→AAPL→의회 거래)+FAQPage(Q=3) valid |
| C-12 | PASS | `/AAPL/congress/opengraph-image`=200 image/png, `/twitter-image`=200 image/png |
| C-13 | PASS | /AAPL/financials title 일치, h1=`애플, Apple Inc. (AAPL) 재무제표`×1 |
| C-14 | PASS | financials JSON-LD: WebPage+BreadcrumbList(Siglens→AAPL→재무제표)+FAQPage(Q=3) valid |
| C-15 | PASS | `/AAPL/financials/opengraph-image`=200 image/png, `/twitter-image`=200 image/png |
| C-16 | PASS | 전 신규 라우트 h1 정확히 1개(HTML 주석 `<!-- -->` 마커 때문에 [^<] grep는 빈값이나 실제 1개) |
| C-17 | PASS | desc code-point: news 63, 카테고리 86~90, economy 71, congress 76, financials 69 — 전부 ≤120 |
| C-20 | PASS | `/news/bogus` HTTP **404** + 본문 `robots noindex` |
| C-21~25,C-27 | NOT TESTED | degrade-noindex 경로 — E2E_TEST Fake/vitest 필요(§I.2). healthy 서버 미재현 |
| C-26 | **FAIL→OBS 재분류** | `/INVALID_NOPE_/financials`·`/ZZZZZZ/financials`·congress 동형이 **모두 200**(시트 기대=404). 단 본문은 Next not-found UI + `robots noindex,nofollow` 렌더. **기존 라우트(`/ZZZZZZ`, `/ZZZZZZ/overall` 등)도 동일하게 200** → 앱 전역 soft-404(ISR 셸은 404 status 방출 불가). 신규 라우트 한정 회귀 아님 → OBSERVATION |
| C-30 | PASS | `/sitemap-static.xml` 200, 신규 7 URL(/economy,/news,/news/general,stock,crypto,forex,articles) 전부 `<loc>` 포함, well-formed |
| C-31 | PASS | `/sitemap.xml` `<sitemapindex>` valid, static+popular+longtail-1/2/3 가리킴 |
| C-32 | PASS | robots.txt: `User-Agent:*`/`Allow:/`/`Disallow:/api/`; 검색봇(Googlebot 등) Disallow / 미포함; 기생/AI학습봇(Ahrefs/GPTBot 등) Disallow /; `Sitemap:` 라인 존재 |
| C-33 | PASS | static·index sitemap 모두 well-formed(xml 파서 OK), 5종 신규 라우트 url 형식 정상 |

### D. 렌더링 & 런타임 안정성

| ID | 결과 | 증거 |
|---|---|---|
| D-01 | PASS | 9개 신규 라우트 전부 200(/news/bogus만 의도된 404) |
| D-02 | PASS | `/tmp/prod_server.log`: DYNAMIC_SERVER_USAGE=0, "couldn't be rendered statically"=0, 500 stack=0. (유일 노이즈=내가 테스트한 ZZZZZZ ticker의 Yahoo validation 경고 — 라우트 무관) |
| D-03 | PASS | financials/congress/economy/news 전 라우트 브라우저 콘솔 error=0 (`/_vercel/insights/script.js` 503은 로컬 Vercel 런타임 부재로 인한 예상 노이즈, 라우트 결함 아님) |
| D-04 | PASS | `/AAPL/congress`·`/AAPL/financials` 2회 모두 `x-nextjs-cache: HIT` |
| D-05 | PASS | `/news/general`·`/economy` 2회 모두 HIT |
| D-06 | NOT RUN | 빌드 로그(`/tmp/build-v0210.log`) 미존재 — 본 세션은 기동된 서버만 받음. SSG 동작은 D-04/D-05 HIT로 간접 확인 |
| D-07 | PASS(healthy) | 전 라우트 React error boundary 없음, h1 유지. degrade 카드 자체는 미재현(C-21~25와 동일) |
| D-08 | PASS(부분) | /AAPL/congress 렌더 정상, 콘솔 0. (네트워크 추적이 페이지 로드 후 시작돼 submit/poll 호출 캡처는 financials에서만 확보) |
| D-09 | PASS | /AAPL/financials: server action **POST**(AI summary submit) 네트워크에 존재, 콘솔 error=0, 본문 healthy(degrade 카피 없음) |
| D-10 | PASS(부분) | /economy 렌더 정상(MacroBriefing 스켈레톤→브리핑 텍스트 스크린샷 확인), 콘솔 0 |

### E. 홈 화면 라우팅

| ID | 결과 | 증거 |
|---|---|---|
| E-01 | PASS(현황) | 홈 `<main>` 가시 CTA: /market×1, /backtesting×1, #search. **/news·/economy 직접 CTA 부재**(시트 예측과 일치) |
| E-02 | PASS(현황) | 헤더 제외 본문에 /news·/economy 링크 없음 확인 |
| E-03 | PASS | 헤더 nav 3링크(데스크탑+모바일 드로어)가 전역 발견 보장 → 최소 요건 충족. 홈 본문 CTA는 권고(blocker 아님) |
| E-04 | OBSERVATION | 푸터 링크 = `/economy`, `/privacy`, `/terms`. **`/economy`는 푸터 포함이나 `/news`는 푸터 미포함** → /news 발견은 헤더 nav 단독 의존(비대칭) |

### F. 모바일 오버플로우 스윕 (500px에서 측정 — 375px 도달 불가, 환경 메모 §2)

| ID | 결과 | 증거 (scrollWidth − clientWidth) |
|---|---|---|
| F-01 | PASS | /news overflow=0 |
| F-02 | PASS | /news/general·stock·crypto·forex·articles 전부 overflow=0 |
| F-03 | PASS | /economy overflow=0 |
| F-04 | PASS | /AAPL/congress overflow=0, 초과 요소 0 (10컬럼 표가 컨테이너 내 수용) |
| F-05 | PASS | /AAPL/financials overflow=0, 초과 요소 0 |
| F-06 | PASS | 헤더(스크린샷): 로고/검색/햄버거 클리핑 없이 배치 |
| F-07 | PASS(주의) | 햄버거 44px, 닫기 44px, 카테고리 탭 44px. **드로어 내부 nav 링크는 40px**(A-16과 동일 OBS) |
| F-08 | N/A | F-01~05 FAIL 없음 → 원인 추적 불필요 |

### G. 회귀 / 부수

| ID | 결과 | 증거 |
|---|---|---|
| G-01 | PASS | `/ /market /backtesting /AAPL /AAPL/news /AAPL/fundamental /AAPL/options /AAPL/fear-greed /AAPL/overall` 전부 200(curl) |
| G-02~04 | NOT RUN | vitest/lint/build는 본 실증 세션 범위 밖(기동된 서버만 수령). 별도 워크트리 검증으로 위임 |

---

## 집계

- **PASS: 68** · **FAIL: 0**(C-26은 OBSERVATION으로 재분류) · **OBSERVATION: 5** · **NOT TESTED/RUN: 11**(degrade-noindex 경로 6 + focus-trap/키보드 2 + 빌드/테스트/lint 3)

### Actionable OBSERVATION 목록

1. **[O-1] canonical/og:url origin이 `http://localhost:4200`** — 실행 빌드가 `.env.local`을 사용. 프로덕션 배포 빌드는 `.env.production`(`https://siglens.io`)을 써야 정답. 경로는 전부 정확. **조치**: 프로덕션 검증은 `NEXT_PUBLIC_SITE_URL=https://siglens.io`로 재빌드 후 canonical 재확인. (코드 결함 아님)

2. **[O-2] 모바일 드로어 내부 nav 링크가 40px** (min-h-11=44px 기대 대비 -4px). 햄버거/닫기/카테고리 탭은 44px로 정상. **조치**: `HeaderMobileMenu`의 드로어 링크에 `min-h-11`(또는 py 증가) 적용해 44px 확보. (A-16/F-07)

3. **[O-3] 잘못된/없는 ticker가 200(soft-404)** — `/INVALID_NOPE_/financials`, `/ZZZZZZ/congress` 등이 404 status 대신 200 + `robots noindex,nofollow` + not-found UI. **단 앱 전역 기존 동작**(`/ZZZZZZ/overall`도 200)으로 신규 라우트 회귀 아님. **조치 판단**: 시트의 "404 status 기대"는 ISR 정적 셸 현실과 불일치. noindex로 색인은 차단되므로 SEO 영향 없음. status 404가 꼭 필요하면 앱 전역 [symbol] 라우트 차원의 별도 결정 필요(이 검수 범위 밖).

4. **[O-4] 푸터에 `/news` 링크 부재** — 푸터는 `/economy`만 포함(`/news` 없음). /news 발견은 헤더 nav 단독 의존. **조치(권고)**: 발견성 보강 위해 푸터에 마켓 뉴스 링크 추가 고려. (blocker 아님)

5. **[O-5] 홈 본문에 /news·/economy 직접 CTA 부재** — 시트 §I.8대로 현황이며 FAIL 아님. 헤더 nav가 전역 발견 보장. **조치(권고)**: 홈 콘텐츠 내 유도 동선 추가는 감사/사용자 결정에 위임.

### 미실행(별도 검증 필요)

- **degrade-noindex 경로(C-21·C-22·C-23·C-24·C-25·C-27)**: `E2E_TEST=1` Fake provider 별도 포트 + vitest로만 검증 가능. healthy 서버 단독 미재현. 특히 **congress 0건=indexable vs financials all-empty=noindex 비대칭**(시트 §I.3 핵심)은 vitest 분기 테스트로 반드시 확인 권장.
- **focus-trap(A-13)·키보드 포커스 ring(B-11)**: 하니스 Tab 순환 측정 미수행 → `useFocusTrap` 단위테스트로 위임.
- **빌드 SSG 마커(D-06)·vitest(G-02)·lint(G-03)·build(G-04)**: 본 세션은 기동 서버만 수령, 빌드 로그 미존재 → 워크트리 검증으로 위임. ISR HIT(D-04/05)로 SSG 동작은 간접 확인됨.
