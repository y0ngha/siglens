import { mapAnalysisStatus } from '../lib/mapAnalysisStatus';

describe('mapAnalysisStatus', () => {
    it('maps "done" to success', () => {
        expect(mapAnalysisStatus('done')).toBe('success');
    });

    it('maps "loading" to pending', () => {
        expect(mapAnalysisStatus('loading')).toBe('pending');
    });

    it('maps "submitting" to pending', () => {
        expect(mapAnalysisStatus('submitting')).toBe('pending');
    });

    it('maps "polling" to pending', () => {
        expect(mapAnalysisStatus('polling')).toBe('pending');
    });

    it('maps "pending_dependencies" to pending', () => {
        expect(mapAnalysisStatus('pending_dependencies')).toBe('pending');
    });

    it('maps "cache_miss" to unavailable', () => {
        expect(mapAnalysisStatus('cache_miss')).toBe('unavailable');
    });

    it('maps "no_trades" to unavailable', () => {
        expect(mapAnalysisStatus('no_trades')).toBe('unavailable');
    });

    it('maps "error" to error', () => {
        expect(mapAnalysisStatus('error')).toBe('error');
    });

    it('maps unknown status to idle', () => {
        expect(mapAnalysisStatus('unknown_token')).toBe('idle');
    });

    it('maps empty string to idle', () => {
        expect(mapAnalysisStatus('')).toBe('idle');
    });
});
