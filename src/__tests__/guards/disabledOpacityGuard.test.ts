import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SCAN_TIMEOUT_MS, sourceFiles } from './support/controlUsage';
import { blankComments } from './support/sourceScan';

/**
 * **비활성 상태를 `opacity-*`로 표현하지 않는다.**
 *
 * `opacity`는 전경·배경·경계를 **한꺼번에** 페이지 배경 쪽으로 끌어당긴다.
 * 글자만 흐려지는 게 아니라 글자와 그 밑판이 같이 흐려지므로 둘 사이의 대비가
 * 무너진다. 실측(양 테마, 12개 사이트 22조합)에서 4.5:1을 넘긴 것은 2조합뿐
 * 이었고, 라이트 테마는 **전부** 미달이었다 — 최저 1.51:1.
 *
 * 라이트가 특히 나쁜 이유가 이 규칙이 리디자인에서 생긴 이유다. 다크에서는
 * 채운 버튼을 어두운 페이지 쪽으로 끌면 흰 글자와의 거리가 어느 정도 남지만,
 * 라이트에서는 밑판과 글자가 **같은 흰 배경으로 함께 수렴**해 버튼이 종잇장이
 * 된다. 다크 전용이던 master에서는 무해했고 라이트를 들인 이 브랜치에서
 * 처음 결함이 된다.
 *
 * 대안은 명시적 토큰이다. 실측값(다크 / 라이트):
 *
 *  - 채운 컨트롤 `disabled:bg-secondary-700 disabled:text-secondary-500`
 *    → 4.89 / 5.49
 *  - 고스트·경계 컨트롤 `disabled:text-secondary-500` → 6.84 / 6.34
 *  - 색을 띤 경계는 `disabled:border-border-control`로 함께 중화 → 3.57 / 3.81
 *
 * 이 가드가 필요한 이유는 규칙이 이미 **두 번 드리프트했기** 때문이다
 * (MISTAKES.md #18의 "Recurring": W6b 타임프레임 버튼, W6c 스위치). 인스턴스만
 * 고치면 다음 컴포넌트가 같은 자리에 다시 쓴다 — 실제로 그 두 번을 고친 뒤에도
 * 트리에 12곳이 남아 있었다.
 */

const SRC_DIR = path.resolve(__dirname, '../..');

/**
 * 비활성 계열 variant에 붙은 `opacity-*`. Tailwind는 variant를 겹쳐 쓸 수
 * 있으므로(`disabled:hover:opacity-50`) 사이에 다른 variant가 끼는 형태까지
 * 잡는다.
 */
const DISABLED_OPACITY_RE =
    /\b(?:group-|peer-)?(?:disabled|aria-disabled)(?::[a-z-]+)*:opacity-\d+\b/g;

interface Offence {
    where: string;
    utility: string;
}

function offenders(): Offence[] {
    const out: Offence[] = [];
    let scanned = 0;
    for (const file of sourceFiles(SRC_DIR)) {
        if (file.includes(`${path.sep}__tests__${path.sep}`)) continue;
        scanned += 1;
        const source = blankComments(readFileSync(file, 'utf8'));
        const rel = path.relative(SRC_DIR, file);
        for (const m of source.matchAll(DISABLED_OPACITY_RE)) {
            out.push({
                where: `${rel}:${source.slice(0, m.index).split('\n').length}`,
                utility: m[0],
            });
        }
    }
    // 분모를 남긴다 — 스캐너가 파일을 못 열어도 위반 0건과 출력이 같아진다.
    if (scanned < 500) {
        throw new Error(`스캔한 파일이 ${scanned}개뿐이다 — 스캐너를 볼 것`);
    }
    return out.sort((a, b) => a.where.localeCompare(b.where));
}

describe('disabled opacity guard', { timeout: SCAN_TIMEOUT_MS }, () => {
    it('비활성 상태를 opacity로 표현하지 않는다', () => {
        expect(offenders()).toEqual([]);
    });

    it('검출기가 실제로 잡는다', () => {
        const hits = (s: string): string[] =>
            [...s.matchAll(DISABLED_OPACITY_RE)].map(m => m[0]);
        expect(hits('disabled:opacity-50')).toEqual(['disabled:opacity-50']);
        expect(hits('disabled:opacity-40')).toEqual(['disabled:opacity-40']);
        expect(hits('group-disabled:opacity-60')).toEqual([
            'group-disabled:opacity-60',
        ]);
        expect(hits('aria-disabled:opacity-50')).toEqual([
            'aria-disabled:opacity-50',
        ]);
        // variant가 겹쳐도 잡는다.
        expect(hits('disabled:hover:opacity-50')).toEqual([
            'disabled:hover:opacity-50',
        ]);
        // 권장 대안은 통과한다.
        expect(hits('disabled:text-secondary-500')).toEqual([]);
        expect(hits('disabled:bg-secondary-700')).toEqual([]);
        expect(hits('disabled:border-border-control')).toEqual([]);
        // 비활성과 무관한 opacity는 이 규칙의 대상이 아니다 — 장식·전이·
        // 애니메이션에서 정당하게 쓰인다.
        expect(hits('opacity-50')).toEqual([]);
        expect(hits('hover:opacity-80')).toEqual([]);
    });
});
