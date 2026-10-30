'use client';

import { useTranslations } from 'next-intl';
import type { SkillShowcaseItem } from '@y0ngha/siglens-core';
import { buildPanelId, buildTabId } from '@/shared/ui/tabs/utils/tabIds';
import {
    filterSkillsByTab,
    INITIAL_VISIBLE_COUNT,
    type SkillsActiveTab,
} from '../../utils/skillTabs';
import { SkillCard } from './SkillCard';

interface SkillPanelProps {
    readonly tab: SkillsActiveTab;
    readonly isActive: boolean;
    readonly idPrefix: string;
    /** 필터 전 전체 스킬 — 패널이 자기 탭에 맞게 거른다. */
    readonly skills: readonly SkillShowcaseItem[];
    readonly showAll: boolean;
    readonly expandedKey: string | null;
    readonly onToggleShowAll: () => void;
    readonly onToggleExpand: (key: string) => void;
}

/**
 * 탭 하나의 `role="tabpanel"`.
 *
 * 비활성 패널도 `hidden`으로 남기되 카드를 그대로 렌더한다 — 모든 탭의 스킬이 서버
 * HTML에 들어가야 하기 때문이다(SEO).
 */
export function SkillPanel({
    tab,
    isActive,
    idPrefix,
    skills,
    showAll,
    expandedKey,
    onToggleShowAll,
    onToggleExpand,
}: SkillPanelProps) {
    const tMisc = useTranslations('shared.ui.misc');
    const t = useTranslations('widgets.home');
    const panelSkills = filterSkillsByTab(skills, tab);
    const visibleSkills = showAll
        ? panelSkills
        : panelSkills.slice(0, INITIAL_VISIBLE_COUNT);
    const hasMore = panelSkills.length > INITIAL_VISIBLE_COUNT;

    return (
        <div
            id={buildPanelId(idPrefix, tab)}
            role="tabpanel"
            aria-labelledby={buildTabId(idPrefix, tab)}
            hidden={!isActive}
        >
            {/* 숨은 패널도 카드를 렌더하는 것은 의도다: 모든 탭의 스킬이 서버 HTML에 담겨야 한다(SEO). 카드당 비용은 감수한다. */}
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleSkills.map(skill => (
                    <SkillCard
                        key={skill.name}
                        skill={skill}
                        isExpanded={expandedKey === skill.name}
                        onToggleExpand={onToggleExpand}
                    />
                ))}
            </div>
            {hasMore && (
                <div className="mt-6 flex justify-center">
                    <button
                        type="button"
                        onClick={onToggleShowAll}
                        className="rounded-full border border-border-control px-6 py-2 text-xs font-medium text-secondary-400 transition-colors hover:border-primary-500 hover:text-primary-400 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        {showAll
                            ? t('SkillsShowcase.0d2c24')
                            : tMisc('showMore', {
                                  v0:
                                      panelSkills.length -
                                      INITIAL_VISIBLE_COUNT,
                              })}
                    </button>
                </div>
            )}
        </div>
    );
}
