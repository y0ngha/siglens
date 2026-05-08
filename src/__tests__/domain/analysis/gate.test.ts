import {
    isGateBlockedResult,
    GATE_ERROR_CODES,
    type AnalysisGateBlockedResult,
} from '@/domain/analysis/gate';

describe('isGateBlockedResult', () => {
    it('returns true for AnalysisGateBlockedResult shape', () => {
        const r: AnalysisGateBlockedResult = {
            status: 'error',
            error: { code: 'tier_premium_blocked', message: 'msg' },
        };
        expect(isGateBlockedResult(r)).toBe(true);
    });

    it('returns true for all known gate codes', () => {
        for (const code of GATE_ERROR_CODES) {
            expect(
                isGateBlockedResult({ status: 'error', error: { code, message: '' } })
            ).toBe(true);
        }
    });

    it('returns false for unknown code', () => {
        expect(
            isGateBlockedResult({
                status: 'error',
                error: { code: 'fetch_failed', message: '' },
            })
        ).toBe(false);
    });

    it('returns false when error is a string', () => {
        expect(
            isGateBlockedResult({ status: 'error', error: 'some message' })
        ).toBe(false);
    });

    it('returns false when error is null', () => {
        expect(isGateBlockedResult({ status: 'error', error: null })).toBe(false);
    });

    it('returns false when error has no code field', () => {
        expect(
            isGateBlockedResult({ status: 'error', error: { message: 'no code' } })
        ).toBe(false);
    });
});
