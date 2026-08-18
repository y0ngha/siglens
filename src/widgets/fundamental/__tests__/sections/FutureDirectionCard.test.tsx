import { render, screen } from '@testing-library/react';
import { EMPTY_MESSAGE } from '@/widgets/fundamental/sections/EmptySectionCard';
import { FutureDirectionCard } from '@/widgets/fundamental/sections/FutureDirectionCard';
import type {
    FundamentalAnalystEstimateInput,
    FundamentalGradesConsensusInput,
    FundamentalPriceTargetConsensusInput,
} from '@y0ngha/siglens-core';

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
            />
        );
        expect(
            screen.getByRole('heading', { name: '미래 방향' })
        ).toBeInTheDocument();
        expect(screen.getByText(EMPTY_MESSAGE)).toBeInTheDocument();
    });

    it('renders only available sections when partial null', () => {
        render(
            <FutureDirectionCard
                symbol="AAPL"
                estimates={SAMPLE_ESTIMATES}
                grades={null}
                ptConsensus={null}
                ptSummary={null}
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
                estimates={null}
                grades={null}
                ptConsensus={SAMPLE_PT_CONSENSUS}
                ptSummary={null}
            />
        );

        expect(screen.getByText('₩150')).toBeInTheDocument();
        expect(screen.getByText('₩250')).toBeInTheDocument();
        expect(screen.queryByText(/US\$/)).not.toBeInTheDocument();
    });
});
