import { render, screen } from '@testing-library/react';
import { AnalysisBadge } from '@/widgets/options/ui/ai-analysis/AnalysisBadge';
import { SignalBadge } from '@/widgets/options/ui/ai-analysis/SignalBadge';
import { ToneBadge } from '@/widgets/options/ui/ai-analysis/ToneBadge';
import { TONE_CLASS } from '@/widgets/options/utils/optionsAnalysisBadges';

describe('AnalysisBadge', () => {
    it('renders the label with the given classes', () => {
        render(<AnalysisBadge label="Label" classes={TONE_CLASS.bullish} />);
        const badge = screen.getByText('Label');
        expect(badge.className).toContain('text-ui-success-text');
        expect(badge.className).toContain('bg-chart-bullish/10');
        expect(badge.className).toContain('border-chart-bullish/30');
    });
});

describe('ToneBadge', () => {
    it.each(['bullish', 'bearish', 'cautious', 'neutral'] as const)(
        'renders a localized label for %s',
        tone => {
            const { container } = render(<ToneBadge tone={tone} />);
            expect(container.textContent).not.toBe('');
            expect(container.textContent).not.toContain('optionsTone');
        }
    );
});

describe('SignalBadge', () => {
    it.each(['bullish', 'bearish', 'volatility', 'neutral'] as const)(
        'renders a localized label for %s',
        kind => {
            const { container } = render(<SignalBadge kind={kind} />);
            expect(container.textContent).not.toBe('');
            expect(container.textContent).not.toContain('optionsSignalKind');
        }
    );

    it('uses the cautious palette for volatility', () => {
        const { container } = render(<SignalBadge kind="volatility" />);
        expect(container.firstElementChild?.className).toContain(
            'text-ui-warning-text'
        );
    });
});
