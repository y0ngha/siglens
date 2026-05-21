import 'server-only';
import { cache } from 'react';
import { YahooOptionsAdapter } from '@/infrastructure/options/YahooOptionsAdapter';
import type { OptionsSnapshot } from '@y0ngha/siglens-core';

// cacheComponents 비활성 기간 동안 'use cache' / cacheLife / cacheTag 모두 제거.
// 동일 요청 내 중복 호출(예: generateMetadata + page body 모두 hasOptionsMarket 호출)은
// React.cache로 per-request memoization을 적용해 Yahoo 중복 조회를 막는다.
// cross-request 캐싱은 손실 — 이슈 #439 참조.
const adapter = new YahooOptionsAdapter();

/**
 * 옵션 시장이 형성된 종목인지 확인한다.
 */
export const hasOptionsMarket = cache(
    async (symbol: string): Promise<boolean> => {
        return adapter.hasOptionsMarket(symbol);
    }
);

/**
 * 종목의 전체 옵션 스냅샷(모든 만기)을 가져온다. 옵션 없는 종목이면 null.
 */
export const fetchOptionsSnapshot = cache(
    async (symbol: string): Promise<OptionsSnapshot | null> => {
        return adapter.fetchSnapshot(symbol);
    }
);
