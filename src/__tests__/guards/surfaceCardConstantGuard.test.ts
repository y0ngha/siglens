import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SURFACE_CARD } from '@/shared/lib/surfaceStyles';

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
 *
 * 2026-10에 카드가 경계선 대신 `.surface-raised` 면으로 바뀌었다. 예전 카드의
 * 토큰 묶음(`rounded-lg border border-secondary-700 bg-secondary-800`)을 손으로 적으면
 * 상수를 피해 옛 선 카드가 되살아나므로 그 묶음도 함께 막는다.
 */

const SRC_DIR = path.resolve(__dirname, '../..');

/** `SURFACE_CARD`의 토큰 — 상수에서 바로 읽어 사본이 낡지 않게 한다. */
const SURFACE_CARD_TOKENS = SURFACE_CARD.split(/\s+/);

/**
 * 경계선 시절 카드의 뼈대 — 손으로 적으면 옛 선 카드가 된다. 채움은 없거나(페이지 위
 * 안내 상자) 알파가 붙은 변형(`bg-secondary-800/50`, `bg-secondary-900/40` 등)까지 모두
 * 같은 카드였으므로 채움 토큰은 보지 않는다.
 *
 * 경계 색은 알파 변형(`border-secondary-700/50`)까지 같은 선이다.
 *
 * 경계선을 유지하는 자리만 뺀다: 크기 그림자(`shadow`, `shadow-sm`~`shadow-2xl`, 변형 접두사
 * 포함 — `shadow-none`·그림자 색은 아니다)가 있는 떠 있는 메뉴·팝오버·토스트, 빈 자리를 뜻하는
 * `border-dashed`, 인셋 우물(`bg-secondary-950` — 코드·키 표시, 입력처럼 파인 자리), 그리고
 * 아래 `ALLOWED_FILES`. 그림자로 빼므로 `shadow-sm`을 덧댄 선 카드는 이 검출기를 지나간다 —
 * 그런 카드는 리뷰에서 본다. 한 `cn()`의 여러 인자로 쪼갠 토큰도 보지 못한다.
 */
const RETIRED_CARD_BASE = ['rounded-lg', 'border'];
const RETIRED_CARD_BORDER_RE = /^border-secondary-700(?:\/\d+)?$/;
const KEEPS_BORDER_RE =
    /^(?:[\w-]+:)*(?:shadow(?:-(?:2xs|xs|sm|md|lg|xl|2xl))?|border-dashed|bg-secondary-950)$/;

/**
 * 선이 정보를 나르는 자리(DESIGN.md §경계 예외). 파일 단위로 둔다 — 한 파일에 한 자리뿐일 때만.
 */
const ALLOWED_FILES: ReadonlySet<string> = new Set([
    // 공유 페이지의 캔들 차트 프레임. 차트 캔버스가 면 전체를 덮어 표면 그림자가 보이지
    // 않으므로 프레임은 선이 맡는다.
    path.join('views', 'share', 'kindPanelRegistry.tsx'),
]);

const DEFINING_FILE = path.join('shared', 'lib', 'surfaceStyles.ts');

const STRING_LITERAL_RE = /(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g;

function hasFullSurfaceCard(literal: string): boolean {
    const tokens = new Set(literal.split(/\s+/));
    if (SURFACE_CARD_TOKENS.every(token => tokens.has(token))) return true;
    const list = [...tokens];
    return (
        RETIRED_CARD_BASE.every(token => tokens.has(token)) &&
        list.some(token => RETIRED_CARD_BORDER_RE.test(token)) &&
        !list.some(token => KEEPS_BORDER_RE.test(token))
    );
}

function offenders(): string[] {
    const out: string[] = [];
    let scanned = 0;
    for (const file of sourceFiles(SRC_DIR)) {
        if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;
        if (/\.test\.tsx?$/.test(file)) continue;
        const rel = path.relative(SRC_DIR, file);
        if (rel === DEFINING_FILE || ALLOWED_FILES.has(rel)) continue;
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
                'surface-raised rounded-lg border border-transparent p-6'
            )
        ).toBe(true);
        // 옛 선 카드 묶음도 잡는다.
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
        // 알파가 붙은 옛 채움도 같은 선 카드다.
        expect(
            hasFullSurfaceCard(
                'rounded-lg border border-secondary-700 bg-secondary-800/50 p-3'
            )
        ).toBe(true);
        // 채움 없는 옛 안내 상자도 같은 선 카드다.
        expect(
            hasFullSurfaceCard(
                'mt-4 rounded-lg border border-secondary-700 px-4'
            )
        ).toBe(true);
        // 알파 경계도, 그림자 아닌 `shadow-none`을 덧대도 같은 선 카드다.
        expect(
            hasFullSurfaceCard('rounded-lg border border-secondary-700/50 p-4')
        ).toBe(true);
        expect(
            hasFullSurfaceCard(
                'rounded-lg border border-secondary-700 shadow-none p-4'
            )
        ).toBe(true);
        // 인셋 우물은 대상이 아니다.
        expect(
            hasFullSurfaceCard(
                'rounded-lg border border-secondary-700 bg-secondary-950 px-3'
            )
        ).toBe(false);
        // 그림자가 있는 떠 있는 메뉴·빈 자리 점선 상자는 경계선을 유지하므로 대상이 아니다.
        expect(
            hasFullSurfaceCard(
                'rounded-lg border border-secondary-700 bg-secondary-900 p-2 shadow-2xl'
            )
        ).toBe(false);
        expect(
            hasFullSurfaceCard(
                'rounded-lg border border-secondary-700 bg-secondary-900 sm:shadow-lg'
            )
        ).toBe(false);
        expect(
            hasFullSurfaceCard(
                'rounded-lg border border-dashed border-secondary-700 px-4'
            )
        ).toBe(false);
        // 일부만 쓰는 다른 표면은 대상이 아니다.
        expect(hasFullSurfaceCard('rounded-lg bg-secondary-800 p-4')).toBe(
            false
        );
        expect(hasFullSurfaceCard('surface-raised rounded-lg px-4')).toBe(
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
