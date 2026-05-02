import { submitAnalysisAction } from '@/infrastructure/market/submitAnalysisAction';
import { submitAnalysis } from '@y0ngha/siglens-core';
import type { ModelId, SubmitAnalysisGatedResult } from '@y0ngha/siglens-core';

jest.mock('@vercel/functions', () => ({
    waitUntil: jest.fn(),
}));

jest.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    submitAnalysis: jest.fn(),
}));

const mockSubmitAnalysis = submitAnalysis as jest.MockedFunction<
    typeof submitAnalysis
>;

const cachedResult: SubmitAnalysisGatedResult = {
    status: 'cached',
    result: { summary: 'cached' } as never,
};

describe('submitAnalysisAction 함수는', () => {
    beforeEach(() => {
        mockSubmitAnalysis.mockReset();
    });

    it('siglens-core submitAnalysis에 모든 인자를 그대로 전달한다', async () => {
        mockSubmitAnalysis.mockResolvedValueOnce(cachedResult);

        await submitAnalysisAction('AAPL', '1Day', true, '^AAPL');

        expect(mockSubmitAnalysis).toHaveBeenCalledWith(
            'AAPL',
            '1Day',
            true,
            '^AAPL',
            expect.objectContaining({ waitUntil: expect.any(Function) })
        );
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockSubmitAnalysis.mockResolvedValueOnce(cachedResult);

        const result = await submitAnalysisAction('AAPL', '1Day');

        expect(result).toBe(cachedResult);
    });

    it('forwards modelId to submitAnalysis options when provided', async () => {
        mockSubmitAnalysis.mockResolvedValueOnce(cachedResult);

        const modelId = 'claude-opus-4-5' as ModelId;
        await submitAnalysisAction('AAPL', '1Day', false, '^AAPL', modelId);

        expect(mockSubmitAnalysis).toHaveBeenCalledWith(
            'AAPL',
            '1Day',
            false,
            '^AAPL',
            expect.objectContaining({ modelId })
        );
    });

    it('passes modelId as undefined in options when modelId is omitted', async () => {
        mockSubmitAnalysis.mockResolvedValueOnce(cachedResult);

        await submitAnalysisAction('AAPL', '1Day', false, '^AAPL');

        expect(mockSubmitAnalysis).toHaveBeenCalledWith(
            'AAPL',
            '1Day',
            false,
            '^AAPL',
            expect.objectContaining({ modelId: undefined })
        );
    });
});
