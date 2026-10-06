import { describe, expect, it } from 'vitest';
import { CRYPTO_SESSION, US_EQUITY_SESSION } from '@y0ngha/siglens-core';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import { previousSessionDate } from '@/shared/lib/marketSessionDate';

describe('previousSessionDate', () => {
    it('미국 월요일의 직전 거래일은 금요일이다 (주말 되감기)', () => {
        expect(previousSessionDate(US_EQUITY_SESSION, '2026-10-05')).toBe(
            '2026-10-02'
        );
    });

    it('미국 추수감사절(11-26) 다음 날의 직전 거래일은 11-25다 (NYSE 휴장일)', () => {
        expect(previousSessionDate(US_EQUITY_SESSION, '2026-11-27')).toBe(
            '2026-11-25'
        );
    });

    it('한국 10-06의 직전 거래일은 10-02다 (10-05 개천절 대체공휴일 + 주말)', () => {
        expect(previousSessionDate(KR_EQUITY_SESSION, '2026-10-06')).toBe(
            '2026-10-02'
        );
    });

    it('크립토는 전날이다', () => {
        expect(previousSessionDate(CRYPTO_SESSION, '2026-10-05')).toBe(
            '2026-10-04'
        );
    });
});
