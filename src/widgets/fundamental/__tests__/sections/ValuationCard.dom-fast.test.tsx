import { render, screen } from '@testing-library/react';
import type { FundamentalValuationMetrics } from '@y0ngha/siglens-core';
import type { KrValuationBasis } from '@/entities/kr-valuation/model';
import { koMessage } from '@/shared/test-utils/koMessage';
import { ValuationCard } from '@/widgets/fundamental/sections/ValuationCard';

const SAMPLE_METRICS: FundamentalValuationMetrics = {
    peRatioTTM: 28.5,
    priceToSalesRatioTTM: 7.2,
    pbRatioTTM: 45.1,
    pegRatioTTM: 2.3,
    enterpriseValueOverEBITDATTM: 20.1,
    epsTTM: 6.5,
};

describe('ValuationCard', () => {
    it('renders metric values when metrics provided', () => {
        render(<ValuationCard metrics={SAMPLE_METRICS} />);
        expect(
            screen.getByRole('heading', { name: '밸류에이션' })
        ).toBeInTheDocument();
        expect(screen.getByText('PER')).toBeInTheDocument();
    });

    it('renders empty state with heading when metrics is null', () => {
        render(<ValuationCard metrics={null} />);
        expect(
            screen.getByRole('heading', { name: '밸류에이션' })
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                koMessage('widgets.financials.section.emptySection')
            )
        ).toBeInTheDocument();
    });

    describe('한국 종목 PER·PBR 계산 기준 캡션', () => {
        const DART_BASIS: KrValuationBasis = {
            source: 'dart',
            statements: 'consolidated',
            ttmEnd: '2026-06-30',
            equityAsOf: '2026-06-30',
            epsShares: 'issued_incl_treasury',
            bpsShares: 'outstanding_ex_treasury',
            sharesAsOf: '2026-06-30',
            sharesSource: 'dart',
            priceDate: '2026-11-20',
            note: 'note',
        };

        it('기준이 없으면(미국·크립토) 캡션을 그리지 않는다', () => {
            render(<ValuationCard metrics={SAMPLE_METRICS} basis={null} />);
            expect(screen.queryByText(/DART/)).not.toBeInTheDocument();
            expect(
                screen.queryByText(/데이터 제공처 기준/)
            ).not.toBeInTheDocument();
        });

        it('연결 DART 기준이면 순이익 기간과 자본 기준일을 담은 캡션을 그린다', () => {
            render(
                <ValuationCard
                    metrics={SAMPLE_METRICS}
                    basis={{
                        ...DART_BASIS,
                        ttmEnd: '2026-09-30',
                        equityAsOf: '2026-08-31',
                    }}
                />
            );
            const caption = screen.getByText(
                /DART 연결 재무제표의 지배주주 기준/
            );
            expect(caption).toHaveTextContent('2026-09-30까지 최근 4분기');
            expect(caption).toHaveTextContent('자본은 2026-08-31 기준');
            expect(caption).toHaveTextContent('발행주식 총수');
            expect(caption).toHaveTextContent('자기주식을 뺀 주식수');
        });

        it('별도 재무제표만 내는 회사는 그렇다고 말한다', () => {
            render(
                <ValuationCard
                    metrics={SAMPLE_METRICS}
                    basis={{ ...DART_BASIS, statements: 'separate' }}
                />
            );
            expect(
                screen.getByText(/연결 재무제표를 내지 않아 DART 별도 재무제표/)
            ).toBeInTheDocument();
        });

        it('순이익 기간을 모르면(PER 없음) 자본 기준만 말한다', () => {
            render(
                <ValuationCard
                    metrics={SAMPLE_METRICS}
                    basis={{ ...DART_BASIS, ttmEnd: null }}
                />
            );
            const caption = screen.getByText(/PER은 비워 뒀어요/);
            expect(caption).toHaveTextContent('2026-06-30 자본');
            expect(
                screen.queryByText(/최근 4분기, 자본은/)
            ).not.toBeInTheDocument();
        });

        it('데이터 제공처 기준이면 그렇게만 말한다', () => {
            render(
                <ValuationCard
                    metrics={SAMPLE_METRICS}
                    basis={{
                        ...DART_BASIS,
                        source: 'provider',
                        statements: null,
                        ttmEnd: null,
                        equityAsOf: null,
                    }}
                />
            );
            expect(
                screen.getByText('PER과 PBR은 데이터 제공처 기준이에요.')
            ).toBeInTheDocument();
            expect(screen.queryByText(/DART/)).not.toBeInTheDocument();
        });

        it('지표가 없는 빈 카드에는 캡션을 붙이지 않는다', () => {
            render(<ValuationCard metrics={null} basis={DART_BASIS} />);
            expect(screen.queryByText(/DART/)).not.toBeInTheDocument();
        });
    });
});
