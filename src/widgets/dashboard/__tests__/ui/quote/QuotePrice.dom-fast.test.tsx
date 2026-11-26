import { render, screen } from '@testing-library/react';
import { koMessage } from '@/shared/test-utils/koMessage';
import { QuotePrice } from '@/widgets/dashboard/ui/quote/QuotePrice';

describe('QuotePrice', () => {
    it('통화 기호와 천 단위 구분된 가격을 그린다', () => {
        render(<QuotePrice price={1234.5} currencySymbol="$" />);
        expect(screen.getByText('$1,234.5')).toBeInTheDocument();
    });

    it('시장의 통화 기호를 그대로 쓴다', () => {
        render(<QuotePrice price={70000} currencySymbol="₩" />);
        expect(screen.getByText('₩70,000')).toBeInTheDocument();
    });
});

describe('QuotePrice 가격 0', () => {
    describe('시세 조회 실패로 가격이 0일 때', () => {
        it('통화 기호와 0 대신 -를 그리고 스크린리더에는 시세 없음을 알린다', () => {
            render(<QuotePrice price={0} currencySymbol="₩" />);
            expect(screen.getByText('-')).toHaveAttribute(
                'aria-hidden',
                'true'
            );
            expect(
                screen.getByText(
                    koMessage(
                        'widgets.dashboard.MarketDataErrorNotice.priceUnavailable'
                    )
                )
            ).toHaveClass('sr-only');
            expect(screen.queryByText(/₩/)).not.toBeInTheDocument();
        });
    });
});
