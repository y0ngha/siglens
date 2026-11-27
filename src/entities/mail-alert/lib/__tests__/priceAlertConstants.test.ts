import { SECONDS_PER_HOUR } from '@/shared/config/time';
import {
    PRICE_ALERT_FIRED_RETENTION_DAYS,
    PRICE_ALERT_LAUNCHED,
    PRICE_ALERT_LEVEL_BAND,
    PRICE_ALERT_MAX_ACTIVE,
    PRICE_ALERT_PROPOSAL_TTL_SECONDS,
    PRICE_ALERT_RATE_LIMIT,
    PRICE_ALERT_SCALE_GUARD,
    PRICE_ALERT_TTL_DAYS,
    isPriceAlertLaunched,
} from '../priceAlertConstants';

describe('priceAlertConstants', () => {
    it('살아 있는 알림 상한은 10개다', () => {
        expect(PRICE_ALERT_MAX_ACTIVE).toBe(10);
    });

    it('유효 기간과 알린 뒤 보존 기간은 30일이다(개인정보처리방침 문구와 같은 값)', () => {
        expect(PRICE_ALERT_TTL_DAYS).toBe(30);
        expect(PRICE_ALERT_FIRED_RETENTION_DAYS).toBe(30);
    });

    it('제안 토큰 수명은 24시간이다', () => {
        expect(PRICE_ALERT_PROPOSAL_TTL_SECONDS / SECONDS_PER_HOUR).toBe(24);
    });

    it('만들기 한도는 IP당 시간당 20회다', () => {
        expect(PRICE_ALERT_RATE_LIMIT.createPerIp).toEqual({
            limit: 20,
            windowSeconds: SECONDS_PER_HOUR,
        });
    });

    it('직접 말한 가격은 시세의 0.5배에서 2배까지 받는다', () => {
        expect(PRICE_ALERT_LEVEL_BAND).toEqual({ min: 0.5, max: 2 });
    });

    it('분할 가드는 처음 판정하는 종가가 만들 때 가격의 0.6배에서 1/0.6배(1.67)까지만 받는다', () => {
        expect(PRICE_ALERT_SCALE_GUARD).toEqual({ min: 0.6, max: 1.67 });
        expect(PRICE_ALERT_SCALE_GUARD.max).toBeCloseTo(
            1 / PRICE_ALERT_SCALE_GUARD.min,
            1
        );
    });

    it('공개 전에는 꺼져 있다', () => {
        expect(PRICE_ALERT_LAUNCHED).toBe(false);
        expect(isPriceAlertLaunched()).toBe(false);
    });
});
