import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AboutSection } from '../../ui/shell/AboutSection';

describe('AboutSection', () => {
    it('names the section by its h2 and draws the lede', () => {
        render(
            <AboutSection id="s1" title="Section" sub="Lede">
                <p>Body</p>
            </AboutSection>
        );
        const section = screen.getByRole('region', { name: 'Section' });
        expect(section).toHaveClass('mt-20');
        expect(section).toHaveTextContent('SectionLedeBody');
    });

    it('draws no lede paragraph without `sub`, and takes a margin override', () => {
        render(
            <AboutSection id="s2" title="Bare" className="mt-0">
                <span>Only</span>
            </AboutSection>
        );
        const section = screen.getByRole('region', { name: 'Bare' });
        expect(section).toHaveClass('mt-0');
        expect(section.querySelectorAll('p')).toHaveLength(0);
    });
});
