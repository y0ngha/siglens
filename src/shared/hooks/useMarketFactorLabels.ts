import { useTranslations } from 'next-intl';
import type { FearGreedMarketId } from '@/shared/lib/marketFearGreedLabels';

/** `useMarketFactorLabels`가 돌려주는 팩터 키별 라벨·설명 조회 함수. */
export interface MarketFactorLabels {
    readonly label: (key: string) => string;
    readonly description: (key: string) => string;
}

const DESCRIPTION_NAMESPACE: Record<FearGreedMarketId, string> = {
    us: 'descriptionUs',
    kr: 'descriptionKr',
    crypto: 'descriptionCrypto',
};

/**
 * 시장 공포·탐욕 팩터의 라벨·설명을 로케일에 맞게 돌려준다. 두 소비처
 * (`FearGreedRouteBody`, `MarketFearGreedFactorBar`)가 같은 카탈로그를 읽으므로 조회를
 * 여기 한 곳으로 모은다.
 *
 * `junk_bond`만 시장별로 이름이 다르다(미국=하이일드, 한국=신용 스프레드).
 * 암호화폐는 요인 집합 자체가 달라(`CRYPTO_FEAR_GREED_FACTOR_KEYS`) 새 키는
 * `label.*`에, 설명은 `descriptionCrypto.*`에 있다. 겹치는 키(`momentum`·
 * `safe_haven`·`breadth`)는 이름이 같아도 설명이 다르므로 설명만 시장별로 가른다.
 */
export function useMarketFactorLabels(
    market: FearGreedMarketId
): MarketFactorLabels {
    const t = useTranslations('shared.lib.fearGreedFactor');
    return {
        label: key =>
            t(`label.${key === 'junk_bond' ? `junk_bond_${market}` : key}`),
        description: key => t(`${DESCRIPTION_NAMESPACE[market]}.${key}`),
    };
}
