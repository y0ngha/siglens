import { beforeAll, describe, expect, it } from 'vitest';
import { getTranslations } from 'next-intl/server';
import type { AssetClass } from '@/shared/config/marketProfile';
import {
    buildSymbolCongressSeoContent,
    buildSymbolFinancialsSeoContent,
    buildSymbolFundamentalSeoContent,
    buildSymbolOptionsSeoContent,
    resolveSymbolNewsSeoContent,
    resolveSymbolOverallSeoContent,
    resolveSymbolSeoContent,
    symbolTabDescriptionLabel,
    type SeoTranslator,
    type SymbolSeoContent,
    type SymbolSeoTab,
} from '@/shared/lib/seo';

let t: SeoTranslator;
beforeAll(async () => {
    t = await getTranslations({ locale: 'ko', namespace: 'shared.seo' });
});

/**
 * 드리프트 가드.
 *
 * `symbolTabDescriptionLabel`은 제목을 만드는 builder와 **다른 테이블**에서
 * `titleCore` 키를 고른다(모듈 doc 참고). 두 테이블이 어긋나면 description
 * 프리픽스가 제목과 다른 말을 하게 되는데, 컴파일러는 둘 다 `string`이라
 * 아무것도 잡지 못한다. 제목은 `{주어} {titleCore} — {tail}` 형태로 조립되므로,
 * "제목이 라벨을 포함한다"가 두 테이블을 묶는 가장 싼 단언이다.
 */
const CASES: ReadonlyArray<
    readonly [SymbolSeoTab, AssetClass, (t: SeoTranslator) => SymbolSeoContent]
> = [
    [
        'technical',
        'equity',
        tr => resolveSymbolSeoContent('AAPL', 'equity', tr, opts),
    ],
    [
        'technical',
        'crypto',
        tr => resolveSymbolSeoContent('BTCUSD', 'crypto', tr, opts),
    ],
    [
        'overall',
        'equity',
        tr => resolveSymbolOverallSeoContent('AAPL', 'equity', tr, opts),
    ],
    [
        'overall',
        'crypto',
        tr => resolveSymbolOverallSeoContent('BTCUSD', 'crypto', tr, opts),
    ],
    [
        'news',
        'equity',
        tr => resolveSymbolNewsSeoContent('AAPL', 'equity', tr, opts),
    ],
    [
        'news',
        'crypto',
        tr => resolveSymbolNewsSeoContent('BTCUSD', 'crypto', tr, opts),
    ],
    [
        'fundamental',
        'equity',
        tr => buildSymbolFundamentalSeoContent('AAPL', tr, opts),
    ],
    [
        'financials',
        'equity',
        tr => buildSymbolFinancialsSeoContent('AAPL', tr, opts),
    ],
    [
        'congress',
        'equity',
        tr => buildSymbolCongressSeoContent('AAPL', tr, opts),
    ],
    ['options', 'equity', tr => buildSymbolOptionsSeoContent('AAPL', tr, opts)],
];

/** 짧은 주어 — title 예산에 밀려 `titleCore`가 잘리면 단언이 무의미해진다. */
const opts = { displayName: 'AAPL', locale: 'ko' } as const;

describe('symbolTabDescriptionLabel', () => {
    it.each(CASES)(
        '%s/%s — 라벨이 그 탭 제목 안에 그대로 들어 있다',
        (tab, assetClass, build) => {
            const label = symbolTabDescriptionLabel(tab, assetClass, t);

            expect(label).not.toBe('');
            expect(build(t).title).toContain(label);
        }
    );

    it('crypto 변형이 없는 탭은 assetClass와 무관하게 같은 라벨이다', () => {
        for (const tab of [
            'fundamental',
            'financials',
            'congress',
            'options',
        ] as const) {
            expect(symbolTabDescriptionLabel(tab, 'crypto', t)).toBe(
                symbolTabDescriptionLabel(tab, 'equity', t)
            );
        }
    });

    it('crypto 변형이 있는 탭은 자산군에 따라 라벨이 갈린다', () => {
        for (const tab of ['technical', 'overall', 'news'] as const) {
            expect(symbolTabDescriptionLabel(tab, 'crypto', t)).not.toBe(
                symbolTabDescriptionLabel(tab, 'equity', t)
            );
        }
    });
});
