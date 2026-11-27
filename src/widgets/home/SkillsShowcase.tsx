'use client';

import { useTranslations } from 'next-intl';
import { GUIDE_PATH } from '@/shared/lib/guidePaths';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { ArrowRightIcon } from '@/shared/ui/StrokeIcons';
import { useSkillsShowcase } from './hooks/useSkillsShowcase';
import { SkillPanel } from './ui/skills-showcase/SkillPanel';
import { SkillTabs } from './ui/skills-showcase/SkillTabs';
import { SKILL_TABS } from './utils/skillTabs';
import type { HomeSkillItem } from './utils/toSkillShowcaseItems';

interface SkillsShowcaseProps {
    skills: HomeSkillItem[];
}

/**
 * 홈의 "AI 분석 기법" 섹션 — 제목·타입 탭·패널·전체 가이드 링크를 조립한다.
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
        // 홈의 닫힌 `<details>` 안에서 그려진다(`HomeSkillsDisclosure`) — 바깥 `page-container`가 이미
        // 가로 거터를 잡고 있어 여기서 또 잡으면 펼칠 때 안쪽으로 한 번 더 들어간다.
        <section className="pt-6 pb-2">
            {/* 같은 위계의 h2는 `HEADING_SECTION` 한 곳에서만 정의한다. */}
            <div className="mb-6 flex items-center gap-1">
                <h2 className={HEADING_SECTION}>
                    {t('SkillsShowcase.158954')}
                </h2>
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
