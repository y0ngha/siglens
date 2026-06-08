# Sitemap Runtime Performance Design

## Summary

`/sitemap-popular.xml`의 요청 중 Yahoo Finance/Redis 조회를 제거하고,
long-tail sitemap이 필요한 데이터만 정렬된 DB 페이지 단위로 읽도록 변경한다.

핵심 결정은 다음과 같다.

- popular 옵션 가능 여부는 주간 수동 스크립트가 정적 TypeScript 파일로 생성한다.
- long-tail 페이지 경계는 URL 수가 아니라 티커 2,000개로 고정한다.
- sitemap index는 long-tail 티커 count만 조회한다.
- long-tail sub-sitemap은 요청한 페이지의 symbol 최대 2,000개만 조회한다.
- count와 각 페이지 결과는 독립적으로 24시간 캐시한다.
- DB 조회 실패는 빈 sitemap으로 숨기지 않고 `503`으로 응답한다.

## Context

현재 sitemap은 CDN cache hit 시에는 origin 작업을 피하지만, cache miss 또는
재검증 시 다음 비용을 발생시킨다.

### Popular sitemap

`buildPopularEntries`가 모든 `POPULAR_TICKERS`에 `hasOptionsMarket`을 호출한다.
호출은 동시성 5로 제한되어 Yahoo rate limit은 보호하지만, Redis cache hit인
경우에도 여러 직렬 batch의 원격 round trip이 발생한다. Redis miss에서는 Yahoo
Finance 요청까지 추가된다.

옵션 상장 여부는 sitemap 요청마다 확인할 만큼 자주 변하지 않으며, popular ticker
목록 자체도 주간 수동 스크립트로 관리된다. 따라서 이 작업은 요청 경로가 아니라
주간 갱신 경로에 두는 것이 적합하다.

### Long-tail sitemap

현재 sitemap index와 각 long-tail sub-sitemap이 모두 `korean_tickers` 전체 행을
읽는다. sitemap에는 symbol만 필요하지만 이름, 한국어 이름, 거래소 필드까지
전송된다. sub-sitemap은 전체 결과를 애플리케이션 메모리에서 잘라 사용한다.

또한 long-tail 파일 하나가 최대 50,000 URL을 포함해 현재 raw XML이 약 8.8MB다.
CDN hit에서도 응답 다운로드와 XML 처리 비용이 크다.

## Goals

1. `/sitemap-popular.xml` 생성 중 외부 네트워크 호출을 0회로 만든다.
2. `/sitemap.xml` 생성 중 DB 전체 행 조회를 제거한다.
3. `/sitemap-longtail-{page}.xml`이 최대 2,000개 symbol만 조회하게 한다.
4. long-tail DB 성공 결과를 24시간 재사용한다.
5. DB 장애를 빈 정상 sitemap으로 오인하지 않게 한다.
6. long-tail 파일 크기를 현재의 약 1/5 수준으로 줄인다.
7. sitemap 페이지 순서를 결정적으로 유지한다.

## Non-goals

- 일반 옵션 페이지에서 사용하는 `hasOptionsMarket` Redis 캐시는 변경하지 않는다.
- sitemap 요청 경로에 Redis `MGET` 또는 Yahoo fallback을 추가하지 않는다.
- popular ticker 갱신을 GitHub Actions나 production cron으로 자동화하지 않는다.
- long-tail 전체 목록 또는 XML 전체를 하나의 cache value로 저장하지 않는다.
- 모든 long-tail 페이지가 동일 DB snapshot을 사용하도록 보장하지 않는다.
- sitemap XML streaming은 도입하지 않는다.

## Considered Approaches

### 1. Static popular options plus cached DB pages

주간 스크립트가 popular 옵션 목록을 생성하고, long-tail은 count 및 page query를
독립적으로 수행한다.

장점:

- sitemap hot path에서 Yahoo/Redis가 완전히 제거된다.
- DB가 필요한 최소 데이터만 반환한다.
- 현재 배포 및 운영 방식과 잘 맞는다.
- 구현과 장애 복구가 비교적 단순하다.

단점:

- 옵션 가능 목록은 다음 수동 갱신과 배포 전까지 변경되지 않는다.
- page cache 갱신 시점 차이로 일시적인 중복 또는 누락이 가능하다.

### 2. Build-time XML generation

배포 시 모든 sitemap XML을 생성해 정적 파일로 제공한다.

장점:

- runtime DB/API 비용이 없다.

단점:

- 신규 DB ticker가 다음 배포 전까지 반영되지 않는다.
- 생성 파일과 배포 artifact 크기가 커진다.
- 현재 DB 기반 graceful operation과 다른 배포 절차가 필요하다.

### 3. Versioned sitemap snapshots

DB 또는 object storage에 versioned symbol snapshot과 XML을 저장한다.

장점:

- 모든 페이지가 동일 snapshot을 사용한다.
- 페이지 경계가 갱신 도중 이동하지 않는다.

단점:

