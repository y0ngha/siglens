import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AboutSection } from '../AboutSection';

describe('AboutSection', () => {
    it('names the region after its heading', () => {
        render(
            <AboutSection id="about-x" title="Section title">
                <p>Body</p>
            </AboutSection>
        );
        expect(
            screen.getByRole('region', { name: 'Section title' })
        ).toContainElement(screen.getByText('Body'));
    });

    it('renders the lede under the heading when one is given', () => {
        render(
            <AboutSection id="about-x" title="Section title" sub="The lede">
                <p>Body</p>
            </AboutSection>
        );
        expect(screen.getByText('The lede')).toBeInTheDocument();
    });

    it('renders only the heading and body without a lede', () => {
        render(
            <AboutSection id="about-x" title="Section title">
                <p>Body</p>
            </AboutSection>
        );
        const region = screen.getByRole('region', { name: 'Section title' });
        expect(region.children).toHaveLength(2);
    });
});
