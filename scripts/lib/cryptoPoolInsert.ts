/**
 * 방문 후보로 `POPULAR_CRYPTOS`에 들어간 코인을 `CRYPTO_CANDIDATE_POOL`에도 넣는 텍스트
 * 편집 — 순수 함수.
 *
 * 불변식: `CRYPTO_CANDIDATE_POOL ⊇ POPULAR_CRYPTOS` (`update-popular-cryptos.test.ts`).
 * 풀은 시총 순위 경로의 입력이자 상장폐지 판정 범위다. 방문 후보는 풀 밖에서 오므로
 * 넣지 않으면 스크립트 결과를 커밋하는 순간 CI가 깨지고, 이후 시총 경로가 그 코인을
 * 다시 보지 못한다. 라인 번호가 아니라 앵커 문자열로 위치를 찾고, 앵커가 없으면 던진다.
 */

const POOL_DECLARATION =
    'export const CRYPTO_CANDIDATE_POOL: readonly string[] = [';
const POOL_END = '\n];\n';
const POOL_SYMBOL_RE = /^ {4}'([A-Z0-9]+)',/gm;

function poolBounds(content: string): { start: number; end: number } {
    const start = content.indexOf(POOL_DECLARATION);
    if (start === -1) {
        throw new Error('CRYPTO_CANDIDATE_POOL declaration not found');
    }
    const end = content.indexOf(POOL_END, start);
    if (end === -1) throw new Error('CRYPTO_CANDIDATE_POOL end not found');
    return { start, end };
}

/** `CRYPTO_CANDIDATE_POOL` 배열 리터럴의 심볼들, 선언 순서대로. */
export function extractCandidatePool(content: string): string[] {
    const { start, end } = poolBounds(content);
    return [...content.slice(start, end).matchAll(POOL_SYMBOL_RE)].map(
        m => m[1]!
    );
}

/**
 * 풀 배열 끝에 `symbols`를 덧붙인다. 이미 있는 심볼·입력 내 중복은 건너뛴다(멱등).
 * `dateKey`는 사람이 diff에서 언제 들어왔는지 보게 하는 주석용이다.
 */
export function insertIntoCandidatePool(
    content: string,
    symbols: readonly string[],
    dateKey: string
): string {
    const { end } = poolBounds(content);
    const existing = new Set(extractCandidatePool(content));
    const fresh = symbols.filter(
        (symbol, i) => !existing.has(symbol) && symbols.indexOf(symbol) === i
    );
    if (fresh.length === 0) return content;

    const lines = fresh
        .map(symbol => `\n    '${symbol}', // 방문 후보 (${dateKey})`)
        .join('');
    return `${content.slice(0, end)}${lines}${content.slice(end)}`;
}
