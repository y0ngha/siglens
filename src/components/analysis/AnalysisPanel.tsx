'use client';

import { useState } from 'react';
import type {
    AnalysisResponse,
    PatternSummary,
    PriceScenario,
    RiskLevel,
    Signal,
    SignalStrength,
    SignalType,
    SkillResult,
    Trend,
} from '@/domain/types';
import { cn } from '@/lib/cn';

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
    strong: '강',
    moderate: '중',
    weak: '약',
};

const SIGNAL_TYPE_LABEL: Record<SignalType, string> = {
    rsi_overbought: 'RSI 과매수',
    rsi_oversold: 'RSI 과매도',
    macd_golden_cross: 'MACD 골든 크로스',
    macd_dead_cross: 'MACD 데드 크로스',
    bollinger_upper_breakout: '볼린저 상단 돌파',
    bollinger_lower_breakout: '볼린저 하단 이탈',
    bollinger_squeeze: '볼린저 스퀴즈',
    dmi_bullish_trend: 'DMI 상승 추세',
    dmi_bearish_trend: 'DMI 하락 추세',
    pattern: '패턴',
    skill: '스킬',
};

interface SignalItemProps {
    signal: Signal;
}

function SignalItem({ signal }: SignalItemProps) {
    return (
        <div className="bg-secondary-700/40 flex items-start gap-2 rounded px-3 py-2">
            <span
                className={cn(
                    'mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold',
                    SIGNAL_STRENGTH_COLOR[signal.strength]
                )}
            >
                {SIGNAL_STRENGTH_LABEL[signal.strength]}
            </span>
            <div className="min-w-0 flex-1">
                <span className="text-secondary-300 block text-xs font-medium">
                    {SIGNAL_TYPE_LABEL[signal.type]}
                </span>
                <span className="text-secondary-400 block text-xs">
                    {signal.description}
                </span>
            </div>
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

type DetectionStatus = 'detected' | 'undetected';

const DETECTED_BADGE_CONFIG: Record<
    DetectionStatus,
    { className: string; label: string }
> = {
    detected: {
        className: 'text-chart-bullish text-xs font-medium',
        label: '감지됨',
    },
    undetected: { className: 'text-secondary-500 text-xs', label: '미감지' },
};

interface DetectedBadgeProps {
    detected: boolean;
}

function DetectedBadge({ detected }: DetectedBadgeProps) {
    const key = detected ? 'detected' : 'undetected';
    const { className, label } = DETECTED_BADGE_CONFIG[key];
    return (
        <div className="flex items-center gap-1.5">
            <span className={className}>{label}</span>
        </div>
    );
}

interface PatternAccordionItemProps {
    pattern: PatternSummary;
    isVisible: boolean;
    onToggleVisibility: (patternName: string) => void;
}

function PatternAccordionItem({
    pattern,
    isVisible,
    onToggleVisibility,
}: PatternAccordionItemProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleToggleOpen = (): void => {
        setIsOpen(prev => !prev);
    };

    const handleToggleVisibility = (): void => {
        onToggleVisibility(pattern.patternName);
    };

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
                <button
                    type="button"
                    onClick={handleToggleVisibility}
                    className={cn(
                        'shrink-0 rounded p-1 pr-3 transition-colors',
                        isVisible
                            ? 'text-primary-400 hover:text-primary-300'
                            : 'text-secondary-600 hover:text-secondary-400'
                    )}
                    title={isVisible ? '차트에서 숨기기' : '차트에서 보기'}
                >
                    <EyeIcon isVisible={isVisible} />
                </button>
            </div>

            {isOpen ? (
                <div className="bg-secondary-800/60 border-secondary-700 border-t px-3 py-2.5">
                    <div className="mb-2">
                        <DetectedBadge detected={pattern.detected} />
                    </div>
                    <p className="text-secondary-400 text-xs leading-relaxed">
                        {pattern.summary}
                    </p>
                </div>
            ) : null}
        </div>
    );
}

interface SkillAccordionItemProps {
    skill: SkillResult;
}

function SkillAccordionItem({ skill }: SkillAccordionItemProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleToggleOpen = (): void => {
        setIsOpen(prev => !prev);
    };

    return (
        <div className="border-secondary-700 overflow-hidden rounded-md border">
            <button
                type="button"
                aria-expanded={isOpen}
                onClick={handleToggleOpen}
                className="bg-secondary-700/20 hover:bg-secondary-700/40 flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors"
            >
                <span className="text-secondary-300 min-w-0 flex-1 truncate text-xs font-medium">
                    {skill.skillName}
                </span>
                <TrendBadge trend={skill.trend} />
                <ChevronIcon isOpen={isOpen} />
            </button>

            {isOpen ? (
                <div className="bg-secondary-800/60 border-secondary-700 border-t px-3 py-2.5">
                    <p className="text-secondary-400 text-xs leading-relaxed">
                        {skill.summary}
                    </p>
                </div>
            ) : null}
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
                    <span className={cn('text-sm font-medium', colorClass)}>
                        {target.price.toLocaleString()}
                    </span>
                    <span className="text-secondary-500 text-xs">
                        {target.basis}
                    </span>
                </div>
            ))}
        </div>
    );
}

interface AnalysisPanelProps {
    analysis: AnalysisResponse;
    isAnalyzing?: boolean;
    onReanalyze?: () => void;
    onPatternVisibilityChange?: (
        patternName: string,
        isVisible: boolean
    ) => void;
}

