import { render } from '@testing-library/react';
import { beforeAll } from 'vitest';
import { getTranslations } from 'next-intl/server';
import { POC_WINDOW_DEFAULT, type FearGreedFactor } from '@y0ngha/siglens-core';
import { FearGreedFactorRow } from '@/widgets/fear-greed/ui/group/FearGreedFactorRow';
import {
    EXTREME_PERCENTILE_HIGH,
    EXTREME_PERCENTILE_LOW,
} from '@/widgets/fear-greed/utils/percentile';

type Translator = Awaited<ReturnType<typeof getTranslations>>;
let tWidget: Translator;
let tFactor: Translator;
beforeAll(async () => {
    tWidget = await getTranslations({
        locale: 'ko',
        namespace: 'widgets.fear-greed',
    });
    tFactor = await getTranslations({
        locale: 'ko',
        namespace: 'shared.lib.fearGreedFactor',
    });
});

function renderRow(factor: FearGreedFactor) {
    const { container } = render(
        <ul>
            <FearGreedFactorRow factor={factor} />
        </ul>
    );
    return container;
}

/** 백분위 문구를 담은 span — 강조 여부를 클래스로 본다. */
function percentileSpan(container: HTMLElement, percentile: number) {
    const text = `(${tWidget('FearGreedGroupBar.percentile', { v0: percentile })})`;
    return Array.from(container.querySelectorAll('span')).find(
        span => span.textContent === text
    );
}

describe('FearGreedFactorRow', () => {
    it('요인 이름과 반올림한 백분위를 적는다', () => {
        const container = renderRow({
            key: 'poc_distance',
            rawValue: -0.05,
            percentile: 54.6,
        });
        expect(container.textContent).toContain(
            tFactor('symbolLabel.poc_distance', { v0: POC_WINDOW_DEFAULT })
        );
        expect(percentileSpan(container, 55)).toBeDefined();
    });

    it('양 끝 백분위는 굵게, 가운데는 흐리게 적는다', () => {
        const low = renderRow({
            key: 'volume_z',
            rawValue: -1.2,
            percentile: EXTREME_PERCENTILE_LOW,
        });
        const high = renderRow({
            key: 'volume_z',
            rawValue: 1.2,
            percentile: EXTREME_PERCENTILE_HIGH,
        });
        const mid = renderRow({
            key: 'volume_z',
            rawValue: 0,
            percentile: 50,
        });
        expect(
            percentileSpan(low, EXTREME_PERCENTILE_LOW)?.className
        ).toContain('font-semibold');
        expect(
            percentileSpan(high, EXTREME_PERCENTILE_HIGH)?.className
        ).toContain('font-semibold');
        expect(percentileSpan(mid, 50)?.className).not.toContain(
            'font-semibold'
        );
    });
});
