import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src', 'scripts', 'messages'].map(d => join(process.cwd(), d));
const EXT = /\.(ts|tsx|mjs|json)$/;

function collect(dir: string, acc: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) collect(full, acc);
        else if (EXT.test(name)) acc.push(full);
    }
    return acc;
}

/**
 * 소스에 NUL 바이트 금지.
 *
 * `texts.join('\0')`을 쓰려다 리터럴 NUL이 파일에 박혔고, git이 그 파일을
 * **바이너리로 분류**했다(`Bin 0 -> 6314 bytes`). 커밋 diff에 내용이 한 줄도 안
 * 나와 코드 리뷰가 구조적으로 불가능했다 — 실제로 감사 하나는 그 자리를
 * `join(' ')`으로 잘못 읽었다(NUL이 화면에 안 보인다).
 *
 * ## 왜 grep이 아니라 Node로 읽는가
 *
 * 첫 버전은 `sh -c "grep -rlP '\x00' … || true"`였는데, macOS의 BSD grep은
 * `-P`를 거부하고(`invalid option -- P`) `|| true`가 그 실패를 "위반 없음"으로
 * 바꿔 **가드가 영구히 통과**했다. NUL을 심어 재현 확인했다. 개발자가 실제로
 * 게이트를 도는 곳은 pre-push(로컬)라 CI에서만 도는 가드는 없는 것과 같다.
 * 바이트를 직접 읽으면 플랫폼 분기도 셸도 없다.
 */
describe('소스 바이너리 오염 가드', () => {
    const files = ROOTS.flatMap(root => collect(root));

    it('검사 대상을 실제로 수집한다', () => {
        expect(files.length).toBeGreaterThan(500);
    });

    it('NUL 바이트가 없다', () => {
        const offenders = files.filter(f => readFileSync(f).includes(0));
        expect(offenders).toEqual([]);
    });
});
