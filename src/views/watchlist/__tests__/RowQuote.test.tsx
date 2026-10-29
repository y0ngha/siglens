vi.mock('@/features/watchlist/hooks/useWatchlistQuote');

import { render, screen } from '@testing-library/react';
import { useWatchlistQuote } from '@/features/watchlist/hooks/useWatchlistQuote';
import { RowQuote } from '@/views/watchlist/ui/list/RowQuote';

const mockUseQuote = vi.mocked(useWatchlistQuote);

describe('RowQuote', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // 세 상태는 제 높이가 서로 달라서(`h-4`·`text-xs`·`text-sm`), 시세가 도착할 때 행이 흔들리지
    // 않으려면 모두 같은 고정 높이 줄에 담겨야 한다.
    it.each([
        {
            state: '자리표시자',
            value: { quote: null, isSettled: false },
            find: (container: HTMLElement) =>
                container.querySelector('.animate-pulse'),
        },
        {
            state: '시세 없음',
            value: { quote: null, isSettled: true },
            find: () => screen.getByText('시세 없음'),
        },
        {
            state: '시세',
            value: {
                quote: { price: 150.25, changePct: 1.5, trend: [148, 150.25] },
                isSettled: true,
            },
            find: (container: HTMLElement) => container.querySelector('dl'),
        },
    ])('$state 상태도 고정 높이 줄(h-5)에 담긴다', ({ value, find }) => {
        mockUseQuote.mockReturnValue(value);
        const { container } = render(<RowQuote symbol="AAPL" enabled />);
        expect(find(container)!.parentElement).toHaveClass(
            'mt-1',
            'flex',
            'h-5',
            'items-center'
        );
    });

    it('enabled를 시세 훅에 그대로 넘긴다', () => {
        mockUseQuote.mockReturnValue({ quote: null, isSettled: false });
        render(<RowQuote symbol="AAPL" enabled={false} />);
        expect(mockUseQuote).toHaveBeenCalledWith('AAPL', false);
    });
});
