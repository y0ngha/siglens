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
     * 라벨은 core가 준 값이다. 반올림한 점수(45)가 다른 구간이어도 헤더 배지·서버 요약과
     * 같은 `snapshot.label`을 보여야 한 페이지의 라벨이 갈라지지 않는다.
     */
    describe('label near a cutoff', () => {
        const nearFearCutoff: FearGreedSnapshot = {
            ...snapshot,
            score: 44.6,
            label: 'FEAR',
        };

        it('44.6은 45로 찍되 라벨은 core의 FEAR를 그대로 쓴다', () => {
            const { getByText, queryByText } = render(
                <FearGreedHero snapshot={nearFearCutoff} />
            );
            expect(getByText('45')).toBeInTheDocument();
            expect(
                getByText(sentimentLabelText('FEAR', t))
            ).toBeInTheDocument();
            expect(queryByText(sentimentLabelText('NEUTRAL', t))).toBeNull();
        });

        it('SVG aria-label에도 반올림 점수와 core 라벨이 담긴다', () => {
            const { container } = render(
                <FearGreedHero snapshot={nearFearCutoff} />
            );
            const ariaLabel = container
                .querySelector('svg[role="img"]')
                ?.getAttribute('aria-label');
            expect(ariaLabel).toContain('45');
            expect(ariaLabel).toContain(sentimentLabelText('FEAR', t));
            expect(ariaLabel).not.toContain(sentimentLabelText('NEUTRAL', t));
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
