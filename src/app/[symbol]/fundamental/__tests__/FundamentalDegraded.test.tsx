// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { FundamentalDegraded } from '../FundamentalDegraded';

vi.mock('@/views/symbol', () => ({
    SymbolPageHeading: ({ children }: { children: ReactNode }) => (
        <h1>{children}</h1>
    ),
}));

vi.mock('@/shared/ui/CrossLinkCards', () => ({
    CrossLinkCards: ({
        symbol,
        current,
    }: {
        symbol: string;
        current: string;
    }) => (
        <div
            data-testid="cross-links"
            data-symbol={symbol}
            data-current={current}
        />
    ),
}));

describe('FundamentalDegraded', () => {
    it('renders exactly one h1 carrying the display name (single-h1 SEO contract)', () => {
        const { container } = render(
            <FundamentalDegraded displayName="애플 (AAPL)" symbol="AAPL" />
        );

        const h1s = container.querySelectorAll('h1');
        expect(h1s).toHaveLength(1);
        expect(h1s[0].textContent).toContain('애플 (AAPL)');
    });

    it('shows the temporary-unavailable notice', () => {
        render(<FundamentalDegraded displayName="AAPL" symbol="AAPL" />);

        expect(
            screen.getByText(/일시적으로 불러올 수 없어요/)
        ).toBeInTheDocument();
    });

    it('keeps the cross-route links so the visitor can still reach other tabs', () => {
        render(<FundamentalDegraded displayName="AAPL" symbol="TSLA" />);

        const links = screen.getByTestId('cross-links');
        expect(links).toHaveAttribute('data-symbol', 'TSLA');
        expect(links).toHaveAttribute('data-current', 'fundamental');
    });

    it('renders the SEO snapshot prose when snapshotContent is present (spec §7)', () => {
        render(
            <FundamentalDegraded
                displayName="애플"
                symbol="AAPL"
                snapshotContent={{
                    overallConclusionKo:
                        '밸류에이션은 업종 평균 대비 낮습니다.',
                    overallSentiment: 'bullish',
                    categoryAssessments: [],
                    riskFactorsKo: [],
                }}
            />
        );

        expect(
            screen.getByText('밸류에이션은 업종 평균 대비 낮습니다.')
        ).toBeInTheDocument();
    });

    it('omits the snapshot prose section when snapshotContent is absent', () => {
        render(<FundamentalDegraded displayName="애플" symbol="AAPL" />);

        expect(screen.queryByText('최근 분석 요약')).not.toBeInTheDocument();
    });

    // C2(감사): snapshotGeneratedAt이 프로즈 셸까지 실제로 전달되는지는 지금까지
    // 테스트가 없었다(grep snapshotGeneratedAt src/app | grep __tests__는 아무것도
    // 반환하지 않았다) — 이 prop을 통째로 지워도 전 스위트가 그린이었다.
    it('renders the dated caption when snapshotGeneratedAt is present (C1 감사)', () => {
        render(
            <FundamentalDegraded
                displayName="애플"
                symbol="AAPL"
                snapshotContent={{
                    overallConclusionKo:
                        '밸류에이션은 업종 평균 대비 낮습니다.',
                    overallSentiment: 'bullish',
                    categoryAssessments: [],
                    riskFactorsKo: [],
                }}
                snapshotGeneratedAt={new Date('2026-07-31T20:00:00Z')}
            />
        );

        expect(
            screen.getByText(/2026년 7월 31일 미국 장마감 기준/)
        ).toBeInTheDocument();
    });
});
