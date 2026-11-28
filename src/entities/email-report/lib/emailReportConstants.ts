import type { Tier } from '@y0ngha/siglens-core';
import { MS_PER_HOUR, MS_PER_MINUTE } from '@/shared/config/time';
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

/**
 * 가입 첫 리포트의 대상 기간이자 재시도 기간 — 동의한 지 이 시간이 지나면 더 보내지 않는다.
 *
 * Resend 멱등 키는 첫 요청을 받은 때부터 24시간 유효하고, 첫 발송은 동의 뒤에만 나가므로 이 창이
 * 24시간을 넘지 않으면 모든 재시도가 같은 키로 한 번만 나간다. 그런데 동의 시각은 DB의 `now()`가,
 * 선점 창은 앱 시계(`claimDue(now)`)가, 키 만료는 Resend 시계가 정한다. 세 시계가 어긋난 채 첫 발송이
 * 동의 직후에 나가면 24시간 창의 끝자락 재시도가 만료된 키로 나가 메일이 두 통 갈 수 있다. 그래서 키
 * 유효 기간보다 1시간 짧게 둔다(시계 오차보다 넉넉하고, 매시 cron 한 회차만큼 덜 시도할 뿐이다).
 */
export const WELCOME_WINDOW_MS = 23 * MS_PER_HOUR;
/** 가입 첫 리포트를 시도하는 최대 횟수(첫 시도 포함). 계속 실패하는 주소로 매시 보내지 않는다. */
export const WELCOME_MAX_ATTEMPTS = 3;
/** `sending`인 채 이만큼 지난 행은 cron이 중간에 죽은 것으로 보고 실패처럼 다시 시도한다. */
export const WELCOME_STALE_SENDING_MS = 30 * MS_PER_MINUTE;
/** 첫 리포트를 이 시간 안에 받은 회원은 그날 정기 회차를 건너뛴다 — 같은 내용이 몇 시간 간격으로 두 번 가지 않게. */
export const WELCOME_SUPPRESSES_REPORT_MS = 12 * MS_PER_HOUR;

/** 메일 리포트 대상 등급(가입 회원 이상, 무료 회원 포함). `api.ts`의 발송 대상 필터와 가입 화면의 혜택 목록이 같은 값을 쓴다. */
export const EMAIL_REPORT_TIERS = [
    'member',
    'pro',
] as const satisfies readonly Tier[];
