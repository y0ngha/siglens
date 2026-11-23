import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from '@/shared/config/time';
import { isMailAlertLaunched } from './mailAlertConstants';

/** 구독자당 살아 있는 가격대 알림 상한. 저장·남용 상한이지 등급 정책이 아니라서 모든 등급이 같다. */
export const PRICE_ALERT_MAX_ACTIVE = 10;

/** 알림 유효 기간(일). 카드·설정 화면·개인정보처리방침의 "30일"과 같은 값이다. */
export const PRICE_ALERT_TTL_DAYS = 30;

/** 알린 뒤 설정 화면 기록으로 남기는 기간(일). 개인정보처리방침의 보존 문구와 같은 값이어야 한다. */
export const PRICE_ALERT_FIRED_RETENTION_DAYS = 30;

/** 서명된 제안 토큰의 수명(초). 이 안에 만들기 버튼을 눌러야 한다. */
export const PRICE_ALERT_PROPOSAL_TTL_SECONDS = SECONDS_PER_DAY;

/** 남용 방지 한도. 키에는 IP 해시만 담긴다. */
export const PRICE_ALERT_RATE_LIMIT = {
    /** IP(해시)당 알림 만들기. */
    createPerIp: { limit: 20, windowSeconds: SECONDS_PER_HOUR },
} as const;

/** 직접 말한 가격이 시세의 ×0.5~×2 밖이면 오타·오해로 보고 거절한다. */
export const PRICE_ALERT_LEVEL_BAND = { min: 0.5, max: 2 } as const;

/** 공개 전 스위치. 알림 메일 공개가 먼저여야 하므로 공개 판정은 `isPriceAlertLaunched()`로 한다. */
export const PRICE_ALERT_LAUNCHED = false;

export function isPriceAlertLaunched(): boolean {
    return PRICE_ALERT_LAUNCHED && isMailAlertLaunched();
}
