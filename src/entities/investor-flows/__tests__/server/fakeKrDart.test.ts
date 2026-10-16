import { describe, expect, it } from 'vitest';
import { evaluateInvestorFlows } from '@y0ngha/siglens-core';
import {
    buildFakeKrSnapshot,
    resolveFakeDartCorp,
} from '../../server/fakeKrDart';
import { FakeInvestorFlowsDataProvider } from '../../server/FakeInvestorFlowsDataProvider';

const NOW = new Date('2026-10-16T01:00:00Z');

describe('resolveFakeDartCorp', () => {
    it('maps a common share to itself', () => {
        expect(resolveFakeDartCorp('005930.KS', NOW)).toEqual({
            corpCode: '00126380',
            corpName: '삼성전자',
            matchedStockCode: '005930',
            viaCommonShare: false,
        });
    });

    it('maps a preferred share to the common share of the same company', () => {
        expect(resolveFakeDartCorp('005935.KS', NOW)).toMatchObject({
            corpCode: '00126380',
            viaCommonShare: true,
        });
    });

    it('is null for a company the fake DART does not know', () => {
        expect(resolveFakeDartCorp('999990.KS', NOW)).toBeNull();
    });
});

describe('buildFakeKrSnapshot', () => {
    it('runs the fake DART rows through the collector parsers into a scored kr snapshot', () => {
        const snapshot = buildFakeKrSnapshot('005930.KS', NOW);
        expect(snapshot?.market).toBe('kr');
        expect(snapshot?.kr?.majorHolders.map(r => r.reporter)).toEqual([
            '국민연금공단',
            '픽스처자산운용',
        ]);
        // 쉼표 문자열 수량이 숫자로 읽힌다(수집기 파서를 거친다).
        expect(snapshot?.kr?.majorHolders[0]?.sharesChange).toBe(-5_120_000);
        expect(snapshot?.kr?.insiders).toHaveLength(2);
        expect(snapshot?.kr?.tradingPlans).toHaveLength(1);
        const scorecard = evaluateInvestorFlows(snapshot!);
        expect(scorecard.largeHolders.sufficiency).toBe('sufficient');
        expect(scorecard.insider.sufficiency).toBe('sufficient');
    });

    it('is null for an unmapped company', () => {
        expect(buildFakeKrSnapshot('999990.KS', NOW)).toBeNull();
    });
});

describe('FakeInvestorFlowsDataProvider — Korean listings', () => {
    it('returns the fake DART snapshot for a Korean symbol', async () => {
        const provider = new FakeInvestorFlowsDataProvider(() => true);
        expect(
            (await provider.getInvestorFlowsSnapshot('005930.KS'))?.market
        ).toBe('kr');
    });

    it('returns null while collecting (the DART tables are still empty)', async () => {
        const provider = new FakeInvestorFlowsDataProvider(() => true, true);
        expect(await provider.getInvestorFlowsSnapshot('005930.KS')).toBeNull();
    });
});
