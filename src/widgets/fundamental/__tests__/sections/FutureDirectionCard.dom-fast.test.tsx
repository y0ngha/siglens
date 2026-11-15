import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { FutureDirectionCard } from '@/widgets/fundamental/sections/FutureDirectionCard';
import type {
    FundamentalAnalystEstimateInput,
    FundamentalGradesConsensusInput,
    FundamentalPriceTargetConsensusInput,
} from '@y0ngha/siglens-core';
import { formatCurrencyForSymbol } from '@/shared/lib/priceFormat';
import { TARGET_DISAGREE_THRESHOLD_PCT } from '@/entities/analyst-views/model';
import { koMessage } from '@/shared/test-utils/koMessage';

const SAMPLE_ESTIMATES = {
    estimatedEpsAvg: 6.5,
    estimatedRevenueAvg: 400_000_000_000,
} as unknown as FundamentalAnalystEstimateInput;

const SAMPLE_GRADES = {
    strongBuy: 20,
    buy: 15,
    hold: 5,
    sell: 2,
    strongSell: 0,
} as unknown as FundamentalGradesConsensusInput;

const SAMPLE_PT_CONSENSUS = {
    targetLow: 150,
    targetMedian: 200,
    targetConsensus: 195,
    targetHigh: 250,
} as unknown as FundamentalPriceTargetConsensusInput;

describe('FutureDirectionCard', () => {
    it('renders sections when data provided', () => {
        render(
            <FutureDirectionCard
                symbol="AAPL"
                estimates={SAMPLE_ESTIMATES}
                grades={SAMPLE_GRADES}
                ptConsensus={SAMPLE_PT_CONSENSUS}
                ptSummary={null}
                gradesSource={null}
                analystTargets={null}
                targetSourcesDisagree={false}
            />
        );
        expect(
            screen.getByRole('heading', { name: '전망과 목표가' })
        ).toBeInTheDocument();
        expect(screen.getByText('애널리스트 추정')).toBeInTheDocument();
    });

    it('renders empty state when estimates/grades/ptConsensus all null', () => {
        render(
            <FutureDirectionCard
                symbol="AAPL"
                estimates={null}
                grades={null}
                ptConsensus={null}
                ptSummary={null}
                gradesSource={null}
                analystTargets={null}
                targetSourcesDisagree={false}
            />
        );
        expect(
            screen.getByRole('heading', { name: '미래 방향' })
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                koMessage('widgets.financials.section.emptySection')
            )
        ).toBeInTheDocument();
    });

    it('renders only available sections when partial null', () => {
        render(
            <FutureDirectionCard
                symbol="AAPL"
                estimates={SAMPLE_ESTIMATES}
                grades={null}
                ptConsensus={null}
                ptSummary={null}
                gradesSource={null}
                analystTargets={null}
                targetSourcesDisagree={false}
            />
        );
        expect(
            screen.getByRole('heading', { name: '전망과 목표가' })
        ).toBeInTheDocument();
        expect(screen.getByText('애널리스트 추정')).toBeInTheDocument();
    });

    it('renders KR-equity price targets in KRW, not USD (fmtMoney currency branch)', () => {
        // 이 PR이 고친 정확한 버그: `목표 주가 US$450,000`처럼 원화 금액에 US$가
        // 붙던 것. symbol="AAPL"만 쓰던 기존 테스트는 KRW 분기를 절대 렌더하지 않았다.
        render(
            <FutureDirectionCard
                symbol="005930.KS"
                estimates={SAMPLE_ESTIMATES}
                grades={null}
                ptConsensus={SAMPLE_PT_CONSENSUS}
                ptSummary={null}
                gradesSource={null}
                analystTargets={null}
                targetSourcesDisagree={false}
            />
        );

        expect(screen.getByText('₩150')).toBeInTheDocument();
        expect(screen.getByText('₩250')).toBeInTheDocument();
        // 뮤테이션 감사(fmtBig의 symbol → 'AAPL' 생존자): estimates가 null이면
        // 매출 컨센서스(fmtBig)가 아예 렌더되지 않아 이 배선을 아무도 검증하지
        // 못했다. estimates를 채워 compact 통화(₩4000억)로 pin한다.
        expect(screen.getByText('₩4000억')).toBeInTheDocument();
        expect(screen.queryByText(/US\$/)).not.toBeInTheDocument();
    });

    describe('Yahoo 보강 줄', () => {
        const renderCard = (
            over: Partial<ComponentProps<typeof FutureDirectionCard>>
        ) =>
            render(
                <FutureDirectionCard
                    symbol="AAPL"
                    estimates={null}
                    grades={SAMPLE_GRADES}
                    gradesSource={null}
                    ptConsensus={SAMPLE_PT_CONSENSUS}
                    ptSummary={null}
                    analystTargets={null}
                    targetSourcesDisagree={false}
                    {...over}
                />
            );

        it('분포 출처가 yahoo면 현재 애널리스트 수 줄을 그린다(합계 = 다섯 건수의 합)', () => {
            renderCard({ gradesSource: 'yahoo' });
            expect(
                screen.getByText('현재 이 종목을 다루는 애널리스트 42명 기준')
            ).toBeInTheDocument();
        });

        it.each([['fmp' as const], [null]])(
            '분포 출처가 %s이면 그 줄을 그리지 않는다',
            source => {
                renderCard({ gradesSource: source });
                expect(
                    screen.queryByText(/현재 이 종목을 다루는/)
                ).not.toBeInTheDocument();
            }
        );

        it('Yahoo 목표가가 있으면 평균과 애널리스트 수를 한 줄로 그린다', () => {
            renderCard({
                analystTargets: {
                    yahooMean: 276.56,
                    yahooAnalysts: 53,
                },
            });
            expect(
                screen.getByText(
                    `Yahoo Finance 집계 평균 ${formatCurrencyForSymbol(276.56, 'AAPL', 'ko')} · 애널리스트 53명`
                )
            ).toBeInTheDocument();
            expect(
                screen.queryByText(/집계 기관에 따라/)
            ).not.toBeInTheDocument();
        });

        it('애널리스트 수를 모르면 평균만 그린다', () => {
            renderCard({
                analystTargets: {
                    yahooMean: 276.56,
                    yahooAnalysts: null,
                },
            });
            expect(
                screen.getByText(
                    `Yahoo Finance 집계 평균 ${formatCurrencyForSymbol(276.56, 'AAPL', 'ko')}`
                )
            ).toBeInTheDocument();
        });

        it('두 출처가 벌어져 있으면 안내 줄을 더한다(임계값은 엔티티 상수)', () => {
            renderCard({
                analystTargets: {
                    yahooMean: 276.56,
                    yahooAnalysts: 53,
                },
                targetSourcesDisagree: true,
            });
            expect(
                screen.getByText(
                    `집계 기관에 따라 목표가가 ${TARGET_DISAGREE_THRESHOLD_PCT}% 넘게 다릅니다. 위 수치는 FMP 집계, 이 줄은 Yahoo Finance 집계입니다.`
                )
            ).toBeInTheDocument();
        });

        it('FMP 목표가가 없어도 Yahoo 줄만으로 목표 주가 섹션이 선다', () => {
            renderCard({
                grades: null,
                ptConsensus: null,
                analystTargets: {
                    yahooMean: 100,
                    yahooAnalysts: 3,
                },
            });
            expect(
                screen.getByText(/Yahoo Finance 집계 평균/)
            ).toBeInTheDocument();
        });
    });
});
