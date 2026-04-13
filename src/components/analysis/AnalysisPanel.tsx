'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type React from 'react';
import type {
    ActionRecommendation,
    AnalysisResponse,
    CandlePatternSummary,
    EntryRecommendation,
    ClusteredKeyLevel,
    ClusteredKeyLevels,
    PatternResult,
    PriceScenario,
    RiskLevel,
    Signal,
    SignalStrength,
    SignalType,
    StrategyResult,
    Trend,
    Trendline,
    TrendlineDirection,
} from '@/domain/types';
import { findCandlePatternLabel } from '@/domain/analysis/candle-labels';
import {
    HIGH_CONFIDENCE_WEIGHT,
    MIN_CONFIDENCE_WEIGHT,
} from '@/domain/indicators/constants';
import { cn } from '@/lib/cn';
import { useSymbolPageContext } from '@/components/symbol-page/SymbolPageContext';
import {
    parseStructuredSummary,
    type SkillSummarySection,
} from '@/components/analysis/utils/parseStructuredSummary';
import { AnalysisProgress } from '@/components/analysis/AnalysisProgress';
import { AnalysisToast } from '@/components/analysis/AnalysisToast';
import { useOnClickOutside } from '@/components/hooks/useOnClickOutside';
import type { CooldownNotice } from '@/components/symbol-page/hooks/useAnalysis';
import { TRENDLINE_DIRECTION_LABEL } from '@/components/trendline/constants';

