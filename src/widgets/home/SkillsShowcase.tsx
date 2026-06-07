'use client';

import React, { useId, useRef } from 'react';
import { cn } from '@/shared/lib/cn';
import type { SkillShowcaseItem, SkillType } from '@y0ngha/siglens-core';
import { usePopoverToggle } from '@/shared/hooks/usePopoverToggle';
import { buildPanelId, buildTabId, TabsPill } from '@/shared/ui/tabs';
import {
    type SkillsActiveTab,
    useSkillsShowcase,
} from './hooks/useSkillsShowcase';

const INITIAL_VISIBLE_COUNT = 12;
const SKELETON_TAB_WIDTHS_PX = [48, 56, 64, 52, 60, 72] as const;
const SKELETON_CARD_COUNT = 12;

/**
 * `HIGH_CONFIDENCE_WEIGHT` 로컬 미러 — `@y0ngha/siglens-core`의
 * `domain/indicators/constants.js`에서 동일 상수를 그대로 들고 와도 되지만,
 * 그 모듈은 RSI/MACD/BOLLINGER/STOCHASTIC/KELTNER/ICHIMOKU/SMC/SQUEEZE 등
 * 60+ 개 indicator 상수를 한 파일에 묶어둔 barrel이라 Turbopack tree-shaking이
 * 실패하면서 ~33 KB unused JS가 landing chunk에 끌려와 PSI unused-javascript
 * audit이 0.5점, lcp-discovery에 영향. 단일 0.8 상수를 인라인해 의존성 절단.
 *
 * 추적 이슈: #468 — siglens-core가 indicator constants barrel을 관심사별 파일로
 * 분리하면 본 미러를 제거하고 직접 import로 복귀. 그때까지는 siglens-core의
 * `HIGH_CONFIDENCE_WEIGHT`와 함께 일관되게 갱신할 것 (현재 양쪽 모두 0.8).
 */
const HIGH_CONFIDENCE_WEIGHT = 0.8;
// 등급 경계는 @y0ngha/siglens-core의 confidence helper와 동일 값(0.5/0.8).
// SkillsShowcase는 client component이고 lcp-discovery 의존성 절단을 위해 인라인 유지.
// 제거 조건: core가 client entrypoint(index.client)에 confidence 경계/helper를
// 노출하면 이 미러를 삭제하고 import로 통합한다. `HIGH_CONFIDENCE_WEIGHT`와 함께 갱신.
const MEDIUM_CONFIDENCE_WEIGHT = 0.5;

interface TabConfig {
    value: SkillsActiveTab;
    label: string;
}

const TABS: readonly TabConfig[] = [
    { value: 'all', label: '전체' },
    { value: 'indicator_guide', label: '보조지표' },
    { value: 'pattern', label: '차트 패턴' },
    { value: 'strategy', label: '전략' },
    { value: 'candlestick', label: '캔들 패턴' },
    { value: 'support_resistance', label: '지지/저항' },
];

interface TypeBadgeConfig {
    label: string;
    className: string;
}

const TYPE_BADGE: Record<SkillType, TypeBadgeConfig> = {
    indicator_guide: {
        label: '지표',
        className:
            'bg-primary-600/15 text-primary-400 border border-primary-600/30',
    },
    pattern: {
        label: '패턴',
        className:
            'bg-chart-bearish/10 text-chart-bearish border border-chart-bearish/30',
    },
    strategy: {
        label: '전략',
        className:
            'bg-ui-warning/10 text-ui-warning border border-ui-warning/30',
    },
    candlestick: {
        label: '캔들',
        className:
            'bg-chart-bullish/10 text-chart-bullish border border-chart-bullish/30',
    },
    support_resistance: {
        label: '지지/저항',
        className:
            'bg-secondary-700/30 text-secondary-300 border border-secondary-600/50',
    },
};

// 툴팁 카피용 경계 퍼센트 — 모듈 레벨에서 1회 계산(컴포넌트 내 매 렌더 재생성 방지).
// Math.round로 0.8 * 100 = 80.00000000000001 같은 부동소수점 잔차를 흡수.
const MEDIUM_PCT = Math.round(MEDIUM_CONFIDENCE_WEIGHT * 100);
const HIGH_PCT = Math.round(HIGH_CONFIDENCE_WEIGHT * 100);

function barColorClass(weight: number): string {
    if (weight >= HIGH_CONFIDENCE_WEIGHT) return 'bg-chart-bullish';
    if (weight >= MEDIUM_CONFIDENCE_WEIGHT) return 'bg-ui-warning';
    return 'bg-secondary-500';
}

function ConfidenceInfoTooltip() {
    const containerRef = useRef<HTMLDivElement>(null);
    const tooltipId = useId();
    const { isOpen, toggle } = usePopoverToggle(containerRef);

    return (
        <div ref={containerRef} className="group relative">
            <button
                type="button"
                aria-label="신뢰도 점수 설명"
                aria-describedby={tooltipId}
                onClick={toggle}
                className="text-secondary-600 hover:text-secondary-400 focus-visible:ring-primary-500 cursor-help rounded text-xs leading-none transition-colors focus-visible:ring-1 focus-visible:outline-none"
            >
                ⓘ
            </button>
            <div
                id={tooltipId}
                role="tooltip"
                className={cn(
                    'bg-secondary-800 border-secondary-600 absolute right-0 bottom-full z-10 mb-1.5 w-56 rounded border p-2 text-xs shadow-lg transition-opacity',
                    'group-hover:opacity-100',
                    isOpen
                        ? 'pointer-events-auto opacity-100'
                        : 'pointer-events-none opacity-0 sm:pointer-events-none sm:opacity-0'
                )}
            >
                <div className="text-secondary-300 leading-relaxed">
                    <p>분석 기법의 신뢰도 점수예요.</p>
                    <p>
                        {MEDIUM_PCT}% 미만은 낮음, {MEDIUM_PCT}~{HIGH_PCT}%는
                        보통, {HIGH_PCT}% 이상은 높음이에요.
                    </p>
                    <p>낮은 점수도 분석에 보조적으로 반영돼요.</p>
                </div>
            </div>
        </div>
    );
}

