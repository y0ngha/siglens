import { findSnapshotForLocale } from '@/entities/seo-snapshot/lib/findSnapshotForLocale';
import type { SeoAnalysisSnapshot } from '@/entities/seo-snapshot/model';
import type { Locale } from '@/shared/i18n/locales';

function row(
    tab: SeoAnalysisSnapshot['tab'],
    locale: Locale
): SeoAnalysisSnapshot {
    return {
        symbol: 'NVDA',
        tab,
        locale,
        content: { summary: `${tab}-${locale}` },
        plain: null,
        model: 'm',
        generatedAt: new Date('2026-10-01T00:00:00Z'),
        firstGeneratedAt: null,
        updatedAt: new Date('2026-10-01T00:00:00Z'),
    };
}

describe('findSnapshotForLocale', () => {
    it('does not return a ko row for an en page (en→ko fallback row)', () => {
        expect(
            findSnapshotForLocale([row('technical', 'ko')], 'technical', 'en')
        ).toBeUndefined();
    });

    it('returns the ko row on a ko page', () => {
        const ko = row('technical', 'ko');
        expect(findSnapshotForLocale([ko], 'technical', 'ko')).toBe(ko);
    });

    it('returns an en row on an en page', () => {
        const en = row('technical', 'en');
        expect(findSnapshotForLocale([en], 'technical', 'en')).toBe(en);
    });

    it('filters by tab as well', () => {
        expect(
            findSnapshotForLocale([row('news', 'ko')], 'technical', 'ko')
        ).toBeUndefined();
    });

    it('treats null snapshots (read failure) as no row', () => {
        expect(findSnapshotForLocale(null, 'technical', 'ko')).toBeUndefined();
    });
});
