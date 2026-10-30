const { mockReadHubContentStamp } = vi.hoisted(() => ({
    mockReadHubContentStamp: vi.fn(),
}));
vi.mock('@/shared/cache/hubContentStamp', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/shared/cache/hubContentStamp')
    >()),
    readHubContentStamp: mockReadHubContentStamp,
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    buildRssItem,
    DESCRIPTION_MAX_LENGTH,
    toDescription,
    toParagraphs,
} from '@/app/api/rss/_lib/buildRssItem';
import type { RssSource } from '@/app/api/rss/sources';
import { hashHubBody } from '@/shared/cache/hubContentStamp';
import { SITE_URL } from '@/shared/lib/seo';

const STAMP_AT = '2026-10-04T03:00:00.000Z';
const PATH = '/market/us';
const LINK = `${SITE_URL}${PATH}`;
const BODY = { summary: 'x' };
const PROSE = '미국 지수는 **상승**했습니다. 기술주가 이끌었습니다.';

function source(overrides: Partial<RssSource> = {}): RssSource {
    return {
        surface: 'market-us',
        title: '미국 시장 브리핑',
        path: PATH,
        read: async () => ({ body: BODY, prose: PROSE }),
        ...overrides,
    } as RssSource;
}

const declared = new Set([LINK]);

function stampMatching(at: string = STAMP_AT): void {
    mockReadHubContentStamp.mockResolvedValue({
        hash: hashHubBody(BODY),
        at,
    });
}

describe('toDescription', () => {
    it('마크다운을 떼고 한 줄로 합친다', () => {
        expect(toDescription('첫 문장입니다.\n\n둘째 문장입니다.')).toBe(
            '첫 문장입니다. 둘째 문장입니다.'
        );
    });

    it('상한을 넘으면 문장 경계에서 줄인다', () => {
        const sentence = '가나다라마바사아자차카타파하.';
        const long = sentence.repeat(100);
        const result = toDescription(long);
        expect(result.length).toBeLessThanOrEqual(DESCRIPTION_MAX_LENGTH);
        expect(result.endsWith('.')).toBe(true);
    });

    it('문장 종결 부호가 없는 긴 글도 상한 안으로 자른다', () => {
        const result = toDescription('가'.repeat(DESCRIPTION_MAX_LENGTH * 2));
        expect(Array.from(result).length).toBeLessThanOrEqual(
            DESCRIPTION_MAX_LENGTH + 1
        );
    });
});

describe('toParagraphs', () => {
    it('줄 단위로 나누고 빈 줄과 앞뒤 공백을 버린다', () => {
        expect(toParagraphs('  첫 줄  \n\n둘째 줄\n   \n')).toEqual([
            '첫 줄',
            '둘째 줄',
        ]);
    });

    it('마크다운 강조 표시를 뗀다', () => {
        expect(toParagraphs('**굵게** 쓴 글')).toEqual(['굵게 쓴 글']);
    });
});

describe('buildRssItem', () => {
    beforeEach(() => {
        mockReadHubContentStamp.mockReset();
    });

    it('스탬프가 본문과 맞으면 항목을 만든다', async () => {
        stampMatching();

        const item = await buildRssItem(source(), declared);

        expect(item).toEqual({
            title: '미국 시장 브리핑 (10월 4일)',
            link: LINK,
            guid: `${LINK}#${hashHubBody(BODY).slice(0, 12)}`,
            pubDate: new Date(STAMP_AT),
            description: '미국 지수는 상승했습니다. 기술주가 이끌었습니다.',
            paragraphs: ['미국 지수는 상승했습니다. 기술주가 이끌었습니다.'],
        });
    });

    it('경로가 없는 소스는 null이다', async () => {
        expect(await buildRssItem(source({ path: null }), declared)).toBeNull();
    });

    it('정적 sitemap에 없는 허브는 null이고 본문을 읽지도 않는다', async () => {
        const read = vi.fn();
        expect(
            await buildRssItem(source({ read }), new Set<string>())
        ).toBeNull();
        expect(read).not.toHaveBeenCalled();
    });

    it('본문을 읽지 못하면 null이다', async () => {
        expect(
            await buildRssItem(source({ read: async () => null }), declared)
        ).toBeNull();
    });

    it('스탬프가 없으면 null이다', async () => {
        mockReadHubContentStamp.mockResolvedValue(null);
        expect(await buildRssItem(source(), declared)).toBeNull();
    });

    it('스탬프 해시가 본문과 다르면 null이다', async () => {
        mockReadHubContentStamp.mockResolvedValue({
            hash: hashHubBody({ summary: 'other' }),
            at: STAMP_AT,
        });
        expect(await buildRssItem(source(), declared)).toBeNull();
    });

    it('스탬프 시각이 날짜로 해석되지 않으면 null이다', async () => {
        stampMatching('not-a-date');
        expect(await buildRssItem(source(), declared)).toBeNull();
    });

    it('설명이 빈 문자열이면 null이다', async () => {
        stampMatching();
        expect(
            await buildRssItem(
                source({ read: async () => ({ body: BODY, prose: '   ' }) }),
                declared
            )
        ).toBeNull();
    });
});
