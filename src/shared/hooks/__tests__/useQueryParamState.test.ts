// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { useQueryParamState } from '@/shared/hooks/useQueryParamState';

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: pushMock, replace: replaceMock }),
    usePathname: () => '/stocks',
    useSearchParams: () => new URLSearchParams('tab=chart'),
}));

describe('useQueryParamState', () => {
    beforeEach(() => {
        pushMock.mockClear();
        replaceMock.mockClear();
    });

    it('returns the current param value from search params', () => {
        const { result } = renderHook(() =>
            useQueryParamState('tab', 'overview')
        );
        expect(result.current[0]).toBe('chart');
    });

    it('returns the default value when param is not in URL', () => {
        const { result } = renderHook(() => useQueryParamState('sort', 'asc'));
        expect(result.current[0]).toBe('asc');
    });

    it('pushes new URL when setting a non-default value', () => {
        const { result } = renderHook(() =>
            useQueryParamState('tab', 'overview')
        );
        act(() => {
            result.current[1]('news');
        });
        expect(pushMock).toHaveBeenCalledWith('/stocks?tab=news', {
            scroll: false,
        });
    });

    it('removes param from URL when setting to default value', () => {
        const { result } = renderHook(() => useQueryParamState('tab', 'chart'));
        act(() => {
            // Setting to default value should remove the param
            result.current[1]('chart');
        });
        expect(pushMock).toHaveBeenCalledWith('/stocks', { scroll: false });
    });

    it('uses router.replace when replace option is true', () => {
        const { result } = renderHook(() =>
            useQueryParamState('tab', 'overview', { replace: true })
        );
        act(() => {
            result.current[1]('news');
        });
        expect(replaceMock).toHaveBeenCalledWith('/stocks?tab=news', {
            scroll: false,
        });
        expect(pushMock).not.toHaveBeenCalled();
    });
});
