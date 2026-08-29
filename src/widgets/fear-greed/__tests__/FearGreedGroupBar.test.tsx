import { POC_WINDOW_DEFAULT } from '@y0ngha/siglens-core';
import { render } from '@testing-library/react';
import type { FearGreedGroup } from '@y0ngha/siglens-core';
import { FearGreedGroupBar } from '@/widgets/fear-greed/FearGreedGroupBar';

import koMessages from '@/../messages/ko.json';

/** ko 카탈로그의 팩터 라벨·설명 — 소스 상수를 대체한다. */
const RAW_FG = koMessages.shared.lib.fearGreedFactor as unknown as {
    label: Record<string, string>;
    descriptionUs: Record<string, string>;
    symbolLabel: Record<string, string>;
};

/**
 * `poc_distance` 라벨은 `{v0}`(POC 창 크기)를 받는다 — 카탈로그 원문을 그대로
 * 단언하면 플레이스홀더가 남아 실패한다.
 */
const FG = {
    ...RAW_FG,
    symbolLabel: Object.fromEntries(
        Object.entries(RAW_FG.symbolLabel).map(([k, v]) => [
            k,
            v.replaceAll('{v0}', String(POC_WINDOW_DEFAULT)),
        ])
    ),
};

const flowGroup: FearGreedGroup = {
    name: 'Flow',
    score: 30.6,
    factors: [
        { key: 'volume_z', rawValue: -1.2, percentile: 80 },
        { key: 'buysell_imbalance', rawValue: 0.15, percentile: 60 },
        { key: 'poc_distance', rawValue: -0.05, percentile: 5 },
    ],
};

describe('FearGreedGroupBar', () => {
    describe('with Flow group', () => {
        it('renders group name and rounded score', () => {
            const { getByText } = render(
                <FearGreedGroupBar group={flowGroup} />
            );
            expect(getByText('Flow Group')).toBeInTheDocument();
            expect(getByText('31 / 100')).toBeInTheDocument(); // 30.6 rounded
        });

        it('renders all factors with formatted values and rounded percentiles', () => {
            const { getByText } = render(
                <FearGreedGroupBar group={flowGroup} />
            );
            expect(
                getByText(FG.symbolLabel.volume_z, { exact: false })
            ).toBeInTheDocument();
            expect(
                getByText(FG.symbolLabel.buysell_imbalance, { exact: false })
            ).toBeInTheDocument();
            expect(
                getByText(FG.symbolLabel.poc_distance, { exact: false })
            ).toBeInTheDocument();
            // percentile rendering
            expect(getByText(/80th/)).toBeInTheDocument();
        });

        it('exposes accessible bar score via aria-label', () => {
            const { container } = render(
                <FearGreedGroupBar group={flowGroup} />
            );
            const bar = container.querySelector('[aria-label]');
            expect(bar?.getAttribute('aria-label')).toBe('Flow 그룹 점수 31');
        });

        it('rounds score 0.4 down to 0', () => {
            const zeroish = { ...flowGroup, score: 0.4 };
            const { getByText } = render(<FearGreedGroupBar group={zeroish} />);
            expect(getByText('0 / 100')).toBeInTheDocument();
        });

        it('rounds score 99.6 up to 100', () => {
            const oneish = { ...flowGroup, score: 99.6 };
            const { getByText } = render(<FearGreedGroupBar group={oneish} />);
            expect(getByText('100 / 100')).toBeInTheDocument();
        });
    });

    describe('score-color fill', () => {
        it('uses bg-ui-danger for fearful score (15)', () => {
            const fearful = { ...flowGroup, score: 15 };
            const { container } = render(<FearGreedGroupBar group={fearful} />);
            const fill = container.querySelector('[role="progressbar"] > div');
            expect(fill?.className).toContain('bg-ui-danger');
        });
    });

    describe('extreme percentile emphasis', () => {
        it('renders extreme percentile (< 10) with font-semibold', () => {
            const { getByText } = render(
                <FearGreedGroupBar group={flowGroup} />
            );
            // POC 거리 has percentile 5 → extreme low
            const extremePctile = getByText(/5th/);
            expect(extremePctile.className).toContain('font-semibold');
        });

        it('renders non-extreme percentile without font-semibold', () => {
            const { getByText } = render(
                <FearGreedGroupBar group={flowGroup} />
            );
            // Buy/Sell 불균형 has percentile 60 → not extreme
            const normalPctile = getByText(/60th/);
            expect(normalPctile.className).not.toContain('font-semibold');
        });

        it('renders extreme percentile (>= 90) with font-semibold', () => {
            const highExtreme: FearGreedGroup = {
                ...flowGroup,
                factors: [
                    { key: 'volume_z', rawValue: 2.5, percentile: 92 },
                    {
                        key: 'buysell_imbalance',
                        rawValue: 0.15,
                        percentile: 60,
                    },
                ],
            };
            const { getByText } = render(
                <FearGreedGroupBar group={highExtreme} />
            );
            const extremePctile = getByText(/92nd|92th/);
            expect(extremePctile.className).toContain('font-semibold');
        });
    });
});
