import { render, screen } from '@testing-library/react';
import {
    QuotePrimaryTitle,
    QuoteSecondaryTitle,
} from '@/widgets/dashboard/ui/quote/QuoteTitles';

const PROPS = { symbol: '091160.KS', displayName: '반도체' };

describe('QuotePrimaryTitle', () => {
    it('티커를 읽을 수 있으면 티커를 번역 제외로 그린다', () => {
        render(<QuotePrimaryTitle {...PROPS} tickerIsReadable />);
        expect(screen.getByText('091160.KS')).toHaveAttribute(
            'translate',
            'no'
        );
        expect(screen.queryByText('반도체')).not.toBeInTheDocument();
    });

    it('티커를 읽을 수 없으면 이름을 말줄임 가능한 제목으로 그린다', () => {
        render(<QuotePrimaryTitle {...PROPS} tickerIsReadable={false} />);
        expect(screen.getByText('반도체')).toHaveClass('min-w-0', 'truncate');
        expect(screen.queryByText('091160.KS')).not.toBeInTheDocument();
    });
});

describe('QuoteSecondaryTitle', () => {
    it('티커를 읽을 수 있으면 이름을 보조 제목으로 그린다', () => {
        render(<QuoteSecondaryTitle {...PROPS} tickerIsReadable />);
        expect(screen.getByText('반도체')).toHaveClass('truncate');
        expect(screen.queryByText('091160.KS')).not.toBeInTheDocument();
    });

    it('티커를 읽을 수 없으면 티커를 번역 제외 보조 제목으로 그린다', () => {
        render(<QuoteSecondaryTitle {...PROPS} tickerIsReadable={false} />);
        expect(screen.getByText('091160.KS')).toHaveAttribute(
            'translate',
            'no'
        );
        expect(screen.queryByText('반도체')).not.toBeInTheDocument();
    });
});
