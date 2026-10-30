import { describe, expect, it } from 'vitest';
import type { InvestorFlowsSignal } from '@y0ngha/siglens-core';
import { isMeasuredNoChange } from '../../../utils/axis-evidence/measuredNoChange';

function signal(direction: InvestorFlowsSignal['direction']) {
    return { direction } as InvestorFlowsSignal;
}

describe('isMeasuredNoChange', () => {
    it('신호가 하나도 없으면 참이다', () => {
        expect(isMeasuredNoChange([])).toBe(true);
    });

    it('모두 중립이면 참이다', () => {
        expect(isMeasuredNoChange([signal('neutral'), signal('neutral')])).toBe(
            true
        );
    });

    it('방향 신호가 하나라도 있으면 거짓이다', () => {
        expect(isMeasuredNoChange([signal('neutral'), signal('bullish')])).toBe(
            false
        );
    });
});
