import { beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateInvestorFlows } from '@y0ngha/siglens-core';
import { investorFlowsCachedProvider } from '../../server/getInvestorFlowsCachedProvider';
import { FakeInvestorFlowsDataProvider } from '../../server/FakeInvestorFlowsDataProvider';

vi.mock('server-only', () => ({}));

const { mockSnapshot } = vi.hoisted(() => ({ mockSnapshot: vi.fn() }));
vi.mock('../../server/getInvestorFlowsSnapshot', () => ({
    getInvestorFlowsSnapshot: mockSnapshot,
}));

describe('investorFlowsCachedProvider', () => {
    beforeEach(() => mockSnapshot.mockReset());

    it('페이지와 같은 캐시 스냅샷 로더에 위임한다', async () => {
        mockSnapshot.mockResolvedValue({ asOf: 'x' });
        expect(
            await investorFlowsCachedProvider.getInvestorFlowsSnapshot('AAPL')
        ).toEqual({ asOf: 'x' });
        expect(mockSnapshot).toHaveBeenCalledWith('AAPL');
    });
});

describe('FakeInvestorFlowsDataProvider', () => {
    it('EMPTYX는 null이다(빈 상태 UI)', async () => {
        expect(
            await new FakeInvestorFlowsDataProvider(
                () => true
            ).getInvestorFlowsSnapshot('emptyx')
        ).toBeNull();
    });

    it('FINRA 켜짐이면 공매도 필드가 있고, 꺼지면 null이다(진짜 구현과 같은 규칙)', async () => {
        const on = await new FakeInvestorFlowsDataProvider(
            () => true
        ).getInvestorFlowsSnapshot('AAPL');
        const off = await new FakeInvestorFlowsDataProvider(
            () => false
        ).getInvestorFlowsSnapshot('AAPL');
        expect(on?.shortInterest?.length).toBeGreaterThan(0);
        expect(on?.shortVolume?.length).toBeGreaterThan(60);
        expect(off?.shortInterest).toBeNull();
        expect(off?.shortVolume).toBeNull();
    });

    it('기본 종목은 완결 분기 IN, 진행 분기 1개, 클러스터 매수, 숏 비중 급증을 만든다', async () => {
        const snapshot = (await new FakeInvestorFlowsDataProvider(
            () => true
        ).getInvestorFlowsSnapshot('AAPL'))!;
        const card = evaluateInvestorFlows(snapshot, {
            includeFinraData: true,
        });
        expect(
            snapshot.institutional.quarters.filter(q => !q.complete)
        ).toHaveLength(1);
        expect(snapshot.institutional.quarters.at(-1)?.complete).toBe(false);
        expect(card.insider.metrics?.clusterBuy).toBe(true);
        expect(card.short.metrics.squeezeRisk).toBe(false);
        expect(card.institutional.sufficiency).toBe('sufficient');
    });

    it('SQUEEZX는 숏스퀴즈 위험이 켜진다', async () => {
        const snapshot = (await new FakeInvestorFlowsDataProvider(
            () => true
        ).getInvestorFlowsSnapshot('SQUEEZX'))!;
        expect(
            evaluateInvestorFlows(snapshot, { includeFinraData: true }).short
                .metrics.squeezeRisk
        ).toBe(true);
    });
});
