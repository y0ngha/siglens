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

export function createTabsUnderlineMock(): {
    TabsUnderline: typeof TabsUnderlineMock;
    buildPanelId: (prefix: string, tab: string) => string;
    buildTabId: (prefix: string, tab: string) => string;
} {
    return {
        TabsUnderline: TabsUnderlineMock,
        buildPanelId: (prefix: string, tab: string) => `${prefix}-panel-${tab}`,
        buildTabId: (prefix: string, tab: string) => `${prefix}-tab-${tab}`,
    };
}
