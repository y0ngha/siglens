import { screen } from '@testing-library/react';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { OptionsAiAnalysisStaleNotice } from '@/widgets/options/OptionsAiAnalysisStaleNotice';

describe('OptionsAiAnalysisStaleNotice', () => {
    it('renders the AI options analysis heading', () => {
        renderWithIntl(<OptionsAiAnalysisStaleNotice />);
        expect(
            screen.getByRole('heading', { name: 'AI 옵션 분석' })
        ).toBeInTheDocument();
    });

    it('explains that stale OI data blocks the analysis', () => {
        renderWithIntl(<OptionsAiAnalysisStaleNotice />);
        expect(
            screen.getByText('지금은 AI 옵션 분석을 생성하기 어려워요.')
        ).toBeInTheDocument();
        expect(screen.getByText(/Max Pain, P\/C Ratio/)).toBeInTheDocument();
        expect(
            screen.getByText(/한국 시간 저녁 8시\(20:00\) 이후/)
        ).toBeInTheDocument();
    });

    it('wraps the notice in a labelled <section> landmark matching the sibling stale/ready region', () => {
        renderWithIntl(<OptionsAiAnalysisStaleNotice />);
        const heading = screen.getByRole('heading', { name: 'AI 옵션 분석' });
        const section = heading.closest('section');
        expect(section).not.toBeNull();
        expect(section).toHaveAttribute(
            'aria-labelledby',
            'options-ai-analysis-heading'
        );
        expect(heading).toHaveAttribute('id', 'options-ai-analysis-heading');
    });
});