- snapshot 생성, activation, retention, cleanup 작업이 필요하다.
- 현재 규모와 요구사항에 비해 운영 복잡도가 크다.

선택: 접근안 1.

## Architecture

### Weekly popular update

기존 수동 `update-popular-tickers` 실행 흐름을 확장한다.

```text
FMP popular candidate 조회
  -> 갱신된 popular ticker 목록을 메모리에서 구성
  -> 각 ticker의 Yahoo options availability를 제한된 동시성으로 조회
  -> 모든 조회 성공
       -> popular-tickers.ts 후보 내용 생성
       -> popular-options-tickers.ts 후보 내용 생성
       -> 두 파일 기록
  -> 하나라도 조회 실패
       -> 프로세스 실패
       -> 두 대상 파일 모두 기존 내용 유지
```

Yahoo의 정상 응답에 expiration이 없는 경우는 `false`다. timeout, network error,
rate limit, malformed response 등 옵션 여부를 확정할 수 없는 경우는 실패다.
실패를 `false`로 변환해서 불완전한 정적 목록을 기록하지 않는다.

옵션 목록 출력은 중복을 제거하고 symbol 오름차순으로 정렬한다. 생성 파일 위치는
다음과 같다.

```text
src/entities/sitemap-entry/config/popular-options-tickers.ts
```

이 파일은 readonly literal array를 export하며 `buildPopularEntries`가 직접 사용한다.
런타임 `hasOptionsMarket` 호출은 `buildPopularEntries`에서 제거한다.

주간 갱신은 계속 수동 실행, diff 검토, commit, deploy 순서로 운영한다.

### Long-tail data source

`sitemap-entry`는 sitemap 조회에 필요한 최소 계약을 소유한다.

```ts
export interface LongTailTickerSource {
    count(): Promise<number>;
    loadPage(
        page: number,
        pageSize: number
    ): Promise<readonly string[]>;
}
```

DB 구현은 `korean_tickers`에서 symbol만 읽는다. popular 제외, uppercase 정규화,
중복 제거 규칙은 count와 page query가 동일하게 적용해야 한다.

논리 쿼리는 다음과 같다.

```sql
SELECT COUNT(DISTINCT UPPER(symbol))
FROM korean_tickers
WHERE UPPER(symbol) NOT IN (...popular);
```

```sql
SELECT DISTINCT UPPER(symbol) AS symbol
FROM korean_tickers
WHERE UPPER(symbol) NOT IN (...popular)
ORDER BY UPPER(symbol)
LIMIT 2000
OFFSET ((page - 1) * 2000);
```

`ORDER BY`는 필수다. 정렬 없는 pagination은 DB 실행 계획에 따라 페이지 중복이나
누락을 만들 수 있다.

### Cached query functions

route handler는 repository를 직접 호출하지 않고 다음 cached function을 사용한다.

```ts
countLongTailTickers(): Promise<number>
loadLongTailTickerPage(page: number): Promise<readonly string[]>
```

캐시 정책:

- TTL: 86,400초
- count key: `sitemap:longtail:count:v1`
- page key: `sitemap:longtail:page:v1:{page}`
- count와 각 page는 독립 cache entry
- DB 예외는 전파하며 실패 결과는 cache하지 않음
- 정상적인 빈 page 결과는 cache 가능

Next.js `unstable_cache`를 사용하며 key에 page가 반드시 포함되어야 한다.

### Sitemap pagination

long-tail 페이지 경계는 URL 개수가 아니라 ticker 개수로 정의한다.

```ts
LONGTAIL_TICKERS_PER_PAGE = 2_000
SITEMAP_MAX_URLS_PER_FILE = 50_000
```

현재 티커당 5개 route이므로 파일당 약 10,000 URL을 생성한다. 이후 route가
추가되더라도 page boundary는 2,000 ticker로 유지한다.

엔트리 생성 후 `entries.length`가 50,000을 초과하면 XML을 일부만 방출하지 않는다.
오류를 기록하고 `500`을 반환한다. 이 검증은 route 수 증가가 sitemap.org 상한을
조용히 깨는 것을 막는다.

## Request Data Flow

### Sitemap index

```text
GET /sitemap.xml
  -> countLongTailTickers()
     -> 24h cache hit: cached count
     -> cache miss: DB COUNT query
  -> ceil(count / 2,000)
  -> sitemap index XML
  -> CDN cache 1h
```

index route는 ticker 배열을 생성하거나 로드하지 않는다.

### Long-tail page

```text
GET /sitemap-longtail-{page}.xml
  -> page syntax validation
  -> loadLongTailTickerPage(page)
     -> 24h page cache hit: cached symbols
     -> cache miss: DB symbol page query
  -> empty page: 404
  -> build entries for at most 2,000 tickers
  -> 50,000 URL invariant check
  -> XML
  -> CDN cache 1h
```

count cache와 page cache의 갱신 시점 차이로 티커 추가/삭제 시 최대 24시간 일부
중복 또는 누락이 생길 수 있다. sitemap 특성과 다음 갱신에서의 자동 복구를 고려해
이를 허용한다.

