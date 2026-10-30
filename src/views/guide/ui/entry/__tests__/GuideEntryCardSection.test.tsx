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
    it('목록이 비면 아무것도 그리지 않는다', () => {
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

    it('h2로 섹션 이름을 달고 항목마다 분류명이 붙은 카드를 하나씩 그린다', () => {
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
