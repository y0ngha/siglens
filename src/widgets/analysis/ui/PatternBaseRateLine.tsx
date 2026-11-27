'use client';

/**
 * 패턴 카드의 실측 base rate 줄 — 이 모양 뒤 목표가가 무효화보다 먼저 닿은 비율을
 * 같은 거리의 다른 날 가격과 나란히 보여 준다.
 *
 * 문헌에서 온 신뢰도 배지를 대신한다. 숫자는 core가 카드에 붙인 측정값 그대로이고,
 * 예측이나 권유가 아니라 "그 비율이었다"는 사실만 적는다. 측정은 일봉 기준이라 다른
 * 시간 단위(`rate`가 `null`)는 측정 안 됨으로 적는다. 표본이 적어 전체 패턴 행으로
 * 대신한 카드(`isPooledBaseRate`, `key === 'pooled'`)는 그 사실을 한 줄 더 밝힌다.
 * 마지막 줄은 판정을 평이하게 말한다: 위약을 못 이기면(`no_edge`, `insufficient_sample`)
 * 측정된 우위가 없다고, 이기면(`beats_placebo`) 이겼지만 약속은 아니라고 적는다.
 */
import { useTranslations } from 'next-intl';
import type { MeasuredBaseRate } from '@y0ngha/siglens-core';
import {
    baseRateScopeYears,
    formatShareAsPercent,
    isPooledBaseRate,
} from '@/shared/lib/patternBaseRate';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';

interface PatternBaseRateLineProps {
    rate: MeasuredBaseRate | null;
}

export function PatternBaseRateLine({ rate }: PatternBaseRateLineProps) {
    const t = useTranslations('widgets.analysis.baseRate');

    if (rate === null) {
        return (
            <p className="text-xs text-secondary-500">
                {t('patternNotMeasured')}
            </p>
        );
    }

    const { from, to } = baseRateScopeYears(rate);
    // 판정이 아니라 키로 가른다: 숫자가 실제 합산값일 때만 "전체 패턴 기준"이 참이다
    // (에이전트, 기록표와 같은 규칙, `isPooledBaseRate`).
    const isPooled = isPooledBaseRate(rate);

    return (
        <div className="flex flex-col gap-0.5">
            <div className="flex items-center">
                <p className="text-xs text-secondary-400">
                    {t('patternLine', {
                        event: formatShareAsPercent(rate.eventShare),
                        placebo: formatShareAsPercent(rate.placeboShare),
                        n: rate.n,
                    })}
                </p>
                <InfoTooltip>
                    <p>
                        {t('patternTooltip', {
                            symbols: rate.scope.symbols,
                            from,
                            to,
                        })}
                    </p>
                </InfoTooltip>
            </div>
            {isPooled && (
                <p className="text-xs text-secondary-500">{t('pooledNote')}</p>
            )}
            <p className="text-xs text-secondary-500">
                {rate.verdict === 'beats_placebo'
                    ? t('verdictBeats')
                    : t('verdictNoEdge')}
            </p>
        </div>
    );
}
