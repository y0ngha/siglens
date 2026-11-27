import { describe, expect, it } from 'vitest';
import {
    makeEmptySnapshot,
    makeSnapshot,
} from '@/entities/investor-flows/__tests__/fixtures/flowsFixtures';
import type { InvestorFlowsPipelineReadiness } from '@/entities/investor-flows/model';
import { resolveFlowsCollecting } from '../../utils/collecting';

const READY: InvestorFlowsPipelineReadiness = {
    institutional: 'ready',
    short: 'ready',
    failsToDeliver: 'ready',
    filings: 'ready',
    thresholdList: 'ready',
    dart: 'ready',
};

describe('resolveFlowsCollecting', () => {
    it('준비가 끝났으면 어느 구간도 수집 중이 아니다', () => {
        const arms = resolveFlowsCollecting({
            readiness: READY,
            snapshot: makeEmptySnapshot(),
            finraEnabled: true,
            regShoEnabled: true,
        });
        expect(Object.values(arms).every(value => value === false)).toBe(true);
    });

    it('수집 중인 구간만 참이고, FINRA 플래그가 꺼지면 공매도는 수집 중으로 말하지 않는다', () => {
        const readiness = {
            ...READY,
            institutional: 'collecting',
            short: 'collecting',
        } as const;
        const snapshot = makeSnapshot({
            shortInterest: null,
            shortVolume: null,
        });
        const on = resolveFlowsCollecting({
            readiness,
            snapshot,
            finraEnabled: true,
            regShoEnabled: true,
        });
        const off = resolveFlowsCollecting({
            readiness,
            snapshot,
            finraEnabled: false,
            regShoEnabled: true,
        });
        expect(on.institutional).toBe(true);
        expect(on.short).toBe(true);
        expect(off.short).toBe(false);
    });
});