function formatCooldown(ms: number): string {
    const totalSec = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
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
                        'flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors',
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
                {ACTION_RECOMMENDATION_FIELDS.map(({ label, key }) => (
                    <div key={label} className="flex flex-col gap-0.5">
                        <span className="text-secondary-400 text-xs font-medium">
                            {label}
                        </span>
                        <p className="text-secondary-300 text-sm leading-relaxed whitespace-pre-line">
                            {rec[key]}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

const TREND_COLOR: Record<Trend, string> = {
    bullish: 'text-chart-bullish',
    bearish: 'text-chart-bearish',
    neutral: 'text-secondary-400',
};

const TREND_BG_COLOR: Record<Trend, string> = {
    bullish: 'bg-chart-bullish/10 border-chart-bullish/30',
    bearish: 'bg-chart-bearish/10 border-chart-bearish/30',
    neutral: 'bg-secondary-700/30 border-secondary-600/30',
};

const TREND_LABEL: Record<Trend, string> = {
    bullish: '강세',
    bearish: '약세',
    neutral: '보합',
};

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

const SIGNAL_STRENGTH_COLOR: Record<SignalStrength, string> = {
    strong: 'text-chart-bullish',
    moderate: 'text-ui-warning',
    weak: 'text-secondary-400',
};

const SIGNAL_STRENGTH_LABEL: Record<SignalStrength, string> = {
    strong: '강한 시그널',
    moderate: '보통 시그널',
    weak: '약한 시그널',
};

const SIGNAL_TYPE_LABEL: Record<SignalType, string> = {
    skill: '스킬',
};

interface SignalItemProps {
    signal: Signal;
    typeLabel?: string;
}

function SignalItem({ signal, typeLabel }: SignalItemProps) {
    return (
        <div className="bg-secondary-700/40 flex flex-col gap-1.5 rounded px-3 py-2">
            <div className="flex items-center gap-2">
                <span className="text-secondary-300 min-w-0 flex-1 truncate text-xs font-medium">
                    {typeLabel ?? SIGNAL_TYPE_LABEL[signal.type]}
                </span>
                <TrendBadge trend={signal.trend} />
                <span
                    className={cn(
                        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                        SIGNAL_STRENGTH_COLOR[signal.strength]
                    )}
                >
                    {SIGNAL_STRENGTH_LABEL[signal.strength]}
                </span>
            </div>
            <span className="text-secondary-400 text-xs">
                {signal.description}
            </span>
        </div>
    );
}

interface TrendBadgeProps {
    trend: Trend;
}

function TrendBadge({ trend }: TrendBadgeProps) {
    return (
        <span
            className={cn(
                'rounded border px-2 py-0.5 text-xs font-bold',
                TREND_COLOR[trend],
                TREND_BG_COLOR[trend]
            )}
        >
            {TREND_LABEL[trend]}
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

/**
 * TODO 미사용이어도 이를 정리하지 않고 넘어간다. 나중에 사용할 예정이다.
 */
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
    const [isTooltipVisible, setIsTooltipVisible] = useState(false);

    const level: ConfidenceLevel =
        confidenceWeight >= HIGH_CONFIDENCE_WEIGHT ? 'high' : 'medium';
    const { className, label, tooltip } = CONFIDENCE_BADGE_CONFIG[level];

    const handleClick = (): void => {
        setIsTooltipVisible(prev => !prev);
    };

    const handleMouseEnter = (): void => {
        setIsTooltipVisible(true);
    };

    const handleMouseLeave = (): void => {
        setIsTooltipVisible(false);
    };

    const handlePointerEnter = (
        e: React.PointerEvent<HTMLSpanElement>
    ): void => {
        // 터치 기기에서는 hover를 비활성화한다. 클릭(handleClick)만으로 토글한다.
        if (e.pointerType === 'touch') return;
        handleMouseEnter();
    };

    const handlePointerLeave = (
        e: React.PointerEvent<HTMLSpanElement>
    ): void => {
        if (e.pointerType === 'touch') return;
        handleMouseLeave();
    };

    return (
        <span
            className="relative"
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
        >
            <button
                type="button"
                onClick={handleClick}
                className={cn(
                    'cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium',
                    className
                )}
            >
                {label}
            </button>
            {isTooltipVisible && (
                <div
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

const TOOLTIP_VIEWPORT_PADDING = 8;

interface TooltipPosition {
    top: number;
    left: number;
}

function getTooltipPosition(
    triggerRect: DOMRect,
    tooltipEl: HTMLElement
): TooltipPosition {
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const top = triggerRect.top - tooltipRect.height - 6;
    const rawLeft =
        triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    const maxLeft =
        window.innerWidth - tooltipRect.width - TOOLTIP_VIEWPORT_PADDING;
    const left = Math.max(TOOLTIP_VIEWPORT_PADDING, Math.min(rawLeft, maxLeft));

    return { top, left };
}

interface InfoTooltipProps {
    children: React.ReactNode;
}

function InfoTooltip({ children }: InfoTooltipProps) {
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<TooltipPosition>({
        top: 0,
        left: 0,
    });

    useOnClickOutside([triggerRef, tooltipRef], () => setOpen(false), {
        enabled: open,
    });

    const handleClick = (): void => {
        if (!open && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPosition({ top: rect.top - 6, left: rect.left });
        }
        setOpen(prev => !prev);
    };

    const handlePointerEnter = (e: React.PointerEvent): void => {
        if (e.pointerType === 'touch') return;
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPosition({ top: rect.top - 6, left: rect.left });
        }
        setOpen(true);
    };

    const handlePointerLeave = (e: React.PointerEvent): void => {
        if (e.pointerType === 'touch') return;
        setOpen(false);
    };

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={handleClick}
                onPointerEnter={handlePointerEnter}
                onPointerLeave={handlePointerLeave}
                className="text-secondary-600 hover:text-secondary-400 ml-1 cursor-help text-xs leading-none transition-colors"
            >
                ⓘ
            </button>
            {open &&
                createPortal(
                    <div
                        ref={el => {
                            tooltipRef.current = el;
                            if (el && triggerRef.current) {
                                const triggerRect =
                                    triggerRef.current.getBoundingClientRect();
                                const pos = getTooltipPosition(triggerRect, el);
                                if (
                                    pos.top !== position.top ||
                                    pos.left !== position.left
                                ) {
                                    setPosition(pos);
                                }
                            }
                        }}
                        role="tooltip"
                        className="bg-secondary-800 border-secondary-600 fixed z-[9999] rounded border p-2 text-xs leading-relaxed shadow-lg"
                        style={{ top: position.top, left: position.left }}
                    >
                        {children}
                    </div>,
                    document.body
                )}
        </>
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
                {level.sources.map(source => (
                    <div
                        key={`${source.price}-${source.reason}`}
                        className="flex items-baseline gap-2 whitespace-nowrap"
                    >
                        <span className="text-secondary-300 shrink-0">
                            {source.price.toLocaleString()}
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
    isVisible: boolean;
    onToggleVisibility: (patternName: string) => void;
}

function PatternAccordionItem({
    pattern,
    /**
     * TODO 미사용이어도 이를 정리하지 않고 넘어간다. 나중에 사용할 예정이다.
     */
    isVisible: _isVisible,
    onToggleVisibility,
}: PatternAccordionItemProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleToggleOpen = (): void => {
        setIsOpen(prev => !prev);
    };

    /**
     * TODO 미사용이어도 이를 정리하지 않고 넘어간다. 나중에 사용할 예정이다.
     */
    const _handleToggleVisibility = (): void => {
        onToggleVisibility(pattern.patternName);
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
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left"
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
                {/*<button*/}
                {/*    type="button"*/}
                {/*    onClick={handleToggleVisibility}*/}
                {/*    className={cn(*/}
                {/*        'shrink-0 rounded p-1 pr-3 transition-colors',*/}
                {/*        isVisible*/}
                {/*            ? 'text-primary-400 hover:text-primary-300'*/}
                {/*            : 'text-secondary-600 hover:text-secondary-400'*/}
                {/*    )}*/}
                {/*    title={isVisible ? '차트에서 숨기기' : '차트에서 보기'}*/}
                {/*>*/}
                {/*    <EyeIcon isVisible={isVisible} />*/}
                {/*</button>*/}
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

/**
 * TODO 미사용이어도 이를 정리하지 않고 넘어간다. 나중에 사용할 예정이다.
 */
interface CandlePatternAccordionItemProps {
    pattern: CandlePatternSummary;
}

/**
 * TODO 미사용이어도 이를 정리하지 않고 넘어간다. 나중에 사용할 예정이다.
 */
function CandlePatternAccordionItem({
    pattern,
}: CandlePatternAccordionItemProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleToggleOpen = (): void => {
        setIsOpen(prev => !prev);
    };

    const patternLabel = findCandlePatternLabel(pattern.patternName);

    return (
        <div className="border-secondary-700 overflow-hidden rounded-md border">
            <button
                type="button"
                aria-expanded={isOpen}
                onClick={handleToggleOpen}
                className="bg-secondary-700/20 hover:bg-secondary-700/40 flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors"
            >
                <span className="text-secondary-300 min-w-0 flex-1 truncate text-xs font-medium">
                    {patternLabel}
                </span>
                <TrendBadge trend={pattern.trend} />
                <ChevronIcon isOpen={isOpen} />
            </button>

            {isOpen ? (
                <div className="bg-secondary-800/60 border-secondary-700 border-t px-3 py-2.5">
                    <p className="text-secondary-400 text-xs leading-relaxed">
                        {pattern.summary}
                    </p>
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
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left"
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
    scenario: PriceScenario;
    colorClass: string;
}

function PriceScenarioSection({
    label,
    scenario,
    colorClass,
}: PriceScenarioSectionProps) {
    if (scenario.targets.length === 0) return null;
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
            className="bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/40 disabled:text-secondary-300 w-full rounded-lg px-4 py-2 text-sm font-semibold text-white tabular-nums transition-colors disabled:cursor-not-allowed"
        >
            {label}
        </button>
    );
}

interface AnalysisPanelProps {
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
    /** 차트에서 현재 표시 중인 패턴 이름 집합 (patternName 기준). StockChart가 소유한 상태다. */
    chartVisiblePatterns?: Set<string>;
    /** 차트 패턴 표시 여부를 토글한다. patternName을 인자로 받는다. */
    onTogglePattern?: (patternName: string) => void;
    _keyLevelsVisible?: boolean;
    _onKeyLevelsVisibilityChange?: (isVisible: boolean) => void;
    _trendlinesVisible?: boolean;
    _onTrendlinesVisibilityChange?: (isVisible: boolean) => void;
    actionPricesVisible?: boolean;
    onActionPricesVisibilityChange?: (isVisible: boolean) => void;
}

export function AnalysisPanel({
    analysis,
    keyLevels,
    isAnalyzing = false,
    showProgress = false,
    progressPhaseIndex = 0,
    progressTipIndex = 0,
    onReanalyze,
    reanalyzeCooldownMs = 0,
    cooldownNotice = null,
    chartVisiblePatterns,
    onTogglePattern,
    _keyLevelsVisible = false,
    _onKeyLevelsVisibilityChange,
    _trendlinesVisible = false,
    _onTrendlinesVisibilityChange,
    actionPricesVisible = true,
    onActionPricesVisibilityChange,
}: AnalysisPanelProps) {
    const { indicatorCount } = useSymbolPageContext();
    const handleTogglePatternVisibility = (patternName: string): void => {
        onTogglePattern?.(patternName);
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
                                                    {level.price.toLocaleString()}
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
                                                    {level.price.toLocaleString()}
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
                                        {keyLevels.poc.price.toLocaleString()}
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
                                {/*{onTrendlinesVisibilityChange !== undefined && (*/}
                                {/*    <button*/}
                                {/*        type="button"*/}
                                {/*        onClick={() =>*/}
                                {/*            onTrendlinesVisibilityChange(*/}
                                {/*                !trendlinesVisible*/}
                                {/*            )*/}
                                {/*        }*/}
                                {/*        className={cn(*/}
                                {/*            'shrink-0 rounded p-1 transition-colors',*/}
                                {/*            trendlinesVisible*/}
                                {/*                ? 'text-primary-400 hover:text-primary-300'*/}
                                {/*                : 'text-secondary-600 hover:text-secondary-400'*/}
                                {/*        )}*/}
                                {/*        title={*/}
                                {/*            trendlinesVisible*/}
                                {/*                ? '차트에서 숨기기'*/}
                                {/*                : '차트에서 보기'*/}
                                {/*        }*/}
                                {/*    >*/}
                                {/*        <EyeIcon isVisible={trendlinesVisible} />*/}
                                {/*    </button>*/}
                                {/*)}*/}
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
                    {(analysis.priceTargets.bullish.targets.length > 0 ||
                        analysis.priceTargets.bearish.targets.length > 0) && (
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
                                        isVisible={
                                            chartVisiblePatterns?.has(
                                                pattern.patternName
                                            ) ?? false
                                        }
                                        onToggleVisibility={
                                            handleTogglePatternVisibility
                                        }
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
                        isAnalyzing={isAnalyzing}
                        reanalyzeCooldownMs={reanalyzeCooldownMs}
                        onReanalyze={onReanalyze}
                    />
                </div>
            )}
        </div>
    );
}
