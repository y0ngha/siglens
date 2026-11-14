import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
    NOINDEX_DEGRADED_RENDER_TAG,
    isExpiredDegradedEntry,
} from '../degradedEntry.mjs';

const NOW = Date.now();
const SECOND = 1000;

function entry(overrides = {}) {
    return {
        value: { kind: 'APP_PAGE', html: 'degraded' },
        lastModified: NOW - 301 * SECOND,
        tags: ['symbol:V', NOINDEX_DEGRADED_RENDER_TAG],
        cacheControl: { revalidate: 300, expire: 31536000 },
        ...overrides,
    };
}

describe('isExpiredDegradedEntry', () => {
    it('degrade 태그가 있고 revalidate 창을 넘겼으면 true', () => {
        expect(isExpiredDegradedEntry(entry(), NOW)).toBe(true);
    });

    it('창 안이면 false — 방금 만든 degrade 사본은 그대로 서빙한다', () => {
        expect(
            isExpiredDegradedEntry(
                entry({ lastModified: NOW - 299 * SECOND }),
                NOW
            )
        ).toBe(false);
    });

    it('degrade 태그가 없으면 아무리 오래돼도 false — 정상 사본의 SWR은 건드리지 않는다', () => {
        expect(
            isExpiredDegradedEntry(
                entry({
                    tags: ['symbol:V'],
                    lastModified: NOW - 86_400 * SECOND,
                }),
                NOW
            )
        ).toBe(false);
    });

    it('엔트리에 영속된 revalidate를 창으로 쓴다', () => {
        const short = entry({
            lastModified: NOW - 61 * SECOND,
            cacheControl: { revalidate: 60, expire: 31536000 },
        });
        expect(isExpiredDegradedEntry(short, NOW)).toBe(true);
        expect(isExpiredDegradedEntry(short, NOW - 2 * SECOND)).toBe(false);
    });

    it.each([
        ['cacheControl 없음(옛 엔트리)', undefined],
        ['revalidate:false', { revalidate: false }],
        ['revalidate:0', { revalidate: 0 }],
    ])('%s이면 기본 창 300초로 판정한다', (_label, cacheControl) => {
        expect(
            isExpiredDegradedEntry(
                entry({ cacheControl, lastModified: NOW - 301 * SECOND }),
                NOW
            )
        ).toBe(true);
        expect(
            isExpiredDegradedEntry(
                entry({ cacheControl, lastModified: NOW - 299 * SECOND }),
                NOW
            )
        ).toBe(false);
    });

    it.each([
        ['tags 없음', { tags: undefined }],
        ['tags가 배열이 아님', { tags: 'noindex-degraded-render' }],
    ])('%s이면 false', (_label, overrides) => {
        expect(isExpiredDegradedEntry(entry(overrides), NOW)).toBe(false);
    });

    it('entry가 없으면 false', () => {
        expect(isExpiredDegradedEntry(null, NOW)).toBe(false);
    });
});

/**
 * 핸들러는 번들 밖 평문 ESM이라 앱 소스의 상수를 import할 수 없다. 두 값이 어긋나면 페이지에 남는
 * 태그와 핸들러가 찾는 태그가 달라져 이 보호가 조용히 꺼진다 — 소스 텍스트로 같은 값인지 고정한다.
 */
describe('NOINDEX_DEGRADED_RENDER_TAG — 앱 소스와 같은 값', () => {
    const APP_SOURCE = readFileSync(
        fileURLToPath(
            new URL(
                '../../src/shared/cache/buildDegradedRevalidate.ts',
                import.meta.url
            )
        ),
        'utf8'
    );

    it('buildDegradedRevalidate.ts가 같은 문자열을 선언한다', () => {
        const declared =
            /export const NOINDEX_DEGRADED_RENDER_TAG = '([^']+)';/.exec(
                APP_SOURCE
            );
        expect(declared?.[1]).toBe(NOINDEX_DEGRADED_RENDER_TAG);
    });

    it('그 태그를 다는 핀은 하나뿐이다 — 일반 런타임 degrade 핀은 달지 않는다', () => {
        expect(
            APP_SOURCE.match(/tags: \[NOINDEX_DEGRADED_RENDER_TAG\]/g)
        ).toHaveLength(1);
    });

    it('기본 창이 런타임 degrade revalidate와 같다', () => {
        const seconds =
            /export const RUNTIME_DEGRADED_REVALIDATE_SECONDS = (\d+);/.exec(
                APP_SOURCE
            );
        const stale = entry({
            cacheControl: undefined,
            lastModified: NOW - (Number(seconds?.[1]) + 1) * SECOND,
        });
        const fresh = entry({
            cacheControl: undefined,
            lastModified: NOW - (Number(seconds?.[1]) - 1) * SECOND,
        });
        expect(isExpiredDegradedEntry(stale, NOW)).toBe(true);
        expect(isExpiredDegradedEntry(fresh, NOW)).toBe(false);
    });
});
