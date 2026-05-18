/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { FinancialHealthCard } from '@/components/fundamental/sections/FinancialHealthCard';
import type {
    FundamentalRatiosInput,
    FundamentalFinancialScoresInput,
    FundamentalCashFlowInput,
} from '@y0ngha/siglens-core';

const SAMPLE_RATIOS = {
    debtRatioTTM: 0.3,
    currentRatioTTM: 1.5,
    returnOnEquityTTM: 0.4,
    returnOnAssetsTTM: 0.1,
    operatingProfitMarginTTM: 0.3,
    netProfitMarginTTM: 0.25,
} as unknown as FundamentalRatiosInput;

const SAMPLE_SCORES = {
    altmanZScore: 3.5,
    piotroskiScore: 7,
} as unknown as FundamentalFinancialScoresInput;

const SAMPLE_CASHFLOW = {
    operatingCashFlow: 100_000_000_000,
} as unknown as FundamentalCashFlowInput;

describe('FinancialHealthCard', () => {
    it('renders metrics when all data provided', () => {
        render(
            <FinancialHealthCard
                ratios={SAMPLE_RATIOS}
                scores={SAMPLE_SCORES}
                cashFlow={SAMPLE_CASHFLOW}
            />
        );
        expect(screen.getByRole('heading', { name: '재무 건전성' })).toBeInTheDocument();
        expect(screen.getByText('부채 비율')).toBeInTheDocument();
    });

    it('renders empty state when all data is null', () => {
        render(<FinancialHealthCard ratios={null} scores={null} cashFlow={null} />);
        expect(screen.getByRole('heading', { name: '재무 건전성' })).toBeInTheDocument();
        expect(screen.getByText('데이터를 불러올 수 없습니다.')).toBeInTheDocument();
    });

    it('renders metrics when only some data provided (partial null tolerated)', () => {
        render(
            <FinancialHealthCard ratios={SAMPLE_RATIOS} scores={null} cashFlow={null} />
        );
        expect(screen.getByRole('heading', { name: '재무 건전성' })).toBeInTheDocument();
        expect(screen.getByText('부채 비율')).toBeInTheDocument();
    });
});
