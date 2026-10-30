import { render } from '@testing-library/react';
import { beforeAll } from 'vitest';
import { getTranslations } from 'next-intl/server';
import { FearGreedComparisonTile } from '@/widgets/fear-greed/ui/gauges/FearGreedComparisonTile';
import type { ComparisonTile } from '@/widgets/fear-greed/utils/comparisonTiles';

type Translator = Awaited<ReturnType<typeof getTranslations>>;
let tWidget: Translator;
let tPeriod: Translator;
beforeAll(async () => {
    tWidget = await getTranslations({
        locale: 'ko',
        namespace: 'widgets.fear-greed',
    });
    tPeriod = await getTranslations({
        locale: 'ko',
        namespace: 'shared.ui.period',
    });
});

const YEAR_TILE: ComparisonTile = {
    key: '1y',
    periodMessageKey: 'year',
    score: 42,
    label: 'FEAR',
    date: '2025-03-04',
    clamped: false,
};

function renderTile(tile: ComparisonTile) {
    const { container } = render(
        <ul>
            <FearGreedComparisonTile tile={tile} />
        </ul>
    );
    return {
        text: container.textContent ?? '',
        ariaLabel:
            container
                .querySelector('svg[role="img"]')
                ?.getAttribute('aria-label') ?? '',
    };
}

describe('FearGreedComparisonTile', () => {
    it('clamp되지 않은 칸은 기간 이름만 적고 날짜를 붙이지 않는다', () => {
        const { text, ariaLabel } = renderTile(YEAR_TILE);
        expect(text).toContain(tPeriod('year'));
        expect(text).not.toContain(YEAR_TILE.date);
        expect(text).not.toContain('2025년 3월 4일');
        expect(ariaLabel).toContain(tPeriod('year'));
        expect(ariaLabel).not.toContain(YEAR_TILE.date);
    });

    it('clamp된 칸은 화면 글자와 aria-label 모두에 실제로 쓴 날짜를 적는다', () => {
        const since = tWidget('FearGreedComparisonTile.sincePeriod', {
            v0: tPeriod('year'),
            v1: '2025년 3월 4일',
        });
        const { text, ariaLabel } = renderTile({ ...YEAR_TILE, clamped: true });
        expect(text).toContain(since);
        expect(ariaLabel).toContain(since);
    });

    it('현재 칸만 primary 보더로 강조한다', () => {
        const { container: now } = render(
            <ul>
                <FearGreedComparisonTile
                    tile={{ ...YEAR_TILE, key: 'now', periodMessageKey: 'now' }}
                />
            </ul>
        );
        const { container: past } = render(
            <ul>
                <FearGreedComparisonTile tile={YEAR_TILE} />
            </ul>
        );
        expect(now.querySelector('li')?.className).toContain(
            'border-primary-500'
        );
        expect(past.querySelector('li')?.className).toContain(
            'border-secondary-700'
        );
    });
});
