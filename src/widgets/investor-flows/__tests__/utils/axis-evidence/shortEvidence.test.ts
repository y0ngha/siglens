import { describe, expect, it } from 'vitest';
import { buildAxisEvidence } from '../../../utils/axisEvidence';
import {
    evaluate,
    makeFailsToDeliver,
    makeSnapshot,
} from '../../fixtures/flowsFixtures';

describe('공매도 근거 줄의 결제 불이행 %', () => {
    it('대형주의 아주 작은 값은 0.00%가 아니라 네 자리로 보인다(결제 불이행 블록과 같은 규칙)', () => {
        const scorecard = evaluate(
            makeSnapshot({
                sharesOutstanding: 150_000_000_000,
                failsToDeliver: makeFailsToDeliver(),
            })
        );
        const pct = scorecard.short.metrics.failsToDeliverPctOutstanding;
        expect(pct).not.toBeNull();
        expect(pct!).toBeGreaterThan(0);
        expect(pct!).toBeLessThan(0.005);
        const line = buildAxisEvidence(scorecard, 'short', 'en').find(
            l => l.id === 'ftdPct'
        );
        expect(line?.values.pct).toBe('0.0028%');
    });
});
