import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getTranslations } from 'next-intl/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import {
    GUIDE_FILTER_ALL,
    type GuideFilterCategory,
    type GuideFilterChip,
} from '@/views/guide/lib/guideBrowse';
import { GuideFilterChips } from '@/views/guide/ui/browser/GuideFilterChips';

let filterLabel: string;
let chips: GuideFilterChip[];
beforeAll(async () => {
    const t = await getTranslations({ locale: 'ko', namespace: 'views.guide' });
    filterLabel = t('filterLabel');
    chips = [
        { value: GUIDE_FILTER_ALL, label: t('filterAll'), count: 12 },
        { value: 'indicators', label: t('categoryIndicators'), count: 7 },
        { value: 'candlesticks', label: t('categoryCandlesticks'), count: 5 },
    ];
});

function renderChips(
    selected: GuideFilterCategory,
    onSelect: (category: GuideFilterCategory) => void = vi.fn()
) {
    renderWithIntl(
        <GuideFilterChips
            chips={chips}
            selected={selected}
            onSelect={onSelect}
        />
    );
    return within(screen.getByRole('group', { name: filterLabel }));
}

describe('GuideFilterChips', () => {
    it('고른 칩만 눌린 상태로 표시한다', () => {
        const group = renderChips('indicators');

        expect(
            group
                .getAllByRole('button')
                .map(button => button.getAttribute('aria-pressed'))
        ).toEqual(['false', 'true', 'false']);
    });

    it('눌려도 칩 이름은 그대로이고 개수와는 실제 공백으로 떨어진다', () => {
        const group = renderChips('indicators');

        expect(
            group.getByRole('button', { pressed: true })
        ).toHaveAccessibleName(`${chips[1].label} ${chips[1].count}`);
    });

    it('고른 칩과 그 개수는 다른 칩과 다른 색으로 그린다', () => {
        const group = renderChips(GUIDE_FILTER_ALL);
        const [active, idle] = group.getAllByRole('button');

        expect(active).toHaveClass('border-primary-400', 'text-primary-400');
        expect(idle).not.toHaveClass('border-primary-400');
        expect(active.querySelector('span')).toHaveClass('text-primary-400');
        expect(idle.querySelector('span')).toHaveClass('text-secondary-400');
    });

    it('누른 칩의 값을 알린다', async () => {
        const onSelect = vi.fn();
        const group = renderChips(GUIDE_FILTER_ALL, onSelect);

        await userEvent.click(
            group.getByRole('button', {
                name: `${chips[2].label} ${chips[2].count}`,
            })
        );

        expect(onSelect).toHaveBeenCalledExactlyOnceWith('candlesticks');
    });
});
