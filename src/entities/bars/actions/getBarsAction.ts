'use server';

import {
    type BarsData,
    type Timeframe,
    isTimeframeAllowed,
} from '@y0ngha/siglens-core';
import { resolveCallerTier } from '@/entities/auth/server/resolveCallerTier';
import { resolveMarketProfileStatic } from '@/entities/ticker/lib/resolveMarketProfileStatic';
import { loadBarsData } from '../server/loadBarsData';

/**
 * 클라이언트 차트(`useBars`)·워치리스트·포지션 카드가 부르는 봉+지표 조회.
 *
 * 호출자 티어가 `timeframe`을 허용하지 않으면 던진다(React Query 재시도·에러 경계가 throw를 기준으로 돈다).
 * 지표는 `loadBarsData`가 유효숫자 6자리로 줄여 내려보내고, 서버 전용 `fearGreedBars`(5년 일봉)는 응답에서
 * 뗀다 — 보내면 차트·공포탐욕 탭 응답이 약 2.5배가 된다. 클라이언트 공포·탐욕은 서버가 계산한 결과를
 * `getSymbolFearGreedAction`으로 받는다.
 *
 * 시장 프로필은 캐시된 `resolveMarketProfileStatic`으로 해석한다. 이 액션은 차트를 볼 때마다(시드가 항상
 * 낡아 있어 사실상 매번) 불리는데, 캐시 없는 `resolveMarketProfile`은 호출마다 `asset_translations`를
 * 읽는다. 레이아웃이 이미 읽은 `getAssetInfoStatic` 엔트리를 그대로 쓴다.
 */
export async function getBarsAction(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): Promise<BarsData> {
    const tier = await resolveCallerTier('getBarsAction');
    if (!isTimeframeAllowed(tier, timeframe)) {
        throw new Error(
            `Timeframe ${timeframe} is not available for ${tier} tier.`
        );
    }
    const data = await loadBarsData(
        symbol,
        timeframe,
        fmpSymbol,
        resolveMarketProfileStatic
    );
    const { fearGreedBars: _serverOnly, ...clientData } = data;
    return clientData;
}
