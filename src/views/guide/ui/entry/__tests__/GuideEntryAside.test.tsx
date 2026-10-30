import { screen, within } from '@testing-library/react';
import { getTranslations } from 'next-intl/server';
import { beforeAll, describe, expect, it } from 'vitest';
import type { TocItem } from '@/shared/lib/legal-toc';
import { guideCategoryPath } from '@/shared/lib/guidePaths';
import { localePath } from '@/shared/i18n/locales';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { loadGuideCategoryCopy } from '@/views/guide/lib/guideCopy';
import { GuideEntryAside } from '@/views/guide/ui/entry/GuideEntryAside';

const TOC: readonly TocItem[] = [
    { id: 'how', label: '어떻게 계산하나' },
    { id: 'what', label: '무엇을 말해 주나' },
];

let tocLabel: string;
let backLabel: string;
beforeAll(async () => {
    const t = await getTranslations({ locale: 'ko', namespace: 'views.guide' });
    const { label } = await loadGuideCategoryCopy('ko');
    tocLabel = t('tocLabel');
    backLabel = t('backToCategory', { name: label.indicators });
});

function renderAside(toc: readonly TocItem[]) {
    return renderWithIntl(
        <GuideEntryAside
            toc={toc}
            tocLabel={tocLabel}
            category="indicators"
            backLabel={backLabel}
        />
    );
}

describe('GuideEntryAside', () => {
    it('차례가 있으면 이름 붙은 내비게이션에 본문 h2 앵커를 순서대로 잇는다', () => {
        renderAside(TOC);

        const nav = screen.getByRole('navigation', { name: tocLabel });
        expect(
            within(nav)
                .getAllByRole('link')
                .map(link => [link.textContent, link.getAttribute('href')])
        ).toEqual([
            ['어떻게 계산하나', '#how'],
            ['무엇을 말해 주나', '#what'],
        ]);
    });

    it('차례가 비면 내비게이션 없이 분류 목록 링크만 남긴다', () => {
        renderAside([]);

        expect(screen.queryByRole('navigation')).toBeNull();
        expect(screen.getAllByRole('link')).toHaveLength(1);
        expect(screen.getByRole('link', { name: backLabel })).toHaveAttribute(
            'href',
            localePath('ko', guideCategoryPath('indicators'))
        );
    });
});
