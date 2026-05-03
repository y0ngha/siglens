import { submitFundamentalAnalysisAction } from '@/infrastructure/market/submitFundamentalAnalysisAction';
import { submitFundamentalAnalysis } from '@y0ngha/siglens-core';
import type {
    ModelId,
    SubmitFundamentalAnalysisResult,
} from '@y0ngha/siglens-core';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('@vercel/functions', () => ({
    waitUntil: jest.fn(),
}));

jest.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    submitFundamentalAnalysis: jest.fn(),
}));

jest.mock('@/infrastructure/fmp/fundamentalClient', () => ({
    FmpFundamentalClient: jest.fn().mockImplementation(() => ({})),
}));

// ---------------------------------------------------------------------------
// Typed mock
// ---------------------------------------------------------------------------

const mockSubmitFundamentalAnalysis =
    submitFundamentalAnalysis as jest.MockedFunction<
        typeof submitFundamentalAnalysis
    >;

const CACHED_RESULT: SubmitFundamentalAnalysisResult = {
    status: 'cached',
    result: { categories: [] } as never,
};

const SUBMITTED_RESULT: SubmitFundamentalAnalysisResult = {
    status: 'submitted',
    jobId: 'job-fundamental-001',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('submitFundamentalAnalysisAction 함수는', () => {
    beforeEach(() => {
        mockSubmitFundamentalAnalysis.mockReset();
    });

    it('siglens-core submitFundamentalAnalysis에 symbol과 modelId를 전달한다', async () => {
        mockSubmitFundamentalAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        await submitFundamentalAnalysisAction(
            'AAPL',
            'gemini-2.5-flash' as ModelId
        );

        expect(mockSubmitFundamentalAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({
                symbol: 'AAPL',
                modelId: 'gemini-2.5-flash',
            })
        );
    });

    it('FmpFundamentalClient 인스턴스를 dataProvider로 전달한다', async () => {
        mockSubmitFundamentalAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        await submitFundamentalAnalysisAction(
            'TSLA',
            'gemini-2.5-flash' as ModelId
        );

        expect(mockSubmitFundamentalAnalysis).toHaveBeenCalledWith(
            expect.objectContaining({
                dataProvider: expect.any(Object),
            })
        );
    });

    it('underlying 함수의 cached 결과를 그대로 반환한다', async () => {
        mockSubmitFundamentalAnalysis.mockResolvedValueOnce(CACHED_RESULT);

        const result = await submitFundamentalAnalysisAction(
            'AAPL',
            'gemini-2.5-flash' as ModelId
        );

        expect(result).toBe(CACHED_RESULT);
    });

    it('underlying 함수의 submitted 결과를 그대로 반환한다', async () => {
        mockSubmitFundamentalAnalysis.mockResolvedValueOnce(SUBMITTED_RESULT);

        const result = await submitFundamentalAnalysisAction(
            'AAPL',
            'gemini-2.5-flash' as ModelId
        );

        expect(result).toBe(SUBMITTED_RESULT);
    });
});
