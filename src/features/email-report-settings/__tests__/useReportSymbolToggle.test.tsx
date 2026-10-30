const mocks = vi.hoisted(() => {
    const refresh = vi.fn();
    const showToast = vi.fn();
    return {
        exclude: vi.fn(),
        include: vi.fn(),
        refresh,
        showToast,
        // 실제 훅처럼 렌더마다 같은 객체를 돌려준다.
        router: { refresh },
        toast: { showToast, dismiss: vi.fn() },
    };
});

vi.mock('@/entities/email-report/actions/excludeReportSymbolAction', () => ({
    excludeReportSymbolAction: mocks.exclude,
}));
vi.mock('@/entities/email-report/actions/includeReportSymbolAction', () => ({
    includeReportSymbolAction: mocks.include,
}));
vi.mock('next/navigation', () => ({
    useRouter: () => mocks.router,
}));
vi.mock('@/shared/ui/ToastProvider', () => ({
    useToast: () => mocks.toast,
}));

import { act, renderHook, waitFor } from '@testing-library/react';
import { useReportSymbolToggle } from '@/features/email-report-settings/hooks/useReportSymbolToggle';
import { REPORT_SYMBOLS_PREVIEW_ID } from '@/features/email-report-settings/lib/reportSymbolsPreviewIds';

describe('useReportSymbolToggle', () => {
    beforeEach(() => vi.clearAllMocks());

    describe('모드별 액션', () => {
        it('exclude는 빼기 액션, include는 넣기 액션을 심볼과 함께 부른다', async () => {
            mocks.exclude.mockResolvedValue({ status: 'ok' });
            mocks.include.mockResolvedValue({ status: 'ok' });
            const ex = renderHook(() =>
                useReportSymbolToggle('AAPL', 'exclude', 'Apple')
            );
            act(() => ex.result.current.toggle());
            await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
            expect(mocks.exclude).toHaveBeenCalledWith({ symbol: 'AAPL' });

            const inc = renderHook(() =>
                useReportSymbolToggle('NVDA', 'include', 'NVIDIA')
            );
            act(() => inc.result.current.toggle());
            await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(2));
            expect(mocks.include).toHaveBeenCalledWith({ symbol: 'NVDA' });
        });
    });

    describe('clear 모드', () => {
        it('제외 기록 지우기는 넣기 액션을 부르고 기록 삭제 토스트를 보인다', async () => {
            mocks.include.mockResolvedValue({ status: 'ok' });
            const { result } = renderHook(() =>
                useReportSymbolToggle('GONE', 'clear', 'GONE')
            );

            act(() => result.current.toggle());

            await waitFor(() =>
                expect(mocks.showToast).toHaveBeenCalledWith({
                    message: '제외 기록을 지웠어요: GONE',
                })
            );
            expect(mocks.include).toHaveBeenCalledWith({ symbol: 'GONE' });
            expect(mocks.exclude).not.toHaveBeenCalled();
        });
    });

    describe('성공', () => {
        let preview: HTMLElement;
        beforeEach(() => {
            preview = document.createElement('div');
            preview.id = REPORT_SYMBOLS_PREVIEW_ID;
            preview.tabIndex = -1;
            document.body.append(preview);
        });
        afterEach(() => preview.remove());

        it.each([
            ['exclude', 'Apple', '리포트에서 뺐어요: Apple'],
            ['include', 'Apple', '리포트에 다시 넣었어요: Apple'],
        ] as const)(
            '%s 성공이면 새로고침 뒤 성공 토스트를 보이고 포커스를 미리보기로 옮긴다',
            async (mode, label, message) => {
                mocks.exclude.mockResolvedValue({ status: 'ok' });
                mocks.include.mockResolvedValue({ status: 'ok' });
                const { result } = renderHook(() =>
                    useReportSymbolToggle('AAPL', mode, label)
                );

                act(() => result.current.toggle());

                await waitFor(() =>
                    expect(mocks.showToast).toHaveBeenCalledWith({ message })
                );
                expect(mocks.refresh).toHaveBeenCalledTimes(1);
                expect(preview).toHaveFocus();
            }
        );
    });

    describe('실패', () => {
        it('오류 결과면 그 문구로 토스트하고 새로고침도 포커스 이동도 하지 않는다', async () => {
            const preview = document.createElement('div');
            preview.id = REPORT_SYMBOLS_PREVIEW_ID;
            preview.tabIndex = -1;
            document.body.append(preview);
            mocks.exclude.mockResolvedValue({
                status: 'error',
                code: 'limit_reached',
                message: '상한이에요.',
            });
            const { result } = renderHook(() =>
                useReportSymbolToggle('AAPL', 'exclude', 'Apple')
            );

            act(() => result.current.toggle());

            await waitFor(() =>
                expect(mocks.showToast).toHaveBeenCalledWith({
                    message: '상한이에요.',
                })
            );
            expect(mocks.refresh).not.toHaveBeenCalled();
            expect(preview).not.toHaveFocus();
            preview.remove();
        });

        it('액션이 던지면 일반 실패 문구로 토스트하고 새로고침하지 않는다', async () => {
            mocks.exclude.mockRejectedValue(new Error('network'));
            const { result } = renderHook(() =>
                useReportSymbolToggle('AAPL', 'exclude', 'Apple')
            );

            act(() => result.current.toggle());

            await waitFor(() =>
                expect(mocks.showToast).toHaveBeenCalledWith({
                    message: '처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
                })
            );
            expect(mocks.refresh).not.toHaveBeenCalled();
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
                useReportSymbolToggle('AAPL', 'exclude', 'Apple')
            );
            act(() => result.current.toggle());
            expect(result.current.pending).toBe(true);
            act(() => result.current.toggle());
            expect(mocks.exclude).toHaveBeenCalledTimes(1);
            await act(async () => resolve({ status: 'ok' }));
            await waitFor(() => expect(result.current.pending).toBe(false));
        });
    });

    it('리렌더해도 toggle 참조가 그대로다', () => {
        const { result, rerender } = renderHook(() =>
            useReportSymbolToggle('AAPL', 'exclude', 'Apple')
        );
        const first = result.current.toggle;
        rerender();
        expect(result.current.toggle).toBe(first);
    });
});
