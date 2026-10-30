import type { Metadata } from 'next';
import { KR_DASHBOARD_SCOPE } from '@/shared/config/dashboardScope';
import { enterLocale } from '@/shared/lib/enterLocale';
import { marketMetadata } from '../marketMetadata';
import { MarketRouteBody } from '../MarketRouteBody';

// 1h — 미국 라우트와 동일. 장중 섹터 신호 신선도를 위해 짧게 유지한다.
// 리터럴 강제 — 상수를 import하면 Next의 정적 분석이 깨진다(src/app/CLAUDE.md#AP-1).
export const revalidate = 3600;

const SCOPE = KR_DASHBOARD_SCOPE;

interface LocaleParams {
    readonly params: Promise<{ locale: string }>;
}

/** 한국 시장 허브 메타데이터 — 두 로더가 모두 비면 noindex(`marketMetadata`). */
export async function generateMetadata({
    params,
}: LocaleParams): Promise<Metadata> {
    return marketMetadata(params, SCOPE);
}

/** 한국 시장 허브 — scope만 정하고 본문·구조화데이터는 공유 본문(`MarketRouteBody`)이 그린다. */
export default async function MarketKrPage({ params }: LocaleParams) {
    const locale = enterLocale((await params).locale);
    return <MarketRouteBody scope={SCOPE} locale={locale} />;
}
