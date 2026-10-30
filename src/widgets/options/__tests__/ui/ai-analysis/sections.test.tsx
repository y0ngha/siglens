import { render, screen } from '@testing-library/react';
import { PerExpirationSection } from '@/widgets/options/ui/ai-analysis/PerExpirationSection';
import { SignalsSection } from '@/widgets/options/ui/ai-analysis/SignalsSection';

describe('PerExpirationSection', () => {
    it('renders nothing without items', () => {
        const { container } = render(<PerExpirationSection items={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('lists each expiration with its commentary', () => {
        render(
            <PerExpirationSection
                items={[
                    {
                        expirationDate: '2025-06-20',
                        tone: 'bullish',
                        commentary: 'Heavy call buying',
                    },
                    {
                        expirationDate: '2025-07-18',
                        tone: 'bearish',
                        commentary: 'Put hedging',
                    },
                ]}
            />
        );
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
        expect(screen.getByText('2025-06-20')).toBeInTheDocument();
        expect(screen.getByText('Put hedging')).toBeInTheDocument();
    });
});

describe('SignalsSection', () => {
    it('renders nothing without signals', () => {
        const { container } = render(<SignalsSection signals={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('lists each signal message', () => {
        render(
            <SignalsSection
                signals={[
                    { kind: 'bullish', message: 'Call sweeps' },
                    { kind: 'volatility', message: 'IV spike' },
                ]}
            />
        );
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
        expect(screen.getByText('Call sweeps')).toBeInTheDocument();
        expect(screen.getByText('IV spike')).toBeInTheDocument();
    });
});
