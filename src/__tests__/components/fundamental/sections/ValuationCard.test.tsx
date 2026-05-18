/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ValuationCard } from '@/components/fundamental/sections/ValuationCard';
import type { FundamentalValuationMetrics } from '@y0ngha/siglens-core';

const SAMPLE_METRICS: FundamentalValuationMetrics = {
    peRatioTTM: 28.5,
    priceToSalesRatioTTM: 7.2,
    pbRatioTTM: 45.1,
    pegRatioTTM: 2.3,
    enterpriseValueOverEBITDATTM: 20.1,
    epsTTM: 6.5,
};

describe('ValuationCard', () => {
    it('renders metric values when metrics provided', () => {
        render(<ValuationCard metrics={SAMPLE_METRICS} />);
        expect(screen.getByRole('heading', { name: '밸류에이션' })).toBeInTheDocument();
        expect(screen.getByText('PER')).toBeInTheDocument();
    });

    it('renders empty state with heading when metrics is null', () => {
        render(<ValuationCard metrics={null} />);
        expect(screen.getByRole('heading', { name: '밸류에이션' })).toBeInTheDocument();
        expect(screen.getByText('데이터를 불러올 수 없습니다.')).toBeInTheDocument();
    });
});
