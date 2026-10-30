import type { Metadata } from 'next';
import { US_DASHBOARD_SCOPE } from '@/shared/config/dashboardScope';
import { enterLocale } from '@/shared/lib/enterLocale';
import { marketMetadata } from './marketMetadata';
import { MarketRouteBody } from './MarketRouteBody';

// 1h — ISR. 단일 페이지라 재생성 비용이 작아, 장중 섹터 신호 신선도를 위해 짧게 유지한다
// (종목 페이지는 6~24h로 길게 — 거긴 종목 수가 많고 클라 refetch가 신선도를 책임짐).
// 리터럴 강제 — 상수를 import하면 Next의 정적 분석이 깨진다(src/app/CLAUDE.md#AP-1).
export const revalidate = 3600;

const SCOPE = US_DASHBOARD_SCOPE;

interface LocaleParams {
    readonly params: Promise<{ locale: string }>;
}

/** 미국 시장 허브 메타데이터 — 두 로더가 모두 비면 noindex(`marketMetadata`). */
export async function generateMetadata({
    params,
}: LocaleParams): Promise<Metadata> {
    return marketMetadata(params, SCOPE);
}

/** 미국 시장 허브 — scope만 정하고 본문·구조화데이터는 공유 본문(`MarketRouteBody`)이 그린다. */
export default async function MarketPage({ params }: LocaleParams) {
    const locale = enterLocale((await params).locale);
    return <MarketRouteBody scope={SCOPE} locale={locale} />;
}
