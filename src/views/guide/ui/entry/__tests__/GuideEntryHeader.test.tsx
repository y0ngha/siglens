import { screen } from '@testing-library/react';
import { getTranslations } from 'next-intl/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { guideEntry } from '@/__tests__/fixtures/guideFixtures';
import type { GuideEntry } from '@/entities/guide/types';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { GuideEntryHeader } from '@/views/guide/ui/entry/GuideEntryHeader';

const ALIASES = ['상대강도지수', 'Relative Strength Index'];

let aliasesLabel: string;
let updatedAtLabel: string;
beforeAll(async () => {
    const t = await getTranslations({ locale: 'ko', namespace: 'views.guide' });
    aliasesLabel = t('aliasesLabel');
    updatedAtLabel = t('updatedAt', { date: '2026년 10월 10일' });
});

function renderHeader(entry: GuideEntry) {
    return renderWithIntl(
        <GuideEntryHeader
            entry={entry}
            categoryLabel="분류"
            aliasesLabel={aliasesLabel}
            updatedAtLabel={updatedAtLabel}
        />
    );
}

describe('GuideEntryHeader', () => {
    it('shows the aliases list for a term entry', () => {
        renderHeader(guideEntry({ slug: 'rsi', aliases: ALIASES }));

        expect(screen.getByRole('term')).toHaveTextContent(aliasesLabel);
        expect(
            screen.getAllByRole('definition').map(dd => dd.textContent)
        ).toEqual(ALIASES);
    });

    it('hides the aliases of a howto entry — they exist for search only', () => {
        renderHeader(
            guideEntry({
                slug: 'read-rsi',
                category: 'howto',
                aliases: ALIASES,
            })
        );

        expect(screen.queryByRole('term')).toBeNull();
        ALIASES.forEach(alias => expect(screen.queryByText(alias)).toBeNull());
    });

    it('renders no aliases list when a term entry has none', () => {
        renderHeader(guideEntry({ slug: 'macd', aliases: [] }));

        expect(screen.queryByRole('term')).toBeNull();
    });

    it('renders the title as the h1 and the updated date as a machine-readable time', () => {
        const entry = guideEntry({ slug: 'rsi', title: 'RSI' });
        renderHeader(entry);

        expect(
            screen.getByRole('heading', { level: 1, name: 'RSI' })
        ).toBeInTheDocument();
        expect(screen.getByText(updatedAtLabel)).toHaveAttribute(
            'dateTime',
            entry.updatedAt
        );
    });
});
