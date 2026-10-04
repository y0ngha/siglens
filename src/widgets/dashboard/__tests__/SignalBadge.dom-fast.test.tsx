import { render, screen } from '@testing-library/react';
import { SignalBadge } from '@/widgets/dashboard/SignalBadge';
import type { SignalType } from '@y0ngha/siglens-core';

describe('SignalBadge', () => {
    it('renders RSI oversold label', () => {
        render(<SignalBadge type={'rsi_oversold' as SignalType} />);
        expect(screen.getByText('RSI 과매도')).toBeInTheDocument();
    });

    it('renders golden cross label', () => {
        render(<SignalBadge type={'golden_cross' as SignalType} />);
        expect(screen.getByText('골든크로스')).toBeInTheDocument();
    });

    it('renders death cross label', () => {
        render(<SignalBadge type={'death_cross' as SignalType} />);
        expect(screen.getByText('데드크로스')).toBeInTheDocument();
    });

    it('renders MACD bullish cross label', () => {
        render(<SignalBadge type={'macd_bullish_cross' as SignalType} />);
        expect(screen.getByText('MACD 상승교차')).toBeInTheDocument();
    });

    it('renders bollinger lower bounce label', () => {
        render(<SignalBadge type={'bollinger_lower_bounce' as SignalType} />);
        expect(screen.getByText('볼린저 하단 반등')).toBeInTheDocument();
    });
});
