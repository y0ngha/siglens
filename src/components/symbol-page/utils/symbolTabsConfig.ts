/**
 * Single source of truth for the 4 symbol analysis tabs. Kept in a non-`'use client'`
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
        key: 'overall',
        label: '종합',
        hrefBuilder: (s: string) => `/${s}/overall`,
    },
] as const;
