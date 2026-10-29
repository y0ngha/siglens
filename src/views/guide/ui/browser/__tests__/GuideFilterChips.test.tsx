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
    it('marks only the selected chip as pressed', () => {
        const group = renderChips('indicators');

        expect(
            group
                .getAllByRole('button')
                .map(button => button.getAttribute('aria-pressed'))
        ).toEqual(['false', 'true', 'false']);
    });

    it('keeps the chip name unchanged when pressed and separates the count with a real space', () => {
        const group = renderChips('indicators');

        expect(
            group.getByRole('button', { pressed: true })
        ).toHaveAccessibleName(`${chips[1].label} ${chips[1].count}`);
    });

    it('styles the active chip and its count differently from idle chips', () => {
        const group = renderChips(GUIDE_FILTER_ALL);
        const [active, idle] = group.getAllByRole('button');

        expect(active).toHaveClass('border-primary-400', 'text-primary-400');
        expect(idle).not.toHaveClass('border-primary-400');
        expect(active.querySelector('span')).toHaveClass('text-primary-400');
        expect(idle.querySelector('span')).toHaveClass('text-secondary-400');
    });

    it('reports the clicked chip value', async () => {
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
