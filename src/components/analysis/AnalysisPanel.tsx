'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { usePointerTooltip } from '@/components/hooks/usePointerTooltip';
import type {
    ActionRecommendation,
    AnalysisResponse,
    AnalysisSignal,
    AnalysisSignalType,
    ClusteredKeyLevel,
    ClusteredKeyLevels,
    EntryRecommendation,
    PatternResult,
    PriceScenario,
    RiskLevel,
    StrategyResult,
    Trend,
    Trendline,
    TrendlineDirection,
} from '@/domain/types';
import {
    HIGH_CONFIDENCE_WEIGHT,
    MIN_CONFIDENCE_WEIGHT,
} from '@y0ngha/siglens-core';
import { cn } from '@/lib/cn';
import { useSymbolPageContext } from '@/components/symbol-page/SymbolPageContext';
import {
    parseStructuredSummary,
    type SkillSummarySection,
} from '@/components/analysis/utils/parseStructuredSummary';
import { buildExpertAnalysisReport } from '@/components/analysis/utils/buildExpertAnalysisReport';
import { resolveTrendDisplay } from '@/components/analysis/utils/trendUtils';
import { resolveStrengthDisplay } from '@/components/analysis/utils/signalUtils';
import { AnalysisProgress } from '@/components/analysis/AnalysisProgress';
import { AnalysisToast } from '@/components/analysis/AnalysisToast';
import { AdBanner } from '@/components/analysis/AdBanner';
import type { CooldownNotice } from '@/components/symbol-page/hooks/useAnalysis';
import { TRENDLINE_DIRECTION_LABEL } from '@/components/trendline/constants';
import { MS_PER_SECOND, SECONDS_PER_MINUTE } from '@/domain/constants/time';
import { DEFAULT_RESET_MS as COPY_RESET_MS } from '@/components/hooks/useCopyToClipboard';

