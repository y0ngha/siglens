'use client';

import { useCallback, useId, useState } from 'react';
import type { SkillType } from '@y0ngha/siglens-core';

export type SkillsActiveTab = 'all' | SkillType;

interface UseSkillsShowcaseReturn {
    activeTab: SkillsActiveTab;
    showAll: boolean;
    expandedKey: string | null;
    baseId: string;
    handleTabSelect: (value: SkillsActiveTab) => void;
    toggleShowAll: () => void;
    toggleExpanded: (key: string) => void;
}

export function useSkillsShowcase(): UseSkillsShowcaseReturn {
    const [activeTab, setActiveTab] = useState<SkillsActiveTab>('all');
    const [showAll, setShowAll] = useState(false);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const baseId = useId();

    const handleTabSelect = useCallback((value: SkillsActiveTab): void => {
        setActiveTab(value);
        setShowAll(false);
        // 탭을 바꾸면 펼쳐진 카드가 숨겨진 채 상태에 남지 않도록 초기화.
        setExpandedKey(null);
    }, []);

    const toggleShowAll = useCallback((): void => {
        setShowAll(prev => !prev);
        // "더 보기/접기"로 카드 집합이 바뀌므로 펼침 상태도 초기화.
        setExpandedKey(null);
    }, []);

    // 아코디언: 같은 key면 닫고, 다른 key면 그 카드로 교체(한 번에 하나만 펼침).
    const toggleExpanded = useCallback((key: string): void => {
        setExpandedKey(prev => (prev === key ? null : key));
    }, []);

    return {
        activeTab,
        showAll,
        expandedKey,
        baseId,
        handleTabSelect,
        toggleShowAll,
        toggleExpanded,
    };
}
