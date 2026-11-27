import { render, screen } from '@testing-library/react';
import type { SignalType } from '@y0ngha/siglens-core';
import { SignalBadge } from '@/widgets/dashboard/ui/signal/SignalBadge';

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

    it('renders the short-term MA cross labels', () => {
        render(<SignalBadge type="short_ma_bullish_cross" />);
        render(<SignalBadge type="short_ma_bearish_cross" />);
        expect(
            screen.getByText('단기 이동평균선 상승 교차')
        ).toBeInTheDocument();
        expect(
            screen.getByText('단기 이동평균선 하락 교차')
        ).toBeInTheDocument();
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
