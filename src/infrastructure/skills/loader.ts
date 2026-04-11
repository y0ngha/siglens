import { readdir, readFile } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { join } from 'node:path';
import type {
    Skill,
    SkillCategory,
    SkillCounts,
    SkillDisplay,
    SkillType,
} from '@/domain/types';
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

type ParsedLine =
    | { kind: 'skip' }
    | { kind: 'deeper' }
    | { kind: 'break' }
    | { kind: 'leaf'; key: string; value: unknown }
    | { kind: 'block'; key: string };

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

            // block kind
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

const SKILL_TYPES: readonly SkillType[] = [
    'pattern',
    'indicator_guide',
    'strategy',
    'candlestick',
    'support_resistance',
];

const isSkillType = (value: unknown): value is SkillType =>
    typeof value === 'string' &&
    (SKILL_TYPES as readonly string[]).includes(value);

const toSkill = (data: Record<string, unknown>, content: string): Skill => ({
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    type: isSkillType(data.type) ? data.type : undefined,
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

const collectMdFiles = async (dir: string): Promise<string[]> => {
    const entries = await readdir(dir, { withFileTypes: true });
    const results = await Promise.all(
        entries.map(async (entry: Dirent) => {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) return collectMdFiles(fullPath);
            if (entry.name.endsWith('.md')) return [fullPath];
            return [];
        })
    );
    return results.flat();
};

const countMdFiles = async (subdir: string): Promise<number> => {
    const files = await collectMdFiles(join(SKILLS_DIR, subdir));
    return files.length;
};

export async function countSkillFiles(): Promise<SkillCounts> {
    'use cache';
    const [indicators, candlesticks, patterns, strategies, supportResistance] =
        await Promise.all([
            countMdFiles('indicators'),
            countMdFiles('candlesticks'),
            countMdFiles('patterns'),
            countMdFiles('strategies'),
            countMdFiles('support-resistance'),
        ]);
    return {
        indicators,
        candlesticks,
        patterns,
        strategies,
        supportResistance,
    };
}

export class FileSkillsLoader implements SkillsProvider {
    async loadSkills(): Promise<Skill[]> {
        const mdFiles = await collectMdFiles(SKILLS_DIR);

        const skills = await Promise.all(
            mdFiles.map(async file => {
                const raw = await readFile(file, 'utf-8');
                const parsed = parseFrontmatter(raw);
                if (!parsed) return null;
                return toSkill(parsed.data, parsed.content);
            })
        );

        return skills.filter((s): s is Skill => s !== null);
    }
}
