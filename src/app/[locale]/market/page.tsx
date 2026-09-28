import type { Metadata } from 'next';
import { US_DASHBOARD_SCOPE } from '@/shared/config/dashboardScope';
import { enterLocale } from '@/shared/lib/enterLocale';
import { marketMetadata } from './marketMetadata';
import { MarketRouteBody } from './MarketRouteBody';

// 1h — ISR. 단일 페이지라 재생성 비용이 작아, 장중 섹터 신호 신선도를 위해 짧게 유지한다
// (종목 페이지는 6~24h로 길게 — 거긴 종목 수가 많고 클라 refetch가 신선도를 책임짐).
// literal required — importing a constant breaks Next's static analysis, see src/app/CLAUDE.md
export const revalidate = 3600;

const SCOPE = US_DASHBOARD_SCOPE;

interface LocaleParams {
    readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
    params,
}: LocaleParams): Promise<Metadata> {
    return marketMetadata(params, SCOPE);
}

export default async function MarketPage({ params }: LocaleParams) {
    const locale = enterLocale((await params).locale);
    return <MarketRouteBody scope={SCOPE} locale={locale} />;
}
