'use client';

import type { Bar } from '@/domain/types';

type StockChartProps = {
    initialBars: Bar[];
};

export function StockChart({ initialBars }: StockChartProps) {
    // TODO: implement lightweight-charts integration
    void initialBars;
    return <div />;
}
