import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(
    join(process.cwd(), 'db/scripts/verifyContentLocale.ts'),
    'utf8'
);

describe('verifyContentLocale 점검 스크립트', () => {
    /**
     * 폴백 체인을 **복제하지 않고 import**해야 한다. 복제본이 원본과 갈라지면
     * 점검은 초록인데 앱은 다른 순서로 폴백한다 — 진단 도구가 거짓 안심을 주는
     * 최악의 형태다. `contentLocale.ts`에는 `server-only`가 없어 import가 된다.
     */
    it('폴백 체인을 복제하지 않고 import한다', () => {
        expect(SOURCE).toContain(
            "import { CONTENT_LOCALE_FALLBACK } from '../../src/shared/db/contentLocale'"
        );
        expect(SOURCE).toContain('CONTENT_LOCALE_FALLBACK[locale]');
    });

    it('로컬 상수로 체인을 다시 선언하지 않는다', () => {
        expect(SOURCE).not.toMatch(/const FALLBACK\s*[:=]/);
    });

    /** 점검이 행을 쓰면 프로덕션에서 돌릴 수 없다. */
    it('읽기 전용이다 — INSERT/UPDATE/DELETE가 없다', () => {
        expect(SOURCE).not.toMatch(/\b(INSERT|UPDATE|DELETE)\s+(INTO|FROM|\w)/);
    });

    /** 4단계 게이트로 쓰려면 실패가 exit code로 나와야 한다. */
    it('실패 시 exit 1', () => {
        expect(SOURCE).toContain('process.exit(1)');
    });

    /** `backfillContentLocale.ts`와 같은 이유 — DB 계층 import는 실행 불가다. */
    it('server-only에 닿는 모듈을 import하지 않는다', () => {
        const imports = [...SOURCE.matchAll(/from '([^']+)'/g)].map(
            match => match[1]!
        );
        for (const specifier of imports.filter(item =>
            item.includes('/src/')
        )) {
            expect(specifier).not.toMatch(/shared\/db\/(client|schema|types)/);
        }
    });
});
