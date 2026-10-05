import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_URL } from '@/shared/lib/seo';
import { STATIC_PAGE_PATHS } from '../lib/staticPagePaths';
import {
    INDEXNOW_DELAY_HOURS,
    classifyIndexNowUrl,
    indexNowNotBeforeMs,
    type IndexNowRouteKind,
} from '../lib/indexNowDelays';

const NOW = Date.parse('2026-10-05T00:00:00Z');
const HOUR = 3_600_000;
const MARGIN = 15 * 60_000;

describe('classifyIndexNowUrl', () => {
    it.each([
        ['https://siglens.io/AAPL', 'symbolChart'],
        ['https://siglens.io/005930.KS', 'symbolChart'],
        ['https://siglens.io/BTCUSD', 'symbolChart'],
        ['https://siglens.io/AAPL/news', 'symbolNews'],
        ['https://siglens.io/market', 'marketHub'],
        ['https://siglens.io/market/kr', 'marketHub'],
        ['https://siglens.io/fear-greed', 'fearGreedHub'],
        ['https://siglens.io/fear-greed/kr', 'fearGreedHub'],
        ['https://siglens.io/fear-greed/crypto', 'fearGreedHub'],
        ['https://siglens.io/news/stock', 'newsCategory'],
        ['https://siglens.io/news', 'newsIndex'],
        ['https://siglens.io/news/us', 'newsIndex'],
        ['https://siglens.io/economy', 'economy'],
        ['https://siglens.io/economy/kr', 'economy'],
        ['https://siglens.io/about', 'staticPage'],
        ['https://siglens.io/methodology', 'staticPage'],
        ['https://siglens.io/privacy', 'staticPage'],
        ['https://siglens.io/terms', 'staticPage'],
        ['https://siglens.io/backtesting', 'staticPage'],
    ] as const)('%s → %s', (url, kind) => {
        expect(classifyIndexNowUrl(url)).toBe(kind);
    });

    it.each([
        'https://siglens.io/', // 홈은 주기 제출하지 않는다
        'https://siglens.io/symbols',
        'https://siglens.io/AAPL/fear-greed', // 종목별 공포탐욕은 주기 제출하지 않는다
        'https://siglens.io/AAPL/overall', // 항상 noindex 탭
        'https://siglens.io/AAPL/fundamental',
        'not a url',
    ])('%s → 제출 대상 아님', url => {
        expect(classifyIndexNowUrl(url)).toBeNull();
    });

    it('끝 슬래시는 무시한다', () => {
        expect(classifyIndexNowUrl('https://siglens.io/AAPL/')).toBe(
            'symbolChart'
        );
    });
});

describe('STATIC_PAGE_PATHS — 감시 대상 정적 페이지', () => {
    it.each([...STATIC_PAGE_PATHS])(
        '%s는 정적 페이지로 분류돼 제출 지연이 정해진다(null이면 변화가 감지돼도 제출되지 않는다)',
        path => {
            expect(classifyIndexNowUrl(`${SITE_URL}${path}`)).toBe(
                'staticPage'
            );
            expect(
                indexNowNotBeforeMs(`${SITE_URL}${path}`, NOW, {
                    invalidatedByCron: false,
                })
            ).not.toBeNull();
        }
    );

    it('다섯 페이지다(소개·방법론·방침·약관·백테스팅)', () => {
        expect([...STATIC_PAGE_PATHS]).toEqual([
            '/about',
            '/methodology',
            '/privacy',
            '/terms',
            '/backtesting',
        ]);
    });
});

describe('indexNowNotBeforeMs', () => {
    it('크론이 태그를 직접 털었으면 한 주기 + 15분', () => {
        expect(
            indexNowNotBeforeMs('https://siglens.io/AAPL', NOW, {
                invalidatedByCron: true,
            })
        ).toBe(NOW + 6 * HOUR + MARGIN);
        expect(
            indexNowNotBeforeMs('https://siglens.io/AAPL/news', NOW, {
                invalidatedByCron: true,
            })
        ).toBe(NOW + 12 * HOUR + MARGIN);
    });

    it('직접 털지 않았으면 두 주기 + 15분', () => {
        expect(
            indexNowNotBeforeMs('https://siglens.io/about', NOW, {
                invalidatedByCron: false,
            })
        ).toBe(NOW + 48 * HOUR + MARGIN);
        expect(
            indexNowNotBeforeMs('https://siglens.io/market', NOW, {
                invalidatedByCron: false,
            })
        ).toBe(NOW + 12 * HOUR + MARGIN);
    });

    it('주기 제출 대상이 아니면 null', () => {
        expect(
            indexNowNotBeforeMs('https://siglens.io/AAPL/fear-greed', NOW, {
                invalidatedByCron: true,
            })
        ).toBeNull();
    });
});

/**
 * 가드 — 지연표의 각 값은 그 종류 페이지의 `export const revalidate` 리터럴 이상이어야 한다.
 * 페이지 주기를 늘리면서 표를 못 따라가면 알림이 옛 렌더를 가리킨다.
 */
describe('지연표 가드 — page.tsx revalidate 리터럴 ≤ 표 값', () => {
    const APP = join(process.cwd(), 'src/app/[locale]');
    const PAGES: Record<IndexNowRouteKind, readonly string[]> = {
        symbolChart: ['[symbol]/page.tsx'],
        symbolNews: ['[symbol]/news/page.tsx'],
        marketHub: ['market/page.tsx', 'market/kr/page.tsx'],
        fearGreedHub: [
            'fear-greed/page.tsx',
            'fear-greed/kr/page.tsx',
            'fear-greed/crypto/page.tsx',
        ],
        newsCategory: ['news/[category]/page.tsx'],
        newsIndex: ['news/page.tsx', 'news/us/page.tsx'],
        economy: ['economy/page.tsx', 'economy/kr/page.tsx'],
        // `/backtesting`은 revalidate 선언이 없다(배포로만 바뀌는 정적 페이지).
        staticPage: [
            'about/page.tsx',
            'methodology/page.tsx',
            'privacy/page.tsx',
            'terms/page.tsx',
        ],
    };

    function revalidateOf(file: string): number {
        const source = readFileSync(join(APP, file), 'utf8');
        const match = /^export const revalidate = (\d+)/m.exec(source);
        expect(
            match,
            `${file}에 revalidate 리터럴이 있어야 한다`
        ).not.toBeNull();
        return Number(match![1]);
    }

    it.each(
        Object.entries(PAGES).flatMap(([kind, files]) =>
            files.map(file => [kind, file] as const)
        )
    )('%s — %s', (kind, file) => {
        const delaySeconds =
            INDEXNOW_DELAY_HOURS[kind as IndexNowRouteKind] * 3600;
        expect(revalidateOf(file)).toBeLessThanOrEqual(delaySeconds);
    });
});
