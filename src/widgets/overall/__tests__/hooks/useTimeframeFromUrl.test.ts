// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { useTimeframeFromUrl } from '@/widgets/overall/hooks/useTimeframeFromUrl';
import { DEFAULT_TIMEFRAME } from '@/shared/config/market';

// 훅은 `useUrlSearchParam`(window.location)으로 읽는다. 스파이가 replaceState를 막기 전에
// 원본을 잡아 두고 테스트 URL을 세팅하는 데 쓴다.
const realReplaceState = window.history.replaceState.bind(window.history);

function setSearch(search: string): void {
    realReplaceState(
        null,
        '',
        `/AAPL/overall${search === '' ? '' : `?${search}`}`
    );
}

describe('useTimeframeFromUrl', () => {
    // 훅은 라우터 내비게이션 없이 history.replaceState로 주소만 정규화한다
    // (router.replace는 화면을 다시 그려 잘못된 tf가 잠깐 보였다).
    let replaceState: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        setSearch('');
        // 같은 메서드에 두 번 spyOn하면 vitest가 기존 spy를 그대로 돌려주므로
        // 호출 기록이 테스트 사이에 남는다 — 매번 명시적으로 비운다.
        replaceState = vi
            .spyOn(window.history, 'replaceState')
            .mockImplementation(() => {});
        replaceState.mockClear();
    });

    it('유효한 tf 쿼리는 그대로 반환한다', () => {
        setSearch('tf=1Hour');
        const { result } = renderHook(() =>
            useTimeframeFromUrl('AAPL', false, true)
        );
        expect(result.current).toBe('1Hour');
    });

    it('유효하지 않은 tf는 DEFAULT_TIMEFRAME으로 폴백한다', () => {
        setSearch('tf=not-a-timeframe');
        const { result } = renderHook(() =>
            useTimeframeFromUrl('AAPL', false, true)
        );
        expect(result.current).toBe(DEFAULT_TIMEFRAME);
    });

    it('tf가 없으면 DEFAULT_TIMEFRAME으로 폴백한다', () => {
        setSearch('');
        const { result } = renderHook(() =>
            useTimeframeFromUrl('AAPL', false, true)
        );
        expect(result.current).toBe(DEFAULT_TIMEFRAME);
    });

    it('free query is canonicalized to daily after tier hydration', async () => {
        setSearch('tf=1Hour');
        const { result } = renderHook(() =>
            useTimeframeFromUrl('AAPL', true, true)
        );

        expect(result.current).toBe(DEFAULT_TIMEFRAME);
        await waitFor(() => {
            expect(replaceState).toHaveBeenCalledWith(
                null,
                '',
                '/AAPL/overall?tf=1Day'
            );
        });
    });

    it('uses daily until tier hydration completes', () => {
        setSearch('tf=1Hour');
        const { result } = renderHook(() =>
            useTimeframeFromUrl('AAPL', false, false)
        );

        expect(result.current).toBe(DEFAULT_TIMEFRAME);
        expect(replaceState).not.toHaveBeenCalled();
    });

    it('서버 렌더에서는 URL을 읽지 않고 DEFAULT_TIMEFRAME을 쓴다', () => {
        setSearch('tf=1Hour');
        const seen: string[] = [];
        function Probe() {
            seen.push(useTimeframeFromUrl('AAPL', false, true));
            return null;
        }
        renderToString(createElement(Probe));
        expect(seen).toEqual([DEFAULT_TIMEFRAME]);
    });

    it('뒤로/앞으로 가기(popstate)로 tf가 바뀌면 따라간다', () => {
        setSearch('tf=1Hour');
        const { result } = renderHook(() =>
            useTimeframeFromUrl('AAPL', false, true)
        );
        expect(result.current).toBe('1Hour');

        act(() => {
            setSearch('tf=4Hour');
            window.dispatchEvent(new PopStateEvent('popstate'));
        });
        expect(result.current).toBe('4Hour');
    });
});
