import { SIGNAL_HUBS } from '@/entities/signal-history/lib/signalHubs';
import {
    MAIL_ALERT_CHANGE_REFERENCE_MAX_AGE_DAYS,
    MAIL_ALERT_CHANGE_SIGNAL_TYPES,
    MAIL_ALERT_COOKIE_MAX_AGE_SECONDS,
    MAIL_ALERT_FEAR_GREED_MARKETS,
    MAIL_ALERT_LAUNCHED,
    MAIL_ALERT_MAX_CHANGES_PER_SYMBOL,
    MAIL_ALERT_MAX_TOPICS,
    MAIL_ALERT_RATE_LIMITS,
    MAIL_ALERT_SEND_HOURS_KST,
    MAIL_ALERT_SIGNAL_TYPES,
    isMailAlertLaunched,
} from '../mailAlertConstants';

describe('mailAlertConstants', () => {
    it('알림 신호 유형은 신호별 페이지가 여는 유형과 같은 목록이다', () => {
        expect([...MAIL_ALERT_SIGNAL_TYPES]).toEqual(
            SIGNAL_HUBS.map(hub => hub.signalType)
        );
        expect(MAIL_ALERT_SIGNAL_TYPES).toHaveLength(8);
    });

    it('달라진 점의 신호 유형은 허브 유형에서 MACD 교차 둘만 뺀 여섯 개다', () => {
        expect([...MAIL_ALERT_CHANGE_SIGNAL_TYPES]).toEqual(
            MAIL_ALERT_SIGNAL_TYPES.filter(
                type =>
                    type !== 'macd_bullish_cross' &&
                    type !== 'macd_bearish_cross'
            )
        );
        expect(MAIL_ALERT_CHANGE_SIGNAL_TYPES).toHaveLength(6);
    });

    it('종목당 달라진 점은 세 줄, 분석은 30일 안의 것만 쓴다', () => {
        expect(MAIL_ALERT_MAX_CHANGES_PER_SYMBOL).toBe(3);
        expect(MAIL_ALERT_CHANGE_REFERENCE_MAX_AGE_DAYS).toBe(30);
    });

    it('공포·탐욕 시장은 미국, 한국, 크립토다', () => {
        expect([...MAIL_ALERT_FEAR_GREED_MARKETS]).toEqual([
            'us',
            'kr',
            'crypto',
        ]);
    });

    it('항목 상한은 30개다', () => {
        expect(MAIL_ALERT_MAX_TOPICS).toBe(30);
    });

    it('발송 시각은 첫 슬롯 7시, 마지막 슬롯 8시(KST)다', () => {
        expect([...MAIL_ALERT_SEND_HOURS_KST]).toEqual([7, 8]);
    });

    it('쿠키 수명은 180일이다', () => {
        expect(MAIL_ALERT_COOKIE_MAX_AGE_SECONDS / 86_400).toBe(180);
    });

    it('남용 방지 한도는 정해진 값이다', () => {
        expect(MAIL_ALERT_RATE_LIMITS).toEqual({
            codePerEmail: { limit: 3, windowSeconds: 3600 },
            codePerIp: { limit: 10, windowSeconds: 3600 },
            confirmPerIp: { limit: 30, windowSeconds: 1800 },
            wrongCodePerEmail: { limit: 5, windowSeconds: 1800 },
            topicAddPerIp: { limit: 30, windowSeconds: 3600 },
        });
    });

    it('공개 전에는 꺼져 있다', () => {
        expect(MAIL_ALERT_LAUNCHED).toBe(false);
        expect(isMailAlertLaunched()).toBe(false);
    });
});
