import { US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import {
    continuationFloor,
    recordableSessionDate,
    SIGNAL_SETTLE_MINUTES,
} from '../signalEventRows';

const SETTLE = 15;

describe('recordableSessionDate — 미국(ET)', () => {
    // 2026-11-13(금)은 표준시라 마감 16:00 ET = 21:00 UTC.
    it('마감 + 정착 시간 뒤, 같은 ET 날짜면 그 세션을 낸다', () => {
        expect(
            recordableSessionDate(
                US_EQUITY_SESSION,
                new Date('2026-11-13T21:20:00Z'),
                SETTLE
            )
        ).toBe('2026-11-13');
    });

    it('장중(프리웜 첫 창 20:30 UTC = 15:30 ET)은 받지 않는다', () => {
        expect(
            recordableSessionDate(
                US_EQUITY_SESSION,
                new Date('2026-11-13T20:30:00Z'),
                SETTLE
            )
        ).toBeNull();
    });

    it('마감 직후 정착 시간 안은 받지 않는다', () => {
        expect(
            recordableSessionDate(
                US_EQUITY_SESSION,
                new Date('2026-11-13T21:05:00Z'),
                SETTLE
            )
        ).toBeNull();
    });

    it('ET 자정을 넘긴 시각(다음 날)은 받지 않는다', () => {
        expect(
            recordableSessionDate(
                US_EQUITY_SESSION,
                new Date('2026-11-14T05:10:00Z'),
                SETTLE
            )
        ).toBeNull();
    });

    it('주말에는 받지 않는다(마지막 세션은 금요일이다)', () => {
        expect(
            recordableSessionDate(
                US_EQUITY_SESSION,
                new Date('2026-11-14T22:00:00Z'),
                SETTLE
            )
        ).toBeNull();
    });
});

describe('recordableSessionDate — 한국(KST)', () => {
    // KRX 마감 15:30 KST = 06:30 UTC. 시세 지연 20분 + 정착 15분 = 35분.
    it('마감 + 35분 뒤면 그날 세션이다', () => {
        expect(
            recordableSessionDate(
                KR_EQUITY_SESSION,
                new Date('2026-11-13T07:10:00Z'),
                35
            )
        ).toBe('2026-11-13');
    });

    it('마감 + 35분 전(지연 시세가 마감가를 아직 못 실었을 수 있다)은 받지 않는다', () => {
        expect(
            recordableSessionDate(
                KR_EQUITY_SESSION,
                new Date('2026-11-13T06:55:00Z'),
                35
            )
        ).toBeNull();
    });

    it('정규장 중(05:00 UTC = 14:00 KST)은 받지 않는다', () => {
        expect(
            recordableSessionDate(
                KR_EQUITY_SESSION,
                new Date('2026-11-13T05:00:00Z'),
                35
            )
        ).toBeNull();
    });
});

describe('recordableSessionDate — 24시간 시장', () => {
    it('always-open은 마감이 없어 받지 않는다', () => {
        expect(
            recordableSessionDate(
                { kind: 'always-open' },
                new Date('2026-11-13T21:20:00Z'),
                SETTLE
            )
        ).toBeNull();
    });
});

describe('continuationFloor', () => {
    it('직전 거래 세션이다 — 월요일의 직전은 금요일', () => {
        expect(continuationFloor(US_EQUITY_SESSION, '2026-11-16')).toBe(
            '2026-11-13'
        );
    });
});

describe('SIGNAL_SETTLE_MINUTES', () => {
    it('미국은 15분, 한국은 시세 지연을 더해 35분이다', () => {
        expect(SIGNAL_SETTLE_MINUTES).toEqual({ us: 15, kr: 35 });
    });
});
