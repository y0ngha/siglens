import { render } from '@testing-library/react';
import type { MarketFearGreedSnapshot } from '@y0ngha/siglens-core';
import type { MarketFearGreedView } from '@/entities/market-fear-greed';
import { MarketFearGreedPage } from '@/widgets/market-fear-greed/MarketFearGreedPage';
import {
    CONFIDENCE_LIMITED_LABEL,
    CONFIDENCE_NORMAL_LABEL,
    SENTIMENT_LABEL_TEXT,
} from '@/shared/lib/fearGreedLabels';
import { MARKET_FACTOR_LABEL } from '@/shared/lib/marketFearGreedLabels';

const snapshot: MarketFearGreedSnapshot = {
    score: 62,
    label: 'GREED',
    confidence: 'normal',
    sampleSize: 412,
    asOf: '2026-08-14',
    factors: [
        { key: 'momentum', rawValue: 0.05, percentile: 80 },
        { key: 'volatility', rawValue: -0.1, percentile: 70 },
        { key: 'safe_haven', rawValue: 0.02, percentile: 55 },
        { key: 'junk_bond', rawValue: 0.01, percentile: 60 },
        { key: 'breadth', rawValue: -0.01, percentile: 45 },
    ],
};

const view: MarketFearGreedView = {
    snapshot,
    comparisons: [
        { key: 'now', date: '2026-08-14', score: 62, label: 'GREED' },
        { key: '1w', date: '2026-08-07', score: 58, label: 'GREED' },
        { key: '1m', date: '2026-07-15', score: 40, label: 'FEAR' },
        { key: '1y', date: '2025-08-14', score: 25, label: 'EXTREME_FEAR' },
    ],
};

describe('MarketFearGreedPage', () => {
    describe('with a valid snapshot', () => {
        it('renders the hero score, sentiment text, and asOf date', () => {
            const { container, getByText } = render(
                <MarketFearGreedPage market="us" view={view} />
            );
            // The "now" comparison tile also reads 62 — scope to the hero
            // gauge's SVG (role="img") to avoid matching the mini gauge too.
            const heroSvg = container.querySelector('svg[role="img"]');
            expect(heroSvg?.getAttribute('aria-label')).toContain('62');
            expect(getByText(SENTIMENT_LABEL_TEXT.GREED)).toBeInTheDocument();
            expect(getByText('2026년 8월 14일 종가 기준')).toBeInTheDocument();
        });

        it('renders all four comparison period labels', () => {
            const { getByText } = render(
                <MarketFearGreedPage market="us" view={view} />
            );
            expect(getByText('현재')).toBeInTheDocument();
            expect(getByText('1주 전')).toBeInTheDocument();
            expect(getByText('1개월 전')).toBeInTheDocument();
            expect(getByText('1년 전')).toBeInTheDocument();
        });

        it('renders all five factor names', () => {
            const { getByText } = render(
                <MarketFearGreedPage market="us" view={view} />
            );
            expect(
                getByText(MARKET_FACTOR_LABEL.us.momentum)
            ).toBeInTheDocument();
            expect(
                getByText(MARKET_FACTOR_LABEL.us.volatility)
            ).toBeInTheDocument();
            expect(
                getByText(MARKET_FACTOR_LABEL.us.safe_haven)
            ).toBeInTheDocument();
            expect(
                getByText(MARKET_FACTOR_LABEL.us.junk_bond)
            ).toBeInTheDocument();
            expect(
                getByText(MARKET_FACTOR_LABEL.us.breadth)
            ).toBeInTheDocument();
        });

        it('renders the CNN-difference footnote', () => {
            const { getByText } = render(
                <MarketFearGreedPage market="us" view={view} />
            );
            const footnote = getByText(/CNN Fear & Greed Index/);
            expect(footnote.textContent).toContain('5개');
            expect(footnote.textContent).toContain('7개');
            expect(footnote.textContent).toContain('풋/콜');
        });

        it('shows the normal-confidence footer for confidence "normal"', () => {
            const { getByText } = render(
                <MarketFearGreedPage market="us" view={view} />
            );
            expect(
                getByText(`표본 412 — ${CONFIDENCE_NORMAL_LABEL}`)
            ).toBeInTheDocument();
        });
    });

    describe('with confidence "limited"', () => {
        it('surfaces the reduced-confidence text', () => {
            const limitedView: MarketFearGreedView = {
                ...view,
                snapshot: {
                    ...snapshot,
                    confidence: 'limited',
                    sampleSize: 45,
                },
            };
            const { getByText } = render(
                <MarketFearGreedPage market="us" view={limitedView} />
            );
            expect(
                getByText(`표본 45 — ${CONFIDENCE_LIMITED_LABEL}`)
            ).toBeInTheDocument();
        });
    });

    describe('with a null snapshot', () => {
        it('renders the empty state without throwing and without a gauge', () => {
            const emptyView: MarketFearGreedView = {
                snapshot: null,
                comparisons: [],
            };
            const { getByText, container } = render(
                <MarketFearGreedPage market="us" view={emptyView} />
            );
            expect(
                getByText('시장 공포·탐욕 지수를 계산할 데이터가 부족합니다.')
            ).toBeInTheDocument();
            expect(container.querySelector('svg[role="img"]')).toBeNull();
        });
    });

    /*
     * 섹션 제목 톤 회귀 가드.
     *
     * 이 페이지의 h2 두 개는 원래 `text-sm font-medium text-secondary-300`이라
     * 자기가 거느린 h3(14px/500)보다 **어두웠다** — 같은 크기·굵기에 더 흐린,
     * 뒤집힌 위계였다. `HEADING_SECTION`으로 옮겨 18px/600으로 올렸는데,
     * 이 톤을 고정하는 테스트가 없어 같은 드리프트가 조용히 돌아올 수 있었다.
     * (`/market`에서 실제로 그렇게 재발했다.)
     */
    it('섹션 제목이 HEADING_SECTION 톤을 유지한다', () => {
        const { getAllByRole } = render(
            <MarketFearGreedPage market="us" view={view} />
        );
        const headings = getAllByRole('heading', { level: 2 });
        expect(headings).toHaveLength(2);
        for (const h of headings) {
            const tokens = h.className.split(/\s+/);
            expect(tokens).toContain('text-lg');
            expect(tokens).toContain('font-semibold');
            expect(tokens).toContain('text-secondary-100');
            /* 이전 톤으로의 회귀를 직접 막는다. */
            expect(tokens).not.toContain('text-sm');
            expect(tokens).not.toContain('font-medium');
        }
    });
});
