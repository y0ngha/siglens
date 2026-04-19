import type { Metadata } from 'next';
import { Suspense } from 'react';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import { MarketSummaryPanel } from '@/components/dashboard/MarketSummaryPanel';
import { MarketSummaryPanelSkeleton } from '@/components/dashboard/MarketSummaryPanelSkeleton';
import { SectorSignalPanelContainer } from '@/components/dashboard/SectorSignalPanelContainer';
import { SectorSignalPanelSkeleton } from '@/components/dashboard/SectorSignalPanelSkeleton';
import { SignalTypeGuide } from '@/components/dashboard/SignalTypeGuide';
import { getMarketSummaryAction } from '@/infrastructure/dashboard/getMarketSummaryAction';
import { QUERY_KEYS } from '@/lib/queryConfig';
import { ROOT_KEYWORDS, SITE_NAME, SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
    title: `섹터별 미국 주식 신호 탐색 — 골든크로스·RSI 다이버전스 스캔 | ${SITE_NAME}`,
    description:
        '11개 섹터별 선도 종목의 기술적 신호를 한눈에. 골든크로스·데드크로스·RSI 다이버전스·볼린저 스퀴즈를 AI 없이 실시간 포착. 무료.',
    keywords: [
        ...ROOT_KEYWORDS,
        '섹터 신호',
        '골든크로스 스캐너',
        'RSI 다이버전스',
        '볼린저 스퀴즈',
    ],
    alternates: { canonical: `${SITE_URL}/market` },
    openGraph: {
        title: `섹터별 미국 주식 신호 탐색 | ${SITE_NAME}`,
        description:
            '11개 섹터별 선도 종목의 기술적 신호를 스캔. AI 없이 실시간, 무료.',
        url: `${SITE_URL}/market`,
        siteName: SITE_NAME,
        locale: 'ko_KR',
        type: 'website',
    },
};

interface SearchParams {
    sector?: string;
    strict?: string;
}

export default async function MarketPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const params = await searchParams;
    const hasQueryVariant =
        params.sector !== undefined || params.strict !== undefined;
    const initialStrict = params.strict !== '0';

    const queryClient = new QueryClient();
    await queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.marketSummary(),
        queryFn: getMarketSummaryAction,
    });

    return (
        <>
            {hasQueryVariant && (
                <meta name="robots" content="noindex, follow" />
            )}
            <h1 className="sr-only">미국 주식 기술적 신호 대시보드</h1>
            <HydrationBoundary state={dehydrate(queryClient)}>
                <Suspense fallback={<MarketSummaryPanelSkeleton />}>
                    <MarketSummaryPanel />
                </Suspense>
            </HydrationBoundary>
            <Suspense fallback={<SectorSignalPanelSkeleton />}>
                <SectorSignalPanelContainer
                    initialSector={params.sector}
                    initialStrict={initialStrict}
                />
            </Suspense>
            <SignalTypeGuide />
        </>
    );
}
