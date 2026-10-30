type YamlNode = Record<string, unknown>;

type ParsedLine =
    | { kind: 'skip' }
    | { kind: 'deeper' }
    | { kind: 'break' }
    | { kind: 'leaf'; key: string; value: unknown }
    | { kind: 'block'; key: string };

/** `skills/*.md`의 frontmatter 데이터와 본문. */
export interface ParsedFrontmatter {
    data: Record<string, unknown>;
    content: string;
}

const parseYamlValue = (value: string): unknown => {
    if (value === '[]') return [];
    if (value.startsWith('[') && value.endsWith(']')) {
        const inner = value.slice(1, -1).trim();
        if (inner === '') return [];
        return inner.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
    }
    const num = Number(value);
    if (value !== '' && !isNaN(num)) return num;
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        return value.slice(1, -1);
    }
    return value;
};

const classifyLine = (line: string, baseIndent: number): ParsedLine => {
    const trimmed = line.trimStart();
    if (trimmed === '' || !trimmed.includes(':')) return { kind: 'skip' };

    const indent = line.length - trimmed.length;
    if (indent < baseIndent) return { kind: 'break' };
    if (indent > baseIndent) return { kind: 'deeper' };

    const colonIdx = trimmed.indexOf(':');
    const key = trimmed.slice(0, colonIdx).trim();
    const rawVal = trimmed.slice(colonIdx + 1).trim();

    if (rawVal !== '')
        return { kind: 'leaf', key, value: parseYamlValue(rawVal) };
    return { kind: 'block', key };
};

/**
 * 중첩 YAML 블록을 재귀적으로 파싱한다.
 * 들여쓰기(2칸)를 기준으로 depth를 결정한다.
 */
const parseYamlBlock = (lines: string[], baseIndent: number): YamlNode =>
    lines.reduce<{ result: YamlNode; skip: number }>(
        ({ result, skip }, line, idx) => {
            if (skip > 0) return { result, skip: skip - 1 };

            const classified = classifyLine(line, baseIndent);

            if (classified.kind === 'skip' || classified.kind === 'deeper') {
                return { result, skip: 0 };
            }
            if (classified.kind === 'break') {
                return { result, skip: lines.length };
            }
            if (classified.kind === 'leaf') {
                return {
                    result: { ...result, [classified.key]: classified.value },
                    skip: 0,
                };
            }

            const { key } = classified;

            const childLines = lines.slice(idx + 1).filter(childLine => {
                const childTrimmed = childLine.trimStart();
                if (childTrimmed === '') return true;
                const childIndent = childLine.length - childTrimmed.length;
                return childIndent > baseIndent;
            });

            return {
                result: {
                    ...result,
                    [key]: parseYamlBlock(childLines, baseIndent + 2),
                },
                skip: childLines.length,
            };
        },
        { result: {}, skip: 0 }
    ).result;

/**
 * 스킬 `.md`를 frontmatter 데이터와 본문으로 가른다. 외부 YAML 라이브러리 없이 스킬이 쓰는
 * 부분집합(스칼라·인라인 배열·2칸 들여쓰기 중첩 블록)만 읽는다. frontmatter가 없으면 `null`.
 */
export const parseFrontmatter = (raw: string): ParsedFrontmatter | null => {
    const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
    if (!match) return null;

    const lines = match[1].split('\n');
    const data = parseYamlBlock(lines, 0);

    return { data, content: match[2].trim() };
};
