'use client';

import type { ReactNode } from 'react';
import {
    startTransition,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import Link from 'next/link';
import { EyeIcon } from '@/shared/ui/EyeIcon';
import { InfoTooltip } from '@/shared/ui/InfoTooltip';
import { MarkdownText } from '@/shared/ui/MarkdownText';
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
    TierInfoDepth,
    Timeframe,
    Trend,
    Trendline,
    TrendlineDirection,
} from '@y0ngha/siglens-core';
import { HIGH_CONFIDENCE_WEIGHT } from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';
import { isFallbackAnalysis } from '@/entities/chat-message';
import {
    parseStructuredSummary,
    type SkillSummarySection,
} from './utils/parseStructuredSummary';
import { buildExpertAnalysisReport } from './utils/buildExpertAnalysisReport';
import { resolveTrendDisplay } from './utils/trendUtils';
import { resolveStrengthDisplay } from './utils/signalUtils';
import { AnalysisProgress } from './AnalysisProgress';
import { AnalysisToast } from './AnalysisToast';
import { AdBanner } from './AdBanner';
import type { CooldownNotice } from './model/types';
import { TRENDLINE_DIRECTION_LABEL } from '@/shared/lib/trendline';
import { MS_PER_SECOND, SECONDS_PER_MINUTE } from '@/shared/config/time';
import { DEFAULT_RESET_MS as COPY_RESET_MS } from '@/shared/hooks/useCopyToClipboard';
import { formatAnalyzedAt } from '@/shared/lib/formatAnalyzedAt';
import { isAnalysisStale } from '@/entities/analysis';
import { StaleAnalysisBanner } from './StaleAnalysisBanner';

