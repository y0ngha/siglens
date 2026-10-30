'use client';

import { useTranslations } from 'next-intl';
import type { SkillShowcaseItem } from '@y0ngha/siglens-core';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { GUIDE_PATH } from '@/shared/lib/guidePaths';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { ArrowRightIcon } from '@/shared/ui/StrokeIcons';
import { useSkillsShowcase } from './hooks/useSkillsShowcase';
import { ConfidenceInfo } from './ui/skills-showcase/ConfidenceInfo';
import { SkillPanel } from './ui/skills-showcase/SkillPanel';
import { SkillTabs } from './ui/skills-showcase/SkillTabs';
import { SKILL_TABS } from './utils/skillTabs';

interface SkillsShowcaseProps {
    skills: SkillShowcaseItem[];
}

/**
 * 홈의 "AI 분석 스킬" 섹션 — 제목·신뢰도 안내·타입 탭·패널·전체 가이드 링크를 조립한다.
 * 상태는 `useSkillsShowcase`, 표현은 `ui/skills-showcase/*`가 맡는다.
 */
export function SkillsShowcase({ skills }: SkillsShowcaseProps) {
    const t = useTranslations('widgets.home');
    const {
        activeTab,
        showAll,
        expandedKey,
        baseId,
        handleTabSelect,
        toggleShowAll,
        toggleExpanded,
    } = useSkillsShowcase();

    return (
        <section className="page-container py-10">
            {/* 같은 위계의 h2는 `HEADING_SECTION` 한 곳에서만 정의한다. */}
            <div className="mb-6 flex items-center gap-1">
                <h2 className={HEADING_SECTION}>
                    {t('SkillsShowcase.158954')}
                </h2>
                <ConfidenceInfo />
            </div>
            <SkillTabs
                activeTab={activeTab}
                onChange={handleTabSelect}
                idPrefix={baseId}
            />
            {SKILL_TABS.map(tab => (
                <SkillPanel
                    key={tab.value}
                    tab={tab.value}
                    isActive={activeTab === tab.value}
                    idPrefix={baseId}
                    skills={skills}
                    showAll={showAll}
                    expandedKey={expandedKey}
                    onToggleShowAll={toggleShowAll}
                    onToggleExpand={toggleExpanded}
                />
            ))}
            <div className="mt-6 flex justify-center">
                <Link
                    href={GUIDE_PATH}
                    prefetch={false}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-primary-400 transition-colors hover:text-primary-300 focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('SkillsShowcase.allGuides')}
                    <ArrowRightIcon className="size-4" />
                </Link>
            </div>
        </section>
    );
}
