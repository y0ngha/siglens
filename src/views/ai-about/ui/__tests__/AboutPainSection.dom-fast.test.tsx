import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AboutPainSection } from '../pain/AboutPainSection';

const POINTS = [
    { was: 'Stale prices', now: 'Live quotes' },
    { was: 'Made-up numbers', now: 'Sourced figures' },
] as const;

describe('AboutPainSection', () => {
    it('captions each answer with the brand name, kept out of translation', () => {
        render(
            <AboutPainSection
                title="Pain"
                body="Body"
                wasLabel="Before"
                brandName="SIGLENS AI"
                points={POINTS}
            />
        );
        const captions = screen.getAllByText('SIGLENS AI');
        expect(captions).toHaveLength(2);
        for (const caption of captions)
            expect(caption).toHaveAttribute('translate', 'no');
    });

    it('leaves the complaint caption translatable', () => {
        render(
            <AboutPainSection
                title="Pain"
                body="Body"
                wasLabel="Before"
                brandName="SIGLENS AI"
                points={POINTS}
            />
        );
        for (const caption of screen.getAllByText('Before'))
            expect(caption).not.toHaveAttribute('translate');
    });
});
