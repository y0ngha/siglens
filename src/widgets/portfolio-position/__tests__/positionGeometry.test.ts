import { describe, expect, it } from 'vitest';
import { computePosition, type PositionInputs } from '../lib/positionGeometry';

// 기본 유효 입력 — 각 테스트는 필요한 필드만 override 한다.
function inputs(partial: Partial<PositionInputs> = {}): PositionInputs {
    return { low52w: 100, high52w: 200, current: 180, avg: 150, ...partial };
}

describe('computePosition', () => {
    it('정상 범위 내 avg/current → avgPos·pctFromHigh·returnPct 계산', () => {
        const model = computePosition(inputs());
        expect(model).not.toBeNull();
        expect(model!.avgPos).toBeCloseTo(0.5); // (150-100)/(200-100)
        expect(model!.currentPos).toBeCloseTo(0.8); // (180-100)/100
        expect(model!.avgClamped).toBeNull();
        expect(model!.currentClamped).toBeNull();
        expect(model!.pctFromHigh).toBeCloseTo(-25); // (150-200)/200*100
        expect(model!.pctAboveLow).toBeCloseTo(50); // (150-100)/100*100
        expect(model!.returnPct).toBeCloseTo(20); // (180-150)/150*100
        expect(model!.rangePositionPct).toBeCloseTo(50);
    });

    it('avg가 high52w보다 높으면 avgPos=1, avgClamped=above', () => {
        const model = computePosition(inputs({ avg: 250 }));
        expect(model).not.toBeNull();
        expect(model!.avgPos).toBe(1);
        expect(model!.avgClamped).toBe('above');
        expect(model!.pctFromHigh).toBeCloseTo(25); // (250-200)/200*100
    });

    it('avg가 low52w보다 낮으면 avgPos=0, avgClamped=below', () => {
        const model = computePosition(inputs({ avg: 50 }));
        expect(model).not.toBeNull();
        expect(model!.avgPos).toBe(0);
        expect(model!.avgClamped).toBe('below');
        expect(model!.pctFromHigh).toBeCloseTo(-75); // (50-200)/200*100
    });

    it('current가 high52w보다 높으면 currentPos=1, currentClamped=above', () => {
        const model = computePosition(inputs({ current: 250 }));
        expect(model).not.toBeNull();
        expect(model!.currentPos).toBe(1);
        expect(model!.currentClamped).toBe('above');
    });

    it('current가 low52w보다 낮으면 currentPos=0, currentClamped=below', () => {
        const model = computePosition(inputs({ current: 50 }));
        expect(model).not.toBeNull();
        expect(model!.currentPos).toBe(0);
        expect(model!.currentClamped).toBe('below');
    });

    it('current < avg(손실 포지션) → returnPct는 음수 부호·크기가 정확하다', () => {
        // avg=180, current=150 → returnPct=(150-180)/180*100 ≈ -16.666...
        const model = computePosition(inputs({ avg: 180, current: 150 }));
        expect(model).not.toBeNull();
        expect(model!.returnPct).toBeLessThan(0);
        expect(model!.returnPct).toBeCloseTo(-16.6667, 4);
    });

    it('degenerate range(high===low) → null', () => {
        expect(
            computePosition(inputs({ low52w: 100, high52w: 100 }))
        ).toBeNull();
    });

    it('degenerate range(high<low) → null', () => {
        expect(
            computePosition(inputs({ low52w: 200, high52w: 100 }))
        ).toBeNull();
    });

    it('low52w=0이어도 pctAboveLow=0으로 가드되고 NaN/Infinity 없이 모델 반환', () => {
        const model = computePosition(
            inputs({ low52w: 0, high52w: 100, avg: 50, current: 60 })
        );
        expect(model).not.toBeNull();
        expect(model!.pctAboveLow).toBe(0);
        expect(Number.isFinite(model!.pctAboveLow)).toBe(true);
        expect(Number.isNaN(model!.pctAboveLow)).toBe(false);
        expect(model!.avgPos).toBeCloseTo(0.5); // (50-0)/(100-0)
        expect(model!.pctFromHigh).toBeCloseTo(-50); // (50-100)/100*100
    });

    it('avg=0 → null', () => {
        expect(computePosition(inputs({ avg: 0 }))).toBeNull();
    });

    it('avg=NaN → null', () => {
        expect(computePosition(inputs({ avg: NaN }))).toBeNull();
    });

    it("avg=Number('') (=0) → null", () => {
        expect(computePosition(inputs({ avg: Number('') }))).toBeNull();
    });

    it('current<=0 → null', () => {
        expect(computePosition(inputs({ current: 0 }))).toBeNull();
        expect(computePosition(inputs({ current: -10 }))).toBeNull();
    });

    it('current가 non-finite면 null', () => {
        expect(computePosition(inputs({ current: Infinity }))).toBeNull();
        expect(computePosition(inputs({ current: NaN }))).toBeNull();
    });

    it('low52w/high52w가 non-finite면 null', () => {
        expect(computePosition(inputs({ low52w: NaN }))).toBeNull();
        expect(computePosition(inputs({ high52w: Infinity }))).toBeNull();
    });

    it('bands는 20% 단위 5개 구간을 순서대로 반환한다', () => {
        const model = computePosition(inputs());
        expect(model).not.toBeNull();
        expect(model!.bands).toEqual([
            { fromPct: 0, toPct: 20 },
            { fromPct: 20, toPct: 40 },
            { fromPct: 40, toPct: 60 },
            { fromPct: 60, toPct: 80 },
            { fromPct: 80, toPct: 100 },
        ]);
    });

    it('avgPos===0.2 경계는 inclusive-low/exclusive-high로 2번째 밴드에 결정적으로 속한다', () => {
        // low=0, high=100, avg=20 → avgPos = 20/100 = 0.2 (정확히), rangePositionPct = 20.
        const model = computePosition(
            inputs({ low52w: 0, high52w: 100, avg: 20, current: 50 })
        );
        expect(model).not.toBeNull();
        expect(model!.rangePositionPct).toBe(20);

        const bandIndex = model!.bands.findIndex(
            b =>
                model!.rangePositionPct >= b.fromPct &&
                model!.rangePositionPct < b.toPct
        );
        expect(bandIndex).toBe(1); // 두 번째 밴드 [20,40) — 첫 밴드 [0,20)의 배타적 상한
    });
});
