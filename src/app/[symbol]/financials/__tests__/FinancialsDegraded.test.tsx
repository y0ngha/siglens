import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FinancialsDegraded } from '@/app/[symbol]/financials/FinancialsDegraded';

describe('FinancialsDegraded', () => {
    // 단일 렌더를 공유하되 facet별로 it()을 나눠 실패 지점을 명확히 한다.
    beforeEach(() => {
        render(
            <FinancialsDegraded
                displayName="애플"
                symbol="AAPL"
                marketProfile="us-equity"
            />
        );
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
                marketProfile="us-equity"
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
        render(
            <FinancialsDegraded
                displayName="애플"
                symbol="AAPL"
                marketProfile="us-equity"
            />
        );

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
                marketProfile="us-equity"
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

    // SEO 감사(2026-08-18): financials는 kr-equity도 렌더한다 — marketProfile이
    // CrossLinkCards뿐 아니라 FinancialsSnapshotProse까지 실제로 전달되는지(캡션이
    // "미국 장마감"으로 굳어 있지 않은지) 직접 겨냥한다.
    it('한국 종목은 "국내 장마감 기준" 캡션을 쓴다', () => {
        render(
            <FinancialsDegraded
                displayName="삼성전자"
                symbol="005930.KS"
                marketProfile="kr-equity"
                snapshotContent={{
                    overallConclusionKo: '현금창출력이 견조합니다.',
                    overallSentiment: 'bullish',
                    axisAssessments: [],
                    riskFactorsKo: [],
                }}
                snapshotGeneratedAt={new Date('2026-08-14T06:30:00Z')}
            />
        );

        expect(
            screen.getByText(/2026년 8월 14일 국내 장마감 기준/)
        ).toBeInTheDocument();
        expect(screen.queryByText(/미국 장마감 기준/)).not.toBeInTheDocument();
    });

    // SEO 감사(2026-08-18): marketProfile을 넘기지 않으면 CrossLinkCards의
    // 기본값(`'us-equity'`)으로 떨어져, 한국 종목 degrade 셸에도 존재하지 않는
    // `/options`·`/congress` 링크가 노출됐다(soft-404: notFound()가 Suspense
    // 안이라 200을 반환 — e2e/specs/kr-equity-seo.spec.ts). 실제 CrossLinkCards를
    // 렌더해(이 파일은 모킹하지 않는다) hrefs에 두 탭이 없는지 직접 확인한다.
    it('한국 종목에는 /options·/congress 링크가 렌더되지 않는다', () => {
        render(
            <FinancialsDegraded
                displayName="삼성전자"
                symbol="005930.KS"
                marketProfile="kr-equity"
            />
        );

        const hrefs = screen
            .getAllByRole('link')
            .map(link => link.getAttribute('href'));
        expect(hrefs).not.toContain('/005930.KS/options');
        expect(hrefs).not.toContain('/005930.KS/congress');
        // 대조군: fundamental처럼 KR에도 존재하는 탭은 여전히 렌더된다.
        expect(hrefs).toContain('/005930.KS/fundamental');
    });
});
