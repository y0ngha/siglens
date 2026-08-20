import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const replaceMock = vi.fn();
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: replaceMock, push: pushMock }),
    usePathname: () => '/NVDA',
}));

const searchState = {
    results: [] as unknown[],
    isSearching: false,
    hasQuery: false,
    debouncedQuery: '',
};
vi.mock('@/features/ticker-search/hooks/useTickerSearch', () => ({
    useTickerSearch: () => searchState,
}));

vi.mock('@/features/ticker-search/hooks/useRecentSearches', () => ({
    useRecentSearches: () => ({
        recentSearches: [{ symbol: 'AAPL', label: '애플' }],
        addSearch: vi.fn(),
        removeSearch: vi.fn(),
        clearAll: vi.fn(),
    }),
}));

import {
    SearchOverlayProvider,
    useSearchOverlayTrigger,
} from '@/features/ticker-search/model/SearchOverlayContext';

function Trigger() {
    const overlay = useSearchOverlayTrigger();
    return (
        <button type="button" onClick={() => overlay?.open()}>
            열기
        </button>
    );
}

/**
 * Provider가 소유하는 계약은 둘이다 — **`push`가 아니라 `replace`로 이동할 것**,
 * 그리고 이동하는 동안 **진행 바를 띄울 것**.
 *
 * 앞엣것은 이 기능의 히스토리 설계 전체가 딛고 선 불변식이다. `push`가 되면
 * 히스토리가 `[NVDA, 검색, AAPL]`이 되어 뒤로가기가 빈 검색 화면을 거친다.
 */
describe('SearchOverlayProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        searchState.results = [];
        searchState.hasQuery = false;
        searchState.debouncedQuery = '';
    });

    async function openAndSelect() {
        render(
            <SearchOverlayProvider>
                <Trigger />
            </SearchOverlayProvider>
        );
        await userEvent.click(screen.getByRole('button', { name: '열기' }));
        await userEvent.click(screen.getByRole('button', { name: '애플' }));
    }

    it('push가 아니라 replace로 이동한다', async () => {
        await openAndSelect();

        expect(replaceMock).toHaveBeenCalledWith('/AAPL');
        expect(pushMock).not.toHaveBeenCalled();
    });

    it('이동하는 동안 진행 바와 음성 고지를 띄운다', async () => {
        // 선택 직후 오버레이가 사라지고 화면은 **떠나온 종목 그대로**다(2~3초, LAX
        // 경로 실측). 아무 표시가 없으면 "취소됐다"로 읽혀 사용자가 다시 누른다.
        //
        // 끝나지 않는 promise로 이동이 진행 중인 순간을 붙들어 둔다.
        replaceMock.mockReturnValue(new Promise(() => {}));
        await openAndSelect();

        expect(
            screen.getByRole('progressbar', { name: '종목 페이지 이동 중' })
        ).toBeInTheDocument();
        // 진행 바 자체는 `children presentational`이라 안에 넣은 텍스트가 읽히지
        // 않는다. 고지는 형제 `role="status"`가 맡는다.
        expect(screen.getByRole('status')).toHaveTextContent(
            '종목 페이지로 이동 중'
        );
    });

    it('히스토리 항목을 넣지 못했으면 replace가 아니라 push로 이동한다', async () => {
        // Safari가 `pushState`를 거부하면(SecurityError) 대체할 우리 항목이 없다.
        // 그 상태의 `replace`는 **사용자가 보던 페이지의 항목**을 덮어써, 뒤로가기가
        // 그 페이지를 통째로 건너뛴다.
        const pushState = vi
            .spyOn(history, 'pushState')
            .mockImplementation(() => {
                throw new DOMException('denied', 'SecurityError');
            });

        await openAndSelect();

        expect(pushMock).toHaveBeenCalledWith('/AAPL');
        expect(replaceMock).not.toHaveBeenCalled();
        pushState.mockRestore();
    });

    it('이동을 시작하면 오버레이를 즉시 닫는다', async () => {
        // 대기 상태로 열어두면 갇힘(WCAG 2.1.2)과 popstate 우회가 생긴다 —
        // 닫기는 즉시, 표시는 밖에.
        await openAndSelect();

        expect(
            screen.queryByRole('dialog', { name: '종목 검색' })
        ).not.toBeInTheDocument();
    });
});
