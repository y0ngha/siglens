// vi.mock → imports 순서 (MISTAKES.md Tests §17)
const { mockCancel } = vi.hoisted(() => ({ mockCancel: vi.fn() }));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    cancelFinancialsAnalysisJob: mockCancel,
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cancelFinancialsAnalysisJobAction } from '../actions/cancelFinancialsAnalysisJobAction';

describe('cancelFinancialsAnalysisJobAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('delegates the jobId to core cancelFinancialsAnalysisJob', async () => {
        mockCancel.mockResolvedValue(undefined);

        await cancelFinancialsAnalysisJobAction('job-123');

        expect(mockCancel).toHaveBeenCalledTimes(1);
        expect(mockCancel).toHaveBeenCalledWith('job-123');
    });

    it('swallows the error and warns when core throws (best-effort cancel)', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const cause = new Error('network down');
        mockCancel.mockRejectedValue(cause);

        await expect(
            cancelFinancialsAnalysisJobAction('job-err')
        ).resolves.toBeUndefined();

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(
            '[cancelFinancialsAnalysisJobAction] 취소 신호 전송 실패:',
            'job-err',
            cause
        );
        warn.mockRestore();
    });
});
