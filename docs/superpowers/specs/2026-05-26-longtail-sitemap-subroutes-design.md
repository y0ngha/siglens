# Long-tail Sitemap 서브 라우트 추가

## 배경

Google Search Console에서 약 224개 페이지가 "사용자가 선택한 표준이 없는 중복 페이지"로 보고됨.
근본 원인: long-tail 티커의 서브 라우트(fundamental, news, fear-greed, overall)가 sitemap에 포함되지 않아
Google에 개별 페이지 신호가 부족.

현재 `sitemap-longtail-{n}.xml`은 `/{ticker}`(차트 페이지)만 포함.
Popular 티커(~165개)는 6개 라우트 전부 포함하지만, long-tail은 1개뿐.

## 변경 사항

Long-tail 티커에 4개 서브 라우트를 추가하여 티커당 5개 URL을 sitemap에 포함시킨다.

| Route              | Priority | changefreq | lastModified     |
|--------------------|----------|------------|------------------|
| `/{ticker}`        | 0.5      | weekly     | SITE_BUILD_DATE  |
| `/{ticker}/news`   | 0.45     | weekly     | SITE_BUILD_DATE  |
| `/{ticker}/fundamental` | 0.4 | monthly    | SITE_BUILD_DATE  |
| `/{ticker}/overall`| 0.45     | weekly     | SITE_BUILD_DATE  |
| `/{ticker}/fear-greed` | 0.4  | weekly     | SITE_BUILD_DATE  |

`/options`는 제외: `hasOptionsMarket` probe를 long-tail 전체에 돌리면 Yahoo Finance rate-limit
위험이 있고, long-tail 중 옵션 시장이 있는 종목은 극소수라 실익이 작다.

## 수정 파일

### 1. `entities/sitemap-entry/model.ts`

`LONGTAIL_ENTRIES_PER_TICKER = 5` 상수 추가.
sitemap index 페이지네이션과 longtail route handler 양쪽에서 참조.

### 2. `entities/sitemap-entry/lib/buildLongTailEntries.ts` (신규)

```typescript
function buildLongTailEntries(
    tickers: readonly string[],
    buildDate: Date
): SitemapEntry[]
```

티커 배열을 받아 5개 라우트씩 flatMap하여 `SitemapEntry[]` 반환.
`buildPopularEntries.ts`와 대칭 구조.

### 3. `app/api/sitemap/longtail/[page]/route.ts`

- 티커 단위 페이지네이션: `tickersPerPage = floor(SITEMAP_MAX_URLS_PER_FILE / LONGTAIL_ENTRIES_PER_TICKER)` = 10,000
- 기존 `tickers.slice(start, start + 50000)` → `tickers.slice(start, start + tickersPerPage)`
- 인라인 엔트리 생성을 `buildLongTailEntries(chunk, SITE_BUILD_DATE)` 호출로 대체

### 4. `app/api/sitemap/route.ts`

sitemap index 페이지 수 계산 변경:
- 기존: `ceil(tickers.length / SITEMAP_MAX_URLS_PER_FILE)`
- 변경: `ceil(tickers.length / tickersPerPage)` (tickersPerPage = 10,000)

### 5. `entities/sitemap-entry/index.ts`

`buildLongTailEntries`, `LONGTAIL_ENTRIES_PER_TICKER` re-export 추가.

### 6. `entities/sitemap-entry/__tests__/buildLongTailEntries.test.ts` (신규)

- 티커 1개 → 5개 엔트리 생성 검증
- URL 패턴 검증 (`/{TICKER}`, `/{TICKER}/news` 등)
- priority/changefreq 값 검증
- 빈 배열 입력 → 빈 배열 반환

## 페이지네이션 영향

- 기존: 10,000 long-tail 티커 → 10,000 URL → 1개 sitemap 파일
- 변경: 10,000 long-tail 티커 → 50,000 URL → 1개 sitemap 파일 (10,000 × 5)
- 20,000 long-tail 티커 → 100,000 URL → 2개 sitemap 파일

`SITEMAP_MAX_URLS_PER_FILE`(50,000) 한도를 넘지 않도록 티커 단위로 슬라이싱.

## 변경 없는 항목

- `buildPopularEntries.ts`, `buildStaticEntries.ts`, `loadLongTailTickers.ts`
- sitemap XML 직렬화 (`toUrlSetXml`, `toSitemapIndexXml`)
- 페이지 메타데이터 (canonical, robots)
- `/options` 관련 로직
