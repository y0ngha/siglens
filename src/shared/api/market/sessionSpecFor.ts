import {
    US_EQUITY_SESSION,
    CRYPTO_SESSION,
    type MarketSessionSpec,
} from '@y0ngha/siglens-core';
import {
    getDescriptor,
    type MarketProfileId,
} from '@/shared/config/marketProfile';

/** Map a market profile to the core MarketSessionSpec (replaces Plan 2's interim flag). */
export function sessionSpecFor(profile: MarketProfileId): MarketSessionSpec {
    return getDescriptor(profile).sessionModel === 'always-open'
        ? CRYPTO_SESSION
        : US_EQUITY_SESSION;
}
