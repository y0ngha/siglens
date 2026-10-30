/**
 * 시장 공포·탐욕 요인 한 행이 그리는 텍스트·수치를 준비하는 훅.
 */
import type { MarketFearGreedViewSnapshot } from '@/entities/market-fear-greed/model';
import { useMarketFactorLabels } from '@/shared/hooks/useMarketFactorLabels';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import {
    formatMarketFactorRaw,
    type FearGreedMarketId,
} from '@/shared/lib/marketFearGreedLabels';

/** 미국·한국 또는 암호화폐 스냅샷의 요인 하나. 키는 시장별 라벨 조회에만 쓰여 문자열이다. */
export type MarketFearGreedViewFactor =
    MarketFearGreedViewSnapshot['factors'][number];

/** 요인 행이 화면에 그대로 내는 값. */
export interface MarketFactorRow {
    /** 현재 로케일·시장의 요인 이름. */
    readonly label: string;
    /** 요인이 무엇을 재는지 한 문장. */
    readonly description: string;
    /** 막대와 숫자 표기가 함께 쓰는 정수 백분위(0–100). */
    readonly percentile: number;
    /** 원시값을 로케일 퍼센트로 낸 문자열(부호 규칙은 시장·요인별). */
    readonly rawValueText: string;
}

/**
 * 요인 하나를 행에 그릴 값으로 바꾼다.
 *
 * 막대의 채움 폭·aria-valuenow와 옆의 "백분위 N" 표기가 서로 다른 반올림을
 * 쓰지 않도록 백분위를 한 번만 반올림해 돌려준다.
 */
export function useMarketFactorRow(
    factor: MarketFearGreedViewFactor,
    market: FearGreedMarketId
): MarketFactorRow {
    const factorLabels = useMarketFactorLabels(market);
    const locale = useResolvedLocale();
    return {
        label: factorLabels.label(factor.key),
        description: factorLabels.description(factor.key),
        percentile: Math.round(factor.percentile),
        rawValueText: formatMarketFactorRaw(
            factor.rawValue,
            factor.key,
            market,
            locale
        ),
    };
}
