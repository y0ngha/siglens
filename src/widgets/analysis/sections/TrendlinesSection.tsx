'use client';

/**
 * 추세선 섹션 — 추세선이 없으면 그리지 않는다.
 */
import { useTranslations } from 'next-intl';
import type { KrxTickTable, Trendline } from '@y0ngha/siglens-core';
import { LABEL_KO } from '@/shared/lib/typographyStyles';
import { TrendlineItem } from '../ui/TrendlineItem';

interface TrendlinesSectionProps {
    trendlines: Trendline[];
    symbol: string;
    krxTickTable: KrxTickTable;
}

export function TrendlinesSection({
    trendlines,
    symbol,
    krxTickTable,
}: TrendlinesSectionProps) {
    const t = useTranslations('widgets.analysis');
    if (trendlines.length === 0) return null;
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <span className={LABEL_KO}>{t('AnalysisPanel.0b5eb6')}</span>
            </div>
            <div className="flex flex-col gap-1.5">
                {trendlines.map(trendline => (
                    <TrendlineItem
                        key={`trendline-${trendline.direction}-${trendline.start.time}-${trendline.end.time}`}
                        trendline={trendline}
                        symbol={symbol}
                        krxTickTable={krxTickTable}
                    />
                ))}
            </div>
        </div>
    );
}
