import type { SignalType } from '@y0ngha/siglens-core';
import { SIGNAL_HUBS } from '@/entities/signal-history/lib/signalHubs';
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from '@/shared/config/time';
import type { MailAlertFearGreedMarket } from '../model';

/** 구독자당 받을 항목 상한. 저장 상한이지 등급 정책이 아니라서 모든 등급이 같다. */
export const MAIL_ALERT_MAX_TOPICS = 30;

/** 같은 항목을 다시 보내지 않는 기간(알림 날짜 수). 상태형 신호(RSI 구간)가 며칠 안에 에피소드를 다시 여는 일이 잦다. */
export const MAIL_ALERT_SUPPRESS_DAYS = 7;

/** 발송 기록 보존 기간(일). 개인정보처리방침의 보존 문구와 같은 값이어야 한다. */
export const MAIL_ALERT_DELIVERY_RETENTION_DAYS = 90;

/** 한국 시간 발송 시각: 첫 슬롯(7시)과 마지막 재시도 슬롯(8시). 미국 마감 기록(06:15~06:45 KST) 뒤, 한국 장 시작 전이다. */
export const MAIL_ALERT_SEND_HOURS_KST = [7, 8] as const;

/** 한 통에 싣는 "담은 종목" 신호 수 상한. 메일이 길어져 잘리는 것을 막는다. */
export const MAIL_ALERT_MAX_SIGNAL_ITEMS = 20;

/** 신호별 새 종목 섹션 하나에 싣는 줄 수 상한. 넘치면 "외 N종목"으로 줄인다. */
export const MAIL_ALERT_MAX_HUB_ROWS = 10;

/** 게스트 브라우저 쿠키 수명(초). 같은 브라우저에서 코드를 다시 묻지 않는 기간이다. 구독 PR(app-B)의 액션이 쓴다. */
export const MAIL_ALERT_COOKIE_MAX_AGE_SECONDS = 180 * SECONDS_PER_DAY;

/** 남용 방지 한도. 키에는 해시만 담긴다. 구독 PR(app-B)의 액션이 쓴다. */
export const MAIL_ALERT_RATE_LIMITS = {
    /** 주소(해시)당 코드 요청. */
    codePerEmail: { limit: 3, windowSeconds: SECONDS_PER_HOUR },
    /** IP(해시)당 코드 요청. */
    codePerIp: { limit: 10, windowSeconds: SECONDS_PER_HOUR },
    /** 주소(해시)당 틀린 코드 입력. 넘으면 대기 중인 코드를 지운다. */
    wrongCodePerEmail: { limit: 5, windowSeconds: 30 * 60 },
    /** IP(해시)당 항목 추가. */
    topicAddPerIp: { limit: 30, windowSeconds: SECONDS_PER_HOUR },
} as const;

/** 알림을 보내는 신호 유형 — 신호별 종목 페이지가 여는 유형과 같은 목록 하나만 쓴다. */
export const MAIL_ALERT_SIGNAL_TYPES: readonly SignalType[] = SIGNAL_HUBS.map(
    hub => hub.signalType
);

/** 구독할 수 있는 공포·탐욕 시장. */
export const MAIL_ALERT_FEAR_GREED_MARKETS: readonly MailAlertFearGreedMarket[] =
    ['us', 'kr', 'crypto'];

/**
 * 공개 전 스위치. 정책 문서 시드와 마이그레이션 적용이 끝나기 전에는 화면에 노출하지도, 수집하지도
 * 않도록 모든 진입점이 이 값을 먼저 본다. 공개 PR이 true로 바꾼다.
 */
export const MAIL_ALERT_LAUNCHED = false;

export function isMailAlertLaunched(): boolean {
    return MAIL_ALERT_LAUNCHED;
}
