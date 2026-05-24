import type { OptionsChain, OptionsSnapshot } from '@y0ngha/siglens-core';
import { pickActiveChain } from '@/entities/options-chain/lib/pickActiveChain';

function makeChain(expirationDate: string): OptionsChain {
    return {
        expirationDate,
        daysToExpiration: 7,
        calls: [],
        puts: [],
    };
}

function makeSnapshot(
    chains: ReadonlyArray<OptionsChain>,
    underlyingPrice = 100
): OptionsSnapshot {
    return {
        symbol: 'AAPL',
        underlyingPrice,
        chains,
        capturedAt: '2026-05-17T16:00:00Z',
    };
}

describe('pickActiveChain', () => {
    it('chains가 비어있으면 null을 반환한다', () => {
        const snapshot = makeSnapshot([]);
        expect(pickActiveChain(snapshot, 'all')).toBeNull();
        expect(pickActiveChain(snapshot, '2026-06-20')).toBeNull();
    });

    it('expirationDate가 "all"이면 가장 가까운 만기(첫 번째)를 반환한다', () => {
        const nearest = makeChain('2026-06-20');
        const later = makeChain('2026-07-18');
        const snapshot = makeSnapshot([nearest, later]);
        expect(pickActiveChain(snapshot, 'all')).toBe(nearest);
    });

    it('expirationDate가 정확히 일치하는 chain을 반환한다', () => {
        const a = makeChain('2026-06-20');
        const b = makeChain('2026-07-18');
        const c = makeChain('2026-08-15');
        const snapshot = makeSnapshot([a, b, c]);
        expect(pickActiveChain(snapshot, '2026-07-18')).toBe(b);
    });

    it('expirationDate가 일치하지 않으면 가장 가까운 만기로 폴백한다', () => {
        const a = makeChain('2026-06-20');
        const b = makeChain('2026-07-18');
        const snapshot = makeSnapshot([a, b]);
        expect(pickActiveChain(snapshot, '2099-12-31')).toBe(a);
    });
});
