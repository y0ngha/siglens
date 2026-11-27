import { SIGNAL_SETTLE_MINUTES } from '@/entities/signal-history/lib/signalEventRows';
import { isPriceAlertLive, priceAlertAsOf } from '../priceAlertExpiry';

const MINUTE_MS = 60_000;

/** 2026-11-24(화) 미국 정규장 마감: 16:00 ET = 21:00Z(표준시). */
const US_CLOSE = Date.parse('2026-11-24T21:00:00Z');
/** 같은 날 한국 정규장 마감: 15:30 KST = 06:30Z. */
const KR_CLOSE = Date.parse('2026-11-24T06:30:00Z');

describe('priceAlertAsOf', () => {
    it('미국은 마감에 정착 시간이 지나야 그 세션으로 넘어간다', () => {
        const settled = US_CLOSE + SIGNAL_SETTLE_MINUTES.us * MINUTE_MS;

        expect(priceAlertAsOf(new Date(settled - MINUTE_MS)).us).toBe(
            '2026-11-23'
        );
        expect(priceAlertAsOf(new Date(settled)).us).toBe('2026-11-24');
    });

    it('한국도 마감에 한국 정착 시간이 지나야 그 세션으로 넘어간다', () => {
        const settled = KR_CLOSE + SIGNAL_SETTLE_MINUTES.kr * MINUTE_MS;

        expect(priceAlertAsOf(new Date(settled - MINUTE_MS)).kr).toBe(
            '2026-11-23'
        );
        expect(priceAlertAsOf(new Date(settled)).kr).toBe('2026-11-24');
    });
});

describe('isPriceAlertLive', () => {
    /** 한국 시간 아침 7시 알림 실행. */
    const kstSeven = (kstDate: string) =>
        priceAlertAsOf(new Date(`${kstDate}T07:00:00+09:00`));

    it('미국: 만료 세션 D는 한국 시간 D+1 07:00 실행이 판정하고, 그다음 실행에는 없다', () => {
        const alert = { market: 'us', expiresOn: '2026-11-24' } as const;

        expect(isPriceAlertLive(alert, kstSeven('2026-11-24'))).toBe(true);
        expect(isPriceAlertLive(alert, kstSeven('2026-11-25'))).toBe(true);
        expect(isPriceAlertLive(alert, kstSeven('2026-11-26'))).toBe(false);
    });

    it('한국: 만료 세션 D는 한국 시간 D+1 07:00 실행이 판정하고, 그다음 실행에는 없다', () => {
        const alert = { market: 'kr', expiresOn: '2026-11-24' } as const;

        expect(isPriceAlertLive(alert, kstSeven('2026-11-25'))).toBe(true);
        expect(isPriceAlertLive(alert, kstSeven('2026-11-26'))).toBe(false);
    });

    it('시장마다 자기 기대 세션과 견준다(같은 만료일이어도 시장이 다르면 다르게 끝날 수 있다)', () => {
        // 미국 마감 정착 전, 한국 마감 정착 후: 미국 기대 세션은 11-23, 한국은 11-24.
        const asOf = priceAlertAsOf(new Date('2026-11-24T21:05:00Z'));

        expect(asOf).toEqual({ us: '2026-11-23', kr: '2026-11-24' });
        expect(
            isPriceAlertLive({ market: 'us', expiresOn: '2026-11-23' }, asOf)
        ).toBe(true);
        expect(
            isPriceAlertLive({ market: 'kr', expiresOn: '2026-11-23' }, asOf)
        ).toBe(false);
    });
});
