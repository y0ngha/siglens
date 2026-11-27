import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

function hasExitStatus(error: unknown, status: number): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        Reflect.get(error, 'status') === status
    );
}

/**
 * 소스 레벨 가드용 grep.
 *
 * `grep ... || true`를 쓰면 안 되는 이유: grep은 **매치 없음(1)**과 **실행 실패
 * (2, 경로 오타·권한)**를 다른 코드로 구분하는데 `|| true`가 둘을 똑같이 "통과"로
 * 만든다. 경로 하나만 틀려도 가드가 영원히 초록으로 거짓말한다.
 * 여기서는 1만 빈 결과로 받고 2 이상은 던진다.
 *
 * 그런데 "없는 경로 = 종료 코드 2"는 GNU grep만의 동작이다. macOS 기본 BSD grep은
 * 없는 경로에도 1을 돌려줘서, 개발자 맥에서는 경로 오타가 "매치 없음"으로 읽혀
 * 가드가 거짓 초록이 됐다(CI의 GNU grep에서만 잡혔다). 그래서 grep 구현에 기대지
 * 않고 실행 전에 경로 존재를 직접 확인한다.
 */
export function grepFiles(pattern: string, paths: readonly string[]): string[] {
    const missing = paths.filter(path => !existsSync(path));
    if (missing.length > 0) {
        throw new Error(
            `grepFiles: path does not exist: ${missing.join(', ')}`
        );
    }
    try {
        const out = execFileSync(
            'grep',
            ['-rlnE', '--include=*.ts', '--include=*.tsx', pattern, ...paths],
            { encoding: 'utf8' }
        );
        return out.split('\n').filter(Boolean);
    } catch (error) {
        if (hasExitStatus(error, 1)) return [];
        throw error;
    }
}
