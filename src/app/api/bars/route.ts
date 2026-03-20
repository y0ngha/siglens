import { NextRequest, NextResponse } from 'next/server';
import { AlpacaProvider } from '@/infrastructure/market/alpaca';
import {
    calculateMACD,
    calculateBollinger,
    calculateDMI,
} from '@/domain/indicators';
import type { Timeframe } from '@/domain/types';

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const symbol = searchParams.get('symbol');
    const timeframe = searchParams.get('timeframe') as Timeframe | null;
    const before = searchParams.get('before') ?? undefined;

    if (!symbol || !timeframe) {
        return NextResponse.json(
            { error: 'symbol and timeframe are required' },
            { status: 400 }
        );
    }

    const market = new AlpacaProvider();
    const bars = await market.getBars({ symbol, timeframe, before });

    const closes = bars.map(b => b.close);
    const highs = bars.map(b => b.high);
    const lows = bars.map(b => b.low);

    const indicators = {
        macd: calculateMACD(closes),
        bollinger: calculateBollinger(closes),
        dmi: calculateDMI(highs, lows, closes),
    };

    return NextResponse.json({ bars, indicators });
}
