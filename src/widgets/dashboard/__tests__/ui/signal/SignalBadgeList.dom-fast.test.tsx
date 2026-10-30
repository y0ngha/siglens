import { render } from '@testing-library/react';
import type { Signal } from '@y0ngha/siglens-core';
import { SignalBadgeList } from '@/widgets/dashboard/ui/signal/SignalBadgeList';

function signal(type: Signal['type']): Signal {
    return { type, direction: 'bullish', phase: 'confirmed', detectedAt: 0 };
}

describe('SignalBadgeList', () => {
    it('신호가 없으면 아무것도 그리지 않는다', () => {
        const { container } = render(<SignalBadgeList signals={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('신호마다 라벨을 그린다', () => {
        const { container } = render(
            <SignalBadgeList
                signals={[signal('golden_cross'), signal('rsi_oversold')]}
            />
        );
        expect(container).toHaveTextContent('골든크로스');
        expect(container).toHaveTextContent('RSI');
    });

    it('배지 사이에만 장식 구분선을 둔다', () => {
        const { container } = render(
            <SignalBadgeList
                signals={[
                    signal('golden_cross'),
                    signal('rsi_oversold'),
                    signal('macd_bullish_cross'),
                ]}
            />
        );
        const separators = container.querySelectorAll('[aria-hidden="true"]');
        expect(separators).toHaveLength(2);
        for (const separator of separators) {
            expect(separator).toHaveTextContent('|');
        }
    });
});
