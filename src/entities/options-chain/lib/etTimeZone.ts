/**
 * 미국 증시·옵션 만기의 기준 타임존. 만기 날짜(`expirationDate`)와 DTE 계산, 개장·마감 판정이
 * 모두 이 하나를 쓴다 — 파일마다 문자열을 따로 두면 한쪽만 바뀌어 날짜 경계가 어긋난다.
 */
export const ET_TIME_ZONE = 'America/New_York';
