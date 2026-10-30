import type { Weekday } from '../model';

/** 리포트 한 통에 싣는 최대 종목 수(전체 카드). 보유·관심종목 합집합의 앞부분. */
export const EMAIL_REPORT_MAX_SYMBOLS = 5;

/** 전체 카드 뒤에 "그 외 관심종목" 요약 표로 싣는 최대 종목 수. */
export const EMAIL_REPORT_MAX_BRIEF_SYMBOLS = 15;

/** 한 회원이 리포트에서 뺄 수 있는 최대 종목 수 — 표가 무한히 자라지 않게 한다. */
export const EMAIL_REPORT_MAX_EXCLUDED_SYMBOLS = 200;

/** 저장된 설정이 없을 때의 기본 요일 — 주 1회 월요일. */
export const DEFAULT_EMAIL_REPORT_DAYS: readonly Weekday[] = [1];
/** 저장된 설정이 없을 때의 기본 발송 시(회원 로컬) — 아침. */
export const DEFAULT_EMAIL_REPORT_HOUR = 8;
/** 기본 타임존 — 화면은 저장 전에 브라우저 값으로 바꿔 보여 준다. */
export const DEFAULT_EMAIL_REPORT_TIMEZONE = 'Asia/Seoul';

/** 화면 표시 순서 — 월요일 시작. */
export const WEEKDAYS_MONDAY_FIRST: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 0];
