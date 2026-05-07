'use client';

import { useBars } from '@/components/symbol-page/hooks/useBars';
import { useFearGreed } from '@/components/fear-greed/hooks/useFearGreed';
import { DEFAULT_TIMEFRAME } from '@/domain/constants/market';
import { FearGreedHero } from '@/components/fear-greed/FearGreedHero';
import { FearGreedComparisonGauges } from '@/components/fear-greed/FearGreedComparisonGauges';
import { FearGreedGroupBar } from '@/components/fear-greed/FearGreedGroupBar';
import { FearGreedHistoricalChart } from '@/components/chart/FearGreedHistoricalChart';
import { SelfNormWarningBadge } from '@/components/fear-greed/SelfNormWarningBadge';
import {
    CONFIDENCE_NORMAL_LABEL,
    CONFIDENCE_LIMITED_LABEL,
} from '@/components/fear-greed/utils/labels';

interface FearGreedPageProps {
    symbol: string;
    fmpSymbol?: string;
    displayName: string;
}

export function FearGreedPage({
    symbol,
    fmpSymbol,
    displayName,
}: FearGreedPageProps) {
    const { bars, indicators } = useBars({
        symbol,
        timeframe: DEFAULT_TIMEFRAME,
        fmpSymbol,
    });
    const { snapshot, history } = useFearGreed({
        bars,
        buySellVolume: indicators.buySellVolume,
    });

    if (!snapshot) {
        return (
            <main className="text-secondary-400 p-6 text-sm">
                <h1 className="sr-only">
                    {displayName} ({symbol}) 공포·탐욕 지수와 단기 sentiment
                </h1>
                공포·탐욕 지수 산출에 필요한 데이터가 부족합니다.
            </main>
        );
    }

    return (
        <main className="flex flex-col gap-6 p-4 md:p-6">
            <h1 className="sr-only">
                {displayName} ({symbol}) 공포·탐욕 지수와 단기 sentiment
            </h1>
            <section className="flex flex-col gap-3">
                <FearGreedHero snapshot={snapshot} />
                <FearGreedComparisonGauges history={history} />
                <SelfNormWarningBadge warning={snapshot.warning} />
            </section>

            <section className="flex flex-col gap-3">
                {snapshot.groups.map(group => (
                    <FearGreedGroupBar key={group.name} group={group} />
                ))}
            </section>

            <section>
                <FearGreedHistoricalChart history={history} />
            </section>

            <footer className="text-secondary-500 text-xs">
                {`표본 ${snapshot.sampleSize} — ${
                    snapshot.confidence === 'normal'
                        ? CONFIDENCE_NORMAL_LABEL
                        : CONFIDENCE_LIMITED_LABEL
                }`}
            </footer>
        </main>
    );
}
