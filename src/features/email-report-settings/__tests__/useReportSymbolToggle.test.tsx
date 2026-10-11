const mocks = vi.hoisted(() => ({
    exclude: vi.fn(),
    include: vi.fn(),
    refresh: vi.fn(),
    showToast: vi.fn(),
}));

vi.mock('@/entities/email-report/actions/excludeReportSymbolAction', () => ({
    excludeReportSymbolAction: mocks.exclude,
}));
vi.mock('@/entities/email-report/actions/includeReportSymbolAction', () => ({
    includeReportSymbolAction: mocks.include,
}));
vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock('@/shared/ui/ToastProvider', () => ({
    useToast: () => ({ showToast: mocks.showToast, dismiss: vi.fn() }),
}));

import { act, renderHook, waitFor } from '@testing-library/react';
import { useReportSymbolToggle } from '@/features/email-report-settings/hooks/useReportSymbolToggle';

describe('useReportSymbolToggle', () => {
    beforeEach(() => vi.clearAllMocks());

    describe('모드별 액션', () => {
        it('exclude는 빼기 액션, include는 넣기 액션을 심볼과 함께 부른다', async () => {
            mocks.exclude.mockResolvedValue({ status: 'ok' });
            mocks.include.mockResolvedValue({ status: 'ok' });
            const ex = renderHook(() =>
                useReportSymbolToggle('AAPL', 'exclude')
            );
            act(() => ex.result.current.toggle());
            await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
            expect(mocks.exclude).toHaveBeenCalledWith({ symbol: 'AAPL' });

            const inc = renderHook(() =>
                useReportSymbolToggle('NVDA', 'include')
            );
            act(() => inc.result.current.toggle());
            await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(2));
            expect(mocks.include).toHaveBeenCalledWith({ symbol: 'NVDA' });
        });
    });

    describe('진행 중', () => {
        it('요청이 끝나기 전에는 pending이고 다시 불러도 액션이 한 번만 나간다', async () => {
            let resolve: (value: { status: 'ok' }) => void = () => {};
            mocks.exclude.mockReturnValue(
                new Promise(r => {
                    resolve = r;
                })
            );
            const { result } = renderHook(() =>
                useReportSymbolToggle('AAPL', 'exclude')
            );
            act(() => result.current.toggle());
            expect(result.current.pending).toBe(true);
            act(() => result.current.toggle());
            expect(mocks.exclude).toHaveBeenCalledTimes(1);
            await act(async () => resolve({ status: 'ok' }));
            await waitFor(() => expect(result.current.pending).toBe(false));
        });
    });
});
