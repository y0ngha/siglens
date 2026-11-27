'use client';

/**
 * 계획 상태 배지 — 마지막 종가가 AI 계획의 진입 구간 어디에 있는지(core `planState`).
 *
 * 매수·매도 권유가 아니라 **측정된 위치**를 말한다. 그래서 "진입하세요"가 아니라
 * "진입 구간 안"처럼 사실만 적는다. `planState`가 없으면(core가 붙이기 전에
 * 저장된 옛 결과, 종가가 없던 경로) 아무것도 그리지 않는다: 옛 행에서 이전 판정 배지를
 * 되살리지 않는다.
 *
 * 손절 기준이 가격대가 아니라 ATR 배수로 잡힌 경우(`stopBasis: 'atr'`)는 차트에 그 선에
 * 대응하는 가격대가 없다는 점을 한 줄로 알린다. `stoploss` 깊이가 없는 티어에서는
 * `stopBasis`가 null이라 이 줄이 나오지 않는다.
 */
import { useTranslations } from 'next-intl';
import type { NoSetupReason, PlanState } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';

interface PlanStateBadgeProps {
    planState: PlanState | undefined;
}

type PlanPositionKey = PlanState['position'];

// globals.css: 기본 ui-* 토큰은 그래픽용(3:1)이라 작은 글씨는 -text 변종을 쓴다.
const POSITION_COLOR: Record<PlanPositionKey, string> = {
    in_zone:
        'bg-chart-bullish/10 text-ui-success-text border border-chart-bullish/30',
    above_zone:
        'bg-ui-warning/10 text-ui-warning-text border border-ui-warning/30',
    below_zone:
        'bg-ui-warning/10 text-ui-warning-text border border-ui-warning/30',
    no_setup:
        'bg-secondary-700/40 text-secondary-300 border border-secondary-600',
};

export function PlanStateBadge({ planState }: PlanStateBadgeProps) {
    const t = useTranslations('widgets.analysis.planState');
    if (planState === undefined) return null;

    const positionLabels: Record<PlanPositionKey, string> = {
        in_zone: t('inZone'),
        above_zone: t('aboveZone'),
        below_zone: t('belowZone'),
        no_setup: t('noSetup'),
    };
    const reasonLabels: Record<NoSetupReason, string> = {
        no_zone: t('reasonNoZone'),
        no_stop: t('reasonNoStop'),
        stopped: t('reasonStopped'),
        no_room_above: t('reasonNoRoomAbove'),
    };
    const reason =
        planState.position === 'no_setup'
            ? reasonLabels[planState.reason]
            : null;

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <span className="text-xs text-secondary-500">{t('label')}</span>
                <span
                    className={cn(
                        'rounded px-2 py-0.5 text-xs font-semibold',
                        POSITION_COLOR[planState.position]
                    )}
                >
                    {positionLabels[planState.position]}
                </span>
            </div>
            {reason !== null && (
                <p className="text-xs text-secondary-400">{reason}</p>
            )}
            {planState.stopBasis === 'atr' && (
                <p className="text-xs text-secondary-400">{t('stopAtr')}</p>
            )}
        </div>
    );
}
