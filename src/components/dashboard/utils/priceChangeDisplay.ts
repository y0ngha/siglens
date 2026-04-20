export interface PriceChangeDisplay {
    isUp: boolean;
    sign: '+' | '';
    colorClass: string;
    arrow: '▲' | '▼';
    arrowLabel: '상승' | '하락';
}

export function formatPriceChange(percent: number): PriceChangeDisplay {
    const isUp = percent >= 0;
    return {
        isUp,
        sign: isUp ? '+' : '',
        colorClass: isUp ? 'text-chart-bullish' : 'text-chart-bearish',
        arrow: isUp ? '▲' : '▼',
        arrowLabel: isUp ? '상승' : '하락',
    };
}
