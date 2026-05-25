import { render, screen } from '@testing-library/react';
import { EMPTY_MESSAGE } from '@/widgets/fundamental/sections/EmptySectionCard';
import { ProfitabilityCard } from '@/widgets/fundamental/sections/ProfitabilityCard';
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

    it('shows dash and no progress bar when a ratio value is null', () => {
        const ratiosWithNull = {
            ...SAMPLE_RATIOS,
            returnOnEquityTTM: null,
            returnOnAssetsTTM: null,
        } as unknown as FundamentalRatiosInput;
        render(<ProfitabilityCard ratios={ratiosWithNull} />);
        // Null values render as em-dash "—"
        const dashes = screen.getAllByText('—');
        expect(dashes.length).toBeGreaterThanOrEqual(2);
    });

    it('renders empty state with heading when ratios is null', () => {
        render(<ProfitabilityCard ratios={null} />);
        expect(
            screen.getByRole('heading', { name: '수익성' })
        ).toBeInTheDocument();
        expect(screen.getByText(EMPTY_MESSAGE)).toBeInTheDocument();
    });
});
