export const SITE_NAME = 'SIGLENS';

/**
 * 브랜드의 한글 표기. 번역 대상이 아니라 고유명사라 카탈로그가 아닌 상수다.
 *
 * 영문 `SIGLENS`는 로그 관리 프로젝트 SigLens(siglens.com)와 이름이 겹쳐,
 * 검색엔진과 AI 답변 엔진이 두 주체를 구분할 단서가 없었다(2026-10-04 조사:
 * 브랜드 검색 상위가 전부 그쪽이고, 한글 표기는 사이트 어디에도 없었다).
 * `WebSite`·`Organization`의 `alternateName`과 ko 화면(푸터·소개·홈 FAQ)에
 * 같은 표기를 심어 한글 브랜드 검색이 이 사이트로 귀결되게 한다.
 *
 * 화면에 넣을 때는 ko 로케일에서만 보인다 — 다른 로케일 독자에게 한글 독음은
 * 의미가 없다. 구조화 데이터의 `alternateName`은 로케일과 무관하게 싣는다.
 */
export const SITE_NAME_KO = '시그렌즈';
