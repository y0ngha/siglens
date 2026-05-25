import { render, screen } from '@testing-library/react';

import { PolicySection } from '../PolicySection';

describe('PolicySection', () => {
    it('renders the title', () => {
        render(
            <PolicySection id="purpose" title="제1조 (목적)">
                <p>본 약관은…</p>
            </PolicySection>
        );

        expect(
            screen.getByRole('heading', { name: /제1조 \(목적\)/ })
        ).toBeInTheDocument();
    });

    it('renders children content', () => {
        render(
            <PolicySection id="purpose" title="제1조">
                <p>약관 내용</p>
            </PolicySection>
        );

        expect(screen.getByText('약관 내용')).toBeInTheDocument();
    });

    it('sets the section id for anchor linking', () => {
        const { container } = render(
            <PolicySection id="definitions" title="제2조 (정의)">
                <p>정의 내용</p>
            </PolicySection>
        );

        const section = container.querySelector('#definitions');
        expect(section).not.toBeNull();
        expect(section?.tagName.toLowerCase()).toBe('section');
    });

    it('has scroll-mt class for fixed header offset', () => {
        const { container } = render(
            <PolicySection id="test" title="제3조">
                <p>내용</p>
            </PolicySection>
        );

        const section = container.querySelector('#test');
        expect(section).toHaveClass('scroll-mt-24');
    });
});
