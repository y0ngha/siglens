import { marketProfileOf } from '@/shared/config/marketProfile/registry';
import type { AssetInfo } from '@/shared/lib/types';

/** 지수 심볼의 FMP 접두사(`^SPX`). 지수는 v1에서 알림 대상이 아니다. */
const INDEX_SYMBOL_PREFIX = '^';

/**
 * 이 종목 화면에 "메일로 받기"를 둘 수 있는가. 미국·한국 주식과 ETF만이다 — 크립토와 지수는 v1에서
 * 신호 알림을 보내지 않는다. 자산 정보가 아직 없으면(`null`) 프로필을 알 수 없어 두지 않는다.
 */
export function canReceiveSymbolAlerts(
    assetInfo: AssetInfo | null | undefined
): boolean {
    if (assetInfo === null || assetInfo === undefined) return false;
    if (assetInfo.fmpSymbol?.startsWith(INDEX_SYMBOL_PREFIX)) return false;
    const profile = marketProfileOf(assetInfo);
    return profile === 'us-equity' || profile === 'kr-equity';
}
