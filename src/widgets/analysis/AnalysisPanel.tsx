'use client';

import { useTranslations } from 'next-intl';
import { useSkillLabel } from '@/shared/i18n/skillLabel';
import {
    startTransition,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
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
import { LABEL_KO } from '@/shared/lib/typographyStyles';
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
import { TRENDLINE_DIRECTION_LABEL_KEY } from '@/shared/lib/trendline';
import { MS_PER_SECOND, SECONDS_PER_MINUTE } from '@/shared/config/time';
import { DEFAULT_RESET_MS as COPY_RESET_MS } from '@/shared/hooks/useCopyToClipboard';
import { formatAnalyzedAt } from '@/shared/lib/formatAnalyzedAt';
import { isAnalysisStale } from '@/entities/analysis';
import { StaleAnalysisBanner } from './StaleAnalysisBanner';
import { PlanCheckBlock } from './PlanCheckBlock';

function formatCooldown(ms: number): string {
    const totalSec = Math.ceil(ms / MS_PER_SECOND);
    const minutes = Math.floor(totalSec / SECONDS_PER_MINUTE);
    const seconds = totalSec % SECONDS_PER_MINUTE;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const ENTRY_RECOMMENDATION_LABEL: Record<EntryRecommendation, string> = {
    enter: 'entryRecommendation.enter',
    wait: 'entryRecommendation.wait',
    avoid: 'entryRecommendation.avoid',
};

const ENTRY_RECOMMENDATION_COLOR: Record<EntryRecommendation, string> = {
    enter: 'bg-chart-bullish/10 text-ui-success-text border border-chart-bullish/30',
    wait: 'bg-ui-warning/10 text-ui-warning-text border border-ui-warning/30',
    avoid: 'bg-chart-bearish/10 text-ui-danger-text border border-chart-bearish/30',
};

type ActionRecommendationTextKey =
    | 'positionAnalysis'
    | 'entry'
    | 'exit'
    | 'riskReward';

interface ActionRecommendationField {
    /** `widgets.analysis.sectionLabel` 기준 상대 키. */
    labelKey: string;
    key: ActionRecommendationTextKey;
}

const ACTION_RECOMMENDATION_FIELDS: readonly ActionRecommendationField[] = [
    { labelKey: 'currentPosition', key: 'positionAnalysis' },
    { labelKey: 'entryStrategy', key: 'entry' },
    { labelKey: 'exitStrategy', key: 'exit' },
    { labelKey: 'riskReward', key: 'riskReward' },
];

interface ActionRecommendationSectionProps {
    rec: ActionRecommendation;
    isChartVisible: boolean;
    /**
     * 없으면 차트 토글 버튼을 **렌더하지 않는다.**
     *
     * 공유 페이지(`views/share/kindPanelRegistry`)는 이 핸들러를 넘기지 않고,
     * 그 주석은 "핸들러가 없으면 패널이 그 UI를 숨긴다"고 적혀 있었다 — 사실이
     * 아니었다. 버튼은 무조건 렌더됐고 `onToggleChart?.()`가 아무것도 하지
     * 않아, 눌러도 반응 없는 컨트롤이 공유 화면에 남아 있었다(감사 실측:
     * `aria-label="차트 가격선 숨기기"`, 클릭 2회 후 DOM 바이트 동일).
     * 게다가 그 버튼이 숨기겠다고 말하는 가격선은 `StockChart`가 그리는데
     * 공유 페이지는 `ShareCandlestickChart`를 쓰므로 애초에 존재하지 않는다.
     */
    onToggleChart?: () => void;
}

function ActionRecommendationSection({
    rec,
    isChartVisible,
    onToggleChart,
}: ActionRecommendationSectionProps) {
    const t = useTranslations('widgets.analysis');
    const tSection = useTranslations('widgets.analysis.sectionLabel');
    const tLabel = useTranslations('shared.enumLabel');
    return (
        <div className="flex flex-col gap-2 rounded-lg bg-secondary-700/30 p-3">
            {rec.entryRecommendation !== undefined && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-secondary-500">
                        {t('AnalysisPanel.edb872')}
                    </span>
                    <span
                        className={cn(
                            'rounded px-2 py-0.5 text-xs font-semibold',
                            ENTRY_RECOMMENDATION_COLOR[rec.entryRecommendation]
                        )}
                    >
                        {tLabel(
                            ENTRY_RECOMMENDATION_LABEL[rec.entryRecommendation]
                        )}
                    </span>
                </div>
            )}
            <div className="flex items-center justify-between">
                <span className={LABEL_KO}>{t('AnalysisPanel.034be7')}</span>
                {onToggleChart !== undefined && (
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
                                ? t('AnalysisPanel.f744e1')
                                : t('AnalysisPanel.cfbeac')
                        }
                    >
                        <EyeIcon isVisible={isChartVisible} />
                        {t('AnalysisPanel.06c8ed')}
                    </button>
                )}
            </div>
            <div className="flex flex-col gap-2">
                {ACTION_RECOMMENDATION_FIELDS.map(({ labelKey, key }) => {
                    const value = rec[key];
                    if (typeof value !== 'string' || value === '') return null;
                    return (
                        <div key={labelKey} className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-secondary-500">
                                {tSection(labelKey)}
                            </span>
                            <MarkdownText className="text-sm text-secondary-300">
                                {value}
                            </MarkdownText>
                        </div>
                    );
                })}
            </div>
            <ReconciledLevelsBlockFromRec rec={rec} />
            <PlanCheckBlock planCheck={rec.planCheck} />
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
    const t = useTranslations('widgets.analysis');
    return (
        <section className="mt-1 flex flex-col gap-1 rounded-lg border border-secondary-700 bg-secondary-800/40 px-3 py-2">
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

/** hasLockedActionDetail이 매매 전략 섹션을 잠그는 TierInfoDepth 값들. */
const LOCKED_ACTION_INFO_DEPTHS: readonly TierInfoDepth[] = [
    'entry',
    'stoploss',
    'target',
    'full_detail',
];

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

const SIGNAL_TYPE_LABEL: Record<AnalysisSignalType, string> = {
    skill: 'skill',
};

interface SignalItemProps {
    signal: AnalysisSignal;
    typeLabel?: string;
}

function SignalItem({ signal, typeLabel }: SignalItemProps) {
    const tSection = useTranslations('widgets.analysis.sectionLabel');
    const tStrength = useTranslations('widgets.analysis.signalStrength');
    const strengthDisplay = resolveStrengthDisplay(signal.strength);

    return (
        <div className="flex flex-col gap-1.5 rounded bg-secondary-700/40 px-3 py-2">
            <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-secondary-300">
                    {typeLabel ?? tSection(SIGNAL_TYPE_LABEL[signal.type])}
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
        </div>
    );
}

interface TrendBadgeProps {
    trend: Trend | null | undefined;
}

function TrendBadge({ trend }: TrendBadgeProps) {
    const tLabel = useTranslations('shared.enumLabel');
    const display = resolveTrendDisplay(trend, tLabel);
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

/**
 * "내 평단 기준으로 분석했어요" 투명성 배지 — personalized-analysis-by-position-bucket
 * spec, Subsystem C. 서버(SSE 분석 라우트)가 THIS 제출을 실제로 포지션
 * 버킷 캐시 키(`:pos=<bucket>`)로 조회/제출했을 때만 렌더된다(호출부 게이트:
 * `isPersonalized` prop — 서버-authoritative 플래그, `useAnalysis`가
 * SSE 라우트의 응답을 그대로 미러링해 threading한다).
 *
 * 과거에는 `tier !== 'free' && holding != null`(홀딩의 단순 존재 여부)로
 * 게이트했으나, 4건의 독립 사전-PR 감사에서 동일한 정직성 문제가 지적됐다: 홀딩이
 * 있어도 (a) 신선한 회원 로드 시 tier hydration이 끝나기 전까지 화면엔 아직
 * SSR의 공유 no-bucket shell이 떠 있거나, (b) 서버 쿼트 읽기 실패/평단 값
 * degenerate로 `resolveHoldingPositionBucket`이 `undefined`(no-bucket)로
 * degrade하는 경우, 배지가 "개인화됐다"고 거짓 주장을 하는 두 창이 있었다.
 * 색상만으로 의미를 전달하지 않도록 실제 문구를 포함한 텍스트 배지로 구성했다.
 */
function PersonalizedAnalysisBadge() {
    const t = useTranslations('widgets.analysis');
    return (
        <span
            data-testid="personalized-analysis-badge"
            className="inline-flex items-center gap-1 rounded border-primary-400/40 bg-primary-400/10 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-primary-300"
        >
            {t('AnalysisPanel.2c520f')}
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

// 색상만 모듈 상수로 남기고 문구는 `widgets.analysis.panel` 키로 옮겼다.
const CONFIDENCE_BADGE_CLASS: Record<ConfidenceLevel, string> = {
    high: 'text-ui-success-text bg-chart-bullish/10 border border-chart-bullish/30',
    medium: 'text-ui-warning-text bg-ui-warning/10 border border-ui-warning/30',
};

const CONFIDENCE_BADGE_KEY: Record<
    ConfidenceLevel,
    { label: string; tip1: string; tip2: string }
> = {
    high: {
        label: 'confidenceHigh',
        tip1: 'confidenceHighTip1',
        tip2: 'confidenceHighTip2',
    },
    medium: {
        label: 'confidenceMedium',
        tip1: 'confidenceMediumTip1',
        tip2: 'confidenceMediumTip2',
    },
};

interface ConfidenceBadgeProps {
    confidenceWeight: number;
}

function ConfidenceBadge({ confidenceWeight }: ConfidenceBadgeProps) {
    const tPanel = useTranslations('widgets.analysis.panel');
    const level: ConfidenceLevel =
        confidenceWeight >= HIGH_CONFIDENCE_WEIGHT ? 'high' : 'medium';
    const key = CONFIDENCE_BADGE_KEY[level];

    return (
        <span className="flex items-center">
            <span
                className={cn(
                    'rounded px-1.5 py-0.5 text-xs font-medium',
                    CONFIDENCE_BADGE_CLASS[level]
                )}
            >
                {tPanel(key.label)}
            </span>
            <InfoTooltip>
                <p>{tPanel(key.tip1)}</p>
                <p>{tPanel(key.tip2)}</p>
            </InfoTooltip>
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
                {level.sources.map(source => (
                    <div
                        key={`${source.price}-${source.reason}`}
                        className="flex items-baseline gap-2 whitespace-nowrap"
                    >
                        <span className="shrink-0 text-secondary-300">
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
    const t = useTranslations('widgets.analysis');
    return (
        <InfoTooltip>
            <div className="text-secondary-300">
                <p>{t('AnalysisPanel.b321c3')}</p>
                <p>{t('AnalysisPanel.d39704')}</p>
            </div>
        </InfoTooltip>
    );
}

interface PatternAccordionItemProps {
    pattern: PatternResult;
    /**
     * confidence 정보 깊이가 잠긴 free 티어에서는 confidenceWeight가 0으로
     * 마스킹되어 도착한다. 0을 그대로 ConfidenceBadge에 넘기면 'medium'으로
     * 오표시되므로, 잠긴 경우 배지 자체를 숨긴다.
     */
    showConfidence: boolean;
}

function PatternAccordionItem({
    pattern,
    showConfidence,
}: PatternAccordionItemProps) {
    const t = useTranslations('widgets.analysis');
    const skillLabel = useSkillLabel();
    const [isOpen, setIsOpen] = useState(false);

    const handleToggleOpen = (): void => {
        setIsOpen(prev => !prev);
    };

    const primaryLabel =
        pattern.renderConfig?.label ?? t('AnalysisPanel.fb0cf0');
    const keyPrices = pattern.keyPrices ?? [];

    return (
        <div className="overflow-hidden rounded-lg border border-secondary-700">
            <div className="flex w-full items-center bg-secondary-700/20 transition-colors hover:bg-secondary-700/40">
                <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={handleToggleOpen}
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-secondary-300">
                        {skillLabel(pattern.skillName)}
                    </span>
                    <TrendBadge trend={pattern.trend} />
                    <ChevronIcon isOpen={isOpen} />
                </button>
                {showConfidence && (
                    <span className="shrink-0 pr-2">
                        <ConfidenceBadge
                            confidenceWeight={pattern.confidenceWeight}
                        />
                    </span>
                )}
            </div>

            {isOpen ? (
                <div className="flex flex-col gap-2.5 border-t border-secondary-700 bg-secondary-800/60 px-3 py-2.5">
                    <MarkdownText className="text-xs text-secondary-400">
                        {pattern.summary}
                    </MarkdownText>
                    {keyPrices.length > 0 && (
                        <div className="flex flex-col gap-1">
                            <span className={LABEL_KO}>
                                {t('AnalysisPanel.251228')}
                            </span>
                            <div className="flex flex-col gap-1">
                                {keyPrices.map((kp, index) => (
                                    <div
                                        key={`keyprice-${kp.label}`}
                                        className="flex items-baseline gap-2"
                                    >
                                        <span className="w-16 shrink-0 text-xs text-secondary-500">
                                            {index === 0
                                                ? primaryLabel
                                                : kp.label}
                                        </span>
                                        <span className="text-xs font-medium text-secondary-200 tabular-nums">
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
                    <span className={LABEL_KO}>{section.label}</span>
                    <MarkdownText className="text-xs text-secondary-300">
                        {section.value}
                    </MarkdownText>
                </div>
            ))}
        </div>
    );
}

interface StrategyAccordionItemProps {
    strategy: StrategyResult;
    /** free 티어의 마스킹된 confidenceWeight(0) 오표시 방지. PatternAccordionItem 참조. */
    showConfidence: boolean;
}

function StrategyAccordionItem({
    strategy,
    showConfidence,
}: StrategyAccordionItemProps) {
    const skillLabel = useSkillLabel();
    const [isOpen, setIsOpen] = useState(false);

    const handleToggleOpen = (): void => {
        setIsOpen(prev => !prev);
    };

    const sections = parseStructuredSummary(strategy.summary);

    return (
        <div className="overflow-hidden rounded-lg border border-secondary-700">
            <div className="flex w-full items-center bg-secondary-700/20 transition-colors hover:bg-secondary-700/40">
                <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={handleToggleOpen}
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-secondary-300">
                        {skillLabel(strategy.strategyName)}
                    </span>
                    <TrendBadge trend={strategy.trend} />
                    <ChevronIcon isOpen={isOpen} />
                </button>
                {showConfidence && (
                    <span className="shrink-0 pr-2">
                        <ConfidenceBadge
                            confidenceWeight={strategy.confidenceWeight}
                        />
                    </span>
                )}
            </div>

            {isOpen ? (
                <div className="border-t border-secondary-700 bg-secondary-800/60 px-3 py-2.5">
                    {sections !== null ? (
                        <StructuredSkillSummary sections={sections} />
                    ) : (
                        <MarkdownText className="text-xs text-secondary-400">
                            {strategy.summary}
                        </MarkdownText>
                    )}
                </div>
            ) : null}
        </div>
    );
}

const TRENDLINE_COLOR: Record<TrendlineDirection, string> = {
    ascending: 'text-ui-success-text',
    descending: 'text-ui-danger-text',
};

const TRENDLINE_BG_COLOR: Record<TrendlineDirection, string> = {
    ascending: 'bg-chart-bullish',
    descending: 'bg-chart-bearish',
};

// 방향 enum이 미래에 확장돼 ascending|descending 밖의 값이 들어오면 Record
// 조회는 undefined를 돌려준다. 라벨/색상에 fallback을 둬 undefined-class
// 크래시 없이 중립 표시로 degrade한다.
const TRENDLINE_FALLBACK_COLOR = 'text-secondary-400';
const TRENDLINE_FALLBACK_BG = 'bg-secondary-500';

interface TrendlineItemProps {
    trendline: Trendline;
}

function TrendlineItem({ trendline }: TrendlineItemProps) {
    const tTrendline = useTranslations('shared.lib.trendline');
    const label = tTrendline(
        TRENDLINE_DIRECTION_LABEL_KEY[trendline.direction] ?? 'fallback'
    );
    const colorClass =
        TRENDLINE_COLOR[trendline.direction] ?? TRENDLINE_FALLBACK_COLOR;
    const bgClass =
        TRENDLINE_BG_COLOR[trendline.direction] ?? TRENDLINE_FALLBACK_BG;

    return (
        <div className="flex items-center gap-2 rounded bg-secondary-700/40 px-3 py-2">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', bgClass)} />
            <span className={cn('text-xs font-medium', colorClass)}>
                {label}
            </span>
            <span className="ml-auto text-xs text-secondary-500 tabular-nums">
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
            <MarkdownText className="text-xs text-secondary-500">
                {scenario.condition}
            </MarkdownText>
            {scenario.targets.map(target => (
                <div
                    key={`target-${target.price}`}
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
                    <MarkdownText className="text-xs text-secondary-500">
                        {target.basis}
                    </MarkdownText>
                </div>
            ))}
        </div>
    );
}

function getReanalyzeLabel(
    isAnalyzing: boolean,
    cooldownMs: number,
    tPanel: (key: string, values?: Record<string, string>) => string
): string {
    if (isAnalyzing) return tPanel('analyzing');
    if (cooldownMs > 0)
        return tPanel('reanalyzeCooldown', { v0: formatCooldown(cooldownMs) });
    return tPanel('reanalyze');
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
    const t = useTranslations('widgets.analysis');
    const tPanel = useTranslations('widgets.analysis.panel');
    const isCoolingDown = reanalyzeCooldownMs > 0;
    const isDisabled = isAnalyzing || isCoolingDown;
    const label = getReanalyzeLabel(isAnalyzing, reanalyzeCooldownMs, tPanel);
    return (
        <button
            type="button"
            onClick={onReanalyze}
            disabled={isDisabled}
            aria-disabled={isDisabled}
            title={isCoolingDown ? t('AnalysisPanel.550fe5') : undefined}
            className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white tabular-nums transition-colors hover:bg-primary-700 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-primary-600/40 disabled:text-secondary-300"
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
    /**
     * 잠긴 상세 조각. 원본 값은 이 컴포넌트에 전달되지 않는다.
     * SSR·hydration 이전에도(initialLockedInfoDepth 경유) 채워질 수 있고,
     * 이 배열이 비어있지 않은 것만으로 게이트된 필드(리스크 배지·매매 전략·
     * 주요 레벨)를 숨긴다. tier hydration 완료 여부에는 의존하지 않으므로,
     * 크롤러를 포함한 첫 SSR 페인트부터 fabricated 값이 노출되지 않는다.
     */
    lockedInfoDepth?: readonly TierInfoDepth[];
    /**
     * 이번 분석에 적용된 인디케이터 종류 수.
     * analysis → symbol-page 역방향 의존을 제거하기 위해 prop으로 전달한다.
     */
    indicatorCount?: number;
    /**
     * 회원이 적용받는 전체 차트 패턴 + 전략 스킬 카탈로그 수. free 안내 카드에서
     * "회원가입 후 N개 스킬" 문구에 사용한다.
     */
    skillCount?: number;
    /**
     * 서버(SSE 분석 라우트)가 THIS 제출에서 실제로 개인화(포지션 버킷)
     * 캐시 키를 사용했는지 여부 — personalized-analysis 투명성 배지(§FIX 2)의
     * 유일한 게이트. `useAnalysis`가 라우트의 `personalized`
     * 응답 필드를 그대로 threading한다. 미전달 시 `false`로 취급해 배지를 숨긴다
     * (하위 호환 — 이 prop을 모르는 기존 호출부/테스트는 안전하게 배지 없음).
     */
    isPersonalized?: boolean;
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
    indicatorCount = 0,
    skillCount = 0,
    isPersonalized = false,
}: AnalysisPanelProps) {
    const tPanel = useTranslations('widgets.analysis.panel');
    const t = useTranslations('widgets.analysis');
    const tLabel = useTranslations('shared.enumLabel');
    const tReport = useTranslations('widgets.analysis.expertReport');
    const skillLabel = useSkillLabel();
    // 폴백 판정의 sentinel — `buildFallbackAnalysis`와 같은 문구여야 한다.
    const fallbackSummary = useTranslations('entities.chat-message.fallback')(
        'unavailable'
    );
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
        'idle'
    );
    // SSR/hydration mismatch 방지 — 서버 렌더링 시점의 `new Date()`와
    // 클라이언트 hydration 시점의 시각이 다를 수 있어 stale 평가는 client mount
    // 이후로 미룬다. `now`가 null인 동안에는 배너가 표시되지 않는다.
    const [now, setNow] = useState<Date | null>(null);
    const hasLockedDetails = lockedInfoDepth.length > 0;
    const hasLockedPartialDetail =
        hasLockedDetails && lockedInfoDepth.includes('partial_detail');
    const hasLockedActionDetail =
        hasLockedDetails &&
        lockedInfoDepth.some(depth =>
            LOCKED_ACTION_INFO_DEPTHS.includes(depth)
        );
    // free 티어는 스킬 감지 결과(패턴/전략)는 보지만 confidence 정보 깊이는
    // 잠겨 confidenceWeight가 0으로 마스킹되어 온다. 배지를 숨겨 0을 'medium'
    // 신뢰도로 오표시하는 것을 막는다.
    const hasLockedConfidence =
        hasLockedDetails && lockedInfoDepth.includes('confidence');
    // personalized-analysis 투명성 배지(§FIX 2) 노출 게이트. 서버-authoritative
    // `isPersonalized` 플래그가 유일한 진실값이다 — 회원의 홀딩 존재 여부가 아니라
    // 서버가 THIS 제출에서 실제로 포지션 버킷 캐시 키를 썼는지만 본다(위
    // `PersonalizedAnalysisBadge` 주석 참조). isFallbackAnalysis도 함께
    // 배제한다 — 서사가 없는 placeholder 응답에 "내 평단 기준으로 분석했어요"라고
    // 말하는 건 오해를 준다(TrendBadge·summary와 동일한 신호로 가드).
    const showPersonalizedBadge =
        isPersonalized && !isFallbackAnalysis(analysis, fallbackSummary);
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

        // Clipboard API 부재는 try 안에서 throw하지 않고 먼저 걸러낸다.
        // React Compiler는 try/catch 안의 ThrowStatement를 아직 컴파일하지 못해
        // (BuildHIR: Support ThrowStatement inside of try/catch) 이 컴포넌트 전체가
        // 자동 메모화 대상에서 빠졌다. 동작은 동일하고(실패 상태 + 리셋 타이머),
        // 컴파일러가 이 컴포넌트를 최적화할 수 있게 된다.
        if (typeof navigator === 'undefined' || !navigator.clipboard) {
            setCopyState('failed');
            resetCopyStateLater();
            return;
        }

        try {
            const report = buildExpertAnalysisReport({
                tReport,
                symbol,
                analysis,
                keyLevels,
                // extract.mjs의 동적 키 탐지는 "이 파일 안에서 번역자를 직접
                // 호출하는 패턴"만 본다 — `tLabel`을 그대로 넘기면(참조 전달)
                // 호출부가 다른 파일(buildExpertAnalysisReport.ts)이라 감지되지
                // 않아 `shared.enumLabel`이 이 라우트의 클라이언트 번들에서
                // 빠진다. 얇은 위임 클로저로 `tLabel(...)` 호출을 이 파일
                // 안에 남긴다(sentimentDisplay.ts의 SENTIMENT_LABEL_KEY export
                // 주석 참고 — 동일한 문제·동일한 해법).
                t: (key, values) => tLabel(key, values),
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
        <div className="relative flex flex-col gap-4 rounded-lg bg-secondary-800 p-4">
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
                    <span className="text-sm font-semibold text-secondary-200">
                        {t('AnalysisPanel.f0cdeb')}
                    </span>
                    {isAnalyzing && (
                        <span
                            className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary-400"
                            aria-hidden
                        />
                    )}
                    {/* free 사용자의 direction(trend)은 core filterAnalysisResult가
                        허용하는 진짜 값이라 그대로 보여준다. 다만 FALLBACK_ANALYSIS
                        placeholder처럼 서사가 없는 응답은 normalizeAnalysisResponse가
                        trend를 'neutral'로 채워 넣은 fabricated 값이므로, 그 경우엔
                        배지를 아예 숨겨 가짜 신호를 노출하지 않는다. */}
                    {!isFallbackAnalysis(analysis, fallbackSummary) && (
                        <TrendBadge trend={analysis.trend} />
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:justify-end">
                    {showPersonalizedBadge && <PersonalizedAnalysisBadge />}
                    {analysis.analyzedAt && (
                        <time
                            dateTime={analysis.analyzedAt}
                            className="text-xs whitespace-nowrap text-secondary-400"
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
                                'focus-visible:ring-primary-500 min-h-11 touch-manipulation rounded border px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:outline-none',

                                // [1. 로딩/분석 중 상태]
                                (showProgress || isAnalyzing) &&
                                    'border-secondary-700 text-secondary-500 cursor-not-allowed',

                                // [2. 일반 상태 (진행 중이 아닐 때만 적용)]
                                !showProgress &&
                                    !isAnalyzing && {
                                        'border-primary-400/40 bg-primary-400/10 text-primary-300':
                                            copyState === 'copied',
                                        'border-chart-bearish/40 bg-chart-bearish/10 text-ui-danger-text':
                                            copyState === 'failed',
                                        'border-border-control text-secondary-300 hover:border-primary-500 hover:text-secondary-100':
                                            copyState === 'idle',
                                    }
                            )}
                            title={
                                showProgress || isAnalyzing
                                    ? t('AnalysisPanel.39c545')
                                    : t('AnalysisPanel.32f681')
                            }
                        >
                            {copyState === 'copied' &&
                                t('AnalysisPanel.e5c85b')}
                            {copyState === 'failed' &&
                                t('AnalysisPanel.e815ab')}
                            {copyState === 'idle' && t('AnalysisPanel.32f681')}
                        </button>
                    )}
                    {!hasLockedPartialDetail && (
                        <div className="flex items-center gap-1.5 text-xs whitespace-nowrap text-secondary-400">
                            <span>{t('AnalysisPanel.720097')}</span>
                            <span
                                className={cn(
                                    'font-semibold',
                                    RISK_LEVEL_COLOR[analysis.riskLevel]
                                )}
                            >
                                {tLabel(RISK_LEVEL_KEY[analysis.riskLevel])}
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
            {/* 문장이 `개 스킬 감지 · 39종 인디케이터 적용`처럼 한글이 대부분이라
                모노를 쓸 수 없다 — Geist Mono에 한글 글리프가 없어 OS 폰트로 조용히
                폴백한다. 숫자 폭만 고정하면 되므로 tabular 숫자로 바꾼다. */}
            <p className="text-xs text-secondary-500 tabular-nums">
                {/* free 티어는 스킬이 그룹당 소수만 샘플되어 감지 개수가 0일 수
                    있으므로, 오해를 주지 않도록 개수 세그먼트를 숨기고 인디케이터
                    적용 수만 노출한다. 회원가입 안내는 아래 업셀 카드가 담당한다. */}
                {!hasLockedDetails && (
                    <>
                        {t('AnalysisPanel.c80f22', {
                            v0:
                                detectedPatterns.length +
                                detectedStrategyResults.length,
                        })}
                    </>
                )}
                {t('AnalysisPanel.911acb', { v0: indicatorCount })}
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
                !isFallbackAnalysis(analysis, fallbackSummary) && (
                    <MarkdownText className="text-sm text-secondary-300">
                        {analysis.summary}
                    </MarkdownText>
                )
            )}

            {/* 마무리 애니메이션이 끝나기 전(showProgress=true) 동안에는 노출하지 않는다.
                캐시 히트로 분석 결과가 즉시 도착해도 사용자가 5단계를 모두 본 뒤에야
                결과가 한 번에 드러나도록 하기 위함이다. */}
            {!showProgress && (
                <>
                    {/* free 티어의 상세 잠금 안내와 스킬 샘플 안내는 패널 하단의
                        단일 업셀 카드(아래)로 통합했다. 회원가입 CTA를 한 번만
                        노출해 중복을 없앤다. */}
                    <div className="border-t border-secondary-700" />

                    {!hasLockedActionDetail &&
                        analysis.actionRecommendation && (
                            <ActionRecommendationSection
                                rec={analysis.actionRecommendation}
                                isChartVisible={actionPricesVisible}
                                // 화살표 함수를 무조건 넘기면 아래 섹션의
                                // "핸들러가 없으면 버튼을 숨긴다" 게이트가
                                // 영원히 발동하지 않는다 — 소비자가 핸들러를
                                // 안 준 것을 여기서 지워버리기 때문이다.
                                onToggleChart={
                                    onActionPricesVisibilityChange === undefined
                                        ? undefined
                                        : () =>
                                              onActionPricesVisibilityChange(
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
                                <span className={LABEL_KO}>
                                    {t('AnalysisPanel.5ec98c')}
                                </span>
                                <KeyLevelsHeaderInfo />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {resistanceLevels.length > 0 && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-secondary-500">
                                            {t('AnalysisPanel.d930e0')}
                                        </span>
                                        {resistanceLevels.map(level => (
                                            <div
                                                key={`resistance-${level.price}`}
                                                className="flex flex-col"
                                            >
                                                <span className="text-sm font-medium text-ui-danger-text">
                                                    {level.price.toLocaleString(
                                                        undefined,
                                                        {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        }
                                                    )}
                                                </span>
                                                <span className="inline-flex items-center text-xs text-secondary-500">
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
                                        <span className="text-xs text-secondary-500">
                                            {t('AnalysisPanel.8da27a')}
                                        </span>
                                        {supportLevels.map(level => (
                                            <div
                                                key={`support-${level.price}`}
                                                className="flex flex-col"
                                            >
                                                <span className="text-sm font-medium text-ui-success-text">
                                                    {level.price.toLocaleString(
                                                        undefined,
                                                        {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                        }
                                                    )}
                                                </span>
                                                <span className="inline-flex items-center text-xs text-secondary-500">
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
                                    <span className="text-xs text-secondary-500">
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
                                    <span className="text-xs text-secondary-500">
                                        {keyLevels.poc.reason}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {trendlines.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className={LABEL_KO}>
                                    {t('AnalysisPanel.0b5eb6')}
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
                            <span className={LABEL_KO}>
                                {t('AnalysisPanel.31f83c')}
                            </span>
                            <div className="grid grid-cols-2 gap-3">
                                <PriceScenarioSection
                                    label={t('AnalysisPanel.3dc47b')}
                                    scenario={priceTargets.bullish}
                                    colorClass="text-ui-success-text"
                                />
                                <PriceScenarioSection
                                    label={t('AnalysisPanel.79282c')}
                                    scenario={priceTargets.bearish}
                                    colorClass="text-ui-danger-text"
                                />
                            </div>
                        </div>
                    )}

                    {displayedIndicatorResults.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <span className={LABEL_KO}>
                                {t('AnalysisPanel.2a1bed')}
                            </span>
                            <div className="flex flex-col gap-1.5">
                                {displayedIndicatorResults.map(
                                    indicatorResult =>
                                        indicatorResult.signals.map(
                                            (signal, index) => (
                                                <SignalItem
                                                    key={`${indicatorResult.indicatorName}-${signal.type}-${index}`}
                                                    signal={signal}
                                                    typeLabel={skillLabel(
                                                        indicatorResult.indicatorName
                                                    )}
                                                />
                                            )
                                        )
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <span className={LABEL_KO}>
                            {t('AnalysisPanel.bdeea2')}
                        </span>
                        {hasDetectedPatterns ? (
                            <div className="flex flex-col gap-1.5">
                                {detectedPatterns.map(pattern => (
                                    <PatternAccordionItem
                                        key={pattern.id}
                                        pattern={pattern}
                                        showConfidence={!hasLockedConfidence}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-secondary-500">
                                {t('AnalysisPanel.8d481f')}
                            </p>
                        )}
                    </div>

                    {detectedStrategyResults.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <span className={LABEL_KO}>
                                {t('AnalysisPanel.913a74')}
                            </span>
                            <div className="flex flex-col gap-1.5">
                                {detectedStrategyResults.map(strategy => (
                                    <StrategyAccordionItem
                                        key={strategy.id}
                                        strategy={strategy}
                                        showConfidence={!hasLockedConfidence}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* free 티어 단일 업셀 카드. 궁금증을 유발하는 친절한 구어체로
                        회원 전용 상세 항목 + 전체 스킬 수를 한 카드에 모아, 패널
                        하단에서 회원가입 CTA를 한 번만 노출한다(중복 제거). */}
                    {hasLockedDetails && (
                        <div className="flex flex-col items-center gap-3 rounded-lg border border-secondary-700 bg-secondary-800/40 p-5 text-center">
                            <div className="flex flex-col gap-1.5">
                                <p className="text-sm font-semibold text-balance text-secondary-100">
                                    {t('AnalysisPanel.120a0a')}
                                </p>
                                <p className="text-xs leading-relaxed text-balance text-secondary-300">
                                    {skillCount > 0
                                        ? tPanel('signupSkillUpsell', {
                                              v0: skillCount,
                                          })
                                        : t('AnalysisPanel.f0256c')}
                                </p>
                                <p className="text-xs leading-relaxed text-secondary-400">
                                    {t('AnalysisPanel.9971e1')}
                                </p>
                            </div>
                            <Link
                                href="/signup"
                                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                            >
                                {t('AnalysisPanel.ecb4cc')}
                            </Link>
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
