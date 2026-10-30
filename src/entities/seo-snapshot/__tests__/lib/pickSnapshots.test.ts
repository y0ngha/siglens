import { describe, it, expect } from 'vitest';
import {
    anyLocaleChain,
    pickFallbackRowPerSymbolTab,
    pickFreshestPerTab,
    pickSnapshotPerTab,
} from '@/entities/seo-snapshot/lib/pickSnapshots';
import type {
    SeoAnalysisSnapshot,
    SeoSnapshotTab,
} from '@/entities/seo-snapshot/model';
import type { Locale } from '@/shared/i18n/locales';

function row(
    tab: SeoSnapshotTab,
    locale: Locale,
    generatedAt = '2026-09-10T00:00:00.000Z'
): SeoAnalysisSnapshot {
    return {
        symbol: 'AAPL',
        tab,
        locale,
        content: `${tab}-${locale}`,
        plain: null,
        model: 'm',
        generatedAt: new Date(generatedAt),
        firstGeneratedAt: null,
        updatedAt: new Date(generatedAt),
    };
}

describe('pickSnapshotPerTab', () => {
    it('prefers the earliest locale in the chain per tab', () => {
        const picked = pickSnapshotPerTab(
            [row('technical', 'en'), row('technical', 'ko')],
            ['ko', 'en']
        );
        expect(picked.map(s => s.content)).toEqual(['technical-ko']);
    });

    it('drops locales outside the chain', () => {
        expect(
            pickSnapshotPerTab([row('technical', 'ja')], ['zh', 'en', 'ko'])
        ).toEqual([]);
    });

    it('keeps one row per tab in first-seen tab order', () => {
        const picked = pickSnapshotPerTab(
            [row('news', 'ko'), row('technical', 'ko'), row('news', 'en')],
            ['ko', 'en']
        );
        expect(picked.map(s => s.tab)).toEqual(['news', 'technical']);
    });
});

describe('pickFreshestPerTab', () => {
    it('picks the newest row regardless of language', () => {
        const picked = pickFreshestPerTab(
            [
                row('technical', 'ko', '2026-09-10T00:00:00.000Z'),
                row('technical', 'ja', '2026-09-12T00:00:00.000Z'),
            ],
            ['ko', 'en', 'ja', 'zh']
        );
        expect(picked.map(s => s.content)).toEqual(['technical-ja']);
    });

    it('breaks an exact generatedAt tie by the tie-break order', () => {
        const picked = pickFreshestPerTab(
            [row('technical', 'zh'), row('technical', 'en')],
            ['en', 'ko', 'ja', 'zh']
        );
        expect(picked.map(s => s.content)).toEqual(['technical-en']);
    });

    it('keeps the earlier row when a later one is older', () => {
        const picked = pickFreshestPerTab(
            [
                row('technical', 'ko', '2026-09-12T00:00:00.000Z'),
                row('technical', 'en', '2026-09-10T00:00:00.000Z'),
            ],
            ['en', 'ko']
        );
        expect(picked.map(s => s.content)).toEqual(['technical-ko']);
    });
});

describe('anyLocaleChain', () => {
    it('orders requested locale, then Korean, then the remaining locales without duplicates', () => {
        expect(anyLocaleChain('ja')).toEqual(['ja', 'ko', 'en', 'zh']);
    });

    it('starts with Korean once for a ko request', () => {
        expect(anyLocaleChain('ko')).toEqual(['ko', 'en', 'ja', 'zh']);
    });
});

describe('pickFallbackRowPerSymbolTab', () => {
    const base = { symbol: 'AAPL', tab: 'technical' as const };

    it('keeps the row with the earliest locale in the chain per (symbol, tab)', () => {
        const picked = pickFallbackRowPerSymbolTab(
            [
                { ...base, locale: 'en' as const, id: 'en' },
                { ...base, locale: 'ko' as const, id: 'ko' },
            ],
            ['ko', 'en']
        );
        expect(picked.map(r => r.id)).toEqual(['ko']);
    });

    it('keeps separate rows for different symbols and tabs', () => {
        const picked = pickFallbackRowPerSymbolTab(
            [
                { ...base, locale: 'ko' as const },
                { ...base, symbol: 'MSFT', locale: 'ko' as const },
                { ...base, tab: 'news' as const, locale: 'ko' as const },
            ],
            ['ko', 'en']
        );
        expect(picked).toHaveLength(3);
    });

    it('does not mutate the input order', () => {
        const rows = [
            { ...base, locale: 'en' as const },
            { ...base, locale: 'ko' as const },
        ];
        pickFallbackRowPerSymbolTab(rows, ['ko', 'en']);
        expect(rows.map(r => r.locale)).toEqual(['en', 'ko']);
    });
});
