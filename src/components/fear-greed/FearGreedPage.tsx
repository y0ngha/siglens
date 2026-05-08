'use client';

import { useMemo } from 'react';
import { useFearGreedFromSymbol } from '@/components/fear-greed/hooks/useFearGreedFromSymbol';
import { FearGreedHero } from '@/components/fear-greed/FearGreedHero';
import { FearGreedComparisonGauges } from '@/components/fear-greed/FearGreedComparisonGauges';
import { FearGreedGroupBar } from '@/components/fear-greed/FearGreedGroupBar';
import { FearGreedHistoricalChart } from '@/components/chart/FearGreedHistoricalChart';
import { SelfNormWarningBadge } from '@/components/fear-greed/SelfNormWarningBadge';
import { formatConfidenceFooter } from '@/lib/fearGreedLabels';
import { usePublishSymbolChat } from '@/components/chat/hooks/useSymbolChat';

interface FearGreedPageProps {
    symbol: string;
    fmpSymbol?: string;
}

export function FearGreedPage({ symbol, fmpSymbol }: FearGreedPageProps) {
    const { snapshot, history } = useFearGreedFromSymbol({ symbol, fmpSymbol });

    const chatState = useMemo(
        () => ({
            context: null as null,
            timeframe: null,
            isAnalysisReady: snapshot !== null,
        }),
        [snapshot]
    );
    usePublishSymbolChat(chatState);

    if (!snapshot) {
        return (
            <div className="text-secondary-400 flex flex-col gap-2 p-6 text-sm">
                <p>공포 탐욕 지수 산출에 필요한 데이터가 부족합니다.</p>
                <p className="text-secondary-500 text-xs">
                    상장한 지 얼마 되지 않았거나 거래량 데이터가 비어 있는
                    종목일 수 있습니다. 며칠 뒤 다시 확인하거나, 같은 섹터의
                    다른 종목을 살펴보세요.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:p-6">
            <div className="grid gap-6 md:grid-cols-2">
                <section className="flex flex-col gap-3">
                    <h2 className="sr-only">
                        현재 공포 탐욕 지수와 기간별 비교
                    </h2>
                    <FearGreedHero snapshot={snapshot} />
                    <FearGreedComparisonGauges history={history} />
                    <SelfNormWarningBadge warning={snapshot.warning} />
                </section>

                <section className="flex flex-col gap-3">
                    <h2 className="sr-only">
                        Flow와 Trend 그룹별 score breakdown
                    </h2>
                    {snapshot.groups.map(group => (
                        <FearGreedGroupBar key={group.name} group={group} />
                    ))}
                </section>
            </div>

            <section className="flex flex-col gap-2">
                <h2 className="text-secondary-300 text-sm font-medium">
                    공포 탐욕 지수 추이 (최근 1년)
                </h2>
                <FearGreedHistoricalChart history={history} />
            </section>

            <footer className="text-secondary-500 text-xs">
                {formatConfidenceFooter(
                    snapshot.sampleSize,
                    snapshot.confidence
                )}
            </footer>
        </div>
    );
}
