// @vitest-environment jsdom
/**
 * `instrumentation-client.ts`는 React 하이드레이션 전에 실행되는 전역 훅 두 개를
 * 등록하는 side-effect 모듈이다 — import 자체가 동작이므로, import 후 이벤트를
 * 실제로 발생시켜 `reportClientError`가 불리는지로 검증한다.
 */
const { mockReportClientError } = vi.hoisted(() => ({
    mockReportClientError: vi.fn(),
}));

vi.mock('@/shared/lib/reportClientError', () => ({
    reportClientError: mockReportClientError,
}));

describe('instrumentation-client', () => {
    beforeEach(() => {
        vi.resetModules();
        mockReportClientError.mockReset();
    });

    it('window error 이벤트에 실린 Error를 reportClientError로 넘긴다', async () => {
        await import('../instrumentation-client');

        const error = new Error('boom');
        window.dispatchEvent(
            new ErrorEvent('error', { error, message: 'boom' })
        );

        expect(mockReportClientError).toHaveBeenCalledWith(
            error,
            'window.onerror'
        );
    });

    /**
     * 리소스 로드 실패(img/script)는 `error`가 없는 `ErrorEvent`로 온다 — 노이즈라
     * 버린다. 이 가드가 없으면 깨진 이미지 하나마다 보고가 나간다.
     */
    it('error 필드가 없는 이벤트(리소스 로드 실패)는 무시한다', async () => {
        await import('../instrumentation-client');

        window.dispatchEvent(new ErrorEvent('error', {}));

        expect(mockReportClientError).not.toHaveBeenCalled();
    });

    it('unhandledrejection의 reason을 reportClientError로 넘긴다', async () => {
        await import('../instrumentation-client');

        const reason = new Error('rejected');
        const event = new Event('unhandledrejection') as PromiseRejectionEvent;
        Object.defineProperty(event, 'reason', { value: reason });
        window.dispatchEvent(event);

        expect(mockReportClientError).toHaveBeenCalledWith(
            reason,
            'unhandledrejection'
        );
    });
});
