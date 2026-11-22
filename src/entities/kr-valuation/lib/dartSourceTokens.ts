/**
 * OpenDART `stockTotqySttus`(주식의 총수 현황) 응답이 쓰는 한국어 **구분 값** — 화면 문구가 아니라 원천 행의 `se` 값과 맞대는
 * 데이터다(2026-11-22 실응답 확인: 보통주·우선주·합계·비고, 일부 회사는 `보통주식`·`종류주식`). 번역하면 매칭이 깨지므로 i18n
 * 추출 대상에서 뺀다(`scripts/i18n/lib/scan.mjs`의 제외 규칙).
 */

/** 보통주 + 우선주를 합친 줄. */
export const DART_SHARE_TOTAL_ROW = '합계';
/** 주식 종류별 줄. */
export const DART_SHARE_KIND_ROWS: readonly string[] = ['보통주', '우선주'];
