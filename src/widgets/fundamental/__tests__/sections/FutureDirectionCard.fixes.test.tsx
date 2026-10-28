import { render, screen } from '@testing-library/react';
import { FutureDirectionCard } from '@/widgets/fundamental/sections/FutureDirectionCard';
import type {
    FundamentalGradesConsensusInput,
    FundamentalPriceTargetConsensusInput,
    FundamentalPriceTargetSummaryInput,
} from '@y0ngha/siglens-core';
import { koMessage } from '@/shared/test-utils/koMessage';

const PT_SUMMARY: FundamentalPriceTargetSummaryInput = {
    lastMonth: { count: 3, avgPriceTarget: 210 },
    lastQuarter: { count: 9, avgPriceTarget: 205 },
    lastYear: { count: 30, avgPriceTarget: 190 },
} as unknown as FundamentalPriceTargetSummaryInput;

const PT_CONSENSUS = {
    targetLow: 150,
    targetMedian: 200,
    targetConsensus: 195,
    targetHigh: 250,
} as unknown as FundamentalPriceTargetConsensusInput;

const ZERO_GRADES: FundamentalGradesConsensusInput = {
    strongBuy: 0,
    buy: 0,
    hold: 0,
    sell: 0,
    strongSell: 0,
};

const EMPTY_MESSAGE = koMessage('widgets.financials.section.emptySection');

describe('FutureDirectionCard — 목표 주가 요약', () => {
    it('컨센서스 없이 요약만 있어도 목표 주가 섹션을 그린다', () => {
        render(
            <FutureDirectionCard
                symbol="AAPL"
                estimates={null}
                grades={null}
                ptConsensus={null}
                ptSummary={PT_SUMMARY}
            />
        );

        expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument();
        expect(screen.getByText('US$210.00')).toBeInTheDocument();
        expect(screen.getByText('US$205.00')).toBeInTheDocument();
        expect(screen.getByText('US$190.00')).toBeInTheDocument();
        // 컨센서스 그리드는 그리지 않는다.
        expect(screen.queryByText('US$250.00')).not.toBeInTheDocument();
    });

    it('요약 없이 컨센서스만 있으면 그리드만 그린다', () => {
        render(
            <FutureDirectionCard
                symbol="AAPL"
                estimates={null}
                grades={null}
                ptConsensus={PT_CONSENSUS}
                ptSummary={null}
            />
        );

        expect(screen.getByText('US$250.00')).toBeInTheDocument();
        expect(screen.queryByText('US$210.00')).not.toBeInTheDocument();
    });

    it('둘 다 있으면 함께 그린다', () => {
        render(
            <FutureDirectionCard
                symbol="AAPL"
                estimates={null}
                grades={null}
                ptConsensus={PT_CONSENSUS}
                ptSummary={PT_SUMMARY}
            />
        );

        expect(screen.getByText('US$250.00')).toBeInTheDocument();
        expect(screen.getByText('US$210.00')).toBeInTheDocument();
    });
});

describe('FutureDirectionCard — 전부 0인 등급', () => {
    it('등급만 있고 전부 0이면 빈 상태를 그린다', () => {
        render(
            <FutureDirectionCard
                symbol="AAPL"
                estimates={null}
                grades={ZERO_GRADES}
                ptConsensus={null}
                ptSummary={null}
            />
        );

        expect(screen.getByText(EMPTY_MESSAGE)).toBeInTheDocument();
    });

    it('다른 섹션이 있으면 등급 제목을 남기지 않는다', () => {
        render(
            <FutureDirectionCard
                symbol="AAPL"
                estimates={null}
                grades={ZERO_GRADES}
                ptConsensus={PT_CONSENSUS}
                ptSummary={null}
            />
        );

        expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
    });

    it('한 건이라도 있으면 범례 다섯 개와 건수를 그린다', () => {
        const { container } = render(
            <FutureDirectionCard
                symbol="AAPL"
                estimates={null}
                grades={{ ...ZERO_GRADES, hold: 4 }}
                ptConsensus={null}
                ptSummary={null}
            />
        );

        expect(container.querySelectorAll('dt')).toHaveLength(5);
        expect(screen.getByText('4')).toBeInTheDocument();
    });
});
