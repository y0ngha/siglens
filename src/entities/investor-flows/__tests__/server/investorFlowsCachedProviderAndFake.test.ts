import { beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateInvestorFlows } from '@y0ngha/siglens-core';
import { investorFlowsCachedProvider } from '../../server/getInvestorFlowsCachedProvider';
import { FakeInvestorFlowsDataProvider } from '../../server/FakeInvestorFlowsDataProvider';

vi.mock('server-only', () => ({}));

const { mockSnapshot, mockReadiness } = vi.hoisted(() => ({
    mockSnapshot: vi.fn(),
    mockReadiness: vi.fn(),
}));
vi.mock('../../server/getInvestorFlowsSnapshot', () => ({
    getInvestorFlowsSnapshot: mockSnapshot,
}));
vi.mock('../../server/getInvestorFlowsPipelineReadiness', () => ({
    getInvestorFlowsPipelineReadiness: mockReadiness,
}));

const READY = {
    institutional: 'ready',
    short: 'ready',
    failsToDeliver: 'ready',
    filings: 'ready',
    thresholdList: 'ready',
} as const;

describe('investorFlowsCachedProvider', () => {
    beforeEach(() => {
        mockSnapshot.mockReset();
        mockReadiness.mockReset();
        mockReadiness.mockResolvedValue(READY);
    });

    it('페이지와 같은 캐시 스냅샷 로더에 위임한다', async () => {
        mockSnapshot.mockResolvedValue({ asOf: 'x' });
        expect(
            await investorFlowsCachedProvider.getInvestorFlowsSnapshot('AAPL')
        ).toEqual({ asOf: 'x' });
        expect(mockSnapshot).toHaveBeenCalledWith('AAPL');
    });

    it('스냅샷이 없으면 null을 그대로 돌려준다', async () => {
        mockSnapshot.mockResolvedValue(null);
        expect(
            await investorFlowsCachedProvider.getInvestorFlowsSnapshot('ZZZZ')
        ).toBeNull();
    });

    it('FINRA 수집 중에는 빈 공매도 배열을 null(조회 불가)로 바꿔 AI에 건넨다', async () => {
        mockSnapshot.mockResolvedValue({
            asOf: 'x',
            shortInterest: [],
            shortVolume: [],
        });
        mockReadiness.mockResolvedValue({
            ...READY,
            institutional: 'collecting',
            short: 'collecting',
        });
        expect(
            await investorFlowsCachedProvider.getInvestorFlowsSnapshot('AAPL')
        ).toEqual({ asOf: 'x', shortInterest: null, shortVolume: null });
    });

    it('SEC 공시·FTD 수집 중에는 빈 FTD를 null로, 빈 Form 144·증자 공시는 필드를 빼서 AI에 건넨다', async () => {
        mockSnapshot.mockResolvedValue({
            asOf: 'x',
            shortInterest: [],
            shortVolume: [],
            failsToDeliver: [],
            proposedSales: [],
            offerings: [],
        });
        mockReadiness.mockResolvedValue({
            ...READY,
            failsToDeliver: 'collecting',
            filings: 'collecting',
        });
        expect(
            await investorFlowsCachedProvider.getInvestorFlowsSnapshot('AAPL')
        ).toEqual({
            asOf: 'x',
            shortInterest: [],
            shortVolume: [],
            failsToDeliver: null,
        });
    });

    it('준비 상태를 못 읽으면(unknown) 스냅샷을 건드리지 않는다', async () => {
        const snapshot = { asOf: 'x', shortInterest: [], shortVolume: [] };
        mockSnapshot.mockResolvedValue(snapshot);
        mockReadiness.mockResolvedValue({
            institutional: 'unknown',
            short: 'unknown',
            failsToDeliver: 'unknown',
            filings: 'unknown',
            thresholdList: 'unknown',
        });
        expect(
            await investorFlowsCachedProvider.getInvestorFlowsSnapshot('AAPL')
        ).toBe(snapshot);
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

    it('collecting 모드는 13F·FINRA 행이 비어 있고(진짜 DB가 빈 때와 같다) 내부자·13D/G는 그대로다', async () => {
        const snapshot = (await new FakeInvestorFlowsDataProvider(
            () => true,
            true
        ).getInvestorFlowsSnapshot('AAPL'))!;
        expect(snapshot.institutional).toEqual({
            quarters: [],
            topHolders: [],
            topHoldersPeriod: null,
        });
        expect(snapshot.shortInterest).toEqual([]);
        expect(snapshot.shortVolume).toEqual([]);
        expect(snapshot.failsToDeliver).toEqual([]);
        expect(snapshot.proposedSales).toEqual([]);
        expect(snapshot.offerings).toEqual([]);
        expect(snapshot.thresholdList).toBeNull();
        expect(snapshot.insider.transactions.length).toBeGreaterThan(0);
        expect(snapshot.largeHolders?.length).toBeGreaterThan(0);
        const card = evaluateInvestorFlows(snapshot, {
            includeFinraData: true,
        });
        expect(card.institutional.sufficiency).toBe('insufficient');
        expect(card.short.sufficiency).toBe('insufficient');
        expect(card.insider.sufficiency).toBe('sufficient');
    });

    it('collecting 모드에서도 FINRA가 꺼져 있으면 공매도 필드는 null이다', async () => {
        const snapshot = (await new FakeInvestorFlowsDataProvider(
            () => false,
            true
        ).getInvestorFlowsSnapshot('AAPL'))!;
        expect(snapshot.shortInterest).toBeNull();
        expect(snapshot.shortVolume).toBeNull();
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

    it('기본 종목은 13F 옵션·Form 144(1건 10b5-1)·증자 공시·FTD를 갖고 과열 목록에는 없다', async () => {
        const snapshot = (await new FakeInvestorFlowsDataProvider(
            () => true
        ).getInvestorFlowsSnapshot('AAPL'))!;
        expect(snapshot.institutional.options?.length).toBe(
            snapshot.institutional.quarters.length
        );
        expect(snapshot.proposedSales).toHaveLength(3);
        expect(
            snapshot.proposedSales?.filter(s => s.planAdoptionDate !== null)
        ).toHaveLength(1);
        expect(snapshot.offerings?.map(o => o.kind)).toEqual([
            'atm',
            'shelf',
            'private_placement',
        ]);
        expect(snapshot.failsToDeliver?.length).toBeGreaterThan(0);
        expect(snapshot.thresholdList?.listed).toBe(false);
        const card = evaluateInvestorFlows(snapshot, {
            includeFinraData: true,
        });
        expect(card.dilution.sufficiency).toBe('sufficient');
    });

    it('SQUEEZX는 과열 목록에 15거래일 연속 올라 있다', async () => {
        const snapshot = (await new FakeInvestorFlowsDataProvider(
            () => true
        ).getInvestorFlowsSnapshot('SQUEEZX'))!;
        expect(snapshot.thresholdList).toMatchObject({
            listed: true,
            consecutiveDays: 15,
            markets: ['Nasdaq'],
        });
    });

    it('Reg SHO 플래그가 꺼지면 thresholdList는 null이다(진짜 구현과 같은 규칙)', async () => {
        const snapshot = await new FakeInvestorFlowsDataProvider(
            () => true,
            false,
            () => false
        ).getInvestorFlowsSnapshot('SQUEEZX');
        expect(snapshot?.thresholdList).toBeNull();
    });
});
