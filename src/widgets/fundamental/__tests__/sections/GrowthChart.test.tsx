/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { EMPTY_MESSAGE } from '@/widgets/fundamental/sections/EmptySectionCard';
import { GrowthChart } from '@/widgets/fundamental/sections/GrowthChart';
import type { FundamentalGrowthInput } from '@y0ngha/siglens-core';

const SAMPLE_GROWTH = {
    growthRevenue: 0.12,
    growthEPS: 0.18,
} as unknown as FundamentalGrowthInput;

describe('GrowthChart', () => {
    it('renders growth bars when growth provided', () => {
        render(<GrowthChart growth={SAMPLE_GROWTH} />);
        expect(
            screen.getByRole('heading', { name: '성장성' })
        ).toBeInTheDocument();
        expect(screen.getByText('매출 성장률')).toBeInTheDocument();
    });

    it('renders empty state with heading when growth is null', () => {
        render(<GrowthChart growth={null} />);
        expect(
            screen.getByRole('heading', { name: '성장성' })
        ).toBeInTheDocument();
        expect(screen.getByText(EMPTY_MESSAGE)).toBeInTheDocument();
    });
});
