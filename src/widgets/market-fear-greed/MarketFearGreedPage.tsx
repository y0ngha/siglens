import { useTranslations } from 'next-intl';
import type { MarketFearGreedView } from '@/entities/market-fear-greed';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { FearGreedGauge } from '@/widgets/fear-greed';
import { confidenceLabelKey } from '@/shared/lib/fearGreedLabels';
import type { FearGreedMarketId } from '@/shared/lib/marketFearGreedLabels';
import { MarketFearGreedComparison } from './MarketFearGreedComparison';
import { MarketFearGreedFactorBar } from './MarketFearGreedFactorBar';

interface MarketFearGreedPageProps {
    view: MarketFearGreedView;
    /** 어느 시장의 지수인가. 요인 라벨·설명과 면책 문구가 시장마다 다르다. */
    market: FearGreedMarketId;
}

/** `asOf` is an ISO `YYYY-MM-DD` calendar date → `YYYY년 M월 D일 종가 기준`. */
function formatAsOf(
    asOf: string,
    t: (key: string, values?: Record<string, string | number>) => string
): string {
    const [year, month, day] = asOf.split('-').map(Number);
    return t('asOfClose', { v0: year!, v1: month!, v2: day! });
}

// This index is intentionally narrower than CNN's: 5 daily-close-derivable
// factors instead of 7 (put/call ratio and NYSE 52-week high/low breadth have
// no data source available here), and it is computed independently from daily
// closing prices rather than replicating CNN's pipeline. The disclosure below
// exists so readers don't expect the number to match CNN's exactly.
/** 시장별 면책 문구 키 — 문구는 `widgets.market-fear-greed.page`에 있다. */
const CNN_DIFFERENCE_KEY: Record<FearGreedMarketId, string> = {
    us: 'cnnDifference',
    kr: 'krDifference',
};

/**
 * Market-wide Fear & Greed page. Server component — the snapshot is precomputed
 * server-side (no bars fetch, no client-side score recompute), so there is no
 * hydration-timing hazard here unlike the per-stock `FearGreedPage`.
 */
export function MarketFearGreedPage({
    view,
    market,
}: MarketFearGreedPageProps) {
    const t = useTranslations('widgets.market-fear-greed');
    const tPage = useTranslations('widgets.market-fear-greed.page');
    const tFearGreed = useTranslations('shared.lib.fearGreed');
    const { snapshot, comparisons } = view;

    if (!snapshot) {
        return (
            <div className="flex flex-col gap-2 py-6 text-sm text-secondary-400">
                <p>{t('MarketFearGreedPage.1d7b3e')}</p>
                <p className="text-xs text-secondary-500">
                    {t('MarketFearGreedPage.e446f9')}
                </p>
            </div>
        );
    }

    return (
        // 가로 여백은 라우트가 소유한다 — 이 위젯은 세로 리듬만 책임진다.
        // (여기서 좌우 padding을 또 주면 페이지 프로즈와 들여쓰기가 어긋난다.)
        <div className="flex flex-col gap-6 py-6">
            <section className="flex flex-col items-center gap-2">
                <FearGreedGauge
                    score={Math.round(snapshot.score)}
                    label={snapshot.label}
                    size="hero"
                    confidence={snapshot.confidence}
                />
                <p className="text-xs text-secondary-500">
                    {formatAsOf(snapshot.asOf, tPage)}
                </p>
            </section>

            <section className="flex flex-col gap-3">
                <h2 className={HEADING_SECTION}>
                    {t('MarketFearGreedPage.41205a')}
                </h2>
                <MarketFearGreedComparison comparisons={comparisons} />
            </section>

            <section className="flex flex-col gap-3">
                <h2 className={HEADING_SECTION}>
                    {t('MarketFearGreedPage.c099fa')}
                </h2>
                {snapshot.factors.map(factor => (
                    <MarketFearGreedFactorBar
                        key={factor.key}
                        factor={factor}
                        market={market}
                    />
                ))}
            </section>

            <footer className="flex flex-col gap-1 text-xs text-secondary-500">
                <p>{tPage(CNN_DIFFERENCE_KEY[market])}</p>
                <p>
                    {tFearGreed('confidenceFooter', {
                        v0: snapshot.sampleSize,
                        v1: tFearGreed(confidenceLabelKey(snapshot.confidence)),
                    })}
                </p>
            </footer>
        </div>
    );
}
