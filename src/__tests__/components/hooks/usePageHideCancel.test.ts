/**
 * @jest-environment jsdom
 */
import { usePageHideCancel } from '@/components/hooks/usePageHideCancel';
import { CANCEL_JOBS_API_PATH } from '@/shared/lib/cancelJobsApi';
import { renderHook } from '@testing-library/react';
import { readBlobText } from '@/__tests__/utils/readBlobText';

describe('usePageHideCancel', () => {
    let sendBeaconMock: jest.Mock;

    beforeEach(() => {
        sendBeaconMock = jest.fn();
        Object.defineProperty(navigator, 'sendBeacon', {
            value: sendBeaconMock,
            configurable: true,
            writable: true,
        });
    });

    it('pagehide 발화 시 sendBeacon을 CANCEL_JOBS_API_PATH로 호출한다', () => {
        const getJobs = jest
            .fn()
            .mockReturnValue([{ jobId: 'job-123', type: 'analysis' }]);
        renderHook(() => usePageHideCancel(getJobs));

        window.dispatchEvent(new Event('pagehide'));

        expect(sendBeaconMock).toHaveBeenCalledTimes(1);
        expect(sendBeaconMock).toHaveBeenCalledWith(
            CANCEL_JOBS_API_PATH,
            expect.any(Blob)
        );
    });

    it('Blob의 Content-Type이 application/json이다', () => {
        const getJobs = jest
            .fn()
            .mockReturnValue([{ jobId: 'job-123', type: 'analysis' }]);
        renderHook(() => usePageHideCancel(getJobs));

        window.dispatchEvent(new Event('pagehide'));

        const [, blob] = sendBeaconMock.mock.calls[0] as [string, Blob];
        expect(blob.type).toBe('application/json');
    });

    it('Blob의 내용이 jobs 배열을 담은 올바른 JSON이다', async () => {
        const jobs = [
            { jobId: 'job-123', type: 'analysis' as const },
            { jobId: 'job-456', type: 'fundamental' as const },
        ];
        const getJobs = jest.fn().mockReturnValue(jobs);
        renderHook(() => usePageHideCancel(getJobs));

        window.dispatchEvent(new Event('pagehide'));

        const [, blob] = sendBeaconMock.mock.calls[0] as [string, Blob];
        const text = await readBlobText(blob);
        expect(JSON.parse(text)).toEqual({ jobs });
    });

    it('getJobs()가 null을 반환하면 sendBeacon을 호출하지 않는다', () => {
        const getJobs = jest.fn().mockReturnValue(null);
        renderHook(() => usePageHideCancel(getJobs));

        window.dispatchEvent(new Event('pagehide'));

        expect(sendBeaconMock).not.toHaveBeenCalled();
    });

    it('getJobs()가 빈 배열을 반환하면 sendBeacon을 호출하지 않는다', () => {
        const getJobs = jest.fn().mockReturnValue([]);
        renderHook(() => usePageHideCancel(getJobs));

        window.dispatchEvent(new Event('pagehide'));

        expect(sendBeaconMock).not.toHaveBeenCalled();
    });

    it('unmount 후 pagehide가 발화해도 sendBeacon을 호출하지 않는다', () => {
        const getJobs = jest
            .fn()
            .mockReturnValue([{ jobId: 'job-123', type: 'analysis' }]);
        const { unmount } = renderHook(() => usePageHideCancel(getJobs));

        unmount();
        window.dispatchEvent(new Event('pagehide'));

        expect(sendBeaconMock).not.toHaveBeenCalled();
    });

    it('여러 job이 있으면 모두 payload에 포함된다', async () => {
        const jobs = [
            { jobId: 'job-t', type: 'analysis' as const },
            { jobId: 'job-f', type: 'fundamental' as const },
            { jobId: 'job-n', type: 'news' as const },
        ];
        const getJobs = jest.fn().mockReturnValue(jobs);
        renderHook(() => usePageHideCancel(getJobs));

        window.dispatchEvent(new Event('pagehide'));

        const [, blob] = sendBeaconMock.mock.calls[0] as [string, Blob];
        const text = await readBlobText(blob);
        expect(JSON.parse(text)).toEqual({ jobs });
    });
});
