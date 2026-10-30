'use client';

/**
 * core가 AI의 손절·목표를 보정했을 때 보정된 청산 레벨·손익비와 사유를 보여주는 블록.
 */
import { useTranslations } from 'next-intl';
import type { ReconciledActionLevels } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { SURFACE_NESTED } from '@/shared/lib/surfaceStyles';
import { LABEL_KO } from '@/shared/lib/typographyStyles';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { MarkdownText } from '@/shared/ui/MarkdownText';

interface ReconciledLevelsBlockProps {
    /** 없거나 청산·손익비가 모두 비어 있으면 블록을 그리지 않는다. */
    reconciled: ReconciledActionLevels | undefined;
}

export function ReconciledLevelsBlock({
    reconciled,
}: ReconciledLevelsBlockProps) {
    const t = useTranslations('widgets.analysis');
    if (!reconciled) return null;
    const { exit, riskReward, reason } = reconciled;
    if (exit === '' && riskReward === '') return null;

    return (
        <section
            className={cn(SURFACE_NESTED, 'mt-1 flex flex-col gap-1 px-3 py-2')}
        >
            <header className="flex items-center">
                <span className={LABEL_KO}>{t('AnalysisPanel.b3df82')}</span>
                <InfoTooltip>
                    <div className="text-secondary-300">
                        <p>{t('AnalysisPanel.82e32f')}</p>
                        <p>{t('AnalysisPanel.db5809')}</p>
                        <MarkdownText>{reason}</MarkdownText>
                    </div>
                </InfoTooltip>
            </header>
            {exit !== '' && (
                <MarkdownText className="text-sm text-secondary-300">
                    {exit}
                </MarkdownText>
            )}
            {riskReward !== '' && (
                <MarkdownText className="text-xs text-secondary-500">
                    {riskReward}
                </MarkdownText>
            )}
        </section>
    );
}
