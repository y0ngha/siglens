import { describe, expect, it } from 'vitest';

import { maxLastModified } from '../lib/maxLastModified';
import type { SitemapEntry } from '../model';

const FALLBACK = new Date('2026-05-23T15:30:00.000Z');

function entry(iso: string): SitemapEntry {
    return {
        url: `https://siglens.io/${iso}`,
        lastModified: new Date(iso),
        changeFrequency: 'daily',
        priority: 0.8,
    };
}

describe('maxLastModified', () => {
    it('가장 최근 lastModified를 고른다', () => {
        const result = maxLastModified(
            [
                entry('2026-05-20T00:00:00.000Z'),
                entry('2026-05-22T20:00:00.000Z'),
                entry('2026-05-21T12:00:00.000Z'),
            ],
            FALLBACK
        );

        expect(result.toISOString()).toBe('2026-05-22T20:00:00.000Z');
    });

    it('입력 순서와 무관하게 같은 결과를 준다', () => {
        const entries = [
            entry('2026-05-20T00:00:00.000Z'),
            entry('2026-05-22T20:00:00.000Z'),
        ];

        expect(maxLastModified(entries, FALLBACK).getTime()).toBe(
            maxLastModified([...entries].reverse(), FALLBACK).getTime()
        );
    });

    it('엔트리가 하나면 그 값을 그대로 준다', () => {
        expect(
            maxLastModified([entry('2026-01-02T03:04:05.000Z')], FALLBACK)
        ).toEqual(new Date('2026-01-02T03:04:05.000Z'));
    });

    it('동일한 lastModified가 여러 개여도 그 값을 준다', () => {
        const same = '2026-05-22T20:00:00.000Z';
        expect(
            maxLastModified([entry(same), entry(same), entry(same)], FALLBACK)
        ).toEqual(new Date(same));
    });

    it('엔트리가 비면 fallback을 준다 (Invalid Date 방지)', () => {
        // 이 분기가 이 함수의 존재 이유다 — 설정 목록이 비어도 sitemap index에
        // `<lastmod>Invalid Date</lastmod>`가 나가면 안 된다.
        const result = maxLastModified([], FALLBACK);

        expect(result.getTime()).toBe(FALLBACK.getTime());
        expect(Number.isNaN(result.getTime())).toBe(false);
    });

    it('lastModified가 Unix epoch여도 유효한 값으로 취급한다 (센티널 혼동 금지)', () => {
        // 누적값 0을 "없음"의 센티널로 쓰면 epoch 엔트리가 fallback으로 뒤바뀐다.
        const result = maxLastModified(
            [entry('1970-01-01T00:00:00.000Z')],
            FALLBACK
        );

        expect(result.toISOString()).toBe('1970-01-01T00:00:00.000Z');
        expect(result.getTime()).not.toBe(FALLBACK.getTime());
    });

    it('fallback 분기도 새 Date를 돌려준다 (호출자 변경 격리)', () => {
        const fallback = new Date(FALLBACK.getTime());
        const result = maxLastModified([], fallback);

        expect(result).not.toBe(fallback);
        result.setUTCFullYear(1999);
        expect(fallback.getTime()).toBe(FALLBACK.getTime());
    });

    it('입력 엔트리의 Date 객체를 그대로 돌려주지 않는다 (호출자 변경 격리)', () => {
        const source = entry('2026-05-22T20:00:00.000Z');
        const result = maxLastModified([source], FALLBACK);

        expect(result).not.toBe(source.lastModified);
        result.setUTCFullYear(1999);
        expect(source.lastModified.toISOString()).toBe(
            '2026-05-22T20:00:00.000Z'
        );
    });
});
