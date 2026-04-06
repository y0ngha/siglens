'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { SkillShowcaseItem, SkillType } from '@/domain/types';
import { HIGH_CONFIDENCE_WEIGHT } from '@/domain/indicators/constants';

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
};

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
                            'h-full w-[var(--confidence-w)] rounded-full',
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
                <span className="text-secondary-500 font-mono text-xs">
                    {Math.round(skill.confidenceWeight * 100)}%
                </span>
                <div className="group relative">
                    <span className="text-secondary-600 hover:text-secondary-400 cursor-help text-xs leading-none transition-colors">
                        ⓘ
                    </span>
                    <div className="bg-secondary-800 border-secondary-600 pointer-events-none absolute right-0 bottom-full z-10 mb-1.5 w-56 rounded border p-2 text-xs opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                        <p className="text-secondary-300 leading-relaxed">
                            분석 기법의 신뢰도 점수입니다. 50% 미만은 분석에서
                            제외되며, 80% 이상은 높은 신뢰도로 분류됩니다.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface SkillsShowcaseProps {
    skills: SkillShowcaseItem[];
}

export function SkillsShowcase({ skills }: SkillsShowcaseProps) {
    const [activeTab, setActiveTab] = useState<ActiveTab>('all');

    const filteredSkills =
        activeTab === 'all' ? skills : skills.filter(s => s.type === activeTab);

    return (
        <div className="px-6 lg:px-[15vw]">
            <div className="mb-6 flex flex-wrap gap-2">
                {TABS.map(tab => (
                    <button
                        key={tab.value}
                        type="button"
                        onClick={() => setActiveTab(tab.value)}
                        className={cn(
                            'rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
                            activeTab === tab.value
                                ? 'bg-primary-600 text-white'
                                : 'border-secondary-700 text-secondary-400 hover:text-secondary-200 border'
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSkills.map(skill => (
                    <SkillCard key={skill.name} skill={skill} />
                ))}
            </div>
        </div>
    );
}
