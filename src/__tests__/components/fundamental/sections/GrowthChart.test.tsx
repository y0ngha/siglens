/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { GrowthChart } from '@/components/fundamental/sections/GrowthChart';
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
        expect(
            screen.getByText('데이터를 불러올 수 없습니다.')
        ).toBeInTheDocument();
    });
});
