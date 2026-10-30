import { describe, expect, it } from 'vitest';
import { buildShortInterestChartModel } from '../../utils/shortInterestChart';
import type { ShortInterestRow } from '../../utils/short';

function row(
    settlementDate: string,
    overrides: Partial<ShortInterestRow> = {}
): ShortInterestRow {
    return {
        settlementDate,
        shortQty: 1_000,
        pctOfFloat: 2,
        daysToCover: 1.5,
        ...overrides,
    };
}

describe('buildShortInterestChartModel', () => {
    it('결제일이 하나뿐이면 그래프를 그리지 않는다', () => {
        expect(buildShortInterestChartModel([row('2026-09-15')])).toBeNull();
    });

    it('최신 행에 유통주식 대비 %가 있으면 %로 그리고 두 그래프의 양끝 라벨이 MM-DD다', () => {
        const model = buildShortInterestChartModel([
            row('2026-08-15', { pctOfFloat: 1.5, daysToCover: 1 }),
            row('2026-09-15', { pctOfFloat: 2.5, daysToCover: 3 }),
        ]);
        expect(model?.basis).toBe('pctFloat');
        expect(model?.interest).toMatchObject({ max: 2.5, min: 1.5 });
        expect(model?.daysToCover).toMatchObject({ max: 3, min: 1 });
        expect(model?.startLabel).toBe('08-15');
        expect(model?.endLabel).toBe('09-15');
    });

    it('유통주식 수를 모르면 주식 수로 그린다', () => {
        const model = buildShortInterestChartModel([
            row('2026-08-15', { pctOfFloat: null, shortQty: 100 }),
            row('2026-09-15', { pctOfFloat: null, shortQty: 300 }),
        ]);
        expect(model?.basis).toBe('qty');
        expect(model?.interest).toMatchObject({ max: 300, min: 100 });
    });

    it('상환일수가 전부 없으면 그 그래프는 없다', () => {
        const model = buildShortInterestChartModel([
            row('2026-08-15', { daysToCover: null }),
            row('2026-09-15', { daysToCover: null }),
        ]);
        expect(model?.daysToCover).toBeNull();
    });
});
