import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SCAN_TIMEOUT_MS, sourceFiles } from './support/controlUsage';
import { blankComments } from './support/sourceScan';

/**
 * **카드 표면은 `SURFACE_CARD`로만 쓴다.**
 *
 * 리디자인 전에는 카드 표면 문자열이 83곳에 복제돼 반경 6종·틴트 20종으로 갈라져
 * 있었다(`shared/lib/surfaceStyles.ts` 주석). 상수로 모은 뒤에도 새 카드는 습관대로
 * 리터럴을 손으로 적었고, 한 번에 90여 곳이 다시 쌓였다 — 코드모드로 걷어낸 뒤
 * 이 가드가 재발을 막는다.
 *
 * 판정: 한 문자열 리터럴 안에 `SURFACE_CARD`의 네 토큰이 **전부**(순서 무관)
 * 있으면 위반이다. 일부만 쓰는 자리(예: `bg-secondary-800`만 쓰는 바텀시트,
 * 경계 없는 셸)는 다른 표면이라 대상이 아니다.
 */

const SRC_DIR = path.resolve(__dirname, '../..');

/** `SURFACE_CARD`의 토큰. 상수가 바뀌면 여기도 같이 바꾼다. */
const SURFACE_CARD_TOKENS = [
    'rounded-lg',
    'border',
    'border-secondary-700',
    'bg-secondary-800',
] as const;

const DEFINING_FILE = path.join('shared', 'lib', 'surfaceStyles.ts');

const STRING_LITERAL_RE = /(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g;

function hasFullSurfaceCard(literal: string): boolean {
    const tokens = new Set(literal.split(/\s+/));
    return SURFACE_CARD_TOKENS.every(token => tokens.has(token));
}

function offenders(): string[] {
    const out: string[] = [];
    let scanned = 0;
    for (const file of sourceFiles(SRC_DIR)) {
        if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;
        if (/\.test\.tsx?$/.test(file)) continue;
        const rel = path.relative(SRC_DIR, file);
        if (rel === DEFINING_FILE) continue;
        scanned += 1;
        const source = blankComments(readFileSync(file, 'utf8'));
        for (const m of source.matchAll(STRING_LITERAL_RE)) {
            if (!hasFullSurfaceCard(m[2])) continue;
            const line = source.slice(0, m.index).split('\n').length;
            out.push(`${rel}:${line}`);
        }
    }
    // 분모를 남긴다 — 스캐너가 파일을 못 열어도 위반 0건과 출력이 같아진다.
    if (scanned < 500) {
        throw new Error(`스캔한 파일이 ${scanned}개뿐이다 — 스캐너를 볼 것`);
    }
    return out.sort();
}

describe('surface card constant guard', { timeout: SCAN_TIMEOUT_MS }, () => {
    it('SURFACE_CARD 토큰 묶음을 손으로 적지 않는다', () => {
        expect(offenders()).toEqual([]);
    });

    it('검출기가 실제로 잡는다', () => {
        expect(
            hasFullSurfaceCard(
                'rounded-lg border border-secondary-700 bg-secondary-800 p-6'
            )
        ).toBe(true);
        // 순서 무관.
        expect(
            hasFullSurfaceCard(
                'p-4 bg-secondary-800 border-secondary-700 border rounded-lg'
            )
        ).toBe(true);
        // 일부만 쓰는 다른 표면은 대상이 아니다.
        expect(hasFullSurfaceCard('rounded-lg bg-secondary-800 p-4')).toBe(
            false
        );
        // 알파가 붙은 틴트나 변 경계는 다른 토큰이다.
        expect(
            hasFullSurfaceCard(
                'rounded-lg border-l border-secondary-700 bg-secondary-800/40'
            )
        ).toBe(false);
    });
});
