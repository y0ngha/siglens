import type { Metadata } from 'next';
import { getMarketFearGreedCryptoStatic } from '@/entities/market-fear-greed/api/marketFearGreedCryptoStaticCache';
import { enterLocale } from '@/shared/lib/enterLocale';
import { FearGreedRouteBody } from '../FearGreedRouteBody';
import {
    fearGreedMetadata,
    loadFearGreedSymbolLinks,
    loadFearGreedView,
    type FearGreedRouteSource,
} from '../fearGreedRoute';

// 1h — 미국·한국 라우트와 동일. `getMarketFearGreedCryptoStatic`이 이미 1h로 판독값을 캐싱하므로
// 이 값은 페이지 셸의 백그라운드 재생성 주기만 정한다(추가 staleness 없음).
// literal required — importing a constant breaks Next's static analysis, see src/app/CLAUDE.md
export const revalidate = 3600;

const SOURCE: FearGreedRouteSource = {
    market: 'crypto',
    load: getMarketFearGreedCryptoStatic,
    failureLog: '[FearGreedCryptoRoute] getMarketFearGreedCryptoStatic failed',
};

interface LocaleParams {
    readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
    params,
}: LocaleParams): Promise<Metadata> {
    return fearGreedMetadata(params, SOURCE);
}

export default async function FearGreedCryptoRoutePage({
    params,
}: LocaleParams) {
    const locale = enterLocale((await params).locale);
    const [view, symbolLinks] = await Promise.all([
        loadFearGreedView(SOURCE),
        loadFearGreedSymbolLinks(SOURCE.market, locale),
    ]);
    return (
        <FearGreedRouteBody
            market={SOURCE.market}
            view={view}
            locale={locale}
            symbolLinks={symbolLinks}
        />
    );
}
