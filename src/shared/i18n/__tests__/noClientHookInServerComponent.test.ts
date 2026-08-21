import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

/**
 * **`'use client'` 없는 모듈은 클라이언트 전용 훅을 부르면 안 된다.**
 *
 * 서버 컴포넌트에서 클라이언트 모듈의 훅을 부르면 그 서브트리 렌더가 통째로
 * 죽는다:
 *
 *   ⨯ Attempted to call useCurrentLocale() from the server but
 *     useCurrentLocale is on the client.
 *
 * 실제로 그렇게 냈다 — 날짜를 로케일화하면서 `SnapshotSummarySection`에
 * `useCurrentLocale()`을 넣었고, **종목 페이지 본문 전체가 전 로케일에서
 * SSR되지 않았다**(기본 로케일 ko 포함, 봇에는 크롬만 노출). 그런데
 * `tsc`·`oxlint`·테스트 10,697개·프로덕션 빌드가 **전부 통과**했다 —
 * vitest는 모든 모듈을 한 런타임에서 돌려 `'use client'`를 무시하고, 빌드는
 * 그 컴포넌트가 실제로 렌더되는 라우트를 프리렌더하지 않았다.
 *
 * ## 왜 이름을 나열하지 않는가
 *
 * 첫 버전은 `['useCurrentLocale', 'useLocalePath']` 화이트리스트였다. 그 뒤
 * 같은 계열 훅이 셋(`useAssetLabel`·`useSkillLabel`·`useSkillDescription`)
 * 늘었는데 **아무도 목록에 넣지 않았고**, 감사가 그중 하나로 라운드 12의 사고를
 * 그대로 재현했는데도 가드는 초록이었다. 그래서 목록을 **도출**한다:
 * `'use client'` 모듈이 내보내는 `use*`는 전부 대상이다.
 */
describe('클라이언트 전용 훅은 서버 컴포넌트에서 호출되지 않는다', () => {
    const sources = execSync(
        `find ${JSON.stringify(`${ROOT}/src`)} -name '*.ts' -o -name '*.tsx'`,
        { encoding: 'utf8', maxBuffer: 1 << 28 }
    )
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(f => f.replace(`${ROOT}/`, ''))
        .filter(
            rel => !rel.includes('__tests__') && !rel.includes('test-utils')
        );

    const isClientModule = (rel: string) =>
        readFileSync(`${ROOT}/${rel}`, 'utf8').startsWith("'use client'");

    /** `'use client'` 모듈이 내보내는 훅 이름 전부. */
    const clientOnlyHooks = new Map<string, string>();
    for (const rel of sources.filter(isClientModule)) {
        for (const m of readFileSync(`${ROOT}/${rel}`, 'utf8').matchAll(
            // `export function`만 보면 화살표 상수 훅을 놓친다 — 이 레포엔
            // `func-style` 규칙이 없어 그 형태가 린트를 통과한다. 즉 오늘 0건인
            // 건 우연이지, 구조가 막아 주는 게 아니다(감사 실증).
            /export (?:function|const|let) (use[A-Z]\w*)/g
        )) {
            clientOnlyHooks.set(m[1]!, rel);
        }
    }

    it('클라이언트 전용 훅을 실제로 찾아낸다', () => {
        // 0건이면 아래 단언이 통째로 무의미해진다.
        expect(clientOnlyHooks.size).toBeGreaterThan(3);
        expect([...clientOnlyHooks.keys()]).toContain('useCurrentLocale');
    });

    it('위반이 없다', () => {
        const names = [...clientOnlyHooks.keys()];
        const offenders: string[] = [];

        for (const rel of sources.filter(rel => !isClientModule(rel))) {
            // 주석 속 언급은 호출이 아니다 — 이 가드의 근거를 적어 둔 JSDoc이
            // 스스로를 위반으로 잡았다.
            const code = readFileSync(`${ROOT}/${rel}`, 'utf8')
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/(?<![:/])\/\/.*$/gm, '');
            for (const hook of names) {
                if (new RegExp(`\\b${hook}\\(`).test(code)) {
                    offenders.push(`${rel} → ${hook}`);
                }
            }
        }

        expect(offenders).toEqual([]);
    });
});