function formatCooldown(ms: number): string {
    const totalSec = Math.ceil(ms / MS_PER_SECOND);
    const minutes = Math.floor(totalSec / SECONDS_PER_MINUTE);
    const seconds = totalSec % SECONDS_PER_MINUTE;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const ENTRY_RECOMMENDATION_LABEL: Record<EntryRecommendation, string> = {
    enter: '진입 추천',
    wait: '대기 추천',
    avoid: '진입 비추천',
};

const ENTRY_RECOMMENDATION_COLOR: Record<EntryRecommendation, string> = {
    enter: 'bg-chart-bullish/10 text-chart-bullish border border-chart-bullish/30',
    wait: 'bg-ui-warning/10 text-ui-warning border border-ui-warning/30',
    avoid: 'bg-chart-bearish/10 text-chart-bearish border border-chart-bearish/30',
};

type ActionRecommendationTextKey =
    | 'positionAnalysis'
    | 'entry'
    | 'exit'
    | 'riskReward';

interface ActionRecommendationField {
    label: string;
    key: ActionRecommendationTextKey;
}

const ACTION_RECOMMENDATION_FIELDS: readonly ActionRecommendationField[] = [
    { label: '현재 위치', key: 'positionAnalysis' },
    { label: '진입 전략', key: 'entry' },
    { label: '청산 전략', key: 'exit' },
    { label: '리스크/리워드', key: 'riskReward' },
];

interface ActionRecommendationSectionProps {
    rec: ActionRecommendation;
    isChartVisible: boolean;
    onToggleChart: () => void;
}

function ActionRecommendationSection({
    rec,
    isChartVisible,
    onToggleChart,
}: ActionRecommendationSectionProps) {
    return (
        <div className="bg-secondary-700/30 flex flex-col gap-2 rounded-lg p-3">
            {rec.entryRecommendation !== undefined && (
                <div className="flex items-center gap-2">
                    <span className="text-secondary-500 text-xs">
                        진입 추천 여부
                    </span>
                    <span
                        className={cn(
                            'rounded px-2 py-0.5 text-xs font-semibold',
                            ENTRY_RECOMMENDATION_COLOR[rec.entryRecommendation]
                        )}
                    >
                        {ENTRY_RECOMMENDATION_LABEL[rec.entryRecommendation]}
                    </span>
                </div>
            )}
            <div className="flex items-center justify-between">
                <span className="text-secondary-500 text-xs font-semibold tracking-wide uppercase">
                    매매 전략
                </span>
                <button
                    type="button"
                    onClick={onToggleChart}
                    className={cn(
                        'focus-visible:ring-primary-500 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors focus-visible:ring-1 focus-visible:outline-none',
                        isChartVisible
                            ? 'text-primary-400 hover:text-primary-300'
                            : 'text-secondary-500 hover:text-secondary-400'
                    )}
                    aria-label={
                        isChartVisible
                            ? '차트 가격선 숨기기'
                            : '차트 가격선 표시'
                    }
                >
                    <EyeIcon isVisible={isChartVisible} />
                    차트
                </button>
            </div>
            <div className="flex flex-col gap-2">
                {ACTION_RECOMMENDATION_FIELDS.map(({ label, key }) => {
                    const value = rec[key];
                    if (typeof value !== 'string' || value === '') return null;
                    return (
                        <div key={label} className="flex flex-col gap-0.5">
                            <span className="text-secondary-400 text-xs font-medium">
                                {label}
                            </span>
                            <p className="text-secondary-300 text-sm leading-relaxed whitespace-pre-line">
                                {value}
                            </p>
                        </div>
                    );
                })}
            </div>
            <ReconciledLevelsBlockFromRec rec={rec} />
        </div>
    );
}

interface ReconciledLevelsBlockFromRecProps {
    rec: ActionRecommendation;
}

/** rec에서 reconciledLevels를 1회만 뽑아 전달하는 래퍼 — JSX 내 반복 접근 제거. */
function ReconciledLevelsBlockFromRec({
    rec,
}: ReconciledLevelsBlockFromRecProps) {
    const reconciled = rec.reconciledLevels;
    if (!reconciled) return null;
    if (reconciled.exit === '' && reconciled.riskReward === '') return null;
    return (
        <ReconciledLevelsBlock
            exit={reconciled.exit}
            riskReward={reconciled.riskReward}
            reason={reconciled.reason}
        />
    );
}

interface ReconciledLevelsBlockProps {
    exit: string;
    riskReward: string;
    reason: string;
}

/** 툴팁 공통 안내 문구 (보정 경위 구체 사유 앞에 위치). */
const RECONCILED_TOOLTIP_PREFIX =
    'AI가 제시한 내용을 기반으로, 내부 데이터로 보정한 결과입니다.';

function ReconciledLevelsBlock({
    exit,
    riskReward,
    reason,
}: ReconciledLevelsBlockProps) {
    return (
        <section className="border-secondary-700 bg-secondary-800/40 mt-1 flex flex-col gap-1 rounded-md border px-3 py-2">
            <header className="flex items-center">
                <span className="text-secondary-400 text-[10px] font-semibold tracking-wide uppercase">
                    내부 보정값
                </span>
                <InfoTooltip>
                    <span className="text-secondary-300">
                        {RECONCILED_TOOLTIP_PREFIX}
                        <br />
                        {reason}
                    </span>
                </InfoTooltip>
            </header>
            {exit !== '' && (
                <p className="text-secondary-300 text-sm leading-relaxed">
                    {exit}
                </p>
            )}
            {riskReward !== '' && (
                <p className="text-secondary-400 text-xs leading-relaxed">
                    {riskReward}
                </p>
            )}
        </section>
    );
}

const RISK_LEVEL_COLOR: Record<RiskLevel, string> = {
    low: 'text-chart-bullish',
    medium: 'text-ui-warning',
    high: 'text-chart-bearish',
};

const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
    low: '낮음',
    medium: '보통',
    high: '높음',
};

const SIGNAL_TYPE_LABEL: Record<AnalysisSignalType, string> = {
    skill: '스킬',
};

interface SignalItemProps {
    signal: AnalysisSignal;
    typeLabel?: string;
}

function SignalItem({ signal, typeLabel }: SignalItemProps) {
    const strengthDisplay = resolveStrengthDisplay(signal.strength);

    return (
        <div className="bg-secondary-700/40 flex flex-col gap-1.5 rounded px-3 py-2">
            <div className="flex items-center gap-2">
                <span className="text-secondary-300 min-w-0 flex-1 truncate text-xs font-medium">
                    {typeLabel ?? SIGNAL_TYPE_LABEL[signal.type]}
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
                            {strengthDisplay.label}
                        </span>
                    )}
                </div>
            </div>
            <span className="text-secondary-400 text-xs">
                {signal.description}
            </span>
        </div>
    );
}

