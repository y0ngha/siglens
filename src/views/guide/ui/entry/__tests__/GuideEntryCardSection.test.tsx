import { screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { DOJI, RSI } from '@/__tests__/fixtures/guideFixtures';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import {
    loadGuideCategoryCopy,
    type GuideCategoryCopy,
} from '@/views/guide/lib/guideCopy';
import { GuideEntryCardSection } from '@/views/guide/ui/entry/GuideEntryCardSection';

const HEADING = '같이 보면 좋은 항목';

let labels: GuideCategoryCopy['label'];
beforeAll(async () => {
    labels = (await loadGuideCategoryCopy('ko')).label;
});

describe('GuideEntryCardSection', () => {
    it('renders nothing for an empty list', () => {
        const { container } = renderWithIntl(
            <GuideEntryCardSection
                headingId="related"
                heading={HEADING}
                entries={[]}
                categoryLabels={labels}
            />
        );

        expect(container.childElementCount).toBe(0);
    });

    it('labels the section with its h2 and renders one card per entry with its category label', () => {
        renderWithIntl(
            <GuideEntryCardSection
                headingId="related"
                heading={HEADING}
                entries={[RSI, DOJI]}
                categoryLabels={labels}
            />
        );

        const section = screen.getByRole('region', { name: HEADING });
        const cards = within(section).getAllByRole('listitem');
        expect(cards).toHaveLength(2);
        expect(cards[0]).toHaveTextContent(labels.indicators);
        expect(cards[1]).toHaveTextContent(labels.candlesticks);
        expect(
            within(section)
                .getAllByRole('heading', { level: 3 })
                .map(h => h.textContent)
        ).toEqual([RSI.title, DOJI.title]);
    });
});