function formatCooldown(ms: number): string {
    const totalSec = Math.ceil(ms / MS_PER_SECOND);
    const minutes = Math.floor(totalSec / SECONDS_PER_MINUTE);
    const seconds = totalSec % SECONDS_PER_MINUTE;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const ENTRY_RECOMMENDATION_LABEL: Record<EntryRecommendation, string> = {
    enter: '지금 진입',
    wait: '관망',
    avoid: '진입 보류',
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
                        진입 의견
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
                            <MarkdownText className="text-secondary-300 text-sm">
                                {value}
                            </MarkdownText>
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
                    <div className="text-secondary-300">
                        <p>
                            AI가 제시한 값을 내부 데이터로 한 번 더 검증·보정한
                            결과예요.
                        </p>
                        <p>
                            실시간 가격 흐름과 어긋난 부분이 있으면 여기서
                            조정돼요.
                        </p>
                        <MarkdownText>{reason}</MarkdownText>
                    </div>
                </InfoTooltip>
            </header>
            {exit !== '' && (
                <MarkdownText className="text-secondary-300 text-sm">
                    {exit}
                </MarkdownText>
            )}
            {riskReward !== '' && (
                <MarkdownText className="text-secondary-400 text-xs">
                    {riskReward}
                </MarkdownText>
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
            <MarkdownText className="text-secondary-400 text-xs">
                {signal.description}
            </MarkdownText>
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
                'rounded border px-2 py-0.5 text-xs font-bold whitespace-nowrap',
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

type ConfidenceLevel = 'high' | 'medium';

const CONFIDENCE_BADGE_CONFIG: Record<
    ConfidenceLevel,
    { className: string; label: string; tooltip: ReactNode }
> = {
    high: {
        className:
            'text-chart-bullish bg-chart-bullish/10 border border-chart-bullish/30',
        label: '높은 신뢰도',
        tooltip: (
            <>
                <p>신뢰도가 높은 패턴이에요.</p>
                <p>AI가 이 패턴을 분명하게 감지했다는 뜻이에요.</p>
            </>
        ),
    },
    medium: {
        className:
            'text-ui-warning bg-ui-warning/10 border border-ui-warning/30',
        label: '중간 신뢰도',
        tooltip: (
            <>
                <p>신뢰도가 중간 정도인 패턴이에요.</p>
                <p>단독으로 보기보다는 다른 지표와 함께 참고하는 게 좋아요.</p>
            </>
        ),
    },
};

interface ConfidenceBadgeProps {
    confidenceWeight: number;
}

function ConfidenceBadge({ confidenceWeight }: ConfidenceBadgeProps) {
    const level: ConfidenceLevel =
        confidenceWeight >= HIGH_CONFIDENCE_WEIGHT ? 'high' : 'medium';
    const { className, label, tooltip } = CONFIDENCE_BADGE_CONFIG[level];

    return (
        <span className="flex items-center">
            <span
                className={cn(
                    'rounded px-1.5 py-0.5 text-xs font-medium',
                    className
                )}
            >
                {label}
            </span>
            <InfoTooltip>{tooltip}</InfoTooltip>
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
            <div className="text-secondary-300">
                <p>가까운 가격대에 여러 지표가 함께 모인 레벨이에요.</p>
                <p>
                    수렴된 지표가 많을수록 그 가격대의 지지·저항 신뢰도가 높다고
                    봐요.
                </p>
            </div>
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
                    <MarkdownText className="text-secondary-400 text-xs">
                        {pattern.summary}
                    </MarkdownText>
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
                    <MarkdownText className="text-secondary-300 text-xs">
                        {section.value}
                    </MarkdownText>
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
                        <MarkdownText className="text-secondary-400 text-xs">
                            {strategy.summary}
                        </MarkdownText>
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

// 방향 enum이 미래에 확장돼 ascending|descending 밖의 값이 들어오면 Record
// 조회는 undefined를 돌려준다. 라벨/색상에 fallback을 둬 undefined-class
// 크래시 없이 중립 표시로 degrade한다.
const TRENDLINE_FALLBACK_LABEL = '추세선';
const TRENDLINE_FALLBACK_COLOR = 'text-secondary-400';
const TRENDLINE_FALLBACK_BG = 'bg-secondary-500';

interface TrendlineItemProps {
    trendline: Trendline;
}

function TrendlineItem({ trendline }: TrendlineItemProps) {
    const label =
        TRENDLINE_DIRECTION_LABEL[trendline.direction] ??
        TRENDLINE_FALLBACK_LABEL;
    const colorClass =
        TRENDLINE_COLOR[trendline.direction] ?? TRENDLINE_FALLBACK_COLOR;
    const bgClass =
        TRENDLINE_BG_COLOR[trendline.direction] ?? TRENDLINE_FALLBACK_BG;

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
            <MarkdownText className="text-secondary-500 text-xs">
                {scenario.condition}
            </MarkdownText>
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
                    <MarkdownText className="text-secondary-500 text-xs">
                        {target.basis}
                    </MarkdownText>
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
    /** 분석 대상 타임프레임. stale 판정 임계값 산정에 사용된다. */
    timeframe: Timeframe;
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
    /** 잠긴 상세 조각. 원본 값은 이 컴포넌트에 전달되지 않는다. */
    lockedInfoDepth?: readonly TierInfoDepth[];
    /** 일반 종목 페이지에서만 잠금 회원가입 안내를 표시한다. */
    showLockedSignup?: boolean;
    /**
     * 이번 분석에 적용된 인디케이터 종류 수.
     * analysis → symbol-page 역방향 의존을 제거하기 위해 prop으로 전달한다.
     */
    indicatorCount?: number;
}

export function AnalysisPanel({
    symbol,
    analysis,
    keyLevels,
    timeframe,
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
    lockedInfoDepth = [],
    showLockedSignup = false,
    indicatorCount = 0,
}: AnalysisPanelProps) {
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
        'idle'
    );
    // SSR/hydration mismatch 방지 — 서버 렌더링 시점의 `new Date()`와
    // 클라이언트 hydration 시점의 시각이 다를 수 있어 stale 평가는 client mount
    // 이후로 미룬다. `now`가 null인 동안에는 배너가 표시되지 않는다.
    const [now, setNow] = useState<Date | null>(null);
    const hasLockedDetails = showLockedSignup && lockedInfoDepth.length > 0;
    const hasLockedPartialDetail =
        hasLockedDetails && lockedInfoDepth.includes('partial_detail');
    const hasLockedActionDetail =
        hasLockedDetails &&
        lockedInfoDepth.some(depth =>
            ['entry', 'stoploss', 'target', 'full_detail'].includes(depth)
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
        if (showProgress || isAnalyzing || hasLockedDetails) return;

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

    // 방어적 기본값 — analysis는 useAnalysis에서 normalizeAnalysisResponse로
    // 정규화되지만, AnalysisPanel은 barrel(index.ts)로 외부에 단독 노출되므로
    // 부분 응답이 직접 전달되는 경우까지 컴포넌트에서 한 번 더 방어한다.
    const patternSummaries = analysis.patternSummaries ?? [];
    const strategyResults = analysis.strategyResults ?? [];
    const indicatorResults = analysis.indicatorResults ?? [];
    const trendlines = analysis.trendlines ?? [];
    const priceTargets = analysis.priceTargets ?? {
        bullish: null,
        bearish: null,
    };

    // keyLevels prop은 ClusteredKeyLevels(analysis 외부 값)이므로 위 정규화로
    // 보장되지 않는다. 컴포넌트 경계에서 support/resistance 배열을 기본값으로
    // 채워 무방비 .length / .map 접근으로 인한 렌더 크래시를 방지한다.
    const supportLevels = keyLevels.support ?? [];
    const resistanceLevels = keyLevels.resistance ?? [];

    const detectedPatterns = patternSummaries.filter(p => p.detected);
    const hasDetectedPatterns = detectedPatterns.length > 0;

    const patternSkillNames = new Set(patternSummaries.map(p => p.skillName));

    // confidence는 표시 가중치이지 포함 게이트가 아니다 — consumer는 표시에
    // confidence를 쓸 수 있으나 그 값으로 결과를 제거(데이터 손실)해서는 안 된다.
    // 따라서 confidence 하한으로 거르지 않고, 패턴으로 이미 표시되는 전략만 중복 제거한다.
    const detectedStrategyResults = strategyResults.filter(
        s => !patternSkillNames.has(s.strategyName)
    );

    const displayedIndicatorResults = indicatorResults.filter(
        r => r.indicatorName !== '' && !patternSkillNames.has(r.indicatorName)
    );

    // stale 여부는 render 시점에만 평가한다 — 인터벌 타이머를 두지 않으므로
    // 사용자 인터랙션 / 신규 분석 / 라우트 변경 등으로 다음 render가 일어나야
    // 배너가 갱신된다. 로딩 상태(isAnalyzing/showProgress)에서는 곧 새 분석으로
    // 교체되므로 stale 배너를 노출하지 않는다.
    // `now`는 client mount 이후에만 값이 채워지므로 SSR/hydration 단계에서는
    // 배너가 노출되지 않는다.
    const showStaleBanner =
        !isAnalyzing &&
        !showProgress &&
        analysis.analyzedAt &&
        onReanalyze !== undefined &&
        now !== null &&
        isAnalysisStale(analysis.analyzedAt, timeframe, now);

    // SSR/hydration mismatch 회피 — 서버에서는 `now`가 null, 클라이언트
    // mount 직후에만 현재 시각을 캡쳐한다. setState를 useEffect 본문에서 직접
    // 호출하는 대신 useEffectEvent로 감싸 React 19 canonical 패턴을 따르고,
    // 본문은 startTransition으로 격리해 lint rule을 만족시킨다
    // (MISTAKES.md §10).
    const captureNow = useEffectEvent((): void => {
        startTransition(() => {
            setNow(new Date());
        });
    });

    useEffect(() => {
        return () => {
            if (copyTimeoutRef.current !== null) {
                clearTimeout(copyTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        captureNow();
    }, [analysis.analyzedAt]);

    return (
        <div className="bg-secondary-800 relative flex flex-col gap-4 rounded-lg p-4">
            {showStaleBanner && (
                <StaleAnalysisBanner
                    onReanalyze={onReanalyze}
                    reanalyzeCooldownMs={reanalyzeCooldownMs ?? 0}
                />
            )}
            <AnalysisToast
                key={cooldownNotice?.nonce}
                notice={cooldownNotice}
            />
            {/* 모바일(<sm)에서는 좌/우 그룹을 세로로 쌓아 정렬을 맞추고, sm+에서만
                양끝 정렬한다. flex-wrap+ml-auto는 초협폭 wrap 시 좌/우가 엇갈리는
                지그재그가 생겨 responsive 스택으로 대체했다. */}
            <div className="flex flex-col gap-y-2 sm:flex-row sm:items-center sm:justify-between">
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
                    {/* free 사용자의 direction(trend)은 core filterAnalysisResult가
                        허용하는 진짜 값이라 그대로 보여준다. 다만 FALLBACK_ANALYSIS
                        placeholder처럼 서사가 없는 응답은 normalizeAnalysisResponse가
                        trend를 'neutral'로 채워 넣은 fabricated 값이므로, 그 경우엔
                        배지를 아예 숨겨 가짜 신호를 노출하지 않는다. */}
                    {!isFallbackAnalysis(analysis) && (
                        <TrendBadge trend={analysis.trend} />
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:justify-end">
                    {analysis.analyzedAt && (
                        <time
                            dateTime={analysis.analyzedAt}
                            className="text-secondary-500 text-xs whitespace-nowrap"
                        >
                            {formatAnalyzedAt(analysis.analyzedAt)}
                        </time>
                    )}
                    {!hasLockedDetails && (
                        <button
                            type="button"
                            onClick={handleCopyReport}
                            disabled={showProgress || isAnalyzing}
                            className={cn(
                                // [공통 스타일]
                                'focus-visible:ring-primary-500 rounded border px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:outline-none',

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
                    )}
                    {!hasLockedPartialDetail && (
                        <div className="text-secondary-400 flex items-center gap-1.5 text-xs whitespace-nowrap">
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
                    )}
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

            {/* 분석 중에는 진행 인디케이터로 대체.
                isAnalyzing이 false로 떨어진 직후에도 마무리 애니메이션이 끝날 때까지
                showProgress=true가 유지되어 인디케이터가 잠시 더 노출된다. */}
            {showProgress ? (
                <AnalysisProgress
                    phaseIndex={progressPhaseIndex}
                    tipIndex={progressTipIndex}
                    isFreeUser={isFreeUser}
                />
            ) : (
                // TrendBadge와 동일한 신호(isFallbackAnalysis)로 가드한다.
                // 서사가 없는 응답은 normalizeAnalysisResponse가 summary를 빈
                // 문자열로 채워 넣으므로 그 fabricated 빈 값을 렌더하지 않는다.
                // free 사용자의 진짜 summary는 direction과 함께 허용된 필드이므로
                // 그대로 보여준다.
                !isFallbackAnalysis(analysis) && (
                    <MarkdownText className="text-secondary-300 text-sm">
                        {analysis.summary}
                    </MarkdownText>
                )
            )}

            {/* 마무리 애니메이션이 끝나기 전(showProgress=true) 동안에는 노출하지 않는다.
                캐시 히트로 분석 결과가 즉시 도착해도 사용자가 5단계를 모두 본 뒤에야
                결과가 한 번에 드러나도록 하기 위함이다. */}
            {!showProgress && (
                <>
                    {hasLockedDetails && (
                        <div className="border-secondary-700 relative overflow-hidden rounded-lg border p-4">
                            <div
                                className="pointer-events-none blur-sm select-none"
                                aria-hidden
                            >
                                <div className="bg-secondary-700/60 h-3 w-2/5 rounded" />
                                <div className="bg-secondary-700/40 mt-3 h-3 w-full rounded" />
                                <div className="bg-secondary-700/40 mt-2 h-3 w-4/5 rounded" />
                            </div>
                            <div className="bg-secondary-900/55 absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
                                <p className="text-secondary-100 text-sm font-semibold">
                                    상세 분석과 매매 전략은 회원에게 제공됩니다.
                                </p>
                                <Link
                                    href="/signup"
                                    className="bg-primary-600 hover:bg-primary-700 rounded px-3 py-1.5 text-sm font-semibold text-white transition-colors"
                                >
                                    회원가입
                                </Link>
                            </div>
                        </div>
                    )}
                    <div className="border-secondary-700 border-t" />

                    {!hasLockedActionDetail &&
                        analysis.actionRecommendation && (
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

                    {(supportLevels.length > 0 ||
                        resistanceLevels.length > 0 ||
                        keyLevels.poc !== undefined) && (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center">
                                <span className="text-secondary-500 text-xs font-semibold tracking-wide uppercase">
                                    주요 레벨
                                </span>
                                <KeyLevelsHeaderInfo />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {resistanceLevels.length > 0 && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-secondary-500 text-xs">
                                            저항
                                        </span>
                                        {resistanceLevels.map(level => (
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
                                {supportLevels.length > 0 && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-secondary-500 text-xs">
                                            지지
                                        </span>
                                        {supportLevels.map(level => (
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

                    {trendlines.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="text-secondary-500 text-xs font-semibold tracking-wide uppercase">
                                    추세선
                                </span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {trendlines.map(trendline => (
                                    <TrendlineItem
                                        key={`trendline-${trendline.direction}-${trendline.start.time}-${trendline.end.time}`}
                                        trendline={trendline}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {((priceTargets.bullish?.targets.length ?? 0) > 0 ||
                        (priceTargets.bearish?.targets.length ?? 0) > 0) && (
                        <div className="flex flex-col gap-2">
                            <span className="text-secondary-500 text-xs font-semibold tracking-wide uppercase">
                                가격 목표
                            </span>
                            <div className="grid grid-cols-2 gap-3">
                                <PriceScenarioSection
                                    label="상승"
                                    scenario={priceTargets.bullish}
                                    colorClass="text-chart-bullish"
                                />
                                <PriceScenarioSection
                                    label="하락"
                                    scenario={priceTargets.bearish}
                                    colorClass="text-chart-bearish"
                                />
                            </div>
                        </div>
                    )}

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

            {!showProgress && (
                <AdBanner
                    isFreeUser={isFreeUser}
                    slot="analysis-panel-bottom"
                />
            )}
        </div>
    );
}
