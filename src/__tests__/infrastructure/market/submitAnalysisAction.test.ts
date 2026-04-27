import { submitAnalysisAction } from '@/infrastructure/market/submitAnalysisAction';
import { submitAnalysis } from '@y0ngha/siglens-core';
import type { SubmitAnalysisResult } from '@y0ngha/siglens-core';

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

const cachedResult: SubmitAnalysisResult = {
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
            { waitUntil: expect.any(Function) }
        );
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockSubmitAnalysis.mockResolvedValueOnce(cachedResult);

        const result = await submitAnalysisAction('AAPL', '1Day');

        expect(result).toBe(cachedResult);
    });
});
