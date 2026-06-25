import {
    getDescriptor,
    type MarketProfileId,
} from '@/shared/config/marketProfile';

/**
 * Single source of truth for the symbol analysis tabs. Kept in a non-`'use client'`
 * module so both the client component (`SymbolTabs`) and server-rendered fallback
 * (`SymbolTabsSkeleton`, used by the RSC layout's PPR shell) can import it without
 * pulling in client-only modules.
 */
export const TABS = [
    { key: 'chart', label: '차트', hrefBuilder: (s: string) => `/${s}` },
    {
        key: 'news',
        label: '뉴스',
        hrefBuilder: (s: string) => `/${s}/news`,
    },
    {
        key: 'fundamental',
        label: '펀더멘털',
        hrefBuilder: (s: string) => `/${s}/fundamental`,
    },
    {
        key: 'financials',
        label: '재무제표',
        hrefBuilder: (s: string) => `/${s}/financials`,
    },
    {
        key: 'congress',
        label: '의회 거래',
        hrefBuilder: (s: string) => `/${s}/congress`,
    },
    {
        key: 'options',
        label: '옵션',
        hrefBuilder: (s: string) => `/${s}/options`,
    },
    {
        key: 'fear-greed',
        label: '공포 탐욕 지수',
        hrefBuilder: (s: string) => `/${s}/fear-greed`,
    },
    {
        key: 'overall',
        label: '종합',
        hrefBuilder: (s: string) => `/${s}/overall`,
    },
] as const;

/** Tabs visible for a given market profile, in canonical order. */
export function tabsFor(profile: MarketProfileId): (typeof TABS)[number][] {
    const allowed = new Set(getDescriptor(profile).tabs);
    return TABS.filter(t => allowed.has(t.key));
}