### Popular page

```text
GET /sitemap-popular.xml
  -> POPULAR_TICKERS
  -> POPULAR_OPTIONS_TICKERS
  -> in-memory entry generation
  -> XML
  -> CDN cache 1h
```

이 요청 경로에는 DB, Redis, Yahoo Finance 호출이 없어야 한다.

## Error Handling

### Database unavailable

환경변수 미설정, Neon 오류, query timeout 등 count/page 데이터를 신뢰할 수 없는
경우 빈 배열이나 0으로 변환하지 않는다.

route response:

- status: `503 Service Unavailable`
- `Retry-After: 300`
- 내부 오류를 노출하지 않는 일반 응답 본문
- server log에는 원인 기록

Google crawler가 빈 정상 sitemap을 장기간 유효한 삭제 신호로 해석하는 위험보다
재시도를 유도하는 것이 안전하다.

### Invalid or out-of-range page

- 숫자가 아니거나 1 미만: `404`
- 정상 query 결과가 빈 page: `404`

### Popular options refresh failure

옵션 조회 하나라도 실패하면 스크립트는 non-zero로 종료한다. API 조회가 모두
성공하기 전에는 대상 파일을 기록하지 않는다. 기존 정적 목록은 그대로 유지된다.

## File and Ownership Changes

변경 영역:

```text
update-popular-tickers.ts
src/entities/sitemap-entry/
  config/popular-options-tickers.ts
  model.ts
  api.ts
  lib/buildPopularEntries.ts
  lib/countLongTailTickers.ts
  lib/loadLongTailTickerPage.ts
  index.ts
src/app/api/sitemap/route.ts
src/app/api/sitemap/longtail/[page]/route.ts
```

`LongTailTickerSource` 계약은 `model.ts`, Drizzle DB 구현은 `api.ts`, Next.js
24시간 cache wrapper는 `lib/`에 둔다. route handler는 orchestration과 HTTP
response만 담당한다.

## Testing

### Long-tail DB source

- count query가 popular symbol을 제외한다.
- lowercase/mixed-case symbol을 uppercase로 정규화한다.
- case-insensitive duplicate가 count/page 결과에 한 번만 존재한다.
- page query가 symbol만 반환한다.
- symbol 오름차순 결과를 반환한다.
- page 1과 page 2가 각각 올바른 limit/offset을 사용한다.

### Cached functions

- count cache TTL이 86,400초다.
- count cache key가 고정되어 있다.
- page cache key가 page별로 분리된다.
- page size는 2,000으로 고정된다.
- DB 예외가 호출자에게 전파된다.

### Popular update script

- 모든 Yahoo 조회 성공 시 옵션 가능한 ticker만 출력한다.
- 정상적인 no-options 응답은 `false`로 처리한다.
- 한 건의 조회라도 실패하면 대상 파일을 기록하지 않는다.
- 출력은 uppercase, deduplicated, sorted 상태다.
- 기존 popular ticker 갱신과 중복 제거 동작을 유지한다.

### Sitemap routes

- index route가 count만 사용하고 symbol page를 로드하지 않는다.
- count에 따라 `ceil(count / 2_000)`개의 long-tail index entry를 만든다.
- long-tail route가 요청 page만 로드한다.
- invalid/out-of-range page는 `404`다.
- DB 실패는 `503`과 `Retry-After: 300`을 반환한다.
- 50,000 URL을 초과하면 `500`이며 부분 XML을 반환하지 않는다.
- CDN cache header는 기존 1시간 정책을 유지한다.
- popular route 결과는 정적 옵션 목록에 따라 options URL을 포함한다.
- popular route dependency graph에 runtime options probe가 없다.

### Regression and integration

- sitemap XML serializer tests 통과
- sitemap route tests 통과
- SEO smoke tests 통과
- typecheck 및 lint 통과

## Success Criteria

- `/sitemap-popular.xml` origin generation 중 외부 네트워크 호출 0회
- `/sitemap.xml` origin generation 중 DB 전체 행 load 0회
- `/sitemap-longtail-N.xml` DB query 결과 최대 2,000 symbol
- long-tail DB count/page 성공 결과가 24시간 cache됨
- DB 장애 시 빈 정상 sitemap 대신 `503` 반환
- long-tail 파일 하나가 현재 약 50,000 URL에서 약 10,000 URL로 감소
- current route count 기준 raw XML이 약 1.8MB 수준으로 감소
- page ordering이 symbol 기준으로 결정적임

## Operational Procedure

1. `yarn update-popular-tickers`를 수동 실행한다.
2. FMP 및 Yahoo 조회가 모두 성공했는지 확인한다.
3. popular ticker와 popular options 생성 파일 diff를 검토한다.
4. 관련 테스트를 실행한다.
5. commit 및 deploy한다.

스크립트 실패 시 파일이 변경되지 않아야 하며, 기존 배포 상태를 유지한 채 원인을
해결한 후 다시 실행한다.
