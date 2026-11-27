import { SIGNAL_SETTLE_MINUTES } from '@/entities/signal-history/lib/signalEventRows';
import { MS_PER_MINUTE } from '@/shared/config/time';
import {
    isPriceAlertLive,
    priceAlertAsOf,
    priceAlertExpiresOn,
    priceAlertStartsAfterSession,
} from '../priceAlertExpiry';

/** 2026-11-24(화) 미국 정규장 마감: 16:00 ET = 21:00Z(표준시). */
const US_CLOSE = Date.parse('2026-11-24T21:00:00Z');
/** 같은 날 한국 정규장 마감: 15:30 KST = 06:30Z. */
const KR_CLOSE = Date.parse('2026-11-24T06:30:00Z');

describe('priceAlertAsOf', () => {
    it('미국은 마감에 정착 시간이 지나야 그 세션으로 넘어간다', () => {
        const settled = US_CLOSE + SIGNAL_SETTLE_MINUTES.us * MS_PER_MINUTE;

        expect(priceAlertAsOf(new Date(settled - MS_PER_MINUTE)).us).toBe(
            '2026-11-23'
        );
        expect(priceAlertAsOf(new Date(settled)).us).toBe('2026-11-24');
    });

    it('한국도 마감에 한국 정착 시간이 지나야 그 세션으로 넘어간다', () => {
        const settled = KR_CLOSE + SIGNAL_SETTLE_MINUTES.kr * MS_PER_MINUTE;

        expect(priceAlertAsOf(new Date(settled - MS_PER_MINUTE)).kr).toBe(
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

describe('priceAlertStartsAfterSession', () => {
    it('미국장 개장 중이면 직전 거래일이다', () => {
        // 2026-11-25(수) 10:00 ET
        expect(
            priceAlertStartsAfterSession('us', new Date('2026-11-25T15:00:00Z'))
        ).toBe('2026-11-24');
    });

    it('마감 직후에도 방금 마감한 세션이 이미 지난 세션이다(발행 버퍼 0)', () => {
        // 2026-11-25(수) 16:05 ET — 마감 5분 뒤. 기본 4시간 버퍼를 두면 11-24로 읽혀 그 종가가 알림 뒤 종가가 된다.
        expect(
            priceAlertStartsAfterSession('us', new Date('2026-11-25T21:05:00Z'))
        ).toBe('2026-11-25');
    });

    it('주말은 금요일 세션이다', () => {
        // 2026-11-28(토) 12:00 ET
        expect(
            priceAlertStartsAfterSession('us', new Date('2026-11-28T17:00:00Z'))
        ).toBe('2026-11-27');
    });

    it('한국장은 한국 달력으로 센다(마감 15:30 KST)', () => {
        // 2026-11-25(수) 16:00 KST
        expect(
            priceAlertStartsAfterSession('kr', new Date('2026-11-25T07:00:00Z'))
        ).toBe('2026-11-25');
        // 같은 날 14:00 KST — 아직 장중
        expect(
            priceAlertStartsAfterSession('kr', new Date('2026-11-25T05:00:00Z'))
        ).toBe('2026-11-24');
    });
});

describe('priceAlertExpiresOn', () => {
    it('만든 날로부터 30일 뒤 시각의 알림 실행이 마지막으로 판정하는 마감 세션이다', () => {
        // 2026-11-25 + 30일 = 2026-12-25(금, 크리스마스 휴장) 10:00 ET → 직전 거래일 12-24
        expect(
            priceAlertExpiresOn('us', new Date('2026-11-25T15:00:00Z'))
        ).toBe('2026-12-24');
    });

    it('30일 뒤가 평범한 거래일이면 그날 마감 전이라 그 전 거래일이다', () => {
        // 2026-10-14 + 30일 = 2026-11-13(금) 10:00 ET → 마감 전이라 11-12
        expect(
            priceAlertExpiresOn('us', new Date('2026-10-14T14:00:00Z'))
        ).toBe('2026-11-12');
    });

    it('마감 + 정착 시간(미국 15분) 뒤의 시각이면 그날 세션이다', () => {
        // 만든 시각 + 30일 = 2026-11-13 21:20Z = 16:20 EST(마감 + 20분)
        expect(
            priceAlertExpiresOn('us', new Date('2026-10-14T21:20:00Z'))
        ).toBe('2026-11-13');
        // 같은 날 21:10Z = 16:10 EST(마감 + 10분, 정착 15분 전)이면 아직 전 거래일
        expect(
            priceAlertExpiresOn('us', new Date('2026-10-14T21:10:00Z'))
        ).toBe('2026-11-12');
    });

    it('한국장은 한국 휴장일을 건너뛴다', () => {
        // 2026-09-05 + 30일 = 2026-10-05(월, 개천절 대체공휴일) 09:00 KST → 직전 거래일 10-02(금)
        expect(
            priceAlertExpiresOn('kr', new Date('2026-09-05T00:00:00Z'))
        ).toBe('2026-10-02');
    });

    it('만든 시각과 상관없이 시작 세션보다 뒤다', () => {
        const now = new Date('2026-11-25T15:00:00Z');

        expect(
            priceAlertExpiresOn('us', now) >
                priceAlertStartsAfterSession('us', now)
        ).toBe(true);
        expect(
            priceAlertExpiresOn('kr', now) >
                priceAlertStartsAfterSession('kr', now)
        ).toBe(true);
    });
});
