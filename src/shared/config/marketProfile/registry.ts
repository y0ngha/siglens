import type { AssetInfo } from '@/shared/lib/types';
import { KR_SYMBOL_RE } from '@/shared/config/ticker';
import type { MarketProfileDescriptor, MarketProfileId } from './types';
import { US_EQUITY_DESCRIPTOR } from './usEquity';
import { CRYPTO_DESCRIPTOR } from './crypto';
import { KR_EQUITY_DESCRIPTOR } from './krEquity';

export const DEFAULT_MARKET_PROFILE: MarketProfileId = 'us-equity';

const REGISTRY: Record<MarketProfileId, MarketProfileDescriptor> = {
    'us-equity': US_EQUITY_DESCRIPTOR,
    crypto: CRYPTO_DESCRIPTOR,
    'kr-equity': KR_EQUITY_DESCRIPTOR,
};

/** Look up the descriptor for a market-profile id. */
export function getDescriptor(id: MarketProfileId): MarketProfileDescriptor {
    return REGISTRY[id];
}

/**
 * 심볼 형상만으로 한국 상장 종목을 판정한다 — DB 조회도 async도 없다.
 *
 * 크립토는 `crypto_assets` 멤버십 조회가 authoritative라 `isCryptoSymbol`(async) +
 * `isCryptoSymbolStatic`(`unstable_cache` 래핑)이 필요했지만, 한국 종목은 거래소
 * 접미사가 canonical 심볼에 내장되어 있어 정규식 한 번으로 끝난다. 미들웨어,
 * ISR cold-gen, 탭 가드가 전부 이 순수 함수를 쓴다.
 */
export function isKrEquitySymbol(symbol: string): boolean {
    // 타입은 string이지만 이 판정은 캐시·DB에서 되살아난 부분 객체(`{ name }`만 있는
    // AssetInfo 등)에도 닿는다. 그런 입력에서 TypeError로 렌더를 죽이느니 "한국 종목
    // 아님"으로 떨어뜨린다 — 오분류의 대가가 크래시보다 작다.
    return (
        typeof symbol === 'string' && KR_SYMBOL_RE.test(symbol.toUpperCase())
    );
}

/**
 * Resolve an AssetInfo's market profile, defaulting legacy/profile-less assets to us-equity.
 *
 * `marketProfile`이 비어 있어도 한국 종목은 심볼 형상으로 복구한다 — 캐시에 남아 있는
 * 구버전 레코드나 `marketProfile`을 채우지 않은 경로에서도 KRW 포맷·KST 세션·탭 구성이
 * 미국 주식으로 오분류되지 않게 하는 안전망이다. 크립토는 형상으로 판정할 수 없어
 * 같은 fallback을 둘 수 없다(`marketProfile` 필드가 유일한 근거).
 */
export function marketProfileOf(asset: AssetInfo): MarketProfileId {
    if (asset.marketProfile) return asset.marketProfile;
    if (isKrEquitySymbol(asset.symbol)) return 'kr-equity';
    return DEFAULT_MARKET_PROFILE;
}
