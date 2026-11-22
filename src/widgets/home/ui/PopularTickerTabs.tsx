'use client';

import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { TabsPill } from '@/shared/ui/tabs/TabsPill';
import { buildPanelId, buildTabId } from '@/shared/ui/tabs/utils/tabIds';
import { expandButtonVisibility } from '../utils/popularCollapse';

export type PopularMarket = 'us' | 'kr' | 'crypto';

export interface PopularPanel {
    readonly value: PopularMarket;
    /** 탭 라벨(서버가 번역해 넘긴다). */
    readonly label: string;
    /** 이 시장의 카드 수 — "모두 보기" 버튼을 둘지와 그 반응형 클래스를 정한다. */
    readonly cardCount: number;
    /** 서버가 그린 카드 격자. 숨겨진 패널의 링크도 서버 HTML에 담기려고 전부 넘긴다. */
    readonly grid: ReactNode;
}

interface PopularTickerTabsProps {
    readonly panels: readonly PopularPanel[];
    readonly defaultTab: PopularMarket;
    readonly tabsLabel: string;
    readonly expandLabel: string;
    readonly collapseLabel: string;
}

/**
 * 인기 종목의 시장 탭(미국·한국·암호화폐)과 패널별 접기 상태.
 *
 * 격자는 서버 컴포넌트가 만든 노드를 `panels[].grid`로 받는다 — 비활성 패널도 `hidden`으로
 * 마운트하고 접힌 카드는 `display:none`일 뿐이라 모든 종목 링크가 서버 HTML에 남는다.
 * 탭·펼침 상태는 저장소에서 복원하지 않는다(서버 HTML과 첫 하이드레이션이 같아야 밀림이 없다).
 */
export function PopularTickerTabs({
    panels,
    defaultTab,
    tabsLabel,
    expandLabel,
    collapseLabel,
}: PopularTickerTabsProps) {
    const idPrefix = useId();
    const [activeTab, setActiveTab] = useState<PopularMarket>(defaultTab);
    const [expanded, setExpanded] = useState<
        Readonly<Partial<Record<PopularMarket, boolean>>>
    >({});

    return (
        <>
            <TabsPill
                tabs={panels.map(({ value, label }) => ({ value, label }))}
                activeTab={activeTab}
                onChange={setActiveTab}
                ariaLabel={tabsLabel}
                idPrefix={idPrefix}
                className="mb-4"
            />
            {panels.map(({ value, cardCount, grid }) => {
                const isActive = value === activeTab;
                const isExpanded = expanded[value] === true;
                const panelId = buildPanelId(idPrefix, value);
                const gridId = `${panelId}-grid`;
                const buttonVisibility = expandButtonVisibility(cardCount);
                return (
                    <div
                        key={value}
                        id={panelId}
                        role="tabpanel"
                        aria-labelledby={buildTabId(idPrefix, value)}
                        hidden={!isActive}
                        data-collapsed={!isExpanded}
                        className="group/grid"
                    >
                        <div id={gridId}>{grid}</div>
                        {buttonVisibility !== null && (
                            <div
                                className={cn(
                                    'mt-4 flex justify-center',
                                    buttonVisibility
                                )}
                            >
                                <button
                                    type="button"
                                    aria-expanded={isExpanded}
                                    aria-controls={gridId}
                                    onClick={event => {
                                        const button = event.currentTarget;
                                        setExpanded(prev => ({
                                            ...prev,
                                            [value]: !isExpanded,
                                        }));
                                        // 접으면 카드가 줄며 버튼이 화면 밖으로 밀릴 수 있다 — 접힌 레이아웃이
                                        // 그려진 다음 프레임에 버튼을 뷰포트 안으로 되돌린다(이미 보이면 무동작).
                                        if (isExpanded) {
                                            requestAnimationFrame(() =>
                                                button.scrollIntoView({
                                                    block: 'nearest',
                                                })
                                            );
                                        }
                                    }}
                                    className="min-h-11 rounded-full border border-border-control px-6 text-xs font-medium text-secondary-300 transition-colors hover:border-primary-500 hover:text-primary-400 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                >
                                    {isExpanded ? collapseLabel : expandLabel}
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
        </>
    );
}
