import 'server-only';
import type { FearGreedReading } from '@y0ngha/siglens-core';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { getMarketFearGreedStatic } from './marketFearGreedStaticCache';
import { getMarketFearGreedKrStatic } from './marketFearGreedKrStaticCache';
import { getMarketFearGreedCryptoStatic } from './marketFearGreedCryptoStaticCache';
import type { MarketFearGreedViewSnapshot } from '../model';

const LOADERS: Record<
    MarketProfileId,
    () => Promise<{ snapshot: MarketFearGreedViewSnapshot | null }>
> = {
    'us-equity': getMarketFearGreedStatic,
    'kr-equity': getMarketFearGreedKrStatic,
    crypto: getMarketFearGreedCryptoStatic,
};

/**
 * 종목이 속한 시장의 최신 공포·탐욕 판독 하나(날짜·점수·라벨).
 *
 * 종목 공포·탐욕 페이지가 "같은 날 시장 점수와의 차이"를 보이려고 읽는다. 시장
 * 허브(`/fear-greed`, `/fear-greed/kr`, `/fear-greed/crypto`)와 **같은 정적 캐시**를
 * 쓰므로 새 외부 호출이 없고, 두 페이지의 시장 점수가 갈리지 않는다.
 *
 * 실패는 `null`로 삼킨다 — 시장 점수는 종목 페이지의 보조 문장 하나일 뿐이라,
 * 그 조회가 실패해 종목 페이지 렌더(ISR)가 죽으면 안 된다.
 */
export async function getMarketFearGreedReading(
    marketProfile: MarketProfileId
): Promise<FearGreedReading | null> {
    try {
        const { snapshot } = await LOADERS[marketProfile]();
        if (snapshot === null) return null;
        return {
            date: snapshot.asOf,
            score: snapshot.score,
            label: snapshot.label,
        };
    } catch (e) {
        console.error(
            '[getMarketFearGreedReading] market fear-greed load failed:',
            e
        );
        return null;
    }
}
