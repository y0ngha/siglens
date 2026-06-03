import type { FundamentalProfile } from '@y0ngha/siglens-core';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';
import { isE2E } from '@/shared/api/e2eEnv';
import { getProfile } from './fundamentalData';

export interface ResilientProfile {
    /**
     * FMP company profile, or null when the ticker genuinely has no profile
     * (FMP 200 + empty → non-existent ticker → caller `notFound()`).
     */
    profile: FundamentalProfile | null;
    /**
     * true = FMP infra failure (`getProfile` threw, NOT a null result). The
     * fundamental page body needs the profile to render, so on infra failure the
     * caller renders a degraded notice (a 200, not a 500) and `generateMetadata`
     * responds noindex — mirroring `getAssetInfoResilient`'s degrade policy. The
     * next revalidate/on-demand invalidation recovers automatically once FMP is
     * back. A degraded-200(noindex) beats both a hard 500 and a transient 404.
     */
    degraded: boolean;
}

/**
 * Graceful wrapper around the ISR-static `getProfile` fetch. `getProfile` ends
 * three ways: a profile (render), `null` (non-existent → notFound), or a throw
 * (FMP infra failure / DSU control-flow).
 *
 * The cache call is byte-identical to the one `ProfileSection` issues
 * (`['fundamental:profile', upper]`), so both share one `unstable_cache` entry
 * (and `getProfile`'s React `cache()` dedups within a request) — wrapping it
 * here adds no extra FMP round-trip.
 */
export async function getProfileResilient(
    upper: string
): Promise<ResilientProfile> {
    try {
        const profile = await staticSymbolCache(
            ['fundamental:profile', upper],
            upper,
            () => getProfile(upper)
        );
        return { profile, degraded: false };
    } catch (e) {
        // Next's static/ISR control-flow error must propagate untouched.
        if (isDynamicServerError(e)) throw e;
        // 프로덕션에선 로깅하되, FMP 키가 없는 E2E에선 이 degrade가 정상이라 침묵시킨다
        // (E2E_TEST는 prod에 없으므로 prod 로깅은 그대로). getAssetInfoResilient와 동일 정책.
        if (!isE2E()) {
            console.error(
                '[getProfileResilient] FMP profile infra failure, degrading:',
                e
            );
        }
        return { profile: null, degraded: true };
    }
}
