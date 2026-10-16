/**
 * OpenDART 응답이 쓰는 한국어 **값 토큰** — 화면 문구가 아니라 원천 값과 맞대는 데이터다(개발가이드 2019021 `report_tp`,
 * 2019022 `isu_exctv_rgist_at`, 2026-10-16 확인). 번역하면 매칭이 깨지므로 i18n 추출 대상에서 뺀다
 * (`scripts/i18n/lib/scan.mjs`의 제외 규칙).
 */

/** 대량보유 보고구분(`report_tp`) — 일반 보고. */
export const DART_REPORT_TYPE_DETAILED = '일반';
/** 대량보유 보고구분(`report_tp`) — 약식 보고(단순투자·전문투자자). */
export const DART_REPORT_TYPE_ABBREVIATED = '약식';

/** 등기 여부(`isu_exctv_rgist_at`)의 등기 표기(`등기임원`). */
export const DART_REGISTERED_TOKEN = '등기';
/** 등기 여부의 부정 표기(`비등기임원`·`미등기임원`) — 둘 다 `등기`를 품으므로 먼저 본다. */
export const DART_UNREGISTERED_TOKENS: readonly string[] = ['비등기', '미등기'];
