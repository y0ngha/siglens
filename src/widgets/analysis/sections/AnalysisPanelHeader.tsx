'use client';

/**
 * 패널 머리 — 제목·진행 점·추세 배지(왼쪽)와 개인화 배지·분석 시각·리포트 복사·리스크
 * 등급(오른쪽), 복사 실패 안내.
 */
import { useTranslations } from 'next-intl';
import type { RiskLevel, Trend } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { formatAnalyzedAt } from '@/shared/lib/formatAnalyzedAt';
import { LABEL_GROUP } from '@/shared/lib/typographyStyles';
import type { CopyReportState } from '../model/types';
import { CopyReportButton } from '../ui/CopyReportButton';
import { PersonalizedAnalysisBadge } from '../ui/PersonalizedAnalysisBadge';
import { TrendBadge } from '../ui/TrendBadge';

const RISK_LEVEL_COLOR: Record<RiskLevel, string> = {
    low: 'text-ui-success-text',
    medium: 'text-ui-warning-text',
    high: 'text-ui-danger-text',
};

/** RiskLevel → `shared.enumLabel.riskLevel` 카탈로그 키. */
const RISK_LEVEL_KEY: Record<RiskLevel, string> = {
    low: 'riskLevel.low',
    medium: 'riskLevel.medium',
    high: 'riskLevel.high',
};

interface AnalysisPanelHeaderProps {
    trend: Trend;
    riskLevel: RiskLevel;
    analyzedAt: string | undefined;
    isAnalyzing: boolean;
    /**
     * 추세 배지를 숨긴다. 폴백 placeholder의 trend는 정규화가 채운 fabricated
     * 'neutral'이라 가짜 신호를 노출하지 않는다. (free 사용자의 진짜 trend는
     * core가 허용하는 값이라 그대로 보인다.)
     */
    hideTrend: boolean;
    showPersonalizedBadge: boolean;
    /** false면 복사 버튼을 그리지 않는다(상세 잠금). */
    showCopyButton: boolean;
    copyState: CopyReportState;
    /** 분석 진행 중(마무리 애니메이션 포함) — 복사 버튼 비활성. */
    isBusy: boolean;
    onCopyReport: () => void;
    /** false면 리스크 등급을 숨긴다(`partial_detail` 잠금). */
    showRiskLevel: boolean;
}

export function AnalysisPanelHeader({
    trend,
    riskLevel,
    analyzedAt,
    isAnalyzing,
    hideTrend,
    showPersonalizedBadge,
    showCopyButton,
    copyState,
    isBusy,
    onCopyReport,
    showRiskLevel,
}: AnalysisPanelHeaderProps) {
    const t = useTranslations('widgets.analysis');
    const tLabel = useTranslations('shared.enumLabel');
    return (
        <>
            {/* 모바일(<sm)에서는 좌/우 그룹을 세로로 쌓아 정렬을 맞추고, sm+에서만
                양끝 정렬한다. flex-wrap+ml-auto는 초협폭 wrap 시 좌/우가 엇갈리는
                지그재그가 생겨 responsive 스택으로 대체했다. */}
            <div className="flex flex-col gap-y-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <span className={LABEL_GROUP}>
                        {t('AnalysisPanel.f0cdeb')}
                    </span>
                    {isAnalyzing && (
                        <span
                            className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary-400"
                            aria-hidden
                        />
                    )}
                    {!hideTrend && <TrendBadge trend={trend} />}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:justify-end">
                    {showPersonalizedBadge && <PersonalizedAnalysisBadge />}
                    {analyzedAt && (
                        <time
                            dateTime={analyzedAt}
                            className="text-xs whitespace-nowrap text-secondary-400"
                        >
                            {formatAnalyzedAt(analyzedAt)}
                        </time>
                    )}
                    {showCopyButton && (
                        <CopyReportButton
                            copyState={copyState}
                            isBusy={isBusy}
                            onCopy={onCopyReport}
                        />
                    )}
                    {showRiskLevel && (
                        <div className="flex items-center gap-1.5 text-xs whitespace-nowrap text-secondary-400">
                            <span>{t('AnalysisPanel.720097')}</span>
                            <span
                                className={cn(
                                    'font-semibold',
                                    RISK_LEVEL_COLOR[riskLevel]
                                )}
                            >
                                {tLabel(RISK_LEVEL_KEY[riskLevel])}
                            </span>
                        </div>
                    )}
                </div>
            </div>
            {copyState === 'failed' && (
                <p className="-mt-2 text-xs text-ui-danger-text">
                    {t('AnalysisPanel.c68843')}
                </p>
            )}
        </>
    );
}
