import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FinancialsDegraded } from '@/app/[symbol]/financials/FinancialsDegraded';

describe('FinancialsDegraded', () => {
    // 단일 렌더를 공유하되 facet별로 it()을 나눠 실패 지점을 명확히 한다.
    beforeEach(() => {
        render(<FinancialsDegraded displayName="애플" symbol="AAPL" />);
    });

    it('renders exactly one h1 carrying the resolved display name (SEO contract)', () => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            '애플 재무제표'
        );
    });

    it('renders the degrade notice', () => {
        expect(
            screen.getByText('재무 데이터를 일시적으로 불러올 수 없어요')
        ).toBeInTheDocument();
    });

    it('renders the cross links with financials marked current', () => {
        expect(screen.getByText('지금 보는 페이지예요')).toBeInTheDocument();
    });

    it('renders the SEO snapshot prose when snapshotContent is present (spec §7)', () => {
        render(
            <FinancialsDegraded
                displayName="애플"
                symbol="AAPL"
                snapshotContent={{
                    overallConclusionKo: '현금창출력이 견조합니다.',
                    overallSentiment: 'bullish',
                    axisAssessments: [],
                    riskFactorsKo: [],
                }}
            />
        );

        expect(
            screen.getByText('현금창출력이 견조합니다.')
        ).toBeInTheDocument();
    });

    it('omits the snapshot prose section when snapshotContent is absent', () => {
        render(<FinancialsDegraded displayName="애플" symbol="AAPL" />);

        expect(screen.queryByText('최근 분석 요약')).not.toBeInTheDocument();
    });

    // C2(감사): snapshotGeneratedAt이 프로즈 셸까지 실제로 전달되는지는 지금까지
    // 테스트가 없었다(grep snapshotGeneratedAt src/app | grep __tests__는 아무것도
    // 반환하지 않았다) — 이 prop을 통째로 지워도 전 스위트가 그린이었다.
    it('renders the dated caption when snapshotGeneratedAt is present (C1 감사)', () => {
        render(
            <FinancialsDegraded
                displayName="애플"
                symbol="AAPL"
                snapshotContent={{
                    overallConclusionKo: '현금창출력이 견조합니다.',
                    overallSentiment: 'bullish',
                    axisAssessments: [],
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
