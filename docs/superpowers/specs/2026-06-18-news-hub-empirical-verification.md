# PR #598 `/news` 마켓 뉴스 허브 — Production-like 실증 검증 Spec

- **작성일**: 2026-06-18
- **유형**: 신규 라우트 production-like 실증 검증 ([docs/qa/RELEASE_VERIFICATION.md](../../qa/RELEASE_VERIFICATION.md) 플레이북 변형)
- **PR**: [#598](https://github.com/y0ngha/siglens/pull/598) — `feat(market-news-hub)` 마켓 뉴스 허브 + 5 카테고리 페이지
- **워크트리**: `/Users/y0ngha/Project/siglens/.claude/worktrees/feat+market-news-hub`
- **브랜치**: `worktree-feat+market-news-hub`
- **대상 라우트**:
  - `/news` (허브 인덱스 — `revalidate=86400`, SSR + 5 카테고리 카드 with `PREVIEW_HEADLINE_LIMIT=3` 헤드라인)
  - `/news/[category]` × 5 (`general` / `stock` / `crypto` / `forex` / `articles` — `revalidate=43200`, `generateStaticParams` 5종)
- **Stack**: Next.js 16.2 (ISR + on-demand `revalidateTag('…','max')`), FMP + Gemini, Drizzle + Neon, 한국어 UI

---

## 1. 검증 목표 (Goals)

자동화 테스트(unit/E2E)가 못 잡는 production-like **런타임 동작 · SEO · 접근성 · 성능** 회귀를 실측한다. Phase C 감사에서 식별된 갭(아래)을 반드시 케이스로 직접 검증한다.

### 1.1 Phase C 감사 갭(반드시 케이스로 반영)
- **SEO**: empty-snapshot `noindex` 12h 고착 위험, AI 다이제스트가 SSR HTML에 포함되지 않음(LCP/originality 영향), JSON-LD `NewsArticle`에 `image`/`publisher.logo` 누락, 허브↔카테고리 중복 콘텐츠 가능성, `ItemList` 10개 슬라이스 제한이 실제로 적용됐는지.
- **배포 안정성**: 봇 refresh-flag(`marketNewsRefreshFlag`) 적용 범위, `revalidateTag(tag, 'max')` 실제 동작, 순차 LLM 호출 timeout 안정성.
- **테스트 커버리지**: `CategoryNewsPage` RSC 렌더, `CategoryCard` 빈 fallback, `useWaitForMarketNewsCards` 즉시 반환, `fmpMarketNewsClient` 날짜 정규화 실패. 이 spec은 이 갭들을 런타임에서도 직접 관찰한다.

### 1.2 GO 조건 (모두 충족)
1. 6개 라우트(`/news` + 5 카테고리) 모두 `200 OK`, `Content-Type: text/html`.
2. `/news/bogus` 등 잘못된 슬러그 → 404 + `meta robots=noindex`.
3. 각 카테고리 페이지 HTML에 `<h1>` 1개, canonical 절대 URL(자신의 path), JSON-LD `WebPage` + `BreadcrumbList` + `ItemList`(items 있을 때)가 SSR에 박혀 있음.
4. 빈 카테고리 → `meta robots=noindex,nofollow` + `canonical=null`(상속 없음) + 본문에 `MarketNewsDegraded` 노출 + h1 유지.
5. 카테고리 페이지 Chrome 진입 시: `AI 다이제스트 생성 중…` → done 상태 전환 → 본문(`currentDriverKo` 등) 렌더링 / 카드 폴링이 sentiment를 채워 카드 갱신.
6. 콘솔 0 에러(`Dynamic server usage`, hydration mismatch, `bailout`, fetch fail 없음).
7. 사이트맵(`/api/sitemap/static`)에 `/news` + 5 카테고리 등록 — **(주의: 현재 코드에서 미등록 가능성 있음. 미등록 시 NO-GO Blocker 등급으로 보고.)**
8. 회귀 0: `/AAPL/news`(per-symbol 뉴스), `/market`, `/` 영향 없음.

### 1.3 조건부 GO (Important만 FAIL 허용)
- OG 이미지 라우트 부재(`/news/opengraph-image` 미생성) — 루트 `/opengraph-image` 상속으로 갈음 가능 시 OK. fallback이 깨지면 NO-GO.
- JSON-LD `NewsArticle.image`/`publisher.logo` 누락은 Phase C에서 이미 식별됨 — 이번 라운드에서 추가 fix 가능성 있으나, 미적용이면 follow-up issue로 등록 후 GO.

### 1.4 NO-GO 조건 (1개라도 해당)
- 6 라우트 중 1개라도 5xx 또는 prerender 실패.
- `Dynamic server usage` 에러 콘솔 누설(ISR 4축 §1 축 1 위반).
- 빈 카테고리에 `noindex`가 빠지거나 canonical이 인덱싱 가능한 상태로 남음(중복 콘텐츠 신호).
- 카테고리 페이지가 다이제스트 폴링 무한 루프 / 콘솔 에러 폭주.
- 봇 user-agent로 진입 시 새 LLM 호출이 enqueue되어 비용 누수(refresh-flag 미작동).
- 회귀: per-symbol `/AAPL/news`가 깨짐(import 충돌, 라우트 매칭 충돌 등).

---

## 2. 사전 준비 (Setup)

### 2.1 워크트리 / 브랜치 확인
```bash
cd /Users/y0ngha/Project/siglens/.claude/worktrees/feat+market-news-hub
git status                                  # working tree clean
git rev-parse --abbrev-ref HEAD             # worktree-feat+market-news-hub
git log --oneline -1                        # 최신 PR #598 R28 commit 확인
```

### 2.2 env 키 요구사항 (`.env.local` — 값 노출 금지)
다음 키가 존재해야 함 (값 검증은 모듈 부팅 시 throw로 확인):
- `NEXT_PUBLIC_SITE_URL` — 빌드 타임 인라인. 로컬은 `http://localhost:$PORT` 또는 `https://siglens.io`.
- `FMP_API_KEY` — FMP 뉴스 fetch(`news/general-latest` 등 5 endpoint).
- `DATABASE_URL` + `DATABASE_URL_UNPOOLED` — Neon + Drizzle. `market_news_card` 테이블 존재 필요.
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — `staticSymbolCache` ISR 메모이즈와 카드 sentinel 캐시.
- `GEMINI_API_KEY` — AI 다이제스트 호출.
- `SIGLENS_WORKER_URL` + `SIGLENS_WORKER_TOKEN` — job worker (다이제스트 jobs/news cards 분석 enqueue).
- `SIGLENS_GITHUB_TOKEN` — `@y0ngha/siglens-core`(GitHub Packages) 설치용. `yarn install` 시 필수.
- (선택) `NEXT_PUBLIC_GA_ID` 등.

### 2.3 core overlay (npm publish 미완 상태 대비)
```bash
# core가 GitHub Packages에서 잘 받아졌는지 확인
node -e "const m = require('@y0ngha/siglens-core'); console.log(typeof m.submitMarketNewsDigest, typeof m.NEWS_FEED_CATEGORIES);"
# 기대: 'function' 'object' (또는 본 PR이 의존하는 정확한 export — 미정의면 NO-GO).
```
> ⚠️ 만약 export가 `undefined`로 나오면 core 패키지에 PR이 의존하는 함수가 아직 publish되지 않은 것. 이 spec 실행 전에 사용자에게 보고하고 publish 완료를 기다린다(빌드 자체가 깨짐).

### 2.4 DB 마이그레이션 (한 번만)
```bash
yarn db:migrate                             # market_news_card 테이블 + 인덱스 생성 확인
```

### 2.5 dev server 기동 (1차 검증)

### 2.5.0 포트 격리 (parallel 세션 충돌 방지)

다른 세션이 4200에서 dev 서버를 띄워놓고 있을 수 있다. 충돌을 피하려고 이 검증은 **4300** 포트를 사용한다. 모든 명령은 `PORT=4300`을 export한 셸에서 실행한다.

```bash
export PORT=4300
# 충돌 사전 검사
lsof -nP -iTCP:$PORT -sTCP:LISTEN | head && echo "포트 사용 중 — 다른 포트로 변경하거나 점유 프로세스 확인" || echo "포트 $PORT 사용 가능"
```

모든 curl/chrome 명령은 `http://localhost:$PORT/...` 형식. dev 서버는 `yarn dev --port $PORT` (또는 `yarn dev -p $PORT` — package.json의 dev 스크립트가 받는 형식 확인), prod-like build는 `yarn build && yarn start --port $PORT`.

```bash
yarn dev --port $PORT                       # 포트 $PORT (기본 4200 대신)
# 다른 터미널에서 ready 확인
until curl -fsS http://localhost:$PORT/api/health 2>/dev/null || curl -fsS -o /dev/null http://localhost:$PORT/; do sleep 1; done
```

### 2.6 prod-like build 기동 (2차 검증, ISR/캐시 검증용)
ISR 캐시 헤더(`x-nextjs-cache: HIT`)와 prerender 검증은 dev 모드로는 불가하므로 prod 빌드가 필수:
```bash
NEXT_TELEMETRY_DISABLED=1 yarn build 2>&1 | tee /tmp/news-hub-build.log
# 빌드 결과 라우트 마커 확인
grep -E "news|●|○|ƒ" /tmp/news-hub-build.log | grep -i news
# 기대:
#   ● /news                              (SSG / ISR)
#   ● /news/[category]                   (SSG / ISR with 5 generated params)
yarn start --port $PORT
```

### 2.7 baseline 확인 (회귀 보호용)
```bash
curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost:$PORT/AAPL/news    # 200
curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost:$PORT/market       # 200
curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost:$PORT/             # 200
```

---

## 3. 실증 시나리오 (Test Cases)

각 케이스 형식:
- **목적** · **방법 1: curl** · **방법 2: chrome-tool-claude(B#)** · **기대 결과** · **실패 시 등급** (Blocker / Important / Minor).

### 3.1 라우트 응답 & ISR

#### S1 — `/news` 응답 & ISR 캐시 헤더 정합
- **목적**: 허브 라우트가 200, ISR로 정적화돼 `x-nextjs-cache` HIT.
- **curl**:
  ```bash
  # cold MISS
  curl -sSI http://localhost:$PORT/news | tee /tmp/s1-cold.txt
  # 1초 뒤 warm HIT (prod-like build 기준)
  curl -sSI http://localhost:$PORT/news | tee /tmp/s1-warm.txt
  grep -i "^x-nextjs-cache\|^cache-control\|^content-type\|^HTTP" /tmp/s1-warm.txt
  ```
- **chrome**: `mcp__claude-in-chrome__navigate` → `http://localhost:$PORT/news` → `read_network_requests` 첫 document 응답 status·headers 확인.
- **기대**: warm 응답 status `200`, `content-type: text/html; charset=utf-8`, `x-nextjs-cache: HIT`, `cache-control` 에 `s-maxage=86400`(또는 동등).
- **실패 시**: ISR 미동작 → Blocker(`generateStaticParams=[]` 부재 또는 축 0 위반).

#### S2 — `/news/crypto` 응답 + canonical + JSON-LD 3종
- **목적**: 카테고리 페이지가 200, canonical과 JSON-LD 3개(`WebPage` / `BreadcrumbList` / `ItemList`)를 SSR HTML에 포함.
- **curl**:
  ```bash
  curl -sS http://localhost:$PORT/news/crypto > /tmp/s2.html
  grep -E '<title>|rel="canonical"|application/ld\+json' /tmp/s2.html | head -20
  # JSON-LD 카운트 (정확히 3개여야 함)
  grep -c 'application/ld+json' /tmp/s2.html
  # @type 추출
  python3 -c "
  import re, json, sys
  html = open('/tmp/s2.html').read()
  for m in re.findall(r'<script type=\"application/ld\\+json\">(.*?)</script>', html, re.S):
      try: print(json.loads(m).get('@type'))
      except Exception as e: print('PARSE_FAIL', e)
  "
  ```
- **chrome**: `navigate` → `/news/crypto` → `get_page_text` 또는 `javascript_tool` 로
  ```js
  Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
       .map(s => JSON.parse(s.textContent)['@type'])
  ```
- **기대**: 응답 200, `<title>미국 암호화폐 뉴스 — 최신 마켓 흐름과 AI 다이제스트</title>`, `<link rel="canonical" href="${SITE_URL}/news/crypto">`, JSON-LD 정확히 3개로 `["WebPage", "BreadcrumbList", "ItemList"]` (items가 있는 경우. 빈 경우는 ItemList 생략 → 2개).
- **실패 시**: title/canonical 누락 = Blocker. JSON-LD ItemList 누락(items 존재 시) = Important.

#### S3 — `/news/bogus` 404 + noindex
- **목적**: 잘못된 슬러그가 `notFound()` 트리거.
- **curl**:
  ```bash
  curl -sS -o /tmp/s3.html -w "STATUS=%{http_code}\n" http://localhost:$PORT/news/bogus
  grep -E '<meta name="robots"|noindex' /tmp/s3.html | head -5
  ```
- **chrome**: `navigate` → `/news/bogus` → `read_console_messages` (4xx 콘솔 leak 없음) + `get_page_text` 로 not-found 메시지 확인.
- **기대**: `STATUS=404` (Next.js ISR not-found는 200으로 떨어질 수 있음 — 그 경우 메타 `robots: noindex,nofollow`로 검증). `generateMetadata`의 `categoryFromSlug` null 경로가 작동해 `<meta name="robots" content="noindex,nofollow">` 포함.
- **실패 시**: 200 + index 가능 상태 = Blocker(중복 콘텐츠 + 침투 페이지 인덱싱 위험).

#### S4 — 5 카테고리 전수 200
- **목적**: `generateStaticParams`가 5종 모두를 prerender.
- **curl**:
  ```bash
  for c in general stock crypto forex articles; do
      printf "%s: " "$c"
      curl -sS -o /dev/null -w "%{http_code} %{header_json}\n" http://localhost:$PORT/news/$c | head -c 200
      echo
  done
  ```
- **chrome**: 5개 모두 `navigate` 후 `read_console_messages`에서 에러 없음 확인.
- **기대**: 5개 모두 200, prod-like 빌드 시 warm 요청은 `x-nextjs-cache: HIT`.
- **실패 시**: 1개라도 5xx = Blocker. 1개만 noindex(빈 카테고리 양상) = Important.

### 3.2 메타데이터 & SEO

#### S5 — 카테고리별 title/description 정확성 + 길이
- **목적**: title = `${koLabel} 뉴스 — 최신 마켓 흐름과 AI 다이제스트`, description은 `clampSeoDescription`로 클램프됨.
- **curl**:
  ```bash
  for c in general stock crypto forex articles; do
      echo "=== /news/$c ==="
      curl -sS http://localhost:$PORT/news/$c | python3 -c "
  import sys, re, html
  h = sys.stdin.read()
  t = re.search(r'<title>(.*?)</title>', h, re.S); d = re.search(r'<meta name=\"description\" content=\"(.*?)\"', h)
  print('TITLE:', html.unescape(t.group(1)) if t else None)
  print('DESC LEN:', len(d.group(1)) if d else 0, 'TEXT:', d.group(1)[:80] if d else None)
  "
  done
  ```
- **chrome**: 각 라우트에서 `javascript_tool`:
  ```js
  ({title: document.title, desc: document.querySelector('meta[name="description"]').content, descLen: document.querySelector('meta[name="description"]').content.length})
  ```
- **기대**: 5종 모두 title에 koLabel(`미국 일반 시장`/`미국 주식`/`미국 암호화폐`/`미국 외환`/`미국 마켓 아티클`) 포함 + `뉴스 — 최신 마켓 흐름과 AI 다이제스트` 접미사. description 길이 ≤ 160자(또는 `clampSeoDescription` 상한, 보통 155자).
- **실패 시**: koLabel 누락/오타 = Important. 클램프 미작동(160자 초과) = Important.

#### S6 — canonical 절대 URL · self · trailing-slash 없음
- **목적**: 절대 URL, slug lowercase, no trailing slash.
- **curl**:
  ```bash
  for c in general stock crypto forex articles; do
      printf "%s: " "$c"
      curl -sS http://localhost:$PORT/news/$c | grep -oE '<link rel="canonical" href="[^"]+"' | head -1
  done
  curl -sS http://localhost:$PORT/news | grep -oE '<link rel="canonical" href="[^"]+"' | head -1
  ```
- **chrome**: `javascript_tool` → `document.querySelector('link[rel=canonical]').href`
- **기대**:
  - `/news` → `${SITE_URL}/news`
  - `/news/crypto` → `${SITE_URL}/news/crypto`
  - 전부 `https://` 절대, 슬러그 소문자, trailing-slash 없음.
- **실패 시**: 상대 URL / 대문자 / trailing-slash = Important.

#### S7 — OG / Twitter 이미지 fallback
- **목적**: `/news` 전용 OG 이미지 라우트가 없으므로 루트 상속 또는 명시적 OG 누락 확인.
- **curl**:
  ```bash
  # 명시적 og:image
  curl -sS http://localhost:$PORT/news | grep -oE '<meta[^>]+property="og:image[^>]*' | head -3
  # /news/opengraph-image 존재 여부
  curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:$PORT/news/opengraph-image
  curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:$PORT/news/twitter-image
  ```
- **chrome**: `javascript_tool`로 `document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').length`.
- **기대**: og:image 누락이거나(허용) 루트 OG 상속(`/opengraph-image` 응답 200으로 확인). 명시적 `image: undefined`로 인해 Twitter `summary_large_image` 카드에 이미지가 안 붙어도 라우트 자체 통과 — Minor.
- **실패 시**: og:image가 깨진 URL(404) = Important.

#### S8 — JSON-LD WebPage / BreadcrumbList / ItemList 스키마 검증
- **목적**: schema.org 필수 필드 정합, `ItemList` 슬라이스 10개 제한.
- **curl**:
  ```bash
  curl -sS http://localhost:$PORT/news/crypto > /tmp/s8.html
  python3 - <<'PY'
  import re, json
  html = open('/tmp/s8.html').read()
  scripts = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
  for s in scripts:
      d = json.loads(s)
      t = d.get('@type')
      print('===', t, '===')
      if t == 'WebPage':
          for k in ['@id','name','description','url','inLanguage','isPartOf']:
              print(' ', k, '=', d.get(k))
      elif t == 'BreadcrumbList':
          print(' items:', [(e.get('position'), e.get('name'), e.get('item')) for e in d.get('itemListElement', [])])
      elif t == 'ItemList':
          items = d.get('itemListElement', [])
          print(' count:', len(items))
          print(' first item:', json.dumps(items[0]['item'], ensure_ascii=False, indent=2)[:400] if items else None)
          # 10개 슬라이스 검증
          assert len(items) <= 10, f"ItemList >10: {len(items)}"
  PY
  ```
- **chrome**: 동일 JSON-LD 추출 후 `mcp__claude-in-chrome__javascript_tool`로 첫 NewsArticle의 `headline`, `url`, `datePublished`, `author.name`, `publisher.name` 확인.
- **기대**:
  - WebPage: `@id`, `name`, `description`, `url`, `inLanguage: "ko"`, `isPartOf` 모두 존재.
  - BreadcrumbList: 2개 entry(`마켓 뉴스 허브` → `koLabel`), `position`+`name`+`item` URL 정확.
  - ItemList: `itemListElement` 길이 ≤ 10. 각 item이 NewsArticle with `headline`/`url`/`datePublished`/`author`/`publisher`. **(주의: 이번 라운드에서 `image`/`publisher.logo` 추가됐는지 확인 — Phase C 갭.)**
- **실패 시**: 슬라이스 미적용 = Important. 필드 누락(headline/url/datePublished) = Important.

#### S9 — sitemap.xml에 `/news` + 5 카테고리 등록
- **목적**: 정적 사이트맵이 신규 라우트를 노출.
- **curl**:
  ```bash
  curl -sS http://localhost:$PORT/api/sitemap/static > /tmp/sitemap.xml
  grep -E "<loc>.*/news" /tmp/sitemap.xml
  # 6개 등록 기대
  grep -oE "<loc>[^<]*/news[^<]*</loc>" /tmp/sitemap.xml | wc -l
  ```
- **chrome**: 생략(서버 응답 충분).
- **기대**: 6개 entry — `/news`, `/news/general`, `/news/stock`, `/news/crypto`, `/news/forex`, `/news/articles`.
- **실패 시**: 0건이면 **Blocker** — Phase C 갭. 현재 `entities/sitemap-entry/buildStaticEntries`에 추가 필요. 검증 결과로 follow-up 이슈 등록 후 NO-GO 등급.
  - **사전 확인**: `grep -n "news" src/entities/sitemap-entry/*.ts` 부재 시 Phase B 진입 전에 PR에 추가 요청.

#### S10 — robots.txt 차단 없음
- **목적**: `/news`가 robots에서 차단되지 않음.
- **curl**:
  ```bash
  curl -sS http://localhost:$PORT/robots.txt | grep -E "Disallow|news"
  ```
- **기대**: `Disallow: /news` 없음.
- **실패 시**: 차단됐으면 Blocker.

### 3.3 빈 / Degrade 상태

#### S11 — 빈 카테고리 → noindex + MarketNewsDegraded 노출 + h1 유지
- **목적**: DB에 sentinel row 0건일 때의 SSR 일관성.
- **준비**: prod-like build 환경에서 임시로 한 sentinel을 DB에서 비움 (또는 dev 모드에서 `FakeMarketNewsClient` 사용 + sentinel 미시드). 실제 prod-like 환경에서는 reset:
  ```bash
  # 검증용 (psql, 환경에 따라):
  psql "$DATABASE_URL" -c "DELETE FROM market_news_card WHERE symbol = '__NEWS_FOREX__';"
  # revalidateTag('market-news:__NEWS_FOREX__', 'max') 트리거를 위해 admin endpoint 혹은
  # `entities/market-news/actions/ensureMarketNewsCardsAnalyzedAction`을 통한 우회 트리거.
  # 간단하게는 prod-like build를 한 번 재시작(staticSymbolCache LRU 리셋).
  ```
- **curl**:
  ```bash
  curl -sS http://localhost:$PORT/news/forex > /tmp/s11.html
  grep -E '<meta name="robots"|MarketNewsDegraded|불러오지 못했어요|<h1' /tmp/s11.html
  grep -oE '<link rel="canonical" href="[^"]+"' /tmp/s11.html
  ```
- **chrome**: `navigate` → `get_page_text`에서 "최근 뉴스를 불러오지 못했어요" 노출 확인.
- **기대**: 응답 200, `<meta name="robots" content="noindex,nofollow">`, canonical 태그 부재(상속 X — `canonical: null` 설정), `<h1>미국 외환 뉴스</h1>` 유지, degrade section(`aria-label="미국 외환 뉴스 없음"`) 본문.
- **실패 시**: noindex 누락 = Blocker. canonical 인덱스 가능 상태 = Blocker. h1 누락 = Important.

#### S12 — 일시적 빈 상태 → on-demand revalidateTag 후 noindex 해제
- **목적**: `revalidateTag(tag, 'max')`가 실제 캐시를 무효화하는지.
- **방법**:
  1. S11에서 비운 sentinel에 row 재삽입:
     ```bash
     psql "$DATABASE_URL" -f /tmp/seed-forex-1row.sql
     # 또는 ensureMarketNewsCardsAnalyzedAction이 호출되도록 worker job 트리거
     ```
  2. revalidateTag 호출 — `entities/market-news/actions/ensureMarketNewsCardsAnalyzedAction.ts:149` 가 자동 호출하므로 worker enqueue가 정상이면 자동.
  3. 캐시 무효화 후 fetch:
     ```bash
     sleep 2
     curl -sS http://localhost:$PORT/news/forex > /tmp/s12.html
     grep -E 'noindex|<h1|MarketNewsDegraded' /tmp/s12.html
     ```
- **기대**: noindex 사라짐, degrade UI 사라짐, 일반 `MarketNewsList` 본문 노출.
- **실패 시**: noindex가 12h(43200s) 동안 고착 = Phase C 식별 Blocker. fix가 머지된 라운드면 통과해야 함.

### 3.4 AI 다이제스트 & 카드 폴링

#### S13 — 카테고리 첫 진입 → "AI 다이제스트 생성 중" → "currentDriverKo" hydrate
- **목적**: `MarketNewsDigest` 클라이언트가 polling으로 done 상태에 도달.
- **방법**: prod-like 환경, 카테고리 다이제스트 DB row 없는 상태:
  - **chrome**:
    ```
    navigate http://localhost:$PORT/news/crypto
    read_page (직후) → "AI 다이제스트 생성 중이에요…" 텍스트 존재
    # 최대 30초 대기 (LLM 호출 latency)
    wait 30s
    read_page → "currentDriverKo" 영역(또는 `overallSentiment` 배지·핵심 흐름 카드) 노출
    read_console_messages → 0 에러
    ```
- **기대**: `aria-busy="true"` status card → "시장 AI 다이제스트" + 핵심 흐름·주목 일정·overallSentiment 배지가 표시되는 final card.
- **실패 시**: 30초 후에도 status card 그대로 = Important(timeout 또는 worker enqueue 실패). 콘솔에 fetch 에러 = Blocker.

#### S14 — 콘솔에 fail/warn 누설 없음
- **목적**: prod-like 환경에서 `console.error`, `console.warn`, hydration mismatch 무.
- **chrome**: 각 라우트 진입 직후·30초 후 `read_console_messages`로 stderr stream 확인.
- **기대**: `[NewsRoute]`, `[MarketNewsDigest]`, `[useMarketNewsCardPolling]` 같은 prefix 에러 0건. `Hydration failed`, `Warning: Text content did not match` 0건.
- **실패 시**: hydration mismatch = Blocker. action 에러 = Important.

#### S15 — 다이제스트 done 후 result UI 정합
- **목적**: 핵심 흐름·주목 일정·overallSentiment 배지가 SSR이 아닌 클라 hydrate로 채워짐. originality/LCP가 클라 의존(Phase C 갭).
- **chrome**:
  ```js
  // result card 텍스트 추출
  ({headings: Array.from(document.querySelectorAll('h2, h3')).map(h => h.textContent.trim()),
    badges: Array.from(document.querySelectorAll('[data-testid*=sentiment], [class*=SENTIMENT]')).map(b => b.textContent.trim())})
  ```
- **기대**: `시장 AI 다이제스트` 섹션 + `핵심 흐름` 또는 `주목할 일정` 또는 sentiment 배지(`긍정/부정/중립`) 중 최소 1개.
- **실패 시**: result 영역 자체가 비어 있음 = Important.

#### S16 — 카드 폴링 sentiment 부여 → 렌더 갱신
- **목적**: 첫 SSR에서 sentiment가 null인 카드가 폴링 후 sentiment 클래스가 붙음.
- **chrome**:
  ```js
  // 첫 진입 직후
  const before = Array.from(document.querySelectorAll('[data-news-card-id]')).map(c => ({id: c.dataset.newsCardId, sentiment: c.dataset.sentiment ?? null}));
  // 30초 후
  const after = ...;
  // before vs after diff: null → 'BULLISH'/'BEARISH'/'NEUTRAL' 전환된 카드 수
  ```
  (data attribute 명이 다르면 textContent 클래스/배지로 대체.)
- **기대**: 최소 1개 카드의 sentiment가 null → non-null 전환.
- **실패 시**: 30초 후에도 sentiment 0건 = Important(분석 worker latency). 콘솔 fetch fail = Blocker.

### 3.5 접근성 & UX

#### S17 — 키보드 탭 순서 / focus-visible / aria-label
- **목적**: 모든 인터랙티브 요소가 키보드로 접근 가능.
- **chrome**:
  ```
  navigate /news
  javascript_tool:
    document.querySelectorAll('a[href^="/news/"]').forEach(a => console.log(a.href, a.getAttribute('aria-label') ?? a.textContent.trim()))
  # Tab으로 카드 5개 순회 → 각 focus-visible ring (outline) 확인
  ```
- **기대**: 카드 5개 모두 anchor, aria-label 또는 명확한 text. focus-visible ring 시각화. `CategoryCard`의 `aria-label="${koLabel} 최신 뉴스 미리보기"` 존재.
- **실패 시**: focus indicator 부재 = Important. tab order 깨짐 = Important.

#### S18 — 모바일 viewport CLS / 가로 스크롤 없음
- **목적**: 375px 폭에서 layout shift 최소화, overflow 없음.
- **chrome**:
  ```
  mcp__claude-in-chrome__resize_window width=375 height=812
  navigate /news → 스크롤 끝까지 (CLS 시각 확인)
  javascript_tool: document.documentElement.scrollWidth - document.documentElement.clientWidth
  # = 0 (가로 overflow 없음) 기대
  ```
- **기대**: scrollWidth - clientWidth ≤ 1 (rounding). 헤더 → 카드 그리드 transition 시 가시적 jump 없음.
- **실패 시**: 가로 스크롤(예: line-clamp 미적용으로 긴 헤드라인 overflow) = Important.

#### S19 — 다이제스트 error → error.tsx fallback + 다시 시도
- **목적**: `/news/error.tsx`가 `/news/[category]` 에러에 잡힘.
- **방법**: 인위적으로 다이제스트 폴링이 fail throw하도록 dev env에서 `GEMINI_API_KEY`를 invalid로 설정 후 재시작:
  ```bash
  GEMINI_API_KEY=INVALID yarn start --port $PORT
  ```
- **chrome**: `navigate /news/crypto` → 30초 후 에러 경계 발동.
- **기대**: `<h1>마켓 뉴스를 불러오는 중에 문제가 발생했어요.</h1>` + `다시 시도` 버튼 + `Siglens 홈으로` 링크. `[NewsRoute] render error:` console.error 1건(의도된 로깅).
- **실패 시**: root error.tsx로 propagate = Important(error.tsx 적용 범위 깨짐).
- **rollback**: 검증 후 `GEMINI_API_KEY` 복원.

### 3.6 링크 & 네비게이션

#### S20 — 허브 카드 → 카테고리 페이지 (5종)
- **chrome**:
  ```
  navigate /news
  Array.from(document.querySelectorAll('a[href^="/news/"]')).map(a => a.href)
  # 각 링크 클릭 → 카테고리 페이지 진입 → back → 다음
  ```
- **기대**: 5개 카드 모두 `/news/<slug>` 링크 정상.
- **실패 시**: 링크 깨짐 = Blocker.

#### S21 — 카드 stock ticker chip → `/[symbol]`
- **목적**: `MarketNewsCard`의 ticker chip이 per-symbol 페이지로 deep-link.
- **chrome**:
  ```
  navigate /news/stock
  # 폴링 완료 대기 (sentiment 부여 후 ticker chip 등장)
  document.querySelectorAll('[data-testid*=ticker-chip], a[href^="/AAPL"], a[href*="/[A-Z]"]')
  ```
- **기대**: 최소 1개 카드에서 ticker chip 등장 → `/AAPL` 등으로 이동.
- **실패 시**: chip 0건 = Minor(데이터 의존). chip이 절대 URL로 외부 깨짐 = Important.

#### S22 — "원문 보기 →" 새 창
- **chrome**:
  ```js
  Array.from(document.querySelectorAll('a[target="_blank"][rel*="noopener"]'))
       .filter(a => a.textContent.includes('원문')).slice(0, 3).map(a => a.href)
  ```
- **기대**: 첫 카드 "원문 보기 →" 링크가 `target="_blank"` + `rel="noopener noreferrer"`로 새 탭 열림.
- **실패 시**: `rel="noopener"` 누락 = Important(보안).

### 3.7 이미지 · OG

#### S23 — `/news/opengraph-image` 및 `/news/twitter-image` 응답
- **목적**: PR에 OG 라우트가 추가됐는지 확인. 미추가면 루트 fallback 검증.
- **curl**:
  ```bash
  for path in /news/opengraph-image /news/twitter-image /news/crypto/opengraph-image /news/crypto/twitter-image; do
      printf "%s: " "$path"
      curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" "http://localhost:$PORT$path"
  done
  # 루트 fallback도 검증
  curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:$PORT/opengraph-image
  ```
- **기대**: 카테고리 OG 라우트 미존재(404) 시 루트 OG가 200 image/png — `og:image`가 루트 상속 또는 명시적 누락.
- **실패 시**: 루트도 깨졌으면 Blocker(회귀). 명시적으로 추가됐지만 깨졌으면 Important.

#### S24 — og:url / og:type / og:locale 정합
- **curl**:
  ```bash
  curl -sS http://localhost:$PORT/news/crypto | grep -oE '<meta property="og:[^>]+'
  ```
- **기대**: `og:type="website"`, `og:url="${SITE_URL}/news/crypto"`, `og:locale="ko_KR"`, `og:site_name="Siglens"`.
- **실패 시**: og:url 상대 URL = Important.

### 3.8 성능 (lightweight)

#### S25 — SSR HTML 첫 chunk에 H1 + JSON-LD 포함
- **목적**: 크롤러가 SSR-only로도 핵심 콘텐츠를 본다(JS 의존 X).
- **curl**:
  ```bash
  curl -sS http://localhost:$PORT/news/crypto | head -c 12000 | grep -E '<h1|application/ld\+json'
  ```
- **기대**: 첫 12KB에 `<h1>미국 암호화폐 뉴스</h1>` + 최소 1개 JSON-LD.
- **실패 시**: SSR이 lazy boundary 뒤에 묶여 첫 chunk에서 보이지 않으면 LCP 회귀 = Important.

#### S26 — `Dynamic server usage`, `bailout` 경고 콘솔 무
- **목적**: ISR 4축 준수.
- **방법**: prod-like build 로그 확인:
  ```bash
  yarn start --port $PORT 2>&1 | tee /tmp/news-runtime.log &
  curl -sS http://localhost:$PORT/news > /dev/null
  for c in general stock crypto forex articles; do curl -sS http://localhost:$PORT/news/$c > /dev/null; done
  grep -iE "Dynamic server usage|bailout|DYNAMIC_SERVER_USAGE" /tmp/news-runtime.log
  ```
- **기대**: grep 0건.
- **실패 시**: 1건이라도 = Blocker(ISR 미동작).

### 3.9 회귀 보호

#### S27 — `/AAPL/news` (per-symbol) 회귀 0
- **목적**: 새 `/news/*` 라우트가 기존 `/[symbol]/news`와 충돌하지 않음.
- **curl**:
  ```bash
  curl -sS -o /tmp/aapl-news.html -w "STATUS=%{http_code}\n" http://localhost:$PORT/AAPL/news
  grep -E '<h1|rel="canonical"|application/ld\+json' /tmp/aapl-news.html | head -5
  ```
- **chrome**: `navigate /AAPL/news` → 콘솔 0 에러.
- **기대**: 200 + `<h1>AAPL 뉴스`, canonical `${SITE_URL}/AAPL/news`, ticker FactLayer + 뉴스 카드 폴링 작동.
- **실패 시**: 라우트 매칭 충돌 / hydration mismatch = Blocker.

#### S28 — sibling 페이지 영향 없음
- **curl**:
  ```bash
  for p in / /market /AAPL /AAPL/overall /AAPL/fundamental /robots.txt /api/sitemap; do
      printf "%s: " "$p"
      curl -sS -o /dev/null -w "%{http_code}\n" "http://localhost:$PORT$p"
  done
  ```
- **기대**: 모두 200(혹은 sitemap/robots는 200 text/xml).
- **실패 시**: 어느 하나라도 5xx = Blocker(회귀).

---

## 4. 평가 기준 (Pass/Fail Matrix)

| 시나리오 | 등급 | GO 임계 |
|---|---|---|
| S1, S2, S3, S4 | Blocker | 4/4 PASS |
| S5, S6 | Important | 6/6 카테고리 모두 PASS |
| S7 | Minor | OG 누락은 follow-up 허용 |
| S8 (WebPage/Breadcrumb) | Blocker | 필드 누락 0 |
| S8 (ItemList NewsArticle 필드) | Important | image/publisher.logo는 follow-up issue 등록 후 GO 허용 |
| S9 | Blocker | 6 entry 등록 (현재 미등록이면 Phase B 진입 전 PR 추가 필요) |
| S10 | Blocker | 차단 0 |
| S11 | Blocker | noindex + canonical:null + h1 유지 |
| S12 | Blocker | revalidateTag 무효화 작동 |
| S13, S14, S15 | Important | 30s 내 done 전환 + 콘솔 0 |
| S16 | Important | 카드 sentiment 갱신 ≥ 1건 |
| S17, S18, S19 | Important | a11y/UX 회귀 0 |
| S20, S21, S22 | Important (S20 Blocker) | 링크 정합 |
| S23, S24 | Minor | OG/Twitter fallback 작동 |
| S25 | Important | 첫 12KB에 SSR 콘텐츠 |
| S26 | Blocker | `Dynamic server usage` 0 |
| S27, S28 | Blocker | 회귀 0 |

### 4.1 GO
모든 Blocker PASS + Important FAIL ≤ 2건(follow-up 이슈 등록) + Minor 무관.

### 4.2 조건부 GO
Blocker PASS, Important FAIL 3~5건이고 모두 follow-up issue로 분리 가능 + 사용자 합의.

### 4.3 NO-GO
Blocker 1건이라도 FAIL, 또는 Important FAIL ≥ 6건.

---

## 5. 자동화 · 재실행 가능성

이 spec을 다른 검증자/다음 라운드가 그대로 실행해도 동일 결과를 내도록:

### 5.1 실행 순서 (확정 시퀀스)
```bash
# 1. 워크트리 + env + core overlay 확인 (§2.1–2.3)
# 2. DB 마이그레이션 (§2.4)
# 3. dev server 1차 통과 후 prod-like build로 정식 검증 (§2.5–2.6)
# 4. S1 → S28 순서 실행. 각 케이스 결과를 표로 기록.
# 5. Blocker FAIL 즉시 stop, 사용자 보고.
# 6. 전부 통과 시 결과 요약 + sitemap/OG follow-up issue 등록 (해당 시).
```

### 5.2 산출물
- `/tmp/news-hub-build.log` — 빌드 라우트 마커
- `/tmp/s*.html`, `/tmp/sitemap.xml` — 케이스별 응답 스냅샷
- `/tmp/news-runtime.log` — runtime 콘솔/dyn 사용 검출
- chrome screenshot/console dump — `mcp__claude-in-chrome__read_console_messages` 결과
- 최종 결과는 새 Test Sheet에 P/F 표로 정리 (`docs/qa/sheets/2026-06-18-news-hub-verification.md` 권장).

### 5.3 환경 격리
- prod DB 미접촉 — local Postgres + Upstash dev token 사용. QA env 스왑 시 `.env.local`/`.env.production` 백업/복원 누락 주의 (메모리 노트 `feedback_env_local_restore_after_qa_swap` 참조).
- worker가 prod 큐를 건드리지 않도록 `SIGLENS_WORKER_URL`은 staging URL.

---

## 6. Phase B 진입 전 Risk + Mitigation

| Risk | 영향 | 사전 Mitigation |
|---|---|---|
| **R1 — FMP 키 부재** | S4(5 카테고리 전수 200) + S13(다이제스트) 일부 fail | `.env.local` 검증 후 키 없으면 S4·S13·S16 skip 표기, 나머지 시나리오 진행. SSR + ISR 검증은 DB seed만 있으면 진행 가능. |
| **R2 — core publish 미완** | 빌드 자체 실패(`yarn build` ENOENT or 함수 undefined) | §2.3 overlay check 실패 시 즉시 stop, 사용자에게 publish 대기 요청. workaround 금지(메모리 `feedback_user_handles_core_publish`). |
| **R3 — sitemap에 `/news` 미등록 (Phase C 갭)** | S9 즉시 Blocker | Phase B 시작 전 `grep -n "news" src/entities/sitemap-entry/*.ts` 사전 확인. 미등록이면 사용자에게 알리고 PR에 추가 요청 후 Phase B 시작. |
| **R4 — JSON-LD NewsArticle.image/publisher.logo 누락** | S8 Important fail | Phase C에서 식별된 갭. fix 미반영 시 follow-up 이슈 등록 후 GO 허용 (조건부 GO). |
| **R5 — DB seed 없음 → 모든 카테고리 빈 상태** | S2/S4가 빈 상태로 보임(S11 양상) | 사전에 `psql -c "SELECT symbol, count(*) FROM market_news_card GROUP BY symbol"` 로 5 sentinel 각각 ≥ 1 row 확인. 미시드면 `ensureMarketNewsCardsAnalyzedAction`을 5번 호출해 seed. |
| **R6 — 봇 refresh-flag 미작동** | 비용 누수 (LLM 호출 폭증) — Phase C 갭 | UA를 `Googlebot`으로 위장해 진입 후 worker enqueue 로그 0건 확인 (`grep enqueue /tmp/news-runtime.log` = 0). 1건이라도 보이면 Blocker. |
| **R7 — prod-like build가 dev mode `process.env.NODE_ENV` 누설** | x-nextjs-cache HIT가 안 잡힘 | `yarn build && yarn start` 반드시 사용. `yarn dev`로는 ISR/캐시 시나리오(S1·S26) skip 표기. |
| **R8 — chrome-tool-claude 세션이 영구 cookie/localStorage로 polling 흐름 왜곡** | S13/S16 결과 비결정적 | 각 시나리오 사이 `tabs_close_mcp` 후 `tabs_create_mcp`로 fresh 세션. |
| **R9 — Upstash Redis 쿼터 초과** | `staticSymbolCache` 작동 안 함 → 모든 페이지 매번 DB hit | dev token으로 격리. 시나리오 시작 시 Redis dashboard에서 quota 잔량 확인. |
| **R10 — `pre-push` hook으로 인한 시간 오버런** | 검증 사이클이 길어짐 | Phase B는 검증 only — push 없음. spec 검증 결과는 git-agent로 별도 sheet 커밋. |

---

**준비 완료.** Phase B 실행자는 §2 setup → §3 시나리오 순서대로 실행, §4 매트릭스로 GO/NO-GO 판정, §6 risk 대비책 적용.
