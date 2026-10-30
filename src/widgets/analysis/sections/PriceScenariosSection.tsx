'use client';

/**
 * 가격 시나리오 섹션 — 상승·하락 시나리오 2열. 양쪽 모두 목표가가 없으면 그리지 않는다.
 */
import { useTranslations } from 'next-intl';
import type { KrxTickTable, PriceTargets } from '@y0ngha/siglens-core';
import { LABEL_KO } from '@/shared/lib/typographyStyles';
import { PriceScenarioColumn } from '../ui/PriceScenarioColumn';

interface PriceScenariosSectionProps {
    /** 부분 응답에서 누락될 수 있다. */
    priceTargets: PriceTargets | undefined;
    symbol: string;
    krxTickTable: KrxTickTable;
}

export function PriceScenariosSection({
    priceTargets,
    symbol,
    krxTickTable,
}: PriceScenariosSectionProps) {
    const t = useTranslations('widgets.analysis');
    const bullish = priceTargets?.bullish ?? null;
    const bearish = priceTargets?.bearish ?? null;
    if (
        (bullish?.targets.length ?? 0) === 0 &&
        (bearish?.targets.length ?? 0) === 0
    )
        return null;

    return (
        <div className="flex flex-col gap-2">
            <span className={LABEL_KO}>{t('AnalysisPanel.31f83c')}</span>
            <div className="grid grid-cols-2 gap-3">
                <PriceScenarioColumn
                    label={t('AnalysisPanel.3dc47b')}
                    scenario={bullish}
                    colorClass="text-ui-success-text"
                    symbol={symbol}
                    krxTickTable={krxTickTable}
                />
                <PriceScenarioColumn
                    label={t('AnalysisPanel.79282c')}
                    scenario={bearish}
                    colorClass="text-ui-danger-text"
                    symbol={symbol}
                    krxTickTable={krxTickTable}
                />
            </div>
        </div>
    );
}
