import { execFileSync } from 'node:child_process';

/**
 * 소스 레벨 가드용 grep.
 *
 * `grep ... || true`를 쓰면 안 되는 이유: grep은 **매치 없음(1)**과 **실행 실패
 * (2, 경로 오타·권한)**를 다른 코드로 구분하는데 `|| true`가 둘을 똑같이 "통과"로
 * 만든다. 경로 하나만 틀려도 가드가 영원히 초록으로 거짓말한다.
 * 여기서는 1만 빈 결과로 받고 2 이상은 던진다.
 */
export function grepFiles(pattern: string, paths: readonly string[]): string[] {
    try {
        const out = execFileSync(
            'grep',
            ['-rlnE', '--include=*.ts', '--include=*.tsx', pattern, ...paths],
            { encoding: 'utf8' }
        );
        return out.split('\n').filter(Boolean);
    } catch (error) {
        const status = (error as { status?: number }).status;
        if (status === 1) return [];
        throw error;
    }
}
