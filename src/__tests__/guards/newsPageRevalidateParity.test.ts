import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { NEWS_PAGE_MAX_STALENESS_HOURS } from '@/entities/sitemap-entry/lib/buildNewsSitemapEntries';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

/**
 * **sitemap의 뉴스 카테고리 정체 기준은 카테고리 페이지의 `revalidate`와 같은 길이여야 한다.**
 *
 * `buildNewsSitemapEntries`는 페이지가 ISR로 서빙할 수 있는 목록의 최대 나이
 * (`NEWS_PAGE_MAX_STALENESS_HOURS`)만큼 색인 창을 줄여 카테고리를 싣는다. 라우트 segment config는
 * 리터럴이어야 해서 페이지가 그 상수를 import할 수 없으므로, 두 값이 어긋나지 않는 것을 이
 * 가드가 페이지 소스의 `export const revalidate` 리터럴로 고정한다.
 */
const PAGE_PATH = path.resolve(
    __dirname,
    '../../app/[locale]/news/[category]/page.tsx'
);

describe('뉴스 카테고리 페이지 revalidate 패리티 가드', () => {
    it('NEWS_PAGE_MAX_STALENESS_HOURS는 페이지의 revalidate 리터럴과 같은 길이다', () => {
        const declared = /^export const revalidate = (\d+);/m.exec(
            readFileSync(PAGE_PATH, 'utf8')
        );

        expect(declared).not.toBeNull();
        expect(Number(declared?.[1])).toBe(
            NEWS_PAGE_MAX_STALENESS_HOURS * SECONDS_PER_HOUR
        );
    });
});
