import type { Metadata } from 'next';
import { getMarketFearGreedStatic } from '@/entities/market-fear-greed/api/marketFearGreedStaticCache';
import { enterLocale } from '@/shared/lib/enterLocale';
import { FearGreedRouteBody } from './FearGreedRouteBody';
import {
    fearGreedMetadata,
    loadFearGreedSymbolLinks,
    loadFearGreedView,
    type FearGreedRouteSource,
} from './fearGreedRoute';

// 1h — `/market`과 같은 단일 페이지 주기. `getMarketFearGreedStatic`이 이미 1h로 판독값을
// 캐싱하므로 이 값은 페이지 셸의 백그라운드 재생성 주기만 정한다(추가 staleness 없음).
// 리터럴 강제 — 상수를 import하면 Next의 정적 분석이 깨진다(src/app/CLAUDE.md#AP-1).
export const revalidate = 3600;

const SOURCE: FearGreedRouteSource = {
    market: 'us',
    load: getMarketFearGreedStatic,
    failureLog: '[FearGreedRoute] getMarketFearGreedStatic failed',
};

interface LocaleParams {
    readonly params: Promise<{ locale: string }>;
}

/** 미국 공포·탐욕 허브 메타데이터 — 판독값이 없으면 noindex(`fearGreedMetadata`). */
export async function generateMetadata({
    params,
}: LocaleParams): Promise<Metadata> {
    return fearGreedMetadata(params, SOURCE);
}

/** 미국 공포·탐욕 허브 — 판독값과 종목 링크 목록은 서로 독립이라 병렬로 읽고 공유 본문에 넘긴다. */
export default async function FearGreedRoutePage({ params }: LocaleParams) {
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
