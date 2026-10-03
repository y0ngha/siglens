import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

/**
 * `src/shared/cache/buildDegradedRevalidate.ts` 전제 가드.
 *
 * 그 헬퍼는 렌더 중 `unstable_cache(..., { revalidate: 60 })`를 불러 페이지 revalidate를
 * 낮춘다. 공개 문서가 보장하는 동작이 아니라 Next 내부 구현(중첩되지 않은 호출이
 * prerender 스토어의 `revalidate`를 min으로 낮추는 분기)에 기대므로, Next를 올렸을 때
 * 그 분기가 사라지면 빌드 degrade 페이지가 조용히 라우트 기본 revalidate(1h~24h)로
 * 굳는다. 설치된 소스를 직접 읽어 분기가 남아 있는지 고정한다.
 */
const require = createRequire(import.meta.url);
const SOURCE = readFileSync(
    require.resolve('next/dist/server/web/spec-extension/unstable-cache.js'),
    'utf8'
);
const HINT =
    'Next 업그레이드로 unstable_cache의 revalidate 하향 분기가 바뀌었다 — ' +
    'src/shared/cache/buildDegradedRevalidate.ts의 60초 degrade revalidate 메커니즘을 재검증할 것';

/** 중첩 판정(`isNestedUnstableCache = true`)을 포함한 store-type switch 블록. */
function storeTypeSwitch(): string {
    const nestedAt = SOURCE.indexOf('isNestedUnstableCache = true');
    const switchAt = SOURCE.lastIndexOf('switch(workUnitStore.type)', nestedAt);
    return nestedAt === -1 || switchAt === -1
        ? ''
        : SOURCE.slice(switchAt, nestedAt);
}

describe('next unstable_cache — prerender revalidate 하향 분기', () => {
    it('store-type switch와 중첩 unstable-cache 판정이 존재한다', () => {
        expect(storeTypeSwitch(), HINT).not.toBe('');
    });

    it('prerender-legacy 스토어(cacheComponents 비활성 ISR)를 그 분기가 다룬다', () => {
        expect(storeTypeSwitch(), HINT).toContain("case 'prerender-legacy':");
    });

    it('더 짧은 revalidate로만 스토어 값을 낮춘다', () => {
        const block = storeTypeSwitch();
        expect(block, HINT).toContain('workUnitStore.revalidate < revalidate');
        expect(block, HINT).toContain('workUnitStore.revalidate = revalidate');
    });
});
