import { FearGreedPage } from '@/components/fear-greed/FearGreedPage';
import { DEFAULT_TIMEFRAME, VALID_TICKER_RE } from '@/domain/constants/market';
import { buildDisplayName } from '@/domain/ticker';
import { getBarsAction } from '@/infrastructure/market/getBarsAction';
import { getAssetInfoCached } from '@/infrastructure/ticker/getAssetInfoCached';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/lib/queryConfig';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface Props {
    params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();
    const assetInfo = await getAssetInfoCached(ticker);
    const displayName = assetInfo
        ? buildDisplayName(assetInfo, ticker)
        : ticker;
    return {
        title: `${displayName} (${ticker}) 공포·탐욕 지수 | SigLens`,
        description: `${displayName} 종목의 단기 sentiment를 5단계 라벨과 0~100 점수로 측정합니다. 5-factor self-normalization 기반.`,
        alternates: { canonical: `/${ticker}/fear-greed` },
    };
}

export default async function SymbolFearGreedPage({ params }: Props) {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();

    if (!VALID_TICKER_RE.test(ticker)) {
        notFound();
    }

    const assetInfo = await getAssetInfoCached(ticker);
    if (!assetInfo) {
        notFound();
    }

    const queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: QUERY_STALE_TIME_MS } },
    });
    await queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.bars(ticker, DEFAULT_TIMEFRAME),
        queryFn: () =>
            getBarsAction(ticker, DEFAULT_TIMEFRAME, assetInfo.fmpSymbol),
    });

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <FearGreedPage symbol={ticker} fmpSymbol={assetInfo.fmpSymbol} />
        </HydrationBoundary>
    );
}
