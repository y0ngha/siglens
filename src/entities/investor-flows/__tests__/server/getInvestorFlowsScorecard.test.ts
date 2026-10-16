import { beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateInvestorFlows } from '@y0ngha/siglens-core';
import { getInvestorFlowsScorecard } from '../../server/getInvestorFlowsScorecard';
import { getOverallInvestorFlowsScorecard } from '../../server/getOverallInvestorFlowsScorecard';

vi.mock('server-only', () => ({}));

const { mockResilient, mockFinra, mockReadiness } = vi.hoisted(() => ({
    mockResilient: vi.fn(),
    mockFinra: vi.fn(() => true),
    mockReadiness: vi.fn(),
}));
vi.mock('../../server/getInvestorFlowsPipelineReadiness', () => ({
    getInvestorFlowsPipelineReadiness: mockReadiness,
}));
vi.mock('../../server/getInvestorFlowsResilient', () => ({
    getInvestorFlowsResilient: mockResilient,
}));
vi.mock('@/shared/api/finra/finraShortDataEnabled', () => ({
    isFinraShortDataEnabled: mockFinra,
}));

const READY = { institutional: 'ready', short: 'ready' } as const;
const COLLECTING = {
    institutional: 'collecting',
    short: 'collecting',
} as const;

const SNAPSHOT = {
    asOf: '2026-10-16T00:00:00.000Z',
    sharesOutstanding: 1e9,
    floatShares: 9e8,
    institutional: { quarters: [], topHolders: [], topHoldersPeriod: null },
    insider: { transactions: [] },
    largeHolders: [],
    shortInterest: [
        {
            settlementDate: '2026-09-15',
            shortQty: 4e7,
            avgDailyVolume: 1e6,
            daysToCover: 40,
        },
    ],
    shortVolume: [],
};

describe('getInvestorFlowsScorecard', () => {
    beforeEach(() => {
        mockResilient.mockReset();
        mockReadiness.mockReset();
        mockReadiness.mockResolvedValue(READY);
        mockFinra.mockReturnValue(true);
    });

    it('스냅샷이 있으면 core evaluateInvestorFlows 결과를 그대로 돌려준다', async () => {
        mockResilient.mockResolvedValue({
            snapshot: SNAPSHOT,
            degraded: false,
        });
        const result = await getInvestorFlowsScorecard('AAPL');
        expect(result.scorecard).toEqual(
            evaluateInvestorFlows(SNAPSHOT as never, { includeFinraData: true })
        );
        expect(result).toMatchObject({ degraded: false, finraEnabled: true });
    });

    it('FINRA 플래그가 꺼져 있으면 includeFinraData: false로 점수를 낸다(옛 캐시 스냅샷이 섞이지 않는다)', async () => {
        mockFinra.mockReturnValue(false);
        mockResilient.mockResolvedValue({
            snapshot: SNAPSHOT,
            degraded: false,
        });
        const result = await getInvestorFlowsScorecard('AAPL');
        expect(result.finraEnabled).toBe(false);
        expect(result.scorecard?.short.sufficiency).toBe('insufficient');
    });

    it('데이터 없음(null)은 scorecard도 null, degraded는 false다', async () => {
        mockResilient.mockResolvedValue({ snapshot: null, degraded: false });
        expect(await getInvestorFlowsScorecard('ZZZZ')).toMatchObject({
            snapshot: null,
            scorecard: null,
            degraded: false,
        });
    });

    it('인프라 장애는 degraded: true로 전달한다', async () => {
        mockResilient.mockResolvedValue({ snapshot: null, degraded: true });
        expect(await getInvestorFlowsScorecard('AAPL')).toMatchObject({
            scorecard: null,
            degraded: true,
        });
    });

    it('파이프라인 준비 상태를 그대로 실어 보낸다(수집 중이어도 점수표·스냅샷은 그대로)', async () => {
        mockResilient.mockResolvedValue({
            snapshot: SNAPSHOT,
            degraded: false,
        });
        mockReadiness.mockResolvedValue(COLLECTING);
        const result = await getInvestorFlowsScorecard('AAPL');
        expect(result.readiness).toEqual(COLLECTING);
        expect(result.snapshot).toBe(SNAPSHOT);
        expect(result.scorecard).toEqual(
            evaluateInvestorFlows(SNAPSHOT as never, { includeFinraData: true })
        );
    });
});

