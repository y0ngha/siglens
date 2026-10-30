import { render, screen } from '@testing-library/react';
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
