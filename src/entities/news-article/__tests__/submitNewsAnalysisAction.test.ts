import type { MockedFunction, MockedClass, Mock } from 'vitest';

vi.mock('next/headers', () => ({
    headers: vi.fn(() => Promise.resolve(new Headers())),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    submitNewsAnalysis: vi.fn(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn().mockReturnValue({ db: {} }),
}));

vi.mock('@/entities/news-article', () => ({
    DrizzleNewsRepository: vi.fn().mockImplementation(function () {
        return {
            listBySymbol: vi.fn(),
        };
    }),
}));

vi.mock('@/entities/earnings-report', () => ({
    getNextEarningsReport: vi.fn(),
}));

vi.mock('@/entities/session/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));

vi.mock('@/shared/lib/byokGate', () => ({
    resolveTierAndByok: vi.fn(),
    buildGateError: vi.fn((code: string) => ({
        code,
        message: `mock-${code}`,
    })),
}));

vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({
    resolveAssetClass: vi.fn().mockResolvedValue('equity'),
}));

import { headers } from 'next/headers';
import { DrizzleNewsRepository } from '@/entities/news-article';
import { getNextEarningsReport } from '@/entities/earnings-report';
import {
    submitNewsAnalysis,
    type ModelId,
    type SubmitNewsAnalysisResult,
    type EnrichedNewsItem,
    type EarningsCalendarItem,
} from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/session/lib/getCurrentUser';
import { resolveTierAndByok } from '@/shared/lib/byokGate';
import type { AnalysisGateError } from '@/shared/lib/types';
import { resolveAssetClass } from '@/entities/ticker/lib/resolveAssetClass';
import { submitNewsAnalysisAction } from '../actions/submitNewsAnalysisAction';

const mockHeaders = headers as MockedFunction<typeof headers>;
const MockNewsRepository = DrizzleNewsRepository as MockedClass<
    typeof DrizzleNewsRepository
>;
const mockGetNextEarningsReport = getNextEarningsReport as MockedFunction<
    typeof getNextEarningsReport
>;

const mockSubmitNewsAnalysis = submitNewsAnalysis as MockedFunction<
    typeof submitNewsAnalysis
>;
const mockGetCurrentUser = getCurrentUser as MockedFunction<
    typeof getCurrentUser
>;
const mockResolveTierAndByok = resolveTierAndByok as MockedFunction<
    typeof resolveTierAndByok
>;
const mockResolveAssetClass = resolveAssetClass as MockedFunction<
    typeof resolveAssetClass
>;

/** An analyzed DB news row (has titleKo, summaryKo, sentiment, category). */
const ANALYZED_ROW = {
    id: 'abc123',
    symbol: 'AAPL',
    source: 'Reuters',
    url: 'https://reuters.com/aapl',
    publishedAt: '2025-07-01T10:00:00.000Z',
    titleEn: 'Apple earnings beat',
    bodyEn: 'Apple reported...',
    titleKo: '애플 실적 예상치 상회',
    bodyKo: '애플이 보고했다...',
    summaryKo: '긍정적 실적 발표',
    sentiment: 'bullish',
    priceImpact: 'positive',
    category: 'earnings',
    analyzedAt: new Date('2025-07-01T11:00:00.000Z'),
};

/** An unanalyzed DB news row (titleKo is null). */
const UNANALYZED_ROW = {
    ...ANALYZED_ROW,
    id: 'def456',
    titleKo: null,
    bodyKo: null,
    priceImpact: null,
    summaryKo: null,
    sentiment: null,
    category: null,
    analyzedAt: null,
};

const NEXT_EARNINGS: EarningsCalendarItem = {
    symbol: 'AAPL',
    earningsDate: '2025-08-01',
    epsActual: null,
    epsEstimated: 1.4,
    revenueActual: null,
    revenueEstimated: 88_000_000_000,
    lastUpdated: '2025-07-15',
};

const SUBMITTED_RESULT: SubmitNewsAnalysisResult = {
    status: 'submitted',
    jobId: 'job-news-001',
};

const MODEL_ID = 'gemini-2.5-flash' as ModelId;
const PREMIUM_MODEL = 'claude-opus-4-7' as ModelId;

const gateError: AnalysisGateError = {
    code: 'tier_premium_blocked',
    message: 'mock-tier_premium_blocked',
};

describe('submitNewsAnalysisAction 함수는', () => {
    let mockListBySymbol: Mock;

    beforeEach(() => {
        mockSubmitNewsAnalysis.mockReset();
        MockNewsRepository.mockClear();
        mockGetNextEarningsReport.mockReset();
        mockGetCurrentUser.mockReset();
        mockResolveTierAndByok.mockReset();
        mockResolveAssetClass.mockReset();
        mockResolveAssetClass.mockResolvedValue('equity');

        mockListBySymbol = vi.fn().mockResolvedValue([ANALYZED_ROW]);
        mockGetNextEarningsReport.mockResolvedValue(null);

        MockNewsRepository.mockImplementation(function () {
            return { listBySymbol: mockListBySymbol } as never;
        });

        mockGetCurrentUser.mockResolvedValue(null);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
        });
        mockSubmitNewsAnalysis.mockResolvedValue(SUBMITTED_RESULT);
    });

    it('symbol과 modelId를 siglens-core submitNewsAnalysis에 전달한다', async () => {
        mockListBySymbol.mockResolvedValue([ANALYZED_ROW]);
        mockGetNextEarningsReport.mockResolvedValue(null);
        mockSubmitNewsAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        await submitNewsAnalysisAction('AAPL', 'Apple Inc.', MODEL_ID);

        expect(mockSubmitNewsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ symbol: 'AAPL', modelId: MODEL_ID })
        );
    });

    it('titleKo가 null인 미분석 뉴스를 필터링하고 enrichedNews만 전달한다', async () => {
        mockListBySymbol.mockResolvedValue([ANALYZED_ROW, UNANALYZED_ROW]);
        mockGetNextEarningsReport.mockResolvedValue(null);
        mockSubmitNewsAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        await submitNewsAnalysisAction('AAPL', 'Apple Inc.', MODEL_ID);

        const callArg = mockSubmitNewsAnalysis.mock.calls[0]?.[0];
        expect(callArg?.news).toHaveLength(1);
        const item = callArg?.news[0] as EnrichedNewsItem;
        expect(item.id).toBe('abc123');
        expect(item.card.titleKo).toBe('애플 실적 예상치 상회');
    });

    it('25개를 초과하는 분석 뉴스는 priceImpact 상위 25개(impact 높은 순)만 prompt에 전달한다', async () => {
        // 30 low-impact rows + 5 high-impact rows = 35 enriched rows.
        // Only the top 25 by priceImpact should reach siglens-core, with the
        // 5 high-impact articles first.
        const lowRows = Array.from({ length: 30 }, (_, i) => ({
            ...ANALYZED_ROW,
            id: `low-${i}`,
            priceImpact: 'low',
        }));
        const highRows = Array.from({ length: 5 }, (_, i) => ({
            ...ANALYZED_ROW,
            id: `high-${i}`,
            priceImpact: 'high',
        }));
        mockListBySymbol.mockResolvedValue([...lowRows, ...highRows]);
        mockGetNextEarningsReport.mockResolvedValue(null);
        mockSubmitNewsAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        await submitNewsAnalysisAction('NVDA', 'Nvidia Corp.', MODEL_ID);

        const callArg = mockSubmitNewsAnalysis.mock.calls[0]?.[0];
        const news = callArg?.news as EnrichedNewsItem[];
        expect(news).toHaveLength(25);
        // All 5 high-impact articles survive and lead the list.
        expect(news.slice(0, 5).map(n => n.id)).toEqual(
            highRows.map(r => r.id)
        );
        // 상위 5개는 모두 high, 남은 20개는 모두 low (selection 정렬 검증).
        expect(news.slice(0, 5).every(n => n.card.priceImpact === 'high')).toBe(
            true
        );
        expect(news.slice(5).every(n => n.card.priceImpact === 'low')).toBe(
            true
        );
    });

    it('다음 실적 발표가 있으면 upcomingCalendar에 포함한다', async () => {
        mockListBySymbol.mockResolvedValue([ANALYZED_ROW]);
        mockGetNextEarningsReport.mockResolvedValue(NEXT_EARNINGS);
        mockSubmitNewsAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        await submitNewsAnalysisAction('AAPL', 'Apple Inc.', MODEL_ID);

        expect(mockSubmitNewsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({
                upcomingCalendar: [NEXT_EARNINGS],
            })
        );
    });

    it('다음 실적 발표가 없으면 upcomingCalendar를 빈 배열로 전달한다', async () => {
        mockListBySymbol.mockResolvedValue([ANALYZED_ROW]);
        mockGetNextEarningsReport.mockResolvedValue(null);
        mockSubmitNewsAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        await submitNewsAnalysisAction('AAPL', 'Apple Inc.', MODEL_ID);

        expect(mockSubmitNewsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ upcomingCalendar: [] })
        );
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockListBySymbol.mockResolvedValue([]);
        mockGetNextEarningsReport.mockResolvedValue(null);
        const noNewsResult: SubmitNewsAnalysisResult = {
            status: 'error',
            code: 'no_news',
            error: 'No news items provided.',
        };
        mockSubmitNewsAnalysis.mockResolvedValueOnce(noNewsResult);

        const result = await submitNewsAnalysisAction(
            'AAPL',
            'Apple Inc.',
            MODEL_ID
        );

        expect(result).toBe(noNewsResult);
    });

    it('returns blocked result when gate.kind === "blocked"', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'blocked',
            error: gateError,
        });

        const result = await submitNewsAnalysisAction(
            'AAPL',
            'Apple Inc.',
            PREMIUM_MODEL
        );

        expect(result).toEqual({ status: 'error', error: gateError });
        expect(mockSubmitNewsAnalysis).not.toHaveBeenCalled();
        // Gate fires before expensive DB fetches
        expect(mockListBySymbol).not.toHaveBeenCalled();
    });

    it('forwards tier="member" to siglens-core when gate allowed', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'member' as never,
        });

        await submitNewsAnalysisAction('AAPL', 'Apple Inc.', MODEL_ID);

        expect(mockSubmitNewsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ tier: 'member' })
        );
    });

    it('forwards userApiKey when present in gate result', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
            userApiKey: 'usr-key',
        });

        await submitNewsAnalysisAction('AAPL', 'Apple Inc.', PREMIUM_MODEL);

        expect(mockSubmitNewsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ userApiKey: 'usr-key' })
        );
    });

    it('omits userApiKey when not in gate result', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'pro' as never,
            // no userApiKey
        });

        await submitNewsAnalysisAction('AAPL', 'Apple Inc.', PREMIUM_MODEL);

        const callArg = mockSubmitNewsAnalysis.mock.calls[0]?.[0];
        expect(callArg).toBeDefined();
        expect(callArg).not.toHaveProperty('userApiKey');
    });

    it('passes null userId when getCurrentUser returns null', async () => {
        mockGetCurrentUser.mockResolvedValue(null);
        mockResolveTierAndByok.mockResolvedValue({
            kind: 'allowed',
            tier: 'free' as never,
        });

        await submitNewsAnalysisAction('AAPL', 'Apple Inc.', MODEL_ID);

        expect(mockResolveTierAndByok).toHaveBeenCalledWith(null, MODEL_ID);
    });

    it('returns unexpected_error result when an unexpected error is thrown', async () => {
        mockGetCurrentUser.mockResolvedValue({ id: 'u1' } as never);
        mockResolveTierAndByok.mockRejectedValue(
            new Error('db connection failed')
        );

        const result = await submitNewsAnalysisAction(
            'AAPL',
            'Apple Inc.',
            MODEL_ID
        );

        expect(result).toMatchObject({
            status: 'error',
            error: expect.objectContaining({ code: 'unexpected_error' }),
        });
    });

    it('passes skipEnqueueIfMiss: true to siglens-core when request UA is a bot', async () => {
        mockHeaders.mockResolvedValueOnce(
            new Headers({
                'user-agent':
                    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            })
        );

        await submitNewsAnalysisAction('AAPL', 'Apple Inc.', MODEL_ID);

        expect(mockSubmitNewsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ skipEnqueueIfMiss: true })
        );
    });

    it('passes skipEnqueueIfMiss: false to siglens-core when request UA is not a bot', async () => {
        await submitNewsAnalysisAction('AAPL', 'Apple Inc.', MODEL_ID);

        expect(mockSubmitNewsAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({ skipEnqueueIfMiss: false })
        );
    });

    describe('assetClass forwarding', () => {
        it('forwards default equity to submitNewsAnalysis', async () => {
            // default resolveAssetClass mock returns 'equity'
            await submitNewsAnalysisAction('AAPL', 'Apple', MODEL_ID);
            expect(mockSubmitNewsAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ assetClass: 'equity' })
            );
        });
        it('forwards crypto when resolveAssetClass returns "crypto"', async () => {
            mockResolveAssetClass.mockResolvedValueOnce('crypto');
            await submitNewsAnalysisAction('BTCUSD', 'Bitcoin', MODEL_ID);
            expect(mockSubmitNewsAnalysis).toHaveBeenCalledWith(
                expect.objectContaining({ assetClass: 'crypto' })
            );
        });
    });
});
