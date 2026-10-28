import { render } from '@testing-library/react';
import { beforeAll } from 'vitest';
import { getTranslations } from 'next-intl/server';
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { FearGreedHero } from '@/widgets/fear-greed/FearGreedHero';
import { sentimentLabelText } from '@/shared/lib/fearGreedLabels';
import type { EnumLabelTranslator } from '@/shared/lib/enumLabelTranslator';

let t: EnumLabelTranslator;
beforeAll(async () => {
    t = await getTranslations({ locale: 'ko', namespace: 'shared.enumLabel' });
});

const snapshot: FearGreedSnapshot = {
    score: 18,
    label: 'EXTREME_FEAR',
    confidence: 'normal',
    sampleSize: 412,
    warning: null,
    groups: [],
};

describe('FearGreedHero', () => {
    describe('with EXTREME_FEAR snapshot', () => {
        it('renders score and label', () => {
            const { getByText } = render(<FearGreedHero snapshot={snapshot} />);
            expect(getByText('18')).toBeInTheDocument();
            expect(
                getByText(sentimentLabelText('EXTREME_FEAR', t))
            ).toBeInTheDocument();
        });

        it('renders SVG with aria-label including score and label', () => {
            const { container } = render(<FearGreedHero snapshot={snapshot} />);
            const svg = container.querySelector('svg[role="img"]');
            expect(svg?.getAttribute('aria-label')).toContain('18');
            expect(svg?.getAttribute('aria-label')).toContain(
                sentimentLabelText('EXTREME_FEAR', t)
            );
        });
    });

    describe('rounding', () => {
        it('rounds the score for display', () => {
            const { getByText } = render(
                <FearGreedHero snapshot={{ ...snapshot, score: 67.6 }} />
            );
            expect(getByText('68')).toBeInTheDocument();
        });
    });

    /**
     * 점수를 반올림해 찍으므로 라벨도 그 정수로 구해야 한다. 반올림 전 점수의 라벨을 쓰면
     * 경계 근처에서 숫자(45, 중립 구간)와 라벨(공포)이 갈라진다.
     */
    describe('label at a cutoff after rounding', () => {
        const nearFearCutoff: FearGreedSnapshot = {
            ...snapshot,
            score: 44.6,
            label: 'FEAR',
        };

        it('44.6은 45로 찍고 중립 라벨을 붙인다', () => {
            const { getByText, queryByText } = render(
                <FearGreedHero snapshot={nearFearCutoff} />
            );
            expect(getByText('45')).toBeInTheDocument();
            expect(
                getByText(sentimentLabelText('NEUTRAL', t))
            ).toBeInTheDocument();
            expect(queryByText(sentimentLabelText('FEAR', t))).toBeNull();
        });

        it('SVG aria-label의 점수와 라벨도 같은 구간을 가리킨다', () => {
            const { container } = render(
                <FearGreedHero snapshot={nearFearCutoff} />
            );
            const ariaLabel = container
                .querySelector('svg[role="img"]')
                ?.getAttribute('aria-label');
            expect(ariaLabel).toContain('45');
            expect(ariaLabel).toContain(sentimentLabelText('NEUTRAL', t));
        });

        it('반올림해도 구간이 바뀌지 않으면 원래 라벨을 유지한다', () => {
            const { getByText } = render(
                <FearGreedHero
                    snapshot={{ ...snapshot, score: 44.4, label: 'FEAR' }}
                />
            );
            expect(getByText('44')).toBeInTheDocument();
            expect(
                getByText(sentimentLabelText('FEAR', t))
            ).toBeInTheDocument();
        });
    });

    describe('with GREED snapshot', () => {
        it('renders GREED label for score 60', () => {
            const greedSnap: FearGreedSnapshot = {
                score: 60,
                label: 'GREED',
                confidence: 'normal',
                sampleSize: 200,
                warning: null,
                groups: [],
            };
            const { getByText } = render(
                <FearGreedHero snapshot={greedSnap} />
            );
            expect(getByText('60')).toBeInTheDocument();
            expect(
                getByText(sentimentLabelText('GREED', t))
            ).toBeInTheDocument();
        });
    });
});
