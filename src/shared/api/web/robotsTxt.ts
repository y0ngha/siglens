/**
 * robots.txt 해석 — 순수 함수. 외부 의존 없음.
 *
 * 규칙은 Google 해석을 따른다: 사용자 에이전트 그룹은 이름이 정확히 같은 것을 우선하고 없으면 `*`, 경로 규칙은
 * 가장 긴 패턴이 이기며 길이가 같으면 허용이 이긴다. `*`(임의 문자열)와 끝의 `$`(끝 고정)만 와일드카드다.
 * 입력은 제3자가 쓴 텍스트이므로 정규식을 만들지 않고 `indexOf` 기반으로 맞춘다(SERVER.md#SA-23).
 */
export interface RobotsRule {
    allow: boolean;
    path: string;
}

/** 한 그룹이 가질 수 있는 규칙 수 상한 — 악의적으로 큰 파일이 매 요청 비용을 키우지 못하게 한다. */
const MAX_RULES = 500;
const MAX_PATTERN_LEN = 512;

interface Group {
    agents: string[];
    rules: RobotsRule[];
}

/** 그룹 하나가 가질 수 있는 user-agent 줄과, 파일 전체의 그룹 수 상한(선형 시간·메모리 보장). */
const MAX_AGENTS_PER_GROUP = 20;
const MAX_GROUPS = 200;

/**
 * 한 번만 훑는다: 줄마다 상수 시간이고 누적은 지역 변수를 제자리에서 갱신한다(입력은 제3자 텍스트라 SA-23).
 * 그룹 수와 그룹당 user-agent 수에 상한이 있어, 상한을 넘는 줄은 읽되 버린다.
 */
function groupsOf(text: string): Group[] {
    const groups: Group[] = [];
    let current: Group | undefined;
    // 직전 줄이 `user-agent`였는가(연속한 user-agent 줄은 같은 그룹을 연다).
    let open = false;
    for (const rawLine of text.split(/\r?\n|\r/)) {
        const hash = rawLine.indexOf('#');
        const line = (hash === -1 ? rawLine : rawLine.slice(0, hash)).trim();
        const colon = line.indexOf(':');
        if (colon === -1) continue;
        const field = line.slice(0, colon).trim().toLowerCase();
        const value = line.slice(colon + 1).trim();
        if (field === 'user-agent') {
            if (open && current !== undefined) {
                if (current.agents.length < MAX_AGENTS_PER_GROUP)
                    current.agents.push(value.toLowerCase());
            } else if (groups.length < MAX_GROUPS) {
                current = { agents: [value.toLowerCase()], rules: [] };
                groups.push(current);
            } else {
                // 상한 뒤의 그룹은 어디에도 속하지 않는다 — 뒤따르는 규칙도 버린다.
                current = undefined;
            }
            open = true;
            continue;
        }
        open = false;
        if (field !== 'allow' && field !== 'disallow') continue;
        if (
            current === undefined ||
            value === '' ||
            value.length > MAX_PATTERN_LEN ||
            current.rules.length >= MAX_RULES
        )
            continue;
        current.rules.push({ allow: field === 'allow', path: value });
    }
    return groups;
}

/** `token`(소문자 제품 토큰)에 적용되는 규칙. 이름이 같은 그룹이 있으면 그것만, 없으면 `*` 그룹. */
export function parseRobots(text: string, token: string): RobotsRule[] {
    const groups = groupsOf(text);
    const named = groups.filter(g => g.agents.includes(token));
    const chosen =
        named.length > 0 ? named : groups.filter(g => g.agents.includes('*'));
    return chosen.flatMap(g => g.rules).slice(0, MAX_RULES);
}

function patternMatches(pattern: string, target: string): boolean {
    const anchored = pattern.endsWith('$');
    const parts = (anchored ? pattern.slice(0, -1) : pattern).split('*');
    const [first, ...rest] = parts;
    if (!target.startsWith(first)) return false;
    if (rest.length === 0) return anchored ? target === first : true;
    const last = rest.at(-1) ?? '';
    const middle = rest.slice(0, -1);
    // 가운데 조각은 가장 왼쪽에서 찾는 것이 항상 최적이다(`?` 같은 한 글자 와일드카드가 없다).
    const position = middle.reduce<number>((pos, part) => {
        if (pos === -1) return -1;
        const at = target.indexOf(part, pos);
        return at === -1 ? -1 : at + part.length;
    }, first.length);
    if (position === -1) return false;
    if (anchored)
        return target.length - last.length >= position && target.endsWith(last);
    return last === '' || target.indexOf(last, position) !== -1;
}

/** `pathAndQuery`(`/a/b?x=1`)를 가져가도 되는지. 맞는 규칙이 없으면 허용이다. */
export function isAllowedByRobots(
    rules: readonly RobotsRule[],
    pathAndQuery: string
): boolean {
    const best = rules.reduce<RobotsRule | null>((winner, rule) => {
        if (!patternMatches(rule.path, pathAndQuery)) return winner;
        if (winner === null) return rule;
        if (rule.path.length !== winner.path.length)
            return rule.path.length > winner.path.length ? rule : winner;
        return rule.allow ? rule : winner;
    }, null);
    return best === null || best.allow;
}

export function isRobotsRuleList(value: unknown): value is RobotsRule[] {
    return (
        Array.isArray(value) &&
        value.every(
            r =>
                typeof r === 'object' &&
                r !== null &&
                typeof (r as RobotsRule).allow === 'boolean' &&
                typeof (r as RobotsRule).path === 'string'
        )
    );
}
