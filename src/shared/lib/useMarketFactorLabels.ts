import { useTranslations } from 'next-intl';
import type { FearGreedMarketId } from '@/shared/lib/marketFearGreedLabels';

/**
 * 시장 공포·탐욕 팩터의 라벨·설명을 로케일에 맞게 돌려준다.
 *
 * 예전에는 `MARKET_FACTOR_LABEL`/`MARKET_FACTOR_DESCRIPTION`이 한국어 문자열
 * 테이블이라 `/en/fear-greed`가 `시장 모멘텀`·`S&P 500이 125일 이동평균보다…`를
 * 그대로 렌더했다. 두 소비처(`FearGreedRouteBody`, `MarketFearGreedFactorBar`)가
 * 같은 테이블을 읽으므로 조회도 여기 한 곳으로 모은다.
 *
 * `junk_bond`만 시장별로 이름이 다르다(미국=하이일드, 한국=신용 스프레드).
 */
export function useMarketFactorLabels(market: FearGreedMarketId): {
    label: (key: string) => string;
    description: (key: string) => string;
} {
    const t = useTranslations('shared.lib.fearGreedFactor');
    return {
        label: key =>
            t(`label.${key === 'junk_bond' ? `junk_bond_${market}` : key}`),
        description: key =>
            t(`${market === 'kr' ? 'descriptionKr' : 'descriptionUs'}.${key}`),
    };
}
