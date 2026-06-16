# `/news` — 시장 뉴스 허브 설계

> 2026-06-16 · 신규 라우트군 `/news`(허브) + `/news/[category]`(카테고리별). 미국 시장 전체 뉴스를 **5개 카테고리**(일반·주식·암호화폐·외환·아티클)로 제공하고, 각 카테고리에 **카드별 AI 요약 + 카테고리 종합 다이제스트**를 단다. 기존 per-symbol `/[symbol]/news` 파이프라인(번역+카드 분석+종합 다이제스트)을 **카테고리 버킷**으로 재사용한다.

이 문서는 원래 "미국 시장 흐름 페이지" 구상에서 **거시 데이터와 응집도 기준으로 분리**된 두 산출물 중 **뉴스 허브**의 설계다. 거시 데이터 페이지는 `docs/superpowers/specs/2026-06-16-us-economy-market-flow-design.md`(`/economy`). financials(#2)·`/market` ISR 레시피와 per-symbol 뉴스 레시피를 평행 적용한다.

> 새 세션이 이 스펙으로 구현을 이어받는다. §10(사전 점검 체크리스트)은 Feature #2(PR #594) 리뷰에서 6라운드에 걸쳐 지적된 항목을 명문화한 것이다 — 구현 중·후 반드시 대조한다.

---

## 1. 배경 / 문제

현재 뉴스는 **종목별**(`/[symbol]/news`)만 존재한다. 시장 전체를 카테고리(일반·주식·암호화폐·외환·아티클)로 훑는 진입점이 없다. 한국어 사용자가 "오늘 미국 증시/암호화폐/외환 뉴스 흐름"을 보려면 종목을 특정해야만 한다.

`/news` 허브는 시장 전체 뉴스를 카테고리별로 번역·요약해 제공한다. per-symbol 뉴스가 이미 갖춘 **번역(영문→한글) + 카드 AI 분석 + 종합 다이제스트(`NewsAiSummary`)** 파이프라인을 그대로 재사용해 일관성·구현비용을 모두 잡는다.

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
| `NewsCategory`(이미 존재 가능) 확장·정규화·다이제스트 프롬프트/normalize | core |
| FMP 카테고리 feed fetch(`news/general-latest` 등) | **siglens** (`FmpNewsClient` 확장) |
| DB ingestion·번역·upsert·캐시·ISR·봇판정 | **siglens** (기존 재사용) |
| UI(허브·카테고리 페이지·카드·다이제스트) | **siglens** |

> core 변경은 worktree 로컬 build → node_modules 덮어쓰기 검증. 정식 publish는 사용자(메모리 `siglens_core_release_method`).

## 4. 라우트 & 페이지 구조
- **`/news`** (허브 인덱스): 5개 카테고리 카드(각 카드에 최신 2~3 헤드라인 미리보기 + 카테고리 페이지 딥링크). SSR 텍스트로 크롤 가능.
- **`/news/[category]`** (동적 세그먼트, `generateStaticParams`=5개 카테고리 고정 목록 → on-demand ISR): per-symbol 뉴스 페이지를 미러
  1. `<h1>` SSR (예: "미국 암호화폐 뉴스").
  2. **카테고리 종합 다이제스트**(`NewsAiSummary` 평행) — Suspense + 클라 폴링.
  3. **뉴스 카드 리스트** — 번역 제목/요약/출처/시간/sentiment + 링크. 카드 분석은 클라 폴링으로 채움.
- 유효하지 않은 category param → `notFound()`(404). 카테고리 enum은 core 단일 소스.
- 위젯: `widgets/news` 재사용 + `widgets/news-hub`(허브 인덱스) 신설(필요 시).

## 5. 데이터 모델 — 카테고리 버킷 (핵심)
- DB `news.symbol`은 `notNull`이라, 각 카테고리를 **per-category 센티넬 symbol**로 버킷팅한다: 예 `'__NEWS_GENERAL__'`, `'__NEWS_STOCK__'`, `'__NEWS_CRYPTO__'`, `'__NEWS_FOREX__'`, `'__NEWS_ARTICLES__'`.
  - 이유: 기존 `(symbol, published_at)` 인덱스 + `getNewsList(symbol)` + 캐시 키 + ingestion/polling 머신을 **수정 없이 카테고리별로 그대로 재사용**. 센티넬 symbol 하나가 곧 한 카테고리 피드.
  - LLM-assigned `category` 컬럼은 직교(콘텐츠 분류/태그·sentiment용)로 유지 — 페이지 소속은 센티넬 symbol(소스 feed)이 결정.
  - 센티넬 형식은 `VALID_TICKER_RE`와 충돌하지 않게(언더스코어 prefix) 정해, per-symbol 라우트(`/[symbol]`)로 새지 않도록 가드(라우트 매칭·search에서 제외).
- **클라이언트 라우팅**: `getNewsClient`/`FmpNewsClient`를 확장해 센티넬 symbol → 해당 FMP **카테고리 feed endpoint**로 매핑(현재 `news/stock`(symbol) 단일 → 카테고리 분기 추가). 일반 종목 symbol은 기존 `news/stock` 유지.
- **빈 결과**: FMP 일시 장애로 빈 feed면 캐시 오염 방지(`cacheNonEmpty` 평행) + 카테고리 페이지 degrade(noindex 일치).

## 6. AI 분석 (per-symbol 패턴 그대로 — 둘 다)
- **카드별**: `ensureNewsCardsAnalyzedAction`로 카드별 번역+요약+sentiment+category. 센티넬 symbol 기준으로 기존 액션 재사용.
- **카테고리 종합 다이제스트**: `NewsAiSummary` 평행 — 카테고리 상위 카드 종합 1개. core 프롬프트 빌더 + normalize. `PROMPT_TEMPLATE_VERSION` 규약.
- **클라 폴링**(peek seed는 카드/다이제스트 텍스트가 SEO 충족 시 생략 가능, per-symbol 동일). **봇 skipEnqueue**(메모리 — 시장×5카테고리라 비용 가드 특히 중요).
- cold-gen에서 `connection()`/`cookies()`/`headers()` 금지(메모리 `isr_connection_coldgen_500`).

## 7. SEO / ISR (4축 규약)
- **축 0**: 공유 셸 `cookies()`/`headers()` 금지(확인).
- **축 1**: DB/FMP는 `unstable_cache` 정적화 + 태그(`news:__NEWS_CRYPTO__` 등).
- **축 2**: 카드 폴링이 CSR면 SSR 크롤 텍스트(다이제스트·초기 카드) 서버컴포넌트로 분리.
- **축 3**: `/news/[category]`는 동적 세그먼트 → `generateStaticParams`=5 + `revalidate` 리터럴. 신선도는 ingestion 후 `revalidateTag('news:<sentinel>', 'max')` on-demand(시간 기반은 상한). `/news` 허브도 `revalidate` 리터럴.
- 메타: 카테고리별 title/description/keywords/canonical(`/news/<category>`)/OG/Twitter. JSON-LD: WebPage + BreadcrumbList + (선택) ItemList. degrade/빈 → noindex 일치.
- sitemap: 5개 카테고리 라우트 등록(롱테일 sitemap 정책과 정합 — 메인 색인 discoverability).
- 검증: `prod build`(`● SSG`/ISR) + `curl -I`(`x-nextjs-cache: HIT`) + DSU 0 + Chrome 실측.

## 8. 에러 처리 / degrade
- FMP 장애/빈 feed → degrade 안내(200) + noindex 일치. 카테고리 독립 degrade.
- 잘못된 category param → 404.

## 9. 비용 가드 (시장×5 카테고리 스케일)
- 봇 `skipEnqueue` 필수(메모리 bot-cost-caching). 카드 분석/다이제스트 캐시 적극 재사용.
- on-demand ingestion(방문 트리거)만, cron 전수 금지. 카테고리별 lookback/최대 카드 수 상한.
- AI 잡 쿨다운·중복 방지(기존 분석 lifecycle 재사용).

## 10. 사전 점검 체크리스트 (Feature #2 / PR #594 리뷰 지적) ⚠️필수
`/economy` 스펙 §10과 동일 표를 적용한다(요지): named 반환타입(§5.3) · 매직넘버 상수화(§15, 단 route config는 리터럴 예외) · WHAT 주석 금지(§15.3) · false/부정확 WHY 주석 금지(§15.6, 캐시·React.cache 클레임 실측) · 상수/fingerprint 중복 계산 금지(§16.5) · side-effect util은 `utils/`(§0.6) · 새 분기 양방향 테스트(§18) · 미검증 분기 금지(§22) · `as never` 금지→`as unknown as`(TS §7) · role↔aria-hidden 모순 금지·마우스전용 `data-testid`(a11y §3) · 단일 it() 복수단언 분리 · 동어반복 단언 금지(§13) · imprecise matcher 지양(§13) · 커스텀 에러 클래스(instanceof) · 2계층 캐시 단일 TTL · AI 클라폴링/cold-gen 안전 · 봇 skipEnqueue · 빈 결과 캐시오염 방지 · empty/degrade→noindex 일치 · 동일 슬라이스 내부는 relative import(테스트 포함, 구조 일관성) · 커버리지 90%+ happy+worst.

## 11. 구현 순서 (Phase 분해)
1. **Phase 0 — FMP 검증**: 카테고리 feed endpoint(general/stock-latest/crypto/forex/articles)·필드·플랜 지원 실측(§부록 A). 결과로 카테고리 enum·매핑 확정.
2. **Phase 1 — core**: `NewsCategory` 확장(이미 있으면 재사용)·정규화·다이제스트 프롬프트/normalize. 단위 테스트. worktree build.
3. **Phase 2 — siglens 클라/데이터**: `FmpNewsClient` 카테고리 분기 + 센티넬 symbol 매핑 + `cacheNonEmpty`. `FakeNewsClient` 카테고리 지원. 테스트.
4. **Phase 3 — ingestion/버킷**: 센티넬 symbol ingestion·번역·upsert 재사용 + on-demand `revalidateTag`. per-symbol 회귀 0 검증. 테스트.
5. **Phase 4 — AI**: 카드별 분석 + 카테고리 다이제스트(클라 폴링) 재사용/확장. 봇 skipEnqueue. 테스트.
6. **Phase 5 — UI**: `/news` 허브 인덱스 + `/news/[category]` 페이지(다이제스트+카드). InfoTooltip·degrade. `frontend-design`→`web-design-guidelines`.
7. **Phase 6 — SEO/ISR**: 메타·JSON-LD·sitemap·revalidate·SSR 텍스트. `seo-audit`.
8. **Phase 7 — E2E·실증**: Playwright happy/worst + prod-like build 실측(curl+Chrome+DSU 0).
> 각 Phase: types 먼저 → 구현 → 테스트 동행. PR별 리뷰 루프. cross-repo는 core 먼저 릴리스(사용자) 후 siglens.

## 부록 A — FMP endpoint 검증 게이트 (Phase 0)
실측 후 표로 기록:
- 카테고리 feed: `news/general-latest`, `news/stock-latest`(시장 전체), `news/crypto-latest`, `news/forex-latest`, `fmp-articles`(또는 실제 경로) — 응답 필드·시장 전체(symbol 무관) 조회·페이지네이션.
- 플랜 tier 지원(402 여부 — `logFmpPaymentRequiredError`).
- 기존 `news/stock`(symbol)과의 응답 스키마 차이(정규화 매핑 영향).
결과로 §5 센티넬 매핑·카테고리 enum을 확정한다.
