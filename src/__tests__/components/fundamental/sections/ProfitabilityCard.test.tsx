/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { EMPTY_MESSAGE } from '@/components/fundamental/sections/EmptySectionCard';
import { ProfitabilityCard } from '@/components/fundamental/sections/ProfitabilityCard';
import type { FundamentalRatiosInput } from '@y0ngha/siglens-core';

const SAMPLE_RATIOS = {
    returnOnEquityTTM: 0.45,
    returnOnAssetsTTM: 0.15,
    operatingProfitMarginTTM: 0.3,
    netProfitMarginTTM: 0.25,
    debtRatioTTM: 0.3,
    currentRatioTTM: 1.5,
} as unknown as FundamentalRatiosInput;
// ^ FundamentalRatiosInput likely has many fields, cast is acceptable here

describe('ProfitabilityCard', () => {
    it('renders metric labels when ratios provided', () => {
        render(<ProfitabilityCard ratios={SAMPLE_RATIOS} />);
        expect(
            screen.getByRole('heading', { name: '수익성' })
        ).toBeInTheDocument();
        expect(screen.getByText('ROE')).toBeInTheDocument();
    });

    it('renders empty state with heading when ratios is null', () => {
        render(<ProfitabilityCard ratios={null} />);
        expect(
            screen.getByRole('heading', { name: '수익성' })
        ).toBeInTheDocument();
        expect(screen.getByText(EMPTY_MESSAGE)).toBeInTheDocument();
    });
});
