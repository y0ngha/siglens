import { constants } from 'node:http2';
import { NextRequest, NextResponse } from 'next/server';
import { AlpacaProvider } from '@/infrastructure/market/alpaca';
import type { Timeframe } from '@/domain/types';
import {
    DEFAULT_BARS_LIMIT,
    TIMEFRAME_BARS_LIMIT,
} from '@/domain/constants/market';

const { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_INTERNAL_SERVER_ERROR } =
    constants;

const VALID_TIMEFRAMES = Object.keys(TIMEFRAME_BARS_LIMIT) as Timeframe[];

/** hasMore 판단을 위해 limit보다 1개 더 요청하는 수 */
const LOOK_AHEAD_COUNT = 1;

function isValidTimeframe(value: string): value is Timeframe {
    return (VALID_TIMEFRAMES as string[]).includes(value);
}

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const symbol = searchParams.get('symbol');
    const timeframeParam = searchParams.get('timeframe');
    const before = searchParams.get('before') ?? undefined;
    const limit = Number(searchParams.get('limit')) || DEFAULT_BARS_LIMIT;

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

    try {
        const bars = await market.getBars({
            symbol,
            timeframe: timeframeParam,
            limit: limit + LOOK_AHEAD_COUNT,
            before,
        });

        const hasMore = bars.length > limit;

        return NextResponse.json({
            bars: hasMore ? bars.slice(0, limit) : bars,
            hasMore,
        });
    } catch {
        return NextResponse.json(
            { error: 'Failed to fetch bars from market data provider' },
            { status: HTTP_STATUS_INTERNAL_SERVER_ERROR }
        );
    }
}