export function AnalysisPanel({
    analysis,
    isAnalyzing = false,
    onReanalyze,
    onPatternVisibilityChange,
}: AnalysisPanelProps) {
    const [visiblePatterns, setVisiblePatterns] = useState<Set<string>>(
        new Set()
    );

    const handleTogglePatternVisibility = (patternName: string): void => {
        const willBeVisible = !visiblePatterns.has(patternName);
        setVisiblePatterns(prev => {
            const next = new Set(prev);
            if (prev.has(patternName)) {
                next.delete(patternName);
            } else {
                next.add(patternName);
            }
            return next;
        });
        onPatternVisibilityChange?.(patternName, willBeVisible);
    };

    const hasPatterns = analysis.patternSummaries.length > 0;
    const hasSkillResults = analysis.skillResults.length > 0;

    return (
        <div className="bg-secondary-800 flex flex-col gap-4 rounded-lg p-4">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-secondary-200 text-sm font-semibold">
                        AI 분석
                    </span>
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

            {/* 요약 */}
            <p className="text-secondary-300 text-sm leading-relaxed">
                {analysis.summary}
            </p>

            <div className="border-secondary-700 border-t" />

            {/* 인디케이터 시그널 */}
            {analysis.signals.length > 0 && (
                <div className="flex flex-col gap-2">
                    <span className="text-secondary-500 text-xs font-semibold tracking-wide uppercase">
                        시그널
                    </span>
                    <div className="flex flex-col gap-1.5">
                        {analysis.signals.map((signal, index) => (
                            <SignalItem
                                key={`${signal.type}-${index}`}
                                signal={signal}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* 스킬 시그널 (skillName별 그룹핑) */}
            {analysis.skillSignals.length > 0 && (
                <div className="flex flex-col gap-3">
                    <span className="text-secondary-500 text-xs font-semibold tracking-wide uppercase">
                        패턴 / 스킬
                    </span>
                    {analysis.skillSignals.map(skillSignal => (
                        <div
                            key={skillSignal.skillName}
                            className="flex flex-col gap-1.5"
                        >
                            <span className="text-secondary-400 text-xs font-medium">
                                {skillSignal.skillName}
                            </span>
                            {skillSignal.signals.map((signal, index) => (
                                <SignalItem
                                    key={`${signal.type}-${index}`}
                                    signal={signal}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {/* 패턴 상세 (아코디언) */}
            {hasPatterns && (
                <div className="flex flex-col gap-2">
                    <span className="text-secondary-500 text-xs font-semibold tracking-wide uppercase">
                        차트 패턴
                    </span>
                    <div className="flex flex-col gap-1.5">
                        {analysis.patternSummaries.map(pattern => (
                            <PatternAccordionItem
                                key={pattern.patternName}
                                pattern={pattern}
                                isVisible={visiblePatterns.has(
                                    pattern.patternName
                                )}
                                onToggleVisibility={
                                    handleTogglePatternVisibility
                                }
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* 스킬 상세 (아코디언) */}
            {hasSkillResults && (
                <div className="flex flex-col gap-2">
                    <span className="text-secondary-500 text-xs font-semibold tracking-wide uppercase">
                        스킬 분석
                    </span>
                    <div className="flex flex-col gap-1.5">
                        {analysis.skillResults.map(skill => (
                            <SkillAccordionItem
                                key={skill.skillName}
                                skill={skill}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* 지지/저항 레벨 */}
            {(analysis.keyLevels.support.length > 0 ||
                analysis.keyLevels.resistance.length > 0) && (
                <div className="flex flex-col gap-2">
                    <span className="text-secondary-500 text-xs font-semibold tracking-wide uppercase">
                        주요 레벨
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                        {analysis.keyLevels.resistance.length > 0 && (
                            <div className="flex flex-col gap-1">
                                <span className="text-secondary-500 text-xs">
                                    저항
                                </span>
                                {analysis.keyLevels.resistance.map(level => (
                                    <div
                                        key={`resistance-${level.price}`}
                                        className="flex flex-col"
                                    >
                                        <span className="text-chart-bearish text-sm font-medium">
                                            {level.price.toLocaleString()}
                                        </span>
                                        <span className="text-secondary-600 text-xs">
                                            {level.reason}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {analysis.keyLevels.support.length > 0 && (
                            <div className="flex flex-col gap-1">
                                <span className="text-secondary-500 text-xs">
                                    지지
                                </span>
                                {analysis.keyLevels.support.map(level => (
                                    <div
                                        key={`support-${level.price}`}
                                        className="flex flex-col"
                                    >
                                        <span className="text-chart-bullish text-sm font-medium">
                                            {level.price.toLocaleString()}
                                        </span>
                                        <span className="text-secondary-600 text-xs">
                                            {level.reason}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {analysis.keyLevels.poc !== undefined && (
                        <div className="flex flex-col">
                            <span className="text-secondary-500 text-xs">
                                PoC
                            </span>
                            <span className="text-sm font-medium">
                                {analysis.keyLevels.poc.price.toLocaleString()}
                            </span>
                            <span className="text-secondary-600 text-xs">
                                {analysis.keyLevels.poc.reason}
                            </span>
                        </div>
                    )}
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

            {/* 재분석 버튼 */}
            {onReanalyze !== undefined && (
                <button
                    type="button"
                    onClick={onReanalyze}
                    disabled={isAnalyzing}
                    className="bg-primary-600 hover:bg-primary-700 disabled:bg-primary-600/50 mt-1 w-full rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed"
                >
                    {isAnalyzing ? '분석 중…' : '재분석'}
                </button>
            )}
        </div>
    );
}
