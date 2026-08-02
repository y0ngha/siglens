import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CongressDegraded } from '@/app/[symbol]/congress/CongressDegraded';

describe('CongressDegraded', () => {
    // 단일 렌더를 공유하되 facet별로 it()을 나눠 실패 지점을 명확히 한다
    // (FinancialsDegraded.test.tsx와 동일 패턴).
    beforeEach(() => {
        render(<CongressDegraded displayName="애플" symbol="AAPL" />);
    });

    it('renders exactly one h1 carrying the resolved display name (SEO contract)', () => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            '애플 의회 거래'
        );
    });

    it('renders the degrade notice', () => {
        expect(
            screen.getByText('의회 거래 데이터를 일시적으로 불러올 수 없어요')
        ).toBeInTheDocument();
    });

    it('renders the cross links with congress marked current', () => {
        expect(screen.getByText('지금 보는 페이지예요')).toBeInTheDocument();
    });

    it('renders the SEO snapshot prose when snapshotContent is present (spec §7)', () => {
        render(
            <CongressDegraded
                displayName="애플"
                symbol="AAPL"
                snapshotContent={{
                    summaryKo: '최근 3개월간 순매수 우위 흐름입니다.',
                    overallSentiment: 'bullish',
                    notableMembersKo: [],
                    riskNoteKo: '',
                }}
            />
        );

        expect(
            screen.getByText('최근 3개월간 순매수 우위 흐름입니다.')
        ).toBeInTheDocument();
    });

    it('omits the snapshot prose section when snapshotContent is absent', () => {
        render(<CongressDegraded displayName="애플" symbol="AAPL" />);

        expect(screen.queryByText('최근 분석 요약')).not.toBeInTheDocument();
    });

    // C2(감사): snapshotGeneratedAt이 프로즈 셸까지 실제로 전달되는지는 지금까지
    // 테스트가 없었다(grep snapshotGeneratedAt src/app | grep __tests__는 아무것도
    // 반환하지 않았다) — 이 prop을 통째로 지워도 전 스위트가 그린이었다.
    it('renders the dated caption when snapshotGeneratedAt is present (C1 감사)', () => {
        render(
            <CongressDegraded
                displayName="애플"
                symbol="AAPL"
                snapshotContent={{
                    summaryKo: '최근 3개월간 순매수 우위 흐름입니다.',
                    overallSentiment: 'bullish',
                    notableMembersKo: [],
                    riskNoteKo: '',
                }}
                snapshotGeneratedAt={new Date('2026-07-31T20:00:00Z')}
            />
        );

        expect(
            screen.getByText(/2026년 7월 31일 미국 장마감 기준/)
        ).toBeInTheDocument();
    });
});
