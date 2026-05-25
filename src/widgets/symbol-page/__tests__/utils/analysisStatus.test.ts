import { getAnalysisStatus } from '@/widgets/symbol-page/utils/analysisStatus';

describe('getAnalysisStatus', () => {
    it('returns analyzing when isAnalyzing is true', () => {
        expect(getAnalysisStatus(true, null)).toEqual({ type: 'analyzing' });
    });

    it('returns analyzing even when analysisError is present', () => {
        expect(getAnalysisStatus(true, 'some error')).toEqual({
            type: 'analyzing',
        });
    });

    it('returns error when isAnalyzing is false and analysisError exists', () => {
        expect(getAnalysisStatus(false, 'timeout')).toEqual({
            type: 'error',
            message: 'timeout',
        });
    });

    it('returns idle when neither analyzing nor error', () => {
        expect(getAnalysisStatus(false, null)).toEqual({ type: 'idle' });
    });
});
