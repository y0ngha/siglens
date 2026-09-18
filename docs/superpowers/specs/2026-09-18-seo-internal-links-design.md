# SEO 내부 링크·구조화데이터·OG 크롤 설계 (2026-09-18)

2026-09-18 운영 감사(curl + Googlebot UA 크롤 실측)에서 나온 세 건을 처리한다.
근거 수치는 모두 운영 실측이고, 각 항목의 "안 하는 선택"도 함께 적는다.

## P1 — 내부 링크 고아: sitemap 심볼의 35%가 3클릭 밖

### 측정

홈에서 Googlebot UA로 깊이 3까지 실제 크롤한 결과:

| 깊이 | 방문 | sitemap 도달 |
|---|---|---|
| 2 | 121 | 672 / 2,453 (27%) |
| 3 | 104 | 1,245 / 2,453 (51%) |

미도달 1,208 URL(심볼 루트 147 + 그 탭). 원인은 `TICKER_CATEGORIES`(큐레이션 84개)만
화면에 링크되고 `POPULAR_TICKERS` 387 + `POPULAR_CRYPTOS` 29 중 **303개가 어떤 카테고리에도
없어** sitemap 외 발견 경로가 없다는 것. 푸터 내부 링크는 13개뿐이다.

### 설계

새 라우트 `/symbols` — 한국어 노출 문구는 "종목 더 보기". **"모든/전체 종목"이라고 쓰지
않는다**: 상장 종목 전체가 아니라 우리가 분석을 제공하는 목록이라 과장이 된다.

- 구성: 자산군 3분할(미국 / 한국 / 암호화폐), 섹션 안에서 알파벳 정렬. 큐레이션
  카테고리(16개)로 잘게 나누지 **않는다** — `TICKER_CATEGORIES[].label`은 config 안의
  한국어 리터럴이라 네 로케일 화면에 새고, 84개만 덮으므로 나머지 303개는 어차피
  "그 외"로 몰린다. 섹션 이름은 내비가 이미 4로케일로 갖고 있는 지역 키를 재사용한다.
- 각 항목은 `/{symbol}` 루트로만 링크한다. 탭까지 링크하면 2,900개가 되고, 탭은 종목
  페이지 안의 탭 내비로 이미 한 클릭 거리다.
- 한글명은 `CURATED_KOREAN_NAMES`에 있으면 병기하되 **ko 화면에서만** — 영어·일본어·중국어 화면에 한국어 표기가 섞이지 않게 한다.
- 데이터 소스는 상수뿐 — DB·fetch 없음. 그래서 정적 렌더이고 `revalidate`가 필요 없다.
- `sitemap-static`에 추가. lastmod는 배포 시각 — 목록이 배포로만 바뀌므로 정직하다.
- JSON-LD는 `WebPage` + `BreadcrumbList`만. 416개 `ItemList`는 약 50KB를 더하는데
  링크 자체가 이미 같은 정보를 전달한다.
- 진입: 푸터(전 페이지) + `/market`·`/market/kr`. 푸터 링크로 디렉터리가 1클릭,
  모든 심볼이 2클릭이 된다.

### 하지 않는 것

- `/market`에 전체 목록을 붙이는 방식: 암호화폐 허브가 없어 29개 코인이 여전히 갈 곳이
  없고, `/market`이 무거워진다.
- 푸터에 인기 40개만: 303개 중 대부분이 고아로 남아 문제를 거의 해결하지 못한다.

## P2 — 심볼 뉴스 탭 `Article`에 `datePublished` 없음

### 측정

`/[symbol]/news`의 페이지 레벨 `Article` 노드가 `dateModified`만 갖는다(AAPL·MSFT·BTCUSD
동일 = 체계적, 뉴스 탭 스냅샷 389행). 코드 주석은 "ticker별 최초 뉴스 ingestion 시각을 알 수
없어" 생략한다고 적혀 있었는데, 운영 DB 실측 결과 **그 전제가 사실이 아니다**:

| 후보 | 커버리지 |
|---|---|
| `analysis_history.created_at` | `tab='technical'`만 존재(3,545행) — news 탭 0/389 |
| `news.fetched_at` 심볼별 최소 | news 스냅샷 388/389 커버, 심볼마다 값이 달라 균일 날짜 문제 없음 |

### 설계

`seo_analysis_snapshots.first_generated_at`(nullable timestamptz) 추가.

- upsert: INSERT에서 `generatedAt`으로 채우고, `onConflictDoUpdate`의 `set`에서는 **건드리지
  않는다** → 최초 값이 보존된다.
