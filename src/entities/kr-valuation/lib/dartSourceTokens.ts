/**
 * OpenDART `stockTotqySttus`(주식의 총수 현황) 응답이 쓰는 한국어 **구분 값** — 화면 문구가 아니라 원천 행의 `se` 값과 맞대는
 * 데이터다(2026-11-22 실응답 확인: 보통주·우선주·합계·비고, 일부 회사는 `보통주식`·`종류주식`). 번역하면 매칭이 깨지므로 i18n
 * 추출 대상에서 뺀다(`scripts/i18n/lib/scan.mjs`의 제외 규칙).
 */

/** 보통주 + 우선주를 합친 줄. */
export const DART_SHARE_TOTAL_ROW = '합계';
/**
 * 주식 종류별 줄의 구분 값. 공백·줄바꿈을 모두 뺀 형태로 적고(`normalizeShareRowLabel`), 비교도 같은 정규화를 거친다 — 회사마다
 * `의결권 있는\n보통주`처럼 줄바꿈이 끼거나 `의결권 있는 주식`처럼 띄어 쓰는 방식이 다르다(2026 실응답 54개 회사 실측).
 */
export const DART_SHARE_COMMON_ROWS: readonly string[] = [
    '보통주',
    '보통주식',
    '의결권있는주식',
    '의결권있는보통주',
    '의결권있는주식(보통주)',
    '의결권이있는주식(보통주)',
];
export const DART_SHARE_PREFERRED_ROWS: readonly string[] = [
    '우선주',
    '종류주',
    '종류주식',
    '의결권없는주식',
    '의결권없는우선주',
    '의결권없는주식(우선주)',
    '의결권이없는주식(우선주)',
    '무의결권전환주',
];
/** 주식 종류별 줄 전체(보통주 + 우선주). */
export const DART_SHARE_KIND_ROWS: readonly string[] = [
    ...DART_SHARE_COMMON_ROWS,
    ...DART_SHARE_PREFERRED_ROWS,
];

export const normalizeShareRowLabel = (label: string): string =>
    label.replace(/\s+/g, '');
