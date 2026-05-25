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

    it('shows positive growth as green with + prefix', () => {
        render(<GrowthChart growth={SAMPLE_GROWTH} />);
        expect(screen.getByText('+12.0%')).toBeInTheDocument();
        expect(screen.getByText('+18.0%')).toBeInTheDocument();
    });

    it('shows negative growth as red without + prefix', () => {
        const negativeGrowth = {
            growthRevenue: -0.08,
            growthEPS: -0.25,
        } as unknown as FundamentalGrowthInput;
        render(<GrowthChart growth={negativeGrowth} />);
        expect(screen.getByText('-8.0%')).toBeInTheDocument();
        expect(screen.getByText('-25.0%')).toBeInTheDocument();
    });

    it('shows dash for null values', () => {
        const nullGrowth = {
            growthRevenue: null,
            growthEPS: null,
        } as unknown as FundamentalGrowthInput;
        render(<GrowthChart growth={nullGrowth} />);
        const dashes = screen.getAllByText('—');
        expect(dashes.length).toBe(2);
    });

    it('shows zero growth as +0.0%', () => {
        const zeroGrowth = {
            growthRevenue: 0,
            growthEPS: 0,
        } as unknown as FundamentalGrowthInput;
        render(<GrowthChart growth={zeroGrowth} />);
        const zeros = screen.getAllByText('+0.0%');
        expect(zeros.length).toBe(2);
    });
});
