/**
 * 종목 뉴스 목록이 한 번에 그리는 카드 수.
 *
 * 이 값은 UI 페이지네이션 크기이자 **크롤러가 실제로 보는 뉴스 개수**다. "더보기"로
 * 늘어난 카드는 클라이언트 상태에만 있고 초기 DOM에는 없으므로, `/[symbol]/news`의
 * `ItemList` 구조화데이터도 이 값으로 잘라야 한다. 예전에는 JSON-LD가 10건을
 * 선언하는데 초기 DOM에는 5건만 있었다 — 마크업이 페이지에 없는 항목을 주장하는
 * 상태였고, 리터럴이 두 벌이라 조용히 갈렸다.
 *
 * `widgets`(렌더)와 `app`(JSON-LD) 양쪽이 봐야 해서 `shared`에 둔다.
 */
export const NEWS_LIST_PAGE_SIZE = 5;

/**
 * 시장 전체(카테고리) 뉴스 목록이 한 번에 그리는 카드 수.
 *
 * `NEWS_LIST_PAGE_SIZE`와 같은 이유로 존재하는 짝이다 — `/news/[category]` 페이지의
 * `ItemList` 구조화데이터와 `MarketNewsList` 위젯의 초기 DOM·"더보기" 증분이 이 값
 * 하나를 공유해야 한다. 값이 종목 뉴스(5)와 다른 건 카테고리 뉴스가 더 조밀하게
 * 그려서일 뿐이고, `NEWS_LIST_PAGE_SIZE`가 정확히 이 리터럴-두-벌 패턴으로 한 번
 * 조용히 갈렸던 전례(`NEWS_LIST_PAGE_SIZE` 주석 참고)가 이 상수를 미리 뽑아 두는
 * 근거다.
 *
 * `widgets/market-news`(렌더)와 `app/news/[category]`(JSON-LD) 양쪽이 봐야 해서
 * `shared`에 둔다.
 */
export const MARKET_NEWS_LIST_PAGE_SIZE = 10;

/**
 * 뉴스/등급 목록을 **클라이언트로 내보낼 때** 쓰는 행 수 상한.
 *
 * 목록 UI는 페이지 크기(종목 뉴스 `NEWS_LIST_PAGE_SIZE`, 카테고리 뉴스
 * `MARKET_NEWS_LIST_PAGE_SIZE`)씩만 그리는데 서버는 조회 결과를
 * 통째로 넘기고 있었다. 실측(AAPL, 2026-08-19): 뉴스 1,417행 + 등급 1,786행이 실려
 * `/AAPL/news`의 RSC 페이로드가 3,160KB, 문서 HTML이 1,687KB였고 Lighthouse 모바일
 * LCP가 20.3초(전 라우트 최악)였다.
 *
 * **그리는 쪽만 자르면 절반만 고친 것이다.** 3초 주기 폴링 액션
 * (`getNewsCardsAction` / `getMarketNewsCardsAction`)은 같은 전량을 **매 틱** 다시
 * 보내므로, 한 번 실리는 RSC보다 오히려 누적이 크다. `next.config.ts`가
 * `compress: true`가 된 뒤로는 그 응답이 매번 오리진에서 gzip되기까지 한다 —
 * 버스터블 t4g에서 CPU 크레딧을 갉는 경로다. 그래서 상한은 서버 렌더와 폴링 액션
 * **양쪽**에 걸고, 상수는 두 레이어가 모두 볼 수 있는 `shared`에 둔다
 * (`entities`는 `widgets`를 import할 수 없다).
 *
 * 값은 두 화면 모두 10페이지 분량이다(5×10, 10×5). SSR HTML에 나가는 것은 첫
 * 페이지뿐이라 크롤러가 보는 마크업은 상한과 무관하다.
 *
 * ponytail: 액션은 조회 후 잘라낸다 — SQL `LIMIT`이면 Neon 전송량까지 줄지만
 * repository 시그니처를 바꿔야 하고, 지금 비용의 대부분은 전송·압축 쪽이다.
 */
export const NEWS_ROW_SERIALIZATION_LIMIT = 50;
