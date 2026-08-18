import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * [회귀] provider 팩토리는 **심볼로** 백엔드를 고른다 — 한국 종목이면 yahoo,
 * 아니면 FMP다. 인자를 빠뜨리면 기본값(FMP)으로 조용히 떨어지고, FMP 플랜에
 * KRX가 없어 `005930.KS`의 펀더멘털·재무 탭과 그 AI 프롬프트가 통째로 빈 값이
 * 된다. 이 릴리스가 고친 결함이 정확히 그것이다.
 *
 * 팩토리 자체는 유닛 테스트가 지킨다(한국 심볼이 다른 provider로 간다). 지켜지지
 * 않던 건 **호출부 21곳**이다 — 위임 테스트들이 팩토리를 `() => mockProvider`로
 * mock해 인자를 버리기 때문에, 한 곳에서 인자를 지워도 전부 통과했다(감사 라운드 12).
 *
 * 호출부마다 단언을 붙이는 대신 소스를 훑는다. 새 호출부가 생겨도 자동으로 걸린다.
 */
const FACTORIES = [
    'getFundamentalDataProvider',
    'getFinancialStatementsProvider',
] as const;

const SRC_ROOT = join(import.meta.dirname, '../../../..');

/**
 * 선언부(`export function foo(`)는 인자 목록이 비어 있지 않아 이 패턴에 안 걸린다.
 * 걸리는 건 인자 없는 **호출**뿐이다. 스캔과 자기검사가 **같은** 빌더를 써야
 * 한다 — 각자 리터럴을 들고 있으면 스캔 쪽 패턴이 망가져도 자기검사는 계속 통과한다.
 */
function zeroArgCallRe(factory: string): RegExp {
    return new RegExp(`${factory}\\(\\s*\\)`);
}

function collectSourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            // 테스트는 팩토리를 mock하므로 인자 없이 부르는 것이 정상이다.
            if (entry === '__tests__' || entry === '__integration__') continue;
            collectSourceFiles(full, out);
            continue;
        }
        if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
            out.push(full);
        }
    }
    return out;
}

describe('provider 팩토리 호출부', () => {
    it('심볼 인자 없이 부르는 프로덕션 호출부가 없다', () => {
        const offenders: string[] = [];
        const files = collectSourceFiles(SRC_ROOT);

        // 스캔이 실제로 호출부에 닿았는지 먼저 확인한다 — 테스트 파일이 옮겨지거나
        // 탐색이 망가지면 offenders가 빈 채로 초록이 된다(감사 라운드 13).
        const callSiteFiles = files.filter(f => {
            const src = readFileSync(f, 'utf8');
            return FACTORIES.some(factory => src.includes(`${factory}(`));
        });
        expect(callSiteFiles.length).toBeGreaterThanOrEqual(10);

        for (const file of files) {
            const source = readFileSync(file, 'utf8');
            for (const factory of FACTORIES) {
                if (zeroArgCallRe(factory).test(source)) {
                    offenders.push(
                        `${file.slice(SRC_ROOT.length + 1)} — ${factory}()`
                    );
                }
            }
        }

        expect(offenders).toEqual([]);
    });

    it('가드가 실제로 판별한다 — 인자 없는 호출을 넣으면 잡힌다', () => {
        // 위 테스트가 항진명제가 아님을 보인다: 같은 정규식이 인자 있는 호출은
        // 통과시키고 없는 호출만 잡는다.
        const zeroArg = zeroArgCallRe('getFundamentalDataProvider');
        expect(
            zeroArg.test('getFundamentalDataProvider(symbol).getGrades(s)')
        ).toBe(false);
        expect(zeroArg.test('getFundamentalDataProvider().getGrades(s)')).toBe(
            true
        );
    });
});
