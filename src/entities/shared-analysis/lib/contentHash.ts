import { createHash } from 'node:crypto';

/** kind+symbol+result로 dedupe용 안정 해시 생성. */
export function contentHash(
    kind: string,
    symbol: string,
    result: unknown
): string {
    const payload = JSON.stringify({
        kind,
        symbol: symbol.toUpperCase(),
        result,
    });
    return createHash('sha256').update(payload).digest('hex');
}
