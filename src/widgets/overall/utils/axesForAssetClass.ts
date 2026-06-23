import type { OverallAxis } from '@y0ngha/siglens-core';
import type { AssetClass } from '@/shared/config/marketProfile';

/** All four axes for equity overall analysis. */
export const EQUITY_AXIS_ORDER: readonly OverallAxis[] = [
    'technical',
    'fundamental',
    'news',
    'options',
];

/** Crypto uses only technical + news (no fundamental profile / options chain). */
export const CRYPTO_AXIS_ORDER: readonly OverallAxis[] = ['technical', 'news'];

/**
 * Returns the applicable axis list for the given asset class.
 * Centralises the equity-vs-crypto axis branching so `waitForDependencies`,
 * the cleanup effects, and `DependencyProgress` all derive from the same source.
 */
export function axesForAssetClass(
    assetClass: AssetClass
): readonly OverallAxis[] {
    return assetClass === 'crypto' ? CRYPTO_AXIS_ORDER : EQUITY_AXIS_ORDER;
}
