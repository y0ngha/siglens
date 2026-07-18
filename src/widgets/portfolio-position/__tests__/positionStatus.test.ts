import { describe, expect, it } from 'vitest';
import {
    buildPositionStatusAriaLabel,
    computePositionStatus,
    type PositionStatus,
    type PositionStatusInputs,
} from '../lib/positionStatus';

// 기본 유효 입력 — 각 테스트는 필요한 필드만 override 한다.
function inputs(
    partial: Partial<PositionStatusInputs> = {}
): PositionStatusInputs {
    return {
        low52w: 100,
        high52w: 200,
        current: 180,
        avg: 150,
        quantity: 10,
        ...partial,
    };
}

describe('computePositionStatus', () => {
    it('정상 입력 → unrealizedPnl·returnPct·rangePositionPct·distanceToHigh/LowPct 계산', () => {
        const status = computePositionStatus(inputs());
        expect(status).not.toBeNull();
        // (180-150)*10 = 300
        expect(status!.unrealizedPnl).toBeCloseTo(300);
        // computePosition과 동일 산식: (180-150)/150*100
        expect(status!.returnPct).toBeCloseTo(20);
        expect(status!.rangePositionPct).toBeCloseTo(80); // (180-100)/100
        // (200-180)/180*100
        expect(status!.distanceToHighPct).toBeCloseTo(11.111111, 5);
        // (100-180)/180*100
        expect(status!.distanceToLowPct).toBeCloseTo(-44.444444, 5);
        expect(status!.avg).toBe(150);
        expect(status!.quantity).toBe(10);
    });

    it('current < avg(손실 포지션) → unrealizedPnl·returnPct 모두 음수', () => {
        const status = computePositionStatus(
            inputs({ avg: 180, current: 150, quantity: 5 })
        );
        expect(status).not.toBeNull();
        // (150-180)*5 = -150
        expect(status!.unrealizedPnl).toBeCloseTo(-150);
        expect(status!.returnPct).toBeLessThan(0);
    });

    it('distanceToHighPct는 항상 >= 0(high52w는 current를 포함하는 봉 range의 최댓값), distanceToLowPct는 항상 <= 0', () => {
        const status = computePositionStatus(inputs({ current: 100 }));
        expect(status).not.toBeNull();
        expect(status!.distanceToHighPct).toBeGreaterThanOrEqual(0);
        expect(status!.distanceToLowPct).toBeLessThanOrEqual(0);
    });

    it('quantity가 0이면 null', () => {
        expect(computePositionStatus(inputs({ quantity: 0 }))).toBeNull();
    });

    it('quantity가 음수면 null', () => {
        expect(computePositionStatus(inputs({ quantity: -1 }))).toBeNull();
    });

    it('quantity가 비유한값(NaN/Infinity)이면 null', () => {
        expect(computePositionStatus(inputs({ quantity: NaN }))).toBeNull();
        expect(
            computePositionStatus(inputs({ quantity: Infinity }))
        ).toBeNull();
    });

    it('computePosition이 null을 반환하는 degenerate 입력(avg<=0)은 null을 전파한다', () => {
        expect(computePositionStatus(inputs({ avg: 0 }))).toBeNull();
    });

    it('computePosition이 null을 반환하는 degenerate 입력(high52w<=low52w)은 null을 전파한다', () => {
        expect(
            computePositionStatus(inputs({ low52w: 200, high52w: 100 }))
        ).toBeNull();
    });

    it('current가 비유한값이면 null을 전파한다', () => {
        expect(computePositionStatus(inputs({ current: NaN }))).toBeNull();
    });
});

describe('buildPositionStatusAriaLabel', () => {
    it('평단·수량 표시 문자열과 계산된 손익/수익률/범위/거리를 모두 포함한다', () => {
        const status = computePositionStatus(inputs()) as PositionStatus;
        const label = buildPositionStatusAriaLabel(status, '$150', '10주');

        expect(label).toContain('평단 $150');
        expect(label).toContain('수량 10주');
        expect(label).toContain('평가손익 +$300.00');
        expect(label).toContain('수익률 +20.0%');
        expect(label).toContain('최근 범위의 80% 지점');
        expect(label).toContain('최근 고점까지 +11.1%');
        expect(label).toContain('최근 저점까지 -44.4%');
    });
});
