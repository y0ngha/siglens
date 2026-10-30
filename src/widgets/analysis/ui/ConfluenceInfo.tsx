'use client';

/**
 * 여러 근거가 한 가격대로 모인 키 레벨의 출처 목록 툴팁. 근거가 하나면 그리지 않는다.
 */
import type { ClusteredKeyLevel, KrxTickTable } from '@y0ngha/siglens-core';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { formatAnalysisPrice } from '@/shared/lib/analysisPriceFormat';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';

interface ConfluenceInfoProps {
    level: ClusteredKeyLevel;
    symbol: string;
    krxTickTable: KrxTickTable;
}

export function ConfluenceInfo({
    level,
    symbol,
    krxTickTable,
}: ConfluenceInfoProps) {
    const locale = useResolvedLocale();
    if (level.count < 2) return null;

    return (
        <InfoTooltip>
            <div className="flex flex-col gap-1">
                {level.sources.map(source => (
                    <div
                        key={`${source.price}-${source.reason}`}
                        className="flex items-baseline gap-2 whitespace-nowrap"
                    >
                        <span className="shrink-0 text-secondary-300">
                            {formatAnalysisPrice(source.price, symbol, locale, {
                                krxTickTable,
                            })}
                        </span>
                        <span className="text-secondary-400">
                            {source.reason}
                        </span>
                    </div>
                ))}
            </div>
        </InfoTooltip>
    );
}
