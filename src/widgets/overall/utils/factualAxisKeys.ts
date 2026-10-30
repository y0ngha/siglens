import { getDescriptor } from '@/shared/config/marketProfile/registry';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';

/**
 * 종합 분석이 다루는 축의 `shared.symbolTab` 키. 크롤러가 읽는 SSR 본문이라 존재하지
 * 않는 분석을 약속하면 안 된다 — `assetClass` 이진 분류만으로는 옵션 탭이 없는 한국
 * 개별주식을 가르지 못해, descriptor의 실제 tabs whitelist로 옵션 탭 유무를 판정한다.
 */
export function getFactualAxisKeys(
    marketProfile: MarketProfileId
): readonly string[] {
    const descriptor = getDescriptor(marketProfile);
    if (descriptor.assetClass === 'crypto') {
        return ['chart', 'news', 'fear-greed'];
    }

    if (descriptor.tabs.includes('options')) {
        return ['chart', 'news', 'fundamental', 'options', 'fear-greed'];
    }

    return ['chart', 'news', 'fundamental', 'fear-greed'];
}
