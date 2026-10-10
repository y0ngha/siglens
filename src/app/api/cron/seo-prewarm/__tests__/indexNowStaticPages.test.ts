vi.mock('server-only', () => ({}));

const { redisFns } = vi.hoisted(() => ({
    redisFns: {
        hgetall: vi.fn(),
        hset: vi.fn(),
    },
}));

vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: vi.fn(() => redisFns),
}));

import type { SitemapEntry } from '@/entities/sitemap-entry/model';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    STATIC_LASTMOD_KEY,
    diffStaticLastmod,
    readStaticLastmods,
    writeStaticLastmods,
} from '../indexNowStaticPages';

function entry(path: string, lastModified?: string): SitemapEntry {
    return {
        url: `https://siglens.io${path}`,
        ...(lastModified === undefined
            ? {}
            : { lastModified: new Date(lastModified) }),
        changeFrequency: 'monthly',
        priority: 0.3,
    };
}

const ENTRIES = [
    entry('/about', '2026-09-01T00:00:00Z'),
    entry('/methodology', '2026-09-02T00:00:00Z'),
    entry('/privacy', '2026-09-03T00:00:00Z'),
    entry('/terms', '2026-09-04T00:00:00Z'),
    entry('/backtesting', '2026-09-05T00:00:00Z'),
    entry('/market', '2026-10-05T00:00:00Z'), // 감시 대상 아님
];

describe('diffStaticLastmod', () => {
    it('가이드 항목(DB 발) URL도 감시한다 — 첫 실행은 전부 제출, 이후는 바뀐 항목만', () => {
        const entries = [
            entry('/guide/candlesticks/doji', '2026-10-01T00:00:00Z'),
            entry('/guide/indicators/rsi', '2026-10-02T00:00:00Z'),
            entry('/guide/unknown/x', '2026-10-02T00:00:00Z'),
        ];
        const first = diffStaticLastmod(entries, {});
        expect([...first.changedUrls].toSorted()).toEqual([
            'https://siglens.io/guide/candlesticks/doji',
            'https://siglens.io/guide/indicators/rsi',
        ]);

        const later = diffStaticLastmod(
            [
                entry('/guide/candlesticks/doji', '2026-10-01T00:00:00Z'),
                entry('/guide/indicators/rsi', '2026-10-09T00:00:00Z'),
            ],
            first.updates
        );
        expect(later.changedUrls).toEqual([
            'https://siglens.io/guide/indicators/rsi',
        ]);
    });

    it('저장된 값이 없으면(첫 실행) 다섯 정적 페이지 전부 변경으로 센다 — 시드 + 1회 제출', () => {
        const diff = diffStaticLastmod(ENTRIES, {});

        expect([...diff.changedUrls].toSorted()).toEqual(
            [
                'https://siglens.io/about',
                'https://siglens.io/backtesting',
                'https://siglens.io/methodology',
                'https://siglens.io/privacy',
                'https://siglens.io/terms',
            ].toSorted()
        );
        expect(diff.updates['https://siglens.io/about']).toBe(
            '2026-09-01T00:00:00.000Z'
        );
    });

    it('lastmod가 같으면 변경이 아니다', () => {
        const stored = Object.fromEntries(
            ENTRIES.filter(e => !e.url.endsWith('/market')).map(e => [
                e.url,
                e.lastModified!.toISOString(),
            ])
        );

        expect(diffStaticLastmod(ENTRIES, stored).changedUrls).toEqual([]);
    });

    it('바뀐 페이지만 돌려준다', () => {
        const stored = Object.fromEntries(
            ENTRIES.map(e => [e.url, e.lastModified!.toISOString()])
        );
        stored['https://siglens.io/terms'] = '2026-01-01T00:00:00.000Z';

        const diff = diffStaticLastmod(ENTRIES, stored);

        expect(diff.changedUrls).toEqual(['https://siglens.io/terms']);
        expect(diff.updates).toEqual({
            'https://siglens.io/terms': '2026-09-04T00:00:00.000Z',
        });
    });

    it('감시 대상이 아닌 URL과 lastmod가 없는 엔트리는 건너뛴다', () => {
        const diff = diffStaticLastmod(
            [entry('/market', '2026-10-05T00:00:00Z'), entry('/about')],
            {}
        );

        expect(diff.changedUrls).toEqual([]);
    });
});

describe('Redis 입출력', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getRedisClient).mockReturnValue(
            redisFns as unknown as import('@upstash/redis').Redis
        );
    });

    it('빈 해시(Upstash가 null을 준다)는 {}', async () => {
        redisFns.hgetall.mockResolvedValue(null);

        expect(await readStaticLastmods()).toEqual({});
    });

    it('값은 String으로 정규화한다', async () => {
        redisFns.hgetall.mockResolvedValue({
            'https://siglens.io/about': '2026-09-01T00:00:00.000Z',
            'https://siglens.io/terms': 12345,
        });

        expect(await readStaticLastmods()).toEqual({
            'https://siglens.io/about': '2026-09-01T00:00:00.000Z',
            'https://siglens.io/terms': '12345',
        });
    });

    it('갱신을 HSET으로 저장하고, 비어 있으면 쓰지 않는다', async () => {
        redisFns.hset.mockResolvedValue(1);

        await writeStaticLastmods({});
        expect(redisFns.hset).not.toHaveBeenCalled();

        await writeStaticLastmods({ 'https://siglens.io/about': 'x' });
        expect(redisFns.hset).toHaveBeenCalledWith(STATIC_LASTMOD_KEY, {
            'https://siglens.io/about': 'x',
        });
    });

    it('Redis가 없으면 읽기는 {}, 쓰기는 무시', async () => {
        vi.mocked(getRedisClient).mockReturnValue(null);

        expect(await readStaticLastmods()).toEqual({});
        await writeStaticLastmods({ a: 'b' });
        expect(redisFns.hset).not.toHaveBeenCalled();
    });
});
