import { deriveChartStatus } from '../lib/deriveChartStatus';

describe('deriveChartStatus', () => {
    const base = {
        isAnalyzing: false,
        analysisError: false,
        isBotBlocked: false,
        hasResult: false,
    };

    it('returns idle when all flags are false', () => {
        expect(deriveChartStatus(base)).toBe('idle');
    });

    it('returns success when hasResult is true (and no higher-priority flags)', () => {
        expect(deriveChartStatus({ ...base, hasResult: true })).toBe('success');
    });

    it('returns error when analysisError is true (and no higher-priority flags)', () => {
        expect(deriveChartStatus({ ...base, analysisError: true })).toBe(
            'error'
        );
    });

    it('returns pending when isAnalyzing is true (and no higher-priority flags)', () => {
        expect(deriveChartStatus({ ...base, isAnalyzing: true })).toBe(
            'pending'
        );
    });

    it('returns unavailable when isBotBlocked is true (highest priority)', () => {
        expect(
            deriveChartStatus({
                isBotBlocked: true,
                isAnalyzing: true,
                analysisError: true,
                hasResult: true,
            })
        ).toBe('unavailable');
    });

    it('isBotBlocked beats isAnalyzing', () => {
        expect(
            deriveChartStatus({
                ...base,
                isBotBlocked: true,
                isAnalyzing: true,
            })
        ).toBe('unavailable');
    });

    it('isAnalyzing beats analysisError', () => {
        expect(
            deriveChartStatus({
                ...base,
                isAnalyzing: true,
                analysisError: true,
            })
        ).toBe('pending');
    });

    it('analysisError beats hasResult', () => {
        expect(
            deriveChartStatus({ ...base, analysisError: true, hasResult: true })
        ).toBe('error');
    });
});
