import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Skill, SkillCategory, SkillDisplay } from '@/domain/types';
import type { SkillsProvider } from './types';

const SKILLS_DIR = join(process.cwd(), 'skills');

const SKILL_CATEGORIES: readonly SkillCategory[] = [
    'reversal_bullish',
    'reversal_bearish',
    'continuation_bullish',
    'continuation_bearish',
    'neutral',
];

const parseYamlValue = (value: string): unknown => {
    if (value === '[]') return [];
    if (value.startsWith('[') && value.endsWith(']')) {
        const inner = value.slice(1, -1).trim();
        if (inner === '') return [];
        return inner.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
    }
    const num = Number(value);
    if (value !== '' && !isNaN(num)) return num;
    // 따옴표로 감싸진 문자열 처리
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        return value.slice(1, -1);
    }
    return value;
};

type YamlNode = Record<string, unknown>;

/**
 * 중첩 YAML 블록을 재귀적으로 파싱한다.
 * 들여쓰기(2칸)를 기준으로 depth를 결정한다.
 */
const parseYamlBlock = (lines: string[], baseIndent: number): YamlNode => {
    const result: YamlNode = {};
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trimStart();
        if (trimmed === '' || !trimmed.includes(':')) {
            i++;
            continue;
        }

        const indent = line.length - trimmed.length;
        if (indent < baseIndent) break;
        if (indent > baseIndent) {
            i++;
            continue;
        }

        const colonIdx = trimmed.indexOf(':');
        const key = trimmed.slice(0, colonIdx).trim();
        const rawVal = trimmed.slice(colonIdx + 1).trim();

        if (rawVal === '') {
            // 값이 없으면 다음 줄들이 하위 블록
            const childLines: string[] = [];
            let j = i + 1;
            while (j < lines.length) {
                const childTrimmed = lines[j].trimStart();
                if (childTrimmed === '') {
                    j++;
                    continue;
                }
                const childIndent = lines[j].length - childTrimmed.length;
                if (childIndent <= baseIndent) break;
                childLines.push(lines[j]);
                j++;
            }
            result[key] = parseYamlBlock(childLines, baseIndent + 2);
            i = j;
        } else {
            result[key] = parseYamlValue(rawVal);
            i++;
        }
    }

    return result;
};

const parseFrontmatter = (
    raw: string
): { data: Record<string, unknown>; content: string } | null => {
    const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
    if (!match) return null;

    const lines = match[1].split('\n');
    const data = parseYamlBlock(lines, 0);

    return { data, content: match[2].trim() };
};

const isSkillCategory = (value: unknown): value is SkillCategory =>
    typeof value === 'string' &&
    (SKILL_CATEGORIES as readonly string[]).includes(value);

const parseSkillDisplay = (raw: unknown): SkillDisplay | undefined => {
    if (typeof raw !== 'object' || raw === null) return undefined;

    const obj = raw as YamlNode;
    const chartRaw = obj.chart;
    if (typeof chartRaw !== 'object' || chartRaw === null) return undefined;

    const chart = chartRaw as YamlNode;
    if (
        typeof chart.show !== 'boolean' &&
        chart.show !== 'true' &&
        chart.show !== 'false'
    )
        return undefined;

    const show =
        typeof chart.show === 'boolean' ? chart.show : chart.show === 'true';
    const type = String(chart.type ?? '');
    const color = String(chart.color ?? '');
    const label = String(chart.label ?? '');

    if (type !== 'line' && type !== 'marker' && type !== 'region')
        return undefined;

    return {
        chart: { show, type, color, label },
    };
};

const toSkill = (data: Record<string, unknown>, content: string): Skill => ({
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    type: data.type === 'pattern' ? 'pattern' : undefined,
    category: isSkillCategory(data.category) ? data.category : undefined,
    pattern: data.pattern != null ? String(data.pattern) : undefined,
    indicators: Array.isArray(data.indicators)
        ? (data.indicators as string[])
        : [],
    confidenceWeight:
        typeof data.confidence_weight === 'number' ? data.confidence_weight : 0,
    content,
    display: parseSkillDisplay(data.display),
});

export class FileSkillsLoader implements SkillsProvider {
    async loadSkills(): Promise<Skill[]> {
        const files = await readdir(SKILLS_DIR);
        const mdFiles = files.filter(f => f.endsWith('.md'));

        const skills = await Promise.all(
            mdFiles.map(async file => {
                const raw = await readFile(join(SKILLS_DIR, file), 'utf-8');
                const parsed = parseFrontmatter(raw);
                if (!parsed) return null;
                return toSkill(parsed.data, parsed.content);
            })
        );

        return skills.filter((s): s is Skill => s !== null);
    }
}
