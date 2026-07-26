/**
 * SEO title 조합(`composeSymbolTitle`) 테스트가 공유하는 실측 최악 케이스 fixture.
 *
 * 2026-07-26, `asset_translations` 테이블의 한국어명 264개 전량을
 * `한국어명(TICKER)` 형태로 실측한 결과 폭이 가장 넓었던 종목이다(47 폭단위).
 * 레버리지 ETF라 한국어명이 서술적으로 길고 실제 검색어는 티커 자체다.
 *
 * 이전에 `seo.equityTitleComposition.test.ts` · `seo.cryptoTitleComposition.test.ts` ·
 * `seo.composeSymbolTitle.test.ts` 세 파일에 리터럴로 중복돼 있었다 — 화이트리스트에
 * 더 긴 한국어명이 추가되면 세 곳을 다 찾아 고쳐야 하는 drift trap이었다. 값을
 * 갱신해야 한다면 위와 동일한 방법(`asset_translations` 전량을 `buildTitleSubject`로
 * 조합해 `seoTitleWidth`로 재측정)으로 다시 구해 여기 한 곳만 바꾸면 된다.
 */
export const SEO_WORST_CASE_KOREAN_NAME =
    '그래닛셰어스 2배 레버리지 NVDA 데일리 ETF';
export const SEO_WORST_CASE_TICKER = 'NVDL';
