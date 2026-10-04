import { render, screen } from '@testing-library/react';
import { NewsAiSummarySkeleton } from '@/widgets/news/NewsAiSummarySkeleton';

describe('NewsAiSummarySkeleton', () => {
    it('renders aria-busy section', () => {
        render(<NewsAiSummarySkeleton />);
        const section = screen.getByLabelText('AI 뉴스 종합 분석');
        expect(section).toHaveAttribute('aria-busy', 'true');
    });

    it('renders heading', () => {
        render(<NewsAiSummarySkeleton />);
        expect(
            screen.getByRole('heading', { name: 'AI 뉴스 종합 분석' })
        ).toBeInTheDocument();
    });

    it('renders progress text', () => {
        render(<NewsAiSummarySkeleton />);
        expect(screen.getByText('AI 뉴스 분석 진행 중…')).toBeInTheDocument();
    });

    it('renders skeleton lines', () => {
        const { container } = render(<NewsAiSummarySkeleton />);
        const lines = container.querySelectorAll(
            '[aria-hidden="true"].bg-secondary-700'
        );
        expect(lines).toHaveLength(3);
    });

    it('includes spinner with motion-reduce support', () => {
        const { container } = render(<NewsAiSummarySkeleton />);
        const spinner = container.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
    });
});
