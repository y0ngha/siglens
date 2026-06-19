import { render, screen } from '@testing-library/react';
import { EmptySectionCard } from '../EmptySectionCard';

describe('EmptySectionCard', () => {
    it('renders the section heading', () => {
        render(<EmptySectionCard title="손익계산서" />);
        expect(
            screen.getByRole('heading', { name: '손익계산서' })
        ).toBeInTheDocument();
    });

    it('renders the empty message', () => {
        render(<EmptySectionCard title="재무상태표" />);
        expect(
            screen.getByText('데이터를 불러올 수 없어요')
        ).toBeInTheDocument();
    });

    it('renders as a section with card styles', () => {
        const { container } = render(<EmptySectionCard title="현금흐름표" />);
        const section = container.querySelector('section');
        expect(section).toBeInTheDocument();
    });

    it('is labelledby the heading', () => {
        const { container } = render(<EmptySectionCard title="성장분석" />);
        const section = container.querySelector('section[aria-labelledby]');
        expect(section).toBeInTheDocument();
        const labelledBy = section?.getAttribute('aria-labelledby');
        expect(labelledBy).toBeTruthy();
        const heading = document.getElementById(labelledBy!);
        expect(heading?.textContent).toBe('성장분석');
    });
});
