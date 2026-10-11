import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useOpenTickerSearch } from '@/features/watchlist/hooks/useOpenTickerSearch';
import {
    HEADER_SEARCH_INPUT_ID,
    SearchOverlayTriggerContext,
} from '@/shared/model/SearchOverlayTriggerContext';

function setBelowLg(matches: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    }));
}

function withOverlay(open: () => void) {
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <SearchOverlayTriggerContext value={{ open }}>
                {children}
            </SearchOverlayTriggerContext>
        );
    };
}

describe('useOpenTickerSearch', () => {
    let input: HTMLInputElement;
    beforeEach(() => {
        input = document.createElement('input');
        input.id = HEADER_SEARCH_INPUT_ID;
        document.body.append(input);
    });
    afterEach(() => input.remove());

    it('lg 미만이면 검색 오버레이를 연다', () => {
        setBelowLg(true);
        const open = vi.fn();
        const { result } = renderHook(() => useOpenTickerSearch(), {
            wrapper: withOverlay(open),
        });
        result.current();
        expect(open).toHaveBeenCalledTimes(1);
        expect(input).not.toHaveFocus();
    });

    it('lg 이상이면 오버레이 대신 헤더 검색 입력에 포커스를 보낸다', () => {
        setBelowLg(false);
        const open = vi.fn();
        const { result } = renderHook(() => useOpenTickerSearch(), {
            wrapper: withOverlay(open),
        });
        result.current();
        expect(open).not.toHaveBeenCalled();
        expect(input).toHaveFocus();
    });

    it('오버레이 프로바이더가 없으면 뷰포트와 무관하게 입력 포커스만 시도한다', () => {
        setBelowLg(true);
        const { result } = renderHook(() => useOpenTickerSearch());
        result.current();
        expect(input).toHaveFocus();
    });
});
