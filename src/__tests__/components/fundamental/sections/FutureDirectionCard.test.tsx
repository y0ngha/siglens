/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { EMPTY_MESSAGE } from '@/components/fundamental/sections/EmptySectionCard';
import { FutureDirectionCard } from '@/components/fundamental/sections/FutureDirectionCard';
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
                estimates={SAMPLE_ESTIMATES}
                grades={SAMPLE_GRADES}
                ptConsensus={SAMPLE_PT_CONSENSUS}
                ptSummary={null}
            />
        );
        expect(
            screen.getByRole('heading', { name: '미래 방향' })
        ).toBeInTheDocument();
        expect(screen.getByText('애널리스트 추정')).toBeInTheDocument();
    });

    it('renders empty state when estimates/grades/ptConsensus all null', () => {
        render(
            <FutureDirectionCard
                estimates={null}
                grades={null}
                ptConsensus={null}
                ptSummary={null}
            />
        );
        expect(
            screen.getByRole('heading', { name: '미래 방향' })
        ).toBeInTheDocument();
        expect(
            screen.getByText(EMPTY_MESSAGE)
        ).toBeInTheDocument();
    });

    it('renders only available sections when partial null', () => {
        render(
            <FutureDirectionCard
                estimates={SAMPLE_ESTIMATES}
                grades={null}
                ptConsensus={null}
                ptSummary={null}
            />
        );
        expect(
            screen.getByRole('heading', { name: '미래 방향' })
        ).toBeInTheDocument();
        expect(screen.getByText('애널리스트 추정')).toBeInTheDocument();
    });
});
