'use client';

import { useCallback, useId, useState } from 'react';
import type { SkillType } from '@/domain/types';

export type SkillsActiveTab = 'all' | SkillType;

interface UseSkillsShowcaseReturn {
    activeTab: SkillsActiveTab;
    showAll: boolean;
    baseId: string;
    handleTabSelect: (value: SkillsActiveTab) => void;
    toggleShowAll: () => void;
}

export function useSkillsShowcase(): UseSkillsShowcaseReturn {
    const [activeTab, setActiveTab] = useState<SkillsActiveTab>('all');
    const [showAll, setShowAll] = useState(false);
    const baseId = useId();

    const handleTabSelect = useCallback((value: SkillsActiveTab): void => {
        setActiveTab(value);
        setShowAll(false);
    }, []);

    const toggleShowAll = useCallback((): void => {
        setShowAll(prev => !prev);
    }, []);

    return { activeTab, showAll, baseId, handleTabSelect, toggleShowAll };
}
