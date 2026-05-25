import { render, screen } from '@testing-library/react';
import { OptionsAiAnalysisSkeleton } from '@/widgets/options/OptionsAiAnalysisSkeleton';

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

describe('OptionsAiAnalysisSkeleton', () => {
    it('renders aria-busy section', () => {
        render(<OptionsAiAnalysisSkeleton />);
        const section = screen.getByLabelText('AI 옵션 분석 불러오는 중');
        expect(section).toHaveAttribute('aria-busy', 'true');
    });

    it('renders spinner and status text', () => {
        render(<OptionsAiAnalysisSkeleton />);
        expect(screen.getByText('AI 옵션 분석 생성 중')).toBeInTheDocument();
    });

    it('renders skeleton lines', () => {
        const { container } = render(<OptionsAiAnalysisSkeleton />);
        const lines = container.querySelectorAll('.animate-pulse');
        expect(lines.length).toBe(5);
    });
});
