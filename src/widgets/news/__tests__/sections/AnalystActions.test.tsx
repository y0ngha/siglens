import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnalystActions } from '@/widgets/news/sections/AnalystActions';
import type { GradesEvent } from '@y0ngha/siglens-core';

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

const EVENTS: GradesEvent[] = [
    {
        symbol: 'AAPL',
        date: '2025-01-15',
        action: 'upgrade' as const,
        gradingCompany: 'Goldman Sachs',
        previousGrade: 'Neutral',
        newGrade: 'Buy',
    },
    {
        symbol: 'AAPL',
        date: '2025-01-10',
        action: 'downgrade' as const,
        gradingCompany: 'Morgan Stanley',
        previousGrade: 'Overweight',
        newGrade: 'Equal-weight',
    },
    {
        symbol: 'AAPL',
        date: '2025-01-05',
        action: 'initiated' as const,
        gradingCompany: 'JP Morgan',
        previousGrade: null,
        newGrade: 'Overweight',
    },
];

describe('AnalystActions', () => {
    it('renders empty state when no events', () => {
        render(<AnalystActions events={[]} />);
        expect(
            screen.getByText(/최근 애널리스트 등급 변경이 없습니다/)
        ).toBeInTheDocument();
    });

    it('renders heading', () => {
        render(<AnalystActions events={EVENTS} />);
        expect(
            screen.getByRole('heading', { name: /애널리스트 등급 변경/ })
        ).toBeInTheDocument();
    });

    it('renders grade events with company names', () => {
        render(<AnalystActions events={EVENTS} />);
        expect(screen.getByText('Goldman Sachs')).toBeInTheDocument();
        expect(screen.getByText('Morgan Stanley')).toBeInTheDocument();
        expect(screen.getByText('JP Morgan')).toBeInTheDocument();
    });

    it('renders action labels', () => {
        render(<AnalystActions events={EVENTS} />);
        expect(screen.getByText('상향')).toBeInTheDocument();
        expect(screen.getByText('하향')).toBeInTheDocument();
        expect(screen.getByText('신규 커버리지')).toBeInTheDocument();
    });

    it('renders grade transition for upgrade/downgrade', () => {
        render(<AnalystActions events={EVENTS} />);
        expect(screen.getByText('Neutral')).toBeInTheDocument();
        expect(screen.getByText('Buy')).toBeInTheDocument();
    });

    it('renders only new grade for initiated coverage', () => {
        render(<AnalystActions events={EVENTS} />);
        const allOverweight = screen.getAllByText('Overweight');
        expect(allOverweight.length).toBeGreaterThanOrEqual(1);
    });

    it('paginates and shows more button', () => {
        const manyEvents: GradesEvent[] = Array.from({ length: 8 }, (_, i) => ({
            symbol: 'AAPL',
            date: `2025-01-${String(i + 1).padStart(2, '0')}`,
            action: 'maintained' as const,
            gradingCompany: `Firm ${i}`,
            previousGrade: 'Hold',
            newGrade: 'Hold',
        }));

        render(<AnalystActions events={manyEvents} />);
        expect(screen.getByText(/더보기/)).toBeInTheDocument();
        expect(screen.getByText(/3개 남음/)).toBeInTheDocument();
    });

    it('loads more events on button click', async () => {
        const user = userEvent.setup();
        const manyEvents: GradesEvent[] = Array.from({ length: 8 }, (_, i) => ({
            symbol: 'AAPL',
            date: `2025-01-${String(i + 1).padStart(2, '0')}`,
            action: 'maintained' as const,
            gradingCompany: `Firm ${i}`,
            previousGrade: 'Hold',
            newGrade: 'Hold',
        }));

        render(<AnalystActions events={manyEvents} />);
        await user.click(screen.getByText(/더보기/));
        expect(screen.queryByText(/더보기/)).not.toBeInTheDocument();
    });
});
