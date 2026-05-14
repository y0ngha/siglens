import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { YahooOptionsAdapter } from '@/infrastructure/options/YahooOptionsAdapter';
import { getOptionsCacheLifeProfile } from '@/infrastructure/options/optionsCacheLife';
import { optionsSymbolTag } from '@/infrastructure/options/optionsCacheTags';
import type { OptionsSnapshot } from '@y0ngha/siglens-core';

const adapter = new YahooOptionsAdapter();

/**
 * 옵션 시장이 형성된 종목인지 확인한다.
 *
 * 옵션 가능 여부는 거의 변경되지 않으므로 weekend 프로파일(6h revalidate /
 * 1d expire)을 재사용해 캐시 부담을 최소화한다. 같은 종목 캐시 태그를 달아
 * 시세 캐시와 한 번에 revalidate할 수 있게 한다.
 */
export async function hasOptionsMarket(symbol: string): Promise<boolean> {
    'use cache';
    cacheLife('options-weekend');
    cacheTag(optionsSymbolTag(symbol));
    return adapter.hasOptionsMarket(symbol);
}

/**
 * 종목의 전체 옵션 스냅샷(모든 만기)을 가져온다. 옵션 없는 종목이면 null.
 *
 * cacheLife는 현재 ET 시간대에 따라 동적으로 선택한다 (장중 5분, 장 마감 후
 * 30분, 주말 6시간 revalidate). next.config.ts에 등록된 프로파일 이름을
 * 그대로 넘긴다.
 */
export async function fetchOptionsSnapshot(
    symbol: string
): Promise<OptionsSnapshot | null> {
    'use cache';
    cacheLife(getOptionsCacheLifeProfile());
    cacheTag(optionsSymbolTag(symbol));
    return adapter.fetchSnapshot(symbol);
}
