import type { OverallAnalysisResponse } from '@y0ngha/siglens-core';
import {
    hasOptionsSection,
    shouldHighlightReanalyze,
} from '@/widgets/overall/utils/optionsSection';

const BASE: OverallAnalysisResponse = {
    headlineKo: '헤드라인',
    technicalBulletsKo: [],
    fundamentalBulletsKo: [],
    newsBulletsKo: [],
    optionsBulletsKo: ['감마 상승'],
    financialsBulletsKo: [],
    integratedConclusionKo: '결론',
    scenarios: [],
    riskFactorsKo: [],
    optionsOiStale: true,
};

describe('hasOptionsSection', () => {
    it.each([
        ['equity', true, true],
        ['equity', false, false],
        ['crypto', true, false],
        ['crypto', false, false],
    ] as const)(
        '%s / hasOptions=%s → %s',
        (assetClass, hasOptions, expected) => {
            expect(hasOptionsSection(assetClass, hasOptions)).toBe(expected);
        }
    );
});

describe('shouldHighlightReanalyze', () => {
    it('옵션 섹션이 보이고 bullet이 있고 OI가 stale이면 강조한다', () => {
        expect(shouldHighlightReanalyze(BASE, 'equity', true)).toBe(true);
    });

    it('옵션 탭이 없는 종목은 stale 데이터가 있어도 강조하지 않는다', () => {
        expect(shouldHighlightReanalyze(BASE, 'equity', false)).toBe(false);
    });

    it('크립토는 강조하지 않는다', () => {
        expect(shouldHighlightReanalyze(BASE, 'crypto', true)).toBe(false);
    });

    it('옵션 bullet이 비면 강조하지 않는다', () => {
        expect(
            shouldHighlightReanalyze(
                { ...BASE, optionsBulletsKo: [] },
                'equity',
                true
            )
        ).toBe(false);
    });

    it('OI가 stale이 아니면 강조하지 않는다', () => {
        expect(
            shouldHighlightReanalyze(
                { ...BASE, optionsOiStale: false },
                'equity',
                true
            )
        ).toBe(false);
    });

    it('optionsOiStale 필드가 없으면 stale이 아닌 것으로 본다', () => {
        const { optionsOiStale: _omitted, ...withoutField } = BASE;
        expect(shouldHighlightReanalyze(withoutField, 'equity', true)).toBe(
            false
        );
    });
});
