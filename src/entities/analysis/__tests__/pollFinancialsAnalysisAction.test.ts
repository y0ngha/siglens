import type { MockedFunction } from 'vitest';
import { pollFinancialsAnalysisAction } from '../actions/pollFinancialsAnalysisAction';
import { pollFinancialsAnalysis } from '@y0ngha/siglens-core';
import type { PollFinancialsAnalysisResult } from '@y0ngha/siglens-core';

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    pollFinancialsAnalysis: vi.fn(),
}));

const mockPollFinancialsAnalysis = pollFinancialsAnalysis as MockedFunction<
    typeof pollFinancialsAnalysis
>;

const PROCESSING_RESULT: PollFinancialsAnalysisResult = {
    status: 'processing',
};

describe('pollFinancialsAnalysisAction 함수는', () => {
    beforeEach(() => {
        mockPollFinancialsAnalysis.mockReset();
    });

    it('jobId를 siglens-core pollFinancialsAnalysis에 그대로 전달한다', async () => {
        mockPollFinancialsAnalysis.mockResolvedValueOnce(PROCESSING_RESULT);

        await pollFinancialsAnalysisAction('job-financials-001');

        expect(mockPollFinancialsAnalysis).toHaveBeenCalledWith(
            'job-financials-001'
        );
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockPollFinancialsAnalysis.mockResolvedValueOnce(PROCESSING_RESULT);

        const result = await pollFinancialsAnalysisAction('job-abc');

        expect(result).toBe(PROCESSING_RESULT);
    });

    describe('underlying가 throw할 때 (§0.7)', () => {
        it('예외를 전파하지 않고 error 결과를 반환한다', async () => {
            const consoleSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            mockPollFinancialsAnalysis.mockRejectedValueOnce(
                new Error('redis down')
            );

            const result = await pollFinancialsAnalysisAction('job-err');

            expect(result).toEqual({
                status: 'error',
                error: '분석 결과를 가져오지 못했습니다.',
            });
            consoleSpy.mockRestore();
        });

        it('catch에서 에러를 로깅한다', async () => {
            const consoleSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            const error = new Error('redis down');
            mockPollFinancialsAnalysis.mockRejectedValueOnce(error);

            await pollFinancialsAnalysisAction('job-err');

            expect(consoleSpy).toHaveBeenCalledWith(
                '[pollFinancialsAnalysisAction] poll failed:',
                'job-err',
                error
            );
            consoleSpy.mockRestore();
        });
    });
});