interface TrendBadgeProps {
    trend: Trend | null | undefined;
}

function TrendBadge({ trend }: TrendBadgeProps) {
    const display = resolveTrendDisplay(trend);
    if (display === null) return null;

    return (
        <span
            className={cn(
                'rounded border px-2 py-0.5 text-xs font-bold',
                display.color,
                display.bgColor
            )}
        >
            {display.label}
        </span>
    );
}

interface ChevronIconProps {
    isOpen: boolean;
}

function ChevronIcon({ isOpen }: ChevronIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={cn(
                'text-secondary-500 h-4 w-4 transition-transform duration-200',
                isOpen && 'rotate-180'
            )}
        >
            <path
                fillRule="evenodd"
                d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
            />
        </svg>
    );
}

interface EyeIconProps {
    isVisible: boolean;
}

function EyeIcon({ isVisible }: EyeIconProps) {
    return isVisible ? (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5"
        >
            <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
            <path
                fillRule="evenodd"
                d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
                clipRule="evenodd"
            />
        </svg>
    ) : (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5"
        >
            <path
                fillRule="evenodd"
                d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092a4 4 0 0 0-5.557-5.557Z"
                clipRule="evenodd"
            />
            <path d="M10.748 13.93l2.523 2.523a10.003 10.003 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z" />
        </svg>
    );
}

type ConfidenceLevel = 'high' | 'medium';

const CONFIDENCE_BADGE_CONFIG: Record<
    ConfidenceLevel,
    { className: string; label: string; tooltip: string }
> = {
    high: {
        className:
            'text-chart-bullish bg-chart-bullish/10 border border-chart-bullish/30',
        label: '높은 신뢰도',
        tooltip:
            '신뢰도가 높은 패턴입니다. AI가 해당 패턴을 명확하게 감지했습니다.',
    },
    medium: {
        className:
            'text-ui-warning bg-ui-warning/10 border border-ui-warning/30',
        label: '중간 신뢰도',
        tooltip: '신뢰도가 중간인 패턴입니다. 다른 지표와 함께 참고하세요.',
    },
};

interface ConfidenceBadgeProps {
    confidenceWeight: number;
}

function ConfidenceBadge({ confidenceWeight }: ConfidenceBadgeProps) {
    const { isVisible, toggle, handlePointerEnter, handlePointerLeave } =
        usePointerTooltip();
    const tooltipId = useId();

    const level: ConfidenceLevel =
        confidenceWeight >= HIGH_CONFIDENCE_WEIGHT ? 'high' : 'medium';
    const { className, label, tooltip } = CONFIDENCE_BADGE_CONFIG[level];

    return (
        <span
            className="relative"
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
        >
            <button
                type="button"
                onClick={toggle}
                aria-describedby={isVisible ? tooltipId : undefined}
                className={cn(
                    'focus-visible:ring-primary-500 cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium focus-visible:ring-1 focus-visible:outline-none',
                    className
                )}
            >
                {label}
            </button>
            {isVisible && (
                <div
                    id={tooltipId}
                    role="tooltip"
                    className="bg-secondary-800 border-secondary-600 absolute bottom-full left-1/2 z-50 mb-1 w-48 -translate-x-1/2 rounded border p-2 text-xs leading-relaxed shadow-lg"
                >
                    <span className="text-secondary-300">{tooltip}</span>
                    <span className="border-t-secondary-600 absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent" />
                </div>
            )}
        </span>
    );
}

interface ConfluenceInfoProps {
    level: ClusteredKeyLevel;
}

