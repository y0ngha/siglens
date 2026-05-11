jest.mock('@vercel/functions', () => ({
    waitUntil: jest.fn(),
}));

jest.mock('next/headers', () => ({
    headers: jest.fn(() => Promise.resolve(new Headers())),
}));

jest.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    submitNewsAnalysis: jest.fn(),
}));

jest.mock('@/infrastructure/db/client', () => ({
    getDatabaseClient: jest.fn().mockReturnValue({ db: {} }),
}));

jest.mock('@/infrastructure/db/newsRepository', () => ({
    DrizzleNewsRepository: jest.fn().mockImplementation(() => ({
        listBySymbol: jest.fn(),
    })),
}));

jest.mock('@/infrastructure/market/nextEarningsReport', () => ({
    getNextEarningsReport: jest.fn(),
}));

jest.mock('@/infrastructure/auth/getCurrentUser', () => ({
    getCurrentUser: jest.fn(),
}));

jest.mock('@/infrastructure/market/byokGate', () => ({
    resolveTierAndByok: jest.fn(),
    buildGateError: jest.fn((code: string) => ({
        code,
        message: `mock-${code}`,
    })),
}));

import { headers } from 'next/headers';
import { DrizzleNewsRepository } from '@/infrastructure/db/newsRepository';
import { getNextEarningsReport } from '@/infrastructure/market/nextEarningsReport';
import {
    submitNewsAnalysis,
    type ModelId,
    type SubmitNewsAnalysisResult,
    type EnrichedNewsItem,
    type EarningsCalendarItem,
} from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/infrastructure/auth/getCurrentUser';
import { resolveTierAndByok } from '@/infrastructure/market/byokGate';
import type { AnalysisGateError } from '@/domain/types';
import { submitNewsAnalysisAction } from '@/infrastructure/market/submitNewsAnalysisAction';

const mockHeaders = headers as jest.MockedFunction<typeof headers>;
const MockNewsRepository = DrizzleNewsRepository as jest.MockedClass<
    typeof DrizzleNewsRepository
>;
const mockGetNextEarningsReport = getNextEarningsReport as jest.MockedFunction<
    typeof getNextEarningsReport
>;

const mockSubmitNewsAnalysis = submitNewsAnalysis as jest.MockedFunction<
    typeof submitNewsAnalysis
>;
const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<
    typeof getCurrentUser
>;
const mockResolveTierAndByok = resolveTierAndByok as jest.MockedFunction<
    typeof resolveTierAndByok
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
    category: 'earnings',
    analyzedAt: new Date('2025-07-01T11:00:00.000Z'),
};

/** An unanalyzed DB news row (titleKo is null). */
const UNANALYZED_ROW = {
    ...ANALYZED_ROW,
    id: 'def456',
    titleKo: null,
    bodyKo: null,
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
    let mockListBySymbol: jest.Mock;

    beforeEach(() => {
        mockSubmitNewsAnalysis.mockReset();
        MockNewsRepository.mockClear();
        mockGetNextEarningsReport.mockReset();
        mockGetCurrentUser.mockReset();
        mockResolveTierAndByok.mockReset();

        mockListBySymbol = jest.fn().mockResolvedValue([ANALYZED_ROW]);
        mockGetNextEarningsReport.mockResolvedValue(null);

        MockNewsRepository.mockImplementation(
            () => ({ listBySymbol: mockListBySymbol }) as never
        );

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
});
