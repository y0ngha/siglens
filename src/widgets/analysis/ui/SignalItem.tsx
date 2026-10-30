'use client';

/**
 * 보조지표 신호 한 줄 — 지표명, 추세·강도 배지, 설명, 가이드 링크.
 */
import { useTranslations } from 'next-intl';
import type { AnalysisSignal, AnalysisSignalType } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import { GuideHintLink } from '../GuideHintLink';
import { resolveStrengthDisplay } from '../utils/signalUtils';
import { TrendBadge } from './TrendBadge';

const SIGNAL_TYPE_LABEL: Record<AnalysisSignalType, string> = {
    skill: 'skill',
};

interface SignalItemProps {
    signal: AnalysisSignal;
    typeLabel?: string;
    /** 이 신호를 낸 지표 스킬의 가이드 경로. 없으면 링크를 그리지 않는다. */
    guidePath?: string | null;
}

export function SignalItem({ signal, typeLabel, guidePath }: SignalItemProps) {
    const tSection = useTranslations('widgets.analysis.sectionLabel');
    const tStrength = useTranslations('widgets.analysis.signalStrength');
    const strengthDisplay = resolveStrengthDisplay(signal.strength);
    const label = typeLabel ?? tSection(SIGNAL_TYPE_LABEL[signal.type]);

    return (
        <div className="flex flex-col gap-1.5 rounded bg-secondary-700/40 px-3 py-2">
            <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-secondary-300">
                    {label}
                </span>
                <div className="flex w-36 shrink-0 items-center justify-end gap-1">
                    <TrendBadge trend={signal.trend} />
                    {strengthDisplay !== null && (
                        <span
                            className={cn(
                                'rounded px-1.5 py-0.5 text-[10px] font-medium',
                                strengthDisplay.color
                            )}
                        >
                            {tStrength(strengthDisplay.labelKey)}
                        </span>
                    )}
                </div>
            </div>
            <MarkdownText className="text-xs text-secondary-400">
                {signal.description}
            </MarkdownText>
            {guidePath != null && (
                <GuideHintLink href={guidePath} name={label} />
            )}
        </div>
    );
}
