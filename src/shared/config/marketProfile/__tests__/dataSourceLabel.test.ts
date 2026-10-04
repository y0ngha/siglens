import { dataSourceLabelKey } from '../dataSourceLabel';
import { CRYPTO_DESCRIPTOR } from '../crypto';
import { KR_EQUITY_DESCRIPTOR } from '../krEquity';
import { US_EQUITY_DESCRIPTOR } from '../usEquity';
import type { MarketProfileDescriptor, MarketProfileId } from '../types';
import ko from '../../../../../messages/ko.json';

const NOTE = ko.views.symbol.AnalysisProvenanceNote;

/** 카탈로그 키(`dataSource.usEquity`)로 문구를 읽는다 — 네임스페이스 기준 상대 키다. */
function labelOf(key: string): string {
    const [group, suffix] = key.split('.') as [
        'dataSource' | 'dataSourcePrices',
        'usEquity' | 'krEquity' | 'crypto',
    ];
    return NOTE[group][suffix];
}

const PROFILES: readonly [MarketProfileId, MarketProfileDescriptor][] = [
    ['us-equity', US_EQUITY_DESCRIPTOR],
    ['kr-equity', KR_EQUITY_DESCRIPTOR],
    ['crypto', CRYPTO_DESCRIPTOR],
];

describe('dataSourceLabelKey', () => {
    describe('key mapping', () => {
        it.each([
            ['us-equity', 'dataSource.usEquity'],
            ['kr-equity', 'dataSource.krEquity'],
            ['crypto', 'dataSource.crypto'],
        ] as const)('%s -> %s (analysis is the default scope)', (id, key) => {
            expect(dataSourceLabelKey(id)).toBe(key);
            expect(dataSourceLabelKey(id, 'analysis')).toBe(key);
        });

        it.each([
            ['us-equity', 'dataSourcePrices.usEquity'],
            ['kr-equity', 'dataSourcePrices.krEquity'],
            ['crypto', 'dataSourcePrices.crypto'],
        ] as const)('%s -> %s for the prices-only scope', (id, key) => {
            expect(dataSourceLabelKey(id, 'prices')).toBe(key);
        });

        it('throws on a profile id it does not know instead of borrowing another market', () => {
            expect(() =>
                dataSourceLabelKey('jp-equity' as unknown as MarketProfileId)
            ).toThrow(/Unhandled market profile/);
        });
    });

    /**
     * 정책 문구와 코드가 같다는 것을 못박는다. 문구가 말하는 공급자는 프로필이
     * 실제로 쓰는 `dataProvider`·`newsSource`에서 파생한 이름이어야 한다.
     */
    describe('label text matches the adapters the profile really uses', () => {
        const PROVIDER_NAME = {
            fmp: 'Financial Modeling Prep',
            yahoo: 'Yahoo Finance',
        } as const;
        const NEWS_NAME = {
            stock: 'Financial Modeling Prep',
            crypto: 'Financial Modeling Prep',
            naver: '네이버 뉴스 검색',
        } as const;

        it.each(PROFILES)('%s: price and news providers', (id, descriptor) => {
            const label = labelOf(dataSourceLabelKey(id, 'analysis'));
            expect(label).toContain(PROVIDER_NAME[descriptor.dataProvider]);
            expect(label).toContain(NEWS_NAME[descriptor.newsSource]);
        });

        it.each(PROFILES)(
            '%s: the prices-only label names the price provider and no news source',
            (id, descriptor) => {
                const label = labelOf(dataSourceLabelKey(id, 'prices'));
                expect(label).toContain(PROVIDER_NAME[descriptor.dataProvider]);
                expect(label).not.toMatch(/뉴스/);
            }
        );

        it('pins the concrete provider combination per market', () => {
            expect(US_EQUITY_DESCRIPTOR).toMatchObject({
                dataProvider: 'fmp',
                newsSource: 'stock',
            });
            expect(KR_EQUITY_DESCRIPTOR).toMatchObject({
                dataProvider: 'yahoo',
                newsSource: 'naver',
            });
            expect(CRYPTO_DESCRIPTOR).toMatchObject({
                dataProvider: 'fmp',
                newsSource: 'crypto',
            });
            expect(labelOf('dataSource.krEquity')).toBe(
                '시세 Yahoo Finance, 뉴스 네이버 뉴스 검색'
            );
        });
    });
});