interface SkillCardProps {
    skill: SkillShowcaseItem;
}

function SkillCard({ skill }: SkillCardProps) {
    const badge = skill.type != null ? TYPE_BADGE[skill.type] : null;
    const barColor = barColorClass(skill.confidenceWeight);

    return (
        <div className="bg-secondary-800/50 border-secondary-700 rounded-lg border p-4">
            <div className="mb-2 flex items-start gap-2">
                <span className="text-secondary-200 min-w-0 text-sm font-medium">
                    {skill.name}
                </span>
                {badge != null && (
                    <span
                        className={cn(
                            'shrink-0 rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
                            badge.className
                        )}
                    >
                        {badge.label}
                    </span>
                )}
            </div>
            <p className="text-secondary-400 mb-3 line-clamp-2 text-sm leading-relaxed">
                {skill.description}
            </p>
            <div className="flex items-center gap-2">
                <div className="bg-secondary-700 h-1.5 flex-1 overflow-hidden rounded-full">
                    <div
                        data-testid="confidence-bar"
                        className={cn(
                            'h-full w-(--confidence-w) rounded-full',
                            barColor
                        )}
                        style={
                            {
                                '--confidence-w': `${skill.confidenceWeight * 100}%`,
                            } as React.CSSProperties
                        }
                        aria-hidden="true"
                    />
                </div>
                <span className="text-secondary-400 font-mono text-xs">
                    {Math.round(skill.confidenceWeight * 100)}%
                </span>
                <ConfidenceInfoTooltip />
            </div>
        </div>
    );
}

export function SkillsShowcaseSkeleton() {
    return (
        <section
            aria-label="AI 분석 스킬 불러오는 중"
            aria-busy="true"
            className="px-6 py-10 lg:px-[15vw]"
        >
            <div aria-hidden="true">
                <div className="bg-secondary-700/50 mb-6 h-3.5 w-20 animate-pulse rounded" />
                <div className="mb-6 flex flex-wrap gap-2">
                    {SKELETON_TAB_WIDTHS_PX.map((w, i) => (
                        <div
                            key={i}
                            className="bg-secondary-700/50 h-7 w-(--skeleton-w) animate-pulse rounded-full"
                            style={
                                {
                                    '--skeleton-w': `${w}px`,
                                } as React.CSSProperties
                            }
                        />
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: SKELETON_CARD_COUNT }).map((_, i) => (
                        <div
                            key={i}
                            className="bg-secondary-800/50 border-secondary-700 rounded-lg border p-4"
                        >
                            <div className="mb-2 flex items-center gap-2">
                                <div className="bg-secondary-700/50 h-4 w-28 animate-pulse rounded" />
                                <div className="bg-secondary-700/50 h-4 w-12 animate-pulse rounded" />
                            </div>
                            <div className="mb-3 space-y-1.5">
                                <div className="bg-secondary-700/50 h-3 w-full animate-pulse rounded" />
                                <div className="bg-secondary-700/50 h-3 w-4/5 animate-pulse rounded" />
                            </div>
                            <div className="bg-secondary-700/50 h-1.5 animate-pulse rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

interface SkillsShowcaseProps {
    skills: SkillShowcaseItem[];
}

export function SkillsShowcase({ skills }: SkillsShowcaseProps) {
    const { activeTab, showAll, baseId, handleTabSelect, toggleShowAll } =
        useSkillsShowcase();

    return (
        <section className="px-6 py-10 lg:px-[15vw]">
            <h2 className="text-secondary-200 mb-6 text-sm font-semibold tracking-wider uppercase">
                AI 분석 스킬
            </h2>
            <TabsPill
                tabs={TABS}
                activeTab={activeTab}
                onChange={handleTabSelect}
                ariaLabel="스킬 카테고리 탭"
                idPrefix={baseId}
                className="mb-6"
            />
            {TABS.map(tab => {
                const isActive = activeTab === tab.value;
                const panelSkills =
                    tab.value === 'all'
                        ? skills
                        : skills.filter(s => s.type === tab.value);
                const visibleSkills = showAll
                    ? panelSkills
                    : panelSkills.slice(0, INITIAL_VISIBLE_COUNT);
                const hasMore = panelSkills.length > INITIAL_VISIBLE_COUNT;

                return (
                    <div
                        key={tab.value}
                        id={buildPanelId(baseId, tab.value)}
                        role="tabpanel"
                        aria-labelledby={buildTabId(baseId, tab.value)}
                        hidden={!isActive}
                    >
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {visibleSkills.map(skill => (
                                <SkillCard key={skill.name} skill={skill} />
                            ))}
                        </div>
                        {hasMore && (
                            <div className="mt-6 flex justify-center">
                                <button
                                    type="button"
                                    onClick={toggleShowAll}
                                    className="border-secondary-700 text-secondary-400 hover:border-primary-600/40 hover:text-primary-400 focus-visible:ring-primary-500 rounded-full border px-6 py-2 text-xs font-medium transition-colors focus-visible:ring-1 focus-visible:outline-none"
                                >
                                    {showAll
                                        ? '접기'
                                        : `더 보기 (${panelSkills.length - INITIAL_VISIBLE_COUNT}개)`}
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
        </section>
    );
}
