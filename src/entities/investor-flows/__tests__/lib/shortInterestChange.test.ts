import { describe, expect, it } from 'vitest';
import { computePreviousSettlementChange } from '../../lib/shortInterestChange';

const point = (settlementDate: string, shortQty: number) => ({
    settlementDate,
    shortQty,
});

describe('computePreviousSettlementChange', () => {
    it('최신 결제일을 직전 결제일과 비교해 주식 수와 %를 낸다', () => {
        expect(
            computePreviousSettlementChange([
                point('2026-08-31', 100),
                point('2026-09-15', 125),
            ])
        ).toEqual({ previousDate: '2026-08-31', sharesChange: 25, pct: 25 });
    });

    it('입력 순서와 무관하게 날짜 기준으로 최신·직전을 고른다', () => {
        expect(
            computePreviousSettlementChange([
                point('2026-09-15', 80),
                point('2026-07-31', 500),
                point('2026-08-31', 100),
            ])
        ).toEqual({ previousDate: '2026-08-31', sharesChange: -20, pct: -20 });
    });

    it('감소는 음수 주식 수·음수 %다', () => {
        const change = computePreviousSettlementChange([
            point('2026-08-31', 200),
            point('2026-09-15', 150),
        ]);
        expect(change?.sharesChange).toBe(-50);
        expect(change?.pct).toBe(-25);
    });

    it('직전 잔고가 0이면 %는 null이고 주식 수는 낸다', () => {
        expect(
            computePreviousSettlementChange([
                point('2026-08-31', 0),
                point('2026-09-15', 10),
            ])
        ).toEqual({ previousDate: '2026-08-31', sharesChange: 10, pct: null });
    });

    it('결제일이 하나뿐이거나 비어 있으면 null이다', () => {
        expect(
            computePreviousSettlementChange([point('2026-09-15', 1)])
        ).toBeNull();
        expect(computePreviousSettlementChange([])).toBeNull();
    });
});
