import { render } from '@testing-library/react';
import { beforeAll } from 'vitest';
import type { FearGreedHistoryPoint } from '@y0ngha/siglens-core';
import { getTranslations } from 'next-intl/server';
import { FearGreedComparisonGauges } from '@/widgets/fear-greed/FearGreedComparisonGauges';
import { sentimentLabelText } from '@/shared/lib/fearGreedLabels';
import type { EnumLabelTranslator } from '@/shared/lib/enumLabelTranslator';

let t: EnumLabelTranslator;
beforeAll(async () => {
    t = await getTranslations({ locale: 'ko', namespace: 'shared.enumLabel' });
});

function makeHistory(scores: Array<number | null>): FearGreedHistoryPoint[] {
    return scores.map((s, i) => ({
        date: `2026-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
        score: s,
        label: s !== null && s >= 50 ? 'GREED' : 'FEAR',
    }));
}

describe('FearGreedComparisonGauges', () => {
    describe('with sufficient history', () => {
        it('닿는 history에는 어느 기간에도 날짜를 덧붙이지 않는다', () => {
            const history = makeHistory(
                Array.from({ length: 300 }, (_, i) => 50 + (i % 20))
            );
            const { container } = render(
                <FearGreedComparisonGauges history={history} />
            );
            expect(container.textContent).not.toContain('부터');
        });

        it('renders 4 mini gauges with rounded scores and period labels', () => {
            const history = makeHistory(
                Array.from({ length: 300 }, (_, i) => 50 + (i % 20))
            );
            const { getByText, container } = render(
                <FearGreedComparisonGauges history={history} />
            );
            expect(getByText('현재')).toBeInTheDocument();
            expect(getByText('1주')).toBeInTheDocument();
            expect(getByText('1개월')).toBeInTheDocument();
            expect(getByText('1년')).toBeInTheDocument();
            // 4 mini gauges → 4 SVG with role="img"; each aria-label encodes the
            // period label + score so screen-reader users distinguish them.
            const svgs = container.querySelectorAll('svg[role="img"]');
            expect(svgs).toHaveLength(4);
            svgs.forEach(svg => {
                expect(svg.getAttribute('aria-label')).toMatch(
                    /공포 탐욕 지수 \d+점/
                );
            });
        });
    });

    describe('with null label', () => {
        it('label이 없는 점은 비교에서 제외되어 아무것도 그리지 않는다', () => {
            const history: FearGreedHistoryPoint[] = Array.from(
                { length: 300 },
                (_, i) => ({
                    date: `2026-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
                    score: 50 + (i % 20),
                    label: null,
                })
            );
            const { container } = render(
                <FearGreedComparisonGauges history={history} />
            );
            expect(container.firstChild).toBeNull();
        });
    });

    describe('with insufficient history', () => {
        it('clamps to first valid entry when daysBack exceeds available data', () => {
            const history = makeHistory(
                Array.from({ length: 10 }, (_, i) => 30 + i)
            );
            const { getAllByText } = render(
                <FearGreedComparisonGauges history={history} />
            );
            // 1m and 1y tiles both show the oldest valid score (30) due to clamping
            expect(getAllByText('30').length).toBeGreaterThanOrEqual(1);
        });

        it('닿지 못한 기간(1개월·1년)에는 실제로 쓴 가장 오래된 날짜를 적는다', () => {
            const history = makeHistory(
                Array.from({ length: 10 }, (_, i) => 30 + i)
            );
            const oldest = '2026년 1월 1일';
            const { getByText, queryByText } = render(
                <FearGreedComparisonGauges history={history} />
            );
            expect(getByText(`1개월 (${oldest}부터)`)).toBeInTheDocument();
            expect(getByText(`1년 (${oldest}부터)`)).toBeInTheDocument();
            expect(getByText('현재')).toBeInTheDocument();
            expect(getByText('1주')).toBeInTheDocument();
            expect(queryByText(`1주 (${oldest}부터)`)).toBeNull();
        });

        it('날짜가 적힌 기간은 aria-label에도 같은 문구를 담는다', () => {
            const history = makeHistory(
                Array.from({ length: 10 }, (_, i) => 30 + i)
            );
            const oldest = '2026년 1월 1일';
            const { container } = render(
                <FearGreedComparisonGauges history={history} />
            );
            const labels = Array.from(
                container.querySelectorAll('svg[role="img"]')
            ).map(svg => svg.getAttribute('aria-label') ?? '');
            expect(
                labels.filter(l => l.includes(`1년 (${oldest}부터)`))
            ).toHaveLength(1);
        });

        it('returns null when all scores are null (warm-up only)', () => {
            const history = makeHistory(Array.from({ length: 5 }, () => null));
            const { container } = render(
                <FearGreedComparisonGauges history={history} />
            );
            expect(container.firstChild).toBeNull();
        });
    });

    /*
     * 회귀: 타일 보더가 양쪽 다 `/40`이라 `현재` 강조와 기본이 대비상 구분되지
     * 않았다. 시장 버전(`MarketFearGreedComparison`)이 먼저 고친 것과 맞춘다.
     */
    /*
     * 4칸을 flex-wrap으로 두면 폭에 따라 3+1로 갈라져 한 칸만 홀로 남는다. 시장 지수
     * 비교(`MarketFearGreedComparison`)와 같은 2열→4열 grid를 쓴다.
     */
    it('flex-wrap 대신 2열→4열 grid로 타일을 배치한다', () => {
        const history = makeHistory(
            Array.from({ length: 300 }, (_, i) => 50 + (i % 20))
        );
        const { container } = render(
            <FearGreedComparisonGauges history={history} />
        );
        const list = container.querySelector('ul');
        expect(list?.className).toContain('grid');
        expect(list?.className).toContain('grid-cols-2');
        expect(list?.className).toContain('sm:grid-cols-4');
        expect(list?.className).not.toContain('flex-wrap');
    });

    it('현재 타일은 반올림 점수를 찍되 라벨은 Hero처럼 core 라벨을 쓴다', () => {
        const history: FearGreedHistoryPoint[] = [
            { date: '2026-01-01', score: 44.6, label: 'FEAR' },
        ];
        const { container } = render(
            <FearGreedComparisonGauges history={history} />
        );
        const ariaLabel = container
            .querySelector('li svg[role="img"]')
            ?.getAttribute('aria-label');
        expect(ariaLabel).toContain('45');
        expect(ariaLabel).toContain(sentimentLabelText('FEAR', t));
        expect(ariaLabel).not.toContain(sentimentLabelText('NEUTRAL', t));
    });

    it('타일 보더에 /40 알파를 쓰지 않고 현재 타일만 primary 보더로 강조한다', () => {
        const history = makeHistory(
            Array.from({ length: 300 }, (_, i) => 50 + (i % 20))
        );
        const { container } = render(
            <FearGreedComparisonGauges history={history} />
        );
        const tiles = Array.from(container.querySelectorAll('li'));
        expect(tiles).toHaveLength(4);
        for (const tile of tiles) {
            expect(tile.className).not.toMatch(/border-\S+\/40/);
        }
        expect(tiles[0].className).toContain('border-primary-500');
        for (const tile of tiles.slice(1)) {
            expect(tile.className).toContain('border-secondary-700');
        }
    });
});
