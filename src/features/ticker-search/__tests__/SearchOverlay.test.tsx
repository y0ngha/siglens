import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    isError: false,
    // 입력과 같아야 첫 결과를 신뢰한다 — 디바운스 지연 결과로 이동하는 것을 막는 가드.
    debouncedQuery: '',
};
vi.mock('@/features/ticker-search/hooks/useTickerSearch', () => ({
    useTickerSearch: () => searchState,
}));

const addSearchMock = vi.fn();
const recentState = {
    recentSearches: [] as { symbol: string; label: string }[],
};
vi.mock('@/features/ticker-search/hooks/useRecentSearches', () => ({
    useRecentSearches: () => ({
        recentSearches: recentState.recentSearches,
        addSearch: addSearchMock,
        removeSearch: vi.fn(),
        clearAll: vi.fn(),
    }),
}));

import { SearchOverlay } from '@/features/ticker-search/ui/SearchOverlay';

describe('SearchOverlay', () => {
    const onNavigateMock = vi.fn();
    function renderOverlay(onClose = vi.fn()) {
        return {
            onClose,
            ...render(
                <SearchOverlay
                    isOpen
                    onClose={onClose}
                    onNavigate={onNavigateMock}
                />
            ),
        };
    }

    beforeEach(() => {
        vi.clearAllMocks();
        searchState.results = [];
        searchState.isSearching = false;
        searchState.hasQuery = false;
        searchState.debouncedQuery = '';
        searchState.isError = false;
        recentState.recentSearches = [];
        onNavigateMock.mockClear();
    });

    it('닫혀 있으면 아무것도 렌더하지 않는다', () => {
        const { container } = render(
            <SearchOverlay
                isOpen={false}
                onClose={vi.fn()}
                onNavigate={onNavigateMock}
            />
        );
        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('열리면 modal dialog로 렌더된다', () => {
        renderOverlay();
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAccessibleName('종목 검색');
    });

    it('document.body로 포털된다', () => {
        // 헤더는 `backdrop-blur-md`라 `position: fixed` 자손의 containing block이 된다.
        // 포털이 없으면 오버레이가 뷰포트가 아니라 56px 헤더 박스만 덮는다.
        const { container } = renderOverlay();
        expect(container).toBeEmptyDOMElement();
        expect(document.body).toContainElement(screen.getByRole('dialog'));
    });

    it('입력이 DOM 순서상 첫 포커서블이다', () => {
        // iOS Safari는 탭 태스크와 동기적으로 이어지지 않은 focus()로 키보드를 올리지
        // 않는다. 닫기 버튼이 앞서면 focus trap이 그쪽을 잡아 키보드가 안 뜬다 —
        // 이 오버레이의 존재 이유가 무너진다.
        renderOverlay();
        const dialog = screen.getByRole('dialog');
        const focusables = dialog.querySelectorAll<HTMLElement>(
            'input, button, a[href], [tabindex]:not([tabindex="-1"])'
        );
        expect(focusables[0]?.tagName).toBe('INPUT');
    });

    it('입력 전에는 세 자산군의 인기 종목을 보여준다', () => {
        // 첫 방문자가 보는 유일한 화면이다. 미국만 있으면 한국·코인 사용자에게
        // "입력 전에도 볼 게 있다"가 성립하지 않는다.
        renderOverlay();
        expect(screen.getByText('인기 종목 · 미국')).toBeInTheDocument();
        expect(screen.getByText('인기 종목 · 한국')).toBeInTheDocument();
        expect(screen.getByText('인기 종목 · 암호화폐')).toBeInTheDocument();
    });

    it('최근 검색을 저장된 만큼 전부 보여준다', () => {
        // 홈 히어로는 첫 화면 세로가 귀해 4개로 자르지만(HERO_RECENT_CHIP_LIMIT),
        // 오버레이는 목록이 항상 스크롤되므로 자를 이유가 없다. 저장된 7개가 다
        // 보여야 "최근 본 종목 사이를 오간다"는 이 화면의 용도가 성립한다.
        recentState.recentSearches = Array.from({ length: 7 }, (_, i) => ({
            symbol: `SYM${i}`,
            label: `종목${i}`,
        }));
        renderOverlay();

        expect(
            screen.getByRole('button', { name: '종목0' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '종목6' })
        ).toBeInTheDocument();
    });

    it('최근 검색이 있으면 함께 보여준다', () => {
        recentState.recentSearches = [{ symbol: 'NVDA', label: '엔비디아' }];
        renderOverlay();
        expect(screen.getByText('최근 검색')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '엔비디아' })
        ).toBeInTheDocument();
    });

    it('선택하면 provider에 심볼을 넘긴다', async () => {
        // 이동 방식(replace)과 진행 바는 provider의 책임이다 — 오버레이는 무엇을
        // 골랐는지만 전달한다. 경계가 이렇게 갈려야 대기 표시를 오버레이 밖에 둘 수 있다.
        recentState.recentSearches = [{ symbol: 'AAPL', label: '애플' }];
        renderOverlay();

        await userEvent.click(screen.getByRole('button', { name: '애플' }));

        // 이동 자체는 provider가 소유한다 — 오버레이는 심볼만 넘긴다.
        expect(onNavigateMock).toHaveBeenCalledWith('AAPL');
        expect(addSearchMock).toHaveBeenCalledWith({
            symbol: 'AAPL',
            label: '애플',
        });
    });

    it('이동할 때는 onClose가 아니라 onNavigate로 닫는다', async () => {
        // `onClose`는 `history.back()`으로 이어진다. `router.replace`가 우리 항목을
        // 목적지로 이미 대체했으므로, 여기서 back()이 돌면 **방금 한 이동이 취소된다**.
        // 실제로 그 형태로 만들었다가 브라우저 실증에서 잡혔다.
        recentState.recentSearches = [{ symbol: 'AAPL', label: '애플' }];
        const { onClose } = renderOverlay();

        await userEvent.click(screen.getByRole('button', { name: '애플' }));

        expect(onNavigateMock).toHaveBeenCalledWith('AAPL');
        expect(onClose).not.toHaveBeenCalled();
    });

    it('Enter는 첫 결과로 이동한다', async () => {
        // 모바일 인라인 자동완성에 있던 기능이다 — 오버레이로 옮기며 빠뜨리면
        // 티커를 아는 사용자가 디바운스+왕복+탭을 치르게 된다.
        searchState.hasQuery = true;
        searchState.debouncedQuery = 'AAPL';
        searchState.results = [
            {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                exchange: 'NASDAQ',
                exchangeFullName: 'NASDAQ Global Select',
                koreanName: '애플',
            },
        ];
        renderOverlay();

        await userEvent.type(screen.getByRole('searchbox'), 'AAPL{Enter}');
        expect(onNavigateMock).toHaveBeenCalledWith('AAPL');
    });

    it('결과가 아직 이전 질의 것이면 첫 결과로 이동하지 않는다', async () => {
        // 디바운스(300ms) 때문에 `results`가 한 박자 전 질의의 것일 수 있다.
        // 가드가 없으면 `삼성`의 첫 결과(005930.KS)로 가버린다 — 사용자가 방금
        // 친 `카카오`와 무관한 종목이다. 가드가 있으면 한글이라 직행도 막혀
        // **아무 데도 가지 않는다**. 두 동작이 갈리므로 가드를 지우면 이 테스트가 깨진다.
        searchState.hasQuery = true;
        searchState.debouncedQuery = '삼성';
        searchState.results = [
            {
                symbol: '005930.KS',
                name: '삼성전자',
                exchange: 'KSC',
                exchangeFullName: 'Korea Exchange',
                koreanName: '삼성전자',
            },
        ];
        renderOverlay();

        await userEvent.type(screen.getByRole('searchbox'), '카카오{Enter}');

        expect(onNavigateMock).not.toHaveBeenCalled();
    });

    it('조회 실패를 결과 없음과 구분해 보여준다', async () => {
        // 검색 서버가 죽었는데 "결과가 없습니다"로 보이면 사용자는 없는 종목을 찾은
        // 줄 안다. 한글 질의라면 "티커로 쳐보세요"라는 **틀린 안내**까지 나간다.
        searchState.hasQuery = true;
        searchState.isError = true;
        searchState.results = [];
        renderOverlay();

        await userEvent.type(screen.getByRole('searchbox'), '삼성');

        expect(screen.getByText(/불러오지 못했어요/)).toBeInTheDocument();
        expect(screen.queryByText(/검색 결과가 없습니다/)).toBeNull();
        expect(
            screen.queryByText(/티커\(예: AAPL\)로 검색해 보세요/)
        ).toBeNull();
    });

    it('한글 검색이 비면 티커로 다시 치라고 안내한다', async () => {
        // 한글 질의는 Enter 직행이 막혀 있어(회사명을 URL로 삼을 수 없다) FMP가
        // 색인하지 않는 종목이면 빠져나갈 길이 없다. 이 안내가 유일한 출구다.
        searchState.hasQuery = true;
        searchState.debouncedQuery = '삼성';
        searchState.results = [];
        renderOverlay();

        await userEvent.type(screen.getByRole('searchbox'), '삼성');

        expect(
            screen.getByText(/티커\(예: AAPL\)로 검색해 보세요/)
        ).toBeInTheDocument();
    });

    it('결과가 없음을 확인했으면 Enter가 입력한 티커로 직행한다', async () => {
        // FMP 검색이 색인하지 않는 종목에 도달할 유일한 경로다.
        // 이게 없으면 "검색 결과가 없습니다"가 막다른 길이 된다.
        searchState.hasQuery = true;
        searchState.debouncedQuery = 'brk.b';
        searchState.results = [];
        renderOverlay();

        await userEvent.type(screen.getByRole('searchbox'), 'brk.b{Enter}');
        expect(onNavigateMock).toHaveBeenCalledWith('BRK.B');
    });

    it('조회가 끝나면 보류해 둔 검색 의도를 처리한다', async () => {
        // 마지막 글자를 치고 곧바로 검색 키를 누르면 결과는 아직 이전 질의의 것이다.
        // 그 순간 결정하지 않고 의도만 남겼다가, 결과가 도착하면 그때 이동한다 —
        // 그래야 검색 키가 먹통으로 보이지도, 엉뚱한 종목으로 가지도 않는다.
        searchState.hasQuery = true;
        searchState.debouncedQuery = '';
        searchState.isSearching = true;
        searchState.results = [];
        const { rerender } = renderOverlay();

        await userEvent.type(screen.getByRole('searchbox'), 'appl{Enter}');
        expect(onNavigateMock).not.toHaveBeenCalled();

        // 결과 도착.
        searchState.debouncedQuery = 'appl';
        searchState.isSearching = false;
        searchState.results = [
            {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                exchange: 'NASDAQ',
                exchangeFullName: 'NASDAQ Global Select',
                koreanName: '애플',
            },
        ];
        rerender(
            <SearchOverlay
                isOpen
                onClose={vi.fn()}
                onNavigate={onNavigateMock}
            />
        );

        await waitFor(() =>
            expect(onNavigateMock).toHaveBeenCalledWith('AAPL')
        );
    });

    it('계속 타이핑하면 보류해 둔 검색 의도가 무효가 된다', async () => {
        // Enter를 눌러 놓고 질의를 바꾸면, 새 질의가 결착되는 순간 **사용자가
        // 요청하지 않은 이동**이 일어난다. 리뷰에서 잡힌 회귀다.
        searchState.hasQuery = true;
        searchState.debouncedQuery = '';
        searchState.isSearching = true;
        searchState.results = [];
        const { rerender } = renderOverlay();

        const input = screen.getByRole('searchbox');
        await userEvent.type(input, 'appl{Enter}');
        await userEvent.clear(input);
        await userEvent.type(input, 'tsla');

        // `tsla` 조회가 결착된다.
        searchState.debouncedQuery = 'tsla';
        searchState.isSearching = false;
        searchState.results = [];
        rerender(
            <SearchOverlay
                isOpen
                onClose={vi.fn()}
                onNavigate={onNavigateMock}
            />
        );

        await waitFor(() => expect(searchState.isSearching).toBe(false));
        expect(onNavigateMock).not.toHaveBeenCalled();
    });

    it('조회가 안 끝났으면 Enter가 입력한 티커로 직행하지 않는다', async () => {
        // 이때의 빈 결과는 "없다"가 아니라 "아직 모른다"다. 구분하지 않으면
        // `apple`을 치고 곧바로 검색 키를 누른 사용자가 AAPL이 아니라 `/APPLE`로
        // 가서 404를 본다. 300ms 뒤 한 번 더 누르면 정상 동작한다.
        searchState.hasQuery = true;
        searchState.debouncedQuery = '';
        searchState.isSearching = true;
        searchState.results = [];
        renderOverlay();

        await userEvent.type(screen.getByRole('searchbox'), 'apple{Enter}');
        expect(onNavigateMock).not.toHaveBeenCalled();
    });

    it('조회에 실패했으면 Enter가 입력한 티커로 직행하지 않는다', async () => {
        // 실패한 조회의 빈 결과도 "없다"가 아니다. 실패 화면을 보여주는 편이
        // 존재하지 않는 종목 페이지로 보내는 것보다 정직하다.
        searchState.hasQuery = true;
        searchState.debouncedQuery = 'apple';
        searchState.isError = true;
        searchState.results = [];
        renderOverlay();

        await userEvent.type(screen.getByRole('searchbox'), 'apple{Enter}');
        expect(onNavigateMock).not.toHaveBeenCalled();
    });

    it('한글 입력은 Enter로 직행시키지 않는다', async () => {
        // `삼성전자`를 그대로 URL로 삼으면 없는 페이지로 보낸다.
        searchState.hasQuery = true;
        searchState.results = [];
        renderOverlay();

        await userEvent.type(screen.getByRole('searchbox'), '삼성전자{Enter}');
        expect(onNavigateMock).not.toHaveBeenCalled();
    });

    it('보던 종목을 다시 고르면 이동 없이 닫는다', async () => {
        // usePathname mock이 '/NVDA'이므로 NVDA 선택은 같은 경로다. 이동이 없으니
        // 히스토리 항목을 되돌리는 `onClose`가 맞다 — `onNavigate`를 쓰면 우리가 넣은
        // 항목이 소비되지 않은 채 남아 뒤로가기가 한 번 헛돈다.
        recentState.recentSearches = [{ symbol: 'NVDA', label: '엔비디아' }];
        const { onClose } = renderOverlay();

        await userEvent.click(screen.getByRole('button', { name: '엔비디아' }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onNavigateMock).not.toHaveBeenCalled();
    });

    it('티커 형태가 아니면 Enter로 이동하지 않는다', async () => {
        // 입력이 그대로 URL이 되므로 `../` 같은 값이 통과하면 안 된다.
        searchState.hasQuery = true;
        searchState.results = [];
        renderOverlay();

        await userEvent.type(screen.getByRole('searchbox'), '../admin{Enter}');
        expect(onNavigateMock).not.toHaveBeenCalled();
    });

    it('취소 버튼이 onClose를 호출한다', async () => {
        const { onClose } = renderOverlay();

        await userEvent.click(screen.getByRole('button', { name: '취소' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('결과를 행으로 렌더하고, 고른 행의 심볼을 넘긴다', async () => {
        // 이 기능이 존재하는 이유가 **결과를 전폭으로 보여주는 것**인데, 목록 렌더링
        // 자체를 아무 테스트도 잡지 않았다(감사에서 `results.map`을 빈 배열로 바꿔도
        // 전 테스트가 통과했다). 행이 그려지는지, 그리고 **누른 그 행**이 넘어가는지를
        // 함께 본다.
        searchState.hasQuery = true;
        searchState.debouncedQuery = 'a';
        searchState.results = [
            {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                exchange: 'NASDAQ',
                exchangeFullName: 'NASDAQ Global Select',
                koreanName: '애플',
            },
            {
                symbol: '005930.KS',
                name: 'Samsung Electronics',
                exchange: 'KSC',
                exchangeFullName: 'Korea Exchange',
                koreanName: '삼성전자',
            },
        ];
        renderOverlay();

        expect(screen.getAllByTestId('market-badge')).toHaveLength(2);
        await userEvent.click(screen.getByRole('button', { name: /삼성전자/ }));

        expect(onNavigateMock).toHaveBeenCalledWith('005930.KS');
    });

    it('입력에 자동으로 포커스가 잡힌다', () => {
        renderOverlay();
        expect(screen.getByRole('searchbox')).toHaveFocus();
    });

    it('입력의 포커스는 autoFocus로 준다 (소스 고정)', () => {
        // 위 테스트만으로는 부족하다 — jsdom에서는 `useFocusTrap`도 첫 포커서블로
        // 포커스를 옮기므로 `autoFocus`를 지워도 최종 상태가 같다. 실제 기기에서는
        // 다르다: 트랩의 포커스는 `useEffect`(passive)라 탭 태스크보다 늦고, iOS
        // Safari는 제스처와 동기적으로 이어지지 않은 `focus()`로 키보드를 올리지
        // 않는다. `autoFocus`는 React가 **commit 단계에서 동기 호출**하는 유일한
        // 수단이라, 지우면 키보드가 안 뜨고 이 화면의 존재 이유가 사라진다.
        //
        // 그래서 소스에 못을 박는다. `SearchResultRow`의 prefetch 부재 검사와 같은
        // 방식이다 — 런타임으로 확인할 수 없는 계약을 지키는 마지막 수단.
        const source = readFileSync(
            join(
                process.cwd(),
                'src/features/ticker-search/ui/SearchOverlay.tsx'
            ),
            'utf8'
        );
        expect(source).toMatch(/<input\s[\s\S]*?\bautoFocus\b/);
    });

    it('Escape로 닫는다', async () => {
        const { onClose } = renderOverlay();
        await userEvent.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('한글 조합 중의 Enter는 첫 결과로 이동시키지 않는다', async () => {
        // 한글 IME는 음절을 **확정**할 때도 Enter를 쓴다. 거르지 않으면 `삼성전`까지
        // 친 상태의 확정 Enter가 `삼성` 결과로 이동시킨다.
        searchState.hasQuery = true;
        searchState.debouncedQuery = '삼성';
        searchState.results = [
            {
                symbol: '005930.KS',
                name: 'Samsung Electronics',
                exchange: 'KSC',
                exchangeFullName: 'Korea Exchange',
                koreanName: '삼성전자',
            },
        ];
        renderOverlay();

        const input = screen.getByRole('searchbox');
        await userEvent.type(input, '삼성');
        fireEvent.keyDown(input, { key: 'Enter', isComposing: true });

        expect(onNavigateMock).not.toHaveBeenCalled();
    });

    it('디바운스 질의에 공백이 붙어도 첫 결과를 신뢰한다', async () => {
        // 양쪽을 trim하지 않으면 `"apple "`은 `"apple"`과 영영 같아지지 않는다.
        // 그러면 화면에 첫 결과가 떠 있는데도 무시하고 `/APPLE`로 직행해 404가 난다.
        searchState.hasQuery = true;
        searchState.debouncedQuery = 'apple ';
        searchState.results = [
            {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                exchange: 'NASDAQ',
                exchangeFullName: 'NASDAQ Global Select',
                koreanName: '애플',
            },
        ];
        renderOverlay();

        await userEvent.type(screen.getByRole('searchbox'), 'apple{Enter}');
        expect(onNavigateMock).toHaveBeenCalledWith('AAPL');
    });

    it('전체 삭제 후 포커스가 입력으로 돌아온다', async () => {
        // 이 버튼은 자기 자신이 든 섹션을 통째로 언마운트시킨다. 두면 포커스가
        // <body>로 떨어져 다음 Tab이 문서 처음부터 시작한다(WCAG 2.4.3).
        recentState.recentSearches = [{ symbol: 'AAPL', label: '애플' }];
        renderOverlay();

        await userEvent.click(
            screen.getByRole('button', { name: '전체 삭제' })
        );
        expect(screen.getByRole('searchbox')).toHaveFocus();
    });

    it('오버레이는 채팅 FAB보다 위에 뜨고, 목록은 항상 넘친다', () => {
        // z-70: `/[symbol]`의 FloatingChatButton이 z-60이라 z-50이면 그 버튼이
        // 오버레이 **위**에 뜬다. pb-[100dvh]: 이 여백이 없으면 콘텐츠가 컨테이너를
        // 넘지 않아 스크롤 자체가 불가능해지고, 키보드에 가린 행에 영영 못 닿는다.
        // 둘 다 실제로 겪고 고친 회귀라 클래스 자체를 못으로 박아 둔다.
        renderOverlay();
        const dialog = screen.getByRole('dialog');
        expect(dialog.className).toContain('z-70');

        const scroller = dialog.querySelector('.overflow-y-auto');
        expect(scroller?.className).toContain('pb-[100dvh]');
    });
});
