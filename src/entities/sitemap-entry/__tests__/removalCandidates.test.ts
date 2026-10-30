import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';

import {
    REMOVAL_CHART_CUTOFF_ISO,
    REMOVAL_LEGACY_TAB_CUTOFF_ISO,
} from '../model';
import {
    PROTECTED_SITEMAP_SYMBOLS,
    excludeProtectedSymbols,
    removalCutoffIsoFor,
} from '../lib/removalCandidates';

describe('removalCutoffIsoFor', () => {
    it('차트는 신규 컷오프를 쓴다', () => {
        expect(removalCutoffIsoFor('chart')).toBe(REMOVAL_CHART_CUTOFF_ISO);
        expect(removalCutoffIsoFor('chart')).toBe('2026-07-07T16:25:18.000Z');
    });

    it.each(['news', 'overall', 'fundamental', 'fear-greed'] as const)(
        '%s 탭은 레거시 컷오프를 쓴다',
        kind => {
            expect(removalCutoffIsoFor(kind)).toBe(
                REMOVAL_LEGACY_TAB_CUTOFF_ISO
            );
            expect(removalCutoffIsoFor(kind)).toBe('2026-06-15T08:36:58.000Z');
        }
    );
});

describe('PROTECTED_SITEMAP_SYMBOLS', () => {
    it('대문자이고 정렬돼 있으며 중복이 없다', () => {
        expect(PROTECTED_SITEMAP_SYMBOLS).toEqual(
            [...new Set(PROTECTED_SITEMAP_SYMBOLS)].toSorted()
        );
        expect(PROTECTED_SITEMAP_SYMBOLS).toEqual(
            PROTECTED_SITEMAP_SYMBOLS.map(symbol => symbol.toUpperCase())
        );
    });

    it('인기 종목을 포함한다', () => {
        expect(PROTECTED_SITEMAP_SYMBOLS).toContain(
            POPULAR_TICKERS[0]?.toUpperCase()
        );
    });
});

describe('excludeProtectedSymbols', () => {
    it('색인 대상 심볼을 대소문자와 무관하게 제외한다', () => {
        const protectedSymbol = PROTECTED_SITEMAP_SYMBOLS[0] ?? '';

        expect(
            excludeProtectedSymbols([
                protectedSymbol.toLowerCase(),
                'ZZZ-NOT-PROTECTED',
            ])
        ).toEqual(['ZZZ-NOT-PROTECTED']);
    });

    it('입력 순서를 유지한다', () => {
        expect(excludeProtectedSymbols(['ZZB-X', 'ZZA-X'])).toEqual([
            'ZZB-X',
            'ZZA-X',
        ]);
    });
});
