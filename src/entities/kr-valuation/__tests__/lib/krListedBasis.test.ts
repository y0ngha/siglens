import { describe, expect, it } from 'vitest';
import { krListedBasis } from '@/entities/kr-valuation/lib/krListedBasis';

// 삼성중공업 010140: yahoo 시총 14.375조(≈8.54억 주), KRX 상장주식수 8.8억 주, 종가 16,830원.
const SAMSUNG_HEAVY = {
    providerMarketCap: 14_375_000_000_000,
    providerEvToEbitda: 9,
    listedShares: 880_000_000,
    lastClose: { close: 16_830, date: '2026-10-23' },
};

describe('krListedBasis', () => {
    it('상장주식수 × 종가로 시총을 다시 계산하고 EV/EBITDA는 비운다', () => {
        const r = krListedBasis(SAMSUNG_HEAVY);
        expect(r.marketCap).toBe(14_810_400_000_000);
        // EV는 순부채를 포함해 시총만 바꿔 고칠 수 없다.
        expect(r.evToEbitda).toBeNull();
        expect(r.sharesBasis).toBe('krx_listed');
        expect(r.sharesOutstanding).toBe(880_000_000);
        expect(r.marketCapCloseDate).toBe('2026-10-23');
    });

    it('PER·PBR·PSR 비율은 이 모듈의 입력도 출력도 아니다(시총 비율로 다시 곱하지 않는다)', () => {
        const r = krListedBasis(SAMSUNG_HEAVY);
        expect(Object.keys(r).sort()).toEqual([
            'evToEbitda',
            'marketCap',
            'marketCapCloseDate',
            'sharesBasis',
            'sharesOutstanding',
        ]);
    });

    it.each([
        ['상장주식수 null', { listedShares: null }],
        ['상장주식수 0', { listedShares: 0 }],
        ['종가 없음', { lastClose: null }],
        ['종가 0', { lastClose: { close: 0, date: '2026-10-23' } }],
    ])('%s이면 프로바이더 값을 그대로 두고 provider로 표시한다', (_, patch) => {
        const r = krListedBasis({ ...SAMSUNG_HEAVY, ...patch });
        expect(r).toEqual({
            marketCap: 14_375_000_000_000,
            evToEbitda: 9,
            sharesBasis: 'provider',
            sharesOutstanding: null,
            marketCapCloseDate: null,
        });
    });
});
