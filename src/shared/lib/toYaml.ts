/**
 * JSON으로 표현되는 값(객체·배열·문자열·숫자·불리언·null)을 YAML 1.2 텍스트로 직렬화한다.
 *
 * OpenAPI 문서(`/api/v1/openapi.yaml`) 하나를 위해 만든 작은 직렬화기라 의존성을 더하지 않는다.
 * 앵커·태그·플로 스타일 같은 YAML의 나머지 기능은 일부러 쓰지 않는다 — 출력의 모든 문자열은
 * "안전한 평문"이거나 JSON 문자열(YAML 1.2의 이중 따옴표 스칼라와 같은 문법)이고, 줄바꿈이 있는
 * 문자열만 `|-` 블록 리터럴로 나가 읽기 좋게 둔다.
 *
 * `undefined` 값을 가진 객체 키는 `JSON.stringify`처럼 건너뛴다.
 */
export type YamlValue =
    | string
    | number
    | boolean
    | null
    | readonly YamlValue[]
    | { readonly [key: string]: YamlValue | undefined };

const INDENT = '  ';

/** YAML 1.1/1.2가 문자열이 아닌 값으로 읽는 평문. 이 값들은 따옴표로 감싼다. */
const RESERVED_WORDS = new Set([
    'true',
    'false',
    'null',
    'yes',
    'no',
    'on',
    'off',
    'y',
    'n',
    '~',
]);

/** 영문자로 시작하고 영문·숫자·`_ . / -`와 단어 사이 공백만 쓰는 문자열은 따옴표 없이 쓸 수 있다. */
const PLAIN_SCALAR = /^[A-Za-z][A-Za-z0-9_./-]*(?: [A-Za-z0-9_./-]+)*$/;

const PLAIN_KEY = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/**
 * 블록 리터럴이 표현하지 못하는 문자인지: 줄바꿈(LF) 외의 C0 제어 문자, DEL·C1 제어 문자(YAML 1.2의
 * printable 밖), 줄·문단 구분자(U+2028/2029)와 BOM. 제어 문자 정규식 대신 코드 값으로 판정한다
 * (`no-control-regex`를 인라인으로 억제하지 않기 위해 — TOOLCHAIN.md).
 */
function isUnsafeBlockChar(code: number): boolean {
    return (
        (code <= 0x1f && code !== 0x0a) ||
        (code >= 0x7f && code <= 0x9f) ||
        code === 0x2028 ||
        code === 0x2029 ||
        code === 0xfeff
    );
}

function hasUnsafeBlockChar(text: string): boolean {
    return Array.from(text).some(ch => isUnsafeBlockChar(ch.codePointAt(0)!));
}

/** `JSON.stringify`가 이스케이프하지 않지만 YAML 1.2 큰따옴표 스칼라에서 그대로 쓸 수 없는 문자. */
const NEEDS_ESCAPE_IN_QUOTES = new RegExp(
    '[\\u007f-\\u009f\\u2028\\u2029\\ufeff]',
    'g'
);

/**
 * 큰따옴표 스칼라. JSON 문자열 문법은 YAML 1.2와 같지만 DEL·C1 제어 문자·줄/문단 구분자·BOM은 YAML에서
 * 날것으로 쓸 수 없어 `\uXXXX`로 바꾼다. 짝 없는 서로게이트는 `JSON.stringify`가 이미 `\udXXX`로 내보낸다.
 */
function quote(text: string): string {
    return JSON.stringify(text).replace(
        NEEDS_ESCAPE_IN_QUOTES,
        char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
    );
}

function isPlain(text: string, pattern: RegExp): boolean {
    return pattern.test(text) && !RESERVED_WORDS.has(text.toLowerCase());
}

function scalarKey(key: string): string {
    return isPlain(key, PLAIN_KEY) ? key : quote(key);
}

