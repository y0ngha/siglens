'use client';

import { useTranslations } from 'next-intl';
import { TabsPill } from '@/shared/ui/tabs/TabsPill';
import { SKILL_TABS, type SkillsActiveTab } from '../../utils/skillTabs';

interface SkillTabsProps {
    readonly activeTab: SkillsActiveTab;
    readonly onChange: (tab: SkillsActiveTab) => void;
    /** 탭·패널 id의 공통 접두사 — `SkillPanel`의 `aria-labelledby`와 짝을 이룬다. */
    readonly idPrefix: string;
}

/** 스킬 타입 필터 탭 — `SKILL_TABS`를 번역해 `TabsPill`에 넘긴다. */
export function SkillTabs({ activeTab, onChange, idPrefix }: SkillTabsProps) {
    const t = useTranslations('widgets.home');

    return (
        <TabsPill
            tabs={SKILL_TABS.map(tab => ({
                value: tab.value,
                label: t(tab.labelKey),
            }))}
            activeTab={activeTab}
            onChange={onChange}
            ariaLabel={t('SkillsShowcase.c78b79')}
            idPrefix={idPrefix}
            className="mb-6"
        />
    );
}
