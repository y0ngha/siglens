vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
    headers: vi.fn(() => Promise.resolve(new Headers())),
}));
vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    runFundamentalAnalysis: vi.fn(),
}));
vi.mock('@/entities/auth/server/getCurrentUser', () => ({
    getCurrentUser: vi.fn(async () => null),
}));
vi.mock('@/shared/lib/byokGate', () => ({
    resolveTierAndByok: vi.fn(async () => ({
        kind: 'allowed',
        tier: 'free',
    })),
    resolveReasoning: vi.fn(() => false),
    buildGateError: vi.fn(),
}));
vi.mock('@/entities/ticker/server/getAssetInfo', () => ({
    getAssetInfo: vi.fn(async () => null),
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: vi.fn(async () => 'us-equity'),
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({
        getQuote: vi.fn(async () => ({ price: 150 })),
    }),
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: vi.fn(),
}));

// 이 테스트의 관찰 대상은 실제 `withKrValuation`이므로 그 아래 말단(제공처·DART 입력·종가)만 바꾼다.
const mocks = vi.hoisted(() => ({
    getFundamentalDataProvider: vi.fn(),
    getKrValuationInputs: vi.fn(),
}));
vi.mock('@/shared/api/fmp/getFundamentalDataProvider', () => ({
    getFundamentalDataProvider: mocks.getFundamentalDataProvider,
}));
vi.mock('@/entities/kr-valuation/server/getKrValuationInputs', () => ({
    getKrValuationInputs: mocks.getKrValuationInputs,
}));
vi.mock('@/entities/kr-valuation/server/loadKrLastClose', () => ({
    loadKrLastClose: vi.fn(async () => ({
        close: 41_400,
        date: '2026-11-20',
    })),
}));

import {
    runFundamentalAnalysis,
    type FundamentalDataProvider,
    type ModelId,
} from '@y0ngha/siglens-core';
import { beforeEach, describe, expect, it } from 'vitest';
import {
    extractShareTotals,
    extractStatementFigures,
} from '@/entities/kr-valuation/lib/dartAmounts';
import samsungCardAnnual from '@/entities/kr-valuation/__tests__/fixtures/samsungcard-2025-annual-cfs.json';
import samsungCardH1 from '@/entities/kr-valuation/__tests__/fixtures/samsungcard-2026-h1-cfs.json';
import samsungCardH1Shares from '@/entities/kr-valuation/__tests__/fixtures/samsungcard-2026-h1-stock-totals.json';
import { runFundamentalAnalysisAction } from '../actions/runFundamentalAnalysisAction';

const mockRun = vi.mocked(runFundamentalAnalysis);
const captured: { dataProvider?: FundamentalDataProvider } = {};

describe('runFundamentalAnalysisAction의 한국 peer PER', () => {
    beforeEach(() => {
        mockRun.mockReset();
        captured.dataProvider = undefined;
        mockRun.mockImplementation(async input => {
            captured.dataProvider = input.dataProvider;
            return { status: 'cached', result: {} as never };
        });
        mocks.getKrValuationInputs.mockResolvedValue({
            kind: 'ok',
            data: {
                current: extractStatementFigures(samsungCardH1.list, {
                    year: 2026,
                    reportCode: '11012',
                    fsDiv: 'CFS',
                }),
                priorAnnual: extractStatementFigures(samsungCardAnnual.list, {
                    year: 2025,
                    reportCode: '11011',
                    fsDiv: 'CFS',
                }),
                shares: extractShareTotals(samsungCardH1Shares.list),
            },
        });
    });

    it('미국 종목 분석 입력의 peer 중 한국 종목 per는 DART 기준으로 core에 넘어간다', async () => {
        mocks.getFundamentalDataProvider.mockReturnValue({
            getStockPeers: async () => [
                {
                    symbol: '029780.KS',
                    companyName: 'Samsung Card',
                    marketCap: 5_000_000,
                    per: 31.4,
                    psr: 2.2,
                },
                {
                    symbol: 'MSFT',
                    companyName: 'Microsoft',
                    marketCap: 3_000_000,
                    per: 28.1,
                    psr: 11.3,
                },
            ],
        });

        await runFundamentalAnalysisAction('AAPL', 'm' as ModelId, 'ko');

        const peers = await captured.dataProvider?.getStockPeers('AAPL');
        const kr = peers?.find(p => p.symbol === '029780.KS');
        const us = peers?.find(p => p.symbol === 'MSFT');
        expect(kr?.per).toBeCloseTo(7.7268, 3);
        expect(kr?.psr).toBe(2.2);
        expect(us?.per).toBe(28.1);
    });
});
