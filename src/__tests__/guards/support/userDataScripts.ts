import { readFileSync } from 'node:fs';
import path from 'node:path';

export const USER_DATA_PATH = path.resolve(
    __dirname,
    '../../../../infra/aws/user-data.sh'
);

export function readUserData(): string {
    return readFileSync(USER_DATA_PATH, 'utf8');
}

/**
 * `cat > <file> <<'DELIM'` ... `DELIM` 사이의 본문. user-data.sh가 박스에 그대로 심는 스크립트를
 * 테스트가 실행·검사할 수 있게 꺼낸다(사본을 두면 어긋난다). 없으면 던진다.
 */
export function extractHeredoc(source: string, delimiter: string): string {
    const match = new RegExp(
        `<<'${delimiter}'\\n([\\s\\S]*?)\\n${delimiter}\\n`
    ).exec(source);
    if (match === null) {
        throw new Error(`heredoc ${delimiter} not found in user-data.sh`);
    }
    return match[1];
}
