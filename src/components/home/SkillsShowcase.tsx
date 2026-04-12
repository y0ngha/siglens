'use client';

import React, { useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { SkillShowcaseItem, SkillType } from '@/domain/types';
import { HIGH_CONFIDENCE_WEIGHT } from '@/domain/indicators/constants';
import { useOnClickOutside } from '@/components/hooks/useOnClickOutside';

const INITIAL_VISIBLE_COUNT = 12;

type ActiveTab = 'all' | SkillType;

interface TabConfig {
    value: ActiveTab;
    label: string;
}

const TABS: TabConfig[] = [
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
            'bg-chart-bollinger/10 text-chart-bollinger border border-chart-bollinger/30',
    },
};

function ConfidenceInfoTooltip() {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useOnClickOutside(containerRef, () => setOpen(false));

    return (
        <div ref={containerRef} className="group relative">
            <button
                type="button"
                aria-label="신뢰도 점수 설명"
                aria-expanded={open}
                onClick={() => setOpen(prev => !prev)}
                className="text-secondary-600 hover:text-secondary-400 cursor-help text-xs leading-none transition-colors"
            >
                ⓘ
            </button>
            <div
                role="tooltip"
                className={cn(
                    'bg-secondary-800 border-secondary-600 absolute right-0 bottom-full z-10 mb-1.5 w-56 rounded border p-2 text-xs shadow-lg transition-opacity',
                    'group-hover:opacity-100',
                    open
                        ? 'pointer-events-auto opacity-100'
                        : 'pointer-events-none opacity-0 sm:pointer-events-none sm:opacity-0'
                )}
            >
                <p className="text-secondary-300 leading-relaxed">
                    분석 기법의 신뢰도 점수입니다. 50% 미만은 분석에서 제외되며,
                    80% 이상은 높은 신뢰도로 분류됩니다.
                </p>
            </div>
        </div>
    );
}

interface SkillCardProps {
    skill: SkillShowcaseItem;
}

function SkillCard({ skill }: SkillCardProps) {
    const badge = skill.type != null ? TYPE_BADGE[skill.type] : null;
    const isHighConfidence = skill.confidenceWeight >= HIGH_CONFIDENCE_WEIGHT;

    return (
        <div className="bg-secondary-800/50 border-secondary-700 rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
                <span className="text-secondary-200 text-sm font-medium">
                    {skill.name}
                </span>
                {badge != null && (
                    <span
                        className={cn(
                            'rounded px-1.5 py-0.5 text-xs font-medium',
                            badge.className
                        )}
                    >
                        {badge.label}
                    </span>
                )}
            </div>
            <p className="text-secondary-400 mb-3 line-clamp-2 text-xs leading-relaxed">
                {skill.description}
            </p>
            <div className="flex items-center gap-2">
                <div className="bg-secondary-700 h-1.5 flex-1 overflow-hidden rounded-full">
                    <div
                        className={cn(
                            'h-full w-(--confidence-w) rounded-full',
                            isHighConfidence
                                ? 'bg-chart-bullish'
                                : 'bg-ui-warning'
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
        <section className="px-6 py-10 lg:px-[15vw]">
            <div className="bg-secondary-700/50 mb-6 h-3.5 w-20 animate-pulse rounded" />
            <div className="mb-6 flex flex-wrap gap-2">
                {[48, 56, 64, 52, 60, 72].map((w, i) => (
                    <div
                        key={i}
                        className="bg-secondary-700/50 h-7 animate-pulse rounded-full"
                        style={{ width: `${w}px` }}
                    />
                ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 12 }).map((_, i) => (
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
        </section>
    );
}

interface SkillsShowcaseProps {
    skills: SkillShowcaseItem[];
}

export function SkillsShowcase({ skills }: SkillsShowcaseProps) {
    const [activeTab, setActiveTab] = useState<ActiveTab>('all');
    const [showAll, setShowAll] = useState(false);
    const baseId = useId();
    const tabButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const handleTabSelect = (value: ActiveTab): void => {
        setActiveTab(value);
        setShowAll(false);
    };

    const handleTablistKeyDown = (e: React.KeyboardEvent): void => {
        const currentIdx = TABS.findIndex(t => t.value === activeTab);
        let nextIdx = currentIdx;
        if (e.key === 'ArrowRight') nextIdx = (currentIdx + 1) % TABS.length;
        else if (e.key === 'ArrowLeft')
            nextIdx = (currentIdx - 1 + TABS.length) % TABS.length;
        else return;
        e.preventDefault();
        handleTabSelect(TABS[nextIdx].value);
        tabButtonRefs.current[nextIdx]?.focus();
    };

    return (
        <section className="px-6 py-10 lg:px-[15vw]">
            <h2 className="text-secondary-200 mb-6 text-sm font-semibold tracking-wider uppercase">
                AI 분석 스킬
            </h2>
            <div
                role="tablist"
                aria-label="스킬 카테고리 탭"
                className="mb-6 flex flex-wrap gap-2"
                onKeyDown={handleTablistKeyDown}
            >
                {TABS.map((tab, idx) => {
                    const isActive = activeTab === tab.value;
                    return (
                        <button
                            key={tab.value}
                            ref={el => {
                                tabButtonRefs.current[idx] = el;
                            }}
                            id={`${baseId}-tab-${tab.value}`}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            aria-controls={`${baseId}-panel-${tab.value}`}
                            tabIndex={isActive ? 0 : -1}
                            onClick={() => handleTabSelect(tab.value)}
                            className={cn(
                                'rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
                                isActive
                                    ? 'bg-primary-600 text-white'
                                    : 'border-secondary-700 text-secondary-400 hover:text-secondary-200 border'
                            )}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>
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
                        id={`${baseId}-panel-${tab.value}`}
                        role="tabpanel"
                        aria-labelledby={`${baseId}-tab-${tab.value}`}
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
                                    onClick={() => setShowAll(prev => !prev)}
                                    className="border-secondary-700 text-secondary-400 hover:border-primary-600/40 hover:text-primary-400 rounded-full border px-6 py-2 text-xs font-medium transition-colors"
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
