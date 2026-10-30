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
    it('용어 항목은 다른 이름 목록을 보여 준다', () => {
        renderHeader(guideEntry({ slug: 'rsi', aliases: ALIASES }));

        expect(screen.getByRole('term')).toHaveTextContent(aliasesLabel);
        expect(
            screen.getAllByRole('definition').map(dd => dd.textContent)
        ).toEqual(ALIASES);
    });

    it('하우투 항목의 다른 이름은 숨긴다 — 검색용일 뿐이다', () => {
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

    it('다른 이름이 없는 용어 항목은 목록을 그리지 않는다', () => {
        renderHeader(guideEntry({ slug: 'macd', aliases: [] }));

        expect(screen.queryByRole('term')).toBeNull();
    });

    it('제목은 h1, 수정일은 기계가 읽는 time 요소로 그린다', () => {
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
