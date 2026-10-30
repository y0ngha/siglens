/**
 * 애널리스트 등급 분포 막대와 범례.
 */
import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';
import type { FundamentalGradesConsensusInput } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import {
    GRADE_BAND_KEYS,
    totalGrades,
    type GradeBandKey,
} from '@/widgets/fundamental/utils/gradeBands';
import { sharePercent } from '@/widgets/fundamental/utils/moneyFormat';

interface GradesBarProps {
    grades: FundamentalGradesConsensusInput;
}

interface BandView {
    /** 막대 조각과 범례 색칩이 공유하는 배경 클래스. */
    className: string;
    /** 막대 조각 `title`(건수 포함). */
    title: (count: number) => string;
    legendLabel: string;
}

/**
 * 강/약 밴드는 **같은 색조에 알파만 다르다**(강력매수=불투명, 매수=`/85`).
 *
 * `/85`는 카드 표면·양 테마에서 그래픽 대비 3:1을 지키면서 불투명 밴드와 구분되는 알파다 — 더
 * 낮추면 밴드와 범례 색칩(같은 값)이 3:1 아래로 내려가 색↔라벨 매핑이 흐려진다.
 *
 * 건수가 전부 0이면 그릴 것이 없다(호출부가 `hasGrades`로 걸러 낸다).
 */
export function GradesBar({ grades }: GradesBarProps) {
    const t = useTranslations('widgets.fundamental');
    const tRating = useTranslations('widgets.fundamental.analystRating');
    const total = totalGrades(grades);
    if (total === 0) return null;

    const bands: Record<GradeBandKey, BandView> = {
        strongBuy: {
            className: 'bg-ui-success',
            title: v0 => tRating('strongBuy', { v0 }),
            legendLabel: t('FutureDirectionCard.cb528c'),
        },
        buy: {
            className: 'bg-ui-success/85',
            title: v0 => t('analystBuyCount', { v0 }),
            legendLabel: t('FutureDirectionCard.31e4d3'),
        },
        hold: {
            className: 'bg-ui-warning',
            title: v0 => tRating('hold', { v0 }),
            legendLabel: t('FutureDirectionCard.6640f0'),
        },
        sell: {
            className: 'bg-ui-danger/85',
            title: v0 => t('analystSellCount', { v0 }),
            legendLabel: t('FutureDirectionCard.62a65c'),
        },
        strongSell: {
            className: 'bg-ui-danger',
            title: v0 => tRating('strongSell', { v0 }),
            legendLabel: t('FutureDirectionCard.00129a'),
        },
    };

    return (
        <div className="mt-3">
            <div className="flex overflow-hidden rounded-lg" aria-hidden="true">
                {GRADE_BAND_KEYS.filter(key => grades[key] > 0).map(key => (
                    <div
                        key={key}
                        title={bands[key].title(grades[key])}
                        className={cn('h-3 w-(--bar-w)', bands[key].className)}
                        style={
                            {
                                '--bar-w': `${sharePercent(grades[key], total)}%`,
                            } as CSSProperties
                        }
                    />
                ))}
            </div>
            <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {GRADE_BAND_KEYS.map(key => (
                    <div key={key} className="flex items-center gap-1">
                        <span
                            className={cn(
                                'block h-2 w-2 rounded',
                                bands[key].className
                            )}
                            aria-hidden="true"
                        />
                        <dt className="text-secondary-400">
                            {bands[key].legendLabel}
                        </dt>
                        <dd className="font-mono font-medium">{grades[key]}</dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}
