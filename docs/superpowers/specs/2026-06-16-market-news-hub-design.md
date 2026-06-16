# `/news` — 시장 뉴스 허브 설계

> 2026-06-16 · 신규 라우트군 `/news`(허브) + `/news/[category]`(카테고리별). 미국 시장 전체 뉴스를 **5개 카테고리**(일반·주식·암호화폐·외환·아티클)로 제공하고, 각 카테고리에 **카드별 AI 요약 + 카테고리 종합 다이제스트**를 단다. 기존 per-symbol `/[symbol]/news`의 **도메인 파이프라인**(번역+카드 분석 + core 다이제스트 빌더)을 재사용하되, **별도 `market_news` 테이블 + 센티넬 버킷**으로 데이터를 격리한다(§5 — per-symbol 회귀 0).

이 문서는 원래 "미국 시장 흐름 페이지" 구상에서 **거시 데이터와 응집도 기준으로 분리**된 두 산출물 중 **뉴스 허브**의 설계다. 거시 데이터 페이지는 `docs/superpowers/specs/2026-06-16-us-economy-market-flow-design.md`(`/economy`). financials(#2)·`/market` ISR 레시피와 per-symbol 뉴스 레시피를 평행 적용한다.

> 새 세션이 이 스펙으로 구현을 이어받는다. §10(사전 점검 체크리스트)은 Feature #2(PR #594) 리뷰에서 6라운드에 걸쳐 지적된 항목을 명문화한 것이다 — 구현 중·후 반드시 대조한다.

---

## 1. 배경 / 문제

현재 뉴스는 **종목별**(`/[symbol]/news`)만 존재한다. 시장 전체를 카테고리(일반·주식·암호화폐·외환·아티클)로 훑는 진입점이 없다. 한국어 사용자가 "오늘 미국 증시/암호화폐/외환 뉴스 흐름"을 보려면 종목을 특정해야만 한다.

`/news` 허브는 시장 전체 뉴스를 카테고리별로 번역·요약해 제공한다. per-symbol 뉴스가 이미 갖춘 **번역(영문→한글) + 카드 AI 분석(`submitNewsCardAnalysis` — symbol 무관) + 종합 다이제스트 패턴** 도메인 로직을 재사용해 일관성·구현비용을 잡되, 데이터는 별도 `market_news` 테이블로 격리해 per-symbol 회귀를 막는다(§5).

### 기존 자산 (재사용 대상)
- DB `news` 테이블: `symbol`(notNull), `category`(LLM-assigned), `titleEn/bodyEn`(원문), `titleKo/bodyKo/summaryKo/sentiment/priceImpact/analyzedAt`(카드 분석), 인덱스 `(symbol, published_at)`·`(published_at)`. 충돌 시 분석 컬럼 보존 upsert.
- 액션: `getNewsCardsAction`/`ensureNewsCardsAnalyzedAction`/`submit`·`poll`·`cancel`NewsAnalysisAction, `getNewsList(symbol)`(React.cached).
- 위젯: `widgets/news/NewsAiSummary`("뉴스 AI 종합 분석" 다이제스트) + 카드 폴링 훅(`useNewsCardPolling`/`useWaitForNewsCards`).
- 클라이언트: `FmpNewsClient`(현재 `news/stock` 종목별만) + `NewsClientPort` + `FakeNewsClient`.

## 2. 목표 / 비목표

### 목표
1. `/news` 허브 인덱스 + `/news/[category]` 5종(일반·주식·암호화폐·외환·아티클) 라우트.
2. 각 카테고리에 **카드별 AI 분석 + 카테고리 종합 다이제스트** 둘 다(= per-symbol `/[symbol]/news`와 동일 패턴).
3. 기존 번역·분석 파이프라인을 **카테고리 버킷**으로 재사용(§5). per-symbol 동작 **불변**(회귀 0).
4. core=도메인(카테고리 enum·정규화·다이제스트 프롬프트), siglens=I/O(FMP 카테고리 feed·DB·캐시·ISR·봇 차단).
5. 캐시(2계층)·ISR 4축·봇 차단·**클라 폴링** 패턴 준수.
6. 테스트 90%+(변경 전면), happy+worst, Vitest·Playwright E2E.
7. SEO: 카테고리별 단독 색인(서브라우트), 다이제스트·카드 텍스트 SSR 노출.

### 비목표
- **per-symbol `/[symbol]/news` 변경** — 버킷 추가만, 기존 경로 불변.
- **`/economy`(거시 데이터)** — 별도 스펙. `/economy` 브리핑이 헤드라인을 입력으로 쓸 때 본 허브의 조회 함수를 재사용할 수 있으나 본 스펙 범위는 `/news`.
- **senate-trades** — 별도 스펙.
- **실시간/cron 전수 갱신** — 전수 재생성은 Fast Origin Transfer 폭증(메모리). 신선도는 **방문 트리거 on-demand + revalidateTag**(per-symbol 뉴스와 동일).
- **tier 게이팅** — 전체 공개.

## 3. 레포 분담 (SCOPE)
| 항목 | 레포 |
|---|---|
| `NewsFeedCategory` 타입(**신규** — 기존 콘텐츠분류 `NewsCategory`와 직교, 부록 B.5) · 검증/normalize · 카테고리 다이제스트 프롬프트 빌더/normalize | core |
| FMP 카테고리 feed fetch(`news/general-latest` 등) | **siglens** (`FmpNewsClient` 확장) |
| `{category → {sentinel, fmpEndpoint, slug, koLabel}}` 어댑터 맵 | **siglens** (I/O·표시) |
| 신규 `market_news` 테이블 ingestion·번역·upsert·캐시·ISR·봇판정 (`DrizzleNewsRepository` **table 파라미터화** 재사용) | **siglens** |
| UI(허브·카테고리 페이지·카드·다이제스트·티커 칩) | **siglens** |

> core 변경이 선행되면 **core를 먼저 작업 → 로컬 build → siglens `node_modules`에 overlay**해 siglens 작업을 즉시 언블록(병목 최소화). 정식 publish는 사용자가 직접(메모리 `siglens_core_release_method`·`worktree_node_modules_prod_verify`).

## 4. 라우트 & 페이지 구조
- **`/news`** (허브 인덱스): 5개 카테고리 카드(각 카드에 최신 2~3 헤드라인 미리보기 + 카테고리 페이지 딥링크). SSR 텍스트로 크롤 가능.
- **`/news/[category]`** (동적 세그먼트, `generateStaticParams`=5개 카테고리 고정 목록 → on-demand ISR): per-symbol 뉴스 페이지를 미러
  1. `<h1>` SSR (예: "미국 암호화폐 뉴스").
  2. **카테고리 종합 다이제스트**(`NewsAiSummary` 평행) — Suspense + 클라 폴링.
  3. **뉴스 카드 리스트** — 번역 제목/요약/출처/시간/sentiment + **티커 칩**(stock/crypto/forex; 주식은 `/[symbol]` 딥링크) + 원문 링크. 카드 분석은 클라 폴링으로 채움.
- 유효하지 않은 category param → `notFound()`(404). 카테고리 enum은 core 단일 소스(`NewsFeedCategory`).
- 위젯: `widgets/news` 재사용 + `widgets/news-hub`(허브 인덱스) 신설(필요 시).

## 5. 데이터 모델 — 별도 `market_news` 테이블 + 센티넬 버킷 (핵심, 브레인스토밍 확정)

> **확정 이유(부록 C #1 해소):** per-symbol `news`와 같은 테이블을 쓰면 `url` 글로벌 UNIQUE + `id=hash(url)` + upsert의 `symbol=excluded.symbol` 때문에 **교차 오염**이 생긴다 — `news/stock-latest`(카테고리 "주식" = 시장 전체)는 `news/stock?symbols=AAPL`(per-symbol)과 같은 URL을 자주 반환하므로, 카테고리 ingestion이 per-symbol row의 symbol을 덮어써 **AAPL 페이지에서 기사를 빼앗는다**. → **url 공간을 물리적으로 격리**해 per-symbol 회귀를 구조적으로 0으로 만든다.

- **신규 `market_news` 테이블**: `news` 스키마 미러(id/symbol/source/url/publishedAt/titleEn/titleKo/bodyEn/bodyKo/summaryKo/sentiment/category/priceImpact/rawPayload/fetchedAt/analyzedAt) + **`tickers` 메타 컬럼**(기사가 들고 온 주식/암호화폐/외환 티커 — 표시·딥링크용, 부록 C #1·티커 칩 결정). 인덱스 `(symbol, published_at)`·`(published_at)` 동일.
- **카테고리당 센티넬 symbol 버킷**: `'__NEWS_GENERAL__'`·`'__NEWS_STOCK__'`·`'__NEWS_CRYPTO__'`·`'__NEWS_FOREX__'`·`'__NEWS_ARTICLES__'`. **버킷팅(페이지 소속)은 항상 카테고리(센티넬)가 결정** — 티커는 메타데이터일 뿐(시장 전체 feed 뷰이지 per-symbol 뷰가 아님).
- **티커 메타데이터(v1 포함)**: stock/crypto/forex feed 기사는 `tickers` 컬럼에 자기 티커 저장 → 카드에 칩 표시. 주식 티커는 기존 `/[symbol]` 딥링크. crypto/forex는 siglens에 per-symbol 페이지가 없어 표시용. general/articles는 티커 없음.
- **코드 재사용**: `DrizzleNewsRepository`를 **table 파라미터화**해 `market_news`에 재사용. core `submitNewsCardAnalysis({item})`는 **symbol 무관**이라 카드 번역·요약·sentiment 100% 재사용. `getNewsList`→`getMarketNewsList(sentinel)`(React.cached) thin wrapper. 폴링 훅·`selectAggregateNewsItems`·`isBot`/`isRecentlyFetched` 재사용.
- **센티넬 격리**: 언더스코어 prefix + 길이>8이라 `VALID_TICKER_RE`(`/^[A-Z][A-Z.-]{0,7}$/`)에 미매치 → `/[symbol]`로 새지 않음. 별도 테이블이므로 per-symbol 검색/sitemap과도 자연 격리(센티넬은 DB-internal 전용, URL은 human slug `/news/<category>`).
- **카테고리 간 겹침(일반 vs 주식)**: 격리 테이블 내부에만 존재. composite id(`hash(url+sentinel)`, 버킷별 중복 저장) vs 선점고정 중 택1은 **Phase 0 겹침률 실측 후 확정**(부록 A 기록). 겹침 낮으면 단순 `hash(url)` + dedup 수용.
- **LLM `category` 컬럼**: 직교 유지(콘텐츠 분류/sentiment용) — 페이지 소속은 센티넬이 결정.
- **빈 결과**: FMP 일시 장애로 빈 feed면 캐시 오염 방지(`EmptyResultError extends Error` throw → `unstable_cache` set skip → 바깥 catch에서 `[]` graceful degrade, `instanceof` 판정. **`cacheNonEmpty`는 이 이름으로 기존에 없음** — economy 스펙 §5.3 패턴 신설) + 카테고리 페이지 degrade(noindex 일치).

## 6. AI 분석 (v1에 둘 다 — 카드 + 다이제스트)
- **카드별**: 신규 `ensureMarketNewsCardsAnalyzedAction(category)` — 센티넬 기준 FMP fetch→`market_news` upsert→core `submitNewsCardAnalysis({item})`(symbol 무관, **재사용**) 폴링으로 번역+요약+sentiment+category. **게이트 없음(전체 공개, §2)**, 봇 `skipAnalysis`/`skipEnqueue`.
- **카테고리 종합 다이제스트**: 신규 `submitMarketNewsDigestAction(category)` + `pollMarketNewsDigestAction(jobId)`. company-flavored `submitNewsAnalysis`는 **재사용 불가**(부록 B.5) → **core에 카테고리 다이제스트 프롬프트 빌더 신설**(`companyName` 대신 **카테고리 한글 라벨**"미국 암호화폐" 인자) + normalize + `PROMPT_TEMPLATE_VERSION` 규약. 입력은 `selectAggregateNewsItems` top-25(7일 윈도). **서버 고정 default 모델**(BYOK·tier 게이트 없음), 봇 skipEnqueue.
- **클라 폴링**(`useNewsCardPolling`/`useWaitForNewsCards` 재사용 — 액션만 주입). peek seed는 카드/다이제스트 텍스트가 SEO 충족 시 생략 가능.
- cold-gen에서 `connection()`/`cookies()`/`headers()` 금지(메모리 `isr_connection_coldgen_500`).

## 7. SEO / ISR (4축 규약)
- **축 0**: 공유 셸 `cookies()`/`headers()` 금지(확인).
- **축 1**: DB/FMP는 `unstable_cache` 정적화 + 태그(`market-news:__NEWS_CRYPTO__` 등).
- **축 2**: 카드 폴링이 CSR면 SSR 크롤 텍스트(다이제스트·초기 카드) 서버컴포넌트로 분리.
- **축 3**: `/news/[category]`는 동적 세그먼트 → `generateStaticParams`=5 + `revalidate = 43200`(12h 리터럴, per-symbol news·메모리 `isr_revalidate_tuned` 정합). 신선도는 ingestion 후 `revalidateTag('market-news:<sentinel>', 'max')` on-demand(시간 기반은 상한). `/news` 허브는 `revalidate = 86400`(24h 리터럴, 홈/재무 정합).
- 메타: 카테고리별 title/description/keywords/canonical(`/news/<category>`)/OG/Twitter. JSON-LD: WebPage + BreadcrumbList + (선택) ItemList. degrade/빈 → noindex 일치.
- sitemap: 5개 카테고리 라우트 등록(롱테일 sitemap 정책과 정합 — 메인 색인 discoverability).
- 검증: `prod build`(`● SSG`/ISR) + `curl -I`(`x-nextjs-cache: HIT`) + DSU 0 + Chrome 실측.

## 8. 에러 처리 / degrade
- FMP 장애/빈 feed → degrade 안내(200) + noindex 일치. 카테고리 독립 degrade.
- 잘못된 category param → 404.

## 9. 비용 가드 (시장×5 카테고리 스케일)
- 봇 `skipEnqueue` 필수(메모리 bot-cost-caching). 카드 분석/다이제스트 캐시 적극 재사용.
- on-demand ingestion(방문 트리거)만, cron 전수 금지.
- **신규 상수**(market-news 슬라이스): `MARKET_NEWS_LOOKBACK_MS = 7일`(표시 윈도 — 시장 feed churn이 빨라 per-symbol 180일은 과대), `MAX_MARKET_NEWS_CARDS = 40`(카테고리 페이지 카드 상한), 다이제스트 입력 top-25(`selectAggregateNewsItems` 재사용, 7일 윈도). **정확값은 Phase 0 feed 볼륨 실측 후 확정**(부록 A 기록).
- AI 잡 쿨다운·중복 방지(기존 분석 lifecycle 재사용).

## 10. 사전 점검 체크리스트 (Feature #2 / PR #594 리뷰 지적) ⚠️필수
`/economy` 스펙 §10과 동일 표를 적용한다(요지): named 반환타입(§5.3) · 매직넘버 상수화(§15, 단 route config는 리터럴 예외) · WHAT 주석 금지(§15.3) · false/부정확 WHY 주석 금지(§15.6, 캐시·React.cache 클레임 실측) · 상수/fingerprint 중복 계산 금지(§16.5) · side-effect util은 `utils/`(§0.6) · 새 분기 양방향 테스트(§18) · 미검증 분기 금지(§22) · `as never` 금지→`as unknown as`(TS §7) · role↔aria-hidden 모순 금지·마우스전용 `data-testid`(a11y §3) · 단일 it() 복수단언 분리 · 동어반복 단언 금지(§13) · imprecise matcher 지양(§13) · 커스텀 에러 클래스(instanceof) · 2계층 캐시 단일 TTL · AI 클라폴링/cold-gen 안전 · 봇 skipEnqueue · 빈 결과 캐시오염 방지 · empty/degrade→noindex 일치 · 동일 슬라이스 내부는 relative import(테스트 포함, 구조 일관성) · 커버리지 90%+ happy+worst.

## 11. 구현 순서 (Phase 분해)
1. **Phase 0 — FMP 검증**: 카테고리 feed endpoint(general/stock-latest/crypto/forex/articles)·필드·**티커 필드**·**카테고리 간 겹침률**·플랜 지원 실측(§부록 A). 결과로 `NewsFeedCategory`·매핑·교차버킷 dedup 전략(§5) 확정.
2. **Phase 1 — core**: `NewsFeedCategory` 타입(신규)·검증/normalize·**카테고리 다이제스트 프롬프트 빌더(카테고리 라벨 인자)**/normalize. 단위 테스트. worktree build.
   - **→ core 로컬 빌드 → siglens `node_modules/@y0ngha/siglens-core` overlay**(메모리 `worktree_node_modules_prod_verify`)로 siglens 작업 **즉시 언블록**(정식 publish 대기 없이 병목 최소화). **정식 publish(GitHub Packages + `v*` tag)는 사용자가 직접** 진행(메모리 `siglens_core_release_method`). 머지 전 siglens `package.json` core 버전 핀을 릴리스 버전과 정합.
3. **Phase 2 — siglens 클라/데이터**: 신규 `market_news` 테이블 + 마이그레이션 + `DrizzleNewsRepository` table 파라미터화. `FmpNewsClient` 카테고리 분기 + `{category→{sentinel,fmpEndpoint,slug,koLabel}}` 맵 + `EmptyResultError` 패턴. `FakeNewsClient` 카테고리 지원. 테스트.
4. **Phase 3 — ingestion/버킷**: 센티넬 symbol ingestion·번역·upsert + **티커 컬럼** + on-demand `revalidateTag('market-news:<sentinel>')`. per-symbol(`news` 테이블) 격리·회귀 0 검증. 테스트.
5. **Phase 4 — AI**: 카드별 분석 + 카테고리 다이제스트(클라 폴링) 재사용/확장. 봇 skipEnqueue. 테스트.
6. **Phase 5 — UI**: `/news` 허브 인덱스 + `/news/[category]` 페이지(다이제스트+카드). InfoTooltip·degrade. `frontend-design`→`web-design-guidelines`.
7. **Phase 6 — SEO/ISR**: 메타·JSON-LD·sitemap·revalidate·SSR 텍스트. `seo-audit`.
8. **Phase 7 — E2E·실증**: Playwright happy/worst + prod-like build 실측(curl+Chrome+DSU 0).
> 각 Phase: types 먼저 → 구현 → 테스트 동행. PR별 리뷰 루프. cross-repo는 **core 먼저 작업 → 로컬 build overlay로 siglens 즉시 진행**(정식 publish는 사용자, 병목 최소화).

## 부록 A — FMP endpoint 검증 게이트 (Phase 0 — 2026-06-16 실측 완료 ✅)

5개 endpoint를 실 API로 호출해 확정했다. **전부 HTTP 200**(플랜 tier 지원, 402 없음).

### A.1 endpoint·스키마
| 카테고리 | endpoint | 스키마군 | 티커 필드 | 본문 | URL 필드 | 날짜 필드 |
|---|---|---|---|---|---|---|
| general | `news/general-latest` | **latest** | `symbol`(=`null`) | `text` | `url` | `publishedDate` |
| stock | `news/stock-latest` | latest | `symbol`(예 `FRVO`) | `text` | `url` | `publishedDate` |
| crypto | `news/crypto-latest` | latest | `symbol`(예 `BTCUSD`) | `text` | `url` | `publishedDate` |
| forex | `news/forex-latest` | latest | `symbol`(예 `USDJPY`) | `text` | `url` | `publishedDate` |
| articles | `fmp-articles` | **articles**(별도) | `tickers`(예 `"NASDAQ:RR"`) | `content`(HTML) | `link` | `date` |

- **latest 스키마**(general/stock/crypto/forex 공통): `{ symbol, publishedDate, publisher, title, image, site, text, url }`. `publishedDate`는 zoneless `YYYY-MM-DD HH:mm:ss`(ET) → 기존 `normalizeFmpPublishedDate` 그대로 사용. `symbol`은 general에서 `null`, 나머지는 단일 티커 문자열.
- **articles 스키마**(fmp-articles 전용): `{ title, date, content(HTML), tickers("EXCH:TICKER" 문자열), image, link, author, site }`. URL은 `link`, 날짜는 `date`, 본문은 `content`(HTML — 표시 시 strip 또는 그대로 저장). `tickers`는 `"NASDAQ:RR"` 형태(거래소 prefix; 다중이면 콤마 구분 가능 — 파싱 시 prefix 제거해 bare 티커 추출).
- **티커 → `tickers` 컬럼**: latest는 `symbol ? [symbol] : []`. articles는 `tickers` 문자열을 `,` split + `EXCH:` prefix 제거. 주식 칩만 `/[ticker]` 딥링크(crypto/forex pair·articles bare는 표시용).
- `source` 표시값: latest는 `site`(도메인) 또는 `publisher`(발행처명) — 카드에는 `publisher` 우선, 없으면 `site`. articles는 `site`("Financial Modeling Prep").

### A.2 겹침률 → DEDUP_DECISION
- general↔stock↔crypto 각 100건 URL 교집합 = **0**. FMP feed는 URL 기준 사실상 disjoint.
- **확정: `id = hashUrlToId(url)`(단순) + 선점고정** — `DrizzleMarketNewsRepository.upsertMarketNewsItem`의 conflict `set`/`setWhere`에서 **`symbol` 제외**(첫 insert가 버킷 고정, 카테고리 ingestion이 타 버킷 row를 훔치지 않음). composite id 불필요(겹침 0). fmp-articles의 `link`도 글로벌 unique이므로 동일 처리.

---

## 부록 B — 코드베이스 실측 (2026-06-16, Explore 조사)

스펙의 "기존 자산 재사용" 가정을 실제 코드와 대조한 결과. **재사용 시 이 실측 시그니처를 기준으로 한다.**

### B.1 DB 스키마 (`src/shared/db/schema.ts` L223–257) — 검증 ✅
- `news`: `id`(PK = `hashUrlToId(url)` SHA-256 32-char), `symbol`(**notNull**), `source`/`url`(**unique**)/`publishedAt`(notNull), `titleEn`(notNull), `titleKo/bodyEn/bodyKo/summaryKo/sentiment/category/priceImpact/rawPayload/analyzedAt`(nullable), `fetchedAt`(defaultNow).
- 인덱스: `(symbol, published_at)`, `(published_at)`. **standalone symbol 인덱스 없음.**
- upsert(`api.ts` L40–94): `onConflictDoUpdate(target: news.id)`. `set`은 **fetch-owned 5컬럼**(`symbol/source/publishedAt/titleEn/bodyEn`)을 `excluded.*`로 덮어씀. 분석 컬럼(`titleKo/bodyKo/summaryKo/sentiment/category/priceImpact/analyzedAt`)은 `set` 제외 = **write-once(attachAnalysis)**. `setWhere IS DISTINCT FROM` + `.returning({id})`로 실변경 시에만 row 반환 → 변경 없으면 `revalidateTag` skip.

### B.2 엔티티 슬라이스 `entities/news-article/` — 검증 ✅
- `getNewsList(symbol)`: **React.cached** O. `DrizzleNewsRepository.listBySymbol(symbol, NEWS_LOOKBACK_MS)` 래핑, `publishedAt DESC`.
- 액션: `getNewsCardsAction(symbol)`(폴링용, 비캐시) · `submitNewsAnalysisAction(symbol, companyName, modelId)`(tier/BYOK 게이트 + `isBot` → `skipEnqueueIfMiss`) · `ensureNewsCardsAnalyzedAction(symbol, {skipAnalysis?})`(FMP fetch→upsert→per-card 분석 폴링) · `pollNewsAnalysisAction(jobId)` · `cancelNewsAnalysisJobAction(jobId)`.
- 상수: `NEWS_LOOKBACK_MS = 180일`(표시), `NEWS_ANALYSIS_LOOKBACK_MS = 30일`(집계 프롬프트), `MAX_AGGREGATE_NEWS_ITEMS = 25`, `NEWS_LIST_CACHE_KEY = 'news:list'`, `POLL_INTERVAL_MS`/`POLL_MAX_ATTEMPTS`.
- 집계 선택: `selectAggregateNewsItems`(priceImpact rank top-25, recency 안정정렬) + `buildAnalysisNewsItems(rows)`(`isEnrichedRow` 필터 후 top-25). **`/news`·`/overall` 공유.**
- bot fetch-skip: `isRecentlyFetched(symbol)`/`markFetched(symbol)` Redis 10분 TTL(`lib/newsRefreshFlag.ts`).
- 클라이언트: `FmpNewsClient.fetchNews/fetchNewsForPeriod/fetchEarningsReport` → `fmpGet('news/stock', {symbols, limit, from})`. `NewsClientPort` 인터페이스 + `FakeNewsClient`(E2E 2건 fixture) + `getNewsClient()`(E2E_TEST 분기).

### B.3 위젯 `widgets/news/` — 검증 ✅
- `NewsAiSummary({symbol, companyName, hasEnrichedNews})`: `useNewsAnalysisTrigger`(mount 시 ensure) → `useWaitForNewsCards`(≥1 enriched까지 폴링) → `useNewsAnalysis`(집계 submit) → `usePublishSymbolChat`. 폴링 상수: 3s 간격, 5분 timeout, 3연속 실패 cutoff, 20 empty-snapshot.

### B.4 per-symbol 페이지 `app/[symbol]/news/page.tsx` — 검증 ✅
- `revalidate = 43200`(**12h**), `generateStaticParams() → []`(on-demand ISR), `VALID_TICKER_RE.test` 실패 시 `notFound()`.
- 섹션: `NewsListSection`(`staticSymbolCache([NEWS_LIST_CACHE_KEY, symbol], …, getNewsList, ['news:${symbol}'])`) + Earnings/Analyst + `NewsAiSummary`. Suspense + skeleton.
- on-demand 신선도: ensure가 신규/변경 감지 시 `revalidateTag('news:${symbol}', 'max')`.
- JSON-LD: WebPage + Article(dateModified day-quantized) + Breadcrumb. invalid/degrade → noindex.

### B.5 core 도메인 (`@y0ngha/siglens-core`) — ⚠️ 스펙 가정 정정
- `NewsCategory = 'earnings'|'m_and_a'|'guidance'|'regulation'|'macro'|'product'|'other'` — **이건 LLM 콘텐츠 분류**(카드 분석 결과)이지 **페이지 feed 카테고리(일반·주식·암호화폐·외환·아티클)가 아니다.** §3 표의 "`NewsCategory`(이미 존재 가능) 확장"은 오해 소지 → **새 `NewsFeedCategory` 타입 신설**이 맞다(기존 enum 확장 금지, 직교 유지).
- 카드 분석 `submitNewsCardAnalysis({item, thinkingBudget?})`/`pollNewsCardAnalysis` — **symbol 무관**(item만 입력) = **카테고리 버킷에 그대로 재사용 가능** ✅.
- 집계 다이제스트 `submitNewsAnalysis(options)`/`pollNewsAnalysis` → `NewsAnalysisResponse{currentDriverKo, keyEventsKo[], upcomingEventsKo[], overallSentiment}` — **company-flavored 프롬프트**("이 종목을 움직이는 동인"). 카테고리 다이제스트("오늘 암호화폐 뉴스 흐름")는 의미가 달라 **drop-in 재사용 불가 → core에 카테고리 다이제스트 프롬프트 빌더/normalize 신설 필요**(§6 "core 프롬프트 빌더"의 실제 의미).
- `PROMPT_TEMPLATE_VERSION = 'p1'`.

### B.6 봇/라우트 가드 — 검증 ✅
- `isBot(headers)`(`shared/api/isBot.ts`): AI봇 UA 정규식 + Next `userAgent().isBot`.
- `VALID_TICKER_RE = /^[A-Z][A-Z.-]{0,7}$/`(`shared/config/ticker.ts`). 센티넬 `__NEWS_GENERAL__`(언더스코어 prefix, 길이>8)은 **이 정규식에 매치되지 않음** → `/[symbol]` 라우트로 새지 않음(가드 충족). 단 sitemap/심볼 검색에서도 센티넬 제외 필요.

---

## 부록 C — 설계 결정 (브레인스토밍 2026-06-16 확정) ✅

부록 B 실측으로 드러난 설계 질문들을 브레인스토밍에서 해소했다. **확정 결과를 본문(§3·§5·§6·§7·§9·§11)에 승격**했으며, 아래는 결정 요지와 근거다.

| # | 질문 | 확정 | 근거 |
|---|---|---|---|
| 1 | 교차 버킷 충돌 | **별도 `market_news` 테이블 + 센티넬 버킷 + 티커 메타 컬럼**(§5). 카테고리 간 dedup 전략(composite id vs 선점)은 Phase 0 겹침률 실측 후 | 같은 테이블은 stock-latest⟷per-symbol url 겹침으로 per-symbol 기사를 빼앗음(회귀). url 공간 물리 격리 |
| 2 | 카테고리 다이제스트 | **v1에 포함** — core 신규 프롬프트 빌더 + 사용자 core 릴리스 | SEO/차별화 핵심. company-flavored `submitNewsAnalysis` 재사용 불가(B.5) |
| 3 | `companyName` 대체 | 신규 `submitMarketNewsDigestAction(category)`, core 프롬프트는 **카테고리 한글 라벨** 인자 | per-symbol 액션 불변 |
| 4 | lookback/상한 | `MARKET_NEWS_LOOKBACK_MS=7일`·`MAX_MARKET_NEWS_CARDS=40`·다이제스트 top-25. Phase 0 확정 | 시장 feed churn 빠름 |
| 5 | enum/매핑 배치 | core=`NewsFeedCategory`+normalize+프롬프트, siglens=`{category→{sentinel,fmpEndpoint,slug,koLabel}}` | SCOPE: 도메인=core, I/O·표시=siglens |
| 6 | revalidate | 카테고리 `43200`(12h)·허브 `86400`(24h) 리터럴 | per-symbol·홈/재무 정합 |
| 7 | tier/BYOK 게이트 | 신규 액션 **게이트 없음(공개)**, 다이제스트 서버 고정 default 모델 + 봇 skipEnqueue | §2 전체 공개 |
| 8 | 티커 칩 | **v1 포함** — `tickers` 컬럼 저장 + 카드 칩, 주식 `/[symbol]` 딥링크 | 사용자 결정 |

### 원 질문 상세 (배경)
1. **교차 버킷 article 충돌 (최우선).** `id = hashUrlToId(url)` + `url` unique + upsert가 `symbol = excluded.symbol`로 덮어씀. 카테고리 feed는 심하게 겹친다(주식 article이 일반 feed에도 등장). 같은 URL이 두 센티넬로 ingest되면 **마지막 fetch한 카테고리로 article이 이동(flapping)**하고 한 카테고리에서 사라진다. 결정 필요:
   - (a) `id = hash(url + sentinel)`로 버킷별 row 허용(중복 저장, url unique 제약 완화 필요 → 스키마 변경) ·
   - (b) dedup 수용(article은 한 카테고리에만, 우선순위 규칙으로 고정) ·
   - (c) feed 간 겹침이 실제로 적으면 무시(부록 A 실측으로 판단).
2. **카테고리 다이제스트 프롬프트.** B.5 — company-flavored `submitNewsAnalysis` 재사용 불가. core에 카테고리용 프롬프트 빌더 신설할지, 아니면 다이제스트를 1차 비목표로 빼고 카드 분석만 먼저 낼지.
3. **`companyName` 파라미터 대체.** `submitNewsAnalysisAction(symbol, companyName, …)`·`NewsAiSummary({companyName})`가 회사명을 요구. 카테고리 버킷엔 회사가 없음 → 카테고리 라벨("미국 암호화폐")로 대체하는 어댑터/오버로드 설계.
4. **카테고리 lookback/상한.** per-symbol은 표시 180일·분석 30일. 시장 feed는 churn이 빨라 180일이 과대(비용·노이즈) → 카테고리별 짧은 lookback/카드 상한 재설정.
5. **새 enum/타입 배치.** `NewsFeedCategory`(slug↔센티넬↔FMP endpoint 매핑) — core 도메인 enum vs siglens 어댑터 상수. SCOPE상 카테고리 enum은 core, FMP endpoint 매핑은 siglens.
6. **revalidate 리터럴 값.** 권장: 카테고리 페이지 `43200`(12h, per-symbol·메모리 `isr_revalidate_tuned`와 정합), 허브 인덱스 `86400`(24h, 홈/재무와 정합). 확정 필요.
7. **tier/BYOK 게이트.** `submitNewsAnalysisAction`이 tier/BYOK 게이트 보유. §2 비목표=전체 공개라 카테고리 다이제스트는 게이트 우회 경로 필요(현재 tier 게이팅 미작동이지만 명시).