function ConfluenceInfo({ level }: ConfluenceInfoProps) {
    if (level.count < 2) return null;

    return (
        <InfoTooltip>
            <div className="flex flex-col gap-1">
                {level.sources.map((source, index) => (
                    <div
                        key={`${source.price}-${source.reason}-${index}`}
                        className="flex items-baseline gap-2 whitespace-nowrap"
                    >
                        <span className="text-secondary-300 shrink-0">
                            {source.price.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
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

function KeyLevelsHeaderInfo() {
    return (
        <InfoTooltip>
            <span className="text-secondary-300">
                가까운 가격대의 지표들이 수렴된 레벨입니다. 수렴 지표가 많을수록
                해당 가격대의 지지/저항 신뢰도가 높습니다.
            </span>
        </InfoTooltip>
    );
}

interface PatternAccordionItemProps {
    pattern: PatternResult;
}

function PatternAccordionItem({ pattern }: PatternAccordionItemProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleToggleOpen = (): void => {
        setIsOpen(prev => !prev);
    };

    const primaryLabel = pattern.renderConfig?.label ?? '주요 가격';
    const keyPrices = pattern.keyPrices ?? [];

    return (
        <div className="border-secondary-700 overflow-hidden rounded-md border">
            <div className="bg-secondary-700/20 hover:bg-secondary-700/40 flex w-full items-center transition-colors">
                <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={handleToggleOpen}
                    className="focus-visible:ring-primary-500 flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left focus-visible:ring-1 focus-visible:outline-none"
                >
                    <span className="text-secondary-300 min-w-0 flex-1 truncate text-xs font-medium">
                        {pattern.skillName}
                    </span>
                    <TrendBadge trend={pattern.trend} />
                    <ChevronIcon isOpen={isOpen} />
                </button>
                <span className="shrink-0 pr-2">
                    <ConfidenceBadge
                        confidenceWeight={pattern.confidenceWeight}
                    />
                </span>
            </div>

            {isOpen ? (
                <div className="bg-secondary-800/60 border-secondary-700 flex flex-col gap-2.5 border-t px-3 py-2.5">
                    <p className="text-secondary-400 text-xs leading-relaxed">
                        {pattern.summary}
                    </p>
                    {keyPrices.length > 0 && (
                        <div className="flex flex-col gap-1">
                            <span className="text-secondary-500 text-[10px] font-semibold tracking-wide uppercase">
                                주요 가격대
                            </span>
                            <div className="flex flex-col gap-1">
                                {keyPrices.map((kp, index) => (
                                    <div
                                        key={`keyprice-${kp.label}`}
                                        className="flex items-baseline gap-2"
                                    >
                                        <span className="text-secondary-500 w-16 shrink-0 text-xs">
                                            {index === 0
                                                ? primaryLabel
                                                : kp.label}
                                        </span>
                                        <span className="text-secondary-200 text-xs font-medium tabular-nums">
                                            {kp.price.toLocaleString(
                                                undefined,
                                                {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                }
                                            )}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    );
}

interface StructuredSkillSummaryProps {
    sections: SkillSummarySection[];
}

function StructuredSkillSummary({ sections }: StructuredSkillSummaryProps) {
    return (
        <div className="flex flex-col gap-2">
            {sections.map(section => (
                <div key={section.label} className="flex flex-col gap-0.5">
                    <span className="text-secondary-500 text-[10px] font-semibold tracking-wide uppercase">
                        {section.label}
                    </span>
                    <span className="text-secondary-300 text-xs leading-relaxed">
                        {section.value}
                    </span>
                </div>
            ))}
        </div>
    );
}

interface StrategyAccordionItemProps {
    strategy: StrategyResult;
}

function StrategyAccordionItem({ strategy }: StrategyAccordionItemProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleToggleOpen = (): void => {
        setIsOpen(prev => !prev);
    };

    const sections = parseStructuredSummary(strategy.summary);

    return (
        <div className="border-secondary-700 overflow-hidden rounded-md border">
            <div className="bg-secondary-700/20 hover:bg-secondary-700/40 flex w-full items-center transition-colors">
                <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={handleToggleOpen}
                    className="focus-visible:ring-primary-500 flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left focus-visible:ring-1 focus-visible:outline-none"
                >
                    <span className="text-secondary-300 min-w-0 flex-1 truncate text-xs font-medium">
                        {strategy.strategyName}
                    </span>
                    <TrendBadge trend={strategy.trend} />
                    <ChevronIcon isOpen={isOpen} />
                </button>
                <span className="shrink-0 pr-2">
                    <ConfidenceBadge
                        confidenceWeight={strategy.confidenceWeight}
                    />
                </span>
            </div>

            {isOpen ? (
                <div className="bg-secondary-800/60 border-secondary-700 border-t px-3 py-2.5">
                    {sections !== null ? (
                        <StructuredSkillSummary sections={sections} />
                    ) : (
                        <p className="text-secondary-400 text-xs leading-relaxed">
                            {strategy.summary}
                        </p>
                    )}
                </div>
            ) : null}
        </div>
    );
}

const TRENDLINE_COLOR: Record<TrendlineDirection, string> = {
    ascending: 'text-chart-bullish',
    descending: 'text-chart-bearish',
};

const TRENDLINE_BG_COLOR: Record<TrendlineDirection, string> = {
    ascending: 'bg-chart-bullish',
    descending: 'bg-chart-bearish',
};

interface TrendlineItemProps {
    trendline: Trendline;
}

function TrendlineItem({ trendline }: TrendlineItemProps) {
    const label = TRENDLINE_DIRECTION_LABEL[trendline.direction];
    const colorClass = TRENDLINE_COLOR[trendline.direction];
    const bgClass = TRENDLINE_BG_COLOR[trendline.direction];

    return (
        <div className="bg-secondary-700/40 flex items-center gap-2 rounded px-3 py-2">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', bgClass)} />
            <span className={cn('text-xs font-medium', colorClass)}>
                {label}
            </span>
            <span className="text-secondary-500 ml-auto text-xs tabular-nums">
                {trendline.start.price.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                })}
                {' → '}
                {trendline.end.price.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                })}
            </span>
        </div>
    );
}

interface PriceScenarioSectionProps {
    label: string;
    scenario: PriceScenario | null;
    colorClass: string;
}

function PriceScenarioSection({
    label,
    scenario,
    colorClass,
}: PriceScenarioSectionProps) {
    if (!scenario || scenario.targets.length === 0) return null;
    return (
        <div className="flex flex-col gap-1.5">
            <span className={cn('text-xs font-medium', colorClass)}>
                {label}
            </span>
            <span className="text-secondary-500 text-xs">
                {scenario.condition}
            </span>
            {scenario.targets.map((target, index) => (
                <div
                    key={`target-${index}-${target.price}`}
                    className="flex items-baseline gap-2"
                >
                    <span
                        className={cn(
                            'text-sm font-medium tabular-nums',
                            colorClass
                        )}
                    >
                        {target.price.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}
                    </span>
                    <span className="text-secondary-500 text-xs">
                        {target.basis}
                    </span>
                </div>
            ))}
        </div>
    );
}

function getReanalyzeLabel(isAnalyzing: boolean, cooldownMs: number): string {
    if (isAnalyzing) return '분석 중…';
    if (cooldownMs > 0) return `재분석 가능까지 ${formatCooldown(cooldownMs)}`;
    return '재분석';
}

interface ReanalyzeButtonProps {
    isAnalyzing: boolean;
    reanalyzeCooldownMs: number;
    onReanalyze: () => void;
}

function ReanalyzeButton({
    isAnalyzing,
    reanalyzeCooldownMs,
    onReanalyze,
}: ReanalyzeButtonProps) {
    const isCoolingDown = reanalyzeCooldownMs > 0;
    const isDisabled = isAnalyzing || isCoolingDown;
    const label = getReanalyzeLabel(isAnalyzing, reanalyzeCooldownMs);
    return (
        <button
            type="button"
            onClick={onReanalyze}
            disabled={isDisabled}
            aria-disabled={isDisabled}
            title={
                isCoolingDown
                    ? '재분석은 5분에 한 번만 실행할 수 있어요.'
                    : undefined
            }
            className="bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/40 disabled:text-secondary-300 focus-visible:ring-primary-500 w-full rounded-lg px-4 py-2 text-sm font-semibold text-white tabular-nums transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed"
        >
            {label}
        </button>
    );
}

interface AnalysisPanelProps {
    symbol: string;
    analysis: AnalysisResponse;
    keyLevels: ClusteredKeyLevels;
    isAnalyzing?: boolean;
    /** 마무리 애니메이션을 포함해 "사용자에게 분석이 진행 중인 것처럼 보이는" 상태.
     *  AnalysisProgress 표시·본문 섹션 숨김에 사용된다. ChartContent가 소유한다. */
    showProgress?: boolean;
    /** useAnalysisProgress 훅에서 관리되는 현재 단계 인덱스. */
    progressPhaseIndex?: number;
    /** useAnalysisProgress 훅에서 관리되는 현재 팁 인덱스. */
    progressTipIndex?: number;
    onReanalyze?: () => void;
    /** 다음 재분석까지 남은 ms. 0이면 즉시 가능. */
    reanalyzeCooldownMs?: number;
    /** 쿨다운 중 재분석 시도를 토스트로 알리기 위한 알림. */
    cooldownNotice?: CooldownNotice | null;
    actionPricesVisible?: boolean;
    onActionPricesVisibilityChange?: (isVisible: boolean) => void;
    /** false이면 광고를 표시하지 않는다. Pro 사용자에게는 false를 전달한다.
     *  인증 시스템 도입 전까지 기본값은 true (모든 사용자를 Free로 처리). */
    isFreeUser?: boolean;
}

export function AnalysisPanel({
    symbol,
    analysis,
    keyLevels,
    isAnalyzing = false,
    showProgress = false,
    progressPhaseIndex = 0,
    progressTipIndex = 0,
    onReanalyze,
    reanalyzeCooldownMs = 0,
    cooldownNotice = null,
    actionPricesVisible = true,
    onActionPricesVisibilityChange,
    isFreeUser = true,
}: AnalysisPanelProps) {
    const { indicatorCount } = useSymbolPageContext();
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
        'idle'
    );
    const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetCopyStateLater = (): void => {
        if (copyTimeoutRef.current !== null) {
            clearTimeout(copyTimeoutRef.current);
        }
        copyTimeoutRef.current = setTimeout(
            () => setCopyState('idle'),
            COPY_RESET_MS
        );
    };

    const handleCopyReport = async (): Promise<void> => {
        if (showProgress || isAnalyzing) return;

        try {
            if (typeof navigator === 'undefined' || !navigator.clipboard) {
                throw new Error('Clipboard API unavailable');
            }

            const report = buildExpertAnalysisReport({
                symbol,
                analysis,
                keyLevels,
            });
            await navigator.clipboard.writeText(report);
            setCopyState('copied');
        } catch {
            setCopyState('failed');
        }

        resetCopyStateLater();
    };

    // showProgress, progressPhaseIndex, progressTipIndex는 ChartContent가 관리한다.
    // useAnalysisProgress 훅이 타이머/상태를 소유하므로, 데스크톱·모바일 두 인스턴스가
    // 동일한 진행 상태를 표시하고 모바일 시트의 remount에도 상태가 유지된다.

    const detectedPatterns = analysis.patternSummaries.filter(p => p.detected);
    const hasDetectedPatterns = detectedPatterns.length > 0;

    const patternSkillNames = new Set(
        analysis.patternSummaries.map(p => p.skillName)
    );

    const detectedStrategyResults = analysis.strategyResults.filter(
        s =>
            s.confidenceWeight >= MIN_CONFIDENCE_WEIGHT &&
            !patternSkillNames.has(s.strategyName)
    );

    const displayedIndicatorResults = analysis.indicatorResults.filter(
        r => r.indicatorName !== '' && !patternSkillNames.has(r.indicatorName)
    );

    useEffect(() => {
        return () => {
            if (copyTimeoutRef.current !== null) {
                clearTimeout(copyTimeoutRef.current);
            }
        };
    }, []);

    return (
        <div className="bg-secondary-800 relative flex flex-col gap-4 rounded-lg p-4">
            <AnalysisToast
                key={cooldownNotice?.nonce}
                notice={cooldownNotice}
            />
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-secondary-200 text-sm font-semibold">
                        AI 분석
                    </span>
                    {isAnalyzing && (
                        <span
                            className="bg-primary-400 inline-block h-1.5 w-1.5 animate-pulse rounded-full"
                            aria-hidden
                        />
                    )}
                    <TrendBadge trend={analysis.trend} />
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleCopyReport}
                        disabled={showProgress || isAnalyzing}
                        className={cn(
                            // [공통 스타일]
                            'focus-visible:ring-primary-500 rounded border px-2 py-1 text-xs font-medium transition-colors focus-visible:ring-1 focus-visible:outline-none',

                            // [1. 로딩/분석 중 상태]
                            (showProgress || isAnalyzing) &&
                                'border-secondary-700 text-secondary-600 cursor-not-allowed',

                            // [2. 일반 상태 (진행 중이 아닐 때만 적용)]
                            !showProgress &&
                                !isAnalyzing && {
                                    'border-primary-400/40 bg-primary-400/10 text-primary-300':
                                        copyState === 'copied',
                                    'border-chart-bearish/40 bg-chart-bearish/10 text-chart-bearish':
                                        copyState === 'failed',
                                    'border-secondary-700 text-secondary-300 hover:border-secondary-600 hover:text-secondary-100':
                                        copyState === 'idle',
                                    // idle은 기본 상태를 의미하며, 필요에 따라 copyState !== 'copied' && copyState !== 'failed'로 작성 가능
                                }
                        )}
                        title={
                            showProgress || isAnalyzing
                                ? '분석이 완료된 뒤 복사할 수 있습니다'
                                : '리포트 복사'
                        }
                    >
                        {copyState === 'copied' && '복사됨'}
                        {copyState === 'failed' && '복사 실패'}
                        {copyState === 'idle' && '리포트 복사'}
                    </button>
                    <div className="text-secondary-400 flex items-center gap-1.5 text-xs">
                        <span>리스크</span>
                        <span
                            className={cn(
                                'font-semibold',
                                RISK_LEVEL_COLOR[analysis.riskLevel]
                            )}
                        >
                            {RISK_LEVEL_LABEL[analysis.riskLevel]}
                        </span>
                    </div>
                </div>
            </div>
            {copyState === 'failed' && (
                <p className="text-chart-bearish -mt-2 text-xs">
                    클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.
                </p>
            )}
            <p className="text-secondary-500 font-mono text-xs">
                {detectedPatterns.length + detectedStrategyResults.length}개
                스킬 감지 · {indicatorCount}종 인디케이터 적용
            </p>

            {/* 요약 — 분석 중에는 진행 인디케이터로 대체.
                isAnalyzing이 false로 떨어진 직후에도 마무리 애니메이션이 끝날 때까지
                showProgress=true가 유지되어 인디케이터가 잠시 더 노출된다. */}
            {showProgress ? (
                <AnalysisProgress
                    phaseIndex={progressPhaseIndex}
                    tipIndex={progressTipIndex}
                    isFreeUser={isFreeUser}
                />
            ) : (
                <p className="text-secondary-300 text-sm leading-relaxed whitespace-pre-line">
                    {analysis.summary}
                </p>
            )}

            {/* 인디케이터/패턴/스킬/레벨/추세선/가격목표 등 본문 섹션 —
                마무리 애니메이션이 끝나기 전(showProgress=true) 동안에는 노출하지 않는다.
                캐시 히트로 분석 결과가 즉시 도착해도 사용자가 5단계를 모두 본 뒤에야
                결과가 한 번에 드러나도록 하기 위함이다. */}
            {!showProgress && (
                <>
                    <div className="border-secondary-700 border-t" />

                    {/* 매매 전략 추천 */}
                    {analysis.actionRecommendation && (
                        <ActionRecommendationSection
                            rec={analysis.actionRecommendation}
                            isChartVisible={actionPricesVisible}
                            onToggleChart={() =>
                                onActionPricesVisibilityChange?.(
                                    !actionPricesVisible
                                )
                            }
                        />
                    )}

                    {/* 지지/저항 레벨 */}
                    {(keyLevels.support.length > 0 ||
                        keyLevels.resistance.length > 0 ||
                        keyLevels.poc !== undefined) && (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center">
                                <span className="text-secondary-500 text-xs font-semibold tracking-wide uppercase">
                                    주요 레벨
                                </span>
                                <KeyLevelsHeaderInfo />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {keyLevels.resistance.length > 0 && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-secondary-500 text-xs">
                                            저항
                                        </span>
                                        {keyLevels.resistance.map(level => (
                                            <div
                                                key={`resistance-${level.price}`}
                                                className="flex flex-col"
                                            >
                                                <span className="text-chart-bearish text-sm font-medium">
                                                    {level.price.toLocaleString(
                                                        undefined,
                                                        {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        }
                                                    )}
                                                </span>
                                                <span className="text-secondary-600 inline-flex items-center text-xs">
                                                    {level.reason}
                                                    <ConfluenceInfo
                                                        level={level}
                                                    />
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {keyLevels.support.length > 0 && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-secondary-500 text-xs">
                                            지지
                                        </span>
                                        {keyLevels.support.map(level => (
                                            <div
                                                key={`support-${level.price}`}
                                                className="flex flex-col"
                                            >
                                                <span className="text-chart-bullish text-sm font-medium">
                                                    {level.price.toLocaleString(
                                                        undefined,
                                                        {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        }
                                                    )}
                                                </span>
                                                <span className="text-secondary-600 inline-flex items-center text-xs">
                                                    {level.reason}
                                                    <ConfluenceInfo
                                                        level={level}
                                                    />
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {keyLevels.poc !== undefined && (
                                <div className="flex flex-col">
                                    <span className="text-secondary-500 text-xs">
                                        PoC
                                    </span>
                                    <span className="text-sm font-medium">
                                        {keyLevels.poc.price.toLocaleString(
                                            undefined,
                                            {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            }
                                        )}
                                    </span>
                                    <span className="text-secondary-600 text-xs">
                                        {keyLevels.poc.reason}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 추세선 */}
                    {analysis.trendlines.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-secondary-500 text-xs font-semibold tracking-wide uppercase">
                                    추세선
                                </span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {analysis.trendlines.map(trendline => (
                                    <TrendlineItem
                                        key={`trendline-${trendline.direction}-${trendline.start.time}-${trendline.end.time}`}
                                        trendline={trendline}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 가격 목표 */}
                    {((analysis.priceTargets.bullish?.targets.length ?? 0) >
                        0 ||
                        (analysis.priceTargets.bearish?.targets.length ?? 0) >
                            0) && (
                        <div className="flex flex-col gap-2">
                            <span className="text-secondary-500 text-xs font-semibold tracking-wide uppercase">
                                가격 목표
                            </span>
                            <div className="grid grid-cols-2 gap-3">
                                <PriceScenarioSection
                                    label="상승"
                                    scenario={analysis.priceTargets.bullish}
                                    colorClass="text-chart-bullish"
                                />
                                <PriceScenarioSection
                                    label="하락"
                                    scenario={analysis.priceTargets.bearish}
                                    colorClass="text-chart-bearish"
                                />
                            </div>
                        </div>
                    )}

                    {/* 보조지표 */}
                    {displayedIndicatorResults.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <span className="text-secondary-500 text-xs font-semibold tracking-wide uppercase">
                                보조지표
                            </span>
                            <div className="flex flex-col gap-1.5">
                                {displayedIndicatorResults.map(
                                    indicatorResult =>
                                        indicatorResult.signals.map(
                                            (signal, index) => (
                                                <SignalItem
                                                    key={`${indicatorResult.indicatorName}-${signal.type}-${index}`}
                                                    signal={signal}
                                                    typeLabel={
                                                        indicatorResult.indicatorName
                                                    }
                                                />
                                            )
                                        )
                                )}
                            </div>
                        </div>
                    )}

                    {/* 캔들 패턴 (아코디언) */}
                    {/* 패턴 상세 (아코디언) — 감지된 패턴만 표시, 없으면 안내 메시지 */}
                    <div className="flex flex-col gap-2">
                        <span className="text-secondary-500 text-xs font-semibold tracking-wide uppercase">
                            차트 패턴
                        </span>
                        {hasDetectedPatterns ? (
                            <div className="flex flex-col gap-1.5">
                                {detectedPatterns.map(pattern => (
                                    <PatternAccordionItem
                                        key={pattern.id}
                                        pattern={pattern}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-secondary-500 text-sm">
                                감지된 패턴 없음
                            </p>
                        )}
                    </div>

                    {/* 전략 상세 (아코디언) — 감지된 전략만 표시 */}
                    {detectedStrategyResults.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <span className="text-secondary-500 text-xs font-semibold tracking-wide uppercase">
                                전략
                            </span>
                            <div className="flex flex-col gap-1.5">
                                {detectedStrategyResults.map(strategy => (
                                    <StrategyAccordionItem
                                        key={strategy.id}
                                        strategy={strategy}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {onReanalyze !== undefined && (
                <div className="mt-1">
                    <ReanalyzeButton
                        isAnalyzing={isAnalyzing || showProgress}
                        reanalyzeCooldownMs={reanalyzeCooldownMs}
                        onReanalyze={onReanalyze}
                    />
                </div>
            )}

            {/* 분석 완료 후 패널 하단 광고 — 리포트를 다 읽은 사용자의 다음 행동 유도 */}
            {!showProgress && (
                <AdBanner
                    isFreeUser={isFreeUser}
                    slot="analysis-panel-bottom"
                />
            )}
        </div>
    );
}
