import type { ConfirmedSignalType, SignalType } from '@y0ngha/siglens-core';
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

/** 게스트 브라우저 쿠키 수명(초). 같은 브라우저에서 코드를 다시 묻지 않는 기간이다. */
export const MAIL_ALERT_COOKIE_MAX_AGE_SECONDS = 180 * SECONDS_PER_DAY;

/** 남용 방지 한도. 키에는 해시만 담긴다. */
export const MAIL_ALERT_RATE_LIMITS = {
    /** 주소(해시)당 코드 요청. */
    codePerEmail: { limit: 3, windowSeconds: SECONDS_PER_HOUR },
    /** IP(해시)당 코드 요청. */
    codePerIp: { limit: 10, windowSeconds: SECONDS_PER_HOUR },
    /**
     * 주소(해시)당 코드 확인 시도. 시도마다 비교 **전에** 센다 — 동시에 들어온 요청도 한도를 넘어 비교되지
     * 못한다. 넘으면 대기 중인 코드를 지운다. 새 코드를 보내면 이 카운터는 0으로 돌아간다.
     */
    wrongCodePerEmail: { limit: 5, windowSeconds: 30 * 60 },
    /** IP(해시)당 코드 확인 시도. 제3자가 남의 주소 카운터를 계속 채워 두는 것을 막는다. */
    confirmPerIp: { limit: 30, windowSeconds: 30 * 60 },
    /** IP(해시)당 항목 추가. */
    topicAddPerIp: { limit: 30, windowSeconds: SECONDS_PER_HOUR },
} as const;

/** 코드 요청 폼의 봇 함정 입력 이름. 사람 눈에는 보이지 않으며, 채워진 요청은 성공처럼 응답하고 아무것도 보내지 않는다. */
export const MAIL_ALERT_HONEYPOT_FIELD = 'mail_alert_website';

/** 같은 화면에서 코드를 다시 받기까지 기다리는 시간(초). 서버 한도(주소당 시간당 3회)와 별개로 연타를 막는 화면 쿨다운이다. */
export const MAIL_ALERT_RESEND_COOLDOWN_SECONDS = 60;

/** 알림을 보내는 신호 유형 — 신호별 종목 페이지가 여는 유형과 같은 목록 하나만 쓴다. */
export const MAIL_ALERT_SIGNAL_TYPES: readonly SignalType[] = SIGNAL_HUBS.map(
    hub => hub.signalType
);

/**
 * "담은 종목에서 달라진 점"에 싣는 신호 유형. 허브 유형에서 MACD 교차 둘을 뺀 여섯 개다 — 2017~2026 65종목
 * 일봉 재생 측정에서 MACD 교차가 신호 줄의 절반을 넘게 차지해(하루에 한 줄 이상 나올 확률을 크게 올렸다)
 * "달라진 점"이라는 이름에 비해 잦았다. 신호별 종목 페이지(허브)와 그 구독 메일은 여덟 유형 그대로다.
 */
export const MAIL_ALERT_CHANGE_SIGNAL_TYPES: readonly ConfirmedSignalType[] = [
    'golden_cross',
    'death_cross',
    'new_52w_high',
    'new_52w_low',
    'rsi_oversold',
    'rsi_overbought',
];

/** 한 종목이 한 통에 싣는 달라진 점 줄 수 상한(가격 판정, 가격대, 추세, 신호 순으로 채운다). */
export const MAIL_ALERT_MAX_CHANGES_PER_SYMBOL = 3;

/**
 * 가격대·진입 구간을 읽어 올 AI 분석의 최대 나이(일). 더 오래된 분석의 가격대는 지금 기준으로 읽히므로 쓰지
 * 않는다. 줄마다 그 분석의 날짜를 함께 적는다.
 */
export const MAIL_ALERT_CHANGE_REFERENCE_MAX_AGE_DAYS = 30;

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