describe('getOverallInvestorFlowsScorecard', () => {
    beforeEach(() => {
        mockResilient.mockReset();
        mockReadiness.mockReset();
        mockReadiness.mockResolvedValue(READY);
        mockFinra.mockReturnValue(true);
    });

    it.each(['kr-equity', 'crypto'] as const)(
        '%s는 조회도 하지 않고 undefined다(종합에 넣지 않음 — 캐시 키 불변)',
        async profile => {
            expect(
                await getOverallInvestorFlowsScorecard('X', profile)
            ).toBeUndefined();
            expect(mockResilient).not.toHaveBeenCalled();
        }
    );

    it('미국 주식 + 점수표는 그대로 돌려준다', async () => {
        mockResilient.mockResolvedValue({
            snapshot: SNAPSHOT,
            degraded: false,
        });
        const result = await getOverallInvestorFlowsScorecard(
            'AAPL',
            'us-equity'
        );
        expect(result?.composite).toBeDefined();
    });

    it('미국 주식 + 데이터 없음은 null이다(프롬프트가 "데이터 없음"을 명시)', async () => {
        mockResilient.mockResolvedValue({ snapshot: null, degraded: false });
        expect(
            await getOverallInvestorFlowsScorecard('ZZZZ', 'us-equity')
        ).toBeNull();
    });

    it('인프라 장애는 undefined다(장애가 "데이터 없음"으로 캐시에 굳지 않는다)', async () => {
        mockResilient.mockResolvedValue({ snapshot: null, degraded: true });
        expect(
            await getOverallInvestorFlowsScorecard('AAPL', 'us-equity')
        ).toBeUndefined();
    });

    it('13F 수집 중에는 스냅샷이 없어도 null이 아니라 undefined다("아직 못 모음"이 "데이터 없음"으로 캐시에 굳지 않는다)', async () => {
        mockResilient.mockResolvedValue({ snapshot: null, degraded: false });
        mockReadiness.mockResolvedValue(COLLECTING);
        expect(
            await getOverallInvestorFlowsScorecard('ZZZZ', 'us-equity')
        ).toBeUndefined();
    });

    it('준비 상태를 못 읽거나(unknown) 공매도만 수집 중이면 예전처럼 null이다', async () => {
        mockResilient.mockResolvedValue({ snapshot: null, degraded: false });
        mockReadiness.mockResolvedValue({
            institutional: 'unknown',
            short: 'unknown',
        });
        expect(
            await getOverallInvestorFlowsScorecard('ZZZZ', 'us-equity')
        ).toBeNull();
        mockReadiness.mockResolvedValue({
            institutional: 'ready',
            short: 'collecting',
        });
        expect(
            await getOverallInvestorFlowsScorecard('ZZZZ', 'us-equity')
        ).toBeNull();
    });

    it('13F 수집 중이어도 스냅샷이 있으면 점수표를 그대로 돌려준다', async () => {
        mockResilient.mockResolvedValue({
            snapshot: SNAPSHOT,
            degraded: false,
        });
        mockReadiness.mockResolvedValue(COLLECTING);
        const result = await getOverallInvestorFlowsScorecard(
            'AAPL',
            'us-equity'
        );
        expect(result?.composite).toBeDefined();
    });

    it('예외가 나도 던지지 않고 undefined다', async () => {
        const warn = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
        mockResilient.mockRejectedValue(new Error('boom'));
        expect(
            await getOverallInvestorFlowsScorecard('AAPL', 'us-equity')
        ).toBeUndefined();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});
