import {
    getDescriptor,
    type MarketProfileId,
} from '@/shared/config/marketProfile';

/**
 * Single source of truth for the symbol analysis tabs. Kept in a non-`'use client'`
 * module so both the client component (`SymbolTabs`) and server-rendered fallback
 * (`SymbolTabsSkeleton`, used by the RSC layout's PPR shell) can import it without
 * pulling in client-only modules.
 *
 * **라벨은 키만 담는다.** 여기서 번역자를 인자로 받아 `t()`를 부르면 추출기가
 * 이 파일을 건너뛰어(`translatorNamespace.size === 0` 조기 반환) 그 키가
 * 클라이언트 페이로드에서 빠지고, 화면에는 키 문자열이 그대로 렌더된다 —
 * 실제로 그렇게 냈다(`noTranslatorParamCall` 가드가 지금은 막는다).
 * `labelKey`는 `shared.symbolTab` 네임스페이스 기준 상대 키다.
 */
export const TABS = [
    { key: 'chart', labelKey: 'chart', hrefBuilder: (s: string) => `/${s}` },
    {
        key: 'news',
        labelKey: 'news',
        hrefBuilder: (s: string) => `/${s}/news`,
    },
    {
        key: 'fundamental',
        labelKey: 'fundamental',
        hrefBuilder: (s: string) => `/${s}/fundamental`,
    },
    {
        key: 'financials',
        labelKey: 'financials',
        hrefBuilder: (s: string) => `/${s}/financials`,
    },
    {
        key: 'congress',
        labelKey: 'congress',
        hrefBuilder: (s: string) => `/${s}/congress`,
    },
    {
        key: 'options',
        labelKey: 'options',
        hrefBuilder: (s: string) => `/${s}/options`,
    },
    {
        key: 'fear-greed',
        labelKey: 'fear-greed',
        hrefBuilder: (s: string) => `/${s}/fear-greed`,
    },
    {
        key: 'overall',
        labelKey: 'overall',
        hrefBuilder: (s: string) => `/${s}/overall`,
    },
    {
        key: 'position',
        labelKey: 'position',
        hrefBuilder: (s: string) => `/${s}/position`,
    },
] as const;

/** Tabs visible for a given market profile, in canonical order. */
export function tabsFor(profile: MarketProfileId): (typeof TABS)[number][] {
    const allowed = new Set(getDescriptor(profile).tabs);
    return TABS.filter(t => allowed.has(t.key));
}
