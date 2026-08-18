import type { AssetInfo } from '@/shared/lib/types';
import { KR_SYMBOL_RE } from '@/shared/config/ticker';
import type {
    MarketProfileDescriptor,
    MarketProfileId,
    PriceFormatConfig,
} from './types';
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

/**
 * 심볼 하나로 표시 통화를 정한다 — `isKrEquitySymbol(symbol) ? 'KRW' : 'USD'` 삼항식이
 * `formatCompactCurrency`/`FutureDirectionCard`/`EventCalendar` 세 곳에 독립적으로
 * 복제돼 있던 것을 여기 한 곳으로 모은다. 통화 판정은 `getDescriptor(...).priceFormat.currency`를
 * 거쳐야 하고(REGISTRY가 3개 프로필 전체를 exhaustive하게 갖고 있는 유일한 곳), 산발적
 * 삼항식은 그중 하나가 4번째 프로필을 얻는 순간 조용히 틀린다.
 *
 * 크립토는 심볼 형상만으로 판정할 수 없다(`crypto_assets` DB 멤버십이 authoritative —
 * `isKrEquitySymbol`의 주석 참조). 그래서 여기서는 한국 종목이 아니면 `DEFAULT_MARKET_PROFILE`
 * (us-equity)로 떨어뜨린다 — 통화 관점에서는 안전하다: us-equity와 crypto 둘 다
 * `priceFormat.currency`가 `'USD'`라서(REGISTRY 값 참조) 결과가 갈리지 않는다. 크립토를
 * 구분해야 하는 값(precision 등)은 이 함수를 쓰면 안 된다.
 */
export function currencyForSymbol(
    symbol: string
): PriceFormatConfig['currency'] {
    const profileId = isKrEquitySymbol(symbol)
        ? 'kr-equity'
        : DEFAULT_MARKET_PROFILE;
    return getDescriptor(profileId).priceFormat.currency;
}
