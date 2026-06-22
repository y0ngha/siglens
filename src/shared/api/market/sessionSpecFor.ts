import {
    US_EQUITY_SESSION,
    CRYPTO_SESSION,
    type MarketSessionSpec,
} from '@y0ngha/siglens-core';
import {
    getDescriptor,
    type MarketProfileId,
} from '@/shared/config/marketProfile';
import type { SessionModel } from '@/shared/config/marketProfile/types';

/**
 * Map a market profile to the core MarketSessionSpec.
 *
 * The mapping is explicit and exhaustive over `SessionModel` values so that
 * adding a new session model (e.g. 'kr-equity-et') forces a compile-time
 * decision here rather than silently falling through to US_EQUITY_SESSION.
 * The previous `=== 'always-open' ? CRYPTO : US_EQUITY` ternary would
 * mis-classify any future non-equity, non-crypto profile (e.g. 'kr-equity')
 * as US equity without a type error.
 */
export function sessionSpecFor(profile: MarketProfileId): MarketSessionSpec {
    const sessionModel: SessionModel = getDescriptor(profile).sessionModel;
    switch (sessionModel) {
        case 'always-open':
            return CRYPTO_SESSION;
        case 'us-equity-et':
            return US_EQUITY_SESSION;
        default: {
            // Exhaustiveness guard: TypeScript narrows `sessionModel` to `never`
            // here if all SessionModel variants are handled above. If a new
            // variant is added to SessionModel without updating this switch,
            // the assignment below produces a compile error.
            const _exhaustive: never = sessionModel;
            console.error(
                `[sessionSpecFor] Unhandled SessionModel: ${String(_exhaustive)} — defaulting to US_EQUITY_SESSION`
            );
            return US_EQUITY_SESSION;
        }
    }
}
