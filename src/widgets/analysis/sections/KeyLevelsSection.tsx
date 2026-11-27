'use client';

import {
    PRICE_LEVEL_BASE_RATE,
    type ClusteredKeyLevel,
    type ClusteredKeyLevels,
    type KrxTickTable,
    type Timeframe,
} from '@y0ngha/siglens-core';
/**
 * 주요 레벨 섹션 — 저항·지지 2열과 PoC. 세 값이 모두 없으면 그리지 않는다.
 *
 * 제목 옆 설명은 "여러 근거가 모였다"는 사실과, 가격대에 닿은 뒤 지켜진 실측 비율을 함께
 * 적는다. 근거가 많이 모였다고 더 잘 지켜진다는 말은 하지 않는다 — 측정에서 같은 거리의
 * 임의 가격과 차이가 없었다. 측정은 일봉 기준이라 다른 시간 단위는 측정 안 됨으로 적는다.
 *
 * 잠긴 티어는 core `filterAnalysisResult`가 `partial_detail` 깊이에서 keyLevels를
 * 비워 보내므로, 이 섹션은 별도 잠금 게이트 없이 빈 입력으로 숨겨진다.
 */
import { useTranslations } from 'next-intl';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { formatAnalysisPrice } from '@/shared/lib/analysisPriceFormat';
import { cn } from '@/shared/lib/cn';
import {
    baseRateScopeYears,
    formatShareAsPercent,
} from '@/shared/lib/patternBaseRate';
import { LABEL_KO } from '@/shared/lib/typographyStyles';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { ConfluenceInfo } from '../ui/ConfluenceInfo';

interface KeyLevelColumnProps {
    /** 키 접두어 겸 구분 — 같은 가격이 양쪽에 있어도 React key가 겹치지 않게. */
    kind: 'resistance' | 'support';
    label: string;
    levels: ClusteredKeyLevel[];
    priceClass: string;
    symbol: string;
    krxTickTable: KrxTickTable;
}

function KeyLevelColumn({
    kind,
    label,
    levels,
    priceClass,
    symbol,
    krxTickTable,
}: KeyLevelColumnProps) {
    const locale = useResolvedLocale();
    if (levels.length === 0) return null;
    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs text-secondary-500">{label}</span>
            {levels.map(level => (
                <div key={`${kind}-${level.price}`} className="flex flex-col">
                    <span className={cn('text-sm font-medium', priceClass)}>
                        {formatAnalysisPrice(level.price, symbol, locale, {
                            krxTickTable,
                        })}
                    </span>
                    <span className="inline-flex items-center text-xs text-secondary-500">
                        {level.reason}
                        <ConfluenceInfo
                            level={level}
                            symbol={symbol}
                            krxTickTable={krxTickTable}
                        />
                    </span>
                </div>
            ))}
        </div>
    );
}

interface KeyLevelsSectionProps {
    keyLevels: ClusteredKeyLevels;
    symbol: string;
    krxTickTable: KrxTickTable;
    /** 실측 base rate는 일봉만 있다 — 다른 시간 단위는 측정 안 됨으로 적는다. */
    timeframe: Timeframe;
}

export function KeyLevelsSection({
    keyLevels,
    symbol,
    krxTickTable,
    timeframe,
}: KeyLevelsSectionProps) {
    const t = useTranslations('widgets.analysis');
    const tBaseRate = useTranslations('widgets.analysis.baseRate');
    const locale = useResolvedLocale();
    // keyLevels는 analysis 정규화 밖의 값이라 부분 객체일 수 있다 — 경계에서 기본값을 채운다.
    const supportLevels = keyLevels.support ?? [];
    const resistanceLevels = keyLevels.resistance ?? [];
    const { poc } = keyLevels;

    if (
        supportLevels.length === 0 &&
        resistanceLevels.length === 0 &&
        poc === undefined
    )
        return null;

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center">
                <span className={LABEL_KO}>{t('AnalysisPanel.5ec98c')}</span>
                <InfoTooltip>
                    <div className="text-secondary-300">
                        <p>{t('AnalysisPanel.b321c3')}</p>
                        <p>
                            {timeframe === PRICE_LEVEL_BASE_RATE.scope.timeframe
                                ? tBaseRate('levelLine', {
                                      held: formatShareAsPercent(
                                          PRICE_LEVEL_BASE_RATE.eventShare
                                      ),
                                      placebo: formatShareAsPercent(
                                          PRICE_LEVEL_BASE_RATE.placeboShare
                                      ),
                                      symbols:
                                          PRICE_LEVEL_BASE_RATE.scope.symbols,
                                      n: PRICE_LEVEL_BASE_RATE.n,
                                      ...baseRateScopeYears(
                                          PRICE_LEVEL_BASE_RATE
                                      ),
                                  })
                                : tBaseRate('levelNotMeasured')}
                        </p>
                    </div>
                </InfoTooltip>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <KeyLevelColumn
                    kind="resistance"
                    label={t('AnalysisPanel.d930e0')}
                    levels={resistanceLevels}
                    priceClass="text-ui-danger-text"
                    symbol={symbol}
                    krxTickTable={krxTickTable}
                />
                <KeyLevelColumn
                    kind="support"
                    label={t('AnalysisPanel.8da27a')}
                    levels={supportLevels}
                    priceClass="text-ui-success-text"
                    symbol={symbol}
                    krxTickTable={krxTickTable}
                />
            </div>
            {poc !== undefined && (
                <div className="flex flex-col">
                    <span className="text-xs text-secondary-500">PoC</span>
                    <span className="text-sm font-medium">
                        {formatAnalysisPrice(poc.price, symbol, locale, {
                            krxTickTable,
                        })}
                    </span>
                    <span className="text-xs text-secondary-500">
                        {poc.reason}
                    </span>
                </div>
            )}
        </div>
    );
}
