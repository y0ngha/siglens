import { describe, expect, it } from 'vitest';
import { krListedBasis } from '@/app/api/ai/chat/tools/krListedBasis';

// 삼성중공업 010140: yahoo 시총 14.375조(≈8.54억 주), KRX 상장주식수 8.8억 주, 종가 16,830원.
const SAMSUNG_HEAVY = {
    providerMarketCap: 14_375_000_000_000,
    providerPe: 20,
    providerPb: 4,
    providerPs: 1,
    providerEvToEbitda: 9,
    listedShares: 880_000_000,
    lastClose: { close: 16_830, date: '2026-10-23' },
};

describe('krListedBasis', () => {
    it('상장주식수 × 종가로 시총을 다시 계산하고 PER·PBR을 같은 비율로 맞춘다', () => {
        const r = krListedBasis(SAMSUNG_HEAVY);
        expect(r.marketCap).toBe(14_810_400_000_000);
        const scale = 14_810_400_000_000 / 14_375_000_000_000;
        expect(r.pe).toBeCloseTo(20 * scale, 10);
        expect(r.pb).toBeCloseTo(4 * scale, 10);
        expect(r.ps).toBeCloseTo(1 * scale, 10);
        // EV는 순부채를 포함해 시총만 바꿔 고칠 수 없다.
        expect(r.evToEbitda).toBeNull();
        expect(r.sharesBasis).toBe('krx_listed');
        expect(r.sharesOutstanding).toBe(880_000_000);
        expect(r.marketCapCloseDate).toBe('2026-10-23');
    });

    it('PER·PBR이 null이면 null로 둔다 (적자 등)', () => {
        const r = krListedBasis({
            ...SAMSUNG_HEAVY,
            providerPe: null,
            providerPb: null,
            providerPs: null,
        });
        expect(r.pe).toBeNull();
        expect(r.pb).toBeNull();
        expect(r.ps).toBeNull();
        expect(r.sharesBasis).toBe('krx_listed');
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
            pe: 20,
            pb: 4,
            ps: 1,
            evToEbitda: 9,
            sharesBasis: 'provider',
            sharesOutstanding: null,
            marketCapCloseDate: null,
        });
    });

    it('프로바이더 시총이 0이면 PER·PBR은 비율을 못 구해 그대로 둔다', () => {
        const r = krListedBasis({
            ...SAMSUNG_HEAVY,
            providerMarketCap: 0,
            providerPe: null,
            providerPb: null,
        });
        expect(r.marketCap).toBe(14_810_400_000_000);
        expect(r.pe).toBeNull();
        expect(r.pb).toBeNull();
    });
});
