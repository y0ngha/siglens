/**
 * 종목 분석 탭의 단일 출처 — 탭 순서·경로, 프로필별 노출, 하위 탭 판정.
 */
import { getDescriptor } from '@/shared/config/marketProfile/registry';
import {
    type MarketProfileId,
    type TabKey,
} from '@/shared/config/marketProfile/types';

/**
 * Single source of truth for the symbol analysis tabs. Kept in a non-`'use client'`
 * module so both the client component (`SymbolTabs`) and server-rendered fallback
 * (`SymbolTabsSkeleton`, used by the RSC layout's PPR shell) can import it without
 * pulling in client-only modules.
 *
 * 라벨은 여기 두지 않는다 — 번역자를 인자로 받는 모듈에서 `t()`를 부르면 추출기가
 * 이 파일을 건너뛴다(`noTranslatorParamCall` 가드). 탭 라벨은 `useSymbolTabLabels`가
 * 리터럴 키로 만든다.
 */
export const TABS = [
    { key: 'chart', hrefBuilder: (s: string) => `/${s}` },
    {
        key: 'news',
        hrefBuilder: (s: string) => `/${s}/news`,
    },
    {
        key: 'fundamental',
        hrefBuilder: (s: string) => `/${s}/fundamental`,
    },
    {
        key: 'financials',
        hrefBuilder: (s: string) => `/${s}/financials`,
    },
    {
        key: 'congress',
        hrefBuilder: (s: string) => `/${s}/congress`,
    },
    {
        key: 'flows',
        hrefBuilder: (s: string) => `/${s}/flows`,
    },
    {
        key: 'options',
        hrefBuilder: (s: string) => `/${s}/options`,
    },
    {
        key: 'fear-greed',
        hrefBuilder: (s: string) => `/${s}/fear-greed`,
    },
    {
        key: 'overall',
        hrefBuilder: (s: string) => `/${s}/overall`,
    },
    {
        key: 'position',
        hrefBuilder: (s: string) => `/${s}/position`,
    },
] as const;

/** Tabs visible for a given market profile, in canonical order. */
export function tabsFor(profile: MarketProfileId): (typeof TABS)[number][] {
    const allowed = new Set(getDescriptor(profile).tabs);
    return TABS.filter(t => allowed.has(t.key));
}

/** 차트(종목 루트 `/{T}`)를 뺀 하위 탭 — 브레드크럼에서 종목명 다음 셋째 마디가 되는 탭들. */
export type SymbolSubTabKey = Exclude<TabKey, 'chart'>;

function isSubTabKey(key: TabKey): key is SymbolSubTabKey {
    return key !== 'chart';
}

/** `TABS` 순서 그대로의 하위 탭 키. */
export const SYMBOL_SUB_TAB_KEYS: readonly SymbolSubTabKey[] = TABS.map(
    tab => tab.key
).filter(isSubTabKey);

const SYMBOL_SUB_TAB_KEY_SET: ReadonlySet<string> = new Set<string>(
    SYMBOL_SUB_TAB_KEYS
);

function isSubTabSegment(segment: string): segment is SymbolSubTabKey {
    return SYMBOL_SUB_TAB_KEY_SET.has(segment);
}

/**
 * `useSelectedLayoutSegment()`가 돌려준 세그먼트가 하위 탭이면 그 키, 아니면 null —
 * 차트(`null`)나 알 수 없는 세그먼트면 브레드크럼 셋째 마디를 그리지 않는다.
 */
export function subTabOfSegment(
    segment: string | null
): SymbolSubTabKey | null {
    return segment !== null && isSubTabSegment(segment) ? segment : null;
}
