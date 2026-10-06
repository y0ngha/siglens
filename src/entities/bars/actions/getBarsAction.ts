'use server';

import {
    type BarsData,
    type Tier,
    type Timeframe,
    isTimeframeAllowed,
} from '@y0ngha/siglens-core';
import { loadBarsData } from '../lib/loadBarsData';
import { resolveCallerTier } from '@/entities/auth/lib/resolveCallerTier';
import { resolveMarketProfileStatic } from '@/entities/ticker/lib/resolveMarketProfileStatic';

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
    // 시장 프로필은 캐시된 경로로 해석한다. 이 액션은 차트를 볼 때마다(시드가 항상 낡아
    // 있어 사실상 매번) 불리는데, 캐시 없는 `resolveMarketProfile`은 호출마다
    // `asset_translations`를 읽었다(2026-10 서버 성능 감사 L4). 레이아웃이 이미 읽은
    // `getAssetInfoStatic` 엔트리를 그대로 쓴다.
    const data = await loadBarsData(
        symbol,
        timeframe,
        fmpSymbol,
        resolveMarketProfileStatic
    );
    // `fearGreedBars`(5년 일봉)는 서버 전용이다 — 클라이언트로 보내면 차트·공포탐욕
    // 탭의 응답이 약 2.5배가 된다. 클라이언트 공포·탐욕은 서버가 계산한 결과를
    // `getSymbolFearGreedAction`으로 받는다.
    const { fearGreedBars: _serverOnly, ...clientData } = data;
    return clientData;
}
