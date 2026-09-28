import type { Metadata } from 'next';
import { KR_DASHBOARD_SCOPE } from '@/shared/config/dashboardScope';
import { enterLocale } from '@/shared/lib/enterLocale';
import { marketMetadata } from '../marketMetadata';
import { MarketRouteBody } from '../MarketRouteBody';

// 1h — 미국 라우트와 동일. 장중 섹터 신호 신선도를 위해 짧게 유지한다.
// literal required — importing a constant breaks Next's static analysis, see src/app/CLAUDE.md
export const revalidate = 3600;

const SCOPE = KR_DASHBOARD_SCOPE;

interface LocaleParams {
    readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
    params,
}: LocaleParams): Promise<Metadata> {
    return marketMetadata(params, SCOPE);
}

export default async function MarketKrPage({ params }: LocaleParams) {
    const locale = enterLocale((await params).locale);
    return <MarketRouteBody scope={SCOPE} locale={locale} />;
}
