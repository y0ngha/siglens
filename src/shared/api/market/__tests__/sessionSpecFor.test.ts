import { describe, it, expect } from 'vitest';
import { sessionSpecFor, KR_EQUITY_SESSION } from '../sessionSpecFor';
import { US_EQUITY_SESSION, CRYPTO_SESSION } from '@y0ngha/siglens-core';

describe('sessionSpecFor', () => {
    it('maps crypto → always-open session', () => {
        expect(sessionSpecFor('crypto')).toBe(CRYPTO_SESSION);
    });
    it('maps us-equity → ET session', () => {
        expect(sessionSpecFor('us-equity')).toBe(US_EQUITY_SESSION);
    });
    it('maps kr-equity → KST session', () => {
        // 참조 동일성 비교 — getCachedMarketDataProvider가 `===`로 provider 싱글톤을
        // 분기하므로, 호출마다 새 객체를 만들면 라우팅이 조용히 깨진다.
        expect(sessionSpecFor('kr-equity')).toBe(KR_EQUITY_SESSION);
    });
});

describe('KR_EQUITY_SESSION', () => {
    it('describes the KRX regular session (09:00–15:30 KST, weekends closed)', () => {
        expect(KR_EQUITY_SESSION).toEqual({
            kind: 'scheduled',
            timeZone: 'Asia/Seoul',
            openMinute: 540,
            closeMinute: 930,
            weekendDays: [0, 6],
        });
    });
});
