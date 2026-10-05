'use server';

import {
    type BarsData,
    type Tier,
    type Timeframe,
    isTimeframeAllowed,
} from '@y0ngha/siglens-core';
import { loadBarsData } from '../lib/loadBarsData';
import { resolveCallerTier } from '@/entities/auth/lib/resolveCallerTier';

async function resolveBarsTier(): Promise<Tier> {
    return resolveCallerTier('getBarsAction');
}

export async function getBarsAction(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): Promise<BarsData> {
    const tier = await resolveBarsTier();
    if (!isTimeframeAllowed(tier, timeframe)) {
        throw new Error(
            `Timeframe ${timeframe} is not available for ${tier} tier.`
        );
    }
    const data = await loadBarsData(symbol, timeframe, fmpSymbol);
    // `fearGreedBars`(5년 일봉)는 서버 전용이다 — 클라이언트로 보내면 차트·공포탐욕
    // 탭의 응답이 약 2.5배가 된다. 클라이언트 공포·탐욕은 서버가 계산한 결과를
    // `getSymbolFearGreedAction`으로 받는다.
    const { fearGreedBars: _serverOnly, ...clientData } = data;
    return clientData;
}
