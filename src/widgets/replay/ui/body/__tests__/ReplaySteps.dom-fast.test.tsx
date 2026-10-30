import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReplayTool } from '@/shared/lib/replay/replayScript';
import { ReplaySteps } from '@/widgets/replay/ui/body/ReplaySteps';

const TOOLS: readonly ReplayTool[] = [
    {
        label: 'Quote',
        pendingLabel: 'Checking quote',
        subject: 'AAPL',
        ms: 500,
    },
    {
        label: 'News',
        pendingLabel: 'Checking news',
        subject: '7 days',
        ms: 500,
    },
    {
        label: 'Filings',
        pendingLabel: 'Checking filings',
        subject: 'FY25',
        ms: 500,
    },
];

describe('ReplaySteps', () => {
    it('shows the done label for finished steps and the pending label for the rest', () => {
        render(<ReplaySteps tools={TOOLS} done={1} />);

        expect(screen.getByText('Quote')).toBeInTheDocument();
        expect(screen.getByText('Checking news')).toBeInTheDocument();
        expect(screen.getByText('Checking filings')).toBeInTheDocument();
        expect(screen.queryByText('News')).not.toBeInTheDocument();
        expect(screen.queryByText('Filings')).not.toBeInTheDocument();
    });

    it('styles only the finished steps as done', () => {
        render(<ReplaySteps tools={TOOLS} done={1} />);
        const [first, second, third] = screen.getAllByRole('listitem');

        expect(first).toHaveClass('border-secondary-700');
        expect(second).toHaveClass('border-border-control');
        expect(third).toHaveClass('border-border-control');
    });

    it('renders every subject next to its label', () => {
        render(<ReplaySteps tools={TOOLS} done={3} />);

        expect(screen.getByText('AAPL')).toBeInTheDocument();
        expect(screen.getByText('7 days')).toBeInTheDocument();
        expect(screen.getByText('FY25')).toBeInTheDocument();
    });
});
