import type { Metadata } from 'next';
import { getMarketFearGreedStatic } from '@/entities/market-fear-greed/api/marketFearGreedStaticCache';
import { enterLocale } from '@/shared/lib/enterLocale';
import { FearGreedRouteBody } from './FearGreedRouteBody';
import {
    fearGreedMetadata,
    loadFearGreedView,
    type FearGreedRouteSource,
} from './fearGreedRoute';

// 1h — mirrors /market's single-page revalidate (see docs/architecture/ISR_REVALIDATE.md).
// getMarketFearGreedStatic itself already caches the reading at 1h, so this bounds the
// page shell's own background regen without adding extra staleness.
// literal required — importing a constant breaks Next's static analysis, see src/app/CLAUDE.md
export const revalidate = 3600;

const SOURCE: FearGreedRouteSource = {
    market: 'us',
    load: getMarketFearGreedStatic,
    failureLog: '[FearGreedRoute] getMarketFearGreedStatic failed',
};

interface LocaleParams {
    readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
    params,
}: LocaleParams): Promise<Metadata> {
    return fearGreedMetadata(params, SOURCE);
}

export default async function FearGreedRoutePage({ params }: LocaleParams) {
    const locale = enterLocale((await params).locale);
    const view = await loadFearGreedView(SOURCE);
    return (
        <FearGreedRouteBody
            market={SOURCE.market}
            view={view}
            locale={locale}
        />
    );
}
