import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SCAN_TIMEOUT_MS, sourceFiles } from './support/controlUsage';
import { blankComments } from './support/sourceScan';

/**
 * **표면 토큰을 경계로 쓰지 않는다.**
 *
 * 이 팔레트에서 `secondary-800`은 카드 표면 그 자체다 — `SURFACE_CARD`가
 * `border-secondary-700 bg-secondary-800`이다. 그래서 `border-secondary-800`은
 * 카드 위에서 **1.00:1**, 페이지 위에서 1.05:1이 된다. 경계를 선언해 놓고
 * 아무 경계도 그리지 않는 상태다.
 *
 * 왜 가드가 필요한가: 이 결함이 페이지별 감사에서 **서로 다른 세 라우트의 서로
 * 다른 세 컴포넌트**에서 독립적으로 보고됐다 — 계정 삭제의 이메일 확인 박스,
 * 비밀번호 찾기의 성공 알림, `/[symbol]/position`의 가이드 카드. 전부 같은
 * 원인인데 발견 경로가 달랐고, 인스턴스만 고쳤다면 남은 것들은 그대로 남았을
 * 것이다(실제로 트리 전체에 45곳이 있었다).
 *
 * master에서는 램프가 넓어(`800 #1e293b` 대 `900 #0f172a`) 같은 클래스가
 * 1.22:1이었다. 트루 블랙 다크 테마로 가면서 램프 아래쪽이 촘촘해졌고, 그
 * 결과 "은은한 경계"였던 것이 "경계 없음"이 됐다. 즉 이 규칙은 팔레트 변경이
 * 만든 것이며 팔레트를 되돌리지 않는 한 계속 필요하다.
 *
 * 대안은 이미 있다: 장식용 경계는 `secondary-700`(카드 위 1.34:1), 컨트롤
 * 경계는 `border-control`(3.57:1 다크 / 3.81:1 라이트).
 */

const SRC_DIR = path.resolve(__dirname, '../..');

/** 표면 값을 나르는 토큰. 경계 유틸리티에 오면 안 된다. */
const SURFACE_STEPS = ['secondary-800', 'secondary-900', 'secondary-950'];

/** 경계를 그리는 유틸리티 접두사. `border-x-`처럼 변에 붙는 변형을 포함한다. */
const BOUNDARY_RE = new RegExp(
    `\\b(?:border|ring|divide|outline)(?:-[xytblrse])?-(${SURFACE_STEPS.join('|')})\\b(?!/)`,
    'g'
);

/**
 * 경계가 아니라 **할로**인 링. 항목을 넣을 때는 왜 대상이 아닌지 함께 적는다.
 *
 * 할로는 주변 표면과 **같아야** 제 일을 한다 — 그 위에 얹힌 도형을 배경에서
 * 오려내는 여백이지 보여줄 선이 아니다. `ring-offset-*`은 이름으로 구분되어
 * 정규식에서 이미 빠지지만, `ring-2`로 직접 그리는 할로는 문법이 경계와 같아
 * 정적으로는 갈리지 않는다.
 */
const ALLOWED: ReadonlySet<string> = new Set([
    // 아바타 위 티어 점을 헤더 배경에서 오려낸다. 헤더가 `bg-secondary-900/90`
    // 이므로 링도 `secondary-900`이어야 점만 떠 보인다.
    'widgets/layout/HeaderUserMenu.tsx::ring-secondary-900',
]);

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
        for (const m of source.matchAll(BOUNDARY_RE)) {
            if (ALLOWED.has(`${rel}::${m[0]}`)) continue;
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

describe('surface as border guard', { timeout: SCAN_TIMEOUT_MS }, () => {
    it('표면 토큰이 경계 유틸리티에 쓰이지 않는다', () => {
        expect(offenders()).toEqual([]);
    });

    it('검출기가 실제로 잡는다', () => {
        const hits = (s: string): string[] =>
            [...s.matchAll(BOUNDARY_RE)].map(m => m[0]);
        expect(hits('border-secondary-800')).toEqual(['border-secondary-800']);
        expect(hits('ring-secondary-800')).toEqual(['ring-secondary-800']);
        expect(hits('border-t-secondary-900')).toEqual([
            'border-t-secondary-900',
        ]);
        // 채움은 대상이 아니다 — 표면 토큰의 본래 용도다.
        expect(hits('bg-secondary-800')).toEqual([]);
        // 허용된 경계 토큰.
        expect(hits('border-secondary-700')).toEqual([]);
        expect(hits('border-border-control')).toEqual([]);
        // 알파가 붙으면 별개 규칙(graphicAlphaContrastGuard)의 몫이다.
        expect(hits('border-secondary-800/50')).toEqual([]);
    });
});
