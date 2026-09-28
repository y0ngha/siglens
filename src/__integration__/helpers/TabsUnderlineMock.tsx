import type { ReactNode } from 'react';

interface TabItem {
    value: string;
    label: string;
}

interface TabsUnderlineMockProps {
    tabs: TabItem[];
    activeTab: string;
    onChange: (v: string) => void;
    ariaLabel: string;
    size?: string;
    idPrefix?: string;
}

function TabsUnderlineMock({
    tabs,
    activeTab,
    onChange,
    ariaLabel,
}: TabsUnderlineMockProps): ReactNode {
    return (
        <div role="tablist" aria-label={ariaLabel}>
            {tabs.map(t => (
                <button
                    key={t.value}
                    role="tab"
                    aria-selected={t.value === activeTab}
                    onClick={() => onChange(t.value)}
                >
                    {t.label}
                </button>
            ))}
        </div>
    );
}

/**
 * Factory for `vi.mock('@/shared/ui/tabs/TabsUnderline', ...)`. The id helpers
 * (`buildTabId`/`buildPanelId`) live in `@/shared/ui/tabs/utils/tabIds` and stay
 * real — they are pure string builders.
 */
export function createTabsUnderlineMock(): {
    TabsUnderline: typeof TabsUnderlineMock;
} {
    return { TabsUnderline: TabsUnderlineMock };
}
