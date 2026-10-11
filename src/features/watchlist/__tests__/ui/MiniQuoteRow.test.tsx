const quote = vi.hoisted(() => ({ useWatchlistQuote: vi.fn() }));
vi.mock('@/features/watchlist/hooks/useWatchlistQuote', () => quote);

import { render, screen } from '@testing-library/react';
import { MiniQuote, MiniQuoteRow } from '@/features/watchlist/ui/MiniQuoteRow';

describe('MiniQuote', () => {
    it('요청 전·중에는 자리표시자만 그린다', () => {
        quote.useWatchlistQuote.mockReturnValue({
            quote: null,
            isSettled: false,
        });
        const { container } = render(
            <MiniQuote symbol="AAPL" enabled={false} />
        );
        expect(container.firstElementChild).toHaveAttribute(
            'aria-hidden',
            'true'
        );
        expect(quote.useWatchlistQuote).toHaveBeenCalledWith('AAPL', false);
    });

    it('끝났는데 시세가 없으면 "시세 없음"', () => {
        quote.useWatchlistQuote.mockReturnValue({
            quote: null,
            isSettled: true,
        });
        render(<MiniQuote symbol="AAPL" enabled />);
        expect(screen.getByText('시세 없음')).toBeInTheDocument();
    });

    it('시세가 있으면 가격과 부호 붙은 등락률', () => {
        quote.useWatchlistQuote.mockReturnValue({
            quote: { price: 150.25, changePct: -1.5, trend: [151, 150.25] },
            isSettled: true,
        });
        render(<MiniQuote symbol="AAPL" enabled />);
        expect(screen.getByText(/150\.25/)).toBeInTheDocument();
        expect(screen.getByText('-1.5%')).toBeInTheDocument();
    });
});

describe('MiniQuoteRow', () => {
    it('행 전체가 종목 링크이고 누르면 onNavigate를 부른다', () => {
        quote.useWatchlistQuote.mockReturnValue({
            quote: null,
            isSettled: true,
        });
        const onNavigate = vi.fn();
        render(
            <ul>
                <MiniQuoteRow
                    item={{ symbol: 'AAPL', name: '애플' }}
                    quotesEnabled
                    onNavigate={onNavigate}
                />
            </ul>
        );
        const link = screen.getByRole('link', { name: /애플/ });
        expect(link).toHaveAttribute('href', '/AAPL');
        link.click();
        expect(onNavigate).toHaveBeenCalledTimes(1);
    });
});
