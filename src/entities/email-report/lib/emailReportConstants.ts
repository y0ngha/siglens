import type { Weekday } from '../model';

/** 리포트 한 통에 싣는 최대 종목 수(전체 카드). 보유·관심종목 합집합의 앞부분. */
export const EMAIL_REPORT_MAX_SYMBOLS = 5;

/** 전체 카드 뒤에 "그 외 관심종목" 요약 표로 싣는 최대 종목 수. */
export const EMAIL_REPORT_MAX_BRIEF_SYMBOLS = 15;

/** 저장된 설정이 없을 때의 기본값 — 주 1회 월요일 아침. */
export const DEFAULT_EMAIL_REPORT_DAYS: readonly Weekday[] = [1];
export const DEFAULT_EMAIL_REPORT_HOUR = 8;
export const DEFAULT_EMAIL_REPORT_TIMEZONE = 'Asia/Seoul';

/** 화면 표시 순서 — 월요일 시작. */
export const WEEKDAYS_MONDAY_FIRST: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 0];
