/**
 * 꼬리에서 반복해서 떼어내는 법인격·주식 종류 토큰열. 긴 것부터 맞춰야 `l p`가 `p`로
 * 잘못 깎이지 않는다(토큰 단위 비교라 `class a`는 두 토큰으로 한 덩어리다).
 */
const TRAILING_TOKEN_SEQUENCES: readonly (readonly string[])[] = [
    ['common', 'stock'],
    ['ordinary', 'shares'],
    ['class', 'a'],
    ['class', 'b'],
    ['class', 'c'],
    ['l', 'p'],
    ['incorporated'],
    ['corporation'],
    ['holdings'],
    ['holding'],
    ['company'],
    ['limited'],
    ['inc'],
    ['corp'],
    ['co'],
    ['ltd'],
    ['plc'],
    ['llc'],
    ['lp'],
    ['sa'],
    ['nv'],
    ['ag'],
    ['se'],
    ['group'],
    ['the'],
    ['ads'],
    ['adr'],
];

/**
 * 토큰으로 가르기 전에 공백으로 바꾸는 구두점. `;`는 FMP가 펀드 클래스를 붙이는
 * 표기(`MFS Research Fund;A`)다.
 */
const PUNCTUATION_RE = /[.,;'"()/-]/g;

function matchingTailLength(tokens: readonly string[]): number {
    const matched = TRAILING_TOKEN_SEQUENCES.find(
        sequence =>
            sequence.length <= tokens.length &&
            sequence.every(
                (token, i) =>
                    tokens[tokens.length - sequence.length + i] === token
            )
    );
    return matched?.length ?? 0;
}

/**
 * 꼬리 법인격 토큰열을 더 이상 맞는 게 없을 때까지 재귀로 떼어낸다. 매 단계가 토큰을 1개
 * 이상 줄이므로 반드시 끝나고, 전부 떼어 비게 되는 경우(`tail >= length`)는 떼지 않고
 * 멈춘다.
 */
function stripTrailingTokens(tokens: readonly string[]): readonly string[] {
    const tail = matchingTailLength(tokens);
    return tail === 0 || tail >= tokens.length
        ? tokens
        : stripTrailingTokens(tokens.slice(0, tokens.length - tail));
}

/**
 * 회사명을 비교용으로 정규화한다 — 표기 흔들림(`IonQ, Inc.` ↔ `IonQ Inc`,
 * `SEALSQ Corp` ↔ `SEALSQ Corp.`)은 같은 이름으로, 실제 다른 회사는 다른 이름으로
 * 남기는 것이 목적이다. 순수 함수이며 **저장하지 않는다** — 오직 "이름이 바뀌었나"
 * 판정(`planTickerNameReconcile`, `getAssetInfo`)에만 쓴다.
 *
 * NFKC → 소문자 → `&`→`and` → 구두점 공백화 → 공백 축약 → 앞의 `the` 제거 → 꼬리 법인격
 * 토큰 반복 제거. 앞의 `the`는 `Walt Disney Co.` ↔ `The Walt Disney Company` 같은 표기
 * 차이다(뒤의 `the`는 `TRAILING_TOKEN_SEQUENCES`가 뗀다).
 * 전부 떼어 비면(예: `Holdings Group`) 떼기 전 토큰을 유지한다 — 빈 문자열끼리
 * 같다고 판정하는 것이 가장 위험한 오탐이다.
 */
export function normalizeCompanyName(name: string): string {
    const tokens = name
        .normalize('NFKC')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(PUNCTUATION_RE, ' ')
        .split(/\s+/)
        .filter(token => token.length > 0);

    const withoutLeadingThe =
        tokens.length > 1 && tokens[0] === 'the' ? tokens.slice(1) : tokens;
    return stripTrailingTokens(withoutLeadingThe).join(' ');
}
