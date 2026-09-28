import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { grepFiles } from '@/shared/test-utils/grepSource';
import { blankComments } from '@/__tests__/guards/support/sourceScan';

/**
 * `animate-spin`을 쓰는 곳은 같은 className 문자열 안에
 * `motion-reduce:animate-none`을 함께 둔다.
 *
 * 인라인 스피너가 여러 벌로 복제되면서 다섯 곳이 이 짝을 빠뜨렸다
 * (`OptionsAiAnalysisSkeleton`, `AnalysisProgress` 등) — 감소된 모션을
 * 요청한 사용자에게도 계속 회전했다. `src/` 전체를 본다.
 */
const SRC_DIR = path.resolve(__dirname, '../..');
const SCOPES = [SRC_DIR];

function offenders(): string[] {
    const found: string[] = [];
    for (const file of grepFiles('animate-spin', SCOPES)) {
        if (file.includes('__tests__')) continue;
        const source = blankComments(readFileSync(file, 'utf8'));
        // 따옴표·백틱으로 닫힌 문자열 리터럴 단위로 본다 — `cn(...)` 인자처럼
        // 두 토큰이 같은 리터럴에 있어야 한다.
        for (const match of source.matchAll(/(['"`])([^'"`]*?)\1/g)) {
            const literal = match[2];
            if (!/\banimate-spin\b/.test(literal)) continue;
            if (!literal.includes('motion-reduce:animate-none')) {
                found.push(`${path.relative(SRC_DIR, file)}: ${literal}`);
            }
        }
    }
    return found;
}

describe('spinner reduced-motion guard', () => {
    it('every animate-spin literal also carries motion-reduce:animate-none', () => {
        expect(offenders()).toEqual([]);
    });
});