- 1회 백필(`db/scripts/backfillSnapshotFirstGeneratedAt.ts`, `first_generated_at IS NULL`만
  건드려 멱등):
  - `tab='news'` → 심볼별 `min(news.fetched_at)`
  - `tab='technical'` → `(symbol, tab)`별 `min(analysis_history.created_at)`
  - 나머지 탭 → NULL 유지. 진실한 소스가 없고 소비하는 곳도 없다. 새로 굽히는 행부터
    자연히 채워진다.
- JSON-LD: `firstGeneratedAt`이 있을 때만 `datePublished`를 싣는다. `datePublished >
  dateModified`면 생략한다 — 발행이 수정보다 늦다고 주장하는 마크업은 내보내지 않는다.
- 운영 절차는 **2패스**다: ① 마이그레이션 적용 → ② 백필 1회 → ③ 코드 배포 → ④ 백필 1회.
  스크립트가 `first_generated_at IS NULL`만 건드려 멱등하므로 ④는 ②~③ 사이에 프리웜이
  새로 넣은 행(아직 컬럼을 모르는 코드가 만든 것)만 줍는다. 로컬 Postgres에서 실행으로
  확인했다 — 2패스는 0행, 갭 행을 만들면 그 행만 채운다.

### 같이 고친 것 — `/backtesting` Dataset

Article류 구조화데이터를 전수 조사한 결과(5개 파일), 다른 페이지는 손댈 것이 없었다:
`/news/[category]`는 기사별 `Article`에 실제 `publishedAt`을 이미 싣고, 뉴스 허브는 페이지
레벨 `Article`이 없고, `/fear-greed`는 `dateModified: snapshot.asOf`로 이미 정직하다.

예외가 `/backtesting`의 `Dataset`이었다 — 날짜 필드가 **하나도** 없었다. 정적 데이터셋이라
`dateModified`는 배포 시각이 아니라 데이터의 마지막 진입일이어야 하고, 그 값은 화면 통계가
이미 갖고 있다(`STATS.periodEnd`).

문자열을 그대로 쓴다. `Date`로 정규화하면 연-월(`2026-03`)이 `2026-03-01`로 파싱돼(V8 실측)
우리가 모르는 날짜를 주장하게 된다. schema.org의 Date는 `YYYY-MM`도 허용하므로 통계가
말하는 정밀도를 바꾸지 않는다.

### 하지 않는 것

- `datePublished = dateModified`로 채우기: 경고만 없애고 신선도 신호를 부풀린다.
- 값이 없는 행에 빌드 날짜를 넣기: 전 종목이 같은 시점이 된다(원 주석의 지적이 맞다).

## P3 — og:image가 Googlebot에 차단됨

### 측정

`og:image = /ko/AAPL/opengraph-image?<hash>`(200)인데 robots.txt의 Googlebot 그룹이
`/*/opengraph-image`·`/*/twitter-image`를 Disallow한다. 이 Disallow는 GSC 크롤 통계에서 이
동적 PNG가 61GB를 소모한 근거로 들어간 것이다. 심볼 OG는 9탭 × 416심볼 × 4로케일 ≈ 1.5만 URL.

### 설계

허브 OG만 되살린다 — `/{locale}/news/opengraph-image`와 `/{locale}/news/*/opengraph-image`
(twitter-image 동일), 로케일 4개 × 7경로 ≈ 28 URL. 심볼 OG는 그대로 차단.

패턴에 주의: `/*/news/opengraph-image`는 `*`가 `/`도 먹어 `/ko/AAPL/news/opengraph-image`까지
열어버린다. 그래서 로케일을 리터럴로 적어 접두사 일치를 좁힌다.

`Allow`가 더 구체적(더 긴 일치)이면 `Disallow`를 이긴다는 규칙에 의존하므로,
robots 파서 동작을 테스트로 고정한다.

### 하지 않는 것

- 전면 해제: 측정된 61GB 크롤 예산 누수가 재발하고, 회복 목표(실제 콘텐츠 크롤 예산)와
  정면으로 충돌한다.
- 심볼 `og:image`를 정적 `og-image.png`로 바꾸기: 소셜 카드에서 종목별 이미지를 잃는다.
  소셜 크롤러는 `*` 그룹을 따르므로 지금도 정상 동작한다.

## 검증

- 단위: `/symbols`가 `POPULAR_TICKERS`+`POPULAR_CRYPTOS` 전 심볼을 정확히 한 번 링크,
  푸터 링크 존재, robots Allow/Disallow parity, 백필 SQL의 멱등성, `datePublished` 게이트
  (없을 때 생략 / `> dateModified`일 때 생략)
- 배포 후: 깊이 2 크롤 재측정(목표 sitemap 도달 95%+), `/AAPL/news` JSON-LD에
  `datePublished` 등장, robots.txt 허브 OG Allow 확인