function canUseBlockLiteral(text: string): boolean {
    return (
        text.includes('\n') &&
        text.isWellFormed() &&
        !hasUnsafeBlockChar(text) &&
        // 첫 줄이 공백으로 시작하면 들여쓰기 표시자가 필요하다 — 단순하게 따옴표 쪽으로 보낸다.
        !/^[ \n]/.test(text) &&
        // `|-`는 끝 줄바꿈을 지운다. 끝에 줄바꿈이 있으면 `|+`가 필요하니 따옴표 쪽으로 보낸다.
        !text.endsWith('\n')
    );
}

function scalar(text: string): string {
    return isPlain(text, PLAIN_SCALAR) ? text : quote(text);
}

/** `Array.isArray`는 `readonly` 배열을 좁히지 못해 직접 가드를 둔다. */
function isList(value: YamlValue): value is readonly YamlValue[] {
    return Array.isArray(value);
}

function isRecord(
    value: YamlValue
): value is { readonly [key: string]: YamlValue | undefined } {
    return typeof value === 'object' && value !== null && !isList(value);
}

function renderLiteral(text: string, depth: number): string {
    const pad = INDENT.repeat(depth);
    const body = text
        .split('\n')
        .map(line => (line === '' ? '' : `${pad}${line}`))
        .join('\n');
    return `|-\n${body}`;
}

/** `value`가 컨테이너가 아닐 때의 한 줄(또는 블록 리터럴) 표현. */
function renderLeaf(
    value: string | number | boolean | null,
    depth: number
): string {
    if (typeof value === 'string')
        return canUseBlockLiteral(value)
            ? renderLiteral(value, depth)
            : scalar(value);
    if (typeof value === 'number') {
        if (!Number.isFinite(value))
            throw new TypeError('YAML cannot represent a non-finite number.');
        return String(value);
    }
    return String(value);
}

function renderNode(value: YamlValue, depth: number): string[] {
    const pad = INDENT.repeat(depth);
    if (isList(value)) {
        if (value.length === 0) return [`${pad}[]`];
        return value.flatMap((item: YamlValue) => {
            if (
                (isList(item) && item.length > 0) ||
                (isRecord(item) && definedEntries(item).length > 0)
            ) {
                const [first, ...rest] = renderNode(item, depth + 1);
                return [`${pad}- ${(first ?? '').trimStart()}`, ...rest];
            }
            return [`${pad}- ${renderInline(item, depth + 1)}`];
        });
    }
    if (isRecord(value)) {
        const entries = definedEntries(value);
        if (entries.length === 0) return [`${pad}{}`];
        return entries.flatMap(([key, child]) => {
            const head = `${pad}${scalarKey(key)}:`;
            if (
                (isList(child) && child.length > 0) ||
                (isRecord(child) && definedEntries(child).length > 0)
            )
                return [head, ...renderNode(child, depth + 1)];
            return [`${head} ${renderInline(child, depth + 1)}`];
        });
    }
    return [`${pad}${renderLeaf(value, depth)}`];
}

/** 빈 컨테이너와 리프의 키/하이픈 뒤에 이어 붙는 표현. */
function renderInline(value: YamlValue, depth: number): string {
    if (isList(value)) return '[]';
    if (isRecord(value)) return '{}';
    return renderLeaf(value, depth);
}

function definedEntries(value: {
    readonly [key: string]: YamlValue | undefined;
}): [string, YamlValue][] {
    return Object.entries(value).flatMap(
        ([key, child]): [string, YamlValue][] =>
            child === undefined ? [] : [[key, child]]
    );
}

export function toYaml(value: YamlValue): string {
    // 최상위 블록 리터럴은 본문을 들여써야 한다(0칸이면 문서 구분과 구별되지 않는다) — 한 단계 들여쓴 채로 쓴다.
    if (typeof value === 'string')
        return `${renderLeaf(value, canUseBlockLiteral(value) ? 1 : 0)}\n`;
    return `${renderNode(value, 0).join('\n')}\n`;
}
