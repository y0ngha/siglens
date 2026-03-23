import { constants } from 'node:http2';
import { NextRequest, NextResponse } from 'next/server';
import { AlpacaProvider } from '@/infrastructure/market/alpaca';
import type { Timeframe } from '@/domain/types';

const { HTTP_STATUS_BAD_REQUEST } = constants;

const VALID_TIMEFRAMES: Timeframe[] = [
    '1Min',
    '5Min',
    '15Min',
    '1Hour',
    '1Day',
];
const DEFAULT_LIMIT = 500;

function isValidTimeframe(value: string): value is Timeframe {
    return (VALID_TIMEFRAMES as string[]).includes(value);
}

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const symbol = searchParams.get('symbol');
    const timeframeParam = searchParams.get('timeframe');
    const before = searchParams.get('before') ?? undefined;
    const limit = Number(searchParams.get('limit')) || DEFAULT_LIMIT;

    if (!symbol || !timeframeParam) {
        return NextResponse.json(
            { error: 'symbol and timeframe are required' },
            { status: HTTP_STATUS_BAD_REQUEST }
        );
    }

    if (!isValidTimeframe(timeframeParam)) {
        return NextResponse.json(
            {
                error: `timeframe must be one of ${VALID_TIMEFRAMES.join(', ')}`,
            },
            { status: HTTP_STATUS_BAD_REQUEST }
        );
    }

    const market = new AlpacaProvider();
    const bars = await market.getBars({
        symbol,
        timeframe: timeframeParam,
        limit: limit + 1,
        before,
    });

    const hasMore = bars.length > limit;

    return NextResponse.json({
        bars: hasMore ? bars.slice(0, limit) : bars,
        hasMore,
    });
}
